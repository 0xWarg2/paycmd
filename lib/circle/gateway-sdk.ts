/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes } from "crypto";
import {
  http,
  maxUint256,
  zeroAddress,
  pad,
  createPublicClient,
  defineChain,
  erc20Abi,
  type Address,
  type Hash,
  type Chain,
} from "viem";
import * as chains from "viem/chains";
import { circleDeveloperSdk } from "@/lib/circle/sdk";
import { type PayCmdChain } from "@/lib/paycmd/chains";
import {
  gatewayForwardedMintReceiptMatches,
  gatewayForwardingPollOutcome,
  gatewayForwardingSettlementFrom,
  requestGatewayFeeEstimate,
  type GatewayFeeEstimate,
} from "@/lib/paycmd/gateway-transfer";
import { web3Chains } from "@/lib/paycmd/web3-chains";
import {
  Transaction,
  Blockchain,
  TransactionType,
} from "@circle-fin/developer-controlled-wallets";

export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const arcRpcKey = process.env.ARC_TESTNET_RPC_KEY || 'c0ca2582063a5bbd5db2f98c139775e982b16919';

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [`https://rpc.testnet.arc.network/${arcRpcKey}`] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const satisfies Chain;

const hyperEvmTestnet = defineChain({
  id: 998,
  name: "HyperEVM Testnet",
  nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
  },
  blockExplorers: {
    default: { name: "HyperEVM Testnet Explorer", url: "https://app.hyperliquid-testnet.xyz/explorer" },
  },
  testnet: true,
});

const seiAtlantic = defineChain({
  id: 1328,
  name: "Sei Atlantic",
  nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm-rpc-testnet.sei-apis.com"] },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com" },
  },
  testnet: true,
});

const sonicTestnet = defineChain({
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "SonicScan", url: "https://testnet.sonicscan.org" },
  },
  testnet: true,
});

/**
 * Gateway-rail data only. `label` and `usdcAddress` are derived from web3Chains rather than
 * restated here: they used to be duplicated, and the copies had already drifted (the Avalanche
 * Fuji USDC address was EIP-55 checksummed here but all-lowercase there).
 *
 * `satisfies Record<PayCmdChain, ...>` is the drift guard — adding a chain to
 * lib/paycmd/chains.ts without adding it here is a typecheck failure, not a runtime surprise.
 * rpcUrl is deliberately NOT shared: this module reads the server-only ARC_TESTNET_RPC_KEY
 * while web3Chains reads the NEXT_PUBLIC_ one.
 */
export const GATEWAY_CHAIN_CONFIGS = {
  arcTestnet: {
    domain: 26,
    label: web3Chains.arcTestnet.name,
    usdcAddress: web3Chains.arcTestnet.usdcAddress,
    viemChain: arcTestnet,
    circleBlockchain: Blockchain.ArcTestnet,
    eoaWalletBlockchain: "ARC-TESTNET",
  },
  arbitrumSepolia: {
    domain: 3,
    label: web3Chains.arbitrumSepolia.name,
    usdcAddress: web3Chains.arbitrumSepolia.usdcAddress,
    viemChain: chains.arbitrumSepolia,
    circleBlockchain: Blockchain.ArbSepolia,
    eoaWalletBlockchain: "ARB-SEPOLIA",
  },
  avalancheFuji: {
    domain: 1,
    label: web3Chains.avalancheFuji.name,
    usdcAddress: web3Chains.avalancheFuji.usdcAddress,
    viemChain: chains.avalancheFuji,
    circleBlockchain: Blockchain.AvaxFuji,
    eoaWalletBlockchain: "AVAX-FUJI",
  },
  baseSepolia: {
    domain: 6,
    label: web3Chains.baseSepolia.name,
    usdcAddress: web3Chains.baseSepolia.usdcAddress,
    viemChain: chains.baseSepolia,
    circleBlockchain: Blockchain.BaseSepolia,
    eoaWalletBlockchain: "BASE-SEPOLIA",
  },
  sepolia: {
    domain: 0,
    label: web3Chains.sepolia.name,
    usdcAddress: web3Chains.sepolia.usdcAddress,
    viemChain: chains.sepolia,
    circleBlockchain: Blockchain.EthSepolia,
    eoaWalletBlockchain: "ETH-SEPOLIA",
  },
  hyperEvmTestnet: {
    domain: 19,
    label: web3Chains.hyperEvmTestnet.name,
    usdcAddress: web3Chains.hyperEvmTestnet.usdcAddress,
    viemChain: hyperEvmTestnet,
    circleBlockchain: null,
    eoaWalletBlockchain: null,
  },
  optimismSepolia: {
    domain: 2,
    label: web3Chains.optimismSepolia.name,
    usdcAddress: web3Chains.optimismSepolia.usdcAddress,
    viemChain: chains.optimismSepolia,
    circleBlockchain: Blockchain.OpSepolia,
    eoaWalletBlockchain: "OP-SEPOLIA",
  },
  polygonAmoy: {
    domain: 7,
    label: web3Chains.polygonAmoy.name,
    usdcAddress: web3Chains.polygonAmoy.usdcAddress,
    viemChain: chains.polygonAmoy,
    circleBlockchain: Blockchain.MaticAmoy,
    eoaWalletBlockchain: "MATIC-AMOY",
  },
  seiAtlantic: {
    domain: 16,
    label: web3Chains.seiAtlantic.name,
    usdcAddress: web3Chains.seiAtlantic.usdcAddress,
    viemChain: seiAtlantic,
    circleBlockchain: null,
    eoaWalletBlockchain: null,
  },
  sonicTestnet: {
    domain: 13,
    label: web3Chains.sonicTestnet.name,
    usdcAddress: web3Chains.sonicTestnet.usdcAddress,
    viemChain: sonicTestnet,
    circleBlockchain: null,
    eoaWalletBlockchain: null,
  },
  unichainSepolia: {
    domain: 10,
    label: web3Chains.unichainSepolia.name,
    usdcAddress: web3Chains.unichainSepolia.usdcAddress,
    viemChain: chains.unichainSepolia,
    circleBlockchain: Blockchain.UniSepolia,
    eoaWalletBlockchain: "UNI-SEPOLIA",
  },
  worldChainSepolia: {
    domain: 14,
    label: web3Chains.worldChainSepolia.name,
    usdcAddress: web3Chains.worldChainSepolia.usdcAddress,
    viemChain: chains.worldchainSepolia,
    circleBlockchain: null,
    eoaWalletBlockchain: null,
  },
} as const satisfies Record<
  PayCmdChain,
  {
    domain: number;
    label: string;
    usdcAddress: Address;
    viemChain: Chain;
    circleBlockchain: Blockchain | null;
    eoaWalletBlockchain: string | null;
  }
