import { formatUnits } from "viem";

import { isSupportedChain } from "./chains.ts";
import { web3Chains } from "./web3-chains.ts";

export function formatNativeGasBalance(rawBalance: unknown, chain: string) {
  const meta = isSupportedChain(chain) ? web3Chains[chain] : null;
  const decimals = meta?.nativeCurrency.decimals ?? 18;
  const symbol = meta?.nativeCurrency.symbol ?? "ETH";

  try {
    const value = typeof rawBalance === "bigint"
      ? rawBalance
      : BigInt(String(rawBalance ?? "0"));
    const formatted = formatUnits(value, decimals);
    const numeric = Number(formatted);
    const maximumFractionDigits = numeric > 0 && numeric < 0.000001
      ? Math.min(decimals, 18)
      : 6;
    const display = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(numeric);
    return `${display} ${symbol}`;
  } catch {
    return `0 ${symbol}`;
  }
}
