import {
  arcTestnet,
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  codexTestnet,
  inkSepolia,
  lineaSepolia,
  monadTestnet,
  optimismSepolia,
  plumeSepolia,
  polygonAmoy,
  seiTestnet,
  sepolia,
  unichainSepolia,
  worldchainSepolia,
  xdcTestnet,
} from "viem/chains";
import { defineChain } from "viem";
import { isSupportedChain } from "@/lib/paycmd/chains";

export const CIRCLE_TESTNET_FAUCET_URL = "https://faucet.circle.com/";

type MetaMaskCompatibleChain = {
  id: number;
  name: string;
  rpcUrls: { default: { http: readonly string[] } };
  blockExplorers?: { default: { url: string } };
  nativeCurrency: { name: string; symbol: string; decimals: number };
};

const edgeTestnet = defineChain({
  id: 33431,
  name: "Edge Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://edge-testnet.g.alchemy.com/public"] },
  },
  blockExplorers: {
    default: { name: "Edge Testnet Explorer", url: "https://edge-testnet.explorer.alchemy.com" },
  },
  testnet: true,
});

const hyperEvmTestnet = defineChain({
  id: 998,
  name: "HyperEVM Testnet",
  nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
  },
  blockExplorers: {
    default: { name: "HyperEVM Testnet Explorer", url: "https://app.hyperliquid-testnet.xyz/explorer" },
  },
  testnet: true,
});

const sonicCircleTestnet = defineChain({
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "Sonic Testnet Explorer", url: "https://testnet.sonicscan.org" },
  },
  testnet: true,
});

export type CctpBridgeMintMode = "auto_forwarding" | "manual_mint";
export type CctpBridgeTransferSpeed = "FAST" | "SLOW";

export type CctpBridgeChainConfig = {
  key: string;
  bridgeKitChain: string;
  label: string;
  shortLabel: string;
  aliases: string[];
  viemChain: MetaMaskCompatibleChain;
};

