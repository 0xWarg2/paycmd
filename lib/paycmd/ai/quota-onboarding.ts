import type { AiQuota } from "./access";

export type QuotaOnboardingState = {
  quota: AiQuota;
  noticeSeenAt: string | null;
};

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : value === null ? null : undefined;
}

export function normalizeQuotaOnboardingState(value: unknown): QuotaOnboardingState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Record<string, unknown>;
  if (!state.quota || typeof state.quota !== "object") return null;
  const quota = state.quota as Record<string, unknown>;
  const limit = numberOrNull(quota.limit);
  const used = numberOrNull(quota.used);
  const remaining = numberOrNull(quota.remaining);
  const noticeSeenAt = state.noticeSeenAt;

  if (
    typeof quota.enabled !== "boolean" ||
    typeof quota.unlimited !== "boolean" ||
    (limit !== 10 && limit !== null) ||
    used === undefined ||
    remaining === undefined ||
    (noticeSeenAt !== null && typeof noticeSeenAt !== "string")
  ) {
    return null;
  }

  return {
    quota: {
      enabled: quota.enabled,
      unlimited: quota.unlimited,
      limit,
      used,
      remaining,
    },
    noticeSeenAt,
  };
}

export function shouldShowQuotaOnboarding(value: unknown) {
  const state = normalizeQuotaOnboardingState(value);
  return Boolean(
    state &&
      state.quota.enabled &&
      !state.quota.unlimited &&
      state.quota.limit === 10 &&
      state.quota.used === 0 &&
      state.quota.remaining === 10 &&
      !state.noticeSeenAt,
  );
}
