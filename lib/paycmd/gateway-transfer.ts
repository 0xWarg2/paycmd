import type { PayCmdChain } from "./chains";

export type GatewayMintGasMode = "auto_forwarding" | "manual";
export type GatewayFeeEstimateKind = "quoted_total" | "max_fee_reserve";

export type GatewayFeeBreakdown = {
  baseFeeAtomic?: bigint;
  transferFeeAtomic?: bigint;
  forwardingFeeAtomic?: bigint;
  totalAtomic?: bigint;
};

export type GatewayFeeBreakdownDecimal = {
  baseFee?: number;
  transferFee?: number;
  forwardingFee?: number;
  total?: number;
};

export function gatewayFeeBreakdownToDecimal(
  breakdown: GatewayFeeBreakdown,
): GatewayFeeBreakdownDecimal {
  const decimal = (value: bigint) => Number(value) / 1_000_000;
  return {
    ...(breakdown.baseFeeAtomic !== undefined
      ? { baseFee: decimal(breakdown.baseFeeAtomic) }
      : {}),
    ...(breakdown.transferFeeAtomic !== undefined
      ? { transferFee: decimal(breakdown.transferFeeAtomic) }
      : {}),
    ...(breakdown.forwardingFeeAtomic !== undefined
      ? { forwardingFee: decimal(breakdown.forwardingFeeAtomic) }
      : {}),
    ...(breakdown.totalAtomic !== undefined
      ? { total: decimal(breakdown.totalAtomic) }
      : {}),
  };
}

export type GatewayFeeEstimate = {
  atomicFee: bigint;
  maxFeeAtomic: bigint;
  feeEstimateKind: GatewayFeeEstimateKind;
  feeBreakdown: GatewayFeeBreakdown;
};

export type GatewayBurnIntentEstimate = {
  burnIntent: Record<string, unknown>;
  sourceDomain: number;
  maxBlockHeight: bigint;
  maxFeeAtomic: bigint;
  estimatedFeeAtomic: bigint;
};

export type GatewayBurnIntentSetEstimate = GatewayFeeEstimate & {
  intents: GatewayBurnIntentEstimate[];
};

const manualMintChains = new Set<PayCmdChain>([
  "arcTestnet",
  "arbitrumSepolia",
  "avalancheFuji",
  "baseSepolia",
  "sepolia",
  "optimismSepolia",
  "polygonAmoy",
  "unichainSepolia",
]);

export function gatewayManualMintSupported(chain: unknown): boolean {
  return typeof chain === "string" && manualMintChains.has(chain as PayCmdChain);
}

export function gatewaySupportedMintGasModes(chain: unknown): GatewayMintGasMode[] {
  return gatewayManualMintSupported(chain)
    ? ["auto_forwarding", "manual"]
    : ["auto_forwarding"];
}

export class GatewayManualMintUnsupportedError extends Error {
  readonly code = "GATEWAY_MANUAL_MINT_UNSUPPORTED";
  readonly supportedMintGasModes: GatewayMintGasMode[] = ["auto_forwarding"];
  readonly destinationChain: string;

  constructor(destinationChain: string) {
    super(
      `Manual mint is not supported on ${destinationChain} by the current Circle Wallet SDK. Use Auto forwarding.`,
    );
    this.name = "GatewayManualMintUnsupportedError";
    this.destinationChain = destinationChain;
  }
}

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

