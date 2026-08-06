import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";

import {
  CIRCLE_CHAIN_NAMES,
  GATEWAY_CHAIN_CONFIGS,
  checkWalletGasBalance,
  initiateDepositFromCustodialWallet,
  isGatewaySignerAuthorized,
  isSupportedGatewayChain,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const requested: unknown[] = Array.isArray(body.sourceChains)
      ? body.sourceChains
      : [body.sourceChain];
    const sourceChains: SupportedChain[] = [...new Set<SupportedChain>(
      requested.filter((chain: unknown): chain is SupportedChain =>
        typeof chain === "string" && isSupportedGatewayChain(chain)),
    )];
    if (sourceChains.length === 0 || sourceChains.length > 16) {
      return NextResponse.json({
        error: "INVALID_GATEWAY_DELEGATE_SOURCES",
        message: "Choose between 1 and 16 supported Gateway source chains.",
      }, { status: 400 });
    }

    const unsupported = sourceChains.filter((chain) => !GATEWAY_CHAIN_CONFIGS[chain].circleBlockchain);
    if (unsupported.length > 0) {
      return NextResponse.json({
        error: "GATEWAY_DELEGATE_UNSUPPORTED",
        message: "The current Circle Wallet SDK cannot submit addDelegate on every selected source.",
        exclusions: unsupported.map((sourceChain) => ({
          sourceChain,
          reason: "delegate_not_supported_by_current_circle_sdk",
        })),
      }, { status: 422 });
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("circle_wallet_id, address")
      .eq("user_id", user.id)
      .eq("type", "sca")
      .limit(1)
      .single();
    if (walletError || !wallet?.circle_wallet_id || !wallet.address) {
      return NextResponse.json({ error: "Circle SCA wallet is required." }, { status: 404 });
    }

    const { getOrCreateGatewayEOAWallet } = await import("@/lib/circle/create-gateway-eoa-wallets");
    const signer = await getOrCreateGatewayEOAWallet(user.id, "MULTICHAIN");
    const depositorAddress = wallet.address as Address;
    const signerAddress = signer.address as Address;
    const results: Array<Record<string, unknown>> = [];

    for (const sourceChain of sourceChains) {
      if (await isGatewaySignerAuthorized(depositorAddress, signerAddress, sourceChain)) {
        results.push({ sourceChain, status: "already_authorized" });
        continue;
      }
      const gas = await checkWalletGasBalance(wallet.circle_wallet_id, sourceChain);
      if (!gas.hasGas) {
        return NextResponse.json({
          error: "INSUFFICIENT_GAS",
          message: `The Circle SCA needs native gas on ${sourceChain} to authorize the persistent Gateway signer.`,
          sourceChain,
          blockchain: CIRCLE_CHAIN_NAMES[sourceChain] ?? GATEWAY_CHAIN_CONFIGS[sourceChain].label,
          walletAddress: gas.address,
          completedSources: results,
        }, { status: 400 });
      }
      const txHash = await initiateDepositFromCustodialWallet(
        wallet.circle_wallet_id,
        sourceChain,
        0n,
        signerAddress,
      );
      results.push({ sourceChain, status: "pending_gateway_finality", txHash });
    }

    return NextResponse.json({
      success: true,
      status: results.some((result) => result.status === "pending_gateway_finality")
        ? "pending_gateway_finality"
        : "ready",
      message: "Gateway delegate authorization submitted. Preview again after finality; no burn was submitted.",
      signerAddress,
      sources: results,
      partialBurnSubmitted: false,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json({
      error: "GATEWAY_DELEGATE_FAILED",
      message: error instanceof Error ? error.message : "Gateway delegate authorization failed.",
    }, { status: 500 });
  }
}
