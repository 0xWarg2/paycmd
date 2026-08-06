import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGatewayAllocationGuard,
  gatewayAllocationGuardFingerprint,
  parseGatewayAllocationGuard,
  validateGatewayAllocationGuardCurrentState,
  type GatewayAllocationGuard,
} from "./gateway-allocation-guard.ts";

const RECIPIENT = "0x1234567890abcdef1234567890abcdef12345678";

function guardFixture(): GatewayAllocationGuard {
  return {
    amountAtomic: "5000000",
    destinationChain: "baseSepolia",
    recipientAddress: RECIPIENT,
    mintGasMode: "auto_forwarding",
    allocations: [
      {
        sourceChain: "arcTestnet",
        valueAtomic: "3000000",
        quotedMaxFeeAtomic: "54118",
        approvedMaxFeeAtomic: "63000",
      },
      {
        sourceChain: "baseSepolia",
        valueAtomic: "2000000",
        quotedMaxFeeAtomic: "10000",
        approvedMaxFeeAtomic: "15000",
      },
    ],
  };
}

test("builds atomic guard fields from bigint allocations and normalizes the recipient", () => {
  assert.deepEqual(buildGatewayAllocationGuard({
    amountAtomic: 5_000_000n,
    destinationChain: "baseSepolia",
    recipientAddress: RECIPIENT.toUpperCase().replace("0X", "0x"),
    mintGasMode: "auto_forwarding",
    allocations: [
      {
        sourceChain: "arcTestnet",
        valueAtomic: 3_000_000n,
        quotedMaxFeeAtomic: 54_118n,
        approvedMaxFeeAtomic: 63_000n,
      },
      {
        sourceChain: "baseSepolia",
        valueAtomic: 2_000_000n,
        quotedMaxFeeAtomic: 10_000n,
        approvedMaxFeeAtomic: 15_000n,
      },
    ],
  }), guardFixture());
});

test("refuses to construct a guard with a ceiling outside the bounded fee policy", () => {
  assert.throws(() => buildGatewayAllocationGuard({
    amountAtomic: 5_000_000n,
    destinationChain: "baseSepolia",
    recipientAddress: RECIPIENT,
    mintGasMode: "auto_forwarding",
    allocations: [{
      sourceChain: "arcTestnet",
      valueAtomic: 5_000_000n,
      quotedMaxFeeAtomic: 54_118n,
      approvedMaxFeeAtomic: 64_000n,
    }],
  }), /outside policy/i);
});

test("parses a guard without mutating it and normalizes the recipient address", () => {
  const input = guardFixture();
  input.recipientAddress = RECIPIENT.toUpperCase().replace("0X", "0x");
  const snapshot = structuredClone(input);

  const parsed = parseGatewayAllocationGuard(input);

  assert.deepEqual(input, snapshot);
  assert.equal(parsed.recipientAddress, RECIPIENT);
  assert.notEqual(parsed, input);
  assert.notEqual(parsed.allocations, input.allocations);
});

test("rejects malformed atomic values, duplicate sources, unsupported chains, and invalid modes", () => {
  const invalidCases: Array<[string, (guard: GatewayAllocationGuard) => void]> = [
    ["positive", (guard) => { guard.amountAtomic = "0"; }],
    ["decimal string", (guard) => { guard.allocations[0]!.valueAtomic = "1.5"; }],
    ["duplicate", (guard) => { guard.allocations[1]!.sourceChain = "arcTestnet"; }],
    ["supported", (guard) => { guard.destinationChain = "ethereumMainnet"; }],
    ["recipient", (guard) => { guard.recipientAddress = "0x1234"; }],
    ["mint gas mode", (guard) => { guard.mintGasMode = "sponsored" as "manual"; }],
    ["sum", (guard) => { guard.allocations[1]!.valueAtomic = "1999999"; }],
  ];

  for (const [message, mutate] of invalidCases) {
    const guard = guardFixture();
    mutate(guard);
    assert.throws(() => parseGatewayAllocationGuard(guard), new RegExp(message, "i"));
  }

  const tooMany = guardFixture();
  tooMany.allocations = Array.from({ length: 17 }, (_, index) => ({
    ...tooMany.allocations[0]!,
    sourceChain: `source-${index}`,
  }));
  assert.throws(() => parseGatewayAllocationGuard(tooMany), /16/);
});

test("rejects JavaScript numbers instead of losing atomic precision", () => {
  const guard = guardFixture() as unknown as Record<string, unknown>;
  guard.amountAtomic = 5_000_000;
  assert.throws(() => parseGatewayAllocationGuard(guard), /decimal string/i);
});

