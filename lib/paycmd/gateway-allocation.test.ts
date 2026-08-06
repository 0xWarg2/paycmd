import assert from "node:assert/strict";
import test from "node:test";

import {
  GatewayUnifiedInsufficientBalanceError,
  allocateGatewaySources,
  withGatewayApprovedFeeCeilings,
} from "./gateway-allocation.ts";

const candidate = (
  sourceChain: string,
  balanceAtomic: bigint,
  estimatedFeeAtomic: bigint,
  maxFeeAtomic = estimatedFeeAtomic,
) => ({
  sourceChain,
  sourceDomain: sourceChain.charCodeAt(0),
  balanceAtomic,
  estimatedFeeAtomic,
  maxFeeAtomic,
});

test("allocates lower quoted-cost Gateway sources first", () => {
  const plan = allocateGatewaySources({
    amountAtomic: 8_000_000n,
    candidates: [
      candidate("baseSepolia", 6_010_000n, 10_000n),
      candidate("arcTestnet", 6_005_000n, 5_000n),
    ],
  });

  assert.deepEqual(plan.allocations.map(({ sourceChain, valueAtomic }) => ({ sourceChain, valueAtomic })), [
    { sourceChain: "arcTestnet", valueAtomic: 6_000_000n },
    { sourceChain: "baseSepolia", valueAtomic: 2_000_000n },
  ]);
  assert.equal(plan.totalMaxFeeAtomic, 15_000n);
  assert.equal(plan.maximumDebitAtomic, 8_015_000n);
});

test("uses the largest usable balance as the tie breaker to reduce intent count", () => {
  const plan = allocateGatewaySources({
    amountAtomic: 5_000_000n,
    candidates: [
      candidate("baseSepolia", 3_001_000n, 1_000n),
      candidate("arcTestnet", 6_001_000n, 1_000n),
    ],
  });

  assert.deepEqual(plan.allocations.map((allocation) => allocation.sourceChain), ["arcTestnet"]);
  assert.equal(plan.allocations[0]?.valueAtomic, 5_000_000n);
});

test("respects explicit source selections and subtracts each intent maxFee reserve", () => {
  const plan = allocateGatewaySources({
    amountAtomic: 2_500_000n,
    selectedSourceChains: ["baseSepolia"],
    candidates: [
      candidate("baseSepolia", 3_000_000n, 10_000n, 500_000n),
      candidate("arcTestnet", 10_000_000n, 1_000n),
    ],
  });

  assert.deepEqual(plan.allocations.map((allocation) => allocation.sourceChain), ["baseSepolia"]);
  assert.equal(plan.allocations[0]?.valueAtomic, 2_500_000n);
  assert.equal(plan.allocations[0]?.maximumDebitAtomic, 3_000_000n);
  assert.equal(plan.maximumUsableCapacityAtomic, 2_500_000n);
});

test("reserves the approved fee ceiling before greedily filling a source", () => {
  const quotedCandidates = [
    candidate("arcTestnet", 3_060_000n, 54_118n),
    candidate("baseSepolia", 3_000_000n, 60_000n),
  ];

  const plan = allocateGatewaySources({
    amountAtomic: 3_000_000n,
    candidates: withGatewayApprovedFeeCeilings(quotedCandidates),
  });

  assert.deepEqual(plan.allocations.map((allocation) => ({
    sourceChain: allocation.sourceChain,
    valueAtomic: allocation.valueAtomic,
    quotedMaxFeeAtomic: allocation.quotedMaxFeeAtomic,
    maxFeeAtomic: allocation.maxFeeAtomic,
  })), [
    {
      sourceChain: "arcTestnet",
      valueAtomic: 2_997_000n,
      quotedMaxFeeAtomic: 54_118n,
      maxFeeAtomic: 63_000n,
    },
    {
      sourceChain: "baseSepolia",
      valueAtomic: 3_000n,
      quotedMaxFeeAtomic: 60_000n,
      maxFeeAtomic: 69_000n,
    },
  ]);
  assert.equal(plan.maximumDebitAtomic, 3_132_000n);
  assert.deepEqual(quotedCandidates.map((item) => item.maxFeeAtomic), [54_118n, 60_000n]);
});

test("reports ready balance and maximum usable capacity when unified balance is insufficient", () => {
  assert.throws(
    () => allocateGatewaySources({
      amountAtomic: 5_000_000n,
      candidates: [
        candidate("baseSepolia", 3_000_000n, 10_000n, 500_000n),
        candidate("arcTestnet", 2_000_000n, 10_000n, 500_000n),
      ],
    }),
    (error: unknown) => {
      assert.ok(error instanceof GatewayUnifiedInsufficientBalanceError);
      assert.equal(error.code, "GATEWAY_INSUFFICIENT_UNIFIED_BALANCE");
      assert.equal(error.readyBalanceAtomic, 5_000_000n);
      assert.equal(error.maximumUsableCapacityAtomic, 4_000_000n);
      assert.equal(error.shortfallAtomic, 1_000_000n);
      return true;
    },
  );
});

test("reports ready balance even when fee reserves leave no usable capacity", () => {
  assert.throws(
    () => allocateGatewaySources({
      amountAtomic: 1n,
      candidates: [candidate("baseSepolia", 500_000n, 100_000n, 500_000n)],
    }),
    (error: unknown) => {
      assert.ok(error instanceof GatewayUnifiedInsufficientBalanceError);
      assert.equal(error.readyBalanceAtomic, 500_000n);
      assert.equal(error.maximumUsableCapacityAtomic, 0n);
      return true;
    },
  );
});

test("never emits more than Circle's 16-intent limit", () => {
  const candidates = Array.from({ length: 17 }, (_, index) =>
    candidate(`chain-${String(index).padStart(2, "0")}`, 1_001_000n, 1_000n));

  assert.throws(
    () => allocateGatewaySources({ amountAtomic: 17_000_000n, candidates }),
    (error: unknown) => {
      assert.ok(error instanceof GatewayUnifiedInsufficientBalanceError);
      assert.equal(error.maximumUsableCapacityAtomic, 16_000_000n);
      assert.equal(error.exclusions.some((item) => item.reason === "intent_limit"), true);
      return true;
    },
  );
});
