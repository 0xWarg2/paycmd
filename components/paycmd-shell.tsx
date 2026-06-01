"use client";

import { Command, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { availableBudget, demoNotifications, navigationItems } from "@/lib/paycmd/demo-data";

export function PayCmdShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const unreadCount = demoNotifications.filter((item) => item.status === "unread").length;

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="hidden border-r bg-card lg:flex lg:flex-col">
          <div className="border-b p-4">
            <Link href="/" className="flex items-center gap-3">
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
            <div className="text-xs text-muted-foreground">Gateway balance</div>
            <div className="mt-1 text-xl font-semibold">${availableBudget().toLocaleString()} USDC</div>
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
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3">
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <div className="text-sm font-medium">Appearance</div>
                <div className="text-xs text-muted-foreground">Light, dark, system</div>
              </div>
              <ThemeSwitcher />
            </div>
          </div>
        </aside>

        <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Command className="h-5 w-5 text-primary" />
            PayCMD
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Badge variant="secondary">${availableBudget().toLocaleString()} USDC</Badge>
          </div>
        </header>

        <section className="min-h-0 overflow-hidden">{children}</section>

        <nav className="grid grid-cols-5 border-t bg-card lg:hidden">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
