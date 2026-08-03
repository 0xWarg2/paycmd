import assert from "node:assert/strict";
import test from "node:test";

import {
  activityTabFrom,
  buildTransactionPreviewModel,
  executionStepsForStatus,
  canSafelyRetryExecutionFailure,
  navigationFor,
} from "./ui-models.ts";

test("activity deep links accept known tabs and default invalid values to transactions", () => {
  assert.equal(activityTabFrom("notifications"), "notifications");
  assert.equal(activityTabFrom("transactions"), "transactions");
  assert.equal(activityTabFrom("unknown"), "transactions");
  assert.equal(activityTabFrom(null), "transactions");
});

test("mobile primary navigation exposes Chat, Activity, Contacts, and More only", () => {
  assert.deepEqual(
    navigationFor("mobile-primary").map((item) => item.key),
    ["chat", "activity", "contacts", "more"],
  );
});

test("desktop navigation keeps operational destinations without legacy dashboard routes", () => {
  const items = navigationFor("desktop");

  assert.deepEqual(
    items.map((item) => item.key),
    ["chat", "activity", "budgets", "contacts", "schedules", "profile"],
  );
  assert.equal(items.some((item) => item.href?.startsWith("/dashboard")), false);
});

test("transaction preview exposes human labels and an amount-specific confirmation", () => {
  const model = buildTransactionPreviewModel({
    command: "bridge",
    summary: "Bridge USDC",
    fields: {
      amount: "50",
      token: "USDC",
      sourceChain: "baseSepolia",
      destinationChain: "arcTestnet",
      recipientAddress: "0x1111111111111111111111111111111111111111",
      bridgeMintMode: "auto_forwarding",
    },
  });

  assert.equal(model.confirmLabel, "Confirm 50 USDC");
  assert.equal(model.rail, "CCTP v2");
  assert.equal(model.fee.length > 0, true);
  assert.equal(model.risk, "Cross-chain finality");
  assert.deepEqual(
    model.fields.map((field) => field.label),
    ["Amount", "Token", "From network", "To network", "Recipient"],
  );
  assert.equal(model.fields.some((field) => field.label === "bridgeMintMode"), false);
  assert.deepEqual(model.advancedDetails, [
    { key: "bridgeMintMode", label: "Mint mode", value: "auto_forwarding" },
  ]);
});

test("payroll preview makes recipient exposure explicit and defaults to USDC", () => {
  const model = buildTransactionPreviewModel({
    command: "payroll",
    summary: "Run payroll",
    fields: {
      amount: "25",
      batchName: "team",
      sourceChain: "baseSepolia",
      recipient: "4 active contacts",
    },
  });

  assert.equal(model.token, "USDC");
  assert.equal(model.confirmLabel, "Confirm 25 USDC");
  assert.equal(model.recipient, "4 active contacts");
  assert.deepEqual(model.fields.slice(0, 5).map((field) => field.label), [
    "Amount",
    "Token",
    "From network",
    "To network",
    "Recipient",
  ]);
});

test("gateway waiting only marks finalizing after submission is confirmed", () => {
  const beforeSubmission = executionStepsForStatus("waiting_gateway");
  const afterSubmission = executionStepsForStatus("waiting_gateway", { submitted: true });

  assert.equal(beforeSubmission.find((step) => step.state === "active")?.key, "wallet_approval");
  assert.equal(afterSubmission.find((step) => step.key === "submitted")?.state, "complete");
  assert.equal(afterSubmission.find((step) => step.key === "finalizing")?.state, "active");
  assert.equal(afterSubmission.find((step) => step.key === "complete")?.state, "upcoming");
});

test("historical progress snapshots complete their reached step without staying active", () => {
  const queued = executionStepsForStatus("queued", { historical: true });
  const running = executionStepsForStatus("running", { historical: true });

  assert.equal(queued.find((step) => step.key === "prepared")?.state, "complete");
  assert.equal(queued.some((step) => step.state === "active"), false);
  assert.equal(running.find((step) => step.key === "wallet_approval")?.state, "complete");
  assert.equal(running.some((step) => step.state === "active"), false);
});

test("failed execution marks the active lifecycle step as failed", () => {
  const steps = executionStepsForStatus("failed");

  assert.equal(steps.find((step) => step.state === "failed")?.key, "wallet_approval");
});

test("failed execution marks finalization when funds already moved", () => {
  const steps = executionStepsForStatus("failed", { fundsMoved: true });

  assert.equal(steps.find((step) => step.key === "submitted")?.state, "complete");
  assert.equal(steps.find((step) => step.state === "failed")?.key, "finalizing");
});

test("only a conclusively rejected wallet request is safe to retry", () => {
  assert.equal(canSafelyRetryExecutionFailure({ errorCode: 4001 }), true);
  assert.equal(canSafelyRetryExecutionFailure({ errorCode: -32002 }), false);
  assert.equal(canSafelyRetryExecutionFailure({ errorCode: 4001, fundsMoved: true }), false);
});
