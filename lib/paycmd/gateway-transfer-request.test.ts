import assert from "node:assert/strict";
import test from "node:test";

import {
  gatewayPaymentEstimateFields,
  gatewayUnifiedRequestFields,
} from "./gateway-transfer-request.ts";

test("forwards an allocation guard, fingerprint, and exact true preflight flag", () => {
  const allocationGuard = {
    amountAtomic: "5000000",
    allocations: [{ approvedMaxFeeAtomic: "63000" }],
  };
  const body = {
    allocationGuard,
    allocationFingerprint: "abc123",
    preflightOnly: true,
  };

  const fields = gatewayUnifiedRequestFields(body);

  assert.strictEqual(fields.allocationGuard, allocationGuard);
  assert.deepEqual(fields, body);
});

test("does not coerce falsey or string preflight values into read-only mode", () => {
  assert.deepEqual(gatewayUnifiedRequestFields({ preflightOnly: "true" }), {});
  assert.deepEqual(gatewayUnifiedRequestFields({ preflightOnly: false }), {});
  assert.deepEqual(gatewayUnifiedRequestFields({}), {});
});

test("forwards Circle Kit quote and idempotency fields", () => {
  const body = {
    quoteFingerprint: "1700000000000.abc123",
    operationId: "123e4567-e89b-42d3-a456-426614174000",
    engine: "circle_kit",
  };
  assert.deepEqual(gatewayUnifiedRequestFields(body), {
    quoteFingerprint: body.quoteFingerprint,
    operationId: body.operationId,
  });
});

test("omits malformed transport types without attempting guard validation", () => {
  assert.deepEqual(gatewayUnifiedRequestFields({
    allocationGuard: "not-an-object",
    allocationFingerprint: 123,
  }), {});
});

test("binds a payment preview quote to the resolved recipient address", () => {
  assert.deepEqual(gatewayPaymentEstimateFields({
    amount: "5",
    sourceMode: "unified",
    sourceChain: "arcTestnet",
    destinationChain: "baseSepolia",
    mintGasMode: "auto_forwarding",
    selectedSourceChains: ["arcTestnet", "baseSepolia"],
  }, "0x1234567890abcdef1234567890abcdef12345678"), {
    amount: "5",
    sourceMode: "unified",
    sourceChain: "arcTestnet",
    destinationChain: "baseSepolia",
    recipientAddress: "0x1234567890abcdef1234567890abcdef12345678",
    mintGasMode: "auto_forwarding",
    selectedSourceChains: ["arcTestnet", "baseSepolia"],
  });
});