>;

export type SupportedChain = keyof typeof GATEWAY_CHAIN_CONFIGS;

export const supportedGatewayChains = Object.keys(GATEWAY_CHAIN_CONFIGS) as SupportedChain[];

export const USDC_ADDRESSES = supportedGatewayChains.reduce(
  (acc, chain) => {
    acc[chain] = GATEWAY_CHAIN_CONFIGS[chain].usdcAddress;
    return acc;
  },
  {} as Record<SupportedChain, Address>,
);

export const TOKEN_IDS = {
  arcTestnet: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
  sepolia: "d2177333-b33a-5263-b699-2a6a52722214",
} as const;

export const DOMAIN_IDS = supportedGatewayChains.reduce(
  (acc, chain) => {
    acc[chain] = GATEWAY_CHAIN_CONFIGS[chain].domain;
    return acc;
  },
  {} as Record<SupportedChain, number>,
);

// Mapping for Circle API "blockchain" parameter
export const CIRCLE_CHAIN_NAMES = Object.fromEntries(
  Object.entries(GATEWAY_CHAIN_CONFIGS)
    .filter((entry): entry is [SupportedChain, (typeof GATEWAY_CHAIN_CONFIGS)[SupportedChain] & { circleBlockchain: Blockchain }] =>
      Boolean(entry[1].circleBlockchain),
    )
    .map(([chain, config]) => [chain, config.circleBlockchain]),
) as Partial<Record<SupportedChain, Blockchain>>;

export const CHAIN_BY_DOMAIN = supportedGatewayChains.reduce(
  (acc, chain) => {
    acc[GATEWAY_CHAIN_CONFIGS[chain].domain] = chain;
    return acc;
  },
  {} as Record<number, SupportedChain>,
);

export function isSupportedGatewayChain(value: string): value is SupportedChain {
  return value in GATEWAY_CHAIN_CONFIGS;
}

function requireCircleBlockchain(chain: SupportedChain): Blockchain {
  const blockchain = CIRCLE_CHAIN_NAMES[chain];
  if (!blockchain) {
    throw new Error(`${GATEWAY_CHAIN_CONFIGS[chain].label} is listed by Circle Gateway, but this Circle wallet SDK version cannot sign transactions on it yet.`);
  }
  return blockchain;
}

function getChainConfig(chain: SupportedChain): Chain {
  return GATEWAY_CHAIN_CONFIGS[chain].viemChain;
}

// Some chain definitions ship a default public RPC that is no longer reachable, and
// `http()` with no URL silently falls back to that default. Verified 2026-07-29 by
// probing eth_chainId on all 12 gateway chains: 10 answered correctly, these 2 did not.
// `rpc-amoy.polygon.technology` no longer resolves at all (ENOTFOUND), and
// `rpc.hyperliquid-testnet.xyz` fails Node's TLS chain verification
// (UNABLE_TO_VERIFY_LEAF_SIGNATURE) even though browsers accept its cert.
const RPC_URL_OVERRIDES: Partial<Record<SupportedChain, string>> = {
  polygonAmoy: "https://polygon-amoy-bor-rpc.publicnode.com",
  hyperEvmTestnet: "https://hyperliquid-testnet.drpc.org",
  // Alternates for the bundled defaults (11155111.rpc.thirdweb.com and
  // worldchain-sepolia.g.alchemy.com/public), both measured healthy here: 372ms and 441ms
  // under a 48-request concurrent sweep.
  //
  // Do NOT read the timeouts these two used to log as evidence that an endpoint is bad. A
  // later probe fanned all 12 chains out 4x concurrently — 48/48 succeeded in 1089ms — so
  // the in-app timeouts were not coming from the endpoints at all. See RPC_TIMEOUT_MS below.
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  worldChainSepolia: "https://worldchain-sepolia.gateway.tenderly.co",
};

// viem's `http()` defaults to no timeout, so a single unresponsive endpoint held this whole
// route open for over two minutes. Capping it is right — but the cap has to account for
// *where* the clock is measured.
//
// viem races the request against a `setTimeout`, so the deadline is wall-clock, not
// time-spent-on-the-network. Next's dev server compiles routes on demand in-process, and that
// work blocks the event loop (a single request logged `compile: 5.7s, render: 24.1s`). While
// it is blocked, responses that already arrived sit unread in the socket and the timer still
// counts — so an 8s cap reported all 12 chains as timed out on a run where a standalone probe
// of the same 12 endpoints, 4x concurrently, returned 48/48 in 1089ms. The failures were the
// cap firing against a stalled event loop, not slow RPCs.
//
// Production has no on-demand compile, and a Vercel function has its own duration ceiling, so
// keep the tight cap there and give dev enough slack to survive a compile pause.
const isProduction = process.env.NODE_ENV === "production";
const RPC_TIMEOUT_MS = isProduction ? 8_000 : 20_000;

// Retry in production, where a timeout is most likely a transient network fault worth one
// more attempt. Not in dev: there the cause is a stalled event loop, which a retry cannot
// help, and retrying would double the worst case to 40s of head-of-line blocking on a route
// other requests are queued behind.
const RPC_RETRY_COUNT = isProduction ? 1 : 0;

