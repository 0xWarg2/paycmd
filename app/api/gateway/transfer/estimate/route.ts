import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";

import {
  buildGatewayBurnIntentPreview,
  estimateGatewayTransferFee,
  isSupportedGatewayChain,
} from "@/lib/circle/gateway-sdk";
import {
  gatewayMintGasModeFrom,
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
    const mintGasMode = gatewayMintGasModeFrom(body.mintGasMode);
    const amountInAtomicUnits = usdcAmountToAtomic(body.amount);

    if (!isSupportedGatewayChain(sourceChain) || !isSupportedGatewayChain(destinationChain)) {
      return NextResponse.json(
        { error: "sourceChain and destinationChain must be supported Gateway chains." },
        { status: 400 },
      );
    }

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

    const quote = await estimateGatewayTransferFee(
      buildGatewayBurnIntentPreview({
        amount: amountInAtomicUnits,
        sourceChain,
        destinationChain,
        recipient: sourceDepositor,
        sourceDepositor,
        // Estimation is read-only and fees do not depend on this address. Avoid creating a
        // Gateway signer merely to render a preview for a new wallet.
        sourceSigner: sourceSigner ?? sourceDepositor,
      }),
      { enableForwarder: mintGasMode === "auto_forwarding" },
    );
    const requiredGatewayBalance = amountInAtomicUnits + quote.atomicFee;

    return NextResponse.json({
      amount: Number(amountInAtomicUnits) / 1_000_000,
      sourceChain,
      destinationChain,
      estimatedGatewayFee: Number(quote.atomicFee) / 1_000_000,
      requiredGatewayBalance: Number(requiredGatewayBalance) / 1_000_000,
      feeEstimateKind: quote.feeEstimateKind,
      forwarding: mintGasMode === "auto_forwarding",
      mintGasMode,
    });
  } catch (error) {
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
