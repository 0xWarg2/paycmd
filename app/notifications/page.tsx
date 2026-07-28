import {
  Bell,
  CheckCircle2,
  Clock3,
  Inbox,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { localeFromCookieStore, tr } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  command_execution_id: string | null;
  created_at: string | null;
};

function relativeTime(value: string | null | undefined, locale: "vi" | "en") {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (minutes < 1) return tr(locale, "pages.notifications.justNow");
  if (minutes < 60) return tr(locale, "pages.notifications.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr(locale, "pages.notifications.hoursAgo", { count: hours });
  return tr(locale, "pages.notifications.daysAgo", { count: Math.floor(hours / 24) });
}

function notificationMeta(type: string, body: string, locale: "vi" | "en") {
  const normalized = `${type} ${body}`.toLowerCase();

  if (normalized.includes("failed")) {
    return {
      icon: XCircle,
      label: tr(locale, "pages.notifications.metaAttention"),
      className: "border-destructive/25 bg-destructive/10 text-destructive",
    };
  }

  if (normalized.includes("pending") || normalized.includes("finality")) {
    return {
      icon: Clock3,
      label: tr(locale, "pages.notifications.metaWaiting"),
      className: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    };
  }

  if (normalized.includes("gateway")) {
    return {
      icon: WalletCards,
      label: tr(locale, "pages.notifications.metaGateway"),
      className: "border-sky-500/25 bg-sky-500/10 text-sky-200",
    };
  }

  if (normalized.includes("received") || normalized.includes("payment")) {
    return {
      icon: ShieldCheck,
      label: tr(locale, "pages.notifications.metaPayment"),
      className: "border-primary/25 bg-primary/10 text-primary",
    };
  }

  return {
    icon: CheckCircle2,
    label: tr(locale, "pages.notifications.metaCompleted"),
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  };
}

export default async function NotificationsPage() {
  const locale = localeFromCookieStore(await cookies());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/notifications");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, status, command_execution_id, created_at")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (notifications ?? []) as NotificationRow[];
  const unreadCount = rows.filter((row) => row.status === "unread").length;
  const waitingCount = rows.filter((row) => /pending|finality|waiting/i.test(`${row.type} ${row.body}`)).length;
  const failedCount = rows.filter((row) => /failed|error/i.test(`${row.type} ${row.body}`)).length;

  return (
    <PayCmdSectionPage
      eyebrow={tr(locale, "pages.notifications.eyebrow")}
      title={tr(locale, "pages.notifications.title")}
      description={tr(locale, "pages.notifications.description")}
    >
      <div className="grid gap-4">
        <section className="rounded-2xl border border-primary/20 bg-card/75 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {tr(locale, "pages.notifications.comingSoon")}
              </Badge>
              <h2 className="text-xl font-semibold tracking-normal">{tr(locale, "pages.notifications.headline")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {tr(locale, "pages.notifications.body")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Counter label={tr(locale, "pages.notifications.unread")} value={unreadCount} />
              <Counter label={tr(locale, "pages.notifications.waiting")} value={waitingCount} />
              <Counter label={tr(locale, "pages.notifications.failed")} value={failedCount} />
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border bg-card/82 shadow-sm backdrop-blur-xl">
          {rows.map((notification) => {
            const meta = notificationMeta(notification.type, notification.body, locale);
            const Icon = meta.icon;
            const isUnread = notification.status === "unread";

            return (
              <article
                key={notification.id}
                className={`border-b p-4 last:border-b-0 ${isUnread ? "bg-primary/[0.035]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.className}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium">{notification.title}</h3>
                      {isUnread ? <Badge>{tr(locale, "pages.notifications.new")}</Badge> : null}
                      <Badge variant="secondary">{meta.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{relativeTime(notification.created_at, locale)}</span>
                      <span>·</span>
                      <span>{notification.type.replace(/_/g, " ")}</span>
                      {notification.command_execution_id ? (
                        <>
                          <span>·</span>
                          <span className="font-mono">{notification.command_execution_id.slice(0, 8)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {rows.length ? null : (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold">{tr(locale, "pages.notifications.empty")}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {tr(locale, "pages.notifications.emptyBody")}
              </p>
            </div>
          )}
        </div>
      </div>
    </PayCmdSectionPage>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
