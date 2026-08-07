import assert from "node:assert/strict";
import test from "node:test";

import { executePayrollBatch } from "./payroll-executor.ts";

test("continues sequentially after a failed payroll item without retrying it", async () => {
  const calls: string[] = [];
  const result = await executePayrollBatch({
    claimBatch: async () => ({ claimed: true, batch: { source_chain: "baseSepolia" }, items: [
      { id: "1", amount: "1", recipient_address: "0x1", destination_chain: "arcTestnet" },
      { id: "2", amount: "1", recipient_address: "0x2", destination_chain: "arcTestnet" },
      { id: "3", amount: "1", recipient_address: "0x3", destination_chain: "arcTestnet" },
    ] }),
    markItemRunning: async (id) => { calls.push(`running:${id}`); },
    transfer: async (item) => {
      calls.push(`transfer:${item.id}`);
      if (item.id === "2") throw new Error("INSUFFICIENT_GAS");
      return { txHash: `0x${item.id}` };
    },
    markItemSuccess: async (id) => { calls.push(`success:${id}`); },
    markItemFailed: async (id) => { calls.push(`failed:${id}`); },
    completeBatch: async (status) => { calls.push(`complete:${status}`); },
  });

  assert.equal(result.status, "partial_failed");
  assert.deepEqual(result.results.map((item) => item.status), ["success", "failed", "success"]);
  assert.deepEqual(calls, [
    "running:1", "transfer:1", "success:1",
    "running:2", "transfer:2", "failed:2",
    "running:3", "transfer:3", "success:3",
    "complete:partial_failed",
  ]);
});

test("does nothing when the draft-to-running claim was already taken", async () => {
  let transferCalls = 0;
  const result = await executePayrollBatch({
    claimBatch: async () => ({ claimed: false }),
    markItemRunning: async () => assert.fail("must not mark an item"),
    transfer: async () => { transferCalls += 1; return {}; },
    markItemSuccess: async () => assert.fail("must not mark success"),
    markItemFailed: async () => assert.fail("must not mark failure"),
    completeBatch: async () => assert.fail("must not complete"),
  });
  assert.equal(result.alreadyStarted, true);
  assert.equal(transferCalls, 0);
});
