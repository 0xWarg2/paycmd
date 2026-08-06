import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWalletContext,
  formatWalletContext,
  walletContextRelevant,
} from "./wallet-context.ts";
import {
  loadExternalWalletObservations,
  loadGatewayBalanceResponse,
  loadGatewayWalletObservations,
} from "./wallet-context-server.ts";

test("keeps spendability domains separate", async () => {
  const context = await buildWalletContext("user-1", {
    gateway: async () => [{ chain: "baseSepolia", readyUsdc: "50", pendingUsdc: "10" }],
    circleSca: async () => [{
      chain: "baseSepolia",
      address: "0x1111111111111111111111111111111111111111",
      usdc: "25",
    }],
    externalWallets: async () => [{
      provider: "metamask",
      address: "0x2222222222222222222222222222222222222222",
      chain: "baseSepolia",
      usdc: "30",
      nativeBalance: "0.01",
    }],
  });

  assert.equal(context.gateway[0].readyUsdc, "50");
  assert.equal(context.circleSca[0].usdc, "25");
  assert.equal(context.externalWallets[0].usdc, "30");
  assert.equal("totalUsdc" in context, false);
});

test("marks partial reads without converting failures to zero", async () => {
  const context = await buildWalletContext("user-1", {
    gateway: async () => {
      throw new Error("timeout");
    },
    circleSca: async () => [],
    externalWallets: async () => [],
  });

  assert.equal(context.status, "partial");
  assert.deepEqual(context.gateway, []);
  assert.match(formatWalletContext(context), /Gateway balance unavailable/);
});

test("loads context only for operational wallet questions", () => {
  assert.equal(walletContextRelevant("Làm sao gửi 50 USDC sang Arc nhanh nhất?"), true);
  assert.equal(walletContextRelevant("Arc consensus hoạt động thế nào?"), false);
});

test("keeps ready and pending Gateway observations separate", async () => {
  const address = "0x1111111111111111111111111111111111111111";
  const observations = await loadGatewayWalletObservations([address], {
    fetchReady: async () => ({
      token: "USDC",
      balances: [{ domain: 6, depositor: address, balance: "50" }],
    }),
    fetchPending: async () => ({
      token: "USDC",
      deposits: [{ domain: 6, depositor: address, amount: "10000000" }],
    }),
    chainByDomain: { 6: "baseSepolia" },
  }, ["baseSepolia"]);

  assert.deepEqual(observations, [{
    chain: "baseSepolia",
    readyUsdc: "50",
    pendingUsdc: "10",
  }]);
});

test("lowercases external wallet addresses for RPC lookup only", async () => {
  const storedAddress = "0x22222222222222222222222222222222222222AA";
  const observations = await loadExternalWalletObservations([
    { wallet_type: "metamask", wallet_address: storedAddress },
  ], async (lookupAddress, chain) => {
    assert.equal(lookupAddress, storedAddress.toLowerCase());
    assert.equal(chain, "baseSepolia");
    return { nativeBalance: 10_000_000_000_000_000n, usdc: 30_000_000n };
  }, ["baseSepolia"]);

  assert.deepEqual(observations, [{
    provider: "metamask",
    address: storedAddress,
    chain: "baseSepolia",
    nativeBalance: "0.01",
    usdc: "30",
  }]);
});

test("preserves the Gateway balance response contract through the shared reader", async () => {
  const address = "0x3333333333333333333333333333333333333333";
  const response = await loadGatewayBalanceResponse([address], ["baseSepolia"], {
    fetchGatewayBalance: async () => ({
      token: "USDC",
      balances: [{ domain: 6, depositor: address, balance: "50" }],
    }),
    getUsdcBalance: async () => 25_000_000n,
    chainByDomain: { 6: "baseSepolia" },
  });

  assert.equal(response.success, true);
  assert.equal(response.totalUnified, 75);
  assert.equal(response.partial, false);
  assert.deepEqual(response.failedChains, []);
  assert.equal(response.gatewayUnavailable, false);
  assert.deepEqual(response.balances, [{
    address,
    gatewayBalances: [{ domain: 6, balance: 50, chain: "baseSepolia", address }],
    gatewayTotal: 50,
    chainBalances: [{ chain: "baseSepolia", balance: 25, address }],
    walletTotal: 25,
    totalBalance: 75,
    failedChains: [],
    gatewayUnavailable: false,
  }]);
});
