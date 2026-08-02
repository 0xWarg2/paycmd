import { NextResponse } from "next/server";
import { z } from "zod";

import { arcPublicClient } from "@/lib/paycmd/arc-rpc";
import { createClient } from "@/lib/supabase/server";

// Receipt polling was the single largest consumer of the Arc rate limit. The client polled
// `eth_getTransactionReceipt` through MetaMask every 2s, up to 30 times, for *each* of the two
// transactions a swap sends (approve + swap) — up to 60 requests per swap, all at a fixed interval
// that ignored whether the chain had already answered.
//
// `waitForTransactionReceipt` replaces the fixed loop: it returns the instant a receipt exists and
// backs off while waiting, and it runs behind the shared throttle in `lib/paycmd/arc-rpc.ts`.
//
// The wait is deliberately short and the route is resumable. A serverless function has a hard
// duration ceiling, so instead of holding one request open for minutes this returns
// `status: "pending"` when the receipt has not landed yet and lets the caller ask again. Arc
// produces blocks in about a second, so the first attempt almost always carries the answer.
const WAIT_MS = 8_000;

const receiptSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = receiptSchema.safeParse(await req.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid receipt payload" }, { status: 400 });
  }

  const txHash = parsed.data.txHash as `0x${string}`;

  try {
    const receipt = await arcPublicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: WAIT_MS,
      // Floor on how often viem re-checks. Left generous because Arc's limit is a burst allowance:
      // spacing requests out is what keeps this under it.
      pollingInterval: 1_500,
      confirmations: 1,
    });

    return NextResponse.json({
      txHash,
      status: receipt.status === "success" ? "success" : "failed",
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    // viem throws `WaitForTransactionReceiptTimeoutError` when the wait elapses with no receipt.
    // That is not a failure: the transaction is still in flight, so report it as pending and let
    // the caller poll again rather than telling the user their swap broke.
    const name = error instanceof Error ? error.name : "";

    if (name === "WaitForTransactionReceiptTimeoutError" || name === "TransactionNotFoundError") {
      return NextResponse.json({ txHash, status: "pending" });
    }

    console.error("Failed to read Arc swap receipt", error);

    return NextResponse.json(
      { txHash, status: "pending", detail: "Could not reach Arc Testnet to read this receipt." },
      { status: 502 },
    );
  }
}
