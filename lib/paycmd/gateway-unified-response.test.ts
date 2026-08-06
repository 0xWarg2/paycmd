import assert from "node:assert/strict";
import test from "node:test";

import { gatewayUnifiedEstimateResponse } from "./gateway-unified-response.ts";
import type { UnifiedGatewayQuote } from "./gateway-unified-server.ts";

test("serializes one complete Unified estimate for initial, refreshed, and preflight responses", () => {
  const allocationGuard = {
    amountAtomic: "5000000",
    destinationChain: "baseSepolia",
    recipientAddress: "0x1234567890abcdef1234567890abcdef12345678",
    mintGasMode: "auto_forwarding" as const,
    allocations: [{
      sourceChain: "arcTestnet",
      valueAtomic: "5000000",
      quotedMaxFeeAtomic: "54118",
      approvedMaxFeeAtomic: "63000",
    }],
  };
  const unified: UnifiedGatewayQuote = {
    sourceMode: "unified" as const,
    amountAtomic: 5_000_000n,
    destinationChain: "baseSepolia",
    recipient: allocationGuard.recipientAddress as `0x${string}`,
    mintGasMode: "auto_forwarding" as const,
    forwarding: true,
    sourceStatuses: [{
      chain: "arcTestnet",
      balanceAtomic: 6_000_000n,
      authorized: true,
      authorizationSupported: true,
    }],
    exclusions: [],
    allocations: [{
      sourceChain: "arcTestnet",
      sourceDomain: 26,
      balanceAtomic: 6_000_000n,
      estimatedFeeAtomic: 54_118n,
      quotedMaxFeeAtomic: 54_118n,
      maxFeeAtomic: 63_000n,
      valueAtomic: 5_000_000n,
      maximumDebitAtomic: 5_063_000n,
      priorityReason: "lowest_quoted_fee" as const,
    }],
    quote: {
      atomicFee: 54_118n,
      maxFeeAtomic: 63_000n,
      feeEstimateKind: "quoted_total" as const,
      feeBreakdown: { forwardingFeeAtomic: 20_000n, totalAtomic: 54_118n },
      intents: [{
        burnIntent: {},
        sourceDomain: 26,
        maxBlockHeight: 123n,
        maxFeeAtomic: 63_000n,
        estimatedFeeAtomic: 54_118n,
      }],
    },
    burnIntents: [],
    readyBalanceAtomic: 6_000_000n,
    maximumUsableCapacityAtomic: 5_937_000n,
    allocationGuard,
    totalFeeBufferAtomic: 8_882n,
    fingerprint: "abc123",
  };

  const response = gatewayUnifiedEstimateResponse(unified, 5_000_000n);

  assert.equal(response.amount, 5);
  assert.equal(response.totalEstimatedFee, 0.054118);
  assert.equal(response.totalFeeBuffer, 0.008882);
  assert.equal(response.maximumGatewayFee, 0.063);
  assert.equal(response.maximumDebit, 5.063);
  assert.equal(response.allocations[0]!.maximumFeeReserve, 0.063);
  assert.equal(response.allocations[0]!.maximumDebit, 5.063);
  assert.equal(response.fingerprint, "abc123");
  assert.strictEqual(response.allocationGuard, allocationGuard);
  assert.deepEqual(response.feeBreakdown, { forwardingFee: 0.02, total: 0.054118 });
});
