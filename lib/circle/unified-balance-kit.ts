import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import {
  Blockchain,
  UnifiedBalanceChain,
  UnifiedBalanceKit,
  isKitError,
  type SpendResult,
} from "@circle-fin/unified-balance-kit";
import type { Address } from "viem";

import type { SupportedChain } from "./gateway-sdk";
import { ArcAddressSafetyError, assertArcAddressTransferable } from "../paycmd/arc-security.ts";

export type GatewayUnifiedMintGasMode = "auto_forwarding" | "manual";

const QUOTE_TTL_MS = 60_000;
export const CIRCLE_KIT_FEE_TOLERANCE_BPS = 500;

export const circleKitGatewayChains = [
  "arcTestnet",
  "arbitrumSepolia",
  "avalancheFuji",
  "baseSepolia",
  "sepolia",
  "optimismSepolia",
  "polygonAmoy",
  "unichainSepolia",
] as const satisfies readonly SupportedChain[];

export type CircleKitGatewayChain = (typeof circleKitGatewayChains)[number];

const eligibleChains = new Set<string>(circleKitGatewayChains);

const paynaToCircleChain: Record<CircleKitGatewayChain, UnifiedBalanceChain> = {
  arcTestnet: UnifiedBalanceChain.Arc_Testnet,
  arbitrumSepolia: UnifiedBalanceChain.Arbitrum_Sepolia,
  avalancheFuji: UnifiedBalanceChain.Avalanche_Fuji,
  baseSepolia: UnifiedBalanceChain.Base_Sepolia,
  sepolia: UnifiedBalanceChain.Ethereum_Sepolia,
  optimismSepolia: UnifiedBalanceChain.Optimism_Sepolia,
  polygonAmoy: UnifiedBalanceChain.Polygon_Amoy_Testnet,
  unichainSepolia: UnifiedBalanceChain.Unichain_Sepolia,
};

const circleToPaynaChain = new Map<string, SupportedChain>([
  [Blockchain.Arc_Testnet, "arcTestnet"],
  [Blockchain.Arbitrum_Sepolia, "arbitrumSepolia"],
  [Blockchain.Avalanche_Fuji, "avalancheFuji"],
  [Blockchain.Base_Sepolia, "baseSepolia"],
  [Blockchain.Ethereum_Sepolia, "sepolia"],
  [Blockchain.HyperEVM_Testnet, "hyperEvmTestnet"],
  [Blockchain.Optimism_Sepolia, "optimismSepolia"],
  [Blockchain.Polygon_Amoy_Testnet, "polygonAmoy"],
  [Blockchain.Sei_Testnet, "seiAtlantic"],
  [Blockchain.Sonic_Testnet, "sonicTestnet"],
  [Blockchain.Unichain_Sepolia, "unichainSepolia"],
  [Blockchain.World_Chain_Sepolia, "worldChainSepolia"],
]);

export type CircleKitFeeAllocation = {
  chain: string;
  sourceChain: SupportedChain | null;
  amount: string;
};

export type CircleKitFee = {
  type: string;
  token: string;
  amount: string;
  allocations?: CircleKitFeeAllocation[];
};

export type CircleKitUnifiedEstimate = {
  engine: "circle_kit";
  sourceMode: "unified";
  allocationPolicy: "circle_auto";
  authorizationMode: "sca_erc1271";
  amount: string;
  destinationChain: CircleKitGatewayChain;
  recipient: Address;
  quoteSubject: string;
  fundingFingerprint: string;
  totalConfirmedBalance: string;
  totalPendingBalance?: string;
  eligibleConfirmedBalance: string;
  balanceBreakdown: Array<{
    chain: string;
    sourceChain: SupportedChain | null;
    confirmedBalance: string;
    pendingBalance?: string;
    eligible: boolean;
  }>;
  fees: CircleKitFee[];
  totalEstimatedFee: string;
  feeToleranceBps: 500;
  maximumTotalFee: string;
  estimatedSourceDebit: string;
  maximumSourceDebit: string;
  quoteFingerprint: string;
  quoteExpiresAt: string;
  mintGasMode: GatewayUnifiedMintGasMode;
  forwarding: boolean;
  manualMintSupported: true;
  supportedMintGasModes: GatewayUnifiedMintGasMode[];
};

