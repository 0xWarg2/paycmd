"use client";

import { ChevronRight, ExternalLink, Orbit } from "lucide-react";
import NetworkArbitrumSepolia from "@web3icons/react/icons/networks/NetworkArbitrumSepolia";
import NetworkArc from "@web3icons/react/icons/networks/NetworkArc";
import NetworkAvalancheFuji from "@web3icons/react/icons/networks/NetworkAvalancheFuji";
import NetworkBaseSepolia from "@web3icons/react/icons/networks/NetworkBaseSepolia";
import NetworkCodex from "@web3icons/react/icons/networks/NetworkCodex";
import NetworkEdgeless from "@web3icons/react/icons/networks/NetworkEdgeless";
import NetworkEthereum from "@web3icons/react/icons/networks/NetworkEthereum";
import NetworkHyperEvm from "@web3icons/react/icons/networks/NetworkHyperEvm";
import NetworkInk from "@web3icons/react/icons/networks/NetworkInk";
import NetworkLineaSepolia from "@web3icons/react/icons/networks/NetworkLineaSepolia";
import NetworkMonadTestnet from "@web3icons/react/icons/networks/NetworkMonadTestnet";
import NetworkOptimismSepolia from "@web3icons/react/icons/networks/NetworkOptimismSepolia";
import NetworkPlume from "@web3icons/react/icons/networks/NetworkPlume";
import NetworkPolygonAmoy from "@web3icons/react/icons/networks/NetworkPolygonAmoy";
import NetworkSeiNetwork from "@web3icons/react/icons/networks/NetworkSeiNetwork";
import NetworkSonic from "@web3icons/react/icons/networks/NetworkSonic";
import NetworkUnichain from "@web3icons/react/icons/networks/NetworkUnichain";
import NetworkWorld from "@web3icons/react/icons/networks/NetworkWorld";
import NetworkXdcNetwork from "@web3icons/react/icons/networks/NetworkXdcNetwork";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cctpBridgeChainMap, type CctpBridgeChainKey } from "@/lib/paycmd/cctp-bridge";
import { isSupportedChain, type PayCmdChain } from "@/lib/paycmd/chains";
import { web3Chains } from "@/lib/paycmd/web3-chains";
import { cn } from "@/lib/utils";

type Web3IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: string | number;
    variant?: "branded" | "mono" | "background";
  }
>;

export type PayCmdRail = "metamask" | "circle_sca" | "circle_gateway";

export type PayCmdChainMeta = {
  key: string;
  label: string;
  shortLabel: string;
  explorerUrl: string;
  nativeSymbol: string;
  Icon: Web3IconComponent;
};

function GenericChainIcon({
  size = 18,
  className,
}: SVGProps<SVGSVGElement> & {
  size?: string | number;
  variant?: "branded" | "mono" | "background";
}) {
  return <Orbit aria-hidden="true" className={className} size={size} />;
}

