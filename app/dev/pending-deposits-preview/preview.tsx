"use client";

import { Clock3 } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import {
  PendingDepositsTooltip,
  pendingDepositsDetailLabel,
} from "@/components/paycmd/pending-deposits-tooltip";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import type { PendingGatewayDepositSummary } from "@/lib/paycmd/gateway-finality";

// The shell's pending state cannot be reached from a fixture: `/dev/*` is a public surface, so
// the runtime never syncs there and the count stays 0. These cases feed the tooltip directly.
const CASES: Array<{ name: string; deposits: PendingGatewayDepositSummary[] }> = [
  {
    name: "One chain",
    deposits: [{ id: "row-1", chain: "baseSepolia", amount: "10" }],
  },
  {
    name: "Arc only (fast ETA)",
    deposits: [{ id: "row-1", chain: "arcTestnet", amount: "5" }],
  },
  {
    name: "Two chains (mixed ETA)",
    deposits: [
      { id: "row-1", chain: "baseSepolia", amount: "10" },
      { id: "row-2", chain: "arcTestnet", amount: "2.5" },
    ],
  },
  {
    name: "Two deposits, one chain (×N)",
    deposits: [
      { id: "row-1", chain: "arbitrumSepolia", amount: "12.5" },
      { id: "row-2", chain: "arbitrumSepolia", amount: "7.5" },
    ],
  },
  {
    name: "Unknown chain key",
    deposits: [{ id: "row-1", chain: "some-new-chain", amount: "1.234567" }],
  },
  {
    name: "Legacy payload (no detail → no tooltip)",
    deposits: [],
  },
];

export function PendingDepositsPreview() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/55 bg-surface/78 px-4 md:px-7">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Design fixture
          </div>
          <h1 className="text-base font-semibold">Pending deposit chain tooltip</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        {CASES.map((item) => {
          const countLabel =
            item.deposits.length === 1
              ? "1 deposit waiting for finality"
              : `${Math.max(item.deposits.length, 1)} deposits waiting for finality`;
          const detailLabel = pendingDepositsDetailLabel(countLabel, item.deposits);

          return (
            <section key={item.name} className="rounded-2xl border border-border/60 p-4">
              <h2 className="text-sm font-semibold">{item.name}</h2>

              {/* Trigger markup mirrors the three shell surfaces so hover, focus and the mobile
                  label can each be checked; the shell owns the real copies. */}
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <PendingDepositsTooltip deposits={item.deposits}>
                  <button
                    type="button"
                    aria-label={detailLabel}
                    className="flex items-center gap-2 rounded-lg text-left text-xs text-amber-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
                  >
                    <Clock3 className="h-4 w-4 shrink-0" />
                    <span>{countLabel}</span>
                  </button>
                </PendingDepositsTooltip>

                <PendingDepositsTooltip deposits={item.deposits}>
                  <Badge variant="waiting" aria-label={detailLabel} className="h-9 gap-1.5 px-2.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{countLabel}</span>
                  </Badge>
                </PendingDepositsTooltip>

                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/40 text-[11px] text-amber-600 dark:text-amber-400"
                  title={detailLabel}
                  aria-label={detailLabel}
                >
                  <Clock3 className="h-3 w-3" aria-hidden="true" />
                  {Math.max(item.deposits.length, 1)}
                </Badge>
              </div>

              <p className="mt-3 break-words text-[11px] text-muted-foreground">
                mobile label: {detailLabel}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
