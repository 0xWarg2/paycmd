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
  transferGatewayBalanceWithEOA,
  executeMintCircle,
  fetchGatewayBalance,
  getUsdcBalance,
  initiateDepositFromCustodialWallet,
  checkWalletGasBalance,
  buildGatewayBurnIntentPreview,
  estimateGatewayTransferFee,
  GatewayForwardingSettlementError,
  isGatewaySignerAuthorized,
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
  gatewayActualFeeAtomic,
  gatewayDestinationTxHash,
  gatewayForwardingFailureMessage,
  gatewayTransferExecutionPlan,
  usdcAmountToAtomic,
} from "@/lib/paycmd/gateway-transfer";

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
  stage: "auto_deposit" | "delegate" | "burn_intent";
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
      : params.stage === "delegate"
        ? tr(params.locale, "gateway.finality.delegate", { chain: params.sourceChain })
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
  const locale = requestLocale(req);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    sourceChain,
    destinationChain,
    amount,
    recipientAddress,
    autoDeposit = true,
    mintGasMode = "auto_forwarding",
    skipReceipt = false,
  } =
    await req.json();

  try {
    if (!sourceChain || !destinationChain || !amount) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: sourceChain, destinationChain, amount",
        },
        { status: 400 }
      );
    }

    // Validate chains
    const validChains = supportedGatewayChains;
    if (
      !validChains.includes(sourceChain) ||
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
      .select("circle_wallet_id, address")
      .eq("user_id", user.id)
      .eq("type", "sca")
      .limit(1);

    if (walletError) {
      console.error("Database error fetching wallets:", walletError);
      return NextResponse.json(
        { error: "Database error when fetching wallets." },
        { status: 500 }
      );
    }

    if (!wallets || wallets.length === 0 || !wallets[0]?.circle_wallet_id) {
      console.log(`No SCA wallet found for user ${user.id}`);
      return NextResponse.json(
        { error: "No Circle wallet found. Please ensure wallet is created during signup." },
        { status: 404 }
      );
    }

    const wallet = wallets[0];
    const walletId = wallet.circle_wallet_id;
    const walletAddress = wallet.address as Address;
    const recipient = recipientAddress || walletAddress;
    let autoDepositTxHash: string | undefined;
    let autoDepositedAmount = 0;
    let sourceSignerAddress: Address | undefined;
    let estimatedGatewayFee: bigint;
    let feeEstimateKind: "quoted_total" | "max_fee_reserve";

    // Determine if we're using external recipient
    const isExternalRecipient = recipientAddress && recipientAddress.toLowerCase() !== walletAddress.toLowerCase();

    try {
      const burnIntentPreview = buildGatewayBurnIntentPreview({
        amount: amountInAtomicUnits,
        sourceChain: sourceChainKey,
        destinationChain: destinationChainKey,
        recipient: recipient as Address,
        sourceDepositor: walletAddress,
        // Fee calculation does not depend on the signer address. Use the existing SCA as a
        // read-only placeholder so an unavailable estimate can never create a signer wallet.
        sourceSigner: walletAddress,
      });
      const gatewayFeeEstimate = await estimateGatewayTransferFee(
        burnIntentPreview,
        { enableForwarder: useForwarding },
      );
      estimatedGatewayFee = gatewayFeeEstimate.atomicFee;
      feeEstimateKind = gatewayFeeEstimate.feeEstimateKind;
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

    const requiredGatewayBalance = amountInAtomicUnits + estimatedGatewayFee;

    if (!sourceSignerAddress) {
      const { getOrCreateGatewayEOAWallet } = await import("@/lib/circle/create-gateway-eoa-wallets");
      const { address: eoaAddress } = await getOrCreateGatewayEOAWallet(user.id, sourceChain);
      sourceSignerAddress = eoaAddress as Address;
    }

    if (executionPlan.destinationGasPreflight) {
      // PRE-FLIGHT CHECK: Verify gas balance on destination chain BEFORE burning
      const { getGatewayEOAWalletId } = await import("@/lib/circle/create-gateway-eoa-wallets");

      try {
        let minterWalletId: string;

        if (isExternalRecipient) {
          // For external recipients, EOA wallet will execute mint
          const destinationBlockchain = GATEWAY_CHAIN_CONFIGS[destinationChainKey].eoaWalletBlockchain;
          if (!destinationBlockchain) {
            throw new Error(`${GATEWAY_CHAIN_CONFIGS[destinationChainKey].label} cannot use the Circle EOA signing wallet with the current SDK version.`);
          }
          const { walletId: eoaWalletId } = await getGatewayEOAWalletId(user.id, destinationBlockchain);
          minterWalletId = eoaWalletId;
        } else {
          // For own wallet, SCA wallet will execute mint
          minterWalletId = walletId;
        }

        // Check if the minter wallet has gas
        const gasCheck = await checkWalletGasBalance(minterWalletId, destinationChainKey);

        if (!gasCheck.hasGas) {
          const walletRole = isExternalRecipient ? "gateway_signer" : "sca";

          return NextResponse.json(
            {
              error: "INSUFFICIENT_GAS",
              walletId: minterWalletId,
              walletAddress: gasCheck.address,
              walletRole,
              blockchain: CIRCLE_CHAIN_NAMES[destinationChainKey] ?? GATEWAY_CHAIN_CONFIGS[destinationChainKey].label,
              chain: destinationChain,
              stage: "mint",
              message:
                walletRole === "gateway_signer"
                  ? `Insufficient gas: Gateway signer wallet ${gasCheck.address} needs native tokens on ${destinationChain} to execute the mint transaction.`
                  : `Insufficient gas: Circle SCA wallet ${gasCheck.address} needs native tokens on ${destinationChain} to execute the mint transaction.`,
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
          sourceSignerAddress,
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

    if (!sourceSignerAddress) {
      const { getOrCreateGatewayEOAWallet } = await import("@/lib/circle/create-gateway-eoa-wallets");
      const { address: eoaAddress } = await getOrCreateGatewayEOAWallet(user.id, sourceChain);
      sourceSignerAddress = eoaAddress as Address;
    }

    let isAuthorized: boolean | null = null;

    try {
      isAuthorized = await isGatewaySignerAuthorized(walletAddress, sourceSignerAddress, sourceChainKey);
    } catch (authorizationError) {
      console.warn("Gateway signer authorization check failed; continuing to burn attempt.", authorizationError);
    }

    if (isAuthorized === false) {
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
            stage: "delegate",
            message: `Transfer requires native gas on ${sourceChain} to authorize the Gateway signer before burning Gateway balance.`,
          },
          { status: 400 },
        );
      }

      const delegateTxHash = await initiateDepositFromCustodialWallet(
        walletId,
        sourceChainKey,
        0n,
        sourceSignerAddress,
      );

      return gatewayFinalityPendingResponse({
        amount,
        sourceChain: sourceChainKey,
        destinationChain: destinationChainKey,
        recipient: recipient as Address,
        txHash: delegateTxHash,
        stage: "delegate",
        locale,
      });
    }

    // Use EOA-signed burn/mint process for all transfers (same-chain and cross-chain)
    const {
      attestation,
      attestationSignature,
      transferId,
      fees,
      forwardingDetails,
      destinationTxHash: forwardedDestinationTxHash,
    } = await transferGatewayBalanceWithEOA(
      user.id,
      amountInAtomicUnits,
      sourceChainKey,
      destinationChainKey,
      recipient as Address,
      walletAddress,
      { enableForwarder: useForwarding, estimatedFee: estimatedGatewayFee }
    );

    let mintTxHash: string | undefined;
    if (!useForwarding) {
      if (!attestation || !attestationSignature) {
        throw new Error(`Gateway attestation missing for manual mint. Transfer ID: ${transferId}`);
      }

      // Execute mint on destination chain
      // If recipient is external (not the user's wallet), use EOA to execute mint
      // Otherwise use the user's Circle SCA wallet
      const mintTx: Transaction = await executeMintCircle(
        isExternalRecipient ? user.id : walletId,
        destinationChainKey,
        attestation,
        attestationSignature,
        isExternalRecipient // Pass true if using userId instead of walletId
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
    const actualGatewayFeeAtomic = gatewayActualFeeAtomic(actualFees);
    const actualGatewayFee = actualGatewayFeeAtomic !== undefined
      ? Number(actualGatewayFeeAtomic) / 1_000_000
      : undefined;
    const actualSourceDebit = actualGatewayFeeAtomic !== undefined
      ? Number(amountInAtomicUnits + actualGatewayFeeAtomic) / 1_000_000
      : undefined;

    const attestationHash = attestation;

    const { data: transaction, error: transactionError } = await supabase
      .from("transaction_history")
      .insert([
        {
          user_id: user.id,
          chain: sourceChain,
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
      transactionId: transaction?.id,
      attestation: attestationHash,
      mintTxHash,
      destinationTxHash,
      transferId,
      fees: actualFees,
      actualGatewayFee,
      actualSourceDebit,
      forwardingDetails,
      forwarding: useForwarding,
      mintGasMode: effectiveMintGasMode,
      estimatedGatewayFee: Number(estimatedGatewayFee) / 1_000_000,
      requiredGatewayBalance: Number(requiredGatewayBalance) / 1_000_000,
      feeEstimateKind,
      autoDeposit: Boolean(autoDepositTxHash),
      autoDepositTxHash,
      autoDepositedAmount,
      sourceChain,
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

    if (/mintGasMode|USDC amount/i.test(error?.message ?? "")) {
      return NextResponse.json(
        { error: "INVALID_GATEWAY_TRANSFER", message: error.message },
        { status: 400 },
      );
    }

    const forwardingFailureReason = parseForwardingFailure(error);
    if (error instanceof GatewayForwardingSettlementError || forwardingFailureReason) {
      const transferId = error instanceof GatewayForwardingSettlementError ? error.transferId : undefined;
      return NextResponse.json(
        {
          error: "GATEWAY_FORWARDING_FAILED",
          reason: forwardingFailureReason ?? error.message,
          transferId,
          message: gatewayForwardingFailureMessage(transferId),
          sourceChain,
          destinationChain,
          recipient: recipientAddress,
          retryMintGasMode: "manual",
        },
        { status: 502 },
      );
    }

    if (isSignerNotAuthorizedError(error)) {
      return gatewayFinalityPendingResponse({
        amount,
        sourceChain: sourceChain as SupportedChain,
        destinationChain: destinationChain as SupportedChain,
        recipient: recipientAddress as Address,
        stage: "burn_intent",
        locale,
      });
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
            chain: sourceChain,
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
