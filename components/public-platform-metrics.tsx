import { ArrowRightLeft, Bot, CircleDollarSign, Radio, Users } from "lucide-react";

import {
  formatPublicCount,
  formatPublicUsdc,
  loadPublicPlatformMetrics,
} from "@/lib/paycmd/public-metrics";

function networkLabel(network: "testnet" | "mainnet" | "mixed") {
  if (network === "mainnet") return "Mainnet activity";
  if (network === "mixed") return "Testnet + mainnet activity";
  return "Testnet activity";
}

export async function PublicPlatformMetrics() {
  const metrics = await loadPublicPlatformMetrics();

  return (
    <section
      aria-labelledby="platform-activity-heading"
      className="relative z-10 border-y border-border bg-card/30 py-10 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Radio aria-hidden="true" className="h-4 w-4" />
              Live product activity
            </div>
            <h2 id="platform-activity-heading" className="text-2xl font-semibold tracking-normal md:text-3xl">
              Usage you can verify, not vanity numbers
            </h2>
          </div>
          {metrics ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary">
                {networkLabel(metrics.network)}
              </span>
              <time dateTime={metrics.asOf}>
                Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(metrics.asOf))} UTC
              </time>
            </div>
          ) : null}
        </div>

        {metrics ? (
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Users joined",
                value: formatPublicCount(metrics.registeredUsers),
                exact: `${metrics.registeredUsers.toLocaleString("en")} registered users`,
                detail: "Created Payna profiles",
                icon: Users,
              },
              {
                label: "Verified movements",
                value: formatPublicCount(metrics.completedPayments),
                exact: `${metrics.completedPayments.toLocaleString("en")} completed onchain movements`,
                detail: "Successful transfers + bridges",
                icon: ArrowRightLeft,
              },
              {
                label: "USDC moved",
                value: formatPublicUsdc(metrics.usdcMoved) ?? metrics.usdcMoved,
                exact: `${metrics.usdcMoved} USDC moved`,
                detail: networkLabel(metrics.network),
                icon: CircleDollarSign,
              },
              {
                label: "AskPayna answers",
                value: formatPublicCount(metrics.researchAnswers),
                exact: `${metrics.researchAnswers.toLocaleString("en")} persisted AskPayna answers`,
                detail: "Research responses delivered",
                icon: Bot,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="payna-glass rounded-3xl p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div aria-hidden="true" className="text-3xl font-semibold tracking-tight text-card-foreground sm:text-4xl">
                        {item.value}
                      </div>
                      <span className="sr-only">{item.exact}</span>
                      <h3 className="mt-2 text-sm font-medium text-card-foreground">{item.label}</h3>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-7 rounded-3xl border border-border bg-card/55 p-5 text-sm text-muted-foreground">
            Live activity is temporarily unavailable. Payna access, docs, and onchain flows are unaffected.
          </div>
        )}

        <p className="mt-4 max-w-4xl text-xs leading-5 text-muted-foreground">
          Counts come from aggregate Payna records. “Verified movements” includes successful transfers and bridges with a recorded transaction hash; it excludes deposits and internal balance consolidation to avoid double counting.
        </p>
      </div>
    </section>
  );
}