test("fingerprints normalized guard state including recipient, order, quote, and ceiling", () => {
  const base = guardFixture();
  const uppercase = guardFixture();
  uppercase.recipientAddress = RECIPIENT.toUpperCase().replace("0X", "0x");
  assert.equal(
    gatewayAllocationGuardFingerprint(base),
    gatewayAllocationGuardFingerprint(uppercase),
  );

  const mutations: GatewayAllocationGuard[] = [
    { ...guardFixture(), recipientAddress: "0x2234567890abcdef1234567890abcdef12345678" },
    { ...guardFixture(), allocations: [...guardFixture().allocations].reverse() },
    {
      ...guardFixture(),
      allocations: guardFixture().allocations.map((allocation, index) => index === 0
        ? { ...allocation, quotedMaxFeeAtomic: "54119" }
        : allocation),
    },
    {
      ...guardFixture(),
      allocations: guardFixture().allocations.map((allocation, index) => index === 0
        ? { ...allocation, approvedMaxFeeAtomic: "64000" }
        : allocation),
    },
  ];

  for (const mutation of mutations) {
    assert.notEqual(
      gatewayAllocationGuardFingerprint(base),
      gatewayAllocationGuardFingerprint(mutation),
    );
  }
});

function currentState(overrides: Partial<Parameters<typeof validateGatewayAllocationGuardCurrentState>[0]> = {}) {
  return {
    guard: guardFixture(),
    amountAtomic: 5_000_000n,
    destinationChain: "baseSepolia",
    recipientAddress: RECIPIENT,
    mintGasMode: "auto_forwarding" as const,
    freshTotalFeeAtomic: 65_123n,
    sources: [
      {
        sourceChain: "arcTestnet",
        balanceAtomic: 3_063_000n,
        authorized: true,
        freshRequiredMaxFeeAtomic: 54_123n,
      },
      {
        sourceChain: "baseSepolia",
        balanceAtomic: 2_015_000n,
        authorized: true,
        freshRequiredMaxFeeAtomic: 10_000n,
      },
    ],
    ...overrides,
  };
}

test("accepts a fresh fee increase that remains below every approved ceiling", () => {
  const result = validateGatewayAllocationGuardCurrentState(currentState());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.allocations.map((allocation) => ({
    sourceChain: allocation.sourceChain,
    approvedMaxFeeAtomic: allocation.approvedMaxFeeAtomic,
  })), [
    { sourceChain: "arcTestnet", approvedMaxFeeAtomic: 63_000n },
    { sourceChain: "baseSepolia", approvedMaxFeeAtomic: 15_000n },
  ]);
});

test("accepts a fee decrease without invalidating the previously approved policy ceiling", () => {
  const input = currentState();
  input.sources[0]!.freshRequiredMaxFeeAtomic = 1_000n;
  input.freshTotalFeeAtomic = 11_000n;
  assert.equal(validateGatewayAllocationGuardCurrentState(input).ok, true);
});

test("rejects a modified ceiling that was not derived from its guarded quote", () => {
  const guard = guardFixture();
  guard.allocations[0]!.approvedMaxFeeAtomic = "64000";
  assert.deepEqual(
    validateGatewayAllocationGuardCurrentState(currentState({ guard })),
    { ok: false, reason: "allocation_invalid" },
  );
});

test("rejects current authorization, balance, per-intent fee, total fee, and command changes", () => {
  const authorization = currentState();
  authorization.sources[0]!.authorized = false;
  assert.deepEqual(validateGatewayAllocationGuardCurrentState(authorization), {
    ok: false,
    reason: "authorization_changed",
  });

  const balance = currentState();
  balance.sources[0]!.balanceAtomic = 3_062_999n;
  assert.deepEqual(validateGatewayAllocationGuardCurrentState(balance), {
    ok: false,
    reason: "balance_changed",
  });

  const intentFee = currentState();
  intentFee.sources[0]!.freshRequiredMaxFeeAtomic = 63_001n;
  assert.deepEqual(validateGatewayAllocationGuardCurrentState(intentFee), {
    ok: false,
    reason: "fee_ceiling_exceeded",
  });

  assert.deepEqual(validateGatewayAllocationGuardCurrentState(currentState({
    freshTotalFeeAtomic: 78_001n,
  })), {
    ok: false,
    reason: "fee_ceiling_exceeded",
  });

  assert.deepEqual(validateGatewayAllocationGuardCurrentState(currentState({
    recipientAddress: "0x2234567890abcdef1234567890abcdef12345678",
  })), {
    ok: false,
    reason: "allocation_invalid",
  });
});
