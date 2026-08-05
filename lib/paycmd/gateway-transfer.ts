export type GatewayMintGasMode = "auto_forwarding" | "manual";
export type GatewayFeeEstimateKind = "quoted_total" | "max_fee_reserve";

export type GatewayFeeEstimate = {
  atomicFee: bigint;
  maxFeeAtomic: bigint;
  feeEstimateKind: GatewayFeeEstimateKind;
};

export function gatewayFeeExecutionAmounts(
  amountAtomic: bigint,
  estimate: GatewayFeeEstimate,
) {
  return {
    estimatedFeeAtomic: estimate.atomicFee,
    maxFeeAtomic: estimate.maxFeeAtomic,
    requiredGatewayBalanceAtomic: amountAtomic + estimate.maxFeeAtomic,
  };
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function decimalUsdcToAtomic(value: unknown): bigint | null {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function usdcAmountToAtomic(value: unknown): bigint {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("USDC amount must be a positive decimal number.");
  }
  const fraction = normalized.split(".")[1] ?? "";
  if (fraction.length > 6) {
    throw new Error("USDC amount supports at most six decimal places.");
  }
  const atomic = decimalUsdcToAtomic(normalized);
  if (!atomic || atomic <= 0n) {
    throw new Error("USDC amount must be positive.");
  }
  return atomic;
}

function positiveAtomic(value: unknown): bigint | null {
  try {
    const atomic = BigInt(String(value ?? ""));
    return atomic > 0n ? atomic : null;
  } catch {
    return null;
  }
}

export function parseGatewayFeeEstimate(value: unknown): GatewayFeeEstimate {
  const root = recordFrom(value);
  const body = Array.isArray(value)
    ? value
    : Array.isArray(root.body)
      ? root.body
      : [];
  const first = recordFrom(body[0]);
  const fees = Object.keys(recordFrom(root.fees)).length
    ? recordFrom(root.fees)
    : recordFrom(first.fees);
  const quotedTotal = decimalUsdcToAtomic(fees.total);
  const burnIntent = recordFrom(first.burnIntent);
  const reserve = positiveAtomic(burnIntent.maxFee);

  if (!reserve) {
    throw new Error("Circle Gateway estimate did not include a usable fee; usable maxFee is required.");
  }

  if (quotedTotal && quotedTotal > 0n) {
    return {
      atomicFee: quotedTotal,
      maxFeeAtomic: reserve,
      feeEstimateKind: "quoted_total",
    };
  }

  return {
    atomicFee: reserve,
    maxFeeAtomic: reserve,
    feeEstimateKind: "max_fee_reserve",
  };
}

export function gatewayMintGasModeFrom(value: unknown): GatewayMintGasMode {
  if (value === "auto_forwarding" || value === "manual") return value;
  throw new Error('mintGasMode must be "auto_forwarding" or "manual".');
}

export function gatewayTransferExecutionPlan(input: {
  sourceChain: string;
  destinationChain: string;
  mintGasMode: unknown;
}) {
  const mintGasMode = gatewayMintGasModeFrom(input.mintGasMode);
  const forwarding = mintGasMode === "auto_forwarding";

  return {
    mintGasMode,
    forwarding,
    destinationGasPreflight: !forwarding,
  };
}

export function gatewayActualFeeAtomic(fees: unknown): bigint | undefined {
  const atomic = decimalUsdcToAtomic(recordFrom(fees).total);
  return atomic !== null ? atomic : undefined;
}

export type GatewayTransferAmounts = {
  amount: number;
  gatewayFee: number;
  sourceDebit: number;
  actual: boolean;
};

function finiteNonNegative(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function gatewayTransferAmounts(
  value: unknown,
  phase: "preview" | "receipt",
): GatewayTransferAmounts {
  const transfer = recordFrom(value);
  const amount = finiteNonNegative(transfer.amount) ?? 0;
  const fees = recordFrom(transfer.fees);
  const actualFee =
    phase === "receipt"
      ? finiteNonNegative(fees.total) ?? finiteNonNegative(transfer.actualGatewayFee)
      : undefined;
  const estimatedFee = finiteNonNegative(transfer.estimatedGatewayFee) ?? 0;
  const gatewayFee = actualFee ?? estimatedFee;
  const quotedDebit = finiteNonNegative(transfer.requiredGatewayBalance);

  return {
    amount,
    gatewayFee,
    sourceDebit: actualFee === undefined && phase === "preview" && quotedDebit !== undefined
      ? quotedDebit
      : amount + gatewayFee,
    actual: actualFee !== undefined,
  };
}

export type GatewayForwardingSettlement = {
  fees: unknown;
  forwardingDetails: Record<string, unknown>;
  destinationTxHash?: `0x${string}`;
};

function evmTransactionHashFrom(value: unknown): `0x${string}` | undefined {
  const hash = String(value ?? "");
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
    ? (hash as `0x${string}`)
    : undefined;
}

export function gatewayForwardingSettlementFrom(
  value: unknown,
  fallbackFees?: unknown,
): GatewayForwardingSettlement {
  const transfer = recordFrom(value);
  const nestedDetails = recordFrom(transfer.forwardingDetails);
  const destinationTxHash =
    evmTransactionHashFrom(transfer.transactionHash) ??
    evmTransactionHashFrom(nestedDetails.transactionHash);
  const forwardingDetails = { ...nestedDetails };
  delete forwardingDetails.transactionHash;
  if (destinationTxHash) {
    forwardingDetails.transactionHash = destinationTxHash;
  }

  return {
    fees: transfer.fees ?? fallbackFees,
    destinationTxHash,
    forwardingDetails,
  };
}

export function gatewayForwardingFailureMessage(transferId?: string) {
  const transferReference = transferId ? ` Circle transfer ID: ${transferId}.` : "";
  return (
    "Circle Forwarding was already submitted, but settlement did not complete successfully." +
    transferReference +
    " Payna did not retry or fall back to Manual. Check the Circle transfer status before any manual retry to avoid sending twice."
  );
}

export function gatewayForwardingTransferId(value: unknown) {
  const transferId = recordFrom(value).transferId;
  return typeof transferId === "string" && transferId.trim()
    ? transferId.trim()
    : undefined;
}

export function gatewayForwardingPollOutcome(value: {
  status: unknown;
  mintReceiptMatches?: boolean;
}): "pending" | "settled" | "failed" {
  const status = String(value.status ?? "").toLowerCase();
  if (status === "confirmed" || status === "finalized") return "settled";
  if (status === "failed") return value.mintReceiptMatches ? "settled" : "failed";
  if (status === "expired") return "failed";
  return "pending";
}

const erc20TransferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function gatewayForwardedMintReceiptMatches(value: {
  receiptStatus: unknown;
  tokenAddress: unknown;
  recipient: unknown;
  amountAtomic: bigint;
  logs: unknown;
}) {
  if (value.receiptStatus !== "success" || !Array.isArray(value.logs)) return false;

  const tokenAddress = String(value.tokenAddress ?? "").toLowerCase();
  const recipient = String(value.recipient ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(tokenAddress) || !/^0x[a-f0-9]{40}$/.test(recipient)) {
    return false;
  }

  const zeroAddressTopic = `0x${"0".repeat(64)}`;
  const recipientTopic = `0x${recipient.slice(2).padStart(64, "0")}`;

  return value.logs.some((item) => {
    const log = recordFrom(item);
    const topics = Array.isArray(log.topics) ? log.topics.map((topic) => String(topic).toLowerCase()) : [];
    if (
      String(log.address ?? "").toLowerCase() !== tokenAddress ||
      topics[0] !== erc20TransferTopic ||
      topics[1] !== zeroAddressTopic ||
      topics[2] !== recipientTopic
    ) {
      return false;
    }

    try {
      return BigInt(String(log.data ?? "")) === value.amountAtomic;
    } catch {
      return false;
    }
  });
}

export function gatewayDestinationTxHash(value: {
  mintTxHash?: unknown;
  forwardedDestinationTxHash?: unknown;
  forwardingDetails?: unknown;
}): `0x${string}` | undefined {
  return (
    evmTransactionHashFrom(value.mintTxHash) ??
    evmTransactionHashFrom(value.forwardedDestinationTxHash) ??
    evmTransactionHashFrom(recordFrom(value.forwardingDetails).transactionHash)
  );
}

function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serializeBigInts(item),
      ]),
    );
  }
  return value;
}

export async function requestGatewayFeeEstimate(
  burnIntent: Record<string, unknown>,
  options: {
    enableForwarder: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<GatewayFeeEstimate> {
  const partialBurnIntent = { ...burnIntent };
  delete partialBurnIntent.maxFee;
  const estimateUrl = new URL("https://gateway-api-testnet.circle.com/v1/estimate");
  if (options.enableForwarder) {
    estimateUrl.searchParams.set("enableForwarder", "true");
  }

  const response = await (options.fetchImpl ?? fetch)(estimateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([serializeBigInts(partialBurnIntent)]),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gateway fee estimate failed: ${response.status} - ${detail}`);
  }

  return parseGatewayFeeEstimate(await response.json());
}
