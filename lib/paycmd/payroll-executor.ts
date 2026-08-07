export type PayrollExecutionItem = {
  id: string;
  amount: string | number;
  recipient_address: string;
  destination_chain: string;
};

export type PayrollItemResult = {
  itemId: string;
  status: "success" | "failed";
  txHash?: string | null;
  error?: string;
  transfer?: unknown;
};

export type PayrollExecutorDependencies = {
  claimBatch: () => Promise<{ claimed: boolean; batch?: { source_chain?: string | null }; items?: PayrollExecutionItem[] }>;
  markItemRunning: (itemId: string) => Promise<void>;
  transfer: (item: PayrollExecutionItem, sourceChain: string) => Promise<unknown>;
  markItemSuccess: (itemId: string, txHash: string | null) => Promise<void>;
  markItemFailed: (itemId: string, message: string) => Promise<void>;
  completeBatch: (status: "success" | "failed" | "partial_failed") => Promise<void>;
};

function transferHash(transfer: any) {
  return transfer?.mintTxHash ?? transfer?.txHash ?? transfer?.transferId ?? null;
}

/**
 * A deliberately small, one-shot sequential executor. A failed item is recorded and the next
 * snapshot item runs; there is no retry, queue, resume, rollback, or parallel fan-out here.
 */
export async function executePayrollBatch(dependencies: PayrollExecutorDependencies) {
  const claim = await dependencies.claimBatch();
  if (!claim.claimed) return { alreadyStarted: true as const, status: null, results: [] as PayrollItemResult[] };

  const results: PayrollItemResult[] = [];
  for (const item of claim.items ?? []) {
    await dependencies.markItemRunning(item.id);
    try {
      const transfer = await dependencies.transfer(item, claim.batch?.source_chain || item.destination_chain);
      const txHash = transferHash(transfer);
      await dependencies.markItemSuccess(item.id, txHash);
      results.push({ itemId: item.id, status: "success", txHash, transfer });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payroll item failed";
      await dependencies.markItemFailed(item.id, message);
      results.push({ itemId: item.id, status: "failed", error: message });
    }
  }

  const failed = results.filter((result) => result.status === "failed").length;
  const status = failed === 0 ? "success" : failed === results.length ? "failed" : "partial_failed";
  await dependencies.completeBatch(status);
  return { alreadyStarted: false as const, status, results };
}
