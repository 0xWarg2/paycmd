import assert from "node:assert/strict";
import test from "node:test";

import { normalizeChain } from "./chains.ts";
import {
  balanceChainFromDraft,
  balanceRequestBody,
  executionBalanceChainFilter,
} from "./balance-scope.ts";

test("a named unified balance command sends and persists only its requested chain", () => {
  const draft = {
    command: "balance",
    fields: { chain: "arcTestnet" },
  };

  assert.equal(balanceChainFromDraft(draft), "arcTestnet");
  assert.deepEqual(balanceRequestBody(draft), { chain: "arcTestnet" });
  assert.equal(executionBalanceChainFilter(draft), "arcTestnet");
});

test("wallet and gateway balance commands use the same chain scope", () => {
  assert.deepEqual(
    balanceRequestBody({ command: "wallet", fields: { action: "balance", chain: "baseSepolia" } }),
    { chain: "baseSepolia" },
  );
  assert.deepEqual(
    balanceRequestBody({ command: "gateway", fields: { action: "balance", chain: "avalancheFuji" } }),
    { chain: "avalancheFuji" },
  );
});

test("a balance command without a chain keeps the all-chain request", () => {
  const draft = { command: "balance", fields: {} };

  assert.deepEqual(balanceRequestBody(draft), {});
  assert.equal(executionBalanceChainFilter(draft), undefined);
});

test("non-balance commands never acquire a balance scope", () => {
  assert.deepEqual(
    balanceRequestBody({ command: "transfer", fields: { chain: "arcTestnet" } }),
    {},
  );
});

test("representative testnet aliases normalize to their supported chain keys", () => {
  assert.equal(normalizeChain("arc"), "arcTestnet");
  assert.equal(normalizeChain("base"), "baseSepolia");
  assert.equal(normalizeChain("arbitrum-sepolia"), "arbitrumSepolia");
  assert.equal(normalizeChain("fuji"), "avalancheFuji");
});
