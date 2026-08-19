/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from "next/server";
import {
  transferGatewayBalanceWithSCA,
  executeMintCircle,
  fetchGatewayBalance,
  getUsdcBalance,
  initiateDepositFromCustodialWallet,
  checkWalletGasBalance,
  buildGatewayBurnIntentPreview,
  estimateGatewayTransferFee,
  GatewayForwardingSettlementError,
  type SupportedChain,
  CIRCLE_CHAIN_NAMES,
  CHAIN_BY_DOMAIN,
  GATEWAY_CHAIN_CONFIGS,
  supportedGatewayChains,
} from "@/lib/circle/gateway-sdk";
import { createClient } from "@/lib/supabase/server";
import { type Address } from "viem";
import { Transaction } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/circle/sdk";
import { chainCommandAlias } from "@/lib/paycmd/chains";
import { requestLocale, tr, type PayCmdLocale } from "@/lib/i18n/server";
import { recordRaReceipt, updateRaProofColumns } from "@/lib/ra/receipt-registry";
import {
  GatewayManualMintUnsupportedError,
  gatewayActualTransferAmounts,
  gatewayDestinationTxHash,
  gatewayFeeBreakdownToDecimal,
  gatewayForwardingFailureMessage,
  gatewayForwardingTransferId,
  gatewayTransferExecutionPlan,
  gatewayManualMintSupported,
  gatewaySupportedMintGasModes,
  gatewayTransferPreflight,
  usdcAmountToAtomic,
} from "@/lib/paycmd/gateway-transfer";
import {
  GatewayCircleKitError,
  GatewayCircleKitSpendError,
  assertCircleKitMintGasMode,
  circleKitAtomicToUsdc,
  circleKitOperationFingerprint,
  circleKitQuoteMatches,
  circleKitUsdcToAtomic,
  estimateCircleKitUnifiedSpend,
  fromCircleKitChain,
  isCircleKitGatewayChain,
  spendCircleKitUnified,
} from "@/lib/circle/unified-balance-kit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArcAddressSafetyError, assertArcAddressTransferable } from "@/lib/paycmd/arc-security";

function decimalUsdcToAtomic(value: string | number) {
  const [wholeRaw, fractionRaw = ""] = String(value).split(".");
  const whole = wholeRaw.replace(/[^\d]/g, "") || "0";
  const fraction = fractionRaw.replace(/[^\d]/g, "").padEnd(6, "0").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fraction || "0");
}

function atomicUsdcToDecimal(value: bigint) {
  return Number(value) / 1_000_000;
}

function formatUsdc(value: bigint | number) {
  const numberValue = typeof value === "bigint" ? atomicUsdcToDecimal(value) : value;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(numberValue);
}

async function getSourceGatewayBalance(address: Address, sourceChain: SupportedChain) {
  const gatewayResponse = await fetchGatewayBalance(address);
  const sourceBalance = gatewayResponse.balances.find(
    (balance) => CHAIN_BY_DOMAIN[balance.domain] === sourceChain,
  );

  return decimalUsdcToAtomic(sourceBalance?.balance ?? "0");
}

function finalityHint(chain: SupportedChain, locale: PayCmdLocale) {
  if (chain === "baseSepolia") {
    return tr(locale, "gateway.finality.base");
  }

  return tr(locale, "gateway.finality.generic");
}

function isSignerNotAuthorizedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Signer is not authorized to spend funds from sourceDepositor");
}

function parseForwardingFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^Forwarded transfer failed:\s*(.+)$/i);
  return match?.[1]?.trim();
}

function isCircleGasSponsorshipError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /gas station|sponsor(?:ed|ship)?|insufficient (?:native )?gas|fee balance/i.test(message);
}

function validOperationId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function circleKitActualFee(fees: readonly { token: string; amount: string }[] | undefined) {
  const usdcFees = fees?.filter((fee) => fee.token.toUpperCase() === "USDC") ?? [];
  if (usdcFees.length === 0) return null;
  try {
    const atomic = usdcFees.reduce(
      (total, fee) => total + circleKitUsdcToAtomic(fee.amount, { allowZero: true }),
      0n,
    );
    return circleKitAtomicToUsdc(atomic);
  } catch {
    return null;
  }
}

