"use client";

import { Check, ChevronDown, Copy, LogOut, ShieldCheck, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAccount, useBalance, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { usePayCmdRuntime } from "@/components/paycmd-runtime";
import { getChainMeta } from "@/components/chain-identity";
import { cctpBridgeChainConfigs } from "@/lib/paycmd/cctp-bridge";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { navigationItems } from "@/lib/paycmd/demo-data";

function formatUsdcBalance(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

function shortenAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatWalletBalance(value?: { formatted: string; symbol: string } | null) {
  if (!value) return "";

  const amount = Number(value.formatted);
  if (!Number.isFinite(amount)) return "";

  const formatted =
    amount > 0 && amount < 0.0001
      ? "<0.0001"
      : new Intl.NumberFormat("en-US", {
          maximumFractionDigits: amount >= 100 ? 2 : 4,
        }).format(amount);

  return `${formatted} ${value.symbol}`;
}

function chainMetaFromId(chainId?: number) {
  const key = cctpBridgeChainConfigs.find((chain) => chain.viemChain.id === chainId)?.key;
  return getChainMeta(key);
}

function ChainDropdownItem({
  chainId,
  name,
  active,
  disabled,
  onSelect,
}: {
  chainId: number;
  name: string;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const meta = chainMetaFromId(chainId);
  const Icon = meta?.Icon ?? ShieldCheck;

  return (
    <DropdownMenuItem disabled={disabled} onClick={onSelect} className="gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        <Icon className="h-4 w-4" size={18} variant="branded" />
      </span>
      <span className="min-w-0 flex-1 truncate">{meta?.label ?? name}</span>
      {active ? <Check className="h-4 w-4 text-primary" /> : null}
    </DropdownMenuItem>
  );
}

export function PayCmdShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState<string>("");
  const { activeCommandCount, unreadCount, unifiedBalance, isBalanceLoading } = usePayCmdRuntime();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { chains, switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { data: walletBalance } = useBalance({
    address,
    chainId,
    query: {
      enabled: Boolean(address && chainId),
      refetchInterval: 15_000,
    },
  });
  const unifiedBalanceLabel =
    unifiedBalance === null ? "-- USDC" : `${formatUsdcBalance(unifiedBalance)} USDC`;
  const activeChain = chains.find((chain) => chain.id === chainId);
  const activeChainMeta = chainMetaFromId(activeChain?.id);
  const ActiveChainIcon = isMounted ? (activeChainMeta?.Icon ?? ShieldCheck) : ShieldCheck;
  const activeChainLabel = isMounted
    ? activeChainMeta?.shortLabel ?? activeChain?.name ?? t("common.selectChain")
    : t("common.selectChain");
  const walletBalanceLabel = isMounted ? formatWalletBalance(walletBalance) : "";
  const accountLabel = isMounted
    ? address
      ? [shortenAddress(address), walletBalanceLabel].filter(Boolean).join(" · ")
      : email || t("common.account")
    : t("common.account");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login?next=/app";
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard?.writeText(address);
    toast.success(t("common.copiedWalletAddress"));
  }

  return (
    <main className="payna-shell-bg h-dvh overflow-hidden text-foreground">
      <div className="fixed right-4 top-4 z-50 hidden items-center gap-2 md:flex">
        {isMounted ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="payna-subtle-lift h-11 gap-2 rounded-2xl border-border/70 bg-card/80 px-3 shadow-lg shadow-black/5 backdrop-blur-xl dark:bg-card/70 dark:shadow-black/25"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground">
                    <ActiveChainIcon className="h-4 w-4" size={18} variant="branded" />
                  </span>
                  <span className="max-w-36 truncate font-semibold">
                    {activeChainLabel}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto overscroll-contain">
                <DropdownMenuLabel>{t("common.switchNetwork")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {chains.map((chain) => (
                  <ChainDropdownItem
                    key={chain.id}
                    chainId={chain.id}
                    name={chain.name}
                    active={chain.id === chainId}
                    disabled={isSwitchingChain || chain.id === chainId}
                    onSelect={() => switchChain({ chainId: chain.id })}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="payna-subtle-lift h-11 gap-2 rounded-2xl border-border/70 bg-card/80 px-3 shadow-lg shadow-black/5 backdrop-blur-xl dark:bg-card/70 dark:shadow-black/25"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400/80 text-white">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <span className="max-w-56 truncate font-semibold">
                    {accountLabel}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>{t("common.account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  <div className="truncate">{email || t("common.signedIn")}</div>
                  {address ? <div className="mt-1 truncate font-mono">{address}</div> : null}
                </div>
                {address ? (
                  <DropdownMenuItem onClick={copyAddress} className="gap-2">
                    <Copy className="h-4 w-4" />
                    {t("common.copyAddress")}
                  </DropdownMenuItem>
                ) : null}
                {isConnected ? (
                  <DropdownMenuItem onClick={() => disconnect()} className="gap-2">
                    <Wallet className="h-4 w-4" />
                    {t("common.disconnectWallet")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Skeleton className="h-11 w-40 rounded-2xl" />
            <Skeleton className="h-11 w-52 rounded-2xl" />
          </>
        )}
      </div>

      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="hidden border-r border-white/5 bg-card/72 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="border-b border-border/60 p-4">
            <Link href="/app" className="flex items-center gap-3">
              <div className="payna-logo-frame relative h-12 w-12 overflow-hidden rounded-2xl border border-emerald-400/30">
                <Image
                  src="/brand/antlers_transparent.png"
                  alt="Payna AI Copilot"
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-normal">Payna</div>
                <div className="text-xs text-muted-foreground">{t("shell.aiCopilot")}</div>
              </div>
            </Link>
          </div>

          <div className="payna-glass m-4 rounded-xl p-3">
            <div className="text-xs text-muted-foreground">{t("common.unifiedBalance")}</div>
            {isBalanceLoading ? (
              <Skeleton className="mt-2 h-7 w-36" />
            ) : (
              <div className="mt-1 text-xl font-semibold">{unifiedBalanceLabel}</div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t("shell.gatewayNetworks")}
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 px-3">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`payna-subtle-lift flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-emerald-500/20"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(`nav.${item.key}`)}</span>
                  {item.key === "notifications" && unreadCount > 0 ? (
                    <Badge className="ml-auto">{unreadCount}</Badge>
                  ) : item.key === "chat" && activeCommandCount > 0 ? (
                    <Badge className="ml-auto">{activeCommandCount}</Badge>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/60 p-3">
            <div className="mb-2 rounded-xl border bg-background/65 px-3 py-2">
              <div className="text-sm font-medium">{t("common.account")}</div>
              <div className="truncate text-xs text-muted-foreground">{email || t("common.signedIn")}</div>
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-background/65 px-3 py-2">
              <div>
                <div className="text-sm font-medium">{t("common.appearance")}</div>
                <div className="text-xs text-muted-foreground">{t("shell.appearanceHelp")}</div>
              </div>
              <div className="flex items-center gap-1">
                {isMounted ? (
                  <>
                    <LanguageSwitcher />
                    <ThemeSwitcher />
                  </>
                ) : (
                  <>
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </>
                )}
              </div>
            </div>
            <Button className="mt-2 w-full justify-start" variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("common.logout")}
            </Button>
          </div>
        </aside>

        <header className="flex items-center justify-between border-b bg-card/84 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="payna-logo-frame relative h-8 w-8 overflow-hidden rounded-xl border border-emerald-400/30">
              <Image src="/brand/antlers_transparent.png" alt="Payna AI Copilot" fill className="object-contain p-0.5" />
            </span>
            Payna
          </Link>
          <div className="flex items-center gap-2">
            {isMounted ? (
              <>
                <ThemeSwitcher />
                <LanguageSwitcher />
              </>
            ) : (
              <>
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </>
            )}
            <Button variant="ghost" size="icon" onClick={logout} aria-label={t("common.logout")}>
              <LogOut className="h-4 w-4" />
            </Button>
            <Badge variant="secondary" className="max-w-[50vw] gap-1 truncate text-[11px]">
              <span className="shrink-0">{t("common.unifiedBalance")}:</span>
              <span className="truncate">{isBalanceLoading ? "..." : unifiedBalanceLabel}</span>
            </Badge>
          </div>
        </header>

        <section className="min-h-0 overflow-hidden">{children}</section>

        <nav
          className="grid border-t bg-card/84 backdrop-blur-xl lg:hidden"
          style={{ gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))` }}
        >
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{t(`nav.${item.key}`)}</span>
                {item.key === "notifications" && unreadCount > 0 ? (
                  <span className="absolute mt-[-28px] ml-7 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
