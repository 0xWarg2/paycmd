import { CalendarClock, Clock3, PauseCircle, Repeat2, ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { localeFromCookieStore, tr } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type ScheduleRow = {
  id: string;
  amount: number | string;
  token: string;
  frequency: string;
  status: string;
  next_run_at: string | null;
  created_at: string | null;
};

function formatAmount(value: number | string, token: string, locale: string) {
  const amount = Number(value);
  const formatted = Number.isFinite(amount)
    ? new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 6 }).format(amount)
    : String(value);

  return `${formatted} ${token}`;
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return tr(locale as "vi" | "en", "pages.schedules.notScheduled");
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function SchedulesPage() {
  const locale = localeFromCookieStore(await cookies());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/schedules");

  const { data } = await supabase
    .from("payment_schedules")
    .select("id, amount, token, frequency, status, next_run_at, created_at")
    .eq("user_id", user.id)
    .order("next_run_at", { ascending: true, nullsFirst: false })
    .limit(50);

  const schedules = (data ?? []) as ScheduleRow[];
  const activeCount = schedules.filter((row) => row.status === "active").length;
  const pausedCount = schedules.filter((row) => row.status === "paused").length;
  const nextRun = schedules.find((row) => row.status === "active" && row.next_run_at)?.next_run_at;

  return (
    <PayCmdSectionPage
      eyebrow={tr(locale, "pages.schedules.eyebrow")}
      title={tr(locale, "pages.schedules.title")}
      description={tr(locale, "pages.schedules.description")}
    >
      <div className="grid gap-4">
        <section className="rounded-2xl border border-primary/20 bg-card/75 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {tr(locale, "pages.schedules.comingSoon")}
              </Badge>
              <h2 className="text-xl font-semibold tracking-normal">{tr(locale, "pages.schedules.headline")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {tr(locale, "pages.schedules.body")}
              </p>
            </div>
            <div className="rounded-xl border bg-background/70 px-4 py-3">
              <div className="text-xs text-muted-foreground">{tr(locale, "pages.schedules.nextPlannedRun")}</div>
              <div className="mt-1 text-lg font-semibold">{formatDate(nextRun, locale)}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Signal icon={Repeat2} label={tr(locale, "pages.schedules.active")} value={activeCount.toString()} />
          <Signal icon={PauseCircle} label={tr(locale, "pages.schedules.paused")} value={pausedCount.toString()} />
          <Signal icon={ShieldCheck} label={tr(locale, "pages.schedules.approvalMode")} value={tr(locale, "pages.schedules.manualFirst")} />
        </section>

        {schedules.length ? (
          <section className="grid gap-3">
            {schedules.map((schedule) => (
              <article
                key={schedule.id}
                className="flex flex-col gap-4 rounded-2xl border bg-card/82 p-4 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{formatAmount(schedule.amount, schedule.token, locale)}</div>
                    <div className="text-sm text-muted-foreground">
                      {tr(locale, "pages.schedules.nextRun", { date: formatDate(schedule.next_run_at, locale) })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{schedule.frequency}</Badge>
                  <Badge variant={schedule.status === "active" ? "default" : "outline"}>
                    {schedule.status}
                  </Badge>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border bg-card/75 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{tr(locale, "pages.schedules.emptyTitle")}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {tr(locale, "pages.schedules.emptyBody")}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </PayCmdSectionPage>
  );
}

function Signal({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card/75 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}
