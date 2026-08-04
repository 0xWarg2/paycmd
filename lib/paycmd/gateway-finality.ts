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
