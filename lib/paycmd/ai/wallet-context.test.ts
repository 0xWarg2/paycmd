import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWalletContext,
  formatWalletContext,
  walletContextRelevant,
} from "./wallet-context.ts";
import {
  createServerWalletContextDependencies,
  loadExternalWalletObservations,
  loadGatewayBalanceResponse,
  loadGatewayWalletObservations,
} from "./wallet-context-server.ts";

type QueryCall = {
  table: string;
  filters: Array<[column: string, value: unknown]>;
};

function createSupabaseFixture(rows: {
  wallets?: unknown[];
  user_external_wallets?: unknown[];
}, errors: Partial<Record<"wallets" | "user_external_wallets", unknown>> = {}) {
  const calls: QueryCall[] = [];
  const client = {
    from(table: string) {
      const call: QueryCall = { table, filters: [] };
      calls.push(call);
      const builder: any = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          const data = rows[table as keyof typeof rows] ?? [];
          const error = errors[table as keyof typeof errors] ?? null;
          return Promise.resolve({ data, error }).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

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

test("loads context for operational wallet questions", () => {
  assert.equal(walletContextRelevant("Làm sao gửi 50 USDC sang Arc nhanh nhất?"), true);
  assert.equal(walletContextRelevant("Can I afford 50 USDC?"), true);
  assert.equal(walletContextRelevant("Tôi có đủ 50 USDC không?"), true);
  assert.equal(walletContextRelevant("Do I have 50 USDC?"), true);
  assert.equal(walletContextRelevant("Tôi có 50 USDC không?"), true);
  assert.equal(walletContextRelevant("What is my USDC balance?"), true);
  assert.equal(walletContextRelevant("Số dư USDC của tôi là gì?"), true);
});

test("does not load authenticated context for conceptual questions", () => {
  assert.equal(walletContextRelevant("Arc consensus hoạt động thế nào?"), false);
  assert.equal(walletContextRelevant("What does balance mean in crypto?"), false);
  assert.equal(walletContextRelevant("How do pending transactions work?"), false);
  assert.equal(walletContextRelevant("What does available balance mean?"), false);
  assert.equal(walletContextRelevant("How do pending wallet balances work?"), false);
  assert.equal(walletContextRelevant("What is USDC?"), false);
  assert.equal(walletContextRelevant("USDC là gì?"), false);
});

test("scopes server wallet sources to the authenticated user and configured chains", async () => {
  const scaAddress = "0x11111111111111111111111111111111111111AA";
  const externalAddress = "0x22222222222222222222222222222222222222BB";
  const supabase = createSupabaseFixture({
    wallets: [{ address: scaAddress, wallet_address: scaAddress }],
    user_external_wallets: [{ wallet_type: "metamask", wallet_address: externalAddress }],
  });
  const circleReads: Array<[string, string]> = [];
  const externalReads: Array<[string, string]> = [];
  const dependencies = createServerWalletContextDependencies({
    getSupabase: async () => supabase.client,
    gatewayReaders: {
      fetchReady: async () => ({ token: "USDC", balances: [] }),
      fetchPending: async () => ({ token: "USDC", deposits: [] }),
      chainByDomain: {},
    },
    readUsdcBalance: async (address, chain) => {
      circleReads.push([address, chain]);
      return chain === "baseSepolia" ? 25_000_000n : 5_000_000n;
    },
    readChainBalance: async (address, chain) => {
      externalReads.push([address, chain]);
      return {
        nativeBalance: chain === "baseSepolia" ? 10_000_000_000_000_000n : 20_000_000_000_000_000n,
        usdc: chain === "baseSepolia" ? 30_000_000n : 40_000_000n,
      };
    },
    chains: ["baseSepolia", "sepolia"],
  });

  const context = await buildWalletContext("auth-user", dependencies);

  assert.equal(context.status, "verified");
  assert.deepEqual(supabase.calls.map((call) => call.table).sort(), [
    "user_external_wallets",
    "wallets",
    "wallets",
  ]);
  assert.equal(supabase.calls.every((call) =>
    call.filters.some(([column, value]) => column === "user_id" && value === "auth-user")), true);
  assert.deepEqual(circleReads, [
    [scaAddress.toLowerCase(), "baseSepolia"],
    [scaAddress.toLowerCase(), "sepolia"],
  ]);
  assert.deepEqual(externalReads, [
    [externalAddress.toLowerCase(), "baseSepolia"],
    [externalAddress.toLowerCase(), "sepolia"],
  ]);
  assert.deepEqual(context.circleSca, [
    { chain: "baseSepolia", address: scaAddress, usdc: "25" },
    { chain: "sepolia", address: scaAddress, usdc: "5" },
  ]);
  assert.deepEqual(context.externalWallets, [
    {
      provider: "metamask",
      address: externalAddress,
      chain: "baseSepolia",
      nativeBalance: "0.01",
      usdc: "30",
    },
    {
      provider: "metamask",
      address: externalAddress,
      chain: "sepolia",
      nativeBalance: "0.02",
      usdc: "40",
    },
  ]);
});

test("marks a server source unavailable at the eight-second family deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scaAddress = "0x3333333333333333333333333333333333333333";
  const supabase = createSupabaseFixture({
    wallets: [{ address: scaAddress, wallet_address: scaAddress }],
    user_external_wallets: [],
  });
  const never = new Promise<never>(() => {});
  const dependencies = createServerWalletContextDependencies({
    getSupabase: async () => supabase.client,
    gatewayReaders: {
      fetchReady: async () => never,
      fetchPending: async () => ({ token: "USDC", deposits: [] }),
      chainByDomain: {},
    },
    readUsdcBalance: async () => 0n,
    readChainBalance: async () => ({ nativeBalance: 0n, usdc: 0n }),
    chains: ["baseSepolia"],
  });
  let settled = false;
  const contextPromise = buildWalletContext("auth-user", dependencies).then((context) => {
    settled = true;
    return context;
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  t.mock.timers.tick(7_999);
  await Promise.resolve();
  assert.equal(settled, false);

  t.mock.timers.tick(1);
  const context = await contextPromise;
  assert.equal(context.status, "partial");
  assert.deepEqual(context.unavailable, ["gateway"]);
  assert.deepEqual(context.gateway, []);
  assert.deepEqual(context.circleSca, [{
    chain: "baseSepolia",
    address: scaAddress,
    usdc: "0",
  }]);
});

test("propagates an immediate external-wallet query rejection without leaking or zeroing it", async () => {
  const privateError = "database connection contained private provider detail";
  const supabase = createSupabaseFixture({
    wallets: [],
    user_external_wallets: [],
  }, {
    user_external_wallets: new Error(privateError),
  });
  const dependencies = createServerWalletContextDependencies({
    getSupabase: async () => supabase.client,
    gatewayReaders: {
      fetchReady: async () => ({ token: "USDC", balances: [] }),
      fetchPending: async () => ({ token: "USDC", deposits: [] }),
      chainByDomain: {},
    },
    readUsdcBalance: async () => 0n,
    readChainBalance: async () => ({ nativeBalance: 0n, usdc: 0n }),
    chains: ["baseSepolia"],
  });

  const context = await buildWalletContext("auth-user", dependencies);
  const formatted = formatWalletContext(context);

  assert.equal(context.status, "partial");
  assert.deepEqual(context.unavailable, ["external_wallets"]);
  assert.deepEqual(context.gateway, []);
  assert.deepEqual(context.circleSca, []);
  assert.deepEqual(context.externalWallets, []);
  assert.match(formatted, /External wallet balance unavailable/);
  assert.doesNotMatch(formatted, new RegExp(privateError));
  assert.doesNotMatch(formatted, /0 USDC/);
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
