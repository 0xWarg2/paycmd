import assert from "node:assert/strict";
import test from "node:test";

import { requirePaymentChains } from "./payment-chains.ts";

test("normalizes an explicit payment source and destination chain", () => {
  assert.deepEqual(requirePaymentChains({ sourceChain: "base", destinationChain: "arc" }), {
    sourceChain: "baseSepolia",
    destinationChain: "arcTestnet",
  });
});

test("rejects a payment when either chain is missing", () => {
  assert.throws(() => requirePaymentChains({ destinationChain: "arc" }), /sourceChain/);
  assert.throws(() => requirePaymentChains({ sourceChain: "base" }), /destinationChain/);
});

test("rejects unsupported payment chains instead of defaulting", () => {
  assert.throws(
    () => requirePaymentChains({ sourceChain: "mainnet", destinationChain: "arc" }),
    /sourceChain/,
  );
});
