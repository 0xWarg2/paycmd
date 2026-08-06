import assert from "node:assert/strict";
import test from "node:test";

import {
  gatewayApprovedFeeWithinPolicy,
  gatewayApprovedMaxFee,
  gatewayFeeHeadroom,
} from "./gateway-fee-headroom.ts";

test("applies the minimum headroom and rounds the approved ceiling to 0.001 USDC", () => {
  assert.equal(gatewayApprovedMaxFee(1_000n), 6_000n);
  assert.equal(gatewayFeeHeadroom(1_000n), 5_000n);
});

test("applies proportional headroom before rounding the approved ceiling", () => {
  assert.equal(gatewayApprovedMaxFee(54_118n), 63_000n);
  assert.equal(gatewayFeeHeadroom(54_118n), 8_882n);
});

test("caps raw headroom at 0.05 USDC", () => {
  assert.equal(gatewayApprovedMaxFee(1_000_000n), 1_050_000n);
  assert.equal(gatewayApprovedMaxFee(1_000_001n), 1_051_000n);
});

test("accepts only the exact approved ceiling derived from the quoted requirement", () => {
  assert.equal(gatewayApprovedFeeWithinPolicy(54_123n, 63_000n), true);
  assert.equal(gatewayApprovedFeeWithinPolicy(63_001n, 63_000n), false);
  assert.equal(gatewayApprovedFeeWithinPolicy(1_000n, 100_000n), false);
});

test("rejects non-positive quoted requirements", () => {
  assert.throws(() => gatewayApprovedMaxFee(0n), /positive/i);
  assert.throws(() => gatewayApprovedMaxFee(-1n), /positive/i);
  assert.equal(gatewayApprovedFeeWithinPolicy(0n, 5_000n), false);
});
