import assert from "node:assert/strict";
import test from "node:test";

import { parsePayCmd, suggestedPayCommandFromTransfer } from "./commands.ts";

test("pay requires both the source and destination chains", () => {
  const draft = parsePayCmd("/pay 1 USDC to Lecter Vu");

  assert.equal(draft.command, "pay");
  assert.deepEqual(draft.missingFields, ["sourceChain", "destinationChain"]);
  assert.equal(draft.status, "needs_input");
  assert.equal(draft.summary.includes("default chain"), false);
});

test("pay becomes ready only after both chains are explicit", () => {
  const draft = parsePayCmd("/pay 1 USDC to Lecter Vu on arc from base");

  assert.equal(draft.status, "draft_ready");
  assert.equal(draft.fields.sourceChain, "baseSepolia");
  assert.equal(draft.fields.destinationChain, "arcTestnet");
});

test("transfer from gateway selects unified source mode without requiring one source chain", () => {
  const draft = parsePayCmd("/transfer 5 USDC from gateway to arc");

  assert.equal(draft.status, "draft_ready");
  assert.equal(draft.fields.sourceMode, "unified");
  assert.equal(draft.fields.sourceChain, "");
  assert.equal(draft.fields.destinationChain, "arcTestnet");
  assert.deepEqual(draft.missingFields, []);
});

test("transfer preserves a trailing contact as an unsupported recipient for the safety UI", () => {
  const draft = parsePayCmd("/transfer 5 USDC from arc to arc to Lecter Vu");

  assert.equal(draft.status, "draft_ready");
  assert.equal(draft.fields.destinationChain, "arcTestnet");
  assert.equal(draft.fields.unsupportedRecipient, "Lecter Vu");
  assert.equal(
    suggestedPayCommandFromTransfer(draft),
    "/pay 5 USDC to Lecter Vu on arc from arc",
  );
});

test("transfer recognizes pay-style recipient syntax so the safety UI can block it", () => {
  const draft = parsePayCmd("/transfer 5 USDC to Lecter Vu on arc from base");

  assert.equal(draft.status, "draft_ready");
  assert.equal(draft.fields.sourceChain, "baseSepolia");
  assert.equal(draft.fields.destinationChain, "arcTestnet");
  assert.equal(draft.fields.unsupportedRecipient, "Lecter Vu");
});

test("transfer does not confuse mint gas modifiers with an external recipient", () => {
  const manual = parsePayCmd("/transfer 5 USDC from base to arc manual gas");
  const automatic = parsePayCmd("/transfer 5 USDC from base to arc auto forwarding");
  const polite = parsePayCmd("/transfer 5 USDC from base to arc please");

  assert.equal(manual.fields.unsupportedRecipient, "");
  assert.equal(automatic.fields.unsupportedRecipient, "");
  assert.equal(polite.fields.unsupportedRecipient, "");
  assert.equal(suggestedPayCommandFromTransfer(manual), "");
});

test("transfer recommends pay for an external wallet address", () => {
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  const draft = parsePayCmd(`/transfer 5 USDC from gateway to arc to ${address}`);

  assert.equal(
    suggestedPayCommandFromTransfer(draft),
    `/pay 5 USDC to ${address} on arc from gateway`,
  );
});

test("pay from gateway selects unified source mode while scoped pay remains unchanged", () => {
  const unified = parsePayCmd("/pay 5 USDC to Minh on arc from gateway");
  const scoped = parsePayCmd("/pay 5 USDC to Minh on arc from base");

  assert.equal(unified.status, "draft_ready");
  assert.equal(unified.fields.sourceMode, "unified");
  assert.equal(unified.fields.sourceChain, "");
  assert.deepEqual(unified.missingFields, []);

  assert.equal(scoped.status, "draft_ready");
  assert.equal(scoped.fields.sourceMode, "scoped");
  assert.equal(scoped.fields.sourceChain, "baseSepolia");
});
