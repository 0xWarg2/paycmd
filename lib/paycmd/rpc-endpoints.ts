import { fallback, http, type Transport } from "viem";

import { type PayCmdChain } from "./chains.ts";

/**
 * The one place read endpoints are declared. Two maps used to hold them — `web3Chains.rpcUrl` and
 * a `RPC_URL_OVERRIDES` table inside lib/circle/gateway-sdk.ts — and they had drifted: the Gateway
 * side had moved Polygon Amoy off the host that no longer resolves while `web3Chains` still pointed
 * at it, so the same chain read fine on one code path and failed on another.
 *
 * Each chain lists endpoints in preference order and is read through `rpcTransport`, which walks
 * the list on failure. A single endpoint is a single point of failure, and that is not theoretical:
 * `https://sepolia.base.org` answered `eth_chainId` normally while returning
 * `-32011: no backend is currently healthy to serve traffic` to every `eth_call`, which is what
 * made a received payment look missing — `/balance` reported the chain as unreadable and the table
 * showed nothing for it.
 *
 * Measured 2026-08-19 by firing `eth_chainId` (chain-id verified against the expected value) plus
 * 16 concurrent `eth_call` balanceOf per endpoint, all 12 chains at once. Only endpoints that
 * returned 16/16 are listed; everything below is that run's evidence:
 *
 *   - drpc.org free endpoints rate-limit hard under fan-out ("You reached Public endpoint rate
 *     limit"): Arbitrum 12/16, Optimism 11/16, World Chain 11/16, Sei 4/16, Base 0/16. It stays as
 *     a second choice only where it was the healthiest alternate.
 *   - `worldchain-sepolia.gateway.tenderly.co`, which the Gateway override had promoted to primary,
 *     returned `-32005: rate limit exceeded` on 7 of 16 — demoted below the Alchemy public endpoint.
 *   - `rpc.hyperliquid-testnet.xyz/evm` is primary again (16/16, fastest at p50 284ms). It had been
 *     overridden for failing Node's TLS chain verification; re-checked today with `node:https` and
 *     the certificate now verifies against the default CA store.
 *   - `rpc-amoy.polygon.technology` still does not resolve (ENOTFOUND) and is omitted entirely.
 *   - Sei and Sonic list one endpoint each: no alternate answered reliably (Sei's drpc endpoint
 *     also reports `eth_call does not exist`, and `sonic-testnet.drpc.org` answers
 *     `Unknown network`). A wrong fallback is worse than none — it turns one failure into two.
 *
 * Arc is the exception with one entry: this is the public endpoint, and the server reads Arc through
 * lib/paycmd/arc-rpc.ts, which owns its keyed URL, its process-wide concurrency queue and its own
 * fallback. Do not add Arc endpoints here without going through that module.
 */
export const rpcEndpoints = {
  arcTestnet: [process.env.NEXT_PUBLIC_ARC_RPC_URL?.trim() || "https://rpc.testnet.arc.io"],
  arbitrumSepolia: [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia-rpc.publicnode.com",
  ],
  avalancheFuji: [
    "https://api.avax-test.network/ext/bc/C/rpc",
    "https://avalanche-fuji-c-chain-rpc.publicnode.com",
  ],
  baseSepolia: [
    "https://base-sepolia-rpc.publicnode.com",
    // Kept as a fallback rather than deleted: it is Base's own endpoint, so it is the one most
    // likely to come back, and a fallback is only reached once the primary has already failed.
    "https://sepolia.base.org",
  ],
  sepolia: [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://11155111.rpc.thirdweb.com",
  ],
  hyperEvmTestnet: [
    "https://rpc.hyperliquid-testnet.xyz/evm",
    "https://hyperliquid-testnet.drpc.org",
  ],
  optimismSepolia: [
    "https://sepolia.optimism.io",
    "https://optimism-sepolia-rpc.publicnode.com",
  ],
  polygonAmoy: [
    "https://polygon-amoy-bor-rpc.publicnode.com",
    "https://polygon-amoy.drpc.org",
  ],
  seiAtlantic: ["https://evm-rpc-testnet.sei-apis.com"],
  sonicTestnet: ["https://rpc.testnet.soniclabs.com"],
  unichainSepolia: [
    "https://sepolia.unichain.org",
    "https://unichain-sepolia-rpc.publicnode.com",
  ],
  worldChainSepolia: [
    "https://worldchain-sepolia.g.alchemy.com/public",
    "https://worldchain-sepolia.gateway.tenderly.co",
  ],
} as const satisfies Record<PayCmdChain, readonly [string, ...string[]]>;

/**
 * The endpoint to name when a single URL is all the consumer can take — MetaMask's
 * `wallet_addEthereumChain`, an error message, a host comparison.
 */
export function primaryRpcUrl(chain: PayCmdChain): string {
  return rpcEndpoints[chain][0];
}

/**
 * `retryCount` is the number of extra passes over the *whole* endpoint list, not per endpoint:
 * viem's `fallback` forces `retryCount: 0` on the transports it wraps. Trying the next endpoint is
 * what a retry should have been doing all along — retrying the same dead host cannot succeed, and
 * `-32011: no backend healthy` is not a fault a second identical request clears.
 *
 * `timeout` is per attempt, so the worst case is `timeout × endpoints × (retryCount + 1)`. Callers
 * own that budget: pass `retryCount: 0` when the list already has two endpoints and the route is
 * on a function duration limit.
 *
 * `rank: false` keeps the declared order. Ranking probes every endpoint on an interval, which for
 * a request-scoped client is more traffic to rate-limited public endpoints than it saves.
 */
export function rpcTransport(
  chain: PayCmdChain,
  { timeout, retryCount = 0 }: { timeout: number; retryCount?: number },
): Transport {
  return fallback(
    rpcEndpoints[chain].map((url) => http(url, { timeout })),
    { retryCount, rank: false },
  );
}
