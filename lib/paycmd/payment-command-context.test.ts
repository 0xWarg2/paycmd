import assert from "node:assert/strict";
import test from "node:test";

import {
  completePaymentChainFollowUp,
  paymentWaitingForChains,
} from "./payment-command-context.ts";

test("completes a pending pay command from a source and destination follow-up", () => {
  const completed = completePaymentChainFollowUp(
    "from base to arc",
    [
      { role: "user", text: "pay 1 USDC to Lecter Vu" },
      {
        role: "assistant",
        text: "Which source and destination chains should this payment use?",
      },
    ],
  );

  assert.equal(completed?.raw, "/pay 1 to Lecter Vu on arc from base");
  assert.equal(completed?.status, "draft_ready");
  assert.equal(completed?.fields.sourceChain, "baseSepolia");
  assert.equal(completed?.fields.destinationChain, "arcTestnet");
});

test("does not treat an unrelated chain message as a payment follow-up", () => {
  assert.equal(
    completePaymentChainFollowUp("from base to arc", [
      { role: "user", text: "show my balance" },
    ]),
    null,
  );
});

test("recognizes a pay request that has the recipient but is waiting for both chains", () => {
  const pending = paymentWaitingForChains("pay 1 USDC to Lecter Vu");

  assert.equal(pending?.fields.recipient, "Lecter Vu");
  assert.deepEqual(pending?.missingFields, ["sourceChain", "destinationChain"]);
  assert.equal(paymentWaitingForChains("pay 1 to Lecter Vu on arc from base"), null);
  assert.equal(paymentWaitingForChains("pay 1 to Lecter Vu on arc"), null);
});
