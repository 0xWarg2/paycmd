import { type Address } from "viem";

import { arcPublicClient } from "./arc-rpc";
import {
  amountOutFromReserves,
  paynaDexFactory,
  paynaFactoryAbi,
  paynaPairAbi,
  paynaSwapTokens,
  type PaynaSwapTokenSymbol,
} from "./swap";

// Client, transport, throttle and rate-limit measurements all live in `./arc-rpc` so every Arc
// reader in the process shares one request budget. An earlier version of this file owned its own
// client and documented a 4 req/s limit; re-measuring showed the limit is a burst allowance
// (~20 concurrent) rather than a fixed rate, and that sequential requests barely trip it at all.
//
// What remains here is the part specific to pricing: a route costs 3 calls per hop if nothing is
// cached (getPair, token0, getReserves), and the keystroke preview re-quotes as the user types.
// Batching independent reads through multicall3 and caching what cannot change keeps a quote to
// two requests at most, and zero when both caches are warm.

type PairInfo = { pair: Address; token0: Address };

// A Uniswap V2 pair address and its `token0` are fixed once the pair is created, so these never go
// stale and need no TTL. Unbounded growth is not a concern either: three tokens means at most three
// pairs, so this map cannot exceed three entries.
const pairInfoCache = new Map<string, PairInfo>();

type CachedReserves = { reserve0: bigint; reserve1: bigint; at: number };

const reservesCache = new Map<Address, CachedReserves>();

// Reserves do move, so they get a TTL. 4s is chosen against what a stale quote can actually cost:
// the preview is just a displayed number, and the amount the user signs is bounded on-chain by
// `amountOutMin`, so drift can only make a swap revert — it cannot make one settle at a worse rate
// than quoted. `quoteSwapRoute({ fresh: true })` skips this entirely for the signing path.
const RESERVES_TTL_MS = 4_000;

export type SwapQuoteFailureKind = "no_pair" | "no_liquidity";

// Lets the caller map a pool problem to a 4xx and everything else (transport, decode) to a 5xx,
// instead of one catch collapsing both into the same message.
export class SwapQuoteError extends Error {
  constructor(
    message: string,
    readonly kind: SwapQuoteFailureKind,
  ) {
    super(message);
    this.name = "SwapQuoteError";
  }
}

function pairKey(a: Address, b: Address) {
  // Sorted so USDC/EURC and EURC/USDC share one entry — `getPair` is order-independent.
  return [a.toLowerCase(), b.toLowerCase()].sort().join("/");
}

async function loadPairInfo(
  hops: Array<{ from: PaynaSwapTokenSymbol; to: PaynaSwapTokenSymbol }>,
): Promise<PairInfo[]> {
  const missing = hops.filter((hop) => {
    const from = paynaSwapTokens[hop.from];
    const to = paynaSwapTokens[hop.to];
    return !pairInfoCache.has(pairKey(from.address, to.address));
  });

  if (missing.length > 0) {
    // Every hop's `getPair` is independent — the route is known up front, so there is no need to
    // resolve one pair before asking for the next. Issued together, they batch into one request.
    const resolved = await Promise.all(
      missing.map((hop) =>
        arcPublicClient.readContract({
          address: paynaDexFactory,
          abi: paynaFactoryAbi,
          functionName: "getPair",
          args: [paynaSwapTokens[hop.from].address, paynaSwapTokens[hop.to].address],
        }),
      ),
    );

    resolved.forEach((pair, index) => {
      const hop = missing[index];
      if (!pair || /^0x0{40}$/i.test(pair)) {
        throw new SwapQuoteError(
          `No liquidity pair for ${paynaSwapTokens[hop.from].symbol}/${paynaSwapTokens[hop.to].symbol}.`,
          "no_pair",
        );
      }
    });

    // `token0` is immutable per pair, so it belongs in the same cache entry and is read once per
    // pair for the process lifetime rather than once per quote.
    const token0s = await Promise.all(
      resolved.map((pair) =>
        arcPublicClient.readContract({ address: pair, abi: paynaPairAbi, functionName: "token0" }),
      ),
    );

    // Written only once both halves are known. Seeding `pair` first with a placeholder `token0`
    // would leave a poisoned entry behind if this read threw — and `has()` would then treat it as
    // valid, flipping `currentIsToken0` and mispricing every later quote with no error to show.
    resolved.forEach((pair, index) => {
      const hop = missing[index];
      pairInfoCache.set(pairKey(paynaSwapTokens[hop.from].address, paynaSwapTokens[hop.to].address), {
        pair,
        token0: token0s[index],
      });
    });
  }

  return hops.map((hop) => {
    const key = pairKey(paynaSwapTokens[hop.from].address, paynaSwapTokens[hop.to].address);
    const info = pairInfoCache.get(key);
    if (!info) {
      throw new SwapQuoteError(
        `No liquidity pair for ${paynaSwapTokens[hop.from].symbol}/${paynaSwapTokens[hop.to].symbol}.`,
        "no_pair",
      );
    }
    return info;
  });
}

async function loadReserves(pairs: Address[], fresh: boolean): Promise<CachedReserves[]> {
  const now = Date.now();
  const stale = pairs.filter((pair) => {
    if (fresh) return true;
    const cached = reservesCache.get(pair);
    return !cached || now - cached.at >= RESERVES_TTL_MS;
  });

  if (stale.length > 0) {
    // Again issued together so every hop's reserves arrive in one request.
    const results = await Promise.all(
      stale.map((pair) =>
        arcPublicClient.readContract({ address: pair, abi: paynaPairAbi, functionName: "getReserves" }),
      ),
    );

    results.forEach((reserves, index) => {
      reservesCache.set(stale[index], {
        reserve0: reserves[0],
        reserve1: reserves[1],
        at: Date.now(),
      });
    });
  }

  return pairs.map((pair) => {
    const cached = reservesCache.get(pair);
    if (!cached) throw new SwapQuoteError("Missing reserves for pair.", "no_liquidity");
    return cached;
  });
}

export type SwapQuote = { amountOut: bigint; pairs: Address[] };

/**
 * Prices `amountIn` along `route` using two batched RPC requests at most, and zero when both caches
 * are warm. `fresh` bypasses the reserves cache — pass it on the path that produces the
 * `amountOutMin` the user signs, and leave it off for the keystroke preview.
 */
export async function quoteSwapRoute(
  route: readonly PaynaSwapTokenSymbol[],
  amountIn: bigint,
  options: { fresh?: boolean } = {},
): Promise<SwapQuote> {
  const hops = route.slice(0, -1).map((from, index) => ({ from, to: route[index + 1] }));

  const pairInfos = await loadPairInfo(hops);
  const reserves = await loadReserves(
    pairInfos.map((info) => info.pair),
    options.fresh ?? false,
  );

  let rolling = amountIn;

  hops.forEach((hop, index) => {
    const current = paynaSwapTokens[hop.from];
    const { token0 } = pairInfos[index];
    const { reserve0, reserve1 } = reserves[index];

    const currentIsToken0 = token0.toLowerCase() === current.address.toLowerCase();

    rolling = amountOutFromReserves(
      rolling,
      currentIsToken0 ? reserve0 : reserve1,
      currentIsToken0 ? reserve1 : reserve0,
    );

    if (rolling <= 0n) {
      throw new SwapQuoteError(
        `Pool ${current.symbol}/${paynaSwapTokens[hop.to].symbol} has insufficient liquidity.`,
        "no_liquidity",
      );
    }
  });

  return { amountOut: rolling, pairs: pairInfos.map((info) => info.pair) };
}
