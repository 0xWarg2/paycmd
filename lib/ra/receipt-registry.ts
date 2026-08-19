import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  isHash,
  keccak256,
  parseUnits,
  stringToHex,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import { ARC_PRIMARY_RPC_URL, arcTestnetChain } from "@/lib/paycmd/arc-rpc";
import { privateKeyToAccount } from "viem/accounts";
import { normalizeChain } from "@/lib/paycmd/chains";
import { web3Chains } from "@/lib/paycmd/web3-chains";

export const raReceiptRegistryAbi = [
  {
    type: "function",
    name: "recordReceipt",
    stateMutability: "nonpayable",
    inputs: [
      { name: "commandId", type: "bytes32" },
      { name: "actionType", type: "uint8" },
      { name: "user", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amountAtomic", type: "uint256" },
      { name: "sourceChainId", type: "uint256" },
      { name: "destinationChainId", type: "uint256" },
      { name: "sourceTxHash", type: "bytes32" },
      { name: "destinationTxHash", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export type RaReceiptAction = "bridge" | "transfer" | "pay";
export type RaReceiptActionV2 = RaReceiptAction | "swap";

export type RaReceiptInput = {
  action: RaReceiptActionV2;
  commandId?: string | null;
  userAddress?: string | null;
  recipientAddress?: string | null;
  amount: string | number;
  amountAtomic?: string | bigint | null;
  sourceChain: string;
  destinationChain: string;
  sourceTxHash?: string | null;
  destinationTxHash?: string | null;
  metadata?: Record<string, unknown>;
};

export type RaReceiptResult =
  | {
      enabled: true;
      status: "success";
      chain: "arcTestnet";
      contractAddress: Address;
      txHash: Hash;
      metadataHash: Hash;
    }
  | {
      enabled: false;
      status: "skipped";
      reason: string;
    };

/**
 * Was a hand-written map holding only arc/base/avalanche, so a receipt on any of the other 9
 * supported chains was recorded onchain with chainId 0 — permanently, since receipts are
 * immutable. Resolving through normalizeChain covers every alias and every supported chain.
 */
function evmChainId(value?: string | null): bigint {
  const key = normalizeChain(value);
  return key ? BigInt(web3Chains[key].id) : 0n;
}

const actionTypes: Record<RaReceiptAction, number> = {
  bridge: 1,
  transfer: 2,
  pay: 3,
};
const actionTypesV2: Record<RaReceiptActionV2, number> = {
  ...actionTypes,
  swap: 4,
};

const raArcTestnet = arcTestnetChain;

function receiptEnabled() {
  return process.env.RA_RECEIPT_ENABLED === "true";
}

function zeroHash(): Hash {
  return `0x${"0".repeat(64)}` as Hash;
}

function toHash(value?: string | null): Hash {
  return value && isHash(value) ? (value as Hash) : zeroHash();
}

function toAddress(value?: string | null): Address {
  return value && isAddress(value) ? getAddress(value) : zeroAddress;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableJson(inner)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function commandIdHash(input: RaReceiptInput) {
  const value =
    input.commandId ||
    `${input.action}:${input.sourceChain}:${input.destinationChain}:${input.amount}:${input.sourceTxHash ?? ""}:${input.destinationTxHash ?? ""}`;
  return keccak256(stringToHex(value));
}

function metadataHash(input: RaReceiptInput) {
  return keccak256(
    stringToHex(
      stableJson({
        app: "Payna",
        version: 1,
        ...input.metadata,
      }),
    ),
  );
}

function amountAtomic(input: RaReceiptInput) {
  if (typeof input.amountAtomic === "bigint") return input.amountAtomic;
  if (typeof input.amountAtomic === "string" && /^\d+$/.test(input.amountAtomic)) {
    return BigInt(input.amountAtomic);
  }
  return parseUnits(String(input.amount), 6);
}

export async function recordRaReceipt(input: RaReceiptInput): Promise<RaReceiptResult> {
  if (!receiptEnabled()) {
    return { enabled: false, status: "skipped", reason: "RA_RECEIPT_ENABLED is not true" };
  }

  const contractAddress =
    input.action === "swap"
      ? process.env.RA_RECEIPT_REGISTRY_V2_ADDRESS ?? process.env.RA_RECEIPT_REGISTRY_ADDRESS
      : process.env.RA_RECEIPT_REGISTRY_ADDRESS;
  const privateKey = process.env.RA_RECEIPT_RELAYER_PRIVATE_KEY;

  if (!contractAddress || !isAddress(contractAddress)) {
    return { enabled: false, status: "skipped", reason: "RA receipt registry address is missing or invalid" };
  }

  if (!privateKey || !isHash(privateKey)) {
    return { enabled: false, status: "skipped", reason: "RA_RECEIPT_RELAYER_PRIVATE_KEY is missing or invalid" };
  }

  const account = privateKeyToAccount(privateKey as Hash);
  const transport = http(ARC_PRIMARY_RPC_URL);
  const publicClient = createPublicClient({ chain: raArcTestnet, transport });
  const walletClient = createWalletClient({ account, chain: raArcTestnet, transport });
  const txHash = await walletClient.writeContract({
    address: getAddress(contractAddress),
    abi: raReceiptRegistryAbi,
    functionName: "recordReceipt",
    args: [
      commandIdHash(input),
      actionTypesV2[input.action],
      toAddress(input.userAddress),
      toAddress(input.recipientAddress),
      amountAtomic(input),
      evmChainId(input.sourceChain),
      evmChainId(input.destinationChain),
      toHash(input.sourceTxHash),
      toHash(input.destinationTxHash),
      metadataHash(input),
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    enabled: true,
    status: "success",
    chain: "arcTestnet",
    contractAddress: getAddress(contractAddress),
    txHash,
    metadataHash: metadataHash(input),
  };
}

export async function updateRaProofColumns(params: {
  supabase: any;
  transactionId: string;
  result: RaReceiptResult;
  error?: unknown;
}) {
  if (params.result.enabled && params.result.status === "success") {
    await params.supabase
      .from("transaction_history")
      .update({
        proof_chain: params.result.chain,
        proof_contract_address: params.result.contractAddress,
        proof_tx_hash: params.result.txHash,
        proof_status: "success",
        proof_error: null,
      })
      .eq("id", params.transactionId);
    return;
  }

  await params.supabase
    .from("transaction_history")
    .update({
      proof_chain: "arcTestnet",
      proof_contract_address: process.env.RA_RECEIPT_REGISTRY_V2_ADDRESS ?? process.env.RA_RECEIPT_REGISTRY_ADDRESS ?? null,
      proof_status: params.error ? "failed" : params.result.status,
      proof_error: params.error instanceof Error ? params.error.message : params.result.reason,
    })
    .eq("id", params.transactionId);
}