async function handleCircleKitUnifiedTransfer(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  walletAddress: Address;
  requestBody: Record<string, unknown>;
  locale: PayCmdLocale;
}) {
  const { supabase, userId, walletAddress, requestBody } = input;
  const destinationChain = String(requestBody.destinationChain ?? "");
  const amount = String(requestBody.amount ?? "");
  const recipient = (typeof requestBody.recipientAddress === "string" && /^0x[0-9a-f]{40}$/i.test(requestBody.recipientAddress)
    ? requestBody.recipientAddress
    : walletAddress) as Address;
  const operationId = requestBody.operationId;
  const providedFingerprint = requestBody.quoteFingerprint;
  const skipReceipt = requestBody.skipReceipt === true;

  if (requestBody.engine === "legacy") {
    return NextResponse.json({
      error: "GATEWAY_QUOTE_ENGINE_MISMATCH",
      message: "This quote was created by the removed legacy Gateway engine. Refresh the quote before confirming.",
      fundsMoved: false,
      transferSubmitted: false,
    }, { status: 409 });
  }
  if (!validOperationId(operationId)) {
    return NextResponse.json({
      error: "GATEWAY_OPERATION_ID_REQUIRED",
      message: "A valid operationId UUID is required for idempotent Unified Balance execution.",
      fundsMoved: false,
      transferSubmitted: false,
    }, { status: 400 });
  }
  if (!isCircleKitGatewayChain(destinationChain)) {
    return NextResponse.json({
      error: "GATEWAY_DESTINATION_UNSUPPORTED_BY_CIRCLE_KIT",
      message: "This destination is not enabled for HeyPayna SCA-only Unified Balance.",
      destinationChain,
      fundsMoved: false,
      transferSubmitted: false,
    }, { status: 422 });
  }

  let normalizedAmount: string;
  let normalizedMintGasMode;
  let requestFingerprint: string;
  try {
    normalizedAmount = circleKitAtomicToUsdc(circleKitUsdcToAtomic(amount));
    normalizedMintGasMode = assertCircleKitMintGasMode(destinationChain, requestBody.mintGasMode);
    requestFingerprint = circleKitOperationFingerprint({
      userId,
      amount: normalizedAmount,
      recipient,
      destinationChain,
      mintGasMode: normalizedMintGasMode,
    });
  } catch (error) {
    if (error instanceof GatewayCircleKitError) {
      return NextResponse.json({
        error: error.code,
        message: error.message,
        ...error.details,
        fundsMoved: false,
        transferSubmitted: false,
      }, { status: error.status });
    }
    throw error;
  }

  const { data: existing, error: existingError } = await supabase
    .from("transaction_history")
    .select("*")
    .eq("user_id", userId)
    .eq("gateway_operation_id", operationId)
    .maybeSingle();
  if (existingError) {
    console.error("Circle Kit operation lookup failed before submission", {
      operationId,
      code: existingError.code,
    });
    return NextResponse.json({
      error: "GATEWAY_OPERATION_STORE_UNAVAILABLE",
      message: "Payna could not prepare the operation record. No transaction was submitted and no funds moved.",
      operationId,
      fundsMoved: false,
      transferSubmitted: false,
      safeToRetry: true,
    }, { status: 503 });
  }
  if (existing) {
    if (existing.gateway_request_fingerprint !== requestFingerprint) {
      return NextResponse.json({
        error: "GATEWAY_OPERATION_ID_CONFLICT",
        message: "This operationId is already bound to a different Unified Balance request.",
        operationId,
        transactionId: existing.id,
        fundsMoved: false,
        transferSubmitted: false,
        safeToRetry: false,
      }, { status: 409 });
    }
    if (existing.status === "success") {
      return NextResponse.json({
        success: true,
        duplicate: true,
        engine: "circle_kit",
        authorizationMode: "sca_erc1271",
        operationId,
        transactionId: existing.id,
        transferId: existing.gateway_transfer_id,
        destinationTxHash: existing.tx_hash,
        sourceAllocations: existing.source_allocations,
        destinationChain: existing.destination_chain,
        amount: String(existing.amount),
      });
    }
    const transferSubmitted = [
      "transfer_submitted",
      "pending_forwarding",
      "pending_mint",
      "forwarding_failed",
      "success",
    ].includes(existing.gateway_state);
    return NextResponse.json({
      error: "GATEWAY_OPERATION_ALREADY_EXISTS",
      message: "This Unified Balance operation was already submitted and will not be sent again.",
      engine: "circle_kit",
      operationId,
      transactionId: existing.id,
      transferId: existing.gateway_transfer_id,
      gatewayState: existing.gateway_state,
      transferSubmitted,
      fundsMoved: transferSubmitted,
      safeToRetry: false,
    }, { status: 409 });
  }

  let freshEstimate;
  try {
    freshEstimate = await estimateCircleKitUnifiedSpend({
      userId,
      scaAddress: walletAddress,
      recipient,
      destinationChain,
      amount: normalizedAmount,
      mintGasMode: normalizedMintGasMode,
    });
  } catch (error) {
    if (error instanceof GatewayCircleKitError) {
      return NextResponse.json({
        error: error.code,
        message: error.message,
        ...error.details,
        fundsMoved: false,
        transferSubmitted: false,
      }, { status: error.status });
    }
    throw error;
  }

  if (!circleKitQuoteMatches(providedFingerprint, freshEstimate)) {
    return NextResponse.json({
      error: "GATEWAY_QUOTE_CHANGED",
      message: tr(input.locale, "preview.gatewayQuoteRefreshed"),
      refreshedEstimate: freshEstimate,
      partialBurnSubmitted: false,
      fundsMoved: false,
      transferSubmitted: false,
    }, { status: 409 });
  }

  let recoveryStore: ReturnType<typeof createAdminClient>;
  try {
    recoveryStore = createAdminClient();
  } catch {
    return NextResponse.json({
      error: "GATEWAY_RECOVERY_STORE_UNAVAILABLE",
      message: "Server-only Gateway recovery storage is not configured. No transaction was submitted.",
      operationId,
      fundsMoved: false,
      transferSubmitted: false,
      safeToRetry: true,
    }, { status: 503 });
  }

  const { data: operation, error: insertError } = await supabase
    .from("transaction_history")
    .insert({
      user_id: userId,
      chain: "gateway",
      source_mode: "unified",
      source_allocations: null,
      tx_type: "transfer",
      amount: normalizedAmount,
      tx_hash: null,
      gateway_wallet_address: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
      destination_chain: destinationChain,
      status: "pending",
      reason: null,
      gateway_operation_id: operationId,
      gateway_engine: "circle_kit",
      gateway_state: "pre_submit",
      quote_fingerprint: providedFingerprint,
      gateway_request_fingerprint: requestFingerprint,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({
        error: "GATEWAY_OPERATION_ALREADY_EXISTS",
        message: "This Unified Balance operation is already being processed.",
        operationId,
        transferSubmitted: false,
        fundsMoved: false,
        safeToRetry: false,
      }, { status: 409 });
    }
    console.error("Circle Kit operation insert failed before submission", {
      operationId,
      code: insertError.code,
    });
    return NextResponse.json({
      error: "GATEWAY_OPERATION_STORE_UNAVAILABLE",
      message: "Payna could not save the operation before submission. No transaction was submitted and no funds moved.",
      operationId,
      fundsMoved: false,
      transferSubmitted: false,
      safeToRetry: true,
    }, { status: 503 });
  }

  try {
    const result = await spendCircleKitUnified({
      scaAddress: walletAddress,
      recipient,
      destinationChain,
      amount: normalizedAmount,
      mintGasMode: freshEstimate.mintGasMode,
      onTransferSubmitted: async (transferId) => {
        const { error } = await supabase
          .from("transaction_history")
          .update({
            gateway_transfer_id: transferId,
            gateway_state: freshEstimate.forwarding ? "pending_forwarding" : "transfer_submitted",
          })
          .eq("id", operation.id)
          .eq("user_id", userId);
        if (error) {
          console.warn("Failed to persist Circle Gateway transfer ID", {
            operationId,
            code: error.code,
          });
        }
      },
    });
    const sourceAllocations = result.allocations?.map((allocation) => ({
      sourceChain: fromCircleKitChain(allocation.chain) ?? allocation.chain,
      circleChain: allocation.chain,
      amount: allocation.amount,
      sourceAccount: allocation.sourceAccount,
    })) ?? [];
    const actualFee = circleKitActualFee(result.fees);
    const { data: transaction, error: updateError } = await supabase
      .from("transaction_history")
      .update({
        status: "success",
        reason: null,
        tx_hash: result.txHash,
        source_allocations: sourceAllocations,
        gateway_transfer_id: result.transferId ?? null,
        gateway_expiration_block: result.expirationBlock ?? null,
        gateway_state: "success",
        gateway_fees: result.fees ?? null,
        gateway_actual_fee: actualFee,
      })
      .eq("id", operation.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    await recoveryStore
      .from("gateway_operation_recovery")
      .delete()
      .eq("transaction_id", operation.id);

    let proof: Awaited<ReturnType<typeof recordRaReceipt>> | undefined;
    if (!skipReceipt) {
      try {
        proof = await recordRaReceipt({
          action: "transfer",
          userAddress: walletAddress,
          recipientAddress: recipient,
          amount: normalizedAmount,
          sourceChain: "gateway",
          destinationChain,
          destinationTxHash: result.txHash,
          metadata: {
            transactionHistoryId: transaction.id,
            operationId,
            transferId: result.transferId ?? null,
            forwarding: freshEstimate.forwarding,
            mintGasMode: freshEstimate.mintGasMode,
            authorizationMode: "sca_erc1271",
            sourceMode: "unified",
            engine: "circle_kit",
            sourceAllocations,
          },
        });
        await updateRaProofColumns({ supabase, transactionId: transaction.id, result: proof });
      } catch (proofError) {
        console.warn("Failed to record Payna Circle Kit transfer proof.", {
          operationId,
          message: proofError instanceof Error ? proofError.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      success: true,
      engine: "circle_kit",
      authorizationMode: "sca_erc1271",
      operationId,
      transactionId: transaction.id,
      transferId: result.transferId,
      expirationBlock: result.expirationBlock,
      destinationTxHash: result.txHash,
      mintTxHash: freshEstimate.forwarding ? undefined : result.txHash,
      sourceAllocations,
      fees: result.fees,
      forwarding: freshEstimate.forwarding,
      mintGasMode: freshEstimate.mintGasMode,
      actualFeeStatus: actualFee === null ? "pending" : "actual",
      actualGatewayFee: actualFee,
      actualSourceDebit: actualFee === null
        ? null
        : circleKitAtomicToUsdc(
            circleKitUsdcToAtomic(normalizedAmount) +
            circleKitUsdcToAtomic(actualFee, { allowZero: true }),
          ),
      estimatedGatewayFee: freshEstimate.totalEstimatedFee,
      estimatedSourceDebit: freshEstimate.estimatedSourceDebit,
      supportedMintGasModes: freshEstimate.supportedMintGasModes,
      manualMintSupported: true,
      sourceMode: "unified",
      destinationChain,
      amount: normalizedAmount,
      recipient,
      sourceWalletAddress: walletAddress,
      proofTxHash: proof?.enabled ? proof.txHash : null,
      proofStatus: proof?.status ?? (skipReceipt ? "skipped" : undefined),
      transaction,
    });
  } catch (error) {
    const spendError = error instanceof GatewayCircleKitSpendError
      ? error
      : new GatewayCircleKitSpendError({ error });
    const original = spendError.originalError;
    const resumableMint = Boolean(spendError.recovery);
    const pendingForwarding = Boolean(
      spendError.transferId && spendError.recoverability === "RETRYABLE",
    );
    const gatewayState = resumableMint
      ? "pending_mint"
      : spendError.transferId
        ? pendingForwarding ? "pending_forwarding" : "forwarding_failed"
        : "failed_before_submit";
    const status = resumableMint || pendingForwarding ? "pending" : "failed";
    const gasSponsorshipUnavailable = !spendError.transferSubmitted &&
      destinationChain === "arcTestnet" &&
      freshEstimate.mintGasMode === "manual" &&
      isCircleGasSponsorshipError(original);
    const failedSourceAllocations = spendError.allocations?.map((allocation) => ({
      sourceChain: fromCircleKitChain(allocation.chain) ?? allocation.chain,
      circleChain: allocation.chain,
      amount: allocation.amount,
    })) ?? null;
    let recoveryStored = true;
    if (spendError.recovery) {
      const { error: recoveryError } = await recoveryStore
        .from("gateway_operation_recovery")
        .upsert({
          transaction_id: operation.id,
          user_id: userId,
          gateway_operation_id: operationId,
          recovery_payload: {
            ...spendError.recovery,
            recipient,
            destinationChain,
            amount: normalizedAmount,
          },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          claimed_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "transaction_id" });
      recoveryStored = !recoveryError;
      if (recoveryError) {
        console.error("Failed to persist private Circle Gateway recovery data", {
          operationId,
          code: recoveryError.code,
        });
      }
    }
    await supabase
      .from("transaction_history")
      .update({
        status,
        reason: recoveryStored
          ? spendError.message
          : `${spendError.message} Recovery storage failed; operator reconciliation required.`,
        gateway_transfer_id: spendError.transferId ?? null,
        gateway_state: gatewayState,
        source_allocations: failedSourceAllocations,
      })
      .eq("id", operation.id)
      .eq("user_id", userId);

    if (!spendError.transferSubmitted && original instanceof GatewayCircleKitError) {
      return NextResponse.json({
        error: original.code,
        message: original.message,
        ...original.details,
        operationId,
        transactionId: operation.id,
        fundsMoved: false,
        transferSubmitted: false,
        safeToRetry: true,
      }, { status: original.status });
    }

    return NextResponse.json({
      error: resumableMint
        ? recoveryStored ? "GATEWAY_MINT_RESUMABLE" : "GATEWAY_RECOVERY_STORE_UNAVAILABLE"
        : pendingForwarding
          ? "GATEWAY_FORWARDING_PENDING"
          : spendError.transferId
            ? "GATEWAY_FORWARDING_FAILED"
            : gasSponsorshipUnavailable
              ? "CIRCLE_GAS_STATION_UNAVAILABLE"
              : "GATEWAY_CIRCLE_KIT_SPEND_FAILED",
      message: resumableMint
        ? "Gateway transfer was committed, but Manual mint did not complete. Retry mint only; do not submit another spend."
        : spendError.transferId
          ? gatewayForwardingFailureMessage(spendError.transferId)
          : gasSponsorshipUnavailable
            ? "Circle Gas Station did not sponsor the Arc SCA transaction. Verify the Gas Station policy or fund the named SCA with native USDC gas."
            : spendError.message,
      operationId,
      transactionId: operation.id,
      transferId: spendError.transferId,
      gatewayState,
      retryMintAvailable: resumableMint && recoveryStored,
      safeToRetry: !spendError.transferSubmitted,
      transferSubmitted: spendError.transferSubmitted,
      fundsMoved: spendError.transferSubmitted,
      recoverability: spendError.recoverability,
      kitErrorName: spendError.kitErrorName,
    }, { status: spendError.transferSubmitted ? 502 : 503 });
  }
}

async function waitForGatewayBalanceAtLeast(
  address: Address,
  sourceChain: SupportedChain,
  requiredBalance: bigint,
  timeoutMs = 20_000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const currentBalance = await getSourceGatewayBalance(address, sourceChain);
    if (currentBalance >= requiredBalance) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  return false;
}

async function getPendingGatewayFinalityDeposits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sourceChain: SupportedChain,
) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("transaction_history")
    .select("id, amount, tx_hash, status, created_at")
    .eq("user_id", userId)
    .eq("tx_type", "deposit")
    .eq("chain", sourceChain)
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not fetch pending Gateway finality deposits.", error);
    return [];
  }

  const legacyFinalityWindowMs = 30 * 60 * 1000;

  return (data ?? []).filter((deposit) => {
    if (deposit.status === "pending_gateway_finality") return true;
    if (deposit.status !== "success") return false;

    const createdAt = new Date(deposit.created_at ?? 0).getTime();
    return Number.isFinite(createdAt) && Date.now() - createdAt <= legacyFinalityWindowMs;
  });
}