export const payCmdChainMeta: Record<PayCmdChain, PayCmdChainMeta> = {
  arcTestnet: {
    key: "arcTestnet",
    label: web3Chains.arcTestnet.name,
    shortLabel: "Arc",
    explorerUrl: web3Chains.arcTestnet.blockExplorerUrl,
    nativeSymbol: web3Chains.arcTestnet.nativeCurrency.symbol,
    Icon: NetworkArc,
  },
  arbitrumSepolia: {
    key: "arbitrumSepolia",
    label: web3Chains.arbitrumSepolia.name,
    shortLabel: "Arbitrum",
    explorerUrl: web3Chains.arbitrumSepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.arbitrumSepolia.nativeCurrency.symbol,
    Icon: NetworkArbitrumSepolia,
  },
  baseSepolia: {
    key: "baseSepolia",
    label: web3Chains.baseSepolia.name,
    shortLabel: "Base",
    explorerUrl: web3Chains.baseSepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.baseSepolia.nativeCurrency.symbol,
    Icon: NetworkBaseSepolia,
  },
  sepolia: {
    key: "sepolia",
    label: web3Chains.sepolia.name,
    shortLabel: "Ethereum",
    explorerUrl: web3Chains.sepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.sepolia.nativeCurrency.symbol,
    Icon: NetworkEthereum,
  },
  avalancheFuji: {
    key: "avalancheFuji",
    label: web3Chains.avalancheFuji.name,
    shortLabel: "Avalanche",
    explorerUrl: web3Chains.avalancheFuji.blockExplorerUrl,
    nativeSymbol: web3Chains.avalancheFuji.nativeCurrency.symbol,
    Icon: NetworkAvalancheFuji,
  },
  hyperEvmTestnet: {
    key: "hyperEvmTestnet",
    label: web3Chains.hyperEvmTestnet.name,
    shortLabel: "HyperEVM",
    explorerUrl: web3Chains.hyperEvmTestnet.blockExplorerUrl,
    nativeSymbol: web3Chains.hyperEvmTestnet.nativeCurrency.symbol,
    Icon: NetworkHyperEvm,
  },
  optimismSepolia: {
    key: "optimismSepolia",
    label: web3Chains.optimismSepolia.name,
    shortLabel: "OP",
    explorerUrl: web3Chains.optimismSepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.optimismSepolia.nativeCurrency.symbol,
    Icon: NetworkOptimismSepolia,
  },
  polygonAmoy: {
    key: "polygonAmoy",
    label: web3Chains.polygonAmoy.name,
    shortLabel: "Polygon",
    explorerUrl: web3Chains.polygonAmoy.blockExplorerUrl,
    nativeSymbol: web3Chains.polygonAmoy.nativeCurrency.symbol,
    Icon: NetworkPolygonAmoy,
  },
  seiAtlantic: {
    key: "seiAtlantic",
    label: web3Chains.seiAtlantic.name,
    shortLabel: "Sei",
    explorerUrl: web3Chains.seiAtlantic.blockExplorerUrl,
    nativeSymbol: web3Chains.seiAtlantic.nativeCurrency.symbol,
    Icon: NetworkSeiNetwork,
  },
  sonicTestnet: {
    key: "sonicTestnet",
    label: web3Chains.sonicTestnet.name,
    shortLabel: "Sonic",
    explorerUrl: web3Chains.sonicTestnet.blockExplorerUrl,
    nativeSymbol: web3Chains.sonicTestnet.nativeCurrency.symbol,
    Icon: NetworkSonic,
  },
  unichainSepolia: {
    key: "unichainSepolia",
    label: web3Chains.unichainSepolia.name,
    shortLabel: "Unichain",
    explorerUrl: web3Chains.unichainSepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.unichainSepolia.nativeCurrency.symbol,
    Icon: NetworkUnichain,
  },
  worldChainSepolia: {
    key: "worldChainSepolia",
    label: web3Chains.worldChainSepolia.name,
    shortLabel: "World",
    explorerUrl: web3Chains.worldChainSepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.worldChainSepolia.nativeCurrency.symbol,
    Icon: NetworkWorld,
  },
};

const cctpBridgeChainMeta = Object.fromEntries(
  Object.values(cctpBridgeChainMap).map((config) => [
    config.key,
    {
      key: config.key,
      label: config.label,
      shortLabel: config.shortLabel,
      explorerUrl: config.viemChain.blockExplorers?.default.url ?? "",
      nativeSymbol: config.viemChain.nativeCurrency.symbol,
      Icon:
        config.key === "arcTestnet"
          ? NetworkArc
          : config.key === "arbitrumSepolia"
            ? NetworkArbitrumSepolia
            : config.key === "avalancheFuji"
              ? NetworkAvalancheFuji
              : config.key === "baseSepolia"
                ? NetworkBaseSepolia
                : config.key === "codexTestnet"
                  ? NetworkCodex
                  : config.key === "edgeTestnet"
                    ? NetworkEdgeless
                    : config.key === "ethereumSepolia"
                      ? NetworkEthereum
                      : config.key === "hyperEvmTestnet"
                        ? NetworkHyperEvm
                        : config.key === "inkTestnet"
                          ? NetworkInk
                          : config.key === "lineaSepolia"
                            ? NetworkLineaSepolia
                            : config.key === "monadTestnet"
                              ? NetworkMonadTestnet
                              : config.key === "optimismSepolia"
                                ? NetworkOptimismSepolia
                                : config.key === "plumeTestnet"
                                  ? NetworkPlume
                                  : config.key === "polygonAmoy"
                                    ? NetworkPolygonAmoy
                                    : config.key === "seiTestnet"
                                      ? NetworkSeiNetwork
                                      : config.key === "sonicTestnet"
                                        ? NetworkSonic
                                        : config.key === "unichainSepolia"
                                          ? NetworkUnichain
                                          : config.key === "worldChainSepolia"
                                            ? NetworkWorld
                                            : config.key === "xdcApothem"
                                              ? NetworkXdcNetwork
                                              : GenericChainIcon,
    } satisfies PayCmdChainMeta,
  ]),
) as Record<CctpBridgeChainKey, PayCmdChainMeta>;

const railLabels: Record<PayCmdRail, string> = {
  metamask: "MetaMask",
  circle_sca: "Circle SCA",
  circle_gateway: "Circle Gateway",
};

const railClassNames: Record<PayCmdRail, string> = {
  metamask: "border-orange-400/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  circle_sca: "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  circle_gateway: "border-primary/30 bg-primary/10 text-primary",
};