function own(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function optionalFeeAtomic(
  record: Record<string, unknown>,
  key: string,
): bigint | undefined {
  if (!own(record, key)) return undefined;
  const atomic = decimalUsdcToAtomic(record[key]);
  if (atomic === null || atomic < 0n) {
    throw new Error(`Circle Gateway fees.${key} must be a valid USDC decimal.`);
  }
  return atomic;
}

function gatewayFeeBreakdownFrom(fees: Record<string, unknown>): GatewayFeeBreakdown {
  if (own(fees, "perIntent") && !Array.isArray(fees.perIntent)) {
    throw new Error("Circle Gateway fees.perIntent must be an array.");
  }
  const perIntent = Array.isArray(fees.perIntent) ? fees.perIntent : [];

  let baseFeeAtomic: bigint | undefined;
  let transferFeeAtomic: bigint | undefined;
  for (const item of perIntent) {
    const intent = recordFrom(item);
    const base = optionalFeeAtomic(intent, "baseFee");
    const transfer = optionalFeeAtomic(intent, "transferFee");
    if (base !== undefined) baseFeeAtomic = (baseFeeAtomic ?? 0n) + base;
    if (transfer !== undefined) transferFeeAtomic = (transferFeeAtomic ?? 0n) + transfer;
  }

  const forwardingFeeAtomic = optionalFeeAtomic(fees, "forwardingFee");
  const totalAtomic = optionalFeeAtomic(fees, "total");

  return {
    ...(baseFeeAtomic !== undefined ? { baseFeeAtomic } : {}),
    ...(transferFeeAtomic !== undefined ? { transferFeeAtomic } : {}),
    ...(forwardingFeeAtomic !== undefined ? { forwardingFeeAtomic } : {}),
    ...(totalAtomic !== undefined ? { totalAtomic } : {}),
  };
}

export function parseGatewayFeeEstimate(
  value: unknown,
  options: { enableForwarder: boolean },
): GatewayFeeEstimate {
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
  const burnIntent = recordFrom(first.burnIntent);
  const reserve = positiveAtomic(burnIntent.maxFee);

  if (!reserve) {
    throw new Error("Circle Gateway estimate did not include a usable fee; usable maxFee is required.");
  }

  if (own(fees, "token") && String(fees.token).toUpperCase() !== "USDC") {
    throw new Error("Circle Gateway fee token must be USDC.");
  }

  const hasQuotedTotal = own(fees, "total");
  const quotedTotal = hasQuotedTotal ? decimalUsdcToAtomic(fees.total) : null;
  if (hasQuotedTotal && (!quotedTotal || quotedTotal <= 0n)) {
    throw new Error("Circle Gateway fees.total must be a positive USDC decimal.");
  }
  if (quotedTotal && quotedTotal > reserve) {
    throw new Error("Circle Gateway fees.total exceeds burnIntent.maxFee.");
  }

  const feeBreakdown = gatewayFeeBreakdownFrom(fees);
  if (quotedTotal) {
    return {
      atomicFee: quotedTotal,
      maxFeeAtomic: reserve,
      feeEstimateKind: "quoted_total",
      feeBreakdown,
    };
  }

  if (options.enableForwarder) {
    throw new Error("Circle Gateway forwarding estimate did not include fees.total.");
  }

  return {
    atomicFee: reserve,
    maxFeeAtomic: reserve,
    feeEstimateKind: "max_fee_reserve",
    feeBreakdown,
  };
}

export function parseGatewayFeeEstimateSet(
  value: unknown,
  options: { enableForwarder: boolean },
): GatewayBurnIntentSetEstimate {
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
  const burnIntentSet = recordFrom(first.burnIntentSet);
  const rawIntents = Array.isArray(burnIntentSet.intents) ? burnIntentSet.intents : [];
  if (rawIntents.length === 0 || rawIntents.length > 16) {
    throw new Error("Circle Gateway estimate must return between 1 and 16 BurnIntentSet intents.");
  }

  if (own(fees, "token") && String(fees.token).toUpperCase() !== "USDC") {
    throw new Error("Circle Gateway fee token must be USDC.");
  }
  if (own(fees, "perIntent") && !Array.isArray(fees.perIntent)) {
    throw new Error("Circle Gateway fees.perIntent must be an array.");
  }
  const perIntentFees = Array.isArray(fees.perIntent) ? fees.perIntent : [];

  const intents = rawIntents.map((value, index): GatewayBurnIntentEstimate => {
    const burnIntent = recordFrom(value);
    const spec = recordFrom(burnIntent.spec);
    const maxFeeAtomic = positiveAtomic(burnIntent.maxFee);
    const maxBlockHeight = positiveAtomic(burnIntent.maxBlockHeight);
    const sourceDomain = Number(spec.sourceDomain);
    if (!maxFeeAtomic || !maxBlockHeight || !Number.isSafeInteger(sourceDomain) || sourceDomain < 0) {
      throw new Error(`Circle Gateway BurnIntentSet intent ${index} is missing a usable maxFee, maxBlockHeight, or sourceDomain.`);
    }

    const intentFees = recordFrom(perIntentFees[index]);
    const baseFeeAtomic = optionalFeeAtomic(intentFees, "baseFee") ?? 0n;
    const transferFeeAtomic = optionalFeeAtomic(intentFees, "transferFee") ?? 0n;
    return {
      burnIntent,
      sourceDomain,
      maxBlockHeight,
      maxFeeAtomic,
      estimatedFeeAtomic: baseFeeAtomic + transferFeeAtomic,
    };
  });

  const maxFeeAtomic = intents.reduce((total, intent) => total + intent.maxFeeAtomic, 0n);
  const hasQuotedTotal = own(fees, "total");
  const quotedTotal = hasQuotedTotal ? decimalUsdcToAtomic(fees.total) : null;
  if (hasQuotedTotal && (!quotedTotal || quotedTotal <= 0n)) {
    throw new Error("Circle Gateway fees.total must be a positive USDC decimal.");
  }
  if (quotedTotal && quotedTotal > maxFeeAtomic) {
    throw new Error("Circle Gateway fees.total exceeds the BurnIntentSet maximum fee reserve.");
  }
  if (options.enableForwarder && !quotedTotal) {
    throw new Error("Circle Gateway forwarding estimate did not include fees.total.");
  }

  return {
    intents,
    atomicFee: quotedTotal ?? maxFeeAtomic,
    maxFeeAtomic,
    feeEstimateKind: quotedTotal ? "quoted_total" : "max_fee_reserve",
    feeBreakdown: gatewayFeeBreakdownFrom(fees),
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
  if (mintGasMode === "manual" && !gatewayManualMintSupported(input.destinationChain)) {
    throw new GatewayManualMintUnsupportedError(input.destinationChain);
  }
  const forwarding = mintGasMode === "auto_forwarding";

  return {
    mintGasMode,
    forwarding,
    destinationGasPreflight: !forwarding,
  };
}

export async function gatewayTransferPreflight(
  input: {
    amountAtomic: bigint;
    sourceChain: string;
    destinationChain: string;
    mintGasMode: unknown;
  },
  dependencies: {
    estimate: (input: {
      forwarding: boolean;
      plan: ReturnType<typeof gatewayTransferExecutionPlan>;
    }) => Promise<GatewayFeeEstimate>;
  },
) {
  // Capability validation deliberately precedes the quote. A rejected Manual destination
  // therefore cannot create a signer or reach any balance/deposit/burn work in the caller.
  const plan = gatewayTransferExecutionPlan(input);
  const estimate = await dependencies.estimate({
    forwarding: plan.forwarding,
    plan,
  });

  return {
    plan,
    estimate,
    amounts: gatewayFeeExecutionAmounts(input.amountAtomic, estimate),
  };
}

export function gatewayActualFeeAtomic(fees: unknown): bigint | undefined {
  const feeRecord = recordFrom(fees);
  if (own(feeRecord, "token") && String(feeRecord.token).toUpperCase() !== "USDC") {
    return undefined;
  }
  const atomic = decimalUsdcToAtomic(feeRecord.total);
  return atomic !== null && atomic > 0n ? atomic : undefined;
}

export function gatewayActualTransferAmounts(amountAtomic: bigint, fees: unknown): {
  actualFeeStatus: "actual" | "pending";
  actualGatewayFee: number | null;
  actualSourceDebit: number | null;
} {
  const actualFeeAtomic = gatewayActualFeeAtomic(fees);
  if (actualFeeAtomic === undefined) {
    return {
      actualFeeStatus: "pending",
      actualGatewayFee: null,
      actualSourceDebit: null,
    };
  }

  return {
    actualFeeStatus: "actual",
    actualGatewayFee: Number(actualFeeAtomic) / 1_000_000,
    actualSourceDebit: Number(amountAtomic + actualFeeAtomic) / 1_000_000,
  };
}

export function gatewayReceiptFeeComponents(input: {
  sourceChain: unknown;
  destinationChain: unknown;
  forwarding: unknown;
}) {
  return [
    "Gateway base fee",
    input.sourceChain !== input.destinationChain ? "transfer fee" : "",
    input.forwarding ? "forwarding fee" : "",
  ].filter(Boolean);
}

export type GatewayTransferAmounts = {
  amount: number;
  gatewayFee: number | null;
  sourceDebit: number | null;
  actual: boolean;
  actualFeeStatus: "actual" | "pending";
  estimatedGatewayFee: number;
  estimatedSourceDebit: number;
};

function finiteNonNegative(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
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
  const estimatedFee = finiteNonNegative(transfer.estimatedGatewayFee) ?? 0;
  const quotedDebit = finiteNonNegative(transfer.requiredGatewayBalance);
  const estimatedSourceDebit = quotedDebit ?? amount + estimatedFee;
  const explicitlyPending = transfer.actualFeeStatus === "pending";
  const parsedActualFeeAtomic = explicitlyPending
    ? undefined
    : gatewayActualFeeAtomic(fees);
  const actualFee = phase === "receipt" && parsedActualFeeAtomic !== undefined
    ? Number(parsedActualFeeAtomic) / 1_000_000
    : undefined;
  const actualSourceDebit = phase === "receipt" && actualFee !== undefined
    ? amount + actualFee
    : undefined;

  return {
    amount,
    gatewayFee: phase === "preview" ? estimatedFee : actualFee ?? null,
    sourceDebit: phase === "preview" ? estimatedSourceDebit : actualSourceDebit ?? null,
    actual: actualFee !== undefined,
    actualFeeStatus: actualFee !== undefined ? "actual" : "pending",
    estimatedGatewayFee: estimatedFee,
    estimatedSourceDebit,
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
    fees: transfer.fees,
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

export async function pollGatewayForwardingTransfer(input: {
  transferId: string;
  maxAttempts?: number;
  sleep: () => Promise<void>;
  fetchTransfer: () => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>;
  confirmMint: (details: Record<string, unknown>) => Promise<boolean>;
}): Promise<Record<string, unknown>> {
  const maxAttempts = input.maxAttempts ?? 60;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await input.sleep();

    let response: Awaited<ReturnType<typeof input.fetchTransfer>>;
    try {
      response = await input.fetchTransfer();
    } catch {
      continue;
    }
    if (!response.ok) continue;

    let details: Record<string, unknown>;
    try {
      details = recordFrom(await response.json());
    } catch {
      continue;
    }
    const status = String(details.status ?? details.state ?? "").toLowerCase();
    const mintReceiptMatches = status === "failed"
      ? await input.confirmMint(details)
      : false;
    const outcome = gatewayForwardingPollOutcome({ status, mintReceiptMatches });

    if (outcome === "settled") {
      if (status !== "failed") return details;
      return {
        ...details,
        forwardingDetails: {
          ...recordFrom(details.forwardingDetails),
          onchainMintConfirmed: true,
          reportedStatus: status,
        },
      };
    }

    if (outcome === "failed" && status === "failed") {
      const reason = recordFrom(details.forwardingDetails).failureReason ?? "unknown";
      throw new Error(`Forwarded transfer failed: ${reason}`);
    }
    if (outcome === "failed" && status === "expired") {
      throw new Error("Forwarded transfer attestation expired before minting.");
    }
  }

  throw new Error(
    `Forwarded transfer did not complete after ${maxAttempts} attempts. Transfer ID: ${input.transferId}`,
  );
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

export function gatewayBurnIntentSetTransferPayload(
  burnIntents: Record<string, unknown>[],
  signature: string,
) {
  if (burnIntents.length === 0 || burnIntents.length > 16) {
    throw new Error("Circle Gateway BurnIntentSet transfers require between 1 and 16 intents.");
  }
  if (!/^0x[0-9a-f]+$/i.test(signature)) {
    throw new Error("Circle Gateway BurnIntentSet signature must be hex encoded.");
  }

  return serializeBigInts([{
    burnIntentSet: { intents: burnIntents },
    signature,
  }]);
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

  return parseGatewayFeeEstimate(await response.json(), {
    enableForwarder: options.enableForwarder,
  });
}

export async function requestGatewayFeeEstimateSet(
  burnIntents: Record<string, unknown>[],
  options: {
    enableForwarder: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<GatewayBurnIntentSetEstimate> {
  if (burnIntents.length === 0 || burnIntents.length > 16) {
    throw new Error("Circle Gateway BurnIntentSet estimates require between 1 and 16 intents.");
  }
  const intents = burnIntents.map((intent) => {
    const partial = { ...intent };
    delete partial.maxFee;
    return partial;
  });
  const estimateUrl = new URL("https://gateway-api-testnet.circle.com/v1/estimate");
  if (options.enableForwarder) {
    estimateUrl.searchParams.set("enableForwarder", "true");
  }

  const response = await (options.fetchImpl ?? fetch)(estimateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([serializeBigInts({ intents })]),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gateway BurnIntentSet fee estimate failed: ${response.status} - ${detail}`);
  }

  return parseGatewayFeeEstimateSet(await response.json(), {
    enableForwarder: options.enableForwarder,
  });
}
