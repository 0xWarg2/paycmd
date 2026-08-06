import type { Address } from "viem";

import {
  buildGatewayBurnIntentSetPreview,
  CHAIN_BY_DOMAIN,
  estimateGatewayTransferSetFee,
  fetchGatewayBalance,
  GATEWAY_CHAIN_CONFIGS,
  isGatewaySignerAuthorized,
  supportedGatewayChains,
  type BurnIntentData,
  type SupportedChain,
} from "@/lib/circle/gateway-sdk";
import {
  GatewayUnifiedInsufficientBalanceError,
  allocateGatewaySources,
  withGatewayApprovedFeeCeilings,
  type GatewayAllocationExclusion,
} from "@/lib/paycmd/gateway-allocation";
import {
  buildGatewayAllocationGuard,
  gatewayAllocationGuardFingerprint,
  type GatewayAllocationGuard,
} from "@/lib/paycmd/gateway-allocation-guard";
import {
  gatewayTransferExecutionPlan,
  type GatewayBurnIntentSetEstimate,
  type GatewayMintGasMode,
} from "@/lib/paycmd/gateway-transfer";
import {
  revalidateUnifiedGatewayTransfer as revalidateGatewayGuard,
} from "@/lib/paycmd/gateway-unified-revalidation";

function decimalUsdcToAtomic(value: unknown) {
  const normalized = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return 0n;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export type UnifiedGatewaySourceStatus = {
  chain: SupportedChain;
  balanceAtomic: bigint;
  authorized: boolean;
  authorizationSupported: boolean;
  authorizationCheckUnavailable?: boolean;
};

export type UnifiedGatewayQuote = {
  sourceMode: "unified";
  amountAtomic: bigint;
  destinationChain: SupportedChain;
  recipient: Address;
  mintGasMode: GatewayMintGasMode;
  forwarding: boolean;
  sourceStatuses: UnifiedGatewaySourceStatus[];
  exclusions: GatewayAllocationExclusion[];
  allocations: ReturnType<typeof allocateGatewaySources>["allocations"];
  quote: GatewayBurnIntentSetEstimate;
  burnIntents: BurnIntentData[];
  readyBalanceAtomic: bigint;
  maximumUsableCapacityAtomic: bigint;
  allocationGuard: GatewayAllocationGuard;
  totalFeeBufferAtomic: bigint;
  fingerprint: string;
};

async function loadUnifiedGatewaySourceStatuses(input: {
  sourceDepositor: Address;
  sourceSigner?: Address;
}) {
  const gatewayBalances = await fetchGatewayBalance(input.sourceDepositor);
  const balanceByChain = new Map<SupportedChain, bigint>();
  for (const balance of gatewayBalances.balances) {
    const chain = CHAIN_BY_DOMAIN[balance.domain];
    if (chain) balanceByChain.set(chain, decimalUsdcToAtomic(balance.balance));
  }

  return Promise.all(supportedGatewayChains.map(async (chain) => {
    const balanceAtomic = balanceByChain.get(chain) ?? 0n;
    const authorizationSupported = Boolean(GATEWAY_CHAIN_CONFIGS[chain].circleBlockchain);
    if (balanceAtomic <= 0n || !input.sourceSigner) {
      return { chain, balanceAtomic, authorized: false, authorizationSupported };
    }
    try {
      return {
        chain,
        balanceAtomic,
        authorized: await isGatewaySignerAuthorized(input.sourceDepositor, input.sourceSigner, chain),
        authorizationSupported,
      };
    } catch {
      return {
        chain,
        balanceAtomic,
        authorized: false,
        authorizationSupported,
        authorizationCheckUnavailable: true,
      };
    }
  }));
}

export async function quoteUnifiedGatewayTransfer(input: {
  amountAtomic: bigint;
  destinationChain: SupportedChain;
  recipient: Address;
  sourceDepositor: Address;
  sourceSigner?: Address;
  mintGasMode: unknown;
  selectedSourceChains?: SupportedChain[];
}): Promise<UnifiedGatewayQuote> {
  const executionPlan = gatewayTransferExecutionPlan({
    sourceChain: input.destinationChain,
    destinationChain: input.destinationChain,
    mintGasMode: input.mintGasMode,
  });
  const requested = input.selectedSourceChains
    ? new Set(input.selectedSourceChains)
    : undefined;
  const sourceStatuses = await loadUnifiedGatewaySourceStatuses(input);

  const exclusions: GatewayAllocationExclusion[] = [];
  const eligible = sourceStatuses.filter((source) => {
    if (source.balanceAtomic <= 0n || (requested && !requested.has(source.chain))) return false;
    if (!source.authorized && !source.authorizationSupported) {
      exclusions.push({
        sourceChain: source.chain,
        reason: source.authorizationCheckUnavailable
          ? "authorization_check_unavailable"
          : "delegate_not_supported_by_current_circle_sdk",
      });
      return false;
    }
    return true;
  });
  const selectedReadyBalance = sourceStatuses.reduce((total, source) =>
    total + ((!requested || requested.has(source.chain)) ? source.balanceAtomic : 0n), 0n);
  if (eligible.length === 0) {
    throw new GatewayUnifiedInsufficientBalanceError(
      input.amountAtomic,
      selectedReadyBalance,
      0n,
      exclusions,
    );
  }

  const signerForPreview = input.sourceSigner ?? input.sourceDepositor;
  const probeIntents = buildGatewayBurnIntentSetPreview({
    allocations: eligible.map((source) => ({
      sourceChain: source.chain,
      sourceDepositor: input.sourceDepositor,
      amount: source.balanceAtomic < input.amountAtomic ? source.balanceAtomic : input.amountAtomic,
    })),
    destinationChain: input.destinationChain,
    recipient: input.recipient,
    sourceSigner: signerForPreview,
  });
  const probeQuote = await estimateGatewayTransferSetFee(probeIntents, {
    enableForwarder: executionPlan.forwarding,
  });
  const probeCandidates = eligible.map((source, index) => ({
    sourceChain: source.chain,
    sourceDomain: probeQuote.intents[index]!.sourceDomain,
    balanceAtomic: source.balanceAtomic,
    estimatedFeeAtomic: probeQuote.intents[index]!.estimatedFeeAtomic || probeQuote.intents[index]!.maxFeeAtomic,
    maxFeeAtomic: probeQuote.intents[index]!.maxFeeAtomic,
  }));
  let finalPlan = allocateGatewaySources({
    amountAtomic: input.amountAtomic,
    selectedSourceChains: input.selectedSourceChains,
    candidates: withGatewayApprovedFeeCeilings(probeCandidates),
  });
  let finalIntents: BurnIntentData[] = [];
  let quote: GatewayBurnIntentSetEstimate | undefined;

  for (let iteration = 0; iteration < 16; iteration += 1) {
    finalIntents = buildGatewayBurnIntentSetPreview({
      allocations: finalPlan.allocations.map((allocation) => ({
        sourceChain: allocation.sourceChain as SupportedChain,
        sourceDepositor: input.sourceDepositor,
        amount: allocation.valueAtomic,
      })),
      destinationChain: input.destinationChain,
      recipient: input.recipient,
      sourceSigner: signerForPreview,
    });
    quote = await estimateGatewayTransferSetFee(finalIntents, {
      enableForwarder: executionPlan.forwarding,
    });
    const quotedBySource = new Map(finalPlan.allocations.map((allocation, index) => [
      allocation.sourceChain,
      quote!.intents[index]!,
    ]));
    const nextPlan = allocateGatewaySources({
      amountAtomic: input.amountAtomic,
      selectedSourceChains: input.selectedSourceChains,
      candidates: withGatewayApprovedFeeCeilings(probeCandidates.map((candidate) => {
        const quoted = quotedBySource.get(candidate.sourceChain);
        return quoted
          ? {
              ...candidate,
              sourceDomain: quoted.sourceDomain,
              estimatedFeeAtomic: quoted.estimatedFeeAtomic || candidate.estimatedFeeAtomic,
              maxFeeAtomic: quoted.maxFeeAtomic,
            }
          : candidate;
      })),
    });
    const stable = nextPlan.allocations.length === finalPlan.allocations.length &&
      nextPlan.allocations.every((allocation, index) =>
        allocation.sourceChain === finalPlan.allocations[index]!.sourceChain &&
        allocation.valueAtomic === finalPlan.allocations[index]!.valueAtomic &&
        allocation.maxFeeAtomic === finalPlan.allocations[index]!.maxFeeAtomic);
    finalPlan = nextPlan;
    if (stable) break;
    if (iteration === 15) throw new Error("Gateway BurnIntentSet quote did not converge.");
  }
  if (!quote) throw new Error("Gateway BurnIntentSet quote is unavailable.");
  for (const [index, intent] of finalIntents.entries()) {
    intent.spec.value = finalPlan.allocations[index]!.valueAtomic;
    intent.maxFee = finalPlan.allocations[index]!.maxFeeAtomic;
    intent.maxBlockHeight = quote.intents[index]!.maxBlockHeight;
  }

  const allocationGuard = buildGatewayAllocationGuard({
    amountAtomic: input.amountAtomic,
    destinationChain: input.destinationChain,
    recipientAddress: input.recipient,
    mintGasMode: executionPlan.mintGasMode,
    allocations: finalPlan.allocations.map((allocation) => ({
      sourceChain: allocation.sourceChain,
      valueAtomic: allocation.valueAtomic,
      quotedMaxFeeAtomic: allocation.quotedMaxFeeAtomic!,
      approvedMaxFeeAtomic: allocation.maxFeeAtomic,
    })),
  });
  const approvedMaximumFeeAtomic = finalPlan.totalMaxFeeAtomic;
  const approvedQuote: GatewayBurnIntentSetEstimate = {
    ...quote,
    maxFeeAtomic: approvedMaximumFeeAtomic,
    intents: quote.intents.map((intent, index) => ({
      ...intent,
      maxFeeAtomic: finalPlan.allocations[index]!.maxFeeAtomic,
    })),
  };

  return {
    sourceMode: "unified",
    amountAtomic: input.amountAtomic,
    destinationChain: input.destinationChain,
    recipient: input.recipient,
    mintGasMode: executionPlan.mintGasMode,
    forwarding: executionPlan.forwarding,
    sourceStatuses,
    exclusions: [...exclusions, ...finalPlan.exclusions],
    allocations: finalPlan.allocations,
    quote: approvedQuote,
    burnIntents: finalIntents,
    readyBalanceAtomic: selectedReadyBalance,
    maximumUsableCapacityAtomic: finalPlan.maximumUsableCapacityAtomic,
    allocationGuard,
    totalFeeBufferAtomic: approvedMaximumFeeAtomic - quote.atomicFee,
    fingerprint: gatewayAllocationGuardFingerprint(allocationGuard),
  };
}

export async function revalidateUnifiedGatewayTransfer(input: {
  guard: unknown;
  amountAtomic: bigint;
  destinationChain: SupportedChain;
  recipient: Address;
  sourceDepositor: Address;
  sourceSigner?: Address;
  mintGasMode: unknown;
}): Promise<UnifiedGatewayQuote> {
  const executionPlan = gatewayTransferExecutionPlan({
    sourceChain: input.destinationChain,
    destinationChain: input.destinationChain,
    mintGasMode: input.mintGasMode,
  });
  let sourceStatuses: UnifiedGatewaySourceStatus[] = [];

  const revalidated = await revalidateGatewayGuard({
    guard: input.guard,
    amountAtomic: input.amountAtomic,
    destinationChain: input.destinationChain,
    recipientAddress: input.recipient,
    mintGasMode: executionPlan.mintGasMode,
  }, {
    loadSourceStates: async (sourceChains) => {
      sourceStatuses = await loadUnifiedGatewaySourceStatuses({
        sourceDepositor: input.sourceDepositor,
        sourceSigner: input.sourceSigner,
      });
      const requested = new Set(sourceChains);
      return sourceStatuses
        .filter((source) => requested.has(source.chain))
        .map((source) => ({
          sourceChain: source.chain,
          balanceAtomic: source.balanceAtomic,
          authorized: source.authorized,
        }));
    },
    estimateExact: async ({ guard, allocations }) => {
      const burnIntents = buildGatewayBurnIntentSetPreview({
        allocations: allocations.map((allocation) => ({
          sourceChain: allocation.sourceChain as SupportedChain,
          sourceDepositor: input.sourceDepositor,
          amount: allocation.valueAtomic,
        })),
        destinationChain: input.destinationChain,
        recipient: input.recipient,
        sourceSigner: input.sourceSigner ?? input.sourceDepositor,
      });
      const quote = await estimateGatewayTransferSetFee(burnIntents, {
        enableForwarder: executionPlan.forwarding,
      });
      return {
        atomicFee: quote.atomicFee,
        value: { quote, burnIntents },
        intents: quote.intents.map((intent, index) => ({
          sourceChain: guard.allocations[index]!.sourceChain,
          requiredMaxFeeAtomic: intent.maxFeeAtomic,
          maxBlockHeight: intent.maxBlockHeight,
          value: intent,
        })),
      };
    },
  });

  const { quote: freshQuote, burnIntents } = revalidated.estimate.value;
  const sourceByChain = new Map(sourceStatuses.map((source) => [source.chain, source]));
  const approvedMaximumFeeAtomic = revalidated.allocations.reduce(
    (total, allocation) => total + allocation.approvedMaxFeeAtomic,
    0n,
  );
  const allocations = revalidated.allocations.map((allocation, index) => {
    const source = sourceByChain.get(allocation.sourceChain as SupportedChain)!;
    const freshIntent = freshQuote.intents[index]!;
    return {
      sourceChain: allocation.sourceChain,
      sourceDomain: freshIntent.sourceDomain,
      balanceAtomic: source.balanceAtomic,
      estimatedFeeAtomic: freshIntent.estimatedFeeAtomic || freshIntent.maxFeeAtomic,
      quotedMaxFeeAtomic: allocation.quotedMaxFeeAtomic,
      maxFeeAtomic: allocation.approvedMaxFeeAtomic,
      valueAtomic: allocation.valueAtomic,
      maximumDebitAtomic: allocation.valueAtomic + allocation.approvedMaxFeeAtomic,
      priorityReason: (index === 0 ? "lowest_quoted_fee" : "remaining_capacity") as
        "lowest_quoted_fee" | "remaining_capacity",
    };
  });

  for (const [index, burnIntent] of burnIntents.entries()) {
    burnIntent.spec.value = revalidated.allocations[index]!.valueAtomic;
    burnIntent.maxFee = revalidated.allocations[index]!.approvedMaxFeeAtomic;
    burnIntent.maxBlockHeight = revalidated.estimate.intents[index]!.maxBlockHeight;
  }

  const approvedQuote: GatewayBurnIntentSetEstimate = {
    ...freshQuote,
    maxFeeAtomic: approvedMaximumFeeAtomic,
    intents: freshQuote.intents.map((intent, index) => ({
      ...intent,
      maxFeeAtomic: revalidated.allocations[index]!.approvedMaxFeeAtomic,
      maxBlockHeight: revalidated.estimate.intents[index]!.maxBlockHeight,
    })),
  };
  const selectedReadyBalanceAtomic = allocations.reduce(
    (total, allocation) => total + allocation.balanceAtomic,
    0n,
  );
  const maximumUsableCapacityAtomic = allocations.reduce(
    (total, allocation) => total + (
      allocation.balanceAtomic > allocation.maxFeeAtomic
        ? allocation.balanceAtomic - allocation.maxFeeAtomic
        : 0n
    ),
    0n,
  );

  return {
    sourceMode: "unified",
    amountAtomic: input.amountAtomic,
    destinationChain: input.destinationChain,
    recipient: input.recipient,
    mintGasMode: executionPlan.mintGasMode,
    forwarding: executionPlan.forwarding,
    sourceStatuses,
    exclusions: [],
    allocations,
    quote: approvedQuote,
    burnIntents,
    readyBalanceAtomic: selectedReadyBalanceAtomic,
    maximumUsableCapacityAtomic,
    allocationGuard: revalidated.guard,
    totalFeeBufferAtomic: approvedMaximumFeeAtomic - freshQuote.atomicFee,
    fingerprint: gatewayAllocationGuardFingerprint(revalidated.guard),
  };
}
