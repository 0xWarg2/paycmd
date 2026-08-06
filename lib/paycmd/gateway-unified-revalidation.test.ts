import assert from "node:assert/strict";
import test from "node:test";

import {
  GatewayQuoteChangedError,
  revalidateUnifiedGatewayTransfer,
} from "./gateway-unified-revalidation.ts";

const guard = {
  amountAtomic: "5000000",
  destinationChain: "baseSepolia",
  recipientAddress: "0x1234567890abcdef1234567890abcdef12345678",
  mintGasMode: "auto_forwarding" as const,
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

function request() {
  return {
    guard,
    amountAtomic: 5_000_000n,
    destinationChain: "baseSepolia",
    recipientAddress: guard.recipientAddress,
    mintGasMode: "auto_forwarding" as const,
  };
}

test("re-estimates exact guarded allocations and preserves fresh intent metadata", async () => {
  let estimatedAllocations: Array<{ sourceChain: string; valueAtomic: bigint }> = [];
  const result = await revalidateUnifiedGatewayTransfer(request(), {
    loadSourceStates: async () => [
      { sourceChain: "arcTestnet", balanceAtomic: 3_063_000n, authorized: true },
      { sourceChain: "baseSepolia", balanceAtomic: 2_015_000n, authorized: true },
    ],
    estimateExact: async (input) => {
      estimatedAllocations = input.allocations;
      return {
        atomicFee: 65_123n,
        value: { circleQuoteId: "fresh-quote" },
        intents: [
          {
            sourceChain: "arcTestnet",
            requiredMaxFeeAtomic: 54_123n,
            maxBlockHeight: 111n,
            value: { intentId: "arc-fresh" },
          },
          {
            sourceChain: "baseSepolia",
            requiredMaxFeeAtomic: 10_000n,
            maxBlockHeight: 222n,
            value: { intentId: "base-fresh" },
          },
        ],
      };
    },
  });

  assert.deepEqual(estimatedAllocations, [
    { sourceChain: "arcTestnet", valueAtomic: 3_000_000n },
    { sourceChain: "baseSepolia", valueAtomic: 2_000_000n },
  ]);
  assert.deepEqual(result.allocations.map((allocation) => ({
    sourceChain: allocation.sourceChain,
    approvedMaxFeeAtomic: allocation.approvedMaxFeeAtomic,
    freshRequiredMaxFeeAtomic: allocation.freshRequiredMaxFeeAtomic,
  })), [
    {
      sourceChain: "arcTestnet",
      approvedMaxFeeAtomic: 63_000n,
      freshRequiredMaxFeeAtomic: 54_123n,
    },
    {
      sourceChain: "baseSepolia",
      approvedMaxFeeAtomic: 15_000n,
      freshRequiredMaxFeeAtomic: 10_000n,
    },
  ]);
  assert.equal(result.estimate.intents[0]!.maxBlockHeight, 111n);
  assert.deepEqual(result.estimate.value, { circleQuoteId: "fresh-quote" });
});

test("rejects a mismatched Circle intent order before returning an executable quote", async () => {
  await assert.rejects(
    revalidateUnifiedGatewayTransfer(request(), {
      loadSourceStates: async () => [
        { sourceChain: "arcTestnet", balanceAtomic: 3_063_000n, authorized: true },
        { sourceChain: "baseSepolia", balanceAtomic: 2_015_000n, authorized: true },
      ],
      estimateExact: async () => ({
        atomicFee: 65_123n,
        value: null,
        intents: [
          {
            sourceChain: "baseSepolia",
            requiredMaxFeeAtomic: 10_000n,
            maxBlockHeight: 222n,
            value: null,
          },
          {
            sourceChain: "arcTestnet",
            requiredMaxFeeAtomic: 54_123n,
            maxBlockHeight: 111n,
            value: null,
          },
        ],
      }),
    }),
    (error: unknown) => error instanceof GatewayQuoteChangedError &&
      error.reason === "allocation_invalid",
  );
});

test("returns typed refresh reasons for changed fee, balance, and authorization", async () => {
  const cases = [
    {
      reason: "fee_ceiling_exceeded",
      sources: [
        { sourceChain: "arcTestnet", balanceAtomic: 3_063_000n, authorized: true },
        { sourceChain: "baseSepolia", balanceAtomic: 2_015_000n, authorized: true },
      ],
      required: 63_001n,
    },
    {
      reason: "balance_changed",
      sources: [
        { sourceChain: "arcTestnet", balanceAtomic: 3_062_999n, authorized: true },
        { sourceChain: "baseSepolia", balanceAtomic: 2_015_000n, authorized: true },
      ],
      required: 54_123n,
    },
    {
      reason: "authorization_changed",
      sources: [
        { sourceChain: "arcTestnet", balanceAtomic: 3_063_000n, authorized: false },
        { sourceChain: "baseSepolia", balanceAtomic: 2_015_000n, authorized: true },
      ],
      required: 54_123n,
    },
  ] as const;

  for (const testCase of cases) {
    await assert.rejects(
      revalidateUnifiedGatewayTransfer(request(), {
        loadSourceStates: async () => [...testCase.sources],
        estimateExact: async () => ({
          atomicFee: 65_123n,
          value: null,
          intents: [
            {
              sourceChain: "arcTestnet",
              requiredMaxFeeAtomic: testCase.required,
              maxBlockHeight: 111n,
              value: null,
            },
            {
              sourceChain: "baseSepolia",
              requiredMaxFeeAtomic: 10_000n,
              maxBlockHeight: 222n,
              value: null,
            },
          ],
        }),
      }),
      (error: unknown) => error instanceof GatewayQuoteChangedError &&
        error.reason === testCase.reason,
    );
  }
});
