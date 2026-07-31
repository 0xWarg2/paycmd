import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import {
  GATEWAY_CHAIN_CONFIGS,
  fetchGatewayPendingDeposits,
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

function amountText(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(numeric);
}

// Retires the "waiting for finality" notifications. There is no mark-as-read path anywhere in the
// app, so without this they sit unread next to the "balance is available" notification and
// contradict it. `/notifications` filters out `archived`, so they drop off the list and out of the
// unread badge. Idempotent, which is what lets both call sites below run it unconditionally.
async function archivePendingNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

type SettledDeposit = {
  amount: number | string;
  chain: SupportedChain;
  txHash: string | null;
  // Localized once, then reused for the notification body, the repainted chat card, and the
  // client-side live patch — so the three surfaces cannot drift into saying different things.
  message: string;
};

// The chat card that announced the deposit is still rendering `waiting_gateway` and nothing ever
// revisits it: `writeStatus` inserts a chat row and drops the returned id, so the client has no
// handle on the message it wrote. Reconcile by `txHash` instead — `deposit/route.ts` writes the
// same string into `transaction_history.tx_hash` and into the execution the chat message stores,
// so it is an exact join key that needs no schema change.
//
// This runs server-side on purpose: the settling deposit's message may live in a thread the user
// no longer has open, or in no open browser at all. A client-only patch would leave those cards
// spinning until a manual reload.
async function settleChatStatusMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  locale: Parameters<typeof tr>[0],
  settled: SettledDeposit[],
) {
  for (const item of settled) {
    if (!item.txHash) continue;

    const { data: rows, error } = await supabase
      .from("chat_messages")
      .select("id, thread_id, created_at, metadata")
      .eq("user_id", userId)
      .eq("metadata->execution->>txHash", item.txHash);

    if (error) {
      console.error("Failed to load chat messages for settled Gateway deposit:", error);
      continue;
    }

    for (const row of rows ?? []) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const execution = metadata.execution as Record<string, unknown> | null;

      // Only the final message carries `txHash`; the queued/running lines above it are historical
      // progress and must keep their own status.
      if (!execution || execution.status !== "waiting_gateway") continue;

      // Replacing the body matters as much as the status: `buildExecutionReceipt` has no deposit
      // branch, so the card renders this text verbatim. Leaving it would pair a green check with
      // the sentence "waiting for Circle Gateway finality".
      const { error: messageError } = await supabase
        .from("chat_messages")
        .update({
          content: item.message,
          metadata: { ...metadata, execution: { ...execution, status: "success" } },
        })
        .eq("id", row.id)
        .eq("user_id", userId);

      if (messageError) {
        console.error("Failed to settle chat status message for Gateway deposit:", messageError);
      } else {
        // `chat_threads` caches the newest message for the thread list, and its trigger is
        // `after insert` only — so an UPDATE leaves the sidebar preview still reading "waiting
        // for finality" next to a settled card. Guarding on `last_message_at` makes this a no-op
        // once a newer message exists, since the trigger sets that column from `created_at`.
        const { error: threadError } = await supabase
          .from("chat_threads")
          .update({ last_message_preview: item.message.slice(0, 220) })
          .eq("id", row.thread_id)
          .eq("user_id", userId)
          .eq("last_message_at", row.created_at);

        if (threadError) {
          console.error("Failed to refresh chat thread preview for Gateway deposit:", threadError);
        }
      }

      // `ExecutionItem.id` is the `command_executions` row id, so the same flip belongs there.
      const executionId = typeof execution.id === "string" ? execution.id : null;
      if (!executionId) continue;

      const { error: executionError } = await supabase
        .from("command_executions")
        .update({ status: "success", updated_at: new Date().toISOString() })
        .eq("id", executionId)
        .eq("user_id", userId)
        .eq("status", "waiting_gateway");

      if (executionError) {
        console.error("Failed to settle command execution for Gateway deposit:", executionError);
      }
    }
  }
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
      // Also archive here, not just after a settling loop: two syncs overlap routinely, and when
      // they split the rows between them neither one sees an empty `stillPending`, so neither
      // archives. Gating on "this request settled something" made that miss permanent — no later
      // sync could clean up, because by then there is nothing left to complete. Observed live:
      // both deposits settled, yet the waiting notification stayed unread.
      await archivePendingNotifications(supabase, user.id);
      return NextResponse.json({ success: true, completed: [], pending: [] });
    }

    // `GatewayWallet.deposit()` credits the *calling* wallet, and `/deposit` calls it from the
    // user's SCA — the Gateway signer EOA only signs burn intents. This route used to ask Circle
    // about the signer EOA alone, so `available` was always 0 and the guard below `continue`d
    // silently: no error, no log, no notification, and rows sat in `pending_gateway_finality`
    // forever. Meanwhile `app/api/gateway/balance/route.ts` reads the SCA, which is why the UI
    // showed the credited balance while the transaction row hung. Ask about both addresses so
    // older rows settle regardless of which one deposited at the time.
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

    try {
      const eoaWallet = await getGatewayEOAWalletId(user.id, "MULTICHAIN");
      if (eoaWallet.address) depositors.push(eoaWallet.address as Address);
    } catch (walletError) {
      // Missing signer EOA is not fatal here: it never receives deposit credit. Only log it.
      console.warn(
        "Gateway signer EOA unavailable during deposit sync:",
        walletError instanceof Error ? walletError.message : walletError,
      );
    }

    if (depositors.length === 0) {
      return NextResponse.json({
        success: true,
        completed: [],
        pending: pending.map((row) => row.id),
        reason: "No wallet address found. Run /wallet create first.",
      });
    }

    // Ask Circle which deposits it has NOT credited yet, and settle the rows that are absent.
    //
    // This replaces a balance comparison (`balance >= row.amount`) that asked the wrong question:
    // "does this depositor hold enough USDC?" rather than "did this deposit arrive?". Those differ
    // whenever the chain already had funds — a 1 USDC deposit onto a chain holding 40 satisfies
    // `40 >= 1` on the first sync, seconds after submission. It reported four Base deposits as
    // available while Circle still listed all four as pending and the balance sat unchanged at 40.
    // The old form was only ever right because the deposits it was written against started from 0.
    //
    // No balance check remains. Absence from this list means Circle credited the deposit, which is
    // the whole claim a settled row makes; re-checking the balance would also hang a row forever if
    // the user spent the funds before the next sync. It also retires the SCA-vs-EOA pooling problem
    // the balance path had to guard against, since Circle credits one concrete depositor address.
    //
    // Absence carries one assumption worth naming: it is scoped to the depositors queried below,
    // and it reads "credited" for a deposit Circle never observed at all — a confirmed transaction
    // that Circle did not ingest would settle wrongly. That is narrow in practice, since `/deposit`
    // only records a hash after the transaction confirms and a confirmed `deposit()` emits the event
    // Circle watches, but it is why rows arrive here with a hash or not at all. Turning this into
    // positive evidence would mean comparing the deposit's block against the chain's
    // `processedHeight` from `/v1/info`, which needs the block number this table does not store.
    const pendingAtCircle = await fetchGatewayPendingDeposits(depositors);
    const unsettledTxHashes = new Set(
      pendingAtCircle.deposits.map((item) => item.transactionHash.toLowerCase()),
    );

    // Absence is ambiguous for a brand-new row: Circle may simply not have indexed the deposit yet,
    // which is indistinguishable from having credited it. Waiting until the row is old enough to
    // have been indexed collapses that ambiguity — and indexing is prompt (Circle lists deposits
    // while they are still unfinalized, which is what `status: "pending"` means), so this is about
    // indexer lag, not the 13-19 min Base finality window.
    //
    // The cost is that a fast chain settles one sync later than it could: Arc credits in ~0.5s, so
    // its rows wait for the first sync past the grace period instead of the +0s one. That is the
    // right trade — the alternative is the false "available" this whole change exists to remove.
    const INDEXING_GRACE_MS = 90_000;
    const now = Date.now();

    const completed: Array<SettledDeposit & { id: string }> = [];

    for (const row of pending) {
      // Without a hash there is nothing to match against Circle's list, so there is no evidence
      // the deposit landed. Leave it pending rather than guess: `/deposit` always records one, and
      // a stuck row is recoverable while a wrong "available" is what the user acts on.
      const txHash = row.tx_hash?.toLowerCase();
      if (!txHash) {
        console.warn("Skipping Gateway deposit sync for row without tx_hash:", row.id);
        continue;
      }

      // Still on Circle's books as uncredited.
      if (unsettledTxHashes.has(txHash)) {
        continue;
      }

      const createdAt = new Date(row.created_at).getTime();
      if (!Number.isFinite(createdAt) || now - createdAt < INDEXING_GRACE_MS) {
        continue;
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from("transaction_history")
        .update({
          status: "success",
          // Names the actual evidence. The previous wording ("balance is available") described the
          // balance comparison this replaced, and would have made a row settled by the old
          // false-positive path indistinguishable from one Circle confirmed.
          reason: "Circle Gateway credited the deposit (absent from pending deposits).",
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

      // No balance bookkeeping between rows any more. Circle reports each deposit individually, so
      // two deposits on the same chain settle on their own evidence rather than competing for one
      // balance figure — which is what the old debit existed to arbitrate.
      const message = tr(locale, "notifications.gatewayDepositAvailableBody", {
        amount: amountText(row.amount),
        chain: CHAIN_LABELS[row.chain] ?? row.chain,
      });

      completed.push({
        id: row.id,
        amount: row.amount,
        chain: row.chain,
        txHash: row.tx_hash,
        message,
      });

      await supabase.from("notifications").insert({
        user_id: user.id,
        command_execution_id: null,
        type: "gateway_deposit_available",
        title: tr(locale, "notifications.gatewayDepositAvailableTitle"),
        body: message,
        status: "unread",
      });
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
      await archivePendingNotifications(supabase, user.id);
    }

    // Last, and non-fatal: the status flip and the notifications above are what the user acts on,
    // so a failure repainting old chat cards must not hold them up.
    if (completed.length > 0) {
      await settleChatStatusMessages(supabase, user.id, locale, completed);
    }

    return NextResponse.json({
      success: true,
      completed,
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
