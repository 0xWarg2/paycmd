import assert from "node:assert/strict";
import test from "node:test";

import { formatNativeGasBalance } from "./native-gas.ts";
import { web3Chains } from "./web3-chains.ts";

test("Arc native gas uses 18 internal decimals", () => {
  assert.equal(web3Chains.arcTestnet.nativeCurrency.decimals, 18);
  assert.equal(formatNativeGasBalance(1_000_000_000_000_000_000n, "arcTestnet"), "1 USDC");
});

test("native gas formatting preserves a useful precision for tiny balances", () => {
  assert.equal(formatNativeGasBalance(1n, "arcTestnet"), "0.000000000000000001 USDC");
  assert.equal(formatNativeGasBalance(1_000_000_000_000n, "baseSepolia"), "0.000001 ETH");
});
