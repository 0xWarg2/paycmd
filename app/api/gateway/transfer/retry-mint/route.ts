import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";

import {
  GatewayCircleKitError,
  isCircleKitGatewayChain,
  retryCircleKitUnifiedMint,
} from "@/lib/circle/unified-balance-kit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function recordFrom(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const operationId = typeof body.operationId === "string" ? body.operationId : "";
  if (!operationId) {
    return NextResponse.json({
      error: "GATEWAY_OPERATION_ID_REQUIRED",
      message: "operationId is required to retry a Manual mint.",
    }, { status: 400 });
  }

  const { data: operation, error: operationError } = await supabase
    .from("transaction_history")
    .select("id, status, tx_hash, gateway_engine, gateway_state, gateway_expiration_block")
    .eq("user_id", user.id)
    .eq("gateway_operation_id", operationId)
    .maybeSingle();
  if (operationError) throw operationError;
  if (!operation) {
    return NextResponse.json({
      error: "GATEWAY_OPERATION_NOT_FOUND",
      message: "Unified Balance operation was not found.",
    }, { status: 404 });
  }
  if (operation.status === "success") {
    return NextResponse.json({
      success: true,
      duplicate: true,
      operationId,
      transactionId: operation.id,
      destinationTxHash: operation.tx_hash,
    });
  }
  if (operation.gateway_engine !== "circle_kit" || operation.gateway_state !== "pending_mint") {
    return NextResponse.json({
      error: "GATEWAY_MINT_NOT_RESUMABLE",
      message: "This operation is not waiting for a resumable Manual mint.",
      operationId,
      gatewayState: operation.gateway_state,
      safeToRetry: false,
    }, { status: 409 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({
      error: "GATEWAY_RECOVERY_STORE_UNAVAILABLE",
      message: "Server-only Gateway recovery storage is not configured.",
      operationId,
      safeToRetry: false,
    }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("gateway_operation_recovery")
    .update({ claimed_at: now, updated_at: now })
    .eq("transaction_id", operation.id)
    .eq("user_id", user.id)
    .eq("gateway_operation_id", operationId)
    .is("claimed_at", null)
    .gt("expires_at", now)
    .select("recovery_payload, expires_at")
    .maybeSingle();
  if (claimError) {
    return NextResponse.json({
      error: "GATEWAY_RECOVERY_STORE_UNAVAILABLE",
      message: "Gateway recovery data could not be claimed safely.",
      operationId,
      safeToRetry: false,
    }, { status: 503 });
  }
  if (!claimed) {
    const { data: recoveryStatus } = await admin
      .from("gateway_operation_recovery")
      .select("expires_at, claimed_at")
      .eq("transaction_id", operation.id)
      .eq("user_id", user.id)
      .maybeSingle();
    const expired = recoveryStatus?.expires_at && recoveryStatus.expires_at <= now;
    return NextResponse.json({
      error: expired ? "GATEWAY_MINT_RECOVERY_EXPIRED" : "GATEWAY_MINT_RETRY_IN_PROGRESS",
      message: expired
        ? "Stored Manual mint recovery data has expired and requires operator reconciliation."
        : "Another Manual mint retry is already in progress or recovery data is unavailable.",
      operationId,
      safeToRetry: false,
    }, { status: expired ? 410 : 409 });
  }

  const recovery = recordFrom(claimed.recovery_payload);
  const destinationChain = recovery?.destinationChain;
  const recipient = recovery?.recipient;
  const amount = recovery?.amount;
  const attestation = recovery?.attestation;
  const signature = recovery?.signature;
  if (
    !isCircleKitGatewayChain(destinationChain) ||
    typeof recipient !== "string" || !/^0x[0-9a-f]{40}$/i.test(recipient) ||
    typeof amount !== "string" ||
    typeof attestation !== "string" ||
    typeof signature !== "string"
  ) {
    await admin.from("gateway_operation_recovery")
      .update({ claimed_at: null, updated_at: new Date().toISOString() })
      .eq("transaction_id", operation.id)
      .eq("user_id", user.id);
    return NextResponse.json({
      error: "GATEWAY_MINT_RECOVERY_INVALID",
      message: "Stored Manual mint recovery data is incomplete.",
      operationId,
      safeToRetry: false,
    }, { status: 500 });
  }

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("address")
    .eq("user_id", user.id)
    .eq("type", "sca")
    .limit(1)
    .maybeSingle();
  if (walletError) {
    await admin.from("gateway_operation_recovery")
      .update({ claimed_at: null, updated_at: new Date().toISOString() })
      .eq("transaction_id", operation.id)
      .eq("user_id", user.id);
    throw walletError;
  }
  if (!wallet?.address) {
    await admin.from("gateway_operation_recovery")
      .update({ claimed_at: null, updated_at: new Date().toISOString() })
      .eq("transaction_id", operation.id);
    return NextResponse.json({
      error: "GATEWAY_SCA_REQUIRED",
      message: "Circle SCA wallet is required to retry Manual mint.",
    }, { status: 404 });
  }

  let mintCompleted = false;
  let completedMintTxHash: string | null = null;
  try {
    const result = await retryCircleKitUnifiedMint({
      scaAddress: wallet.address as Address,
      recipient: recipient as Address,
      destinationChain,
      amount,
      attestation,
      signature,
    });
    mintCompleted = true;
    completedMintTxHash = result.txHash;
    const { data: transaction, error: updateError } = await admin
      .from("transaction_history")
      .update({
        status: "success",
        reason: null,
        tx_hash: result.txHash,
        gateway_state: "success",
        gateway_expiration_block: result.expirationBlock ?? operation.gateway_expiration_block,
      })
      .eq("id", operation.id)
      .eq("user_id", user.id)
      .eq("gateway_state", "pending_mint")
      .select("*")
      .single();
    if (updateError) throw updateError;

    await admin.from("gateway_operation_recovery")
      .delete()
      .eq("transaction_id", operation.id)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      engine: "circle_kit",
      authorizationMode: "sca_erc1271",
      retryMint: true,
      operationId,
      transactionId: operation.id,
      destinationTxHash: result.txHash,
      mintTxHash: result.txHash,
      destinationChain,
      recipient,
      amount,
      transaction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual mint retry failed.";
    if (mintCompleted) {
      await admin.from("transaction_history")
        .update({
          status: "pending",
          reason: "Destination mint completed; database reconciliation is required.",
          tx_hash: completedMintTxHash,
          gateway_state: "reconciliation_required",
        })
        .eq("id", operation.id)
        .eq("user_id", user.id);
      return NextResponse.json({
        error: "GATEWAY_MINT_RECONCILIATION_REQUIRED",
        message: "Destination mint completed, but its receipt could not be finalized. Do not retry the mint.",
        operationId,
        destinationTxHash: completedMintTxHash,
        gatewayState: "reconciliation_required",
        retryMintAvailable: false,
        safeToRetry: false,
      }, { status: 502 });
    }
    await admin.from("gateway_operation_recovery")
      .update({ claimed_at: null, updated_at: new Date().toISOString() })
      .eq("transaction_id", operation.id)
      .eq("user_id", user.id);
    await supabase
      .from("transaction_history")
      .update({ status: "pending", reason: message, gateway_state: "pending_mint" })
      .eq("id", operation.id)
      .eq("user_id", user.id);
    if (error instanceof GatewayCircleKitError) {
      return NextResponse.json({
        error: error.code,
        message: error.message,
        operationId,
        safeToRetry: false,
      }, { status: error.status });
    }
    return NextResponse.json({
      error: "GATEWAY_MINT_RETRY_FAILED",
      message,
      operationId,
      gatewayState: "pending_mint",
      retryMintAvailable: true,
      safeToRetry: false,
    }, { status: 502 });
  }
}
