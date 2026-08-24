"use client";

import { Bell, CheckCircle2, Clock3, Inbox, ShieldAlert, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ChainBadge, ChainRoute, ExplorerTxLink } from "@/components/chain-identity";
import { usePayCmdRuntime } from "@/components/paycmd-runtime";
import { TransactionHistory } from "@/components/transaction-history";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import {
  notificationBucket,
  type NotificationSourceAllocation,
} from "@/lib/paycmd/notification-content";
import type { ActivityTab } from "@/lib/paycmd/ui-models";

export type ActivityNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  command_execution_id: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
};

function notificationMeta(type: string, body: string) {
  switch (notificationBucket(type, body)) {
    case "attention":
      return { Icon: ShieldAlert, tone: "border-danger/30 bg-danger/10 text-danger", labelKey: "activity.attention" };
    case "waiting":
      return { Icon: Clock3, tone: "border-waiting/30 bg-waiting/10 text-waiting-foreground", labelKey: "activity.waiting" };
    case "gateway":
      return { Icon: WalletCards, tone: "border-info/30 bg-info/10 text-info", labelKey: "activity.gateway" };
    default:
      return { Icon: CheckCircle2, tone: "border-success/30 bg-success/10 text-success", labelKey: "activity.completed" };
  }
}

// Structured chip data parsed defensively out of the jsonb column: rows written before the
// composer existed carry `{}` and render as plain text (with a clamp) instead of chips.
type NotificationChipData = {
  amount?: string;
  sourceChain?: string | null;
  destinationChain?: string | null;
  sourceAllocations: NotificationSourceAllocation[];
  fee?: string | null;
  feeEstimated: boolean;
  txHash?: string | null;
};

function chipData(metadata: Record<string, unknown> | null | undefined): NotificationChipData | null {
  if (!metadata || metadata.v !== 1) return null;
  const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  const allocations = Array.isArray(metadata.sourceAllocations)
    ? metadata.sourceAllocations.flatMap((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        const sourceChain = text(item.sourceChain);
        const amount = text(item.amount);
        return sourceChain && amount ? [{ sourceChain, amount }] : [];
      })
    : [];

  return {
    amount: text(metadata.amount),
    sourceChain: text(metadata.sourceChain) ?? null,
    destinationChain: text(metadata.destinationChain) ?? null,
    sourceAllocations: allocations,
    fee: text(metadata.fee) ?? null,
    feeEstimated: metadata.feeEstimated === true,
    txHash: text(metadata.txHash) ?? null,
  };
}

function NotificationChips({ chips }: { chips: NotificationChipData }) {
  const { t } = useI18n();
  const hasRoute = Boolean(chips.sourceChain || chips.destinationChain || chips.sourceAllocations.length);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
      {chips.amount ? (
        <span className="font-semibold text-foreground">{chips.amount} USDC</span>
      ) : null}
      {chips.sourceAllocations.length > 1 ? (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {chips.sourceAllocations.map((allocation, index) => (
            <span key={`${allocation.sourceChain}-${index}`} className="flex items-center gap-1">
              <ChainBadge chain={allocation.sourceChain} compact />
              <span>{allocation.amount}</span>
            </span>
          ))}
          {chips.destinationChain ? (
            <>
              <span aria-hidden="true">→</span>
              <ChainBadge chain={chips.destinationChain} compact />
            </>
          ) : null}
        </span>
      ) : hasRoute ? (
        <ChainRoute
          sourceChain={chips.sourceChain ?? chips.sourceAllocations[0]?.sourceChain ?? chips.destinationChain}
          destinationChain={chips.destinationChain}
          compact
        />
      ) : null}
      {chips.fee ? (
        <span>
          {t(chips.feeEstimated ? "notify.body.feeEstimated" : "notify.body.fee", { amount: chips.fee })}
        </span>
      ) : null}
      {chips.txHash ? (
        <ExplorerTxLink
          chain={chips.destinationChain ?? chips.sourceChain}
          txHash={chips.txHash}
          compact
        />
      ) : null}
    </div>
  );
}

// Lives in its own component because usePayCmdRuntime throws outside the provider: the real
// /activity page renders inside it, while the /dev fixture page (no provider) simply never
// passes markReadOnOpen, so this never mounts there.
function MarkNotificationsRead() {
  const { refreshNotifications } = usePayCmdRuntime();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { method: "PATCH" })
      .then(() => {
        // Rows on screen keep their "New" badge for this visit; the shell badge resets now.
        if (!cancelled) void refreshNotifications();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshNotifications]);

  return null;
}

