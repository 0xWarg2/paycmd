"use client";

import { ReactNode } from "react";

import { ChainIcon, getChainMeta } from "@/components/chain-identity";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import {
  groupPendingGatewayDeposits,
  isFastFinalityChain,
  type PendingGatewayDepositGroup,
  type PendingGatewayDepositSummary,
} from "@/lib/paycmd/gateway-finality";
import { formatDecimalAmount } from "@/lib/paycmd/notification-content";

function chainShortLabel(chain: string) {
  // `getChainMeta` returns nothing for a chain this build does not know about, and the raw key
  // beats "Unknown" here: the entire point of the tooltip is naming where the money is.
  return getChainMeta(chain)?.shortLabel ?? chain;
}

function chainSummary(group: PendingGatewayDepositGroup) {
  const suffix = group.count > 1 ? ` ×${group.count}` : "";
  return `${chainShortLabel(group.chain)} ${formatDecimalAmount(group.amount)} USDC${suffix}`;
}

/**
 * The same per-chain detail folded into one line, for the surfaces a tooltip cannot reach:
 * mobile has no hover and Radix tooltips do not open on tap, so the badge there carries it in
 * `title`/`aria-label` where long-press and screen readers both find it.
 */
export function pendingDepositsDetailLabel(
  countLabel: string,
  deposits: readonly PendingGatewayDepositSummary[],
) {
  const groups = groupPendingGatewayDeposits(deposits);
  if (groups.length === 0) return countLabel;
  return `${countLabel} · ${groups.map(chainSummary).join(" · ")}`;
}

/**
 * "1 deposit waiting for finality" does not answer the question a waiting user actually has,
 * which is *which chain* the money is stuck on. One row per chain, because two deposits on the
 * same chain are still one answer — they add up behind a `×N` instead of listing twice.
 *
 * The deposits arrive as a prop instead of straight from `usePayCmdRuntime` so the /dev fixture
 * can render every variant: `/dev/*` is a public surface, where the runtime never syncs.
 */
export function PendingDepositsTooltip({
  deposits,
  children,
}: {
  deposits: readonly PendingGatewayDepositSummary[];
  children: ReactNode;
}) {
  const { t } = useI18n();
  const groups = groupPendingGatewayDeposits(deposits);

  // The count still comes straight off the response length, so an older deployment that sends
  // bare ids keeps its badge and simply gets no tooltip, rather than an empty one.
  if (groups.length === 0) return <>{children}</>;

  // One shared ETA line would have to be wrong for one of the two groups, since Arc finalizes in
  // seconds and the rest take a quarter of an hour. Naming the fast chains only in the mixed case
  // keeps the common single-speed wait down to one plain sentence.
  const fast = groups.filter((group) => isFastFinalityChain(group.chain));
  const etaText =
    fast.length === groups.length
      ? t("shell.pendingTooltipEtaFast")
      : fast.length === 0
        ? t("shell.pendingTooltipEta")
        : t("shell.pendingTooltipEtaMixed", {
            chains: fast.map((group) => chainShortLabel(group.chain)).join(", "),
          });

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-[260px] space-y-1.5 px-3 py-2">
        <p className="font-semibold">{t("shell.pendingTooltipTitle")}</p>
        <ul className="space-y-1">
          {groups.map((group) => (
            <li key={group.chain} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                {/* Icon plus plain label rather than `ChainBadge`: this surface is inverted
                    (`bg-foreground`), and the badge's outline variant paints its text
                    `text-foreground`, which would vanish into it. */}
                <ChainIcon chain={group.chain} size={14} />
                <span className="truncate">{chainShortLabel(group.chain)}</span>
              </span>
              <span className="shrink-0 font-mono">
                {formatDecimalAmount(group.amount)} USDC
                {group.count > 1 ? ` ×${group.count}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="opacity-70">{etaText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