async function markPendingGatewayFinalityDeposit(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  sourceChain: SupportedChain;
  amount: number;
  txHash?: string;
  reason?: string;
}) {
  await params.supabase.from("transaction_history").insert([
    {
      user_id: params.userId,
      chain: params.sourceChain,
      tx_type: "deposit",
      amount: params.amount,
      tx_hash: params.txHash,
      gateway_wallet_address: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
      status: "pending_gateway_finality",
      reason: params.reason ?? "Waiting for Circle Gateway finality/indexing.",
      created_at: new Date().toISOString(),
    },
  ]);
}

function gatewayFinalityPendingResponse(params: {
  amount: string | number;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  recipient?: Address;
  txHash?: string;
  autoDepositedAmount?: number;
  pendingAmount?: number;
  currentGatewayBalance?: bigint;
  requiredGatewayBalance?: bigint;
  stage: "auto_deposit" | "burn_intent";
  locale: PayCmdLocale;
}) {
  const retryCommand = `/transfer ${params.amount} from ${chainCommandAlias(params.sourceChain)} to ${chainCommandAlias(params.destinationChain)}`;
  const actionText =
    params.stage === "auto_deposit"
      ? params.pendingAmount
        ? tr(params.locale, "gateway.finality.autoDeposit", {
            amount: formatUsdc(params.pendingAmount),
            chain: params.sourceChain,
          })
        : tr(params.locale, "gateway.finality.autoDepositSubmitted", {
            amount: params.autoDepositedAmount ?? params.amount,
            chain: params.sourceChain,
          })
      : tr(params.locale, "gateway.finality.burnIntent", { chain: params.sourceChain });
  const balanceText =
    params.currentGatewayBalance !== undefined && params.requiredGatewayBalance !== undefined
      ? ` ${tr(params.locale, "gateway.finality.balance", {
          current: formatUsdc(params.currentGatewayBalance),
          required: formatUsdc(params.requiredGatewayBalance),
        })}`
      : "";

  return NextResponse.json(
    {
      error: "GATEWAY_FINALITY_PENDING",
      message: `${actionText}${balanceText} ${finalityHint(params.sourceChain, params.locale)} ${tr(params.locale, "gateway.finality.noAutoDeposit")} ${tr(params.locale, "gateway.finality.retry", { command: retryCommand })}`,
      status: "pending_gateway_finality",
      sourceChain: params.sourceChain,
      destinationChain: params.destinationChain,
      recipient: params.recipient,
      txHash: params.txHash,
      autoDeposit: params.stage === "auto_deposit",
      autoDepositedAmount: params.autoDepositedAmount,
      pendingAmount: params.pendingAmount,
      currentGatewayBalance:
        params.currentGatewayBalance !== undefined ? atomicUsdcToDecimal(params.currentGatewayBalance) : undefined,
      requiredGatewayBalance:
        params.requiredGatewayBalance !== undefined ? atomicUsdcToDecimal(params.requiredGatewayBalance) : undefined,
      retryCommand,
    },
    { status: 409 },
  );
}