export class GatewayCircleKitError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "GatewayCircleKitError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class GatewayCircleKitSpendError extends Error {
  readonly originalError: unknown;
  readonly transferId?: string;
  readonly transferSubmitted: boolean;
  readonly recoverability?: string;
  readonly kitErrorName?: string;
  readonly recovery?: { attestation: string; signature: string };
  readonly allocations?: Array<{ chain: string; amount: string }>;

  constructor(input: {
    error: unknown;
    transferId?: string;
    recovery?: { attestation: string; signature: string };
    allocations?: Array<{ chain: string; amount: string }>;
  }) {
    const message = input.error instanceof Error ? input.error.message : "Circle Unified Balance spend failed.";
    super(message);
    this.name = "GatewayCircleKitSpendError";
    this.originalError = input.error;
    this.transferId = input.transferId;
    this.transferSubmitted = Boolean(input.transferId || input.recovery);
    this.recovery = input.recovery;
    this.allocations = input.allocations;
    if (isKitError(input.error)) {
      this.recoverability = input.error.recoverability;
      this.kitErrorName = input.error.name;
    }
  }
}

export function isCircleKitGatewayChain(chain: unknown): chain is CircleKitGatewayChain {
  return typeof chain === "string" && eligibleChains.has(chain);
}

export function circleKitSupportedMintGasModes(destinationChain: CircleKitGatewayChain) {
  const kit = createKit();
  const forwarderDestinations = kit.getSupportedChains("USDC", {
    forwarderSupported: "destination",
  });
  const supportsForwarder = forwarderDestinations.some(
    (chain) => String(chain.chain) === String(toCircleKitChain(destinationChain)),
  );
  return supportsForwarder
    ? (["auto_forwarding", "manual"] as GatewayUnifiedMintGasMode[])
    : (["manual"] as GatewayUnifiedMintGasMode[]);
}

export function assertCircleKitMintGasMode(
  destinationChain: CircleKitGatewayChain,
  mintGasMode: unknown,
): GatewayUnifiedMintGasMode {
  const normalized = mintGasMode === "manual" ? "manual" : "auto_forwarding";
  const supportedMintGasModes = circleKitSupportedMintGasModes(destinationChain);
  if (!supportedMintGasModes.includes(normalized)) {
    throw new GatewayCircleKitError(
      "GATEWAY_FORWARDER_DISABLED_FOR_DESTINATION",
      `Auto Forwarding is not available for ${destinationChain}. Use Manual mint with the Circle SCA.`,
      422,
      { destinationChain, supportedMintGasModes },
    );
  }
  return normalized;
}

export function toCircleKitChain(chain: CircleKitGatewayChain): UnifiedBalanceChain {
  return paynaToCircleChain[chain];
}

export function fromCircleKitChain(chain: unknown): SupportedChain | null {
  return typeof chain === "string" ? circleToPaynaChain.get(chain) ?? null : null;
}

function requiredEnvironment(name: "CIRCLE_API_KEY" | "CIRCLE_ENTITY_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new GatewayCircleKitError(
      "GATEWAY_CIRCLE_KIT_NOT_CONFIGURED",
      `${name} is required for Circle Unified Balance Kit.`,
      503,
    );
  }
  return value;
}

function chainIdentifier(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.chain === "string") return record.chain;
  if (typeof record.name === "string") return record.name;
  return undefined;
}

function contextAddress(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const address = (value as Record<string, unknown>).address;
  return typeof address === "string" ? address : undefined;
}

