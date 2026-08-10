import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import {
  GATEWAY_CHAIN_CONFIGS,
  fetchGatewayInfo,
  fetchGatewayPendingDeposits,
} from "@/lib/circle/gateway-sdk";
import { requestLocale } from "@/lib/i18n/server";
import {
  archivePendingGatewayNotifications,
  settleGatewayDeposit,
  type PendingGatewayDeposit,
  type SettledGatewayDeposit,
} from "@/lib/paycmd/gateway-deposit-settlement";
import {
  gatewayDepositSettlementSnapshotsFromMessages,
  reconciliationDecision,
} from "@/lib/paycmd/gateway-finality";
import { createClient } from "@/lib/supabase/server";

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

    const loadSettlementSnapshots = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("content, metadata, created_at")
        .eq("user_id", user.id)
        .eq("kind", "status")
        .eq("metadata->execution->>command", "deposit")
        .eq("metadata->execution->>status", "success")
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        console.error("Failed to load settled Gateway deposit snapshots:", error);
        return [];
      }

      return gatewayDepositSettlementSnapshotsFromMessages(data ?? []);
    };

    const { data: pendingRows, error } = await supabase
      .from("transaction_history")
      .select("id, user_id, amount, chain, tx_hash, created_at, deposit_block_number")
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

    const pending = (pendingRows ?? []) as PendingGatewayDeposit[];
    if (pending.length === 0) {
      // Also archive here, not just after a settling loop: two syncs overlap routinely, and when
      // they split the rows between them neither one sees an empty `stillPending`, so neither
      // archives. Gating on "this request settled something" made that miss permanent — no later
      // sync could clean up, because by then there is nothing left to complete. Observed live:
      // both deposits settled, yet the waiting notification stayed unread.
      await archivePendingGatewayNotifications(supabase, user.id);
      return NextResponse.json({
        success: true,
        completed: [],
        settled: await loadSettlementSnapshots(),
        pending: [],
      });
    }

    // Deposits are made by the SCA, so only SCA depositors can own Payna Gateway balances.
    const depositors: Address[] = [];

    const { data: scaWallets, error: scaError } = await supabase
      .from("wallets")
      .select("address, wallet_address")
      .eq("user_id", user.id)
      .eq("type", "sca")
      // No `.limit(1)`: users can have more than one `sca` row, and picking one without an
      // order is non-deterministic in Postgres. Extra depositors are free — they ride along in
      // the same Circle request.
      .order("created_at", { ascending: true });

    if (scaError) {
      console.error("Failed to load SCA wallets for Gateway deposit sync:", scaError);
    }

    for (const wallet of scaWallets ?? []) {
      const address = wallet.address || wallet.wallet_address;
      if (address) depositors.push(address as Address);
    }

    if (depositors.length === 0) {
      return NextResponse.json({
        success: true,
        completed: [],
        settled: await loadSettlementSnapshots(),
        pending: pending.map((row) => row.id),
        reason: "No wallet address found. Run /wallet create first.",
      });
    }

    // Webhooks are authoritative. This endpoint is the recovery path: it only settles a new
    // deposit after Circle has processed at least the block containing it and no longer lists the
    // exact transaction hash as pending. That removes the ambiguous fixed 90-second guess.
    const [pendingAtCircle, gatewayInfo] = await Promise.all([
      fetchGatewayPendingDeposits(depositors),
      fetchGatewayInfo(),
    ]);
    const unsettledTxHashes = new Set(
      pendingAtCircle.deposits.map((item) => item.transactionHash.toLowerCase()),
    );
    const processedHeightByDomain = new Map<number, bigint>();
    for (const domain of gatewayInfo.domains) {
      try {
        processedHeightByDomain.set(domain.domain, BigInt(domain.processedHeight));
      } catch {
        console.warn("Ignoring invalid Circle processedHeight:", domain);
      }
    }

    // Rows created before the block-number migration cannot use positive processed-height
    // evidence. Keep the old grace rule only for those legacy rows so they remain recoverable.
    const LEGACY_INDEXING_GRACE_MS = 90_000;
    const now = Date.now();
    const completed: SettledGatewayDeposit[] = [];

    for (const row of pending) {
      const txHash = row.tx_hash?.toLowerCase();
      if (!txHash) {
        console.warn("Skipping Gateway deposit sync for row without tx_hash:", row.id);
        continue;
      }

      let source: "circle_reconciliation" | "legacy_timeout" | null = null;
      if (row.deposit_block_number !== null && row.deposit_block_number !== undefined) {
        const domain = GATEWAY_CHAIN_CONFIGS[row.chain]?.domain;
        const decision = reconciliationDecision({
          txHash,
          pendingTxHashes: unsettledTxHashes,
          depositBlockNumber: BigInt(row.deposit_block_number),
          processedHeight: processedHeightByDomain.get(domain) ?? null,
        });
        if (decision.settled) source = "circle_reconciliation";
      } else {
        const createdAt = new Date(row.created_at).getTime();
        const oldEnough = Number.isFinite(createdAt) && now - createdAt >= LEGACY_INDEXING_GRACE_MS;
        if (oldEnough && !unsettledTxHashes.has(txHash)) source = "legacy_timeout";
      }

      if (!source) continue;

      const settled = await settleGatewayDeposit({
        supabase,
        deposit: row,
        locale,
        source,
      });
      if (settled) completed.push(settled);
    }

    // Re-read instead of subtracting `completed` from this request's snapshot. The client fires
    // sync from mount, window focus, the 60s interval and the post-command timers, so two
    // requests overlap routinely — and each one then wins the `.eq("status", ...)` race on a
    // different row, so both conclude something is still pending. Observed live: two deposits
    // settled 0.5s apart in separate requests, neither reached the archive below, and the badge
    // held at 1. A fresh read is authoritative no matter which request settled what.
    const { data: remainingRows, error: remainingError } = await supabase
      .from("transaction_history")
      .select("id")
      .eq("user_id", user.id)
      .eq("tx_type", "deposit")
      .eq("status", "pending_gateway_finality");

    if (remainingError) {
      console.error("Failed to re-read pending Gateway deposits:", remainingError);
    }

    // On a failed re-read, fall back to the local view: it can overcount, and overcounting only
    // keeps the badge up a minute longer, while undercounting would drop the waiting signal.
    const stillPending = remainingError
      ? pending.filter((row) => !completed.some((item) => item.id === row.id)).map((row) => row.id)
      : (remainingRows ?? []).map((row) => row.id);

    // Nothing left waiting: retire the "waiting for finality" notifications. There is no
    // mark-as-read path anywhere in the app, so otherwise they would sit unread next to the
    // "balance is available" notification and contradict it. `/notifications` already filters
    // out `archived`, so they drop off the list and out of the unread badge.
    if (stillPending.length === 0) {
      await archivePendingGatewayNotifications(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      completed,
      settled: await loadSettlementSnapshots(),
      pending: stillPending,
    });
  } catch (error) {
    console.error("Failed to sync Gateway deposits:", error);
    return NextResponse.json(
      { error: "Failed to sync Gateway deposits." },
      { status: 500 },
    );
  }
}