function formatActivityDate(value: string | null, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ActivityView({
  initialTab,
  notifications,
  notificationError,
  markReadOnOpen,
}: {
  initialTab: ActivityTab;
  notifications: ActivityNotification[];
  notificationError?: string | null;
  markReadOnOpen?: boolean;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const unreadCount = notifications.filter((item) => item.status === "unread").length;
  const waitingCount = notifications.filter(
    (item) => notificationBucket(item.type, item.body) === "waiting",
  ).length;
  const failedCount = notifications.filter(
    (item) => notificationBucket(item.type, item.body) === "attention",
  ).length;
  const visibleNotifications = notifications.filter((notification) => {
    const searchable = `${notification.title} ${notification.body} ${notification.type}`.toLowerCase();
    const matchesSearch = searchable.includes(notificationSearch.trim().toLowerCase());
    const bucket = notificationBucket(notification.type, notification.body);
    const matchesFilter =
      notificationFilter === "all" ||
      (notificationFilter === "unread" && notification.status === "unread") ||
      (notificationFilter === "waiting" && bucket === "waiting") ||
      (notificationFilter === "failed" && bucket === "attention");
    return matchesSearch && matchesFilter;
  });

  function setTab(tab: string) {
    const nextTab: ActivityTab = tab === "notifications" ? "notifications" : "transactions";
    router.replace(`/activity?tab=${nextTab}`, { scroll: false });
  }

  return (
    <div className="command-center-canvas h-full overflow-y-auto">
      {markReadOnOpen && initialTab === "notifications" && unreadCount > 0 ? (
        <MarkNotificationsRead />
      ) : null}
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <header className="command-panel mb-5 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("activity.eyebrow")}</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{t("activity.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("activity.description")}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ActivityCounter label={t("activity.unread")} value={unreadCount} />
              <ActivityCounter label={t("activity.waiting")} value={waitingCount} />
              <ActivityCounter label={t("activity.failed")} value={failedCount} />
            </div>
          </div>
        </header>

        <Tabs value={initialTab} onValueChange={setTab} className="gap-4">
          <TabsList className="command-panel h-11 w-full justify-start rounded-xl bg-surface/80 p-1 sm:w-auto">
            <TabsTrigger value="transactions" className="h-9 rounded-lg px-4">
              <WalletCards className="h-4 w-4" aria-hidden="true" /> {t("activity.transactions")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="h-9 rounded-lg px-4">
              <Bell className="h-4 w-4" aria-hidden="true" /> {t("activity.notifications")}
              {unreadCount ? <Badge className="ml-1 rounded-full px-1.5">{unreadCount}</Badge> : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transactions"><TransactionHistory /></TabsContent>
          <TabsContent value="notifications">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={notificationSearch}
                onChange={(event) => setNotificationSearch(event.target.value)}
                placeholder={t("activity.searchNotifications")}
                aria-label={t("activity.searchNotifications")}
                className="sm:max-w-sm"
              />
              <Select value={notificationFilter} onValueChange={setNotificationFilter}>
                <SelectTrigger className="sm:w-52" aria-label={t("activity.filterNotifications")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("activity.filterAll")}</SelectItem>
                  <SelectItem value="unread">{t("activity.unread")}</SelectItem>
                  <SelectItem value="waiting">{t("activity.waiting")}</SelectItem>
                  <SelectItem value="failed">{t("activity.failed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="command-panel overflow-hidden" aria-live="polite">
              <CardContent className="p-0">
                {notificationError ? (
                  <div role="alert" className="p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                      <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 font-semibold">{t("activity.error")}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{notificationError}</p>
                  </div>
                ) : visibleNotifications.map((notification) => {
                  const meta = notificationMeta(notification.type, notification.body);
                  const chips = chipData(notification.metadata);
                  const isUnread = notification.status === "unread";
                  return (
                    <article key={notification.id} className={`border-b border-border/60 p-4 last:border-b-0 md:p-5 ${isUnread ? "bg-primary/[0.035]" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.tone}`}>
                          <meta.Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-medium">{notification.title}</h2>
                            {isUnread ? <Badge className="rounded-full">{t("activity.new")}</Badge> : null}
                            <Badge variant="outline" className="rounded-full">{t(meta.labelKey)}</Badge>
                          </div>
                          {notification.body ? (
                            <p className={`mt-1 text-sm leading-6 text-muted-foreground ${chips ? "" : "line-clamp-2"}`}>
                              {notification.body}
                            </p>
                          ) : null}
                          {chips ? <NotificationChips chips={chips} /> : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <time dateTime={notification.created_at ?? undefined}>{formatActivityDate(notification.created_at, locale)}</time>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!notificationError && !visibleNotifications.length ? (
                  <div className="p-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Inbox className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 font-semibold">{t("activity.empty")}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("activity.emptyDescription")}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ActivityCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl border border-border/65 bg-background/55 px-3 py-2 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
