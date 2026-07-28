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

export function normalizeChain(value?: string | null): PayCmdChain | "" {
  const token = (value ?? "").trim().toLowerCase();
  const aliases: Record<string, PayCmdChain> = {
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

  return aliases[token] ?? "";
}

export function isSupportedChain(value: string): value is PayCmdChain {
  return supportedChains.includes(value as PayCmdChain);
}
