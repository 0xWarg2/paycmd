import assert from "node:assert/strict";
import { test } from "node:test";

import type { ParsedCommand } from "./commands.ts";
import {
  allocationSummary,
  composeFailureNotification,
  composeSuccessNotification,
  notificationAllocations,
  notificationBucket,
  shortErrorSummary,
  shouldNotifyCommand,
} from "./notification-content.ts";

// Echo translator: output carries the key and every interpolated value, so assertions can
// check both which copy was chosen and what went into it without duplicating i18n strings.
const translate = (
  key: string,
  params?: Record<string, string | number | undefined | null>,
) =>
  [key, ...Object.values(params ?? {}).map((value) => String(value ?? ""))].join(
    " ",
  );

const CHAIN_LABELS: Record<string, string> = {
  ARB: "Arbitrum",
  ARC: "Arc",
  BASE: "Base",
  ETH: "Ethereum",
};

const chainLabel = (chain?: string | null) =>
  (chain ? CHAIN_LABELS[chain] : undefined) ?? chain ?? "";

function draft(
  command: ParsedCommand["command"],
  fields: Record<string, string> = {},
): ParsedCommand {
  return {
    command,
    raw: `/${command}`,
    fields,
    missingFields: [],
    sample: "",
    summary: "",
    status: "draft_ready",
  };
}

