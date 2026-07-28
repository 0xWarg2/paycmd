import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseUnits } from "viem";

import { paynaSwapTokens } from "@/lib/paycmd/swap";
import { recordRaReceipt, updateRaProofColumns } from "@/lib/ra/receipt-registry";
import { createClient } from "@/lib/supabase/server";

const swapRecordSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenIn: z.enum(["USDC", "EURC", "cirBTC"]),
  tokenOut: z.enum(["USDC", "EURC", "cirBTC"]),
  amountIn: z.string().min(1),
  amountOut: z.string().min(1),
  amountOutMin: z.string().min(1),
  route: z.array(z.enum(["USDC", "EURC", "cirBTC"])).min(2).max(3),
  status: z.enum(["success", "failed", "pending"]).default("success"),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = swapRecordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid swap record payload" }, { status: 400 });
  }

  const payload = parsed.data;
  const reason = JSON.stringify({
    tokenIn: payload.tokenIn,
    tokenOut: payload.tokenOut,
    amountOut: payload.amountOut,
    amountOutMin: payload.amountOutMin,
    route: payload.route,
    swapAdapter: process.env.PAYNA_SWAP_ADAPTER_ADDRESS ?? process.env.NEXT_PUBLIC_PAYNA_SWAP_ADAPTER_ADDRESS ?? null,
  });

  const { data, error } = await supabase
    .from("transaction_history")
    .insert({
      user_id: user.id,
      chain: "arcTestnet",
      destination_chain: "arcTestnet",
      tx_type: "swap",
      amount: payload.amountIn,
      tx_hash: payload.txHash,
      status: payload.status,
      reason,
      gateway_wallet_address: payload.userAddress,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to record swap transaction", error);
    return NextResponse.json({ error: "Failed to record swap transaction" }, { status: 500 });
  }

  try {
    const proof = await recordRaReceipt({
      action: "swap",
      userAddress: payload.userAddress,
      recipientAddress: payload.recipientAddress,
      amount: payload.amountIn,
      amountAtomic: parseUnits(payload.amountIn, paynaSwapTokens[payload.tokenIn].decimals).toString(),
      sourceChain: "arcTestnet",
      destinationChain: "arcTestnet",
      sourceTxHash: payload.txHash,
      destinationTxHash: payload.txHash,
      metadata: {
        transactionHistoryId: data.id,
        tokenIn: payload.tokenIn,
        tokenOut: payload.tokenOut,
        tokenInAddress: paynaSwapTokens[payload.tokenIn].address,
        tokenOutAddress: paynaSwapTokens[payload.tokenOut].address,
        amountOut: payload.amountOut,
        amountOutMin: payload.amountOutMin,
        route: payload.route,
      },
    });
    await updateRaProofColumns({ supabase, transactionId: data.id, result: proof });
    return NextResponse.json({
      transaction: {
        ...data,
        proof_chain: proof.enabled ? proof.chain : "arcTestnet",
        proof_contract_address:
          proof.enabled
            ? proof.contractAddress
            : process.env.RA_RECEIPT_REGISTRY_V2_ADDRESS ?? process.env.RA_RECEIPT_REGISTRY_ADDRESS ?? null,
        proof_tx_hash: proof.enabled ? proof.txHash : null,
        proof_status: proof.status,
        proof_error: proof.enabled ? null : proof.reason,
      },
    });
  } catch (proofError) {
    console.warn("Failed to record Payna swap proof.", proofError);
    await updateRaProofColumns({
      supabase,
      transactionId: data.id,
      result: { enabled: false, status: "skipped", reason: "proof write failed" },
      error: proofError,
    });
  }

  return NextResponse.json({ transaction: data });
}
