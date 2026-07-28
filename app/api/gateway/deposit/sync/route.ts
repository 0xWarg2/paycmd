import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import {
  CHAIN_BY_DOMAIN,
  GATEWAY_CHAIN_CONFIGS,
  fetchGatewayBalance,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import { getGatewayEOAWalletId } from "@/lib/circle/create-gateway-eoa-wallets";
import { requestLocale, tr } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type PendingDeposit = {
  id: string;
  amount: number | string;
  chain: SupportedChain;
  tx_hash: string | null;
  created_at: string;
};

const CHAIN_LABELS = Object.fromEntries(
  Object.entries(GATEWAY_CHAIN_CONFIGS).map(([chain, config]) => [chain, config.label]),
) as Record<SupportedChain, string>;

function decimalUsdcToAtomic(value: number | string | null | undefined): bigint {
  const normalized = String(value ?? "0").trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) return 0n;

  const [whole = "0", fraction = ""] = normalized.split(".");
  const paddedFraction = `${fraction}000000`.slice(0, 6);

  return BigInt(whole) * 1_000_000n + BigInt(paddedFraction || "0");
}

function amountText(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(numeric);
}

export async function POST(req: NextRequest) {
  const locale = requestLocale(req);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: pendingRows, error } = await supabase
      .from("transaction_history")
      .select("id, amount, chain, tx_hash, created_at")
      .eq("user_id", user.id)
      .eq("tx_type", "deposit")
      .eq("status", "pending_gateway_finality")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load pending Gateway deposits:", error);
      return NextResponse.json(
        { error: "Failed to load pending Gateway deposits." },
        { status: 500 },
      );
    }

    const pending = (pendingRows ?? []) as PendingDeposit[];
    if (pending.length === 0) {
      return NextResponse.json({ success: true, completed: [], pending: [] });
    }

    let eoaAddress: Address;
    try {
      const wallet = await getGatewayEOAWalletId(user.id, "MULTICHAIN");
      eoaAddress = wallet.address as Address;
    } catch (walletError) {
      return NextResponse.json({
        success: true,
        completed: [],
        pending: pending.map((row) => row.id),
        reason: walletError instanceof Error ? walletError.message : "Gateway EOA wallet not found.",
      });
    }

    const gatewayBalance = await fetchGatewayBalance(eoaAddress);
    const availableByChain = new Map<SupportedChain, bigint>();

    for (const item of gatewayBalance.balances ?? []) {
      const chain = CHAIN_BY_DOMAIN[item.domain];
      if (!chain) continue;

      const current = availableByChain.get(chain) ?? 0n;
      availableByChain.set(chain, current + decimalUsdcToAtomic(item.balance));
    }

    const completed: Array<{
      id: string;
      amount: number | string;
      chain: SupportedChain;
      txHash: string | null;
    }> = [];

    for (const row of pending) {
      const chain = row.chain;
      const needed = decimalUsdcToAtomic(row.amount);
      const available = availableByChain.get(chain) ?? 0n;

      if (needed <= 0n || available < needed) {
        continue;
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("transaction_history")
        .update({
          status: "success",
          reason: "Circle Gateway balance is available.",
        })
        .eq("id", row.id)
        .eq("user_id", user.id)
        .eq("status", "pending_gateway_finality")
        .select("id");

      if (updateError) {
        console.error("Failed to mark Gateway deposit as available:", updateError);
        continue;
      }

      if (!updatedRows?.length) {
        continue;
      }

      availableByChain.set(chain, available - needed);
      completed.push({
        id: row.id,
        amount: row.amount,
        chain,
        txHash: row.tx_hash,
      });

      const chainLabel = CHAIN_LABELS[chain] ?? chain;
      await supabase.from("notifications").insert({
        user_id: user.id,
        command_execution_id: null,
        type: "gateway_deposit_available",
        title: tr(locale, "notifications.gatewayDepositAvailableTitle"),
        body: tr(locale, "notifications.gatewayDepositAvailableBody", {
          amount: amountText(row.amount),
          chain: chainLabel,
        }),
        status: "unread",
      });
    }

    return NextResponse.json({
      success: true,
      completed,
      pending: pending
        .filter((row) => !completed.some((item) => item.id === row.id))
        .map((row) => row.id),
    });
  } catch (error) {
    console.error("Failed to sync Gateway deposits:", error);
    return NextResponse.json(
      { error: "Failed to sync Gateway deposits." },
      { status: 500 },
    );
  }
}