function assertEligibleCircleChain(value: unknown) {
  const circleChain = chainIdentifier(value);
  const sourceChain = circleChain ? circleToPaynaChain.get(circleChain) : undefined;
  if (!sourceChain || !eligibleChains.has(sourceChain)) {
    throw new GatewayCircleKitError(
      "GATEWAY_AUTO_SOURCE_UNSUPPORTED",
      `Circle selected an unsupported Unified Balance source chain: ${circleChain ?? "unknown"}.`,
      422,
      { circleChain: circleChain ?? null, sourceChain: sourceChain ?? null },
    );
  }
  return sourceChain as CircleKitGatewayChain;
}

function createScaOnlyAdapter(scaAddress: Address) {
  const adapter = createCircleWalletsAdapter({
    apiKey: requiredEnvironment("CIRCLE_API_KEY"),
    entitySecret: requiredEnvironment("CIRCLE_ENTITY_SECRET"),
  });

  const assertSca = async (address: string, chain: unknown) => {
    assertEligibleCircleChain(chain);
    if (address.toLowerCase() !== scaAddress.toLowerCase()) {
      throw new GatewayCircleKitError(
        "GATEWAY_SCA_ADDRESS_MISMATCH",
        "Unified Balance Kit attempted to authorize with an address other than the user's Circle SCA.",
        422,
      );
    }
    const bytecode = await adapter.readBytecode(address, chain as Parameters<typeof adapter.readBytecode>[1]);
    if (!bytecode || bytecode === "0x") {
      throw new GatewayCircleKitError(
        "GATEWAY_SCA_CONTRACT_REQUIRED",
        `The Circle wallet is not deployed as an SCA contract on ${chainIdentifier(chain) ?? "the selected chain"}.`,
        422,
        { chain: chainIdentifier(chain) ?? null },
      );
    }
    return bytecode;
  };

  return new Proxy(adapter, {
    get(target, property) {
      if (property === "readBytecode") {
        return async (address: string, chain: unknown) => assertSca(address, chain);
      }
      if (property === "signTypedData") {
        return async (typedData: unknown, context: unknown) => {
          const address = contextAddress(context);
          const chain = context && typeof context === "object"
            ? (context as Record<string, unknown>).chain
            : undefined;
          if (!address) {
            throw new GatewayCircleKitError(
              "GATEWAY_SCA_ADDRESS_REQUIRED",
              "Circle SCA address context is required for Unified Balance signing.",
              422,
            );
          }
          await assertSca(address, chain);
          return target.signTypedData(
            typedData as Parameters<typeof target.signTypedData>[0],
            context as Parameters<typeof target.signTypedData>[1],
          );
        };
      }
      if (property === "prepare") {
        return async (transaction: unknown, context: unknown) => {
          const address = contextAddress(context);
          const chain = context && typeof context === "object"
            ? (context as Record<string, unknown>).chain
            : undefined;
          if (!address) {
            throw new GatewayCircleKitError(
              "GATEWAY_SCA_ADDRESS_REQUIRED",
              "Circle SCA address context is required for Manual mint.",
              422,
            );
          }
          await assertSca(address, chain);
          return target.prepare(
            transaction as Parameters<typeof target.prepare>[0],
            context as Parameters<typeof target.prepare>[1],
          );
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function createKit() {
  return new UnifiedBalanceKit({
    disableAnalytics: true,
    disableErrorReporting: true,
  });
}

async function assertCircleKitArcRecipient(
  destinationChain: CircleKitGatewayChain,
  recipient: Address,
) {
  if (destinationChain !== "arcTestnet") return;
  try {
    await assertArcAddressTransferable(recipient);
  } catch (error) {
    if (error instanceof ArcAddressSafetyError) {
      throw new GatewayCircleKitError(error.code, error.message, error.status, {
        destinationChain,
        recipient,
      });
    }
    throw error;
  }
}

function decimalToAtomic(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) {
    throw new GatewayCircleKitError(
      "INVALID_GATEWAY_TRANSFER",
      "USDC amount must be positive and have at most six decimal places.",
      400,
    );
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function circleKitUsdcToAtomic(value: string, options?: { allowZero?: boolean }) {
  const atomic = decimalToAtomic(value);
  if (atomic < 0n || (atomic === 0n && !options?.allowZero)) {
    throw new GatewayCircleKitError(
      "INVALID_GATEWAY_TRANSFER",
      "USDC amount must be greater than zero.",
      400,
    );
  }
  return atomic;
}

export function circleKitAtomicToUsdc(value: bigint) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function normalizeFees(fees: readonly {
  type: string;
  token: string;
  amount: string;
  allocations?: readonly { chain: string; amount: string }[];
}[]): CircleKitFee[] {
  return fees.map((fee) => ({
    type: fee.type,
    token: fee.token,
    amount: fee.amount,
    ...(fee.allocations
      ? {
          allocations: fee.allocations.map((allocation) => ({
            chain: allocation.chain,
            sourceChain: circleToPaynaChain.get(allocation.chain) ?? null,
            amount: allocation.amount,
          })),
        }
      : {}),
  }));
}

function assertEstimatedSourcesSupported(fees: CircleKitFee[]) {
  const unsupported = fees.flatMap((fee) => fee.allocations ?? []).filter(
    (allocation) => !allocation.sourceChain || !eligibleChains.has(allocation.sourceChain),
  );
  if (unsupported.length) {
    throw new GatewayCircleKitError(
      "GATEWAY_AUTO_SOURCE_UNSUPPORTED",
      "Circle Auto Allocation selected a source chain that HeyPayna has not enabled for SCA signing.",
      422,
      {
        unsupportedSources: unsupported.map((allocation) => ({
          chain: allocation.chain,
          sourceChain: allocation.sourceChain,
        })),
      },
    );
  }
}

function quoteSigningKey() {
  const key = process.env.GATEWAY_QUOTE_SIGNING_SECRET?.trim();
  if (!key || key.length < 32) {
    throw new GatewayCircleKitError(
      "GATEWAY_QUOTE_SIGNING_SECRET_REQUIRED",
      "GATEWAY_QUOTE_SIGNING_SECRET must be a dedicated server-side secret of at least 32 characters.",
      503,
    );
  }
  return key;
}

function quotePayload(
  estimate: Omit<CircleKitUnifiedEstimate, "quoteFingerprint" | "quoteExpiresAt">,
  issuedAt: number,
  totalFeeAtomic: bigint,
) {
  return {
    version: 1,
    issuedAt,
    totalFeeAtomic: totalFeeAtomic.toString(),
    engine: estimate.engine,
    amount: estimate.amount,
    destinationChain: estimate.destinationChain,
    recipient: estimate.recipient.toLowerCase(),
    mintGasMode: estimate.mintGasMode,
    quoteSubject: estimate.quoteSubject,
    fundingFingerprint: estimate.fundingFingerprint,
  };
}

function maximumFeeAtomic(totalFeeAtomic: bigint) {
  const toleranceAtomic = (
    totalFeeAtomic * BigInt(CIRCLE_KIT_FEE_TOLERANCE_BPS) + 9_999n
  ) / 10_000n;
  return totalFeeAtomic + toleranceAtomic;
}

export function circleKitQuoteFingerprint(
  estimate: Omit<CircleKitUnifiedEstimate, "quoteFingerprint" | "quoteExpiresAt">,
  issuedAt: number,
  signingKey = quoteSigningKey(),
) {
  const totalFeeAtomic = decimalToAtomic(estimate.totalEstimatedFee);
  const signature = createHmac("sha256", signingKey)
    .update(JSON.stringify(quotePayload(estimate, issuedAt, totalFeeAtomic)))
    .digest("hex");
  return `${issuedAt}.${totalFeeAtomic}.${signature}`;
}

export function circleKitOperationFingerprint(input: {
  userId: string;
  amount: string;
  recipient: Address;
  destinationChain: CircleKitGatewayChain;
  mintGasMode: GatewayUnifiedMintGasMode;
}) {
  const normalized = {
    version: 1,
    userId: input.userId,
    sourceMode: "unified",
    allocationPolicy: "circle_auto",
    amountAtomic: circleKitUsdcToAtomic(input.amount).toString(),
    recipient: input.recipient.toLowerCase(),
    destinationChain: input.destinationChain,
    mintGasMode: input.mintGasMode,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function parseQuoteFingerprint(value: string) {
  const [timestamp, feeAtomic, signature, ...extra] = value.split(".");
  if (
    extra.length ||
    !/^\d{13}$/.test(timestamp ?? "") ||
    !/^\d+$/.test(feeAtomic ?? "") ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  ) return null;
  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt)) return null;
  return { issuedAt, totalFeeAtomic: BigInt(feeAtomic), signature };
}

function spendParams(input: {
  adapter: ReturnType<typeof createScaOnlyAdapter>;
  scaAddress: Address;
  recipient: Address;
  destinationChain: CircleKitGatewayChain;
  amount: string;
  mintGasMode: GatewayUnifiedMintGasMode;
}) {
  return {
    amount: input.amount,
    token: "USDC" as const,
    from: {
      adapter: input.adapter,
      address: input.scaAddress,
    },
    to: {
      adapter: input.adapter,
      address: input.scaAddress,
      recipientAddress: input.recipient,
      chain: toCircleKitChain(input.destinationChain),
      useForwarder: input.mintGasMode === "auto_forwarding",
    },
  };
}

export async function estimateCircleKitUnifiedSpend(input: {
  userId: string;
  scaAddress: Address;
  recipient: Address;
  destinationChain: CircleKitGatewayChain;
  amount: string;
  mintGasMode: unknown;
}): Promise<CircleKitUnifiedEstimate> {
  const mintGasMode = assertCircleKitMintGasMode(input.destinationChain, input.mintGasMode);
  await assertCircleKitArcRecipient(input.destinationChain, input.recipient);
  const adapter = createScaOnlyAdapter(input.scaAddress);
  const kit = createKit();
  const params = spendParams({ ...input, adapter, mintGasMode });
  const [balances, estimate] = await Promise.all([
    kit.getBalances({
      token: "USDC",
      sources: { adapter, address: input.scaAddress },
      networkType: "testnet",
      includePending: true,
    }),
    kit.estimateSpend(params),
  ]);

  const fees = normalizeFees(estimate.fees);
  assertEstimatedSourcesSupported(fees);
  const balanceBreakdown = balances.breakdown.flatMap((account) =>
    account.breakdown.map((balance) => {
      const sourceChain = circleToPaynaChain.get(balance.chain) ?? null;
      return {
        chain: balance.chain,
        sourceChain,
        confirmedBalance: balance.confirmedBalance,
        pendingBalance: balance.pendingBalance ?? "0",
        eligible: Boolean(sourceChain && eligibleChains.has(sourceChain)),
      };
    }),
  );
  const eligibleConfirmedAtomic = balanceBreakdown.reduce(
    (total, balance) => balance.eligible ? total + decimalToAtomic(balance.confirmedBalance) : total,
    0n,
  );
  const totalFeeAtomic = fees.reduce(
    (total, fee) => fee.token.toUpperCase() === "USDC" ? total + decimalToAtomic(fee.amount) : total,
    0n,
  );
  const amountAtomic = circleKitUsdcToAtomic(input.amount);
  const maximumTotalFeeAtomic = maximumFeeAtomic(totalFeeAtomic);
  const quoteSubject = createHash("sha256").update(input.userId).digest("hex");
  const fundingFingerprint = createHash("sha256").update(JSON.stringify(
    balanceBreakdown
      .filter((balance) => balance.eligible && decimalToAtomic(balance.confirmedBalance) > 0n)
      .map((balance) => ({
        chain: balance.chain,
        confirmedAtomic: decimalToAtomic(balance.confirmedBalance).toString(),
      }))
      .sort((left, right) => left.chain.localeCompare(right.chain)),
  )).digest("hex");
  const base = {
    engine: "circle_kit" as const,
    sourceMode: "unified" as const,
    allocationPolicy: "circle_auto" as const,
    authorizationMode: "sca_erc1271" as const,
    amount: circleKitAtomicToUsdc(amountAtomic),
    destinationChain: input.destinationChain,
    recipient: input.recipient,
    quoteSubject,
    fundingFingerprint,
    totalConfirmedBalance: balances.totalConfirmedBalance,
    totalPendingBalance: balances.totalPendingBalance ?? "0",
    eligibleConfirmedBalance: circleKitAtomicToUsdc(eligibleConfirmedAtomic),
    balanceBreakdown,
    fees,
    totalEstimatedFee: circleKitAtomicToUsdc(totalFeeAtomic),
    feeToleranceBps: CIRCLE_KIT_FEE_TOLERANCE_BPS as 500,
    maximumTotalFee: circleKitAtomicToUsdc(maximumTotalFeeAtomic),
    estimatedSourceDebit: circleKitAtomicToUsdc(amountAtomic + totalFeeAtomic),
    maximumSourceDebit: circleKitAtomicToUsdc(amountAtomic + maximumTotalFeeAtomic),
    mintGasMode,
    forwarding: mintGasMode === "auto_forwarding",
    manualMintSupported: true as const,
    supportedMintGasModes: circleKitSupportedMintGasModes(input.destinationChain),
  };
  const issuedAt = Date.now();
  return {
    ...base,
    quoteFingerprint: circleKitQuoteFingerprint(base, issuedAt),
    quoteExpiresAt: new Date(issuedAt + QUOTE_TTL_MS).toISOString(),
  };
}

export function circleKitQuoteMatches(
  providedFingerprint: unknown,
  freshEstimate: CircleKitUnifiedEstimate,
  now = Date.now(),
  signingKey = quoteSigningKey(),
) {
  if (typeof providedFingerprint !== "string") return false;
  const parsed = parseQuoteFingerprint(providedFingerprint);
  if (!parsed || parsed.issuedAt > now || now - parsed.issuedAt > QUOTE_TTL_MS) return false;
  const { quoteFingerprint: _fingerprint, quoteExpiresAt: _expiresAt, ...base } = freshEstimate;
  void _fingerprint;
  void _expiresAt;
  const expectedSignature = createHmac("sha256", signingKey)
    .update(JSON.stringify(quotePayload(base, parsed.issuedAt, parsed.totalFeeAtomic)))
    .digest();
  const providedSignature = Buffer.from(parsed.signature, "hex");
  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) return false;
  const freshFeeAtomic = decimalToAtomic(freshEstimate.totalEstimatedFee);
  return freshFeeAtomic
    <= maximumFeeAtomic(parsed.totalFeeAtomic);
}

function recoveryFrom(error: unknown) {
  if (!isKitError(error) || error.recoverability !== "RESUMABLE") return undefined;
  const cause = error.cause;
  const trace = cause && typeof cause === "object"
    ? (cause as Record<string, unknown>).trace
    : undefined;
  if (!trace || typeof trace !== "object") return undefined;
  const record = trace as Record<string, unknown>;
  return typeof record.attestation === "string" && typeof record.signature === "string"
    ? { attestation: record.attestation, signature: record.signature }
    : undefined;
}

function transferIdFromStep(step: unknown) {
  if (!step || typeof step !== "object") return undefined;
  const data = (step as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return undefined;
  const transferId = (data as Record<string, unknown>).transferId;
  return typeof transferId === "string" && transferId ? transferId : undefined;
}

function dataFromSpendStep(step: unknown): Record<string, unknown> | null {
  if (!step || typeof step !== "object") return null;
  const data = (step as Record<string, unknown>).data;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

export function circleKitSpendStepHasOnlyContractSigners(step: unknown) {
  const signatures = dataFromSpendStep(step)?.signatures;
  return Array.isArray(signatures) && signatures.length > 0 && signatures.every((value) =>
    Boolean(value && typeof value === "object" &&
      (value as Record<string, unknown>).contractSigner === true));
}

export async function spendCircleKitUnified(input: {
  scaAddress: Address;
  recipient: Address;
  destinationChain: CircleKitGatewayChain;
  amount: string;
  mintGasMode: unknown;
  onTransferSubmitted?: (transferId: string) => Promise<void>;
}): Promise<SpendResult> {
  const mintGasMode = assertCircleKitMintGasMode(input.destinationChain, input.mintGasMode);
  const adapter = createScaOnlyAdapter(input.scaAddress);
  const kit = createKit();
  let transferId: string | undefined;
  let persistTransfer = Promise.resolve();
  const eventKit = kit as unknown as {
    on(action: string, handler: (payload: { data: unknown }) => void): void;
  };
  let allocations: Array<{ chain: string; amount: string }> | undefined;
  eventKit.on("gateway.spend.step.buildBurnIntents", (payload) => {
    const stepData = dataFromSpendStep(payload.data);
    const raw = stepData?.allocations;
    if (!Array.isArray(raw)) return;
    allocations = raw.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      return typeof record.chain === "string" && typeof record.amount === "string"
        ? [{ chain: record.chain, amount: record.amount }]
        : [];
    });
  });
  eventKit.on("gateway.spend.step.signBurnIntents", (payload) => {
    const stepData = dataFromSpendStep(payload.data);
    if (!stepData) {
      throw new GatewayCircleKitError(
        "GATEWAY_SCA_AUTHORIZATION_REJECTED",
        "Circle Kit did not report SCA signing units before Gateway submission.",
        422,
      );
    }
    if (!circleKitSpendStepHasOnlyContractSigners(payload.data)) {
      throw new GatewayCircleKitError(
        "GATEWAY_SCA_AUTHORIZATION_REJECTED",
        "Circle Kit produced a non-ERC-1271 signing unit. Gateway submission was blocked.",
        422,
      );
    }
  });
  eventKit.on("gateway.spend.step.fetchAttestation", (payload) => {
    const captured = transferIdFromStep(payload.data);
    if (!captured) return;
    transferId = captured;
    if (input.onTransferSubmitted) {
      persistTransfer = input.onTransferSubmitted(captured);
    }
  });

  try {
    const result = await kit.spend(spendParams({ ...input, adapter, mintGasMode }));
    await persistTransfer;
    return result;
  } catch (error) {
    await persistTransfer.catch(() => undefined);
    throw new GatewayCircleKitSpendError({
      error,
      transferId,
      recovery: recoveryFrom(error),
      allocations,
    });
  }
}

export async function retryCircleKitUnifiedMint(input: {
  scaAddress: Address;
  recipient: Address;
  destinationChain: CircleKitGatewayChain;
  amount: string;
  attestation: string;
  signature: string;
}): Promise<SpendResult> {
  await assertCircleKitArcRecipient(input.destinationChain, input.recipient);
  const adapter = createScaOnlyAdapter(input.scaAddress);
  const kit = createKit();
  return kit.spend({
    amount: input.amount,
    token: "USDC",
    to: {
      adapter,
      address: input.scaAddress,
      recipientAddress: input.recipient,
      chain: toCircleKitChain(input.destinationChain),
      useForwarder: false,
    },
    config: {
      retry: {
        attestation: input.attestation,
        signature: input.signature,
      },
    },
  });
}
