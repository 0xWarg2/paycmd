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
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from "next/server";
import {
  CHAIN_BY_DOMAIN,
  CIRCLE_CHAIN_NAMES,
  DOMAIN_IDS,
  GATEWAY_CHAIN_CONFIGS,
  GATEWAY_MINTER_ADDRESS,
  GATEWAY_WALLET_ADDRESS,
  USDC_ADDRESSES,
  checkWalletGasBalance,
  estimateGatewayTransferFeeAtomic,
  executeMintCircle,
  fetchGatewayBalance,
  getCircleWalletAddress,
  initiateDepositFromCustodialWallet,
  isGatewaySignerAuthorized,
  supportedGatewayChains,
  transferGatewayBalanceWithEOA,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import { circleDeveloperSdk } from "@/lib/circle/sdk";
import { requestLocale, tr, type PayCmdLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { maxUint256, zeroAddress, type Address } from "viem";

const validChains = supportedGatewayChains;
const amountSchema = /^\d+(\.\d{1,6})?$/;

function decimalUsdcToAtomic(value: string | number) {
  const [wholeRaw, fractionRaw = ""] = String(value).split(".");
  const whole = wholeRaw.replace(/[^\d]/g, "") || "0";
  const fraction = fractionRaw.replace(/[^\d]/g, "").padEnd(6, "0").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fraction || "0");
}

function formatAtomicUsdc(value: bigint) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function getSourceGatewayBalance(address: Address, sourceChain: SupportedChain) {
  const gatewayResponse = await fetchGatewayBalance(address);
  const sourceBalance = gatewayResponse.balances.find(
    (balance) => CHAIN_BY_DOMAIN[balance.domain] === sourceChain,
  );

  return decimalUsdcToAtomic(sourceBalance?.balance ?? "0");
}

function buildBurnIntentPreview(params: {
  amount: bigint;
  chain: SupportedChain;
  recipient: Address;
  sourceDepositor: Address;
  sourceSigner: Address;
}) {
  const maxFee = params.amount > 10_000_000n ? 2_010_000n : params.amount / 10n;

  return {
    maxBlockHeight: maxUint256,
    maxFee,
    spec: {
      version: 1,
      sourceDomain: DOMAIN_IDS[params.chain],
      destinationDomain: DOMAIN_IDS[params.chain],
      sourceContract: GATEWAY_WALLET_ADDRESS as Address,
      destinationContract: GATEWAY_MINTER_ADDRESS as Address,
      sourceToken: USDC_ADDRESSES[params.chain] as Address,
      destinationToken: USDC_ADDRESSES[params.chain] as Address,
      sourceDepositor: params.sourceDepositor,
      destinationRecipient: params.recipient,
      sourceSigner: params.sourceSigner,
      destinationCaller: zeroAddress,
      value: params.amount,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
      hookData: "0x" as `0x${string}`,
    },
  };
}

function chainCommandAlias(chain: SupportedChain) {
  return chain === "arcTestnet"
    ? "arc"
    : chain === "baseSepolia"
      ? "base"
      : "avalanche";
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

function gatewayWithdrawPendingResponse(params: {
  amount: string | number;
  chain: SupportedChain;
  txHash?: string;
  stage: "delegate" | "burn_intent";
  locale: PayCmdLocale;
}) {
  const retryCommand = `/withdraw ${params.amount} from ${chainCommandAlias(params.chain)}`;
  const actionText =
    params.stage === "delegate"
      ? tr(params.locale, "gateway.finality.delegate", { chain: params.chain })
      : tr(params.locale, "gateway.finality.burnIntent", { chain: params.chain });

  return NextResponse.json(
    {
      error: "GATEWAY_FINALITY_PENDING",
      message: `${actionText} ${finalityHint(params.chain, params.locale)} ${tr(params.locale, "gateway.finality.retry", { command: retryCommand })}`,
      status: "pending_gateway_finality",
      chain: params.chain,
      txHash: params.txHash,
      retryCommand,
    },
    { status: 409 },
  );
}

export async function POST(req: NextRequest) {
  const locale = requestLocale(req);
  let requestBody: { chain?: SupportedChain; amount?: string | number } = {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requestBody = (await req.json().catch(() => ({}))) as {
      chain?: SupportedChain;
      amount?: string | number;
    };
    const { chain, amount } = requestBody;

    if (!chain || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: chain, amount" },
        { status: 400 },
      );
    }

    if (!validChains.includes(chain)) {
      return NextResponse.json(
        { error: `Invalid chain. Must be one of: ${validChains.join(", ")}` },
        { status: 400 },
      );
    }

    if (!amountSchema.test(String(amount))) {
      return NextResponse.json(
        { error: "Amount must be a positive USDC amount with up to 6 decimals" },
        { status: 400 },
      );
    }

    const amountInAtomicUnits = decimalUsdcToAtomic(amount);

    if (amountInAtomicUnits <= 0n) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    if (amountInAtomicUnits > 1_000_000_000_000_000n) {
      return NextResponse.json(
        { error: "Amount exceeds maximum allowed value" },
        { status: 400 },
      );
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("circle_wallet_id, address, wallet_address")
      .eq("user_id", user.id)
      .eq("type", "sca")
      .limit(1)
      .maybeSingle();

    if (walletError) {
      return NextResponse.json({ error: walletError.message }, { status: 500 });
    }

    if (!wallet?.circle_wallet_id) {
      return NextResponse.json(
        { error: "No Circle wallet found. Run /wallet create first." },
        { status: 404 },
      );
    }

    const walletId = wallet.circle_wallet_id as string;
    const walletAddress =
      ((wallet.address || wallet.wallet_address) as Address | undefined) ??
      (await getCircleWalletAddress(walletId));

    const { getOrCreateGatewayEOAWallet } = await import("@/lib/circle/create-gateway-eoa-wallets");
    const { address: eoaAddress } = await getOrCreateGatewayEOAWallet(user.id, chain);
    const sourceSignerAddress = eoaAddress as Address;

    const estimatedGatewayFee = await estimateGatewayTransferFeeAtomic(
      buildBurnIntentPreview({
        amount: amountInAtomicUnits,
        chain,
        recipient: walletAddress,
        sourceDepositor: walletAddress,
        sourceSigner: sourceSignerAddress,
      }),
    );
    const requiredGatewayBalance = amountInAtomicUnits + estimatedGatewayFee;
    const gatewayBalance = await getSourceGatewayBalance(walletAddress, chain);

    if (gatewayBalance < requiredGatewayBalance) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_GATEWAY_BALANCE",
          message: tr(locale, "gateway.withdrawInsufficient", {
            chain,
            required: formatAtomicUsdc(requiredGatewayBalance),
            amount: formatAtomicUsdc(amountInAtomicUnits),
            fee: formatAtomicUsdc(estimatedGatewayFee),
            current: formatAtomicUsdc(gatewayBalance),
          }),
          chain,
          gatewayBalance: Number(gatewayBalance) / 1_000_000,
          requiredGatewayBalance: Number(requiredGatewayBalance) / 1_000_000,
          estimatedGatewayFee: Number(estimatedGatewayFee) / 1_000_000,
          amount: Number(amountInAtomicUnits) / 1_000_000,
        },
        { status: 400 },
      );
    }

    const gasCheck = await checkWalletGasBalance(walletId, chain);
    if (!gasCheck.hasGas) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_GAS",
          walletId,
          walletAddress: gasCheck.address,
          blockchain: CIRCLE_CHAIN_NAMES[chain] ?? GATEWAY_CHAIN_CONFIGS[chain].label,
          chain,
          stage: "withdraw_mint",
          message: tr(locale, "gateway.withdrawGasRequired", { chain }),
        },
        { status: 400 },
      );
    }

    let isAuthorized: boolean | null = null;
    try {
      isAuthorized = await isGatewaySignerAuthorized(walletAddress, sourceSignerAddress, chain);
    } catch (authorizationError) {
      console.warn("Gateway signer authorization check failed; continuing to withdraw attempt.", authorizationError);
    }

    if (isAuthorized === false) {
      const delegateTxHash = await initiateDepositFromCustodialWallet(
        walletId,
        chain,
        0n,
        sourceSignerAddress,
      );

      return gatewayWithdrawPendingResponse({
        amount,
        chain,
        txHash: delegateTxHash,
        stage: "delegate",
        locale,
      });
    }

    const { transferId, attestation, attestationSignature } = await transferGatewayBalanceWithEOA(
      user.id,
      amountInAtomicUnits,
      chain,
      chain,
      walletAddress,
      walletAddress,
    );

    if (!attestation || !attestationSignature) {
      throw new Error(`Gateway attestation missing for withdraw transfer ID: ${transferId}`);
    }

    const mintTx = await executeMintCircle(
      walletId,
      chain,
      attestation,
      attestationSignature,
    );

    await supabase.from("transaction_history").insert([
      {
        user_id: user.id,
        chain,
        destination_chain: chain,
        tx_type: "withdraw",
        amount: Number(amountInAtomicUnits) / 1_000_000,
        tx_hash: mintTx.txHash,
        gateway_wallet_address: GATEWAY_WALLET_ADDRESS,
        status: "success",
        created_at: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      success: true,
      transferId,
      mintTxHash: mintTx.txHash,
      amount: Number(amountInAtomicUnits) / 1_000_000,
      chain,
      recipient: walletAddress,
      estimatedGatewayFee: Number(estimatedGatewayFee) / 1_000_000,
    });
  } catch (error: any) {
    console.error("Error in withdraw:", error);

    if (isSignerNotAuthorizedError(error)) {
      return gatewayWithdrawPendingResponse({
        amount: requestBody.amount ?? "",
        chain: requestBody.chain as SupportedChain,
        stage: "burn_intent",
        locale,
      });
    }

    if (error.message?.startsWith("INSUFFICIENT_GAS:")) {
      const [, walletId, blockchain] = error.message.split(":");

      try {
        const walletResponse = await circleDeveloperSdk.getWallet({ id: walletId });
        const walletAddress = walletResponse.data?.wallet?.address;

        return NextResponse.json(
          {
            error: "INSUFFICIENT_GAS",
            walletId,
            walletAddress,
            blockchain,
            chain: requestBody.chain,
          },
          { status: 400 },
        );
      } catch (walletError) {
        console.error("Error fetching wallet details:", walletError);
      }
    }

    try {
      if (requestBody.chain) {
        await supabase.from("transaction_history").insert([
          {
            user_id: user.id,
            chain: requestBody.chain,
            destination_chain: requestBody.chain,
            tx_type: "withdraw",
            amount: Number(decimalUsdcToAtomic(requestBody.amount || 0)) / 1_000_000,
            status: "failed",
            reason: error.message || "Unknown error",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (dbError) {
      console.error("Error logging failed withdraw:", dbError);
    }

    const message = error.message || "Internal server error";
    const statusCode =
      message.includes("INSUFFICIENT") ||
      message.includes("insufficient") ||
      message.includes("Gateway API error: 400")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
