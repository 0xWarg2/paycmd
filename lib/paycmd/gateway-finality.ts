export type ReconciliationDecision =
  | { settled: true; reason: "processed_and_not_pending" }
  | {
      settled: false;
      reason: "listed_pending" | "circle_behind_deposit_block" | "missing_block_evidence";
    };

export function normalizeTransactionHash(value: string) {
  return value.trim().toLowerCase();
}

export function reconciliationDecision(input: {
  txHash: string;
  pendingTxHashes: ReadonlySet<string>;
  depositBlockNumber: bigint | null;
  processedHeight: bigint | null;
}): ReconciliationDecision {
  const txHash = normalizeTransactionHash(input.txHash);
  const isPending = [...input.pendingTxHashes].some(
    (item) => normalizeTransactionHash(item) === txHash,
  );

  if (isPending) {
    return { settled: false, reason: "listed_pending" };
  }

  if (input.depositBlockNumber === null || input.processedHeight === null) {
    return { settled: false, reason: "missing_block_evidence" };
  }

  if (input.processedHeight < input.depositBlockNumber) {
    return { settled: false, reason: "circle_behind_deposit_block" };
  }

  return { settled: true, reason: "processed_and_not_pending" };
}

export function gatewayDepositPollingIntervalMs(ageMs: number) {
  if (ageMs < 2 * 60_000) return 15_000;
  if (ageMs < 10 * 60_000) return 30_000;
  return 60_000;
}

export type GatewayDepositSettlementSignal = {
  txHash: string;
  message: string;
};

function settlementSignal(input: unknown): GatewayDepositSettlementSignal | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.txHash !== "string" || typeof value.message !== "string") return null;
  if (!value.txHash.trim() || !value.message.trim()) return null;
  return { txHash: value.txHash, message: value.message };
}

export function gatewayDepositSettlementSnapshotsFromMessages(
  rows: unknown[],
): GatewayDepositSettlementSignal[] {
  const snapshots: GatewayDepositSettlementSignal[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const metadata = record.metadata;
    if (!metadata || typeof metadata !== "object") continue;
    const execution = (metadata as Record<string, unknown>).execution;
    if (!execution || typeof execution !== "object") continue;
    const detail = execution as Record<string, unknown>;
    if (detail.command !== "deposit" || detail.status !== "success") continue;

    const signal = settlementSignal({ txHash: detail.txHash, message: record.content });
    if (!signal) continue;
    const normalized = normalizeTransactionHash(signal.txHash);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    snapshots.push(signal);
  }

  return snapshots;
}

export function gatewayDepositSettlementsFromSync(
  payload: unknown,
): GatewayDepositSettlementSignal[] {
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  const candidates = [
    ...(Array.isArray(value.completed) ? value.completed : []),
    ...(Array.isArray(value.settled) ? value.settled : []),
  ];
  const settlements: GatewayDepositSettlementSignal[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const signal = settlementSignal(candidate);
    if (!signal) continue;
    const normalized = normalizeTransactionHash(signal.txHash);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    settlements.push(signal);
  }

  return settlements;
}

// Arc reaches finality in about a second, so Circle credits an Arc deposit before the user can
// switch tabs, while the other chains genuinely take 13-19 minutes. Quoting one number for both
// made a finished Arc deposit read as stuck, so every ETA string is picked per chain.
const FAST_FINALITY_CHAINS = new Set(["arc", "arctestnet"]);

export function isFastFinalityChain(chain: string | null | undefined) {
  // Normalized rather than matched against the exact `GATEWAY_CHAIN_CONFIGS` key: the chain
  // reaches these call sites from a DB column, a parsed command draft and a Circle payload,
  // which spell it `arcTestnet`, `arc-testnet` and `ARC` respectively.
  const key = String(chain ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return FAST_FINALITY_CHAINS.has(key);
}

export type PendingGatewayDepositSummary = { id: string; chain: string; amount: string };
export type PendingGatewayDepositGroup = { chain: string; amount: string; count: number };

/**
 * Per-deposit detail for the deposits still waiting on Circle finality. Deliberately separate
 * from the pending *count*, which the client keeps reading off `pending.length`: an older
 * deployment (or a test stub) still sends bare row ids, and a payload this cannot read should
 * cost a tooltip, never a wrong badge.
 */
export function pendingGatewayDepositsFromSync(payload: unknown): PendingGatewayDepositSummary[] {
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  if (!Array.isArray(value.pending)) return [];

  const deposits: PendingGatewayDepositSummary[] = [];

  for (const entry of value.pending) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id) continue;
    if (typeof row.chain !== "string" || !row.chain.trim()) continue;
    deposits.push({
      id: row.id,
      chain: row.chain.trim(),
      // Left as a string: this module has no formatter, and the amount comes off a numeric
      // column that Postgres may hand back either way.
      amount: row.amount === null || row.amount === undefined ? "" : String(row.amount),
    });
  }

  return deposits;
}

/**
 * One row per chain, because "which chain is my money waiting on" is the question — two deposits
 * on the same chain are one answer. The chain key is passed through verbatim so the UI can run it
 * through its own label lookup and fall back to the raw key for chains it does not know.
 */
export function groupPendingGatewayDeposits(
  rows: readonly PendingGatewayDepositSummary[],
): PendingGatewayDepositGroup[] {
  // A Map iterates in insertion order, which is the order the route read the rows in
  // (oldest deposit first), so no extra sort is needed to keep the list stable.
  const totals = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const parsed = Number(row.amount);
    const amount = Number.isFinite(parsed) ? parsed : 0;
    const existing = totals.get(row.chain);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
      continue;
    }

    totals.set(row.chain, { total: amount, count: 1 });
  }

  // Float drift from summing (0.1 + 0.2) is left for the caller's formatter to round off;
  // every display path runs these through `formatDecimalAmount`.
  return [...totals].map(([chain, { total, count }]) => ({
    chain,
    amount: String(total),
    count,
  }));
}
