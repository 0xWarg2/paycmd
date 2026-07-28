import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recordRaReceipt, updateRaProofColumns } from "@/lib/ra/receipt-registry";
import { createClient } from "@/lib/supabase/server";

const bridgeRecordSchema = z.object({
  sourceChain: z.string().min(1),
  destinationChain: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  sourceTxHash: z.string().min(1).optional(),
  mintTxHash: z.string().min(1).optional(),
  userAddress: z.string().min(1).optional(),
  recipientAddress: z.string().min(1).optional(),
  recipientMode: z.enum(["self", "external"]).default("self"),
  mintMode: z.enum(["auto_forwarding", "manual_mint"]).default("auto_forwarding"),
  transferSpeed: z.enum(["FAST", "SLOW"]).default("FAST"),
  status: z.enum(["success", "failed", "pending"]).default("success"),
  transferId: z.string().optional(),
  reason: z.string().optional(),
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
  const parsed = bridgeRecordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bridge record payload" }, { status: 400 });
  }

  const payload = parsed.data;
  const txHash = payload.sourceTxHash ?? payload.mintTxHash ?? null;
  const reason = payload.reason
    ? payload.reason
    : JSON.stringify({
        recipientAddress: payload.recipientAddress ?? null,
        recipientMode: payload.recipientMode,
        mintMode: payload.mintMode,
        transferSpeed: payload.transferSpeed,
        transferId: payload.transferId ?? null,
        mintTxHash: payload.mintTxHash ?? null,
      });

  const { data, error } = await supabase
    .from("transaction_history")
    .insert({
      user_id: user.id,
      chain: payload.sourceChain,
      destination_chain: payload.destinationChain,
      tx_type: "bridge",
      amount: payload.amount,
      tx_hash: txHash,
      status: payload.status,
      reason,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to record bridge transaction", error);
    return NextResponse.json({ error: "Failed to record bridge transaction" }, { status: 500 });
  }

  try {
    const proof = await recordRaReceipt({
      action: "bridge",
      userAddress: payload.userAddress,
      recipientAddress: payload.recipientAddress ?? payload.userAddress,
      amount: payload.amount,
      sourceChain: payload.sourceChain,
      destinationChain: payload.destinationChain,
      sourceTxHash: payload.sourceTxHash,
      destinationTxHash: payload.mintTxHash,
      metadata: {
        transactionHistoryId: data.id,
        recipientMode: payload.recipientMode,
        mintMode: payload.mintMode,
        transferSpeed: payload.transferSpeed,
        transferId: payload.transferId ?? null,
      },
    });
    await updateRaProofColumns({ supabase, transactionId: data.id, result: proof });
    return NextResponse.json({
      transaction: {
        ...data,
        proof_chain: proof.enabled ? proof.chain : "arcTestnet",
        proof_contract_address: proof.enabled ? proof.contractAddress : process.env.RA_RECEIPT_REGISTRY_ADDRESS ?? null,
        proof_tx_hash: proof.enabled ? proof.txHash : null,
        proof_status: proof.status,
        proof_error: proof.enabled ? null : proof.reason,
      },
    });
  } catch (proofError) {
    console.warn("Failed to record Payna bridge proof.", proofError);
    await updateRaProofColumns({
      supabase,
      transactionId: data.id,
      result: { enabled: false, status: "skipped", reason: "proof write failed" },
      error: proofError,
    });
  }

  return NextResponse.json({ transaction: data });
}
