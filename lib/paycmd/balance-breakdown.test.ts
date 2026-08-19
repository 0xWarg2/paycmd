import assert from "node:assert/strict";
import test from "node:test";

import { balanceBreakdown } from "./balance-breakdown.ts";

const multiChainResult = {
  balances: [
    {
      chainBalances: [
        { chain: "baseSepolia", balance: 27 },
        { chain: "arcTestnet", balance: 1 },
        { chain: "sepolia", balance: 0 },
      ],
      gatewayBalances: [
        { chain: "baseSepolia", balance: 3.802502 },
        { chain: "arcTestnet", balance: 19.826451 },
      ],
    },
  ],
};

test("a scoped breakdown totals and returns only the requested testnet", () => {
  assert.deepEqual(balanceBreakdown(multiChainResult, "arcTestnet"), {
    scaTotal: 1,
    gatewayTotal: 19.826451,
    total: 20.826451,
    rows: [{ chain: "arcTestnet", sca: 1, gateway: 19.826451, scaUnreadable: false }],
    chainsChecked: 1,
  });
});

test("a scoped zero balance still renders one row for the checked testnet", () => {
  const result = {
    balances: [
      {
        chainBalances: [{ chain: "arcTestnet", balance: 0 }],
        gatewayBalances: [],
      },
    ],
  };

  assert.deepEqual(balanceBreakdown(result, "arcTestnet"), {
    scaTotal: 0,
    gatewayTotal: 0,
    total: 0,
    rows: [{ chain: "arcTestnet", sca: 0, gateway: 0, scaUnreadable: false }],
    chainsChecked: 1,
  });
});

test("an unscoped breakdown totals all chains but omits zero-only rows", () => {
  const breakdown = balanceBreakdown(multiChainResult);

  assert.equal(breakdown.scaTotal, 28);
  assert.equal(breakdown.gatewayTotal, 23.628953);
  assert.ok(Math.abs(breakdown.total - 51.628953) < 1e-9);
  assert.equal(breakdown.chainsChecked, 3);
  assert.deepEqual(breakdown.rows.map((row) => row.chain), ["baseSepolia", "arcTestnet"]);
});

// The failure this guards is the one that made a credited payment look lost: the SCA read for the
// destination chain errored, the response marked it null, and the row was dropped as if it were a
// zero — so a wallet that had just received USDC showed nothing for that chain.
test("a chain whose SCA read failed keeps its row and is not counted as zero", () => {
  const result = {
    failedChains: ["baseSepolia"],
    balances: [
      {
        chainBalances: [
          { chain: "baseSepolia", balance: null, error: "no backend is currently healthy" },
          { chain: "arcTestnet", balance: 127 },
        ],
        gatewayBalances: [],
      },
    ],
  };

  const breakdown = balanceBreakdown(result);

  assert.deepEqual(breakdown.rows, [
    { chain: "arcTestnet", sca: 127, gateway: 0, scaUnreadable: false },
    { chain: "baseSepolia", sca: 0, gateway: 0, scaUnreadable: true },
  ]);
  assert.equal(breakdown.scaTotal, 127);
});

test("a readable zero stays distinguishable from an unreadable chain", () => {
  const result = {
    balances: [
      {
        chainBalances: [{ chain: "baseSepolia", balance: 0 }],
        gatewayBalances: [{ chain: "baseSepolia", balance: 9.975902 }],
      },
    ],
  };

  assert.deepEqual(balanceBreakdown(result).rows, [
    { chain: "baseSepolia", sca: 0, gateway: 9.975902, scaUnreadable: false },
  ]);
});
