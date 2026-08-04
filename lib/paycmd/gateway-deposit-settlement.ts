import type { SupabaseClient } from "@supabase/supabase-js";

import {
  GATEWAY_CHAIN_CONFIGS,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import { tr, type PayCmdLocale } from "@/lib/i18n/server";

export type GatewayFinalitySource =
  | "circle_webhook"
  | "circle_reconciliation"
  | "legacy_timeout";

export type PendingGatewayDeposit = {
  id: string;
  user_id: string;
  amount: number | string;
  chain: SupportedChain;
  tx_hash: string | null;
  created_at: string;
  deposit_block_number?: number | string | null;
};

export type SettledGatewayDeposit = {
  id: string;
  userId: string;
  amount: number | string;
  chain: SupportedChain;
  txHash: string;
  message: string;
  finalitySource: GatewayFinalitySource;
  notificationId?: string;
};

function amountText(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(numeric);
}

export async function archivePendingGatewayNotifications(
  supabase: SupabaseClient,
  userId: string,
) {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("type", "gateway_deposit_pending")
    .neq("status", "archived");

  if (error) {
    console.error("Failed to archive pending Gateway deposit notifications:", error);
  }
}

async function settleChatStatusMessages(
  supabase: SupabaseClient,
  settled: SettledGatewayDeposit,
) {
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, thread_id, created_at, metadata")
    .eq("user_id", settled.userId)
    .eq("metadata->execution->>txHash", settled.txHash);

  if (error) {
    console.error("Failed to load chat messages for settled Gateway deposit:", error);
    return;
  }

  for (const row of rows ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const execution = metadata.execution as Record<string, unknown> | null;
    if (!execution || execution.status !== "waiting_gateway") continue;

    const completedAt = new Date().toISOString();
    const { error: messageError } = await supabase
      .from("chat_messages")
      .update({
        content: settled.message,
        metadata: {
          ...metadata,
          execution: {
            ...execution,
            status: "success",
            finalitySource: settled.finalitySource,
            circleNotificationId: settled.notificationId ?? null,
          },
        },
      })
      .eq("id", row.id)
      .eq("user_id", settled.userId);

    if (messageError) {
      console.error("Failed to settle chat status message for Gateway deposit:", messageError);
      continue;
    }

    const { error: threadError } = await supabase
      .from("chat_threads")
      .update({ last_message_preview: settled.message.slice(0, 220) })
      .eq("id", row.thread_id)
      .eq("user_id", settled.userId)
      .eq("last_message_at", row.created_at);

    if (threadError) {
      console.error("Failed to refresh chat thread preview for Gateway deposit:", threadError);
    }

    const executionId = typeof execution.id === "string" ? execution.id : null;
    if (!executionId) continue;

    const { error: executionError } = await supabase
      .from("command_executions")
      .update({ status: "success", updated_at: completedAt, completed_at: completedAt })
      .eq("id", executionId)
      .eq("user_id", settled.userId)
      .eq("status", "waiting_gateway");

    if (executionError) {
      console.error("Failed to settle command execution for Gateway deposit:", executionError);
    }
  }
}

export async function settleGatewayDeposit(params: {
  supabase: SupabaseClient;
  deposit: PendingGatewayDeposit;
  locale: PayCmdLocale;
  source: GatewayFinalitySource;
  finalizedAt?: string;
  notificationId?: string;
}): Promise<SettledGatewayDeposit | null> {
  const txHash = params.deposit.tx_hash;
  if (!txHash) return null;

  const finalizedAt = params.finalizedAt ?? new Date().toISOString();
  const { data: updatedRows, error: updateError } = await params.supabase
    .from("transaction_history")
    .update({
      status: "success",
      reason:
        params.source === "circle_webhook"
          ? "Circle Gateway finalized and processed the deposit."
          : "Circle Gateway processed the deposit block and no longer lists it as pending.",
      gateway_finalized_at: finalizedAt,
      finality_source: params.source,
      circle_notification_id: params.notificationId ?? null,
    })
    .eq("id", params.deposit.id)
    .eq("user_id", params.deposit.user_id)
    .eq("status", "pending_gateway_finality")
    .select("id");

  if (updateError) {
    throw new Error(`Failed to settle Gateway deposit: ${updateError.message}`);
  }

  if (!updatedRows?.length) return null;

  const message = tr(params.locale, "notifications.gatewayDepositAvailableBody", {
    amount: amountText(params.deposit.amount),
    chain: GATEWAY_CHAIN_CONFIGS[params.deposit.chain]?.label ?? params.deposit.chain,
  });
  const settled: SettledGatewayDeposit = {
    id: params.deposit.id,
    userId: params.deposit.user_id,
    amount: params.deposit.amount,
    chain: params.deposit.chain,
    txHash,
    message,
    finalitySource: params.source,
    notificationId: params.notificationId,
  };

  const { error: notificationError } = await params.supabase.from("notifications").insert({
    user_id: params.deposit.user_id,
    command_execution_id: null,
    type: "gateway_deposit_available",
    title: tr(params.locale, "notifications.gatewayDepositAvailableTitle"),
    body: message,
    status: "unread",
    metadata: {
      txHash,
      finalitySource: params.source,
      circleNotificationId: params.notificationId ?? null,
    },
  });

  if (notificationError) {
    console.error("Failed to insert Gateway deposit available notification:", notificationError);
  }

  await settleChatStatusMessages(params.supabase, settled);

  const { count, error: remainingError } = await params.supabase
    .from("transaction_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.deposit.user_id)
    .eq("tx_type", "deposit")
    .eq("status", "pending_gateway_finality");

  if (!remainingError && count === 0) {
    await archivePendingGatewayNotifications(params.supabase, params.deposit.user_id);
  }

  return settled;
}

export async function findPendingGatewayDepositByTxHash(
  supabase: SupabaseClient,
  txHash: string,
): Promise<PendingGatewayDeposit | null> {
  const { data, error } = await supabase
    .from("transaction_history")
    .select("id, user_id, amount, chain, tx_hash, created_at, deposit_block_number")
    .eq("tx_type", "deposit")
    .eq("status", "pending_gateway_finality")
    .ilike("tx_hash", txHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find Gateway deposit: ${error.message}`);
  }

  return (data as PendingGatewayDeposit | null) ?? null;
}
