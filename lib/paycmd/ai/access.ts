type SupabaseRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type AiQuota = {
  enabled: boolean;
  unlimited: boolean;
  limit: 10 | null;
  used: number | null;
  remaining: number | null;
};

type Reservation = {
  reservation_id: string | null;
  allowed: boolean;
  unlimited: boolean;
  used: number | null;
  remaining: number | null;
};

export class AiAccessError extends Error {
  readonly status: 429 | 503;
  readonly code: "AI_QUOTA_EXHAUSTED" | "AI_ACCESS_CHECK_FAILED";
  readonly quota: AiQuota;

  constructor(
    message: string,
    status: 429 | 503,
    code: "AI_QUOTA_EXHAUSTED" | "AI_ACCESS_CHECK_FAILED",
    quota: AiQuota,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.quota = quota;
  }
}

function enabled() {
  return process.env.DEEPSEEK_QUOTA_ENABLED === "true";
}

function unlimitedQuota(): AiQuota {
  return { enabled: enabled(), unlimited: true, limit: null, used: null, remaining: null };
}

function quotaFrom(reservation: Reservation): AiQuota {
  return {
    enabled: true,
    unlimited: reservation.unlimited,
    limit: reservation.unlimited ? null : 10,
    used: reservation.unlimited ? null : reservation.used,
    remaining: reservation.unlimited ? null : reservation.remaining,
  };
}

function row(data: unknown): Reservation | null {
  return Array.isArray(data) && data[0] && typeof data[0] === "object" ? (data[0] as Reservation) : null;
}

export async function getDeepSeekQuota(client: SupabaseRpcClient): Promise<AiQuota> {
  if (!enabled()) return unlimitedQuota();

  const snapshotResult = await client.rpc("get_deepseek_quota");
  const snapshot = row(snapshotResult.data);
  if (snapshotResult.error || !snapshot) {
    throw new AiAccessError(
      "Unable to check AI access",
      503,
      "AI_ACCESS_CHECK_FAILED",
      { enabled: true, unlimited: false, limit: 10, used: null, remaining: null },
    );
  }

  return quotaFrom(snapshot);
}

export async function runDeepSeekWithQuota<T>(client: SupabaseRpcClient, call: () => Promise<T>) {
  if (!enabled()) return { result: await call(), quota: unlimitedQuota() };

  const reservationResult = await client.rpc("reserve_deepseek_request");
  const reservation = row(reservationResult.data);
  if (reservationResult.error || !reservation) {
    throw new AiAccessError(
      "Unable to check AI access",
      503,
      "AI_ACCESS_CHECK_FAILED",
      { enabled: true, unlimited: false, limit: 10, used: null, remaining: null },
    );
  }

  const reservedQuota = quotaFrom(reservation);
  if (!reservation.allowed) {
    throw new AiAccessError("AI free quota exhausted", 429, "AI_QUOTA_EXHAUSTED", reservedQuota);
  }
  if (reservation.unlimited || !reservation.reservation_id) return { result: await call(), quota: reservedQuota };

  let result: T;
  try {
    result = await call();
  } catch (error) {
    try {
      await client.rpc("settle_deepseek_request", {
        p_reservation_id: reservation.reservation_id,
        p_succeeded: false,
      });
    } catch {
      // Preserve the provider error; a stale reservation expires automatically in the database.
    }
    throw error;
  }

  const settled = await client.rpc("settle_deepseek_request", {
    p_reservation_id: reservation.reservation_id,
    p_succeeded: true,
  });
  const settledRow = row(settled.data);
  if (settled.error || !settledRow) {
    throw new AiAccessError("Unable to record AI usage", 503, "AI_ACCESS_CHECK_FAILED", reservedQuota);
  }

  return { result, quota: quotaFrom({ ...reservation, ...settledRow }) };
}
