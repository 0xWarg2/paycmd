"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import NetworkArc from "@web3icons/react/icons/networks/NetworkArc";
import NetworkAvalancheFuji from "@web3icons/react/icons/networks/NetworkAvalancheFuji";
import NetworkBaseSepolia from "@web3icons/react/icons/networks/NetworkBaseSepolia";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Badge } from "@/components/ui/badge";
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
  key: PayCmdChain;
  label: string;
  shortLabel: string;
  explorerUrl: string;
  nativeSymbol: string;
  Icon: Web3IconComponent;
};

export const payCmdChainMeta: Record<PayCmdChain, PayCmdChainMeta> = {
  arcTestnet: {
    key: "arcTestnet",
    label: web3Chains.arcTestnet.name,
    shortLabel: "Arc",
    explorerUrl: web3Chains.arcTestnet.blockExplorerUrl,
    nativeSymbol: web3Chains.arcTestnet.nativeCurrency.symbol,
    Icon: NetworkArc,
  },
  baseSepolia: {
    key: "baseSepolia",
    label: web3Chains.baseSepolia.name,
    shortLabel: "Base",
    explorerUrl: web3Chains.baseSepolia.blockExplorerUrl,
    nativeSymbol: web3Chains.baseSepolia.nativeCurrency.symbol,
    Icon: NetworkBaseSepolia,
  },
  avalancheFuji: {
    key: "avalancheFuji",
    label: web3Chains.avalancheFuji.name,
    shortLabel: "Avalanche",
    explorerUrl: web3Chains.avalancheFuji.blockExplorerUrl,
    nativeSymbol: web3Chains.avalancheFuji.nativeCurrency.symbol,
    Icon: NetworkAvalancheFuji,
  },
};

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

export function normalizePayCmdChain(chain?: string | null): PayCmdChain | null {
  if (!chain || !isSupportedChain(chain)) {
    return null;
  }

  return chain;
}

export function getChainMeta(chain?: string | null) {
  const normalizedChain = normalizePayCmdChain(chain);
  return normalizedChain ? payCmdChainMeta[normalizedChain] : null;
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
  if (type === "fund") {
    return "metamask";
  }

  if (type === "deposit" || type === "withdraw" || type === "transfer" || type === "unify") {
    return "circle_gateway";
  }

  return "circle_sca";
}

export function inferRailFromCommand(command?: string | null): PayCmdRail {
  if (command === "link" || command === "fund") {
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
