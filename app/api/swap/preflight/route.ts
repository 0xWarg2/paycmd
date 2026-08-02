import { NextResponse } from "next/server";
import { erc20Abi } from "viem";
import { z } from "zod";

import { arcPublicClient } from "@/lib/paycmd/arc-rpc";
import { getSwapAdapterAddress, paynaSwapTokens } from "@/lib/paycmd/swap";
import { createClient } from "@/lib/supabase/server";

// These three reads used to go through MetaMask (`eth_getBalance` + two `eth_call`s). That was the
// bulk of the rate-limit problem: the wallet is not a read layer, it just forwards to the same Arc
// RPC while adding its own background polling on top, and nothing in the app can pace it.
//
// Server-side they cost one multicall request for the two contract reads plus one `eth_getBalance`,
// both through the shared throttle in `lib/paycmd/arc-rpc.ts`. It also removes the class of bug that
// started this: reads through the wallet resolve against whatever chain the user has selected, so a
// wallet left on Base Sepolia made the Arc token address hold no code and `eth_call` return `0x`.
const preflightSchema = z.object({
  account: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenIn: z.enum(["USDC", "EURC", "cirBTC"]),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = preflightSchema.safeParse(await req.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid swap preflight payload" }, { status: 400 });
  }

  const adapter = getSwapAdapterAddress();

  if (!adapter) {
    return NextResponse.json(
      { error: "Payna swap adapter address is not configured." },
      { status: 500 },
    );
  }

  const account = parsed.data.account as `0x${string}`;
  const token = paynaSwapTokens[parsed.data.tokenIn];

  try {
    // Issued in the same tick so `batch.multicall` collapses both into one `aggregate3` call.
    // `eth_getBalance` cannot join a multicall (it is not a contract call), so it stays separate.
    const [balance, allowance, nativeBalance] = await Promise.all([
      arcPublicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      }),
      arcPublicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, adapter],
      }),
      arcPublicClient.getBalance({ address: account }),
    ]);

    // Atomic units as strings: JSON has no bigint, and the caller compares these against an
    // `amountIn` that is itself atomic — rounding through a decimal would break the comparison.
    return NextResponse.json({
      tokenIn: token.symbol,
      decimals: token.decimals,
      balance: balance.toString(),
      allowance: allowance.toString(),
      // Only ever tested against zero by the caller. Worth knowing: Arc reports native balance in
      // 18 decimals here while `balanceOf` on the USDC precompile reports 6, so these two numbers
      // describe the same funds at different scales and must not be compared to each other.
      nativeBalance: nativeBalance.toString(),
      hasNativeGas: nativeBalance > 0n,
    });
  } catch (error) {
    console.error("Failed to run Payna swap preflight", error);

    return NextResponse.json(
      { error: "Could not read your Arc Testnet balances." },
      { status: 502 },
    );
  }
}