export async function POST(req: NextRequest) {
  const authorizationMode = "sca_erc1271" as const;
  const locale = requestLocale(req);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestBody = await req.json();
  const {
    sourceMode = "scoped",
    sourceChain,
    destinationChain,
    amount,
    recipientAddress,
    autoDeposit = false,
    mintGasMode = "auto_forwarding",
    skipReceipt = false,
  } = requestBody;
  try {
    const unifiedSource = sourceMode === "unified";
    if ((!unifiedSource && !sourceChain) || !destinationChain || !amount) {
      return NextResponse.json(
        {
          error:
            unifiedSource
              ? "Missing required fields: destinationChain, amount"
              : "Missing required fields: sourceChain, destinationChain, amount",
        },
        { status: 400 }
      );
    }

    // Validate chains
    const validChains = supportedGatewayChains;
    if (
      (!unifiedSource && !validChains.includes(sourceChain)) ||
      !validChains.includes(destinationChain)
    ) {
      return NextResponse.json(
        { error: `Invalid chain. Must be one of: ${validChains.join(", ")}` },
        { status: 400 }
      );
    }

    // Same-chain transfers are allowed (withdrawal from Gateway to wallet)
    // Cross-chain transfers will go through Gateway's burn/mint process

    const amountInAtomicUnits = usdcAmountToAtomic(amount);
    const sourceChainKey = sourceChain as SupportedChain;
    const destinationChainKey = destinationChain as SupportedChain;
    const executionPlan = gatewayTransferExecutionPlan({
      sourceChain: sourceChainKey,
      destinationChain: destinationChainKey,
      mintGasMode,
    });
    const effectiveMintGasMode = executionPlan.mintGasMode;
    const useForwarding = executionPlan.forwarding;

    // Get the user's multichain SCA wallet
    const { data: wallets, error: walletError } = await supabase
      .from("wallets")
      .select("circle_wallet_id, address, type")
      .eq("user_id", user.id)
      .eq("type", "sca");

    if (walletError) {
      console.error("Database error fetching wallets:", walletError);
      return NextResponse.json(
        { error: "Database error when fetching wallets." },
        { status: 500 }
      );
    }

    const scaWallet = wallets?.find((candidate) => candidate.type === "sca");
    if (!scaWallet?.circle_wallet_id) {
      console.log(`No SCA wallet found for user ${user.id}`);
      return NextResponse.json(
        { error: "No Circle wallet found. Please ensure wallet is created during signup." },
        { status: 404 }
      );
    }

    const wallet = scaWallet;
    const walletId = wallet.circle_wallet_id;
    const walletAddress = wallet.address as Address;
    const recipient = recipientAddress || walletAddress;
    let autoDepositTxHash: string | undefined;
    let autoDepositedAmount = 0;
    if (!unifiedSource && destinationChainKey === "arcTestnet") {
      await assertArcAddressTransferable(recipient as Address);
    }
    if (unifiedSource) {
      return handleCircleKitUnifiedTransfer({
        supabase,
        userId: user.id,
        walletAddress,
        requestBody,
        locale,
      });
    }

    let estimatedGatewayFee: bigint;
    let maximumGatewayFee: bigint;
    let requiredGatewayBalance: bigint;
    let feeEstimateKind: "quoted_total" | "max_fee_reserve";
    let feeBreakdown: ReturnType<typeof gatewayFeeBreakdownToDecimal>;

    try {
      const burnIntentPreview = buildGatewayBurnIntentPreview({
        amount: amountInAtomicUnits,
        sourceChain: sourceChainKey,
        destinationChain: destinationChainKey,
        recipient: recipient as Address,
        sourceDepositor: walletAddress,
        sourceSigner: walletAddress,
      });
      const preflight = await gatewayTransferPreflight(
        {
          amountAtomic: amountInAtomicUnits,
          sourceChain: sourceChainKey,
          destinationChain: destinationChainKey,
          mintGasMode: effectiveMintGasMode,
        },
        {
          estimate: ({ forwarding }) => estimateGatewayTransferFee(
            burnIntentPreview,
            { enableForwarder: forwarding },
          ),
        },
      );
      const gatewayFeeEstimate = preflight.estimate;
      const feeAmounts = preflight.amounts;
      estimatedGatewayFee = feeAmounts.estimatedFeeAtomic;
      maximumGatewayFee = feeAmounts.maxFeeAtomic;
      requiredGatewayBalance = feeAmounts.requiredGatewayBalanceAtomic;
      feeEstimateKind = gatewayFeeEstimate.feeEstimateKind;
      feeBreakdown = gatewayFeeBreakdownToDecimal(gatewayFeeEstimate.feeBreakdown);
    } catch (feeEstimateError) {
      const message = feeEstimateError instanceof Error ? feeEstimateError.message : "Gateway fee estimate failed";
      return NextResponse.json(
        {
          error: "GATEWAY_FEE_ESTIMATE_UNAVAILABLE",
          message,
          sourceChain,
          destinationChain,
          mintGasMode: effectiveMintGasMode,
        },
        { status: 503 },
      );
    }

    if (executionPlan.destinationGasPreflight) {
      // PRE-FLIGHT CHECK: Verify gas balance on destination chain BEFORE burning
      try {
        const gasCheck = await checkWalletGasBalance(walletId, destinationChainKey);

        if (!gasCheck.hasGas) {
          return NextResponse.json(
            {
              error: "INSUFFICIENT_GAS",
              walletId,
              walletAddress: gasCheck.address,
              walletRole: "sca",
              blockchain: CIRCLE_CHAIN_NAMES[destinationChainKey] ?? GATEWAY_CHAIN_CONFIGS[destinationChainKey].label,
              chain: destinationChain,
              stage: "mint",
              message: `Insufficient gas: Circle SCA wallet ${gasCheck.address} needs native tokens on ${destinationChain} to execute the mint transaction.`,
            },
            { status: 400 }
          );
        }

        console.log(`Gas check passed for ${gasCheck.address} on ${destinationChain} (balance: ${gasCheck.balance})`);
      } catch (gasCheckError: any) {
        console.error("Gas pre-flight check failed:", gasCheckError);
        return NextResponse.json(
          {
            error: "DESTINATION_GAS_CHECK_UNAVAILABLE",
            message: gasCheckError?.message || `Could not verify destination gas on ${destinationChain}.`,
            chain: destinationChain,
            stage: "mint",
          },
          { status: 503 },
        );
      }
    }

    if (!autoDeposit) {
      const gatewayBalance = await getSourceGatewayBalance(walletAddress, sourceChainKey);
      if (gatewayBalance < requiredGatewayBalance) {
        const shortfall = requiredGatewayBalance - gatewayBalance;
        return NextResponse.json({
          error: "GATEWAY_INSUFFICIENT_SCOPED_BALANCE",
          message: "The selected source does not have enough ready Gateway balance. Choose an explicit top-up or review unified Gateway sources.",
          sourceChain,
          gatewayBalance: atomicUsdcToDecimal(gatewayBalance),
          requiredGatewayBalance: atomicUsdcToDecimal(requiredGatewayBalance),
          minimumDepositAmount: atomicUsdcToDecimal(shortfall),
          fallbackOptions: ["deposit", "burn_intent_set"],
          autoDeposit: false,
        }, { status: 400 });
      }
    }

    if (autoDeposit) {
      const gatewayBalance = await getSourceGatewayBalance(walletAddress, sourceChainKey);
      if (gatewayBalance < requiredGatewayBalance) {
        const pendingDeposits = await getPendingGatewayFinalityDeposits(
          supabase,
          user.id,
          sourceChainKey,
        );
        const pendingAmount = pendingDeposits.reduce(
          (sum, deposit) => sum + Number(deposit.amount ?? 0),
          0,
        );

        if (pendingAmount > 0) {
          return gatewayFinalityPendingResponse({
            amount,
            sourceChain: sourceChainKey,
            destinationChain: destinationChainKey,
            recipient: recipient as Address,
            txHash: pendingDeposits[0]?.tx_hash,
            pendingAmount,
            currentGatewayBalance: gatewayBalance,
            requiredGatewayBalance,
            stage: "auto_deposit",
            locale,
          });
        }

        const missingAmount = requiredGatewayBalance - gatewayBalance;
        const walletUsdcBalance = await getUsdcBalance(walletAddress, sourceChainKey);

        if (walletUsdcBalance < missingAmount) {
          return NextResponse.json(
            {
              error: "INSUFFICIENT_USDC",
              message: `Gateway balance is short by ${Number(missingAmount) / 1_000_000} USDC (including Gateway fee) and wallet balance on ${sourceChain} is not enough to auto-deposit.`,
              sourceChain,
              gatewayBalance: Number(gatewayBalance) / 1_000_000,
              requiredGatewayBalance: Number(requiredGatewayBalance) / 1_000_000,
              estimatedGatewayFee: Number(estimatedGatewayFee) / 1_000_000,
              maximumGatewayFee: Number(maximumGatewayFee) / 1_000_000,
              walletBalance: Number(walletUsdcBalance) / 1_000_000,
              requiredAmount: Number(requiredGatewayBalance) / 1_000_000,
            },
            { status: 400 },
          );
        }

        const sourceGasCheck = await checkWalletGasBalance(walletId, sourceChainKey);
        if (!sourceGasCheck.hasGas) {
          return NextResponse.json(
            {
              error: "INSUFFICIENT_GAS",
              walletId,
              walletAddress: sourceGasCheck.address,
              walletRole: "sca",
              blockchain: CIRCLE_CHAIN_NAMES[sourceChainKey] ?? GATEWAY_CHAIN_CONFIGS[sourceChainKey].label,
              chain: sourceChain,
              stage: "auto_deposit",
              message: `Auto-deposit requires native gas on ${sourceChain}. The Circle wallet has USDC, but it needs native gas to approve and deposit into Gateway.`,
            },
            { status: 400 },
          );
        }

        autoDepositTxHash = await initiateDepositFromCustodialWallet(
          walletId,
          sourceChainKey,
          missingAmount,
        );
        autoDepositedAmount = Number(missingAmount) / 1_000_000;

        await markPendingGatewayFinalityDeposit({
          supabase,
          userId: user.id,
          sourceChain: sourceChainKey,
          amount: autoDepositedAmount,
          txHash: autoDepositTxHash,
          reason: "Auto-deposit submitted; waiting for Circle Gateway finality/indexing.",
        });

        const gatewayBalanceReady =
          sourceChainKey !== "baseSepolia" &&
          (await waitForGatewayBalanceAtLeast(walletAddress, sourceChainKey, requiredGatewayBalance));

        if (!gatewayBalanceReady) {
          return gatewayFinalityPendingResponse({
            amount,
            sourceChain: sourceChainKey,
            destinationChain: destinationChainKey,
            recipient: recipient as Address,
            txHash: autoDepositTxHash,
            autoDepositedAmount,
            currentGatewayBalance: gatewayBalance,
            requiredGatewayBalance,
            stage: "auto_deposit",
            locale,
          });
        }
      }
    }

    const transferResult = await transferGatewayBalanceWithSCA(
      walletId,
      amountInAtomicUnits,
      sourceChainKey,
      destinationChainKey,
      recipient as Address,
      walletAddress,
      { enableForwarder: useForwarding, maxFee: maximumGatewayFee },
    );
    const {
      attestation,
      attestationSignature,
      transferId,
      fees,
      forwardingDetails,
      destinationTxHash: forwardedDestinationTxHash,
    } = transferResult;

    let mintTxHash: string | undefined;
    if (!useForwarding) {
      if (!attestation || !attestationSignature) {
        throw new Error(`Gateway attestation missing for manual mint. Transfer ID: ${transferId}`);
      }

      const mintTx: Transaction = await executeMintCircle(
        walletId,
        destinationChainKey,
        attestation,
        attestationSignature,
      );

      mintTxHash = mintTx.txHash;
    }

    const actualFees = forwardingDetails?.fees ?? fees;
    const destinationTxHash = gatewayDestinationTxHash({
      mintTxHash,
      forwardedDestinationTxHash,
      forwardingDetails,
    });
    if (useForwarding && !destinationTxHash) {
      throw new GatewayForwardingSettlementError(
        transferId,
        "Circle's settled response did not include a valid destination transaction hash.",
      );
    }
    const {
      actualFeeStatus,
      actualGatewayFee,
      actualSourceDebit,
    } = gatewayActualTransferAmounts(amountInAtomicUnits, actualFees);

    const { data: transaction, error: transactionError } = await supabase
      .from("transaction_history")
      .insert([
        {
          user_id: user.id,
          chain: sourceChain,
          source_mode: "scoped",
          source_allocations: null,
          tx_type: "transfer",
          amount: parseFloat(amount),
          tx_hash: destinationTxHash ?? null,
          gateway_wallet_address: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
          destination_chain: destinationChain,
          status: "success",
          created_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (transactionError) {
      console.error("Failed to record transfer transaction", transactionError);
    }

    let proof:
      | Awaited<ReturnType<typeof recordRaReceipt>>
      | undefined;

    if (!skipReceipt && transaction?.id) {
      try {
        proof = await recordRaReceipt({
          action: "transfer",
          userAddress: walletAddress,
          recipientAddress: recipient,
          amount,
          sourceChain,
          destinationChain,
          sourceTxHash: autoDepositTxHash,
          destinationTxHash,
          metadata: {
            transactionHistoryId: transaction.id,
            transferId,
            forwarding: useForwarding,
            forwardingDetails: forwardingDetails ?? null,
            mintGasMode: effectiveMintGasMode,
            authorizationMode,
            sourceMode: "scoped",
            sourceAllocations: null,
            autoDepositTxHash: autoDepositTxHash ?? null,
          },
        });
        await updateRaProofColumns({ supabase, transactionId: transaction.id, result: proof });
      } catch (proofError) {
        console.warn("Failed to record Payna transfer proof.", proofError);
        await updateRaProofColumns({
          supabase,
          transactionId: transaction.id,
          result: { enabled: false, status: "skipped", reason: "proof write failed" },
          error: proofError,
        });
      }
    }

    return NextResponse.json({
      success: true,
      authorizationMode,
      transactionId: transaction?.id,
      mintTxHash,
      destinationTxHash,
      transferId,
      fees: actualFees,
      actualFeeStatus,
      actualGatewayFee,
      actualSourceDebit,
      forwardingDetails,
      forwarding: useForwarding,
      mintGasMode: effectiveMintGasMode,
      estimatedGatewayFee: Number(estimatedGatewayFee) / 1_000_000,
      maximumGatewayFee: Number(maximumGatewayFee) / 1_000_000,
      requiredGatewayBalance: Number(requiredGatewayBalance) / 1_000_000,
      feeEstimateKind,
      feeBreakdown,
      supportedMintGasModes: gatewaySupportedMintGasModes(destinationChainKey),
      manualMintSupported: gatewayManualMintSupported(destinationChainKey),
      autoDeposit: Boolean(autoDepositTxHash),
      autoDepositTxHash,
      autoDepositedAmount,
      sourceChain,
      sourceMode: "scoped",
      sourceAllocations: null,
      destinationChain,
      amount: parseFloat(amount),
      recipient,
      sourceWalletAddress: walletAddress,
      proofTxHash: proof?.enabled ? proof.txHash : null,
      proofStatus: proof?.status ?? (skipReceipt ? "skipped" : undefined),
      proofContractAddress: proof?.enabled ? proof.contractAddress : process.env.RA_RECEIPT_REGISTRY_ADDRESS ?? null,
      transaction: transaction
        ? {
            ...transaction,
            proof_chain: proof?.enabled ? proof.chain : transaction.proof_chain,
            proof_contract_address: proof?.enabled
              ? proof.contractAddress
              : transaction.proof_contract_address ?? process.env.RA_RECEIPT_REGISTRY_ADDRESS ?? null,
            proof_tx_hash: proof?.enabled ? proof.txHash : transaction.proof_tx_hash,
            proof_status: proof?.status ?? transaction.proof_status,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Error in transfer:", error);

    if (error instanceof ArcAddressSafetyError) {
      return NextResponse.json(
        { error: error.code, message: error.message, fundsMoved: false, transferSubmitted: false },
        { status: error.status },
      );
    }

    if (error instanceof GatewayManualMintUnsupportedError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          destinationChain: error.destinationChain,
          supportedMintGasModes: error.supportedMintGasModes,
          manualMintSupported: false,
        },
        { status: 422 },
      );
    }

    if (/mintGasMode|USDC amount/i.test(error?.message ?? "")) {
      return NextResponse.json(
        { error: "INVALID_GATEWAY_TRANSFER", message: error.message },
        { status: 400 },
      );
    }

    const forwardingFailureReason = parseForwardingFailure(error);
    const forwardingTransferId = gatewayForwardingTransferId(error);
    if (forwardingTransferId || error instanceof GatewayForwardingSettlementError || forwardingFailureReason) {
      return NextResponse.json(
        {
          error: "GATEWAY_FORWARDING_FAILED",
          reason: forwardingFailureReason ?? error.message,
          transferId: forwardingTransferId,
          message: gatewayForwardingFailureMessage(forwardingTransferId),
          sourceChain,
          destinationChain,
          recipient: recipientAddress,
          safeToRetry: false,
        },
        { status: 502 },
      );
    }

    if (isSignerNotAuthorizedError(error)) {
      return NextResponse.json({
        error: "GATEWAY_SCA_AUTHORIZATION_REJECTED",
        message: "Gateway rejected the SCA ERC-1271 authorization. No EOA delegate or fallback was attempted.",
        authorizationMode,
        fundsMoved: false,
        transferSubmitted: false,
      }, { status: 422 });
    }

    // Check if this is an insufficient gas error
    if (error.message?.startsWith("INSUFFICIENT_GAS:")) {
      const [, walletId, blockchain] = error.message.split(":");
      
      // Get the wallet address
      try {
        const walletResponse = await circleDeveloperSdk.getWallet({ id: walletId });
        const eoaAddress = walletResponse.data?.wallet?.address;
        
        return NextResponse.json(
          {
            error: "INSUFFICIENT_GAS",
            walletId,
            walletAddress: eoaAddress,
            blockchain,
            chain: destinationChain,
          },
          { status: 400 }
        );
      } catch (walletError) {
        console.error("Error fetching wallet details:", walletError);
      }
    }

    // Log failed transaction to database
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("transaction_history").insert([
          {
            user_id: user.id,
            chain: sourceMode === "unified" ? "gateway" : sourceChain,
            source_mode: sourceMode === "unified" ? "unified" : "scoped",
            tx_type: "transfer",
            amount: parseFloat(amount || 0),
            destination_chain: destinationChain,
            status: "failed",
            reason: error.message || "Unknown error",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (dbError) {
      console.error("Error logging failed transaction:", dbError);
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
