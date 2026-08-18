export type PublicPlatformMetrics = {
  registeredUsers: number;
  completedPayments: number;
  usdcMoved: string;
  researchAnswers: number;
  network: "testnet" | "mainnet" | "mixed";
  asOf: string;
};

type PublicMetricsLoaderOptions = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  fetcher?: typeof fetch;
};

function nonNegativeInteger(value: unknown) {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : null;
}

function nonNegativeDecimal(value: unknown) {
  const normalized = typeof value === "number" ? String(value) : value;
  if (typeof normalized !== "string" || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? normalized : null;
}

export function normalizePublicPlatformMetrics(value: unknown): PublicPlatformMetrics | null {
  const candidate = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!candidate || typeof candidate !== "object") return null;

  const row = candidate as Record<string, unknown>;
  const registeredUsers = nonNegativeInteger(row.registered_users);
  const completedPayments = nonNegativeInteger(row.completed_payments);
  const researchAnswers = nonNegativeInteger(row.research_answers);
  const usdcMoved = nonNegativeDecimal(row.usdc_moved);
  const network = row.network;
  const asOf = row.as_of;

  if (
    registeredUsers === null ||
    completedPayments === null ||
    researchAnswers === null ||
    usdcMoved === null ||
    (network !== "testnet" && network !== "mainnet" && network !== "mixed") ||
    typeof asOf !== "string" ||
    !Number.isFinite(Date.parse(asOf))
  ) {
    return null;
  }

  return {
    registeredUsers,
    completedPayments,
    usdcMoved,
    researchAnswers,
    network,
    asOf,
  };
}

export function formatPublicCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

export function formatPublicUsdc(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return new Intl.NumberFormat("en", {
    notation: parsed >= 1_000 ? "compact" : "standard",
    minimumFractionDigits: 0,
    maximumFractionDigits: parsed >= 1_000 ? 1 : 2,
  }).format(parsed);
}

export async function loadPublicPlatformMetrics(
  options: PublicMetricsLoaderOptions = {},
): Promise<PublicPlatformMetrics | null> {
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    options.supabasePublishableKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const fetcher = options.fetcher ?? fetch;

  if (!supabaseUrl || !supabasePublishableKey) return null;

  try {
    const response = await fetcher(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_platform_metrics`,
      {
        method: "POST",
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5_000),
      } as RequestInit & { next: { revalidate: number } },
    );
    if (!response.ok) return null;
    return normalizePublicPlatformMetrics(await response.json());
  } catch {
    return null;
  }
}
