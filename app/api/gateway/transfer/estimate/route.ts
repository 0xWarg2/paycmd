import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";

import {
  buildGatewayBurnIntentPreview,
  estimateGatewayTransferFee,
  isSupportedGatewayChain,
} from "@/lib/circle/gateway-sdk";
import {
  GatewayManualMintUnsupportedError,
  gatewayFeeBreakdownToDecimal,
  gatewayManualMintSupported,
  gatewaySupportedMintGasModes,
  gatewayTransferExecutionPlan,
  gatewayTransferPreflight,
  usdcAmountToAtomic,
} from "@/lib/paycmd/gateway-transfer";
import { createClient } from "@/lib/supabase/server";

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
    const sourceChain = String(body.sourceChain ?? "");
    const destinationChain = String(body.destinationChain ?? "");
    const amountInAtomicUnits = usdcAmountToAtomic(body.amount);

    if (!isSupportedGatewayChain(sourceChain) || !isSupportedGatewayChain(destinationChain)) {
      return NextResponse.json(
        { error: "sourceChain and destinationChain must be supported Gateway chains." },
        { status: 400 },
      );
    }

    const executionPlan = gatewayTransferExecutionPlan({
      sourceChain,
      destinationChain,
      mintGasMode: body.mintGasMode,
    });
    const mintGasMode = executionPlan.mintGasMode;

    const { data: wallets, error: walletError } = await supabase
      .from("wallets")
      .select("type, address")
      .eq("user_id", user.id)
      .in("type", ["sca", "gateway_signer"]);

    if (walletError) throw walletError;
    const sourceDepositor = wallets?.find((wallet) => wallet.type === "sca")?.address as Address | undefined;
    const sourceSigner = wallets?.find((wallet) => wallet.type === "gateway_signer")?.address as Address | undefined;

    if (!sourceDepositor) {
      return NextResponse.json(
        { error: "Circle SCA wallet is required before estimating a transfer." },
        { status: 404 },
      );
    }

    const burnIntentPreview = buildGatewayBurnIntentPreview({
      amount: amountInAtomicUnits,
      sourceChain,
      destinationChain,
      recipient: sourceDepositor,
      sourceDepositor,
      // Estimation is read-only and fees do not depend on this address. Avoid creating a
      // Gateway signer merely to render a preview for a new wallet.
      sourceSigner: sourceSigner ?? sourceDepositor,
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

    return NextResponse.json({
      amount: Number(amountInAtomicUnits) / 1_000_000,
      sourceChain,
      destinationChain,
      estimatedGatewayFee: Number(feeAmounts.estimatedFeeAtomic) / 1_000_000,
      maximumGatewayFee: Number(feeAmounts.maxFeeAtomic) / 1_000_000,
      requiredGatewayBalance: Number(feeAmounts.requiredGatewayBalanceAtomic) / 1_000_000,
      feeEstimateKind: quote.feeEstimateKind,
      feeBreakdown: gatewayFeeBreakdownToDecimal(quote.feeBreakdown),
      forwarding: mintGasMode === "auto_forwarding",
      mintGasMode,
      supportedMintGasModes: gatewaySupportedMintGasModes(destinationChain),
      manualMintSupported: gatewayManualMintSupported(destinationChain),
    });
  } catch (error) {
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
