import { createPublicClient, fallback, http, type Chain, type Transport } from "viem";

import { web3Chains } from "./web3-chains";

const arcChain = web3Chains.arcTestnet;

// Measured on the Arc testnet RPC, 40 requests each way:
//
//   keyed, 40 concurrent    -> 28x 200, 12x 429
//   keyless, 40 concurrent  ->  8x 200, 32x 429
//   keyed, 40 sequential    -> 39x 200,  1x 429
//
// Two conclusions drive everything below. First, *concurrency* is what trips the limit, not
// total volume — the same 40 requests spread out almost entirely succeed. Second, the keyless
// endpoint is roughly 3.5x tighter than the keyed one (it is a shared global bucket, not a
// private quota), so it belongs behind the keyed endpoint as a spare, never in front of it.
export const ARC_KEYED_RPC_URL = arcChain.rpcUrl;

// Same chain id, no key required — verified answering `eth_chainId` with 0x4cef52.
export const ARC_KEYLESS_RPC_URL = "https://rpc.testnet.arc.network/";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

// `batch.multicall` reads the multicall3 address off `client.chain`, so a chain object is needed
// even for reads that otherwise would not care. Verified deployed at the canonical address on Arc
// testnet (3808 bytes of code). `nativeCurrency` is inlined rather than mapped from `web3Chains`
// because viem only uses it for formatting, and nothing here formats native value.
export const arcTestnetChain = {
  id: arcChain.id,
  name: arcChain.name,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [ARC_KEYED_RPC_URL] } },
  contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
  testnet: true,
} as const satisfies Chain;

// Ceiling on in-flight requests. 3 is well under where 429s begin (~20 concurrent) and leaves
// headroom for MetaMask, which polls this same endpoint on its own schedule and is not something
// the app can pace.
const MAX_CONCURRENT = 3;

// Floor on the gap between two request starts. Jittered because the fixed delay is the problem it
// solves: several tabs (or several retrying clients) that all wait exactly the same interval stay
// in lockstep and keep colliding on the same slot. Randomising pulls them apart.
const MIN_SPACING_MS = 60;
const SPACING_JITTER_MS = 40;

let active = 0;
let lastStartedAt = 0;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;
const pending: Array<() => void> = [];

function nextSpacing() {
  return MIN_SPACING_MS + Math.random() * SPACING_JITTER_MS;
}

function pump() {
  // A timer is already going to call back; starting work now would defeat the spacing.
  if (pumpTimer || active >= MAX_CONCURRENT || pending.length === 0) return;

  const wait = lastStartedAt + nextSpacing() - Date.now();
  if (wait > 0) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      pump();
    }, wait);
    return;
  }

  const start = pending.shift();
  if (!start) return;

  active += 1;
  lastStartedAt = Date.now();
  start();

  // Try to fill the remaining concurrency slots; the spacing check above gates how fast.
  pump();
}

/**
 * Runs `task` once the Arc RPC has a free slot. Queue-wide, so unrelated callers in the same
 * process (quote pricing, preflight reads, receipt polling) share one budget instead of each
 * assuming it has the endpoint to itself.
 */
export function scheduleArcRequest<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pending.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    });

    pump();
  });
}

// Wraps a transport so every JSON-RPC request goes through the queue above. Applied outside
// `fallback` so a retry or an endpoint switch does not have to re-queue behind fresh work — the
// point is to cap what this process starts, and a retry was already counted when it started.
function throttled(inner: Transport): Transport {
  return ((params: Parameters<Transport>[0]) => {
    const transport = inner(params);

    return {
      ...transport,
      request: ((args: unknown, options: unknown) =>
        scheduleArcRequest(() =>
          (transport.request as (a: unknown, o: unknown) => Promise<unknown>)(args, options),
        )) as typeof transport.request,
    };
  }) as Transport;
}

// `retryCount: 0` on the fallback itself: each `http` below already retries, and letting both
// layers retry multiplies one logical request into a dozen — the opposite of the goal. viem
// retries 429 by default, and `retryDelay` is the base for its exponential backoff, set above the
// 1s rate-limit window so the first retry lands after the bucket refills rather than inside the
// same exhausted one.
export const arcTransport = throttled(
  fallback(
    [
      http(ARC_KEYED_RPC_URL, { timeout: 15_000, retryCount: 3, retryDelay: 1_200 }),
      http(ARC_KEYLESS_RPC_URL, { timeout: 15_000, retryCount: 2, retryDelay: 1_500 }),
    ],
    { retryCount: 0, rank: false },
  ),
);

/**
 * The one client for reading Arc from the server. `batch.multicall` merges every `readContract`
 * issued in the same tick into a single `aggregate3` call, so grouping reads into one `Promise.all`
 * costs one request no matter how many reads it contains.
 */
export const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: arcTransport,
  batch: { multicall: { wait: 10 } },
});
