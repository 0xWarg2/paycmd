import { NextResponse } from "next/server";
import { BaseError, HttpRequestError, TimeoutError, formatUnits } from "viem";
import { z } from "zod";

import {
  PAYNA_SWAP_CHAIN,
  PAYNA_SWAP_SLIPPAGE_BPS,
  amountOutMinFromSlippage,
  parseSwapAmount,
  paynaSwapTokens,
} from "@/lib/paycmd/swap";
import { SwapQuoteError, quoteSwapRoute } from "@/lib/paycmd/swap-quote";
import { web3Chains } from "@/lib/paycmd/web3-chains";
import { createClient } from "@/lib/supabase/server";

// Swap quotes are read server-side because neither client-side option works.
//
// Reading through the wallet (`eth_call` on the injected provider) resolves against whatever chain
// the user currently has selected, and the preview fires on every keystroke — long before the swap
// path switches to Arc. With the wallet on any other chain the Payna factory address holds no code,
// `eth_call` returns `0x`, and viem throws `Cannot decode zero data ("0x")`. Reproduced by running
// `/deposit … from base`, which leaves MetaMask on Base Sepolia, then `/swap`.
//
// Reading straight from the browser fails differently: the Arc testnet RPC sits behind a load
// balancer whose nodes disagree about CORS. Measured over 10 requests each, 6/10 POSTs came back
// with no `access-control-allow-origin` and 6/10 `OPTIONS` preflights returned 400. viem sends
// `Content-Type: application/json`, which is not CORS-safelisted, so a preflight is mandatory and
// roughly half of them fail — surfacing as `Failed to fetch`. MetaMask never hit this because
// extension-originated requests are not subject to CORS at all.
//
// Server-side has neither problem: the chain is pinned, and same-origin needs no preflight. It also
// means a quote no longer requires a connected wallet, which is right — a price is public state.
const quoteSchema = z.object({
  tokenIn: z.enum(["USDC", "EURC", "cirBTC"]),
  tokenOut: z.enum(["USDC", "EURC", "cirBTC"]),
  // Bounded before it reaches `parseUnits`, which throws on anything non-numeric.
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  // Set by the path that is about to build a transaction, so its `amountOutMin` comes from reserves
  // read now rather than from a cached figure up to a few seconds old. The keystroke preview leaves
  // it off — that is what keeps the rate limit satisfied.
  fresh: z.boolean().optional().default(false),
});

const arcChain = web3Chains[PAYNA_SWAP_CHAIN];

// viem puts the request URL in its error messages, and ours carries the RPC key in the path — that
// is exactly how the key ended up in a browser-visible error during the client-side attempt. Keep
// the host so the message still says which endpoint failed, drop the key.
const rpcHost = (() => {
  try {
    return new URL(arcChain.rpcUrl).origin;
  } catch {
    return "the Arc RPC";
  }
})();

// `readContract` does not rethrow a transport failure as-is: `getContractError` wraps it in a
// `ContractFunctionExecutionError` and hangs the original off `.cause`. So testing the thrown error
// with `instanceof HttpRequestError` is always false, and reading its `message` gives the wrapper's
// prose rather than the reason. Both answers come from walking the chain.
function classifyQuoteFailure(error: unknown) {
  const networkCause =
    error instanceof BaseError
      ? error.walk((err) => err instanceof HttpRequestError || err instanceof TimeoutError)
      : null;

  // `walk()` with no predicate returns the deepest cause, which is the error worth naming.
  const root = error instanceof BaseError ? (networkCause ?? error.walk()) : error;

  const raw =
    root instanceof BaseError
      ? root.shortMessage || root.message
      : root instanceof Error
        ? root.message
        : String(root);

  const name = root instanceof Error ? root.name : "Error";
  // First line only: viem's `message` also carries the request body, a docs link and the version.
  const summary = raw.split("\n")[0]?.trim().slice(0, 180) || "Unknown failure";

  return {
    isNetwork: Boolean(networkCause),
    detail: `${name}: ${summary}`.split(arcChain.rpcUrl).join(rpcHost),
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The quote itself is public data, but gating it keeps this route from being an open RPC proxy.
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = quoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid swap quote payload" }, { status: 400 });
  }

  const { tokenIn, tokenOut, amount, fresh } = parsed.data;

  if (tokenIn === tokenOut) {
    return NextResponse.json({ error: "Choose two different swap tokens." }, { status: 400 });
  }

  // Not `swapPathFor`: that returns `PaynaSwapTokenSymbol[]`, and narrowing it back to the zod enum
  // for the response would need a cast. The two-vs-three hop rule is the whole function.
  const route =
    tokenIn === "USDC" || tokenOut === "USDC"
      ? ([tokenIn, tokenOut] as const)
      : ([tokenIn, "USDC", tokenOut] as const);

  let amountIn: bigint;
  try {
    amountIn = parseSwapAmount(amount, tokenIn);
  } catch {
    return NextResponse.json({ error: "Invalid swap amount." }, { status: 400 });
  }

  if (amountIn <= 0n) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }

  let rollingAmount: bigint;
  let pairs: `0x${string}`[];

  try {
    const quote = await quoteSwapRoute(route, amountIn, { fresh });
    rollingAmount = quote.amountOut;
    pairs = quote.pairs;
  } catch (error) {
    // A dead pool is the user's answer, not a server fault, so it keeps its own 400 rather than
    // being folded into the 5xx below.
    if (error instanceof SwapQuoteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Full error server-side, where the RPC URL is not a leak.
    console.error("Failed to quote Payna swap", error);

    // One catch wraps the whole loop, so it also swallows decode errors, bad ABI results and
    // arithmetic — none of which are "could not reach". Reporting all of them with the network
    // message sent the reader chasing an RPC that was answering fine. Split the two, and attach a
    // short cause so a bug report names the actual failure instead of my guess at it.
    const { isNetwork, detail } = classifyQuoteFailure(error);

    return NextResponse.json(
      {
        error: isNetwork
          ? `Could not reach ${arcChain.name} to price this swap.`
          : `Failed to price this swap on ${arcChain.name}.`,
        detail,
      },
      { status: isNetwork ? 502 : 500 },
    );
  }

  const amountOutMin = amountOutMinFromSlippage(rollingAmount, PAYNA_SWAP_SLIPPAGE_BPS);
  const outDecimals = paynaSwapTokens[tokenOut].decimals;

  // Atomic units as strings: JSON has no bigint, and sending decimals instead would make the client
  // re-parse a rounded figure into the `amountOutMin` it signs.
  return NextResponse.json({
    tokenIn,
    tokenOut,
    amountIn: amountIn.toString(),
    amountOut: rollingAmount.toString(),
    amountOutMin: amountOutMin.toString(),
    amountOutFormatted: formatUnits(rollingAmount, outDecimals),
    amountOutMinFormatted: formatUnits(amountOutMin, outDecimals),
    route,
    pairs,
  });
}
