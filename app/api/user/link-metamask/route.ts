import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";

import { createClient } from "@/lib/supabase/server";

type LinkMetaMaskBody = {
  walletAddress?: string;
  message?: string;
  signature?: `0x${string}`;
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

    const body = (await req.json().catch(() => ({}))) as LinkMetaMaskBody;
    const walletAddress = body.walletAddress?.trim().toLowerCase() ?? "";

    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid MetaMask wallet address" }, { status: 400 });
    }

    if (!body.message || !body.signature) {
      return NextResponse.json({ error: "message and signature are required" }, { status: 400 });
    }

    const verified = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: body.message,
      signature: body.signature,
    });

    if (!verified) {
      return NextResponse.json({ error: "MetaMask signature verification failed" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data: externalWallet, error: walletError } = await supabase
      .from("user_external_wallets")
      .upsert(
        {
          user_id: user.id,
          wallet_type: "metamask",
          chain_type: "evm",
          wallet_address: walletAddress,
          is_primary: true,
          verified_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,wallet_type,wallet_address" },
      )
      .select("*")
      .single();

    if (walletError) {
      throw walletError;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          auth_provider: user.email ? "email" : "web3",
          handle: user.email ?? walletAddress,
          display_name: user.email ?? shortAddress(walletAddress),
          primary_external_wallet_address: walletAddress,
          default_chain: "arcTestnet",
          updated_at: now,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({
      success: true,
      profile,
      externalWallet,
    });
  } catch (error: any) {
    console.error("Link MetaMask failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to link MetaMask" },
      { status: 500 },
    );
  }
}
