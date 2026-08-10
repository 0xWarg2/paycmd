"use client";

import { Check, Loader2 } from "lucide-react";
import { useMemo } from "react";

import { getChainMeta } from "@/components/chain-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  gatewaySourceSelectionRows,
  type GatewayAllocationEstimate,
  type GatewaySourceEstimate,
} from "@/lib/paycmd/gateway-source-selection";

function formatUsdc(value: string | number | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export type UnifiedGatewaySourceSelectorProps = {
  amount: string | number;
  destinationChain: string;
  totalEstimatedFee?: string | number;
  totalFeeBuffer?: string | number;
  maximumGatewayFee?: string | number;
  maximumDebit?: string | number;
  mintGasMode: "auto_forwarding" | "manual";
  sources: GatewaySourceEstimate[];
  allocations: GatewayAllocationEstimate[];
  customSourceChains: string[] | null;
  quoteLoading: boolean;
  active: boolean;
  onCustomize: () => void;
  onToggleSource: (sourceChain: string) => void;
  onRestoreRecommended: () => void;
  onBackToScoped?: () => void;
};

export function UnifiedGatewaySourceSelector({
  amount,
  destinationChain,
  totalEstimatedFee,
  totalFeeBuffer,
  maximumGatewayFee,
  maximumDebit,
  sources,
  allocations,
  customSourceChains,
  quoteLoading,
  active,
  onCustomize,
  onToggleSource,
  onRestoreRecommended,
  onBackToScoped,
}: UnifiedGatewaySourceSelectorProps) {
  const { t } = useI18n();
  const rows = useMemo(() => gatewaySourceSelectionRows({
    sources,
    allocations,
    customSourceChains,
  }), [allocations, customSourceChains, sources]);
  const allocatedRows = rows.filter((row) => row.allocation);
  const otherSourceCount = rows.length - allocatedRows.length;
  const destinationLabel = getChainMeta(destinationChain)?.label ?? destinationChain;
  const automaticMode = customSourceChains === null;

  return (
    <section
      role="region"
      aria-label={t("preview.gatewaySources.regionLabel")}
      className="min-w-0 space-y-4 rounded-xl border bg-card p-3 text-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">
            {automaticMode
              ? t("preview.gatewaySources.recommendedTitle")
              : t("preview.gatewaySourceSelection")}
          </div>
          <p className="mt-1 text-muted-foreground">{t("preview.gatewaySources.allocatedHelp")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onBackToScoped ? (
            <Button type="button" variant="ghost" size="sm" disabled={!active || quoteLoading} onClick={onBackToScoped}>
              {t("preview.gatewayBackToScoped")}
            </Button>
          ) : null}
          <Badge variant="outline" className="rounded-full border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            {automaticMode
              ? t("preview.gatewaySources.recommendedBadge")
              : t("preview.gatewaySources.customBadge")}
          </Badge>
        </div>
      </div>

      {quoteLoading ? (
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {automaticMode && allocations.length === 0
            ? t("preview.gatewaySources.finding")
            : t("preview.gatewaySources.refreshing")}
        </div>
      ) : null}

      <dl className="grid gap-2 rounded-lg border bg-background/55 p-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t("preview.gatewaySources.deliver", { chain: destinationLabel })}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{formatUsdc(amount)} USDC</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("preview.gatewaySources.sourcesUsed")}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{allocatedRows.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("preview.gatewaySources.estimatedFee")}</dt>
          <dd
            data-testid="gateway-estimated-fee"
            data-atomic-usdc={String(totalEstimatedFee ?? 0)}
            className="mt-0.5 text-sm font-medium tabular-nums text-foreground"
          >
            ~{formatUsdc(totalEstimatedFee)} USDC
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("preview.gatewaySources.feeBuffer")}</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
            {formatUsdc(totalFeeBuffer)} USDC
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("preview.gatewaySources.feeLimit")}</dt>
          <dd
            data-testid="gateway-fee-limit"
            data-atomic-usdc={String(maximumGatewayFee ?? 0)}
            className="mt-0.5 text-sm font-semibold tabular-nums text-foreground"
          >
            ≤{formatUsdc(maximumGatewayFee)} USDC
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("preview.gatewaySources.maximumDebit")}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">≤{formatUsdc(maximumDebit)} USDC</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">{t("preview.gatewaySources.feeProtectionHelp")}</p>

      {automaticMode ? (
        <div className="space-y-2">
          {allocatedRows.map((row) => {
          const allocation = row.allocation!;
          const sourceLabel = getChainMeta(row.sourceChain)?.label ?? row.sourceChain;
          return (
            <article
              key={row.sourceChain}
              data-testid="gateway-allocated-source"
              className="min-w-0 rounded-lg border border-primary/25 bg-primary/5 p-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {row.allocationOrder}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      readOnly
                      aria-label={t("preview.gatewaySources.autoSelected", { source: sourceLabel })}
                    />
                    <h3 className="font-medium text-foreground">{sourceLabel}</h3>
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">{t("preview.gatewaySources.send")}</dt>
                      <dd className="font-medium tabular-nums text-foreground">{formatUsdc(allocation.amount)} USDC</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("preview.gatewaySources.readyBalance")}</dt>
                      <dd className="tabular-nums text-foreground">{formatUsdc(row.source.readyBalance)} USDC</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("preview.gatewaySources.maximumReserve")}</dt>
                      <dd className="tabular-nums text-foreground">≤{formatUsdc(allocation.maximumFeeReserve)} USDC</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("preview.gatewaySources.sourceDebit")}</dt>
                      <dd className="font-medium tabular-nums text-foreground">≤{formatUsdc(allocation.maximumDebit)} USDC</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-muted-foreground">
                    {t(`preview.gatewayPriority.${allocation.priorityReason}` as any)}
                  </p>
                </div>
              </div>
            </article>
          );
          })}
        </div>
      ) : (
        <fieldset id="gateway-custom-source-list" className="min-w-0 space-y-2">
          <legend className="sr-only">{t("preview.gatewaySourceSelection")}</legend>
          {rows.map((row) => {
            const sourceLabel = getChainMeta(row.sourceChain)?.label ?? row.sourceChain;
            const finalCheckedSource = row.checked && customSourceChains.length === 1;
            return (
              <div
                key={row.sourceChain}
                data-testid="gateway-source-choice"
                className={`min-w-0 rounded-lg border p-3 ${row.checked ? "border-primary/35 bg-primary/5" : "bg-background/35"}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {row.allocationOrder ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {row.allocationOrder}
                    </span>
                  ) : (
                    <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          disabled={!active || quoteLoading || row.disabled || finalCheckedSource}
                          onChange={() => onToggleSource(row.sourceChain)}
                        />
                        <span className="truncate">{sourceLabel}</span>
                      </label>
                      <span className="tabular-nums text-muted-foreground">
                        {formatUsdc(row.source.readyBalance)} USDC
                      </span>
                    </div>
                    {row.allocation ? (
                      <>
                        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground">{t("preview.gatewaySources.send")}</dt>
                          <dd className="font-medium tabular-nums text-foreground">{formatUsdc(row.allocation.amount)} USDC</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t("preview.gatewaySources.maximumReserve")}</dt>
                          <dd className="tabular-nums text-foreground">≤{formatUsdc(row.allocation.maximumFeeReserve)} USDC</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t("preview.gatewaySources.sourceDebit")}</dt>
                          <dd className="font-medium tabular-nums text-foreground">≤{formatUsdc(row.allocation.maximumDebit)} USDC</dd>
                        </div>
                        </dl>
                      </>
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        {row.disabled ? t("preview.gatewaySourceUnavailable") : t("preview.gatewayNotAllocated")}
                      </p>
                    )}
                    {finalCheckedSource ? (
                      <p className="mt-2 text-muted-foreground">{t("preview.gatewaySources.minimumOne")}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </fieldset>
      )}

      {automaticMode ? (
        <div className="rounded-lg border border-dashed p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-foreground">
              {t("preview.gatewaySources.otherTitle", { count: otherSourceCount })}
            </div>
            <p className="mt-1 text-muted-foreground">{t("preview.gatewaySources.unusedHelp")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!active || quoteLoading || allocatedRows.length === 0}
            aria-expanded={false}
            aria-controls="gateway-custom-source-list"
            onClick={onCustomize}
          >
            {quoteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("preview.gatewaySources.customize")}
          </Button>
        </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={!active || quoteLoading} onClick={onRestoreRecommended}>
            {t("preview.gatewaySources.restore")}
          </Button>
        </div>
      )}

    </section>
  );
}
