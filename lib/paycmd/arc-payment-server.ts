import { erc20Abi, getAddress, isAddress, type Address } from "viem";
import { arcMainnetPublicClient, arcPublicClient } from "./arc-rpc.ts";
import { arcWalletNetworks, assertArcPaymentFunds, arcPaymentData, requireArcPaymentNetwork, type ArcWalletPayment } from "./arc-payment.ts";
import type { ArcPaymentNetwork } from "./chains.ts";

const blocklistAbi = [{ type: "function", name: "isBlacklisted", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] }] as const;
export const arcWalletClient = (network: ArcPaymentNetwork) => network === "mainnet" ? arcMainnetPublicClient : arcPublicClient;

export function assertArcWalletPaymentsEnabled(network: ArcPaymentNetwork, env = process.env) {
  if (network === "mainnet" && env.ARC_MAINNET_PAYMENTS_ENABLED !== "true") throw new Error("MAINNET_PAYMENTS_DISABLED: Arc mainnet payments are temporarily disabled.");
}

export async function validateArcPaymentRpc(network: ArcPaymentNetwork) {
  const client = arcWalletClient(network);
  const meta = arcWalletNetworks[network];
  const chainId = await client.getChainId();
  if (chainId !== meta.chainId) throw new Error(`Arc RPC chain ID mismatch: expected ${meta.chainId}, received ${chainId}.`);
  const decimals = await client.readContract({ address: meta.usdcAddress, abi: erc20Abi, functionName: "decimals" });
  if (decimals !== 6) throw new Error("Arc USDC decimals mismatch; payment blocked.");
  return client;
}

export async function quoteArcPayment(network: ArcPaymentNetwork, senderInput: string, recipient: Address, units: bigint) {
  assertArcWalletPaymentsEnabled(network);
  if (!isAddress(senderInput)) throw new Error("Connect a valid EVM wallet.");
  const sender = getAddress(senderInput);
  const meta = arcWalletNetworks[network];
  if (recipient.toLowerCase() === meta.usdcAddress.toLowerCase()) throw new Error("Cannot send USDC to its token contract.");
  const client = await validateArcPaymentRpc(network);
  const data = arcPaymentData(recipient, units);
  const [tokenBalance, nativeBalance, senderBlocked, recipientBlocked, fees] = await Promise.all([
    client.readContract({ address: meta.usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [sender] }),
    client.getBalance({ address: sender, blockTag: "pending" }),
    client.readContract({ address: meta.usdcAddress, abi: blocklistAbi, functionName: "isBlacklisted", args: [sender] }),
    client.readContract({ address: meta.usdcAddress, abi: blocklistAbi, functionName: "isBlacklisted", args: [recipient] }),
    client.estimateFeesPerGas(),
  ]);
  if (senderBlocked || recipientBlocked) throw new Error("Arc USDC has blocked the sender or recipient.");
  assertArcPaymentFunds(units, tokenBalance, nativeBalance, 0n);
  const gasEstimate = await client.estimateGas({ account: sender, to: meta.usdcAddress, data, value: 0n });
  const gas = (gasEstimate * 120n + 99n) / 100n;
  const maxFeePerGas = fees.maxFeePerGas;
  if (!maxFeePerGas || maxFeePerGas <= 0n) throw new Error("Arc fee estimate unavailable.");
  assertArcPaymentFunds(units, tokenBalance, nativeBalance, gas * maxFeePerGas);
  return { sender, data, gas: gas.toString(), maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(), balance: tokenBalance.toString() };
}

export function paymentNetworkOf(payment: ArcWalletPayment) {
  const network = requireArcPaymentNetwork(payment.network);
  if (payment.chain_id !== arcWalletNetworks[network].chainId) throw new Error("Stored payment network/chain mismatch.");
  return network;
}
