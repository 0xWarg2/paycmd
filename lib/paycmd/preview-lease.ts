export const PREVIEW_LEASE_MS = 50_000;

export type PreviewDraftState = "active" | "cancelled" | "confirmed";

export function createPreviewExpiresAt(nowMs = Date.now()) {
  return new Date(nowMs + PREVIEW_LEASE_MS).toISOString();
}

export function previewLeaseState(expiresAt: string, nowMs = Date.now()) {
  const expiryMs = Date.parse(expiresAt);
  const remainingMs = Number.isFinite(expiryMs) ? Math.max(0, expiryMs - nowMs) : 0;
  return {
    expiresAt,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    expired: remainingMs === 0,
  };
}

export function previewCanConfirm(
  input: { draftState?: PreviewDraftState; previewExpiresAt?: string },
  nowMs = Date.now(),
) {
  return input.draftState === "active"
    && Boolean(input.previewExpiresAt)
    && !previewLeaseState(input.previewExpiresAt!, nowMs).expired;
}