const bridgeChainConfigs = [
  {
    key: "arcTestnet",
    bridgeKitChain: "Arc_Testnet",
    label: "Arc Testnet",
    shortLabel: "Arc",
    aliases: ["arc", "arc-testnet", "arctestnet"],
    viemChain: arcTestnet,
  },
  {
    key: "arbitrumSepolia",
    bridgeKitChain: "Arbitrum_Sepolia",
    label: "Arbitrum Sepolia",
    shortLabel: "Arbitrum",
    aliases: ["arbitrum", "arbitrum-sepolia", "arbitrumsepolia", "arb", "arb-sepolia"],
    viemChain: arbitrumSepolia,
  },
  {
    key: "avalancheFuji",
    bridgeKitChain: "Avalanche_Fuji",
    label: "Avalanche Fuji",
    shortLabel: "Avalanche",
    aliases: ["avalanche", "avax", "fuji", "avalanche-fuji", "avalanchefuji"],
    viemChain: avalancheFuji,
  },
  {
    key: "baseSepolia",
    bridgeKitChain: "Base_Sepolia",
    label: "Base Sepolia",
    shortLabel: "Base",
    aliases: ["base", "base-sepolia", "basesepolia"],
    viemChain: baseSepolia,
  },
  {
    key: "codexTestnet",
    bridgeKitChain: "Codex_Testnet",
    label: "Codex Testnet",
    shortLabel: "Codex",
    aliases: ["codex", "codex-testnet", "codextestnet"],
    viemChain: codexTestnet,
  },
  {
    key: "edgeTestnet",
    bridgeKitChain: "Edge_Testnet",
    label: "Edge Testnet",
    shortLabel: "Edge",
    aliases: ["edge", "edge-testnet", "edgetestnet"],
    viemChain: edgeTestnet,
  },
  {
    key: "ethereumSepolia",
    bridgeKitChain: "Ethereum_Sepolia",
    label: "Ethereum Sepolia",
    shortLabel: "Ethereum",
    aliases: ["ethereum", "eth", "sepolia", "ethereum-sepolia", "ethereumsepolia"],
    viemChain: sepolia,
  },
  {
    key: "hyperEvmTestnet",
    bridgeKitChain: "HyperEVM_Testnet",
    label: "HyperEVM Testnet",
    shortLabel: "HyperEVM",
    aliases: ["hyper", "hyperevm", "hyper-evm", "hyperevm-testnet", "hyper-evm-testnet"],
    viemChain: hyperEvmTestnet,
  },
  {
    key: "inkTestnet",
    bridgeKitChain: "Ink_Testnet",
    label: "Ink Sepolia",
    shortLabel: "Ink",
    aliases: ["ink", "ink-sepolia", "inktestnet", "ink-testnet"],
    viemChain: inkSepolia,
  },
  {
    key: "lineaSepolia",
    bridgeKitChain: "Linea_Sepolia",
    label: "Linea Sepolia",
    shortLabel: "Linea",
    aliases: ["linea", "linea-sepolia", "lineasepolia"],
    viemChain: lineaSepolia,
  },
  {
    key: "monadTestnet",
    bridgeKitChain: "Monad_Testnet",
    label: "Monad Testnet",
    shortLabel: "Monad",
    aliases: ["monad", "monad-testnet", "monadtestnet"],
    viemChain: monadTestnet,
  },
  {
    key: "optimismSepolia",
    bridgeKitChain: "Optimism_Sepolia",
    label: "OP Sepolia",
    shortLabel: "OP",
    aliases: ["optimism", "op", "op-sepolia", "optimism-sepolia", "optimismsepolia"],
    viemChain: optimismSepolia,
  },
  {
    key: "plumeTestnet",
    bridgeKitChain: "Plume_Testnet",
    label: "Plume Testnet",
    shortLabel: "Plume",
    aliases: ["plume", "plume-testnet", "plumetestnet"],
    viemChain: plumeSepolia,
  },
  {
    key: "polygonAmoy",
    bridgeKitChain: "Polygon_Amoy_Testnet",
    label: "Polygon Amoy",
    shortLabel: "Polygon",
    aliases: ["polygon", "amoy", "polygon-amoy", "polygonamoy"],
    viemChain: polygonAmoy,
  },
  {
    key: "seiTestnet",
    bridgeKitChain: "Sei_Testnet",
    label: "Sei Testnet",
    shortLabel: "Sei",
    aliases: ["sei", "sei-testnet", "seitestnet"],
    viemChain: seiTestnet,
  },
  {
    key: "sonicTestnet",
    bridgeKitChain: "Sonic_Testnet",
    label: "Sonic Testnet",
    shortLabel: "Sonic",
    aliases: ["sonic", "sonic-testnet", "sonictestnet"],
    viemChain: sonicCircleTestnet,
  },
  {
    key: "unichainSepolia",
    bridgeKitChain: "Unichain_Sepolia",
    label: "Unichain Sepolia",
    shortLabel: "Unichain",
    aliases: ["unichain", "unichain-sepolia", "unichainsepolia"],
    viemChain: unichainSepolia,
  },
  {
    key: "worldChainSepolia",
    bridgeKitChain: "World_Chain_Sepolia",
    label: "World Chain Sepolia",
    shortLabel: "World",
    aliases: ["world", "worldchain", "world-chain", "world-chain-sepolia", "worldchainsepolia"],
    viemChain: worldchainSepolia,
  },
  {
    key: "xdcApothem",
    bridgeKitChain: "XDC_Apothem",
    label: "Apothem Network",
    shortLabel: "XDC",
    aliases: ["xdc", "apothem", "xdc-apothem", "xdcapothem"],
    viemChain: xdcTestnet,
  },
] as const satisfies readonly CctpBridgeChainConfig[];

export type CctpBridgeChainKey = (typeof bridgeChainConfigs)[number]["key"];

