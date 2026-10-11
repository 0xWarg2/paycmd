import { decodeEventLog, encodeFunctionData, erc20Abi, getAddress, isAddress, maxUint256, parseUnits, zeroAddress, type Address, type Hex, type Transaction, type TransactionReceipt } from "viem";
import { parsePayCmd, type ParsedCommand } from "./commands.ts";
import type { ArcPaymentNetwork } from "./chains.ts";
import { arcMainnetChain, ARC_MAINNET_USDC_ADDRESS, web3Chains } from "./web3-chains.ts";

export const arcWalletNetworks = {
  mainnet: { chainId: arcMainnetChain.id, name: arcMainnetChain.name, rpcUrl: arcMainnetChain.rpcUrls.default.http[0], explorer: arcMainnetChain.blockExplorers!.default.url, usdcAddress: ARC_MAINNET_USDC_ADDRESS },
  testnet: { chainId: web3Chains.arcTestnet.id, name: web3Chains.arcTestnet.name, rpcUrl: web3Chains.arcTestnet.rpcUrl, explorer: "https://explorer.testnet.arc.io", usdcAddress: web3Chains.arcTestnet.usdcAddress },
} as const;
export type ArcPaymentStatus = "prepared" | "signing" | "submitted" | "success" | "failed" | "rejected";
export type ArcWalletPayment = {
  id: string; user_id: string; network: ArcPaymentNetwork; chain_id: number;
  sender: Address; recipient: Address; amount: string; amount_units: string;
  call_data: Hex; gas_limit: string; max_fee_per_gas: string; max_priority_fee_per_gas: string;
  status: ArcPaymentStatus; tx_hash: Hex | null; expires_at: string; created_at: string;
  error_message: string | null;
};

export function requireArcPaymentNetwork(value: unknown): ArcPaymentNetwork {
  if (value !== "mainnet" && value !== "testnet") throw new Error("Select mainnet or testnet explicitly.");
  return value;
}

export function parseArcWalletPayment(raw: string, network: ArcPaymentNetwork): ParsedCommand & { recipient: Address; units: bigint } {
  const parsed = parsePayCmd(raw, "en");
  const match = raw.trim().match(/^\/?pay\s+(\d+(?:\.\d{1,6})?)\s+USDC\s+to\s+(0x[\da-fA-F]{40})(?:\s+on\s+(arc(?:[- ]?(?:mainnet|testnet))?))?\s*$/i);
  if (parsed.command !== "pay" || !match) throw new Error("Use /pay <amount> USDC to <wallet address> on arc-mainnet or arc-testnet. Only same-network USDC payments are supported here.");
  const [, amount, recipient, namedChain] = match;
  const namedNetwork = namedChain?.toLowerCase().includes("mainnet") ? "mainnet" : namedChain?.toLowerCase().includes("testnet") ? "testnet" : network;
  if (namedNetwork !== network) throw new Error("Command network differs from the selected network.");
  if (!isAddress(recipient) || recipient.toLowerCase() === zeroAddress) throw new Error("Recipient must be a valid non-zero EVM address.");
  const units = parseUnits(amount, 6);
  if (units <= 0n || units > maxUint256) throw new Error("USDC amount must be positive, at most 6 decimals, and fit uint256.");
  return { ...parsed, recipient: getAddress(recipient), units, fields: { amount, token: "USDC", recipient: getAddress(recipient), sourceChain: network === "mainnet" ? "arcMainnet" : "arcTestnet", destinationChain: network === "mainnet" ? "arcMainnet" : "arcTestnet", network, rail: "metamask" }, missingFields: [], status: "draft_ready", summary: `Pay ${amount} USDC to ${getAddress(recipient)} on ${arcWalletNetworks[network].name}` };
}

export function arcPaymentData(recipient: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, amount] });
}

// Arc native gas and ERC-20 balances are two views of the SAME USDC balance.
export function assertArcPaymentFunds(amount: bigint, tokenBalance: bigint, nativeBalance: bigint, feeCap: bigint) {
  if (amount > tokenBalance) throw new Error("Insufficient USDC for the payment.");
  if (amount * 10n ** 12n + feeCap > nativeBalance) throw new Error("Insufficient USDC for payment plus gas. Keep USDC available for gas.");
}

export function paymentOwnershipMessage(payment: ArcWalletPayment) {
  return ["HeyPayna wallet payment confirmation", `User: ${payment.user_id}`, `Payment: ${payment.id}`, `Network: ${payment.network} (chain ${payment.chain_id})`, `From: ${payment.sender}`, `To: ${payment.recipient}`, `Amount: ${payment.amount} USDC (${payment.amount_units} units)`, `Maximum gas: ${BigInt(payment.gas_limit) * BigInt(payment.max_fee_per_gas)} native units`, `Expires: ${payment.expires_at}`, "Authorize this payment preview. The transaction requires a separate wallet confirmation."].join("\n");
}

export function assertArcPaymentTransaction(payment: ArcWalletPayment, tx: Pick<Transaction, "from" | "to" | "input" | "value" | "chainId" | "hash">) {
  const meta = arcWalletNetworks[payment.network];
  if (payment.chain_id !== meta.chainId || tx.chainId !== meta.chainId ||
      tx.from.toLowerCase() !== payment.sender.toLowerCase() || tx.to?.toLowerCase() !== meta.usdcAddress.toLowerCase() ||
      tx.input.toLowerCase() !== payment.call_data.toLowerCase() || tx.value !== 0n || tx.hash.toLowerCase() !== payment.tx_hash?.toLowerCase()) {
    throw new Error("Onchain transaction does not match the confirmed payment.");
  }
}

export function arcPaymentReceiptOutcome(payment: ArcWalletPayment, receipt: TransactionReceipt): "success" | "failed" {
  if (receipt.transactionHash.toLowerCase() !== payment.tx_hash?.toLowerCase()) throw new Error("Receipt hash does not match the payment.");
  if (receipt.status === "reverted") return "failed";
  const meta = arcWalletNetworks[payment.network];
  const transfer = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== meta.usdcAddress.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", data: log.data, topics: log.topics });
      return decoded.args.from.toLowerCase() === payment.sender.toLowerCase() && decoded.args.to.toLowerCase() === payment.recipient.toLowerCase() && decoded.args.value === BigInt(payment.amount_units);
    } catch { return false; }
  });
  if (receipt.status !== "success" || !transfer) throw new Error("Receipt has no matching USDC Transfer event; payment is not verified.");
  return "success";
}
