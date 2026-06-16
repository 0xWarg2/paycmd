"use client";

import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { formatUnits, isAddress } from "viem";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { web3Chains, type PayCmdWeb3Chain } from "@/lib/paycmd/web3-chains";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MetaMaskProviderEvent = "accountsChanged" | "chainChanged";

type MetaMaskProvider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: MetaMaskProviderEvent, handler: (payload: unknown) => void) => void;
  off?: (event: MetaMaskProviderEvent, handler: (payload: unknown) => void) => void;
  removeListener?: (event: MetaMaskProviderEvent, handler: (payload: unknown) => void) => void;
};

type WalletStatus =
  | {
      mode: "connected";
      address: string;
      networkName: string;
      nativeBalance: string | null;
    }
  | {
      mode: "linked";
      address: string;
    };

const chainByHexId = Object.values(web3Chains).reduce<Record<string, PayCmdWeb3Chain>>((chains, chain) => {
  chains[chain.hexChainId.toLowerCase()] = chain;
  return chains;
}, {});

function getMetaMaskProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const provider = (window as Window & { ethereum?: MetaMaskProvider }).ethereum;
  return provider?.request ? provider : null;
}

function normalizeAddress(address: unknown) {
  if (typeof address !== "string") {
    return null;
  }

  const trimmed = address.trim();
  return isAddress(trimmed) ? trimmed.toLowerCase() : null;
}

function normalizeChainId(chainId: unknown) {
  if (typeof chainId === "number") {
    return `0x${chainId.toString(16)}`;
  }

  if (typeof chainId !== "string") {
    return null;
  }

  return chainId.toLowerCase();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function rpcQuantityToBigInt(value: unknown) {
  if (typeof value === "string" && value.startsWith("0x")) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  return 0n;
}

function formatNativeBalance(rawBalance: unknown, chain: PayCmdWeb3Chain | null) {
  const symbol = chain?.nativeCurrency.symbol ?? "native";
  const decimals = chain?.nativeCurrency.decimals ?? 18;
  const value = rpcQuantityToBigInt(rawBalance);

  if (value === 0n) {
    return `0 ${symbol}`;
  }

  const decimalValue = Number(formatUnits(value, decimals));

  if (!Number.isFinite(decimalValue)) {
    return `0 ${symbol}`;
  }

  if (decimalValue > 0 && decimalValue < 0.0001) {
    return `<0.0001 ${symbol}`;
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(decimalValue)} ${symbol}`;
}

async function loadStoredMetaMaskWallet() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [profileResult, walletResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("primary_external_wallet_address")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_external_wallets")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("wallet_type", "metamask")
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    normalizeAddress(profileResult.data?.primary_external_wallet_address) ??
    normalizeAddress(walletResult.data?.wallet_address)
  );
}

export function MetaMaskStatusPills({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<WalletStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    let requestId = 0;

    async function refreshStatus(eventAccounts?: unknown) {
      const currentRequestId = requestId + 1;
      requestId = currentRequestId;

      try {
        const provider = getMetaMaskProvider();
        const storedWalletPromise = loadStoredMetaMaskWallet().catch(() => null);
        let accounts: unknown = [];

        if (Array.isArray(eventAccounts)) {
          accounts = eventAccounts;
        } else if (provider?.request) {
          accounts = await provider.request({ method: "eth_accounts" }).catch(() => []);
        }

        const liveAddress = Array.isArray(accounts) ? normalizeAddress(accounts[0]) : null;
        const storedWallet = await storedWalletPromise;

        if (!isMounted || currentRequestId !== requestId) {
          return;
        }

        if (!provider?.request || !liveAddress) {
          setStatus(storedWallet ? { mode: "linked", address: storedWallet } : null);
          return;
        }

        const [chainIdResult, balanceResult] = await Promise.allSettled([
          provider.request({ method: "eth_chainId" }),
          provider.request({
            method: "eth_getBalance",
            params: [liveAddress, "latest"],
          }),
        ]);

        if (!isMounted || currentRequestId !== requestId) {
          return;
        }

        const chainId =
          chainIdResult.status === "fulfilled" ? normalizeChainId(chainIdResult.value) : null;
        const chain = chainId ? chainByHexId[chainId] ?? null : null;
        const nativeBalance =
          balanceResult.status === "fulfilled" ? formatNativeBalance(balanceResult.value, chain) : null;

        setStatus({
          mode: "connected",
          address: liveAddress,
          networkName: chain?.name ?? "Unknown network",
          nativeBalance,
        });
      } finally {
        if (isMounted && currentRequestId === requestId) {
          setIsLoading(false);
        }
      }
    }

    const provider = getMetaMaskProvider();
    const handleAccountsChanged = (accounts: unknown) => {
      void refreshStatus(accounts);
    };
    const handleChainChanged = () => {
      void refreshStatus();
    };

    provider?.on?.("accountsChanged", handleAccountsChanged);
    provider?.on?.("chainChanged", handleChainChanged);
    void refreshStatus();

    return () => {
      isMounted = false;
      provider?.removeListener?.("accountsChanged", handleAccountsChanged);
      provider?.removeListener?.("chainChanged", handleChainChanged);
      provider?.off?.("accountsChanged", handleAccountsChanged);
      provider?.off?.("chainChanged", handleChainChanged);
    };
  }, []);

  if (isLoading) {
    return (
      <div className={cn("min-w-0", className)} aria-label="Loading MetaMask status">
        <div className="hidden items-center gap-2 md:flex">
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <Skeleton className="h-6 w-24 rounded-md md:hidden" />
      </div>
    );
  }

  if (!status) {
    return null;
  }

  if (status.mode === "linked") {
    return (
      <div className={cn("min-w-0", className)}>
        <Badge variant="outline" className="hidden items-center gap-1.5 whitespace-nowrap md:inline-flex">
          <Wallet className="h-3.5 w-3.5" />
          MetaMask linked
          <span className="font-mono font-medium">{shortAddress(status.address)}</span>
        </Badge>
        <Badge variant="outline" className="inline-flex items-center gap-1.5 whitespace-nowrap md:hidden">
          <Wallet className="h-3.5 w-3.5" />
          <span className="font-mono">{shortAddress(status.address)}</span>
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Badge variant="outline" className="hidden whitespace-nowrap md:inline-flex">
        {status.networkName}
      </Badge>
      {status.nativeBalance ? (
        <Badge variant="outline" className="hidden whitespace-nowrap md:inline-flex">
          {status.nativeBalance}
        </Badge>
      ) : null}
      <Badge variant="outline" className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Wallet className="h-3.5 w-3.5" />
        <span className="font-mono">{shortAddress(status.address)}</span>
      </Badge>
    </div>
  );
}
