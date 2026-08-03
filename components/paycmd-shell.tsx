"use client";

import {
  Activity,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Contact,
  Copy,
  Gauge,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  ShieldCheck,
  UserCircle,
  Wallet,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { usePayCmdRuntime } from "@/components/paycmd-runtime";
import { getChainMeta } from "@/components/chain-identity";
import { cctpBridgeChainConfigs } from "@/lib/paycmd/cctp-bridge";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { navigationFor, type AppNavigationItem } from "@/lib/paycmd/ui-models";

const navIcons = {
  chat: MessageCircle,
  activity: Activity,
  budgets: Gauge,
  contacts: Contact,
  schedules: CalendarClock,
  profile: UserCircle,
  more: MoreHorizontal,
};

const desktopNavigation = navigationFor("desktop");
const mobileNavigation = navigationFor("mobile-primary");
const mobileMoreNavigation = navigationFor("mobile-more");

function navIsActive(pathname: string, item: AppNavigationItem) {
  if (!item.href) return false;
  if (item.key === "activity") {
    return pathname === "/activity" || pathname === "/notifications" || pathname.startsWith("/dashboard/history");
  }
  return pathname === item.href;
}

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

export function PayCmdShell({ children, sidebarPanel }: { children: ReactNode; sidebarPanel?: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState<string>("");
  const {
    activeCommandCount,
    unreadCount,
    unifiedBalance,
    unifiedBalanceFailedChains,
    isBalanceLoading,
    pendingGatewayDepositCount,
  } = usePayCmdRuntime();
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
  // With any unreadable chain the total is a floor, so it is prefixed with "≥" rather than
  // shown as an exact figure. Silently rounding down is how a user ends up trusting a number
  // that is missing whole chains worth of USDC.
  const isBalancePartial = unifiedBalanceFailedChains.length > 0;
  const unifiedBalanceLabel =
    unifiedBalance === null
      ? "-- USDC"
      : `${isBalancePartial ? "≥ " : ""}${formatUsdcBalance(unifiedBalance)} USDC`;
  // Split One/Many rather than interpolating a count into one string, matching
  // `runtime.gatewayDepositReadyOne`/`…Many` — English needs "1 deposit" but "2 deposits".
  const gatewayDepositsPendingLabel =
    pendingGatewayDepositCount === 1
      ? t("shell.gatewayDepositsPendingOne")
      : t("shell.gatewayDepositsPendingMany", { count: pendingGatewayDepositCount });
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
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(address);
      toast.success(t("common.copiedWalletAddress"));
    } catch {
      toast.error(t("common.copyWalletAddressFailed"));
    }
  }

  const desktopToolbar = (
    <header className="hidden min-h-16 items-center justify-end gap-1.5 border-b border-border/55 bg-surface/88 px-5 backdrop-blur-xl lg:flex">
        {isMounted ? (
          <>
            <Badge
              variant={pendingGatewayDepositCount > 0 ? "waiting" : "success"}
              className="h-9 gap-1.5 px-3"
            >
              {pendingGatewayDepositCount > 0 ? <Clock3 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {pendingGatewayDepositCount > 0 ? gatewayDepositsPendingLabel : t("shell.systemReady")}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 rounded-xl border-transparent bg-transparent px-2.5 shadow-none hover:border-border hover:bg-accent/60"
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
                  className="h-10 gap-2 rounded-xl border-transparent bg-transparent px-2.5 shadow-none hover:border-border hover:bg-accent/60"
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
    </header>
  );

  return (
    <main className="command-center-canvas relative h-dvh overflow-hidden text-foreground">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-[64px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/55 bg-surface/88 backdrop-blur-xl lg:row-span-2 lg:flex lg:flex-col">
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

          <div className="command-panel m-4 rounded-2xl p-4">
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
            {/* Circle finality runs ~10 minutes after a deposit's transaction lands. A toast is
                long gone by then, so the wait needs a surface that persists. Amber + Clock3
                matches the "waiting" bucket on /notifications. */}
            {pendingGatewayDepositCount > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <Clock3 className="h-4 w-4 shrink-0" />
                <span>{gatewayDepositsPendingLabel}</span>
              </div>
            ) : null}
          </div>

          <nav aria-label="Primary navigation" className={`space-y-1 px-3 ${sidebarPanel ? "shrink-0" : "flex-1"}`}>
            {desktopNavigation.map((item) => {
              const isActive = navIsActive(pathname, item);
              const Icon = navIcons[item.key];

              return (
                <Link
                  key={item.key}
                  href={item.href ?? "/app"}
                  aria-current={isActive ? "page" : undefined}
                  className={`payna-subtle-lift flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${
                    isActive
                      ? "bg-primary/12 text-primary ring-1 ring-inset ring-primary/20"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(`nav.${item.key}`)}</span>
                  {item.key === "activity" && unreadCount > 0 ? (
                    <Badge className="ml-auto rounded-full">{unreadCount}</Badge>
                  ) : item.key === "chat" && activeCommandCount > 0 ? (
                    <Badge className="ml-auto">{activeCommandCount}</Badge>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {sidebarPanel ? <div className="mt-2 flex min-h-0 flex-1 flex-col px-3 pb-2">{sidebarPanel}</div> : null}

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

        {desktopToolbar}

        <header className="flex min-h-16 items-center justify-between border-b border-border/55 bg-surface/88 px-4 py-2 backdrop-blur-xl lg:hidden">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="payna-logo-frame relative h-8 w-8 overflow-hidden rounded-xl border border-emerald-400/30">
              <Image src="/brand/antlers_transparent.png" alt="Payna AI Copilot" fill className="object-contain p-0.5" />
            </span>
            Payna
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {/* Same signal as the sidebar card, which is hidden on mobile. Kept to icon + count
                because this row is already crowded; the full sentence rides on the label so
                screen readers and long-press still get it. */}
            {pendingGatewayDepositCount > 0 ? (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-amber-500/40 text-[11px] text-amber-600 dark:text-amber-400"
                title={gatewayDepositsPendingLabel}
                aria-label={gatewayDepositsPendingLabel}
              >
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                {pendingGatewayDepositCount}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="max-w-[46vw] gap-1 truncate rounded-full text-[11px]">
              <span className="truncate">{isBalanceLoading ? "..." : unifiedBalanceLabel}</span>
            </Badge>
          </div>
        </header>

        <section className="min-h-0 overflow-hidden lg:col-start-2 lg:row-start-2">{children}</section>

        <nav aria-label="Mobile navigation" className="grid grid-cols-4 border-t border-border/65 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          {mobileNavigation.map((item) => {
            const isActive = navIsActive(pathname, item);
            const Icon = navIcons[item.key];
            const content = (
              <>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{t(`nav.${item.key}`)}</span>
                {item.key === "activity" && unreadCount > 0 ? (
                  <span className="absolute right-[calc(50%-20px)] top-1.5 rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
                    {unreadCount}
                  </span>
                ) : null}
              </>
            );

            if (item.key === "more") {
              return (
                <Dialog key={item.key}>
                  <DialogTrigger asChild>
                    <button type="button" className="relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] text-muted-foreground">
                      {content}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="command-panel inset-x-2 bottom-2 top-auto max-w-none translate-x-0 translate-y-0 gap-0 rounded-3xl p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2" showCloseButton>
                    <DialogHeader className="border-b border-border/60 p-5 pr-12 text-left">
                      <DialogTitle>{t("shell.moreTitle")}</DialogTitle>
                      <DialogDescription>{t("shell.moreDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="rounded-xl border bg-background/60 p-3 text-left">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("shell.network")}</div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-sm font-semibold">
                                <span className="truncate">{activeChainLabel}</span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              </div>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
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
                        <div className="rounded-xl border bg-background/60 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("common.account")}</div>
                          <div className="mt-1 truncate text-sm font-semibold">{accountLabel}</div>
                        </div>
                      </div>
                      {address ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="h-11 justify-start rounded-xl" onClick={() => void copyAddress()}>
                            <Copy className="h-4 w-4" aria-hidden="true" /> {t("common.copyAddress")}
                          </Button>
                          {isConnected ? (
                            <Button type="button" variant="outline" className="h-11 justify-start rounded-xl" onClick={() => disconnect()}>
                              <Wallet className="h-4 w-4" aria-hidden="true" /> {t("common.disconnectWallet")}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        {mobileMoreNavigation.map((moreItem) => {
                          const MoreIcon = navIcons[moreItem.key];
                          return (
                            <Link key={moreItem.key} href={moreItem.href ?? "/app"} className="flex min-h-11 items-center gap-3 rounded-xl border bg-background/55 px-3 text-sm font-medium">
                              <MoreIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                              {t(`nav.${moreItem.key}`)}
                            </Link>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between rounded-xl border bg-background/55 px-3 py-2">
                        <span className="text-sm font-medium">{t("common.appearance")}</span>
                        <div className="flex items-center gap-1"><LanguageSwitcher /><ThemeSwitcher /></div>
                      </div>
                      <Button type="button" variant="outline" className="h-11 w-full justify-start rounded-xl text-destructive" onClick={logout}>
                        <LogOut className="h-4 w-4" aria-hidden="true" /> {t("common.logout")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href ?? "/app"}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
