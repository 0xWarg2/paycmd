import { createPublicClient, fallback, http, type Chain, type Transport } from "viem";

import { web3Chains } from "./web3-chains.ts";

const arcChain = web3Chains.arcTestnet;

export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_OFFICIAL_RPC_URL = "https://rpc.testnet.arc.io";
export const ARC_PRIMARY_RPC_URL = process.env.ARC_RPC_URL?.trim() || arcChain.rpcUrl;
export const ARC_FALLBACK_RPC_URL = process.env.ARC_RPC_FALLBACK_URL?.trim() || null;

const ARC_MAINNET_REQUIRED_ENV = [
  "ARC_MAINNET_CHAIN_ID",
  "ARC_MAINNET_RPC_URL",
  "ARC_MAINNET_EXPLORER_URL",
  "ARC_MAINNET_USDC_ADDRESS",
  "ARC_MAINNET_GATEWAY_WALLET_ADDRESS",
  "ARC_MAINNET_GATEWAY_MINTER_ADDRESS",
  "ARC_MAINNET_CCTP_DOMAIN",
  "ARC_MAINNET_TOKEN_MESSENGER_ADDRESS",
  "ARC_MAINNET_MESSAGE_TRANSMITTER_ADDRESS",
] as const;

export function arcMainnetReadiness(env: NodeJS.ProcessEnv = process.env) {
  const missing = ARC_MAINNET_REQUIRED_ENV.filter((name) => !env[name]?.trim());
  return { ready: missing.length === 0, missing };
}

export function assertArcNetworkEnabled(env: NodeJS.ProcessEnv = process.env) {
  const network = env.ARC_NETWORK?.trim() || "testnet";
  if (network === "testnet") return "testnet" as const;
  const readiness = arcMainnetReadiness(env);
  throw new Error(
    `ARC_MAINNET_NOT_ENABLED: HeyPayna is testnet-only. Missing or unverified mainnet fields: ${readiness.missing.join(", ") || "none"}.`,
  );
}

assertArcNetworkEnabled();

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

// `batch.multicall` reads the multicall3 address off `client.chain`, so a chain object is needed
// even for reads that otherwise would not care. Verified deployed at the canonical address on Arc
// testnet (3808 bytes of code). `nativeCurrency` is inlined rather than mapped from `web3Chains`
// because viem only uses it for formatting, and nothing here formats native value.
export const arcTestnetChain = {
  id: ARC_TESTNET_CHAIN_ID,
  name: arcChain.name,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_PRIMARY_RPC_URL] } },
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
    [ARC_PRIMARY_RPC_URL, ARC_FALLBACK_RPC_URL]
      .filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index)
      .map((url) => http(url, { timeout: 15_000, retryCount: 3, retryDelay: 1_200 })),
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