export const cctpBridgeChainConfigs = bridgeChainConfigs;
export const cctpBridgeViemChains = bridgeChainConfigs.map((config) => config.viemChain) as [
  (typeof bridgeChainConfigs)[number]["viemChain"],
  ...(typeof bridgeChainConfigs)[number]["viemChain"][],
];

export const cctpBridgeChainMap = Object.fromEntries(
  bridgeChainConfigs.map((config) => [config.key, config]),
) as unknown as Record<CctpBridgeChainKey, CctpBridgeChainConfig>;

const cctpChainAliasMap = Object.fromEntries(
  bridgeChainConfigs.flatMap((config) => config.aliases.map((alias) => [alias, config.key])),
) as Record<string, CctpBridgeChainKey>;

const bridgeKitChainMap = Object.fromEntries(
  bridgeChainConfigs.map((config) => [config.bridgeKitChain, config]),
) as Record<string, CctpBridgeChainConfig>;

let supportedBridgeChainsPromise: Promise<CctpBridgeRuntimeChain[]> | null = null;

export type CctpBridgeRuntimeChain = CctpBridgeChainConfig & {
  canForwardToDestination: boolean;
  canFastFromSource: boolean;
  // Taken from the BridgeKit chain definition so balance checks never have to
  // re-derive the address from a second table with different chain keys.
  usdcAddress: `0x${string}`;
};

export function normalizeCctpBridgeChain(value?: string | null): CctpBridgeChainKey | "" {
  const token = (value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  return cctpChainAliasMap[token] ?? "";
}

export function isCctpBridgeChain(value: string): value is CctpBridgeChainKey {
  return value in cctpBridgeChainMap;
}

export function isKnownTestnetChain(value?: string | null) {
  // Union of both key spaces: the bridge rail uses `ethereumSepolia`/`seiTestnet` while the
  // Gateway rail uses `sepolia`/`seiAtlantic`, and a faucet hint is worth showing for either.
  return Boolean(value && (isCctpBridgeChain(value) || isSupportedChain(value)));
}

export function faucetHint(chain?: string | null) {
  if (!isKnownTestnetChain(chain)) {
    return "";
  }

  return `Need testnet funds? Circle Faucet: ${CIRCLE_TESTNET_FAUCET_URL}`;
}

export function bridgeModeFrom(input: string): CctpBridgeMintMode {
  return /\b(manual(?:\s+mint)?|manual\s+gas|no\s+forwarding|without\s+forwarding)\b/i.test(input)
    ? "manual_mint"
    : "auto_forwarding";
}

export function bridgeSpeedFrom(input: string): CctpBridgeTransferSpeed {
  return /\b(slow|standard)\b/i.test(input) ? "SLOW" : "FAST";
}

export async function getSupportedCctpBridgeChains() {
  if (!supportedBridgeChainsPromise) {
    supportedBridgeChainsPromise = loadSupportedCctpBridgeChains();
  }

  return supportedBridgeChainsPromise;
}

async function loadSupportedCctpBridgeChains() {
  const { BridgeKit } = await import("@circle-fin/bridge-kit");
  const kit = new BridgeKit();
  const supported = kit.getSupportedChains();

  return supported
    .filter((chain: any) => chain?.isTestnet && chain?.type === "evm" && chain?.cctp?.contracts?.v2)
    .map((chain: any) => {
      const config = bridgeKitChainMap[chain.chain];
      if (!config || !chain?.usdcAddress) return null;

      return {
        ...config,
        canFastFromSource: Boolean(chain?.cctp?.forwarderSupported?.source ?? chain?.cctp?.contracts?.v2?.fastConfirmations),
        canForwardToDestination: Boolean(chain?.cctp?.forwarderSupported?.destination),
        usdcAddress: chain.usdcAddress as `0x${string}`,
      } satisfies CctpBridgeRuntimeChain;
    })
    .filter((chain): chain is CctpBridgeRuntimeChain => Boolean(chain))
    .sort((left, right) => left.label.localeCompare(right.label));
}
