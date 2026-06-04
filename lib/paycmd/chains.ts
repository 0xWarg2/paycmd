export const supportedChains = ["arcTestnet", "baseSepolia", "avalancheFuji"] as const;

export type PayCmdChain = (typeof supportedChains)[number];

export function normalizeChain(value?: string | null): PayCmdChain | "" {
  const token = (value ?? "").trim().toLowerCase();
  const aliases: Record<string, PayCmdChain> = {
    arc: "arcTestnet",
    arctestnet: "arcTestnet",
    "arc-testnet": "arcTestnet",
    base: "baseSepolia",
    basesepolia: "baseSepolia",
    "base-sepolia": "baseSepolia",
    avalanche: "avalancheFuji",
    avax: "avalancheFuji",
    fuji: "avalancheFuji",
    avalanchefuji: "avalancheFuji",
    "avalanche-fuji": "avalancheFuji",
  };

  return aliases[token] ?? "";
}

export function isSupportedChain(value: string): value is PayCmdChain {
  return supportedChains.includes(value as PayCmdChain);
}
