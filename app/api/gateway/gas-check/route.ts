import { NextRequest, NextResponse } from "next/server";

import {
  CIRCLE_CHAIN_NAMES,
  checkWalletGasBalance,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import { getGatewayEOAWalletId } from "@/lib/circle/create-gateway-eoa-wallets";
import { createClient } from "@/lib/supabase/server";

const validChains: SupportedChain[] = ["arcTestnet", "baseSepolia", "avalancheFuji"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chain } = (await req.json().catch(() => ({}))) as { chain?: SupportedChain };

  if (!chain || !validChains.includes(chain)) {
    return NextResponse.json(
      { error: `Invalid chain. Must be one of: ${validChains.join(", ")}` },
      { status: 400 },
    );
  }

  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("circle_wallet_id")
    .eq("user_id", user.id)
    .eq("type", "sca")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!wallet?.circle_wallet_id) {
    return NextResponse.json(
      { error: "No Circle wallet found. Run /wallet create first." },
      { status: 404 },
    );
  }

  const scaGas = await checkWalletGasBalance(wallet.circle_wallet_id, chain);
  let gatewaySigner:
    | {
        walletId: string;
        address: string;
        balance: string;
        hasGas: boolean;
      }
    | null = null;
  let gatewaySignerError: string | undefined;

  try {
    const signer = await getGatewayEOAWalletId(user.id, CIRCLE_CHAIN_NAMES[chain]);
    const signerGas = await checkWalletGasBalance(signer.walletId, chain);
    gatewaySigner = {
      walletId: signer.walletId,
      ...signerGas,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gateway signer wallet could not be checked.";
    gatewaySignerError = message.includes("Gateway EOA wallet not found")
      ? "Gateway signer wallet is not created yet."
      : message;
  }

  return NextResponse.json({
    success: true,
    chain,
    address: scaGas.address,
    balance: scaGas.balance,
    hasGas: scaGas.hasGas,
    wallets: {
      sca: {
        walletId: wallet.circle_wallet_id,
        address: scaGas.address,
        balance: scaGas.balance,
        hasGas: scaGas.hasGas,
      },
      gatewaySigner,
    },
    gatewaySignerError,
  });
}