test("transfer with unified allocations lists every source chain and the actual fee", () => {
  const composed = composeSuccessNotification({
    draft: draft("transfer", { amount: "5", destinationChain: "BASE" }),
    result: {
      amount: 5,
      destinationChain: "BASE",
      sourceMode: "unified",
      sourceAllocations: [
        { sourceChain: "ARB", amount: "3" },
        { sourceChain: "ARC", amount: "2" },
      ],
      actualGatewayFee: 0.02,
      destinationTxHash: "0xabc",
    },
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.equal(composed.type, "command_success");
  assert.ok(composed.title.includes("notify.transfer.title"));
  assert.ok(composed.title.includes("Base"));
  assert.ok(composed.body.includes("Arbitrum 3 + Arc 2"));
  assert.ok(composed.body.includes("notify.body.fee "));
  assert.ok(!composed.body.includes("feeEstimated"));
  assert.deepEqual(composed.metadata.sourceAllocations, [
    { sourceChain: "ARB", amount: "3" },
    { sourceChain: "ARC", amount: "2" },
  ]);
  assert.equal(composed.metadata.sourceMode, "unified");
  assert.equal(composed.metadata.sourceChain, null);
  assert.equal(composed.metadata.destinationChain, "BASE");
  assert.equal(composed.metadata.fee, "0.02");
  assert.equal(composed.metadata.txHash, "0xabc");
  assert.equal(composed.metadata.v, 1);
});

test("scoped transfer (null allocations) falls back to the single source chain", () => {
  const composed = composeSuccessNotification({
    draft: draft("transfer", { amount: "1", sourceChain: "ARB", destinationChain: "BASE" }),
    result: {
      amount: 1,
      sourceChain: "ARB",
      destinationChain: "BASE",
      sourceAllocations: null,
      estimatedGatewayFee: 0.01,
    },
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.ok(composed.body.includes("notify.body.from Arbitrum"));
  assert.ok(composed.body.includes("notify.body.feeEstimated"));
  assert.equal(composed.metadata.sourceMode, "scoped");
  assert.equal(composed.metadata.sourceChain, "ARB");
  assert.equal("sourceAllocations" in composed.metadata, false);
  assert.equal(composed.metadata.feeEstimated, true);
});

test("transfer where source equals destination drops the from-segment", () => {
  const composed = composeSuccessNotification({
    draft: draft("transfer", { amount: "1", sourceChain: "ARC", destinationChain: "ARC" }),
    result: { amount: 1, sourceChain: "ARC", destinationChain: "ARC", sourceAllocations: null },
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.ok(!composed.body.includes("notify.body.from"));
});

test("pay reads recipient/fee from the nested transfer and reports fee pending", () => {
  const composed = composeSuccessNotification({
    draft: draft("pay", { recipient: "minh", amount: "2" }),
    result: {
      payment: {
        amount: 2,
        destinationChain: "ETH",
        recipient: { label: "Minh" },
      },
      transfer: {
        amount: 2,
        sourceAllocations: [{ sourceChain: "ARB", amount: "2" }],
      },
    },
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.ok(composed.title.includes("notify.pay.title 2 Minh"));
  assert.ok(composed.body.includes("notify.body.to Ethereum"));
  assert.ok(composed.body.includes("notify.body.from Arbitrum"));
  assert.ok(composed.body.includes("notify.body.feePending"));
  assert.equal(composed.metadata.fee, null);
  assert.equal(composed.metadata.recipient, "Minh");
});

test("deposit awaiting finality becomes a pending gateway notification", () => {
  const composed = composeSuccessNotification({
    draft: draft("deposit", { amount: "10", sourceChain: "BASE" }),
    result: { amount: 10, chain: "BASE", status: "pending_gateway_finality" },
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.equal(composed.type, "gateway_deposit_pending");
  assert.equal(composed.metadata.outcome, "pending");
  assert.ok(composed.title.includes("notify.depositPending.title 10"));
  assert.ok(composed.body.includes("Base"));
});

test("gateway finality failure keeps the retry command and lands in the waiting bucket", () => {
  const composed = composeFailureNotification({
    draft: draft("transfer", { amount: "4", sourceChain: "BASE" }),
    message: "Gateway finality pending. Long explanation. More text.",
    errorData: { pendingAmount: "4", sourceChain: "BASE", retryCommand: "/transfer 4 to arc" },
    waitingGateway: true,
    fundsMoved: false,
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.equal(composed.type, "gateway_finality_pending");
  assert.ok(composed.title.includes("notify.waiting.title 4"));
  assert.ok(composed.body.includes("notify.waiting.body"));
  assert.equal(composed.metadata.retryCommand, "/transfer 4 to arc");
  assert.equal(notificationBucket(composed.type, composed.body), "waiting");

  const autoDeposit = composeFailureNotification({
    draft: draft("transfer", { amount: "4", sourceChain: "BASE" }),
    message: "whatever",
    errorData: { autoDeposit: true, autoDepositedAmount: "4", sourceChain: "BASE" },
    waitingGateway: true,
    fundsMoved: false,
    translate,
    chainLabel,
  });
  assert.ok(autoDeposit);
  assert.ok(autoDeposit.body.includes("notify.waiting.autoDeposit.body"));
});

test("plain failure gets a per-command title, a one-line summary, and a funds-moved note", () => {
  const composed = composeFailureNotification({
    draft: draft("pay", { recipient: "minh", amount: "3" }),
    message:
      "Insufficient gateway balance on the source chain. The transfer requires 3.05 USDC but only 1 USDC is available right now, please deposit first.",
    errorData: {},
    waitingGateway: false,
    fundsMoved: true,
    translate,
    chainLabel,
  });

  assert.ok(composed);
  assert.equal(composed.type, "command_failed");
  assert.ok(composed.title.includes("notify.failed.pay.title minh"));
  assert.ok(composed.body.includes("Insufficient gateway balance on the source chain."));
  assert.ok(!composed.body.includes("please deposit first"));
  assert.ok(composed.body.includes("notify.failed.fundsMoved"));
});

test("read-only commands never notify, on success or failure", () => {
  for (const command of ["balance", "history", "gas", "gateway", "contacts"] as const) {
    const readOnly = draft(command);
    assert.equal(shouldNotifyCommand(readOnly), false, command);
    assert.equal(
      composeSuccessNotification({ draft: readOnly, result: {}, translate, chainLabel }),
      null,
      command,
    );
    assert.equal(
      composeFailureNotification({
        draft: readOnly,
        message: "boom",
        errorData: {},
        waitingGateway: false,
        fundsMoved: false,
        translate,
        chainLabel,
      }),
      null,
      command,
    );
  }

  assert.equal(shouldNotifyCommand(draft("wallet", { action: "create" })), true);
  assert.equal(shouldNotifyCommand(draft("wallet", { action: "status" })), false);
});

test("notificationBucket is type-first with a regex fallback for unknown types", () => {
  // A success row whose body happens to say "failed" must stay in completed.
  assert.equal(notificationBucket("command_success", "0 failed"), "completed");
  assert.equal(notificationBucket("command_failed", "all good"), "attention");
  assert.equal(notificationBucket("gateway_deposit_pending", ""), "waiting");
  assert.equal(notificationBucket("gateway_finality_pending", ""), "waiting");
  assert.equal(notificationBucket("gateway_deposit_available", ""), "gateway");
  assert.equal(notificationBucket("payment_received", ""), "completed");
  assert.equal(notificationBucket("x402_payment", ""), "completed");
  // Legacy/unknown types keep the old body-sniffing behavior.
  assert.equal(notificationBucket("legacy_thing", "transfer failed badly"), "attention");
  assert.equal(notificationBucket("legacy_thing", "still pending"), "waiting");
  assert.equal(notificationBucket("legacy_thing", "gateway sync"), "gateway");
  assert.equal(notificationBucket("legacy_thing", "done"), "completed");
});

test("shortErrorSummary keeps the first sentence without splitting decimals, and caps length", () => {
  assert.equal(
    shortErrorSummary("Needs 3.05 USDC to settle. Try depositing first."),
    "Needs 3.05 USDC to settle.",
  );
  assert.equal(shortErrorSummary("  spaced   out\nmessage  "), "spaced out message");
  const long = `${"a".repeat(200)}. tail`;
  const capped = shortErrorSummary(long);
  assert.ok(capped.length <= 140);
  assert.ok(capped.endsWith("…"));
});

test("notificationAllocations tolerates malformed entries and formats amounts", () => {
  assert.deepEqual(notificationAllocations(null), []);
  assert.deepEqual(notificationAllocations({ sourceAllocations: null }), []);
  assert.deepEqual(
    notificationAllocations({
      sourceAllocations: [
        { sourceChain: "ARB", amount: "1234.5" },
        { sourceChain: "", amount: "1" },
        { sourceChain: "ARC", amount: "not-a-number" },
        { sourceChain: "ARC", amount: 0 },
        null,
      ],
    }),
    [{ sourceChain: "ARB", amount: "1,234.5" }],
  );
  assert.equal(
    allocationSummary(
      [
        { sourceChain: "ARB", amount: "3" },
        { sourceChain: "ARC", amount: "2" },
      ],
      chainLabel,
    ),
    "Arbitrum 3 + Arc 2",
  );
});