// Always pass an explicit URL to `http()`. Relying on the bare fallback is what let a dead
// endpoint surface as a balance of 0 instead of an error, and it makes the endpoint in use
// invisible at the call site.
function getRpcUrl(chain: SupportedChain): string {
  return RPC_URL_OVERRIDES[chain] ?? GATEWAY_CHAIN_CONFIGS[chain].viemChain.rpcUrls.default.http[0];
}

function getRpcTransport(chain: SupportedChain) {
  return http(getRpcUrl(chain), { timeout: RPC_TIMEOUT_MS, retryCount: RPC_RETRY_COUNT });
}

const gatewayWalletAbi = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "initiateWithdrawal",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "availableBalance",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawingBalance",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawableBalance",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawalBlock",
    inputs: [
      { name: "depositor", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawalDelay",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addDelegate",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "delegate", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isAuthorizedForBalance",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "depositor", type: "address", internalType: "address" },
      { name: "addr", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeDelegate",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "delegate", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const gatewayMinterAbi = [
  {
    type: "function",
    name: "gatewayMint",
    inputs: [
      { name: "attestationPayload", type: "bytes", internalType: "bytes" },
      { name: "signature", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
] as const;

const TransferSpec = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" },
] as const;

const BurnIntent = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" },
] as const;

function addressToBytes32(address: Address): `0x${string}` {
  return pad(address.toLowerCase() as Address, { size: 32 });
}

function usdcDecimalToAtomic(value: string | number): bigint {
  const [wholeRaw, fractionRaw = ""] = String(value).split(".");
  const whole = wholeRaw.replace(/[^\d]/g, "") || "0";
  const fraction = fractionRaw.replace(/[^\d]/g, "").padEnd(6, "0").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fraction || "0");
}

export interface BurnIntentSpec {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: Address;
  destinationContract: Address;
  sourceToken: Address;
  destinationToken: Address;
  sourceDepositor: Address;
  destinationRecipient: Address;
  sourceSigner: Address;
  destinationCaller: Address;
  value: bigint;
  salt: `0x${string}`;
  hookData: `0x${string}`;
}

export interface BurnIntentData {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: BurnIntentSpec;
}

export function buildGatewayBurnIntentPreview(params: {
  amount: bigint;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  recipient: Address;
  sourceDepositor: Address;
  sourceSigner: Address;
}): BurnIntentData {
  return {
    maxBlockHeight: maxUint256,
    // The shared estimate request intentionally omits this placeholder. Circle returns the
    // fee quote/reserve that execution later signs as maxFee.
    maxFee: 1n,
    spec: {
      version: 1,
      sourceDomain: DOMAIN_IDS[params.sourceChain],
      destinationDomain: DOMAIN_IDS[params.destinationChain],
      sourceContract: GATEWAY_WALLET_ADDRESS as Address,
      destinationContract: GATEWAY_MINTER_ADDRESS as Address,
      sourceToken: USDC_ADDRESSES[params.sourceChain],
      destinationToken: USDC_ADDRESSES[params.destinationChain],
      sourceDepositor: params.sourceDepositor,
      destinationRecipient: params.recipient,
      sourceSigner: params.sourceSigner,
      destinationCaller: zeroAddress,
      value: params.amount,
      salt: `0x${"01".padStart(64, "0")}` as `0x${string}`,
      hookData: "0x",
    },
  };
}

function burnIntentTypedData(burnIntent: BurnIntentData) {
  const domain = {
    name: "GatewayWallet",
    version: "1",
  };
  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain,
    primaryType: "BurnIntent" as const,
    message: {
      ...burnIntent,
      spec: {
        ...burnIntent.spec,
        sourceContract: addressToBytes32(burnIntent.spec.sourceContract),
        destinationContract: addressToBytes32(burnIntent.spec.destinationContract),
        sourceToken: addressToBytes32(burnIntent.spec.sourceToken),
        destinationToken: addressToBytes32(burnIntent.spec.destinationToken),
        sourceDepositor: addressToBytes32(burnIntent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(burnIntent.spec.destinationRecipient),
        sourceSigner: addressToBytes32(burnIntent.spec.sourceSigner),
        destinationCaller: addressToBytes32(burnIntent.spec.destinationCaller),
      },
    },
  };
}

interface ChallengeResponse {
  id: string;
}

const DEFAULT_CIRCLE_TX_TIMEOUT_MS = 180_000;

async function waitForTransactionConfirmation(challengeId: string): Promise<string> {
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > DEFAULT_CIRCLE_TX_TIMEOUT_MS) {
      throw new Error(
        `Circle transaction ${challengeId} has not confirmed after ${DEFAULT_CIRCLE_TX_TIMEOUT_MS / 1000}s. Check it again later.`,
      );
    }

    const response = await circleDeveloperSdk.getTransaction({ id: challengeId });
    const tx = response.data?.transaction;

    if (tx?.state === "CONFIRMED" || tx?.state === "COMPLETE") {
      console.log(`Transaction ${challengeId} reached terminal state '${tx.state}' with hash: ${tx.txHash}`);
      if (!tx.txHash) {
        throw new Error(`Transaction ${challengeId} is ${tx.state} but txHash is missing.`);
      }
      return tx.txHash;
    } else if (tx?.state === "FAILED") {
      console.error("Circle API Error:", tx);
      throw new Error(
        [
          `Transaction ${challengeId} failed with reason: ${tx.errorReason}`,
          tx.errorDetails ? `details: ${tx.errorDetails}` : "",
          tx.blockchain ? `blockchain: ${tx.blockchain}` : "",
          tx.abiFunctionSignature ? `function: ${tx.abiFunctionSignature}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
    }

    console.log(`Transaction ${challengeId} state: ${tx?.state}. Polling again in 2s...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function initiateContractInteraction(
  walletId: string,
  contractAddress: Address,
  abiFunctionSignature: string,
  args: any[],
  blockchain?: Blockchain
): Promise<string> {
  const txParams: any = {
    contractAddress,
    abiFunctionSignature,
    abiParameters: args,
    fee: {
      type: "level",
      config: {
        feeLevel: "HIGH",
      },
    }
  };

  if (blockchain) {
    const walletResponse = await circleDeveloperSdk.getWallet({ id: walletId });
    const walletAddress = walletResponse.data?.wallet?.address;

    if (!walletAddress) {
      throw new Error(`Could not find address for wallet ID: ${walletId}`);
    }

    txParams.walletAddress = walletAddress;
    txParams.blockchain = blockchain;
  } else {
    txParams.walletId = walletId;
  }

  const response = await circleDeveloperSdk.createContractExecutionTransaction(txParams);

  const responseData = response.data as unknown as ChallengeResponse;

  if (!responseData?.id) {
    console.error("Circle API Error: Challenge ID not found in response", response.data);
    throw new Error("Circle API did not return a Challenge ID.");
  }

  return responseData.id;
}

export async function initiateDepositFromCustodialWallet(
  walletId: string,
  chain: SupportedChain,
  amountInAtomicUnits: bigint,
  delegateAddress?: Address
): Promise<string> {
  const usdcAddress = USDC_ADDRESSES[chain];
  const blockchain = requireCircleBlockchain(chain);
  let lastTxHash: string | undefined = undefined;

  // Step 1: Add delegate if provided (allows EOA to sign burn intents)
  if (delegateAddress) {
    console.log(`Step 1: Adding delegate ${delegateAddress} for wallet ${walletId} on ${blockchain}...`);
    const addDelegateChallengeId = await initiateContractInteraction(
      walletId,
      GATEWAY_WALLET_ADDRESS as Address,
      "addDelegate(address,address)",
      [usdcAddress, delegateAddress],
      blockchain
    );

    console.log(`Step 2: Waiting for addDelegate transaction to confirm...`);
    lastTxHash = await waitForTransactionConfirmation(addDelegateChallengeId);
    console.log(`Delegate added successfully. TxHash: ${lastTxHash}`);
  }

  // Only deposit if amount > 0
  if (amountInAtomicUnits > BigInt(0)) {
    const stepOffset = delegateAddress ? 2 : 0;

    console.log(`Step ${1 + stepOffset}: Approving Gateway contract for wallet ${walletId} on ${blockchain}...`);
    const approvalChallengeId = await initiateContractInteraction(
      walletId,
      usdcAddress as Address,
      "approve(address,uint256)",
      [GATEWAY_WALLET_ADDRESS, amountInAtomicUnits.toString()],
      blockchain
    );

    console.log(`Step ${2 + stepOffset}: Waiting for approval transaction (Challenge ID: ${approvalChallengeId}) to confirm...`);
    await waitForTransactionConfirmation(approvalChallengeId);

    console.log(`Step ${3 + stepOffset}: Calling deposit function on Gateway for wallet ${walletId} on ${blockchain}...`);
    const depositChallengeId = await initiateContractInteraction(
      walletId,
      GATEWAY_WALLET_ADDRESS as Address,
      "deposit(address,uint256)",
      [usdcAddress, amountInAtomicUnits.toString()],
      blockchain
    );

    console.log(`Step ${4 + stepOffset}: Waiting for deposit transaction (Challenge ID: ${depositChallengeId}) to confirm...`);
    const depositTxHash = await waitForTransactionConfirmation(depositChallengeId);

    console.log("Custodial deposit successful. Final TxHash:", depositTxHash);
    return depositTxHash;
  }

  // If we only added delegate and didn't deposit, return that txHash
  if (lastTxHash) {
    return lastTxHash;
  }

  throw new Error("No deposit amount and no delegate provided");
}

export async function withdrawFromCustodialWallet(
  walletId: string,
  chain: SupportedChain,
  amountInAtomicUnits: bigint
): Promise<string> {
  const usdcAddress = USDC_ADDRESSES[chain];
  const blockchain = requireCircleBlockchain(chain);

  console.log(`Step 1: Calling initiateWithdrawal function on Gateway for wallet ${walletId} on ${blockchain}...`);
  const initiateWithdrawalChallengeId = await initiateContractInteraction(
    walletId,
    GATEWAY_WALLET_ADDRESS as Address,
    "initiateWithdrawal(address,uint256)",
    [usdcAddress, amountInAtomicUnits.toString()],
    blockchain
  );

  console.log(`Step 2: Waiting for initiateWithdrawal transaction (Challenge ID: ${initiateWithdrawalChallengeId}) to confirm...`);
  await waitForTransactionConfirmation(initiateWithdrawalChallengeId);

  console.log(`Step 3: Calling withdraw function on Gateway for wallet ${walletId} on ${blockchain}...`);
  const withdrawChallengeId = await initiateContractInteraction(
    walletId,
    GATEWAY_WALLET_ADDRESS as Address,
    "withdraw(address)",
    [usdcAddress],
    blockchain
  );

  console.log(`Step 4: Waiting for withdraw transaction (Challenge ID: ${withdrawChallengeId}) to confirm...`);
  const withdrawTxHash = await waitForTransactionConfirmation(withdrawChallengeId);

  console.log("Custodial withdrawal successful. Final TxHash:", withdrawTxHash);
  return withdrawTxHash;
}

export async function submitBurnIntent(
  burnIntent: any,
  signature: `0x${string}`,
  options?: { enableForwarder?: boolean }
): Promise<{
  attestation?: `0x${string}`;
  attestationSignature?: `0x${string}`;
  transferId: string;
  fees: any;
}> {
  const payload = [
    {
      burnIntent: {
        maxBlockHeight: burnIntent.maxBlockHeight.toString(),
        maxFee: burnIntent.maxFee.toString(),
        spec: {
          ...burnIntent.spec,
          value: burnIntent.spec.value.toString(),
        },
      },
      signature,
    },
  ];

  const transferUrl = new URL("https://gateway-api-testnet.circle.com/v1/transfer");
  if (options?.enableForwarder) {
    transferUrl.searchParams.set("enableForwarder", "true");
  }

  const response = await fetch(transferUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : data;
  return {
    attestation: result.attestation as `0x${string}`,
    attestationSignature: result.signature as `0x${string}`,
    transferId: result.transferId,
    fees: result.fees,
  };
}

async function forwardedMintSucceededOnchain(
  transferDetails: unknown,
  destinationChain: SupportedChain,
  recipientAddress: Address,
  amount: bigint,
) {
  const { destinationTxHash } = gatewayForwardingSettlementFrom(transferDetails);
  if (!destinationTxHash) return false;

  try {
    const publicClient = createPublicClient({
      chain: getChainConfig(destinationChain),
      transport: getRpcTransport(destinationChain),
    });
    const receipt = await publicClient.getTransactionReceipt({ hash: destinationTxHash });
    return gatewayForwardedMintReceiptMatches({
      receiptStatus: receipt.status,
      tokenAddress: USDC_ADDRESSES[destinationChain],
      recipient: recipientAddress,
      amountAtomic: amount,
      logs: receipt.logs,
    });
  } catch (error) {
    console.warn(`Could not verify forwarded mint ${destinationTxHash} onchain.`, error);
    return false;
  }
}

async function pollForwardedGatewayTransfer(
  transferId: string,
  destinationChain: SupportedChain,
  recipientAddress: Address,
  amount: bigint,
): Promise<any> {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollResponse = await fetch(`https://gateway-api-testnet.circle.com/v1/transfer/${transferId}`);
    if (!pollResponse.ok) {
      console.warn(`Forwarded transfer poll failed: ${pollResponse.status}`);
      attempts++;
      continue;
    }

    const details = await pollResponse.json();
    const status = String(details.status ?? details.state ?? "").toLowerCase();
    console.log(`Forwarded transfer status: ${status || "unknown"} (attempt ${attempts + 1}/${maxAttempts})`);
    const mintReceiptMatches =
      status === "failed" &&
      await forwardedMintSucceededOnchain(details, destinationChain, recipientAddress, amount);
    const outcome = gatewayForwardingPollOutcome({ status, mintReceiptMatches });

    if (outcome === "settled") {
      if (status === "failed") {
        console.warn(`Circle reported transfer ${transferId} as failed, but the exact USDC mint is confirmed onchain.`);
        return {
          ...details,
          forwardingDetails: {
            ...(details.forwardingDetails ?? {}),
            onchainMintConfirmed: true,
            reportedStatus: status,
          },
        };
      }
      return details;
    }

    if (outcome === "failed" && status === "failed") {
      const reason = details.forwardingDetails?.failureReason ?? "unknown";
      throw new Error(`Forwarded transfer failed: ${reason}`);
    }

    if (outcome === "failed" && status === "expired") {
      throw new Error("Forwarded transfer attestation expired before minting.");
    }

    attempts++;
  }

  throw new Error(`Forwarded transfer did not complete after ${maxAttempts} attempts. Transfer ID: ${transferId}`);
}

export class GatewayForwardingSettlementError extends Error {
  readonly transferId: string;

  constructor(transferId: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Forwarded transfer ${transferId} was submitted, but settlement did not complete: ${detail}`);
    this.name = "GatewayForwardingSettlementError";
    this.transferId = transferId;
  }
}

export async function getCircleWalletAddress(walletId: string): Promise<Address> {
  const response = await circleDeveloperSdk.getWallet({ id: walletId });
  if (!response.data?.wallet?.address) {
    throw new Error(`Could not fetch address for wallet ID: ${walletId}`);
  }
  return response.data.wallet.address as Address;
}

async function signBurnIntentCircle(
  walletId: string,
  burnIntentData: BurnIntentData
): Promise<`0x${string}`> {
  const typedData = burnIntentTypedData(burnIntentData);

  const serializedData = JSON.stringify(typedData, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

  const response = await circleDeveloperSdk.signTypedData({
    walletId,
    data: serializedData,
  });

  const signature = response.data?.signature;

  if (!signature) {
    throw new Error("Failed to retrieve signature from Circle API.");
  }

  return signature as `0x${string}`;
}

// Helper to execute mint specifically on a target blockchain
// If walletId is provided, uses Circle wallet to execute mint
// If userId is provided without walletId, uses EOA wallet to execute mint
export async function executeMintCircle(
  walletIdOrUserId: string,
  destinationChain: SupportedChain,
  attestation: string,
  signature: string,
  isUserId: boolean = false
): Promise<Transaction> {
  const blockchain = requireCircleBlockchain(destinationChain);

  let response;
  let walletAddress: string;

  try {
    if (isUserId) {
      // Use EOA wallet to execute mint for external recipients
      const { address } = await getSignerWalletIdForUser(walletIdOrUserId, destinationChain);
      walletAddress = address;
    } else {
      // Use Circle SCA wallet to execute mint - get wallet address from Circle
      const walletResponse = await circleDeveloperSdk.getWallet({ id: walletIdOrUserId });
      walletAddress = walletResponse.data?.wallet?.address || '';
      if (!walletAddress) {
        throw new Error(`Could not find address for wallet ID: ${walletIdOrUserId}`);
      }
    }

    // Execute mint using walletAddress (not walletId) for multichain support
    response = await circleDeveloperSdk.createContractExecutionTransaction({
      walletAddress, // Use walletAddress for multichain transactions
      blockchain, // Specify destination blockchain
      contractAddress: GATEWAY_MINTER_ADDRESS,
      abiFunctionSignature: "gatewayMint(bytes,bytes)",
      abiParameters: [attestation, signature],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
    } as any);
  } catch (error: any) {
    console.error("Circle API error during mint:", error?.response?.data || error.message);
    
    // Check if this is an insufficient gas error
    const errorData = error?.response?.data;
    if (errorData?.code === 155258 || errorData?.errors?.[0]?.error === 'invalid_value') {
      const walletIdUsed = isUserId ? (await getSignerWalletIdForUser(walletIdOrUserId, destinationChain)).walletId : walletIdOrUserId;
      throw new Error(`INSUFFICIENT_GAS:${walletIdUsed}:${blockchain}`);
    }
    
    throw new Error(`Failed to execute mint transaction: ${errorData?.message || error.message}`);
  }

  const challengeId = response.data?.id;
  if (!challengeId) throw new Error("Failed to initiate minting challenge");

  // Wait for transaction confirmation to get the txHash
  console.log(`Waiting for mint transaction ${challengeId} to confirm...`);
  const txHash = await waitForTransactionConfirmation(challengeId);
  
  // Fetch the final transaction object
  const tx = await circleDeveloperSdk.getTransaction({ id: challengeId });
  if (!tx?.data?.transaction) {
    throw new Error(`Failed to fetch transaction ${challengeId}`);
  }
  
  // Ensure txHash is set
  const transaction = tx.data.transaction;
  if (!transaction.txHash) {
    transaction.txHash = txHash;
  }
  
  return transaction;
}

/**
 * Get the Circle wallet ID for the EOA signer for the given source chain and user
 */
async function getSignerWalletIdForUser(
  userId: string,
  chain: SupportedChain
): Promise<{ walletId: string; address: string }> {
  const { getGatewayEOAWalletId } = await import("@/lib/circle/create-gateway-eoa-wallets");
  
  const blockchain = GATEWAY_CHAIN_CONFIGS[chain].eoaWalletBlockchain;
  if (!blockchain) {
    throw new Error(`${GATEWAY_CHAIN_CONFIGS[chain].label} cannot use the Circle EOA signing wallet with the current SDK version.`);
  }
  return await getGatewayEOAWalletId(userId, blockchain);
}

/**
 * Check if a wallet has sufficient native token balance for gas fees
 * Returns the wallet address and balance info
 */
export async function checkWalletGasBalance(
  walletId: string,
  chain: SupportedChain
): Promise<{ hasGas: boolean; address: string; balance: string }> {
  const chainConfig = getChainConfig(chain);
  
  // Get wallet address
  const walletResponse = await circleDeveloperSdk.getWallet({ id: walletId });
  const walletAddress = walletResponse.data?.wallet?.address as Address;
  
  if (!walletAddress) {
    throw new Error(`Could not fetch address for wallet ID: ${walletId}`);
  }

  // Check native token balance
  const publicClient = createPublicClient({
    chain: chainConfig,
    transport: getRpcTransport(chain),
  });

  const balance = await publicClient.getBalance({ address: walletAddress });
  const hasGas = balance > BigInt(0);

  return {
    hasGas,
    address: walletAddress,
    balance: balance.toString(),
  };
}

export async function estimateGatewayTransferFeeAtomic(
  burnIntentData: BurnIntentData,
  options?: { enableForwarder?: boolean }
): Promise<bigint> {
  return (await estimateGatewayTransferFee(burnIntentData, options)).atomicFee;
}

export async function estimateGatewayTransferFee(
  burnIntentData: BurnIntentData,
  options?: { enableForwarder?: boolean }
): Promise<GatewayFeeEstimate> {
  const typedData = burnIntentTypedData(burnIntentData);
  return requestGatewayFeeEstimate(typedData.message as unknown as Record<string, unknown>, {
    enableForwarder: Boolean(options?.enableForwarder),
  });
}

export async function isGatewaySignerAuthorized(
  depositorAddress: Address,
  signerAddress: Address,
  chain: SupportedChain,
): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: getChainConfig(chain),
    transport: getRpcTransport(chain),
  });

  return await publicClient.readContract({
    address: GATEWAY_WALLET_ADDRESS as Address,
    abi: gatewayWalletAbi,
    functionName: "isAuthorizedForBalance",
    args: [USDC_ADDRESSES[chain] as Address, depositorAddress, signerAddress],
  });
}

async function signBurnIntentWithEOA(
  burnIntentData: BurnIntentData,
  sourceChain: SupportedChain,
  userId: string
): Promise<`0x${string}`> {
  const typedData = burnIntentTypedData(burnIntentData);

  const { walletId, address } = await getSignerWalletIdForUser(userId, sourceChain);

  console.log("Signing burn intent with EOA:", address);

  // Helper function to serialize BigInt values for JSON
  const serializeBigInt = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === "object") {
      const result: any = {};
      for (const key in obj) {
        result[key] = serializeBigInt(obj[key]);
      }
      return result;
    }
    return obj;
  };

  // Serialize BigInt values to strings for JSON
  const serializedTypedData = serializeBigInt(typedData);

  // Use Circle SDK to sign the typed data
  const response = await circleDeveloperSdk.signTypedData({
    walletId,
    data: JSON.stringify(serializedTypedData),
  });

  if (!response.data?.signature) {
    throw new Error("Failed to sign burn intent with Circle SDK");
  }

  return response.data.signature as `0x${string}`;
}

/**
 * Transfer Gateway balance using EOA wallet signing (no Circle wallet needed)
 * @param depositorAddress - The address that deposited to Gateway (has the balance)
 */
export async function transferGatewayBalanceWithEOA(
  userId: string,
  amount: bigint,
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  recipientAddress: Address,
  depositorAddress: Address,
  options?: { enableForwarder?: boolean; maxFee?: bigint }
): Promise<{
  transferId: string;
  attestation?: `0x${string}`;
  attestationSignature?: `0x${string}`;
  fees?: any;
  forwardingDetails?: any;
  destinationTxHash?: Hash;
}> {
  // 1. Get EOA signer for source chain (used for signing only)
  const { address } = await getSignerWalletIdForUser(userId, sourceChain);
  const eoaSignerAddress = address as Address;

  console.log(`Transferring ${Number(amount) / 1_000_000} USDC from Gateway`);
  console.log(`  Depositor (has balance): ${depositorAddress}`);
  console.log(`  Signer (signs burn): ${eoaSignerAddress}`);

  // 2. Ensure domains are defined
  const sourceDomain = DOMAIN_IDS[sourceChain];
  const destinationDomain = DOMAIN_IDS[destinationChain];
  
  if (sourceDomain === undefined || destinationDomain === undefined) {
    throw new Error(`Invalid chain configuration: source=${sourceChain}, destination=${destinationChain}`);
  }

  // 3. Construct Burn Intent. The quote obtained before any side effect is authoritative.
  const burnIntentData: BurnIntentData = {
    maxBlockHeight: maxUint256,
    maxFee: options?.maxFee ?? 1n,
    spec: {
      version: 1,
      sourceDomain: sourceDomain,
      destinationDomain: destinationDomain,
      sourceContract: GATEWAY_WALLET_ADDRESS as Address,
      destinationContract: GATEWAY_MINTER_ADDRESS as Address,
      sourceToken: USDC_ADDRESSES[sourceChain] as Address,
      destinationToken: USDC_ADDRESSES[destinationChain] as Address,
      sourceDepositor: depositorAddress, // The wallet that deposited (has the balance)
      destinationRecipient: recipientAddress,
      sourceSigner: eoaSignerAddress, // EOA signs the burn intent
      destinationCaller: zeroAddress,
      value: amount,
      salt: `0x${randomBytes(32).toString("hex")}` as `0x${string}`,
      hookData: "0x" as `0x${string}`,
    },
  };

  const maxFee = options?.maxFee ?? (await estimateGatewayTransferFee(burnIntentData, {
    enableForwarder: options?.enableForwarder,
  })).maxFeeAtomic;
  burnIntentData.maxFee = maxFee;

  // 4. Sign Intent with EOA
  const signature = await signBurnIntentWithEOA(burnIntentData, sourceChain, userId);

  // 5. Submit to Gateway
  const typedData = burnIntentTypedData(burnIntentData);

  const { attestation, attestationSignature, transferId, fees } = await submitBurnIntent(
    typedData.message,
    signature,
    { enableForwarder: options?.enableForwarder }
  );

  console.log(`Gateway transfer submitted. ID: ${transferId}`);

  if (options?.enableForwarder) {
    try {
      const transferDetails = await pollForwardedGatewayTransfer(
        transferId,
        destinationChain,
        recipientAddress,
        amount,
      );
      const settlement = gatewayForwardingSettlementFrom(transferDetails, fees);
      return {
        transferId,
        attestation,
        attestationSignature,
        ...settlement,
      };
    } catch (error) {
      throw new GatewayForwardingSettlementError(transferId, error);
    }
  }

  // 6. Poll for attestation if not immediately available
  let finalAttestation = attestation;
  let finalSignature = attestationSignature;

  if (!finalAttestation || !finalSignature) {
    console.log(`Polling for attestation...`);
    
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3000)); // Wait 3s

      const pollResponse = await fetch(`https://gateway-api-testnet.circle.com/v1/transfers/${transferId}`);
      const pollJson = await pollResponse.json();
      const status = pollJson.status || pollJson.state;

      console.log(`Transfer Status: ${status} (attempt ${attempts + 1}/${maxAttempts})`);

      if (pollJson.attestation && pollJson.signature) {
        finalAttestation = pollJson.attestation;
        finalSignature = pollJson.signature;
        console.log(`Attestation received!`);
        break;
      } else if (status === "FAILED") {
        throw new Error(`Transfer failed: ${JSON.stringify(pollJson)}`);
      }
      
      attempts++;
    }
    
    if (!finalAttestation || !finalSignature) {
      throw new Error(`Attestation not received after ${maxAttempts} attempts. Transfer ID: ${transferId}`);
    }
  }

  return {
    transferId,
    attestation: finalAttestation as `0x${string}`,
    attestationSignature: finalSignature as `0x${string}`,
    fees,
  };
}
export async function transferUnifiedBalanceCircle(
  walletId: string,
  amount: bigint,
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  recipientAddress?: Address
): Promise<{
  burnTxHash: Hash;
  attestation: `0x${string}`;
  mintTxHash: Hash;
}> {

  // 1. Get Wallet Address
  const walletAddress = await getCircleWalletAddress(walletId);
  const recipient = recipientAddress || walletAddress;

  // 2. Construct Burn Intent
  // maxFee is the maximum fee Gateway can charge (deducted from transfer amount)
  const maxFee = amount > BigInt(10_000_000) // If > 10 USDC
    ? BigInt(1_010_000) // Allow up to 1.01 USDC fee
    : amount / BigInt(10); // Otherwise allow 10% of amount as max fee

  const burnIntentData: BurnIntentData = {
    maxBlockHeight: maxUint256,
    maxFee: maxFee,
    spec: {
      version: 1,
      sourceDomain: DOMAIN_IDS[sourceChain],
      destinationDomain: DOMAIN_IDS[destinationChain],
      sourceContract: GATEWAY_WALLET_ADDRESS as Address,
      destinationContract: GATEWAY_MINTER_ADDRESS as Address,
      sourceToken: USDC_ADDRESSES[sourceChain] as Address,
      destinationToken: USDC_ADDRESSES[destinationChain] as Address,
      sourceDepositor: walletAddress,
      destinationRecipient: recipient,
      sourceSigner: walletAddress,
      destinationCaller: zeroAddress,
      value: amount,
      salt: `0x${randomBytes(32).toString("hex")}` as `0x${string}`,
      hookData: "0x" as `0x${string}`,
    },
  };

  const estimatedFee = await estimateGatewayTransferFeeAtomic(burnIntentData);
  if (estimatedFee > burnIntentData.maxFee) {
    burnIntentData.maxFee = estimatedFee + (estimatedFee / 10n);
  }

  // 3. Sign Intent (Custodial)
  const signature = await signBurnIntentCircle(walletId, burnIntentData);

  // 4. Submit to Gateway
  // (We need to regenerate typedData here just to get the 'message' part for the submission payload)
  const typedData = burnIntentTypedData(burnIntentData);

  const { attestation, attestationSignature, transferId } = await submitBurnIntent(
    typedData.message,
    signature
  );

  console.log(`Transfer submitted. ID: ${transferId}. Polling for attestation...`);

  // 5. Poll for Attestation
  let finalAttestation = attestation;
  let finalSignature = attestationSignature;

  if (!finalAttestation || !finalSignature) {
    while (true) {
      await new Promise((r) => setTimeout(r, 3000)); // Wait 3s

      const pollResponse = await fetch(`https://gateway-api-testnet.circle.com/v1/transfers/${transferId}`);
      const pollJson = await pollResponse.json();
      const status = pollJson.status || pollJson.state;

      console.log(`Transfer Status: ${status}`);

      if (pollJson.attestation && pollJson.signature) {
        finalAttestation = pollJson.attestation;
        finalSignature = pollJson.signature;
        break;
      } else if (status === "FAILED") {
        throw new Error(`Transfer failed on Gateway: ${JSON.stringify(pollJson)}`);
      }
    }
  }

  if (!finalAttestation || !finalSignature) {
    throw new Error(`Attestation not received for transfer ID: ${transferId}`);
  }

  // 6. Execute Mint on Destination (Custodial)
  const mintTx = await executeMintCircle(
    walletId,
    destinationChain,
    finalAttestation,
    finalSignature
  );

  return {
    burnTxHash: "0x" as Hash,
    attestation: finalAttestation,
    mintTxHash: mintTx.txHash as Hash,
  };
}

export async function fetchGatewayBalance(
  address: Address | Address[]
): Promise<{
  token: string;
  balances: Array<{ domain: number; depositor: string; balance: string }>;
}> {
  // Accepts several depositors so one call can cover a user's SCA *and* their Gateway signer
  // EOA. `GatewayWallet.deposit()` credits the calling wallet, so which address holds the
  // balance depends on who sent the deposit — see `app/api/gateway/deposit/sync/route.ts`.
  // Circle takes many sources per request, so this stays a single HTTP round-trip.
  const requested = Array.isArray(address) ? address : [address];
  const depositors = [
    ...new Map(requested.map((item) => [item.toLowerCase(), item])).values(),
  ];

  const sources = supportedGatewayChains.flatMap((chain) =>
    depositors.map((depositor) => ({
      domain: DOMAIN_IDS[chain],
      depositor,
    }))
  );

  // Circle rejects more than 20 sources per request with a 400, and there are already 12
  // supported chains — so two depositors (24 sources) overflows and the whole call fails,
  // taking every chain's balance with it. Chunk instead of trimming: a dropped source reads
  // back as "no balance", which is indistinguishable from a deposit that has not settled.
  const MAX_SOURCES_PER_REQUEST = 20;
  const batches: Array<typeof sources> = [];
  for (let index = 0; index < sources.length; index += MAX_SOURCES_PER_REQUEST) {
    batches.push(sources.slice(index, index + MAX_SOURCES_PER_REQUEST));
  }

  const responses = await Promise.all(
    batches.map(async (batch) => {
      const response = await fetch("https://gateway-api-testnet.circle.com/v1/balances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: "USDC", sources: batch }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gateway API error: ${response.status} - ${errorText}`);
      }

      return (await response.json()) as {
        token: string;
        balances?: Array<{ domain: number; depositor: string; balance: string }>;
      };
    })
  );

  return {
    token: responses[0]?.token ?? "USDC",
    balances: responses.flatMap((item) => item.balances ?? []),
  };
}

export type GatewayPendingDeposit = {
  depositor: string;
  domain: number;
  transactionHash: string;
  // Atomic units here ("1000000" = 1 USDC), unlike `/v1/balances` which returns decimals.
  amount: string;
  status: string;
  blockHeight: string;
  blockHash: string;
  blockTimestamp: string;
};

// Circle's per-deposit view: every deposit it has observed but not yet credited, keyed by
// transaction hash. `status` is documented as always `"pending"`, so membership in this list is
// the entire signal — the endpoint exists to answer "has Circle credited this deposit yet?".
//
// This is what `/v1/balances` fundamentally cannot tell us. A balance total cannot distinguish
// money that just arrived from money that was already there, so a deposit onto an already-funded
// chain is indistinguishable from one that has not been credited at all. Inferring from the total
// reported four Base deposits as available while Circle still listed all four as pending.
//
// `domain` is optional per source, and omitting it returns every chain for that depositor — which
// keeps this to one source per address rather than the chain x depositor cross product
// `fetchGatewayBalance` needs, so the 20-source cap is not a concern until 20+ wallets.
export async function fetchGatewayPendingDeposits(
  address: Address | Address[]
): Promise<{ token: string; deposits: GatewayPendingDeposit[] }> {
  const requested = Array.isArray(address) ? address : [address];
  const depositors = [
    ...new Map(requested.map((item) => [item.toLowerCase(), item])).values(),
  ];

  const response = await fetch("https://gateway-api-testnet.circle.com/v1/deposits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: "USDC",
      sources: depositors.map((depositor) => ({ depositor })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway API error: ${response.status} - ${errorText}`);
  }

  const json = (await response.json()) as {
    token?: string;
    deposits?: GatewayPendingDeposit[];
  };

  return {
    token: json.token ?? "USDC",
    deposits: json.deposits ?? [],
  };
}

export async function getUsdcBalance(
  address: Address,
  chain: SupportedChain
): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: getChainConfig(chain),
    transport: getRpcTransport(chain),
  });

  const balance = await publicClient.readContract({
    address: USDC_ADDRESSES[chain] as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  return balance as bigint;
}

export async function getTransactionBlockNumber(
  txHash: Hash,
  chain: SupportedChain,
): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: getChainConfig(chain),
    transport: getRpcTransport(chain),
  });
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  return receipt.blockNumber;
}

export async function fetchGatewayInfo(): Promise<{
  version: number;
  domains: Array<{
    chain: string;
    network: string;
    domain: number;
    walletContract: { address: string; supportedTokens: string[] };
    minterContract: { address: string; supportedTokens: string[] };
    processedHeight: string;
    burnIntentExpirationHeight: string;
  }>;
}> {
  const response = await fetch("https://gateway-api-testnet.circle.com/v1/info", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data;
}
