import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";

import {
  buildGatewayBurnIntentPreview,
  CHAIN_BY_DOMAIN,
  estimateGatewayTransferFee,
  fetchGatewayBalance,
  isSupportedGatewayChain,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import { GatewayUnifiedInsufficientBalanceError } from "@/lib/paycmd/gateway-allocation";
import {
  GatewayManualMintUnsupportedError,
  gatewayFeeBreakdownToDecimal,
  gatewayManualMintSupported,
  gatewaySupportedMintGasModes,
  gatewayTransferExecutionPlan,
  gatewayTransferPreflight,
  usdcAmountToAtomic,
} from "@/lib/paycmd/gateway-transfer";
import { quoteUnifiedGatewayTransfer } from "@/lib/paycmd/gateway-unified-server";
import { gatewayUnifiedEstimateResponse } from "@/lib/paycmd/gateway-unified-response";
import { createClient } from "@/lib/supabase/server";

function decimalUsdcToAtomic(value: unknown) {
  const normalized = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return 0n;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function atomicUsdc(value: bigint) {
  return Number(value) / 1_000_000;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceMode = body.sourceMode === "unified" ? "unified" : "scoped";
    const sourceChain = String(body.sourceChain ?? "");
    const destinationChain = String(body.destinationChain ?? "");
    const amountInAtomicUnits = usdcAmountToAtomic(body.amount);

    if (
      !isSupportedGatewayChain(destinationChain) ||
      (sourceMode === "scoped" && !isSupportedGatewayChain(sourceChain))
    ) {
      return NextResponse.json(
        { error: sourceMode === "unified"
          ? "destinationChain must be a supported Gateway chain."
          : "sourceChain and destinationChain must be supported Gateway chains." },
        { status: 400 },
      );
    }

    const executionPlan = gatewayTransferExecutionPlan({
      sourceChain: sourceMode === "unified" ? destinationChain : sourceChain,
      destinationChain,
      mintGasMode: body.mintGasMode,
    });
    const mintGasMode = executionPlan.mintGasMode;

    const { data: wallets, error: walletError } = await supabase
      .from("wallets")
      .select("type, address")
      .eq("user_id", user.id)
      .eq("type", "sca");

    if (walletError) throw walletError;
    const sourceDepositor = wallets?.find((wallet) => wallet.type === "sca")?.address as Address | undefined;

    if (!sourceDepositor) {
      return NextResponse.json(
        { error: "Circle SCA wallet is required before estimating a transfer." },
        { status: 404 },
      );
    }

    if (sourceMode === "unified") {
      const requestedSources = Array.isArray(body.selectedSourceChains)
        ? body.selectedSourceChains.filter((chain: unknown): chain is SupportedChain =>
            typeof chain === "string" && isSupportedGatewayChain(chain))
        : undefined;
      const recipient = typeof body.recipientAddress === "string" && /^0x[0-9a-f]{40}$/i.test(body.recipientAddress)
        ? body.recipientAddress as Address
        : sourceDepositor;
      const unified = await quoteUnifiedGatewayTransfer({
        amountAtomic: amountInAtomicUnits,
        destinationChain,
        recipient,
        sourceDepositor,
        mintGasMode,
        selectedSourceChains: requestedSources,
      });

      return NextResponse.json(gatewayUnifiedEstimateResponse(
        unified,
        amountInAtomicUnits,
        { selectedSourceChains: requestedSources },
      ));
    }

    const burnIntentPreview = buildGatewayBurnIntentPreview({
      amount: amountInAtomicUnits,
      sourceChain: sourceChain as SupportedChain,
      destinationChain,
      recipient: sourceDepositor,
      sourceDepositor,
      // Estimation is read-only and fees do not depend on this address. Avoid creating a
      // Gateway signer merely to render a preview for a new wallet.
      sourceSigner: sourceDepositor,
    });
    const preflight = await gatewayTransferPreflight(
      { amountAtomic: amountInAtomicUnits, sourceChain, destinationChain, mintGasMode },
      {
        estimate: ({ forwarding }) => estimateGatewayTransferFee(
          burnIntentPreview,
          { enableForwarder: forwarding },
        ),
      },
    );
    const quote = preflight.estimate;
    const feeAmounts = preflight.amounts;
    const gatewayBalances = await fetchGatewayBalance(sourceDepositor);
    const sourceBalanceAtomic = decimalUsdcToAtomic(
      gatewayBalances.balances.find((balance) => CHAIN_BY_DOMAIN[balance.domain] === sourceChain)?.balance,
    );
    const shortfallAtomic = sourceBalanceAtomic < feeAmounts.requiredGatewayBalanceAtomic
      ? feeAmounts.requiredGatewayBalanceAtomic - sourceBalanceAtomic
      : 0n;

    return NextResponse.json({
      sourceMode: "scoped",
      amount: Number(amountInAtomicUnits) / 1_000_000,
      sourceChain,
      destinationChain,
      estimatedGatewayFee: Number(feeAmounts.estimatedFeeAtomic) / 1_000_000,
      maximumGatewayFee: Number(feeAmounts.maxFeeAtomic) / 1_000_000,
      requiredGatewayBalance: Number(feeAmounts.requiredGatewayBalanceAtomic) / 1_000_000,
      readyGatewayBalance: atomicUsdc(sourceBalanceAtomic),
      sufficientGatewayBalance: shortfallAtomic === 0n,
      minimumDepositAmount: atomicUsdc(shortfallAtomic),
      fallbackOptions: shortfallAtomic > 0n ? ["deposit", "burn_intent_set"] : [],
      feeEstimateKind: quote.feeEstimateKind,
      feeBreakdown: gatewayFeeBreakdownToDecimal(quote.feeBreakdown),
      forwarding: mintGasMode === "auto_forwarding",
      mintGasMode,
      supportedMintGasModes: gatewaySupportedMintGasModes(destinationChain),
      manualMintSupported: gatewayManualMintSupported(destinationChain),
    });
  } catch (error) {
    if (error instanceof GatewayUnifiedInsufficientBalanceError) {
      return NextResponse.json({
        error: error.code,
        message: error.message,
        readyBalance: atomicUsdc(error.readyBalanceAtomic),
        maximumUsableCapacity: atomicUsdc(error.maximumUsableCapacityAtomic),
        shortfall: atomicUsdc(error.shortfallAtomic),
        exclusions: error.exclusions,
      }, { status: 400 });
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
    const message = error instanceof Error ? error.message : "Gateway fee estimate failed";
    const invalidInput = /mintGasMode|USDC amount/i.test(message);
    return NextResponse.json(
      {
        error: invalidInput ? "INVALID_GATEWAY_TRANSFER_ESTIMATE" : "GATEWAY_FEE_ESTIMATE_UNAVAILABLE",
        message,
      },
      { status: invalidInput ? 400 : 503 },
    );
  }
}
