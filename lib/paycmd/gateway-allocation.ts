import { gatewayApprovedMaxFee } from "./gateway-fee-headroom.ts";

export const CIRCLE_GATEWAY_MAX_BURN_INTENTS = 16;

export type GatewayAllocationCandidate = {
  sourceChain: string;
  sourceDomain: number;
  balanceAtomic: bigint;
  estimatedFeeAtomic: bigint;
  maxFeeAtomic: bigint;
  quotedMaxFeeAtomic?: bigint;
};

export type GatewaySourceAllocation = GatewayAllocationCandidate & {
  valueAtomic: bigint;
  maximumDebitAtomic: bigint;
  priorityReason: "lowest_quoted_fee" | "largest_usable_balance" | "preferred_source" | "remaining_capacity";
};

export type GatewayAllocationExclusion = {
  sourceChain: string;
  reason:
    | "not_selected"
    | "no_usable_capacity"
    | "intent_limit"
    | "delegate_not_supported_by_current_circle_sdk"
    | "sca_not_supported_by_current_circle_sdk"
    | "authorization_check_unavailable";
};

export class GatewayUnifiedInsufficientBalanceError extends Error {
  readonly code = "GATEWAY_INSUFFICIENT_UNIFIED_BALANCE";
  readonly amountAtomic: bigint;
  readonly readyBalanceAtomic: bigint;
  readonly maximumUsableCapacityAtomic: bigint;
  readonly exclusions: GatewayAllocationExclusion[];

  constructor(
    amountAtomic: bigint,
    readyBalanceAtomic: bigint,
    maximumUsableCapacityAtomic: bigint,
    exclusions: GatewayAllocationExclusion[],
  ) {
    super("The selected unified Gateway sources cannot cover the amount and maximum fee reserves.");
    this.name = "GatewayUnifiedInsufficientBalanceError";
    this.amountAtomic = amountAtomic;
    this.readyBalanceAtomic = readyBalanceAtomic;
    this.maximumUsableCapacityAtomic = maximumUsableCapacityAtomic;
    this.exclusions = exclusions;
  }

  get shortfallAtomic() {
    return this.amountAtomic > this.maximumUsableCapacityAtomic
      ? this.amountAtomic - this.maximumUsableCapacityAtomic
      : 0n;
  }
}

export function withGatewayApprovedFeeCeilings<T extends GatewayAllocationCandidate>(
  candidates: readonly T[],
) {
  return candidates.map((candidate) => ({
    ...candidate,
    quotedMaxFeeAtomic: candidate.maxFeeAtomic,
    maxFeeAtomic: gatewayApprovedMaxFee(candidate.maxFeeAtomic),
  }));
}

function usableCapacity(candidate: GatewayAllocationCandidate) {
  return candidate.balanceAtomic > candidate.maxFeeAtomic
    ? candidate.balanceAtomic - candidate.maxFeeAtomic
    : 0n;
}

function compareCandidates(
  left: GatewayAllocationCandidate,
  right: GatewayAllocationCandidate,
  preferredSourceChain?: string,
) {
  if (left.estimatedFeeAtomic !== right.estimatedFeeAtomic) {
    return left.estimatedFeeAtomic < right.estimatedFeeAtomic ? -1 : 1;
  }

  const capacityDifference = usableCapacity(right) - usableCapacity(left);
  if (capacityDifference !== 0n) return capacityDifference > 0n ? 1 : -1;

  const leftPreferred = left.sourceChain === preferredSourceChain;
  const rightPreferred = right.sourceChain === preferredSourceChain;
  if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;

  return left.sourceChain.localeCompare(right.sourceChain);
}

export function allocateGatewaySources(input: {
  amountAtomic: bigint;
  candidates: GatewayAllocationCandidate[];
  selectedSourceChains?: string[];
  preferredSourceChain?: string;
}) {
  if (input.amountAtomic <= 0n) throw new Error("Gateway allocation amount must be positive.");

  const selected = input.selectedSourceChains
    ? new Set(input.selectedSourceChains)
    : undefined;
  const exclusions: GatewayAllocationExclusion[] = [];
  const readyBalanceAtomic = input.candidates.reduce((total, candidate) =>
    total + ((!selected || selected.has(candidate.sourceChain)) && candidate.balanceAtomic > 0n
      ? candidate.balanceAtomic
      : 0n), 0n);
  const selectedCandidates = input.candidates.filter((candidate) => {
    if (selected && !selected.has(candidate.sourceChain)) {
      exclusions.push({ sourceChain: candidate.sourceChain, reason: "not_selected" });
      return false;
    }
    if (usableCapacity(candidate) <= 0n) {
      exclusions.push({ sourceChain: candidate.sourceChain, reason: "no_usable_capacity" });
      return false;
    }
    return true;
  });

  const sorted = selectedCandidates.sort((left, right) =>
    compareCandidates(left, right, input.preferredSourceChain));
  const usable = sorted.slice(0, CIRCLE_GATEWAY_MAX_BURN_INTENTS);
  for (const candidate of sorted.slice(CIRCLE_GATEWAY_MAX_BURN_INTENTS)) {
    exclusions.push({ sourceChain: candidate.sourceChain, reason: "intent_limit" });
  }

  const maximumUsableCapacityAtomic = usable.reduce(
    (total, candidate) => total + usableCapacity(candidate),
    0n,
  );
  if (maximumUsableCapacityAtomic < input.amountAtomic) {
    throw new GatewayUnifiedInsufficientBalanceError(
      input.amountAtomic,
      readyBalanceAtomic,
      maximumUsableCapacityAtomic,
      exclusions,
    );
  }

  let remaining = input.amountAtomic;
  const allocations: GatewaySourceAllocation[] = [];
  for (const [index, candidate] of usable.entries()) {
    if (remaining === 0n) break;
    const valueAtomic = remaining < usableCapacity(candidate)
      ? remaining
      : usableCapacity(candidate);
    remaining -= valueAtomic;

    let priorityReason: GatewaySourceAllocation["priorityReason"] = "remaining_capacity";
    if (index === 0) {
      const sameFee = usable.filter((item) => item.estimatedFeeAtomic === candidate.estimatedFeeAtomic);
      if (sameFee.length === 1) priorityReason = "lowest_quoted_fee";
      else if (candidate.sourceChain === input.preferredSourceChain) priorityReason = "preferred_source";
      else priorityReason = "largest_usable_balance";
    }

    allocations.push({
      ...candidate,
      valueAtomic,
      maximumDebitAtomic: valueAtomic + candidate.maxFeeAtomic,
      priorityReason,
    });
  }

  const totalMaxFeeAtomic = allocations.reduce(
    (total, allocation) => total + allocation.maxFeeAtomic,
    0n,
  );

  return {
    allocations,
    totalEstimatedFeeAtomic: allocations.reduce(
      (total, allocation) => total + allocation.estimatedFeeAtomic,
      0n,
    ),
    totalMaxFeeAtomic,
    maximumDebitAtomic: input.amountAtomic + totalMaxFeeAtomic,
    readyBalanceAtomic,
    maximumUsableCapacityAtomic,
    exclusions,
  };
}
