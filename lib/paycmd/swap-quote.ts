import { createPublicClient, http, type Address, type Chain } from "viem";

import {
  PAYNA_SWAP_CHAIN_ID,
  amountOutFromReserves,
  paynaDexFactory,
  paynaFactoryAbi,
  paynaPairAbi,
  paynaSwapTokens,
  type PaynaSwapTokenSymbol,
} from "./swap";
import { web3Chains } from "./web3-chains";

const arcChain = web3Chains.arcTestnet;

// The Arc testnet RPC allows 4 requests/second — `x-ratelimit-limit: 4, 4;w=1`, and over the limit
// it answers HTTP 429 `{"code":-32011,"message":"request limit reached"}`. viem reports that as
// `HttpRequestError`, which is why it first showed up as a "could not reach the RPC" error against
// an RPC that was answering every direct request fine.
//
// The old shape spent 3 calls per hop (getPair, token0, getReserves), so 6 for EURC->USDC->cirBTC,
// and the preview re-quotes on every keystroke. Three overlapping quotes put ~18 calls in one second.
// Everything below exists to fit a quote inside that budget: batch independent reads through
// multicall3, and cache what does not change.
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

// `batch.multicall` reads the multicall3 address off `client.chain`, so the client needs a chain
// object — unlike the plain reads before it, which needed none. Verified deployed at the canonical
// address on Arc testnet (3808 bytes of code). `nativeCurrency` is inlined rather than mapped from
// `web3Chains` because viem only uses it for formatting, and no read here formats native value.
const arcTestnetChain = {
  id: PAYNA_SWAP_CHAIN_ID,
  name: arcChain.name,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [arcChain.rpcUrl] } },
  contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
  testnet: true,
} as const satisfies Chain;

export const swapQuoteClient = createPublicClient({
  chain: arcTestnetChain,
  // `retryCount` is viem's default 3, named here because it is load-bearing: viem retries 429, so a
  // quote that clips the limit recovers instead of failing. `retryDelay` is the base for viem's
  // exponential backoff, set above the 1s rate-limit window (`x-ratelimit-reset: 1`) so the first
  // retry lands after the bucket refills rather than into the same exhausted window.
  transport: http(arcChain.rpcUrl, { timeout: 15_000, retryCount: 3, retryDelay: 1_200 }),
  // Merges every `readContract` issued in the same tick into one `aggregate3` call. The reads below
  // are deliberately grouped into `Promise.all`s so each group costs one request regardless of how
  // many hops the route has.
  batch: { multicall: { wait: 10 } },
});

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
        swapQuoteClient.readContract({
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
        swapQuoteClient.readContract({ address: pair, abi: paynaPairAbi, functionName: "token0" }),
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
        swapQuoteClient.readContract({ address: pair, abi: paynaPairAbi, functionName: "getReserves" }),
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
