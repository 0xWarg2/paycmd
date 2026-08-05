import assert from "node:assert/strict";
import test from "node:test";

import { parsePayCmd } from "./commands.ts";

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
