export const supportedChains = [
  "arcTestnet",
  "arbitrumSepolia",
  "avalancheFuji",
  "baseSepolia",
  "sepolia",
  "hyperEvmTestnet",
  "optimismSepolia",
  "polygonAmoy",
  "seiAtlantic",
  "sonicTestnet",
  "unichainSepolia",
  "worldChainSepolia",
] as const;

export type PayCmdChain = (typeof supportedChains)[number];

// Module scope so the AI command prompt can advertise the same aliases this function
// accepts, instead of hardcoding its own shorter list that drifts out of sync.
export const chainAliases: Record<string, PayCmdChain> = {
    arc: "arcTestnet",
    arctestnet: "arcTestnet",
    "arc-testnet": "arcTestnet",
    arbitrum: "arbitrumSepolia",
    arb: "arbitrumSepolia",
    arbitrumsepolia: "arbitrumSepolia",
    "arbitrum-sepolia": "arbitrumSepolia",
    "arb-sepolia": "arbitrumSepolia",
    base: "baseSepolia",
    basesepolia: "baseSepolia",
    "base-sepolia": "baseSepolia",
    ethereum: "sepolia",
    eth: "sepolia",
    sepolia: "sepolia",
    ethereumsepolia: "sepolia",
    "ethereum-sepolia": "sepolia",
    avalanche: "avalancheFuji",
    avax: "avalancheFuji",
    fuji: "avalancheFuji",
    avalanchefuji: "avalancheFuji",
    "avalanche-fuji": "avalancheFuji",
    hyper: "hyperEvmTestnet",
    hyperevm: "hyperEvmTestnet",
    "hyper-evm": "hyperEvmTestnet",
    hyperevmtestnet: "hyperEvmTestnet",
    "hyperevm-testnet": "hyperEvmTestnet",
    optimism: "optimismSepolia",
    op: "optimismSepolia",
    optimismsepolia: "optimismSepolia",
    "optimism-sepolia": "optimismSepolia",
    "op-sepolia": "optimismSepolia",
    polygon: "polygonAmoy",
    amoy: "polygonAmoy",
    polygonamoy: "polygonAmoy",
    "polygon-amoy": "polygonAmoy",
    sei: "seiAtlantic",
    seiatlantic: "seiAtlantic",
    "sei-atlantic": "seiAtlantic",
    sonic: "sonicTestnet",
    sonictestnet: "sonicTestnet",
    "sonic-testnet": "sonicTestnet",
    unichain: "unichainSepolia",
    unichainsepolia: "unichainSepolia",
    "unichain-sepolia": "unichainSepolia",
    world: "worldChainSepolia",
    worldchain: "worldChainSepolia",
    "world-chain": "worldChainSepolia",
    worldchainsepolia: "worldChainSepolia",
  "world-chain-sepolia": "worldChainSepolia",
};

/**
 * Reverse of chainAliases: the shortest alias is what users actually type, so it is what a
 * suggested or retry command should echo back.
 *
 * Two API routes each carried a hand-written ternary here that returned "avalanche" for every
 * chain that was not arc or base, so a retry hint on the other 9 chains pointed at the wrong
 * chain. Deriving it guarantees the alias round-trips back through normalizeChain.
 */
const shortestAliasByChain = supportedChains.reduce(
  (acc, chain) => {
    const aliases = Object.keys(chainAliases).filter((alias) => chainAliases[alias] === chain);
    acc[chain] = aliases.sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? chain;
    return acc;
  },
  {} as Record<PayCmdChain, string>,
);

export function chainCommandAlias(chain: PayCmdChain): string {
  return shortestAliasByChain[chain] ?? chain;
}

export function normalizeChain(value?: string | null): PayCmdChain | "" {
  const token = (value ?? "").trim().toLowerCase();
  return chainAliases[token] ?? "";
}

export function isSupportedChain(value: string): value is PayCmdChain {
  return supportedChains.includes(value as PayCmdChain);
}
