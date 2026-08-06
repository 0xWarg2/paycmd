import {
  parseGatewayAllocationGuard,
  validateGatewayAllocationGuardCurrentState,
  type GatewayAllocationGuard,
  type GatewayGuardRejectionReason,
} from "./gateway-allocation-guard.ts";

export class GatewayQuoteChangedError extends Error {
  readonly code = "GATEWAY_QUOTE_CHANGED";
  readonly reason: GatewayGuardRejectionReason;

  constructor(reason: GatewayGuardRejectionReason) {
    super("Gateway balances or fees changed. Review the refreshed allocation before signing.");
    this.name = "GatewayQuoteChangedError";
    this.reason = reason;
  }
}

type GatewayRevalidationSourceState = {
  sourceChain: string;
  balanceAtomic: bigint;
  authorized: boolean;
};

type GatewayExactIntentEstimate<TIntentValue> = {
  sourceChain: string;
  requiredMaxFeeAtomic: bigint;
  maxBlockHeight: bigint;
  value: TIntentValue;
};

type GatewayExactEstimate<TEstimateValue, TIntentValue> = {
  atomicFee: bigint;
  value: TEstimateValue;
  intents: GatewayExactIntentEstimate<TIntentValue>[];
};

export async function revalidateUnifiedGatewayTransfer<TEstimateValue, TIntentValue>(
  input: {
    guard: unknown;
    amountAtomic: bigint;
    destinationChain: string;
    recipientAddress: string;
    mintGasMode: "auto_forwarding" | "manual";
  },
  dependencies: {
    loadSourceStates: (
      sourceChains: string[],
    ) => Promise<GatewayRevalidationSourceState[]>;
    estimateExact: (input: {
      guard: GatewayAllocationGuard;
      allocations: Array<{ sourceChain: string; valueAtomic: bigint }>;
    }) => Promise<GatewayExactEstimate<TEstimateValue, TIntentValue>>;
  },
) {
  let guard: GatewayAllocationGuard;
  try {
    guard = parseGatewayAllocationGuard(input.guard);
  } catch {
    throw new GatewayQuoteChangedError("allocation_invalid");
  }

  const allocations = guard.allocations.map((allocation) => ({
    sourceChain: allocation.sourceChain,
    valueAtomic: BigInt(allocation.valueAtomic),
  }));
  const sourceChains = allocations.map((allocation) => allocation.sourceChain);
  const [sourceStates, estimate] = await Promise.all([
    dependencies.loadSourceStates(sourceChains),
    dependencies.estimateExact({ guard, allocations }),
  ]);

  if (
    estimate.intents.length !== allocations.length ||
    estimate.intents.some((intent, index) =>
      intent.sourceChain !== allocations[index]!.sourceChain)
  ) {
    throw new GatewayQuoteChangedError("allocation_invalid");
  }

  const freshRequirementByChain = new Map(estimate.intents.map((intent) => [
    intent.sourceChain,
    intent.requiredMaxFeeAtomic,
  ]));
  const validation = validateGatewayAllocationGuardCurrentState({
    guard,
    amountAtomic: input.amountAtomic,
    destinationChain: input.destinationChain,
    recipientAddress: input.recipientAddress,
    mintGasMode: input.mintGasMode,
    freshTotalFeeAtomic: estimate.atomicFee,
    sources: sourceStates.map((source) => ({
      ...source,
      freshRequiredMaxFeeAtomic: freshRequirementByChain.get(source.sourceChain) ?? 0n,
    })),
  });

  if (!validation.ok) throw new GatewayQuoteChangedError(validation.reason);

  return {
    guard,
    allocations: validation.allocations,
    sourceStates,
    estimate,
  };
}
