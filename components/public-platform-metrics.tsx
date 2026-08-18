import { Radio } from "lucide-react";

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
  const updatedLabel = metrics
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }).format(new Date(metrics.asOf))
    : null;
  const items = metrics
    ? [
        {
          label: "Users joined",
          value: formatPublicCount(metrics.registeredUsers),
          exact: `${metrics.registeredUsers.toLocaleString("en")} registered users`,
        },
        {
          label: "Movements",
          value: formatPublicCount(metrics.completedPayments),
          exact: `${metrics.completedPayments.toLocaleString("en")} completed onchain movements`,
        },
        {
          label: "USDC moved",
          value: formatPublicUsdc(metrics.usdcMoved) ?? metrics.usdcMoved,
          exact: `${metrics.usdcMoved} USDC moved`,
        },
        {
          label: "AskPayna",
          value: formatPublicCount(metrics.researchAnswers),
          exact: `${metrics.researchAnswers.toLocaleString("en")} persisted AskPayna answers`,
        },
      ]
    : [];

  return (
    <section
      aria-labelledby="platform-activity-heading"
      aria-describedby="platform-activity-definition"
      className="relative z-10 border-y border-border bg-card/30 py-4 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary lg:w-32">
            <Radio aria-hidden="true" className="h-4 w-4" />
            <h2 id="platform-activity-heading" className="whitespace-nowrap">
              Live activity
            </h2>
          </div>

          {metrics ? (
            <>
              <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-y-0">
                {items.map((item) => (
                  <article
                    key={item.label}
                    className="min-w-0 border-l border-border pl-3 sm:pl-4"
                  >
                    <div
                      aria-hidden="true"
                      className="text-2xl font-semibold tracking-tight text-card-foreground"
                    >
                      {item.value}
                    </div>
                    <span className="sr-only">{item.exact}</span>
                    <h3 className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.label}
                    </h3>
                  </article>
                ))}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground lg:w-44 lg:flex-col lg:items-end lg:gap-1">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {networkLabel(metrics.network)}
                </span>
                <time className="whitespace-nowrap" dateTime={metrics.asOf}>
                  Updated {updatedLabel} UTC
                </time>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Activity temporarily unavailable. Payna remains available.
            </p>
          )}
        </div>

        <p id="platform-activity-definition" className="sr-only">
          Counts come from aggregate Payna records. “Verified movements” includes successful transfers and bridges with a recorded transaction hash; it excludes deposits and internal balance consolidation to avoid double counting.
        </p>
      </div>
    </section>
  );
}
