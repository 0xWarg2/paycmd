import { parseUnits, type Address } from "viem";

export type PaynaSwapTokenSymbol = "USDC" | "EURC" | "cirBTC";

export type PaynaSwapToken = {
  symbol: PaynaSwapTokenSymbol;
  name: string;
  address: Address;
  decimals: number;
};

export const PAYNA_SWAP_CHAIN = "arcTestnet";
export const PAYNA_SWAP_CHAIN_ID = 5042002;
export const PAYNA_SWAP_SLIPPAGE_BPS = 100;
export const PAYNA_SWAP_FEE_NUMERATOR = 997n;
export const PAYNA_SWAP_FEE_DENOMINATOR = 1000n;

export const paynaSwapTokens: Record<PaynaSwapTokenSymbol, PaynaSwapToken> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
  },
  cirBTC: {
    symbol: "cirBTC",
    name: "Circle BTC",
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
  },
};

export const paynaSwapTokenSymbols = Object.keys(paynaSwapTokens) as PaynaSwapTokenSymbol[];

export const paynaDexRouter = "0x4d306D129C52E88a7766dc3d70ce28d423E3b1Ef" as Address;
export const paynaDexFactory = "0xdE6b2AEf32FE1e675060dBC47BC2dF049052494E" as Address;

export const paynaSwapAdapterAbi = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

export const paynaFactoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

export const paynaPairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export function normalizeSwapToken(value?: string | null): PaynaSwapTokenSymbol | "" {
  const normalized = (value ?? "").trim().toLowerCase().replace(/[-_\s]/g, "");
  if (normalized === "usdc") return "USDC";
  if (normalized === "eurc" || normalized === "euroc" || normalized === "eurocoin") return "EURC";
  if (normalized === "cirbtc" || normalized === "circlebtc" || normalized === "btc") return "cirBTC";
  return "";
}

export function swapPathFor(tokenIn: PaynaSwapTokenSymbol, tokenOut: PaynaSwapTokenSymbol) {
  if (tokenIn === tokenOut) return [];
  if (tokenIn === "USDC" || tokenOut === "USDC") return [tokenIn, tokenOut];
  return [tokenIn, "USDC", tokenOut] as PaynaSwapTokenSymbol[];
}

export function getSwapAdapterAddress() {
  return (
    process.env.NEXT_PUBLIC_PAYNA_SWAP_ADAPTER_ADDRESS ||
    process.env.PAYNA_SWAP_ADAPTER_ADDRESS ||
    ""
  ) as Address | "";
}

export function amountOutFromReserves(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * PAYNA_SWAP_FEE_NUMERATOR;
  return (amountInWithFee * reserveOut) / (reserveIn * PAYNA_SWAP_FEE_DENOMINATOR + amountInWithFee);
}

export function amountOutMinFromSlippage(amountOut: bigint, slippageBps = PAYNA_SWAP_SLIPPAGE_BPS) {
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function parseSwapAmount(amount: string, token: PaynaSwapTokenSymbol) {
  return parseUnits(amount, paynaSwapTokens[token].decimals);
}
