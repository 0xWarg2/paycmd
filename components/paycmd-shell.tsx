"use client";

import { Command, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { usePayCmdRuntime } from "@/components/paycmd-runtime";
import { createClient } from "@/lib/supabase/client";
import { navigationItems } from "@/lib/paycmd/demo-data";

function formatUsdcBalance(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

export function PayCmdShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [unifiedBalance, setUnifiedBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const { activeCommandCount, unreadCount } = usePayCmdRuntime();
  const unifiedBalanceLabel =
    unifiedBalance === null ? "-- USDC" : `${formatUsdcBalance(unifiedBalance)} USDC`;

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadBalance() {
      try {
        const response = await fetch("/api/gateway/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 404) {
            if (isMounted) {
              setUnifiedBalance(0);
            }
            return;
          }

          throw new Error(data?.error ?? data?.message ?? "Failed to load unified balance");
        }

        const total = Number(data?.totalUnified ?? 0);

        if (isMounted) {
          setUnifiedBalance(Number.isFinite(total) ? total : 0);
        }
      } catch (error) {
        console.error("Failed to load unified balance", error);
        if (isMounted) {
          setUnifiedBalance(null);
        }
      } finally {
        if (isMounted) {
          setIsBalanceLoading(false);
        }
      }
    }

    void loadBalance();
    const interval = window.setInterval(loadBalance, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login?next=/app";
  }

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="hidden border-r bg-card lg:flex lg:flex-col">
          <div className="border-b p-4">
            <Link href="/app" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Command className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-normal">PayCMD</div>
                <div className="text-xs text-muted-foreground">Stablecoin command center</div>
              </div>
            </Link>
          </div>

          <div className="m-4 rounded-md border bg-background p-3">
            <div className="text-xs text-muted-foreground">Unified balance</div>
            {isBalanceLoading ? (
              <Skeleton className="mt-2 h-7 w-36" />
            ) : (
              <div className="mt-1 text-xl font-semibold">{unifiedBalanceLabel}</div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Arc Testnet · Circle Gateway
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.label === "Notifications" && unreadCount > 0 ? (
                    <Badge className="ml-auto">{unreadCount}</Badge>
                  ) : item.label === "Chat" && activeCommandCount > 0 ? (
                    <Badge className="ml-auto">{activeCommandCount}</Badge>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3">
            <div className="mb-2 rounded-md border bg-background px-3 py-2">
              <div className="text-sm font-medium">Account</div>
              <div className="truncate text-xs text-muted-foreground">{email || "Signed in"}</div>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <div className="text-sm font-medium">Appearance</div>
                <div className="text-xs text-muted-foreground">Light, dark, system</div>
              </div>
              <ThemeSwitcher />
            </div>
            <Button className="mt-2 w-full justify-start" variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <Command className="h-5 w-5 text-primary" />
            PayCMD
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
            <Badge variant="secondary" className="max-w-[50vw] gap-1 truncate text-[11px]">
              <span className="shrink-0">Unified balance:</span>
              <span className="truncate">{isBalanceLoading ? "..." : unifiedBalanceLabel}</span>
            </Badge>
          </div>
        </header>

        <section className="min-h-0 overflow-hidden">{children}</section>

        <nav
          className="grid border-t bg-card lg:hidden"
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
                <span className="truncate">{item.label}</span>
                {item.label === "Notifications" && unreadCount > 0 ? (
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