function normalizeChainLookupValue(chain?: string | null) {
  return (chain ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");
}

function resolveChainKey(chain?: string | null) {
  if (!chain) {
    return null;
  }

  if (isSupportedChain(chain)) {
    return chain;
  }

  if (chain in cctpBridgeChainMeta) {
    return chain as CctpBridgeChainKey;
  }

  const lookup = normalizeChainLookupValue(chain);
  const payCmdMatch = Object.values(payCmdChainMeta).find(
    (meta) =>
      normalizeChainLookupValue(meta.key) === lookup ||
      normalizeChainLookupValue(meta.label) === lookup ||
      normalizeChainLookupValue(meta.shortLabel) === lookup,
  );

  if (payCmdMatch) {
    return payCmdMatch.key;
  }

  const cctpMatch = Object.values(cctpBridgeChainMap).find(
    (config) =>
      normalizeChainLookupValue(config.key) === lookup ||
      normalizeChainLookupValue(config.label) === lookup ||
      normalizeChainLookupValue(config.shortLabel) === lookup ||
      config.aliases.some((alias) => normalizeChainLookupValue(alias) === lookup),
  );

  return cctpMatch?.key ?? null;
}

export function normalizePayCmdChain(chain?: string | null): PayCmdChain | null {
  if (!chain || !isSupportedChain(chain)) {
    return null;
  }

  return chain;
}

export function getChainMeta(chain?: string | null) {
  const key = resolveChainKey(chain);

  if (!key) {
    return null;
  }

  if (isSupportedChain(key)) {
    return payCmdChainMeta[key];
  }

  if (key in cctpBridgeChainMeta) {
    return cctpBridgeChainMeta[key as CctpBridgeChainKey];
  }

  return null;
}

export function getExplorerTxUrl(chain?: string | null, txHash?: string | null) {
  const meta = getChainMeta(chain);
  const hash = txHash?.trim();

  if (!meta || !hash) {
    return null;
  }

  return `${meta.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}

export function getTransactionExplorerChain(transaction: {
  tx_type?: string | null;
  chain?: string | null;
  destination_chain?: string | null;
}) {
  if (transaction.tx_type === "transfer" && transaction.destination_chain) {
    return transaction.destination_chain;
  }

  return transaction.chain ?? null;
}

export function inferRailFromTransactionType(type?: string | null): PayCmdRail {
  if (type === "fund" || type === "bridge" || type === "swap") {
    return "metamask";
  }

  if (type === "deposit" || type === "withdraw" || type === "transfer" || type === "unify") {
    return "circle_gateway";
  }

  return "circle_sca";
}

export function inferRailFromCommand(command?: string | null): PayCmdRail {
  if (command === "link" || command === "fund" || command === "bridge" || command === "swap") {
    return "metamask";
  }

  if (command === "deposit" || command === "withdraw" || command === "transfer" || command === "pay" || command === "payroll") {
    return "circle_gateway";
  }

  return "circle_sca";
}

export function truncateHash(hash?: string | null) {
  if (!hash) {
    return "No tx hash";
  }

  return hash.length > 14 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
}

export function ChainIcon({
  chain,
  className,
  size = 18,
}: {
  chain?: string | null;
  className?: string;
  size?: number;
}) {
  const meta = getChainMeta(chain);

  if (!meta) {
    return (
      <span
        className={cn("inline-flex rounded-full bg-muted", className)}
        style={{ height: size, width: size }}
      />
    );
  }

  const Icon = meta.Icon;
  return <Icon aria-hidden="true" className={className} size={size} variant="branded" />;
}

export function ChainBadge({
  chain,
  className,
  compact = false,
}: {
  chain?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const meta = getChainMeta(chain);
  const label = meta ? (compact ? meta.shortLabel : meta.label) : chain || "Unknown chain";

  return (
    <Badge
      variant="outline"
      className={cn("inline-flex max-w-full items-center gap-1.5 whitespace-nowrap px-2 py-1 font-medium", className)}
    >
      <ChainIcon chain={chain} size={16} />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function ChainRoute({
  sourceChain,
  destinationChain,
  compact = false,
  className,
}: {
  sourceChain?: string | null;
  destinationChain?: string | null;
  compact?: boolean;
  className?: string;
}) {
  if (!destinationChain || destinationChain === sourceChain) {
    return <ChainBadge chain={sourceChain} compact={compact} className={className} />;
  }

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      <ChainBadge chain={sourceChain} compact={compact} />
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <ChainBadge chain={destinationChain} compact={compact} />
    </div>
  );
}

export function RailBadge({
  rail,
  className,
  children,
}: {
  rail: PayCmdRail;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1 font-medium", railClassNames[rail], className)}
    >
      {children ?? railLabels[rail]}
    </Badge>
  );
}

export function ExplorerTxLink({
  chain,
  txHash,
  compact = false,
  className,
}: {
  chain?: string | null;
  txHash?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const href = getExplorerTxUrl(chain, txHash);

  if (!txHash) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No tx hash</span>;
  }

  if (!href) {
    return (
      <span className={cn("break-all font-mono text-xs text-muted-foreground", className)}>
        {compact ? truncateHash(txHash) : txHash}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 font-mono text-xs font-medium text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      <span className={cn(compact ? "truncate" : "break-all")}>
        {compact ? truncateHash(txHash) : txHash}
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}
