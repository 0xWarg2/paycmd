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
