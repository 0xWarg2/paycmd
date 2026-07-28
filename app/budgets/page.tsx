import { ArrowUpRight, Clock3, Gauge, ShieldCheck, WalletCards } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PayCmdSectionPage } from "@/components/paycmd-section-page";
import { Badge } from "@/components/ui/badge";
import { localeFromCookieStore, tr } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type BudgetRow = {
  id: string;
  name: string;
  token: string;
  limit_amount: number | string;
  used_amount: number | string;
  status: string;
};

type TransactionRow = {
  amount: number | string | null;
  tx_type: string | null;
  status: string | null;
  chain: string | null;
  created_at: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsdc(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: 6,
  }).format(value);
}

function statusTone(status: string) {
  if (status === "active") return "default";
  if (status === "paused") return "secondary";
  return "outline";
}

export default async function BudgetsPage() {
  const locale = localeFromCookieStore(await cookies());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/budgets");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [budgetsResult, transactionsResult] = await Promise.all([
    supabase
      .from("budgets")
      .select("id, name, token, limit_amount, used_amount, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transaction_history")
      .select("amount, tx_type, status, chain, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const budgets = (budgetsResult.data ?? []) as BudgetRow[];
  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const successfulSpend = transactions
    .filter((row) => row.status === "success" && ["pay", "transfer", "bridge", "swap", "withdraw"].includes(row.tx_type ?? ""))
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const pendingCount = transactions.filter((row) => row.status?.startsWith("pending")).length;
  const failedCount = transactions.filter((row) => row.status === "failed").length;
  const topChain =
    Object.entries(
      transactions.reduce<Record<string, number>>((acc, row) => {
        const chain = row.chain ?? "unknown";
        acc[chain] = (acc[chain] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? tr(locale, "pages.budgets.noActivity");

  return (
    <PayCmdSectionPage
      eyebrow={tr(locale, "pages.budgets.eyebrow")}
      title={tr(locale, "pages.budgets.title")}
      description={tr(locale, "pages.budgets.description")}
    >
      <div className="grid gap-4">
        <section className="rounded-2xl border border-primary/20 bg-card/75 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {tr(locale, "pages.budgets.comingSoon")}
              </Badge>
              <h2 className="text-xl font-semibold tracking-normal">{tr(locale, "pages.budgets.headline")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {tr(locale, "pages.budgets.body")}
              </p>
            </div>
            <div className="rounded-xl border bg-background/70 px-4 py-3">
              <div className="text-xs text-muted-foreground">{tr(locale, "pages.budgets.trackedSpend")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatUsdc(successfulSpend, locale)} USDC</div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Insight icon={WalletCards} label={tr(locale, "pages.budgets.activeBudgets")} value={budgets.filter((row) => row.status === "active").length.toString()} />
          <Insight icon={ArrowUpRight} label={tr(locale, "pages.budgets.topChain")} value={topChain} />
          <Insight icon={Clock3} label={tr(locale, "pages.budgets.pendingOps")} value={pendingCount.toString()} />
          <Insight icon={ShieldCheck} label={tr(locale, "pages.budgets.failedOps")} value={failedCount.toString()} />
        </section>

        {budgets.length ? (
          <section className="grid gap-3 md:grid-cols-2">
            {budgets.map((budget) => {
              const limit = toNumber(budget.limit_amount);
              const used = toNumber(budget.used_amount);
              const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

              return (
                <article key={budget.id} className="rounded-2xl border bg-card/82 p-4 shadow-sm backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        <Gauge className="h-4 w-4 text-primary" />
                        {budget.name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {tr(locale, "pages.budgets.usedOf", {
                          used: formatUsdc(used, locale),
                          limit: formatUsdc(limit, locale),
                          token: budget.token,
                        })}
                      </div>
                    </div>
                    <Badge variant={statusTone(budget.status) as "default" | "secondary" | "outline"}>
                      {budget.status}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="mt-3 text-sm font-medium">
                    {tr(locale, "pages.budgets.available", {
                      amount: formatUsdc(Math.max(0, limit - used), locale),
                      token: budget.token,
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-2xl border bg-card/75 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{tr(locale, "pages.budgets.emptyTitle")}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {tr(locale, "pages.budgets.emptyBody")}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </PayCmdSectionPage>
  );
}

function Insight({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
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
