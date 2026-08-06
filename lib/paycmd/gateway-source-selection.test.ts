import assert from "node:assert/strict";
import test from "node:test";

import {
  gatewaySourceSelectionRows,
  recommendedGatewaySourceChains,
  toggleGatewayCustomSource,
} from "./gateway-source-selection.ts";

const source = (sourceChain: string, readyBalance: number, usable = true) => ({
  sourceChain,
  readyBalance,
  authorized: true,
  authorizationSupported: true,
  usable,
  exclusionReason: usable ? null : "delegate_not_supported_by_current_circle_sdk",
  selected: usable,
  allocated: false,
});

const allocation = (
  sourceChain: string,
  amount: number,
  readyBalance: number,
  maximumFeeReserve: number,
) => ({
  sourceChain,
  amount,
  readyBalance,
  estimatedFee: maximumFeeReserve,
  maximumFeeReserve,
  maximumDebit: amount + maximumFeeReserve,
  maxBlockHeight: "100",
  priorityReason: "lowest_quoted_fee",
  authorized: true,
  delegateRequired: false,
});

test("puts allocated sources first in BurnIntentSet order and checks only allocations in automatic mode", () => {
  const rows = gatewaySourceSelectionRows({
    sources: [
      source("arcTestnet", 2.887169),
      source("baseSepolia", 10.438783),
      source("optimismSepolia", 5),
      source("unichainSepolia", 5),
    ],
    allocations: [
      allocation("unichainSepolia", 4.945882, 5, 0.054118),
      allocation("optimismSepolia", 0.054118, 5, 0.001653),
    ],
    customSourceChains: null,
  });

  assert.deepEqual(rows.map((row) => row.sourceChain), [
    "unichainSepolia",
    "optimismSepolia",
    "baseSepolia",
    "arcTestnet",
  ]);
  assert.deepEqual(rows.map((row) => row.checked), [true, true, false, false]);
  assert.deepEqual(rows.map((row) => row.allocationOrder), [1, 2, null, null]);
});

test("uses explicit custom checks and keeps unavailable sources disabled at the end", () => {
  const unavailable = {
    ...source("hyperEvmTestnet", 20, false),
    authorized: false,
    authorizationSupported: false,
  };
  const rows = gatewaySourceSelectionRows({
    sources: [source("arcTestnet", 2.887169), unavailable, source("baseSepolia", 10.438783)],
    allocations: [allocation("baseSepolia", 5, 10.438783, 0.054118)],
    customSourceChains: ["arcTestnet"],
  });

  assert.deepEqual(
    rows.map(({ sourceChain, checked, disabled }) => ({ sourceChain, checked, disabled })),
    [
      { sourceChain: "baseSepolia", checked: false, disabled: false },
      { sourceChain: "arcTestnet", checked: true, disabled: false },
      { sourceChain: "hyperEvmTestnet", checked: false, disabled: true },
    ],
  );
  assert.deepEqual(rows.map((row) => row.selectionState), [
    "allocated",
    "available",
    "unavailable",
  ]);
});

test("does not mutate estimate source or allocation arrays while ordering rows", () => {
  const sources = [source("arcTestnet", 2), source("baseSepolia", 10)];
  const allocations = [allocation("baseSepolia", 5, 10, 0.05)];
  const originalSources = structuredClone(sources);
  const originalAllocations = structuredClone(allocations);

  gatewaySourceSelectionRows({ sources, allocations, customSourceChains: null });

  assert.deepEqual(sources, originalSources);
  assert.deepEqual(allocations, originalAllocations);
});

test("seeds custom selection from recommended allocations in BurnIntentSet order", () => {
  assert.deepEqual(
    recommendedGatewaySourceChains([
      allocation("unichainSepolia", 4.945882, 5, 0.054118),
      allocation("optimismSepolia", 0.054118, 5, 0.001653),
      allocation("unichainSepolia", 0.1, 5, 0.01),
    ]),
    ["unichainSepolia", "optimismSepolia"],
  );
});

test("toggles custom sources without allowing the final source to be removed", () => {
  assert.deepEqual(
    toggleGatewayCustomSource({
      currentSourceChains: ["unichainSepolia", "optimismSepolia"],
      sourceChain: "unichainSepolia",
    }),
    ["optimismSepolia"],
  );
  assert.deepEqual(
    toggleGatewayCustomSource({
      currentSourceChains: ["optimismSepolia"],
      sourceChain: "optimismSepolia",
    }),
    ["optimismSepolia"],
  );
  assert.deepEqual(
    toggleGatewayCustomSource({
      currentSourceChains: ["optimismSepolia"],
      sourceChain: "baseSepolia",
    }),
    ["optimismSepolia", "baseSepolia"],
  );
});
