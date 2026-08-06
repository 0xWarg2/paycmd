import {
  createPublicClient,
  defineChain,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from "viem";

import { supportedChains, type PayCmdChain } from "../chains.ts";
import { web3Chains } from "../web3-chains.ts";
import type {
  CircleScaWalletObservation,
  ExternalWalletObservation,
  GatewayWalletObservation,
  WalletContextDependencies,
} from "./wallet-context.ts";

const WALLET_CONTEXT_FAMILY_TIMEOUT_MS = 8_000;
const MAX_CONTEXT_WALLETS = 5;

type GatewayBalance = { domain: number; depositor: string; balance: string };
type GatewayPendingDeposit = { domain: number; depositor: string; amount: string };
type GatewayReadyResponse = { token: string; balances: GatewayBalance[] };
type GatewayPendingResponse = { token: string; deposits: GatewayPendingDeposit[] };

type GatewayObservationReaders = {
  fetchReady: (address: Address | Address[]) => Promise<GatewayReadyResponse>;
  fetchPending: (address: Address | Address[]) => Promise<GatewayPendingResponse>;
  chainByDomain: Partial<Record<number, PayCmdChain>>;
};

type GatewayBalanceReaders = {
  fetchGatewayBalance: (address: Address) => Promise<GatewayReadyResponse>;
  getUsdcBalance: (address: Address, chain: PayCmdChain) => Promise<bigint>;
  chainByDomain: Partial<Record<number, PayCmdChain>>;
};

type ExternalWalletRow = { wallet_type?: string | null; wallet_address?: string | null };
type CircleWalletRow = { address?: string | null; wallet_address?: string | null };
type SupabaseClientLike = { from: (table: string) => any };
type ChainBalanceReader = (
  address: Address,
  chain: PayCmdChain,
) => Promise<{ nativeBalance: bigint; usdc: bigint }>;
type UsdcBalanceReader = (address: Address, chain: PayCmdChain) => Promise<bigint>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function uniqueAddresses(rows: CircleWalletRow[]): string[] {
  const addresses = rows
    .map((wallet) => wallet.address || wallet.wallet_address)
    .filter((address): address is string => Boolean(address));
  return [...new Map(addresses.map((address) => [address.toLowerCase(), address])).values()];
}

function decimalUsdcToAtomic(value: string): bigint {
  try {
    return parseUnits(value, 6);
  } catch {
    throw new Error("Gateway returned an invalid balance");
  }
}

function addAtomic(target: Map<PayCmdChain, bigint>, chain: PayCmdChain, amount: bigint) {
  target.set(chain, (target.get(chain) ?? 0n) + amount);
}

export async function loadGatewayWalletObservations(
  addresses: string[],
  readers: GatewayObservationReaders,
  chains: readonly PayCmdChain[] = supportedChains,
): Promise<GatewayWalletObservation[]> {
  if (addresses.length === 0) return [];

  const selectedChains = new Set(chains);
  const lookupAddresses = addresses.map((address) => address.toLowerCase() as Address);
  const [ready, pending] = await Promise.all([
    readers.fetchReady(lookupAddresses),
    readers.fetchPending(lookupAddresses),
  ]);
  const readyByChain = new Map<PayCmdChain, bigint>();
  const pendingByChain = new Map<PayCmdChain, bigint>();

  for (const balance of ready.balances) {
    const chain = readers.chainByDomain[balance.domain];
    if (chain && selectedChains.has(chain)) {
      addAtomic(readyByChain, chain, decimalUsdcToAtomic(balance.balance));
    }
  }
  for (const deposit of pending.deposits) {
    const chain = readers.chainByDomain[deposit.domain];
    if (chain && selectedChains.has(chain)) {
      addAtomic(pendingByChain, chain, BigInt(deposit.amount));
    }
  }

  return chains.flatMap((chain) => {
    if (!readyByChain.has(chain) && !pendingByChain.has(chain)) return [];
    return [{
      chain,
      readyUsdc: formatUnits(readyByChain.get(chain) ?? 0n, 6),
      pendingUsdc: formatUnits(pendingByChain.get(chain) ?? 0n, 6),
    }];
  });
}

export async function loadCircleScaWalletObservations(
  rows: CircleWalletRow[],
  readUsdcBalance: UsdcBalanceReader,
  chains: readonly PayCmdChain[] = supportedChains,
): Promise<CircleScaWalletObservation[]> {
  const addresses = uniqueAddresses(rows).slice(0, MAX_CONTEXT_WALLETS);
  const observations = await Promise.all(addresses.flatMap((address) =>
    chains.map(async (chain) => ({
      chain,
      address,
      usdc: formatUnits(await readUsdcBalance(address.toLowerCase() as Address, chain), 6),
    }))));
  return observations;
}

export async function loadExternalWalletObservations(
  rows: ExternalWalletRow[],
  readChainBalance: ChainBalanceReader,
  chains: readonly PayCmdChain[] = supportedChains,
): Promise<ExternalWalletObservation[]> {
  const wallets = [...new Map(rows.flatMap((row) => {
    const address = row.wallet_address;
    return address ? [[address.toLowerCase(), row] as const] : [];
  })).values()].slice(0, MAX_CONTEXT_WALLETS);

  return Promise.all(wallets.flatMap((wallet) => chains.map(async (chain) => {
    const address = wallet.wallet_address!;
    const balance = await readChainBalance(address.toLowerCase() as Address, chain);
    return {
      provider: wallet.wallet_type === "metamask" ? "metamask" as const : "external" as const,
      address,
      chain,
      nativeBalance: formatUnits(balance.nativeBalance, web3Chains[chain].nativeCurrency.decimals),
      usdc: formatUnits(balance.usdc, 6),
    };
  })));
}

async function defaultGatewayBalanceReaders(): Promise<GatewayBalanceReaders> {
  const gateway = await import("../../circle/gateway-sdk.ts");
  return {
    fetchGatewayBalance: gateway.fetchGatewayBalance,
    getUsdcBalance: gateway.getUsdcBalance,
    chainByDomain: gateway.CHAIN_BY_DOMAIN,
  };
}

export async function loadGatewayBalanceResponse(
  addresses: string[],
  chainsToCheck: readonly PayCmdChain[],
  providedReaders?: GatewayBalanceReaders,
  chainFilter?: PayCmdChain,
) {
  const readers = providedReaders ?? await defaultGatewayBalanceReaders();
  const balancePromises = addresses.map(async (address) => {
    try {
      let gatewayBalances: Array<{
        domain: number;
        balance: number;
        chain: string;
        address: string;
      }> = [];
      let gatewayTotal = 0;
      let gatewayUnavailable = false;

      try {
        const gatewayResponse = await readers.fetchGatewayBalance(address as Address);
        gatewayBalances = gatewayResponse.balances
          .map((balance) => ({
            domain: balance.domain,
            balance: parseFloat(balance.balance),
            chain: readers.chainByDomain[balance.domain] || "unknown",
            address,
          }))
          .filter((balance) => !chainFilter || balance.chain === chainFilter);
        gatewayTotal = gatewayBalances.reduce((sum, balance) => sum + balance.balance, 0);
      } catch {
        gatewayUnavailable = true;
      }

      const chainBalances = await Promise.all(chainsToCheck.map(async (chain) => {
        try {
          const balance = await readers.getUsdcBalance(address as Address, chain);
          return { chain, balance: Number(balance) / 1_000_000, address };
        } catch (error) {
          return {
            chain,
            balance: null as number | null,
            address,
            error: errorMessage(error),
          };
        }
      }));
      const failedChains = chainBalances
        .filter((balance) => balance.balance === null)
        .map((balance) => balance.chain);
      const walletTotal = chainBalances.reduce(
        (sum, balance) => sum + (balance.balance ?? 0),
        0,
      );

      return {
        address,
        gatewayBalances,
        gatewayTotal,
        chainBalances,
        walletTotal,
        totalBalance: gatewayTotal + walletTotal,
        failedChains,
        gatewayUnavailable,
      };
    } catch (error) {
      return {
        address,
        error: errorMessage(error),
        totalBalance: 0,
        failedChains: [...chainsToCheck] as string[],
        gatewayUnavailable: true,
      };
    }
  });
  const balances = await Promise.all(balancePromises);
  const totalUnified = balances.reduce((sum, balance) => sum + (balance.totalBalance || 0), 0);
  const failedChains = [...new Set(balances.flatMap((balance) => balance.failedChains ?? []))];
  const gatewayUnavailable = balances.some((balance) => balance.gatewayUnavailable);

  return {
    success: true as const,
    totalUnified,
    partial: failedChains.length > 0 || gatewayUnavailable,
    failedChains,
    gatewayUnavailable,
    balances,
  };
}

function configuredPublicClient(chain: PayCmdChain) {
  const config = web3Chains[chain];
  const viemChain = defineChain({
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: `${config.name} explorer`, url: config.blockExplorerUrl } },
    testnet: true,
  });
  return createPublicClient({
    chain: viemChain,
    transport: http(config.rpcUrl, { timeout: WALLET_CONTEXT_FAMILY_TIMEOUT_MS, retryCount: 0 }),
  });
}

