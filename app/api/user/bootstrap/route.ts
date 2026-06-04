import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { ensureUserCircleWallet } from "@/lib/circle/ensure-user-wallet";
import { createClient } from "@/lib/supabase/server";

type AuthProvider = "email" | "web3";

type BootstrapBody = {
  authProvider?: AuthProvider;
  externalWallet?: {
    walletType?: "metamask";
    chainType?: "evm";
    walletAddress?: string;
  } | null;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as BootstrapBody;
    const authProvider = body.authProvider === "web3" ? "web3" : "email";
    const rawExternalAddress = body.externalWallet?.walletAddress?.trim() ?? "";
    const externalWalletAddress = rawExternalAddress.toLowerCase();
    const hasExternalWallet = authProvider === "web3" && Boolean(externalWalletAddress);

    if (hasExternalWallet && !isAddress(externalWalletAddress)) {
      return NextResponse.json({ error: "Invalid external wallet address" }, { status: 400 });
    }

    const profilePayload = {
      user_id: user.id,
      auth_provider: authProvider,
      handle: hasExternalWallet ? externalWalletAddress : user.email ?? user.id,
      display_name: hasExternalWallet ? shortAddress(externalWalletAddress) : user.email ?? "PayCMD user",
      default_chain: "arcTestnet",
      primary_external_wallet_address: hasExternalWallet ? externalWalletAddress : null,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(profilePayload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (profileError) {
      throw profileError;
    }

    let externalWallet = null;

    if (hasExternalWallet) {
      const { data, error } = await supabase
        .from("user_external_wallets")
        .upsert(
          {
            user_id: user.id,
            wallet_type: "metamask",
            chain_type: "evm",
            wallet_address: externalWalletAddress,
            is_primary: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,wallet_type,wallet_address" },
        )
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      externalWallet = data;
    }

    const { wallet, created } = await ensureUserCircleWallet(supabase, user.id);

    return NextResponse.json({
      success: true,
      profile,
      externalWallet,
      circleWallet: {
        circleWalletId: wallet.circle_wallet_id,
        walletSetId: wallet.wallet_set_id,
        walletAddress: wallet.address ?? wallet.wallet_address,
      },
      createdCircleWallet: created,
    });
  } catch (error: any) {
    console.error("User bootstrap failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to bootstrap user" },
      { status: 500 },
    );
  }
}
