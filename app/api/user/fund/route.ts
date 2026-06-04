import { NextRequest, NextResponse } from "next/server";
import { isAddress, isHash } from "viem";

import { isSupportedChain, type PayCmdChain } from "@/lib/paycmd/chains";
import { web3Chains } from "@/lib/paycmd/web3-chains";
import { createClient } from "@/lib/supabase/server";

type FundRecordBody = {
  chain?: string;
  amount?: string;
  txHash?: string;
  status?: "success" | "pending" | "failed";
  fromAddress?: string;
  toAddress?: string;
};

async function getFundContext(chain: PayCmdChain) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: externalWallet, error: externalError } = await supabase
    .from("user_external_wallets")
    .select("wallet_address, wallet_type, chain_type, is_primary")
    .eq("user_id", user.id)
    .eq("wallet_type", "metamask")
    .eq("is_primary", true)
    .maybeSingle();

  if (externalError) {
    throw externalError;
  }

  if (!externalWallet?.wallet_address) {
    return {
      error: NextResponse.json(
        { error: "No linked MetaMask wallet. Run /link metamask first." },
        { status: 404 },
      ),
    };
  }

  const { data: circleWallet, error: circleError } = await supabase
    .from("wallets")
    .select("circle_wallet_id, wallet_set_id, wallet_address, address, type")
    .eq("user_id", user.id)
    .eq("type", "sca")
    .limit(1)
    .maybeSingle();

  if (circleError) {
    throw circleError;
  }

  const circleWalletAddress = circleWallet?.address ?? circleWallet?.wallet_address;

  if (!circleWalletAddress) {
    return {
      error: NextResponse.json(
        { error: "No Circle wallet found. Login again or run /wallet create." },
        { status: 404 },
      ),
    };
  }

  return {
    supabase,
    user,
    externalWallet,
    circleWallet,
    circleWalletAddress,
    chainConfig: web3Chains[chain],
  };
}

export async function GET(req: NextRequest) {
  try {
    const chain = req.nextUrl.searchParams.get("chain") ?? "";

    if (!isSupportedChain(chain)) {
      return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
    }

    const context = await getFundContext(chain);

    if ("error" in context) {
      return context.error;
    }

    return NextResponse.json({
      success: true,
      sourceWallet: context.externalWallet.wallet_address,
      destinationWallet: context.circleWalletAddress,
      chain,
      chainConfig: context.chainConfig,
    });
  } catch (error: any) {
    console.error("Get fund context failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get fund context" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as FundRecordBody;
    const chain = body.chain ?? "";
    const amount = body.amount ?? "";
    const txHash = body.txHash ?? "";
    const status = body.status ?? "pending";
    const fromAddress = body.fromAddress?.toLowerCase() ?? "";
    const toAddress = body.toAddress?.toLowerCase() ?? "";

    if (!isSupportedChain(chain)) {
      return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    if (!isHash(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    if (!isAddress(fromAddress) || !isAddress(toAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const context = await getFundContext(chain);

    if ("error" in context) {
      return context.error;
    }

    if (context.externalWallet.wallet_address.toLowerCase() !== fromAddress) {
      return NextResponse.json({ error: "Funding source does not match linked MetaMask" }, { status: 400 });
    }

    if (context.circleWalletAddress.toLowerCase() !== toAddress) {
      return NextResponse.json({ error: "Funding destination does not match Circle wallet" }, { status: 400 });
    }

    const { error: insertError } = await context.supabase.from("transaction_history").insert({
      user_id: context.user.id,
      chain,
      tx_type: "fund",
      amount: Number(amount),
      tx_hash: txHash,
      gateway_wallet_address: context.circleWalletAddress,
      status,
      reason: "MetaMask USDC transfer to Circle wallet",
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      chain,
      amount: Number(amount),
      txHash,
      status,
      fromAddress,
      toAddress,
    });
  } catch (error: any) {
    console.error("Record fund transaction failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record fund transaction" },
      { status: 500 },
    );
  }
}