async function readConfiguredChainBalance(address: Address, chain: PayCmdChain) {
  const client = configuredPublicClient(chain);
  const [nativeBalance, usdc] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: web3Chains[chain].usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return { nativeBalance, usdc: usdc as bigint };
}

async function withFamilyTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Wallet observation family timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadCircleWalletRows(supabase: SupabaseClientLike, userId: string) {
  const { data, error } = await supabase
    .from("wallets")
    .select("address, wallet_address")
    .eq("user_id", userId)
    .eq("type", "sca")
    .order("created_at", { ascending: true })
    .limit(MAX_CONTEXT_WALLETS);
  if (error) throw new Error("Circle wallet records unavailable");
  return (data ?? []) as CircleWalletRow[];
}

async function loadExternalWalletRows(supabase: SupabaseClientLike, userId: string) {
  const { data, error } = await supabase
    .from("user_external_wallets")
    .select("wallet_type, wallet_address")
    .eq("user_id", userId)
    .eq("chain_type", "evm")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(MAX_CONTEXT_WALLETS);
  if (error) throw new Error("External wallet records unavailable");
  return (data ?? []) as ExternalWalletRow[];
}

export function createServerWalletContextDependencies(options: {
  getSupabase?: () => Promise<SupabaseClientLike>;
  gatewayReaders?: GatewayObservationReaders;
  readUsdcBalance?: UsdcBalanceReader;
  readChainBalance?: ChainBalanceReader;
  chains?: readonly PayCmdChain[];
  timeoutMs?: number;
} = {}): WalletContextDependencies {
  const chains = options.chains ?? supportedChains;
  const timeoutMs = options.timeoutMs ?? WALLET_CONTEXT_FAMILY_TIMEOUT_MS;
  const getSupabase = options.getSupabase ?? (async () => {
    const { createClient } = await import("../../supabase/server.ts");
    return createClient();
  });

  return {
    gateway: (userId) => withFamilyTimeout((async () => {
      const rows = await loadCircleWalletRows(await getSupabase(), userId);
      const addresses = uniqueAddresses(rows);
      if (addresses.length === 0) return [];
      const readers = options.gatewayReaders ?? await (async () => {
        const gateway = await import("../../circle/gateway-sdk.ts");
        return {
          fetchReady: gateway.fetchGatewayBalance,
          fetchPending: gateway.fetchGatewayPendingDeposits,
          chainByDomain: gateway.CHAIN_BY_DOMAIN,
        };
      })();
      return loadGatewayWalletObservations(addresses, readers, chains);
    })(), timeoutMs),
    circleSca: (userId) => withFamilyTimeout((async () => {
      const rows = await loadCircleWalletRows(await getSupabase(), userId);
      const readUsdcBalance = options.readUsdcBalance ?? (await import("../../circle/gateway-sdk.ts")).getUsdcBalance;
      return loadCircleScaWalletObservations(rows, readUsdcBalance, chains);
    })(), timeoutMs),
    externalWallets: (userId) => withFamilyTimeout((async () => {
      const rows = await loadExternalWalletRows(await getSupabase(), userId);
      return loadExternalWalletObservations(
        rows,
        options.readChainBalance ?? readConfiguredChainBalance,
        chains,
      );
    })(), timeoutMs),
  };
}
