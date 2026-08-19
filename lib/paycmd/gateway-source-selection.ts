export type GatewaySourceEstimate = {
  sourceChain: string;
  readyBalance: number;
  authorized: boolean;
  authorizationSupported: boolean;
  usable: boolean;
  exclusionReason?: string | null;
  selected: boolean;
  allocated: boolean;
};

export type GatewayAllocationEstimate = {
  sourceChain: string;
  amount: number;
  readyBalance: number;
  estimatedFee: number;
  maximumFeeReserve: number;
  maximumDebit: number;
  maxBlockHeight: string;
  priorityReason: string;
  authorized: boolean;
};

export type GatewaySourceSelectionRow = {
  sourceChain: string;
  source: GatewaySourceEstimate;
  allocation: GatewayAllocationEstimate | null;
  selectionState: "allocated" | "available" | "unavailable";
  allocationOrder: number | null;
  checked: boolean;
  disabled: boolean;
};

export function gatewaySourceSelectionRows(input: {
  sources: GatewaySourceEstimate[];
  allocations: GatewayAllocationEstimate[];
  customSourceChains: string[] | null;
}): GatewaySourceSelectionRow[] {
  const sourceByChain = new Map(input.sources.map((source) => [source.sourceChain, source]));
  const customSources = input.customSourceChains === null
    ? null
    : new Set(input.customSourceChains);
  const allocatedRows = input.allocations.flatMap((allocation, index) => {
    const source = sourceByChain.get(allocation.sourceChain);
    if (!source) return [];
    return [{
      sourceChain: source.sourceChain,
      source,
      allocation,
      selectionState: "allocated" as const,
      allocationOrder: index + 1,
      checked: customSources ? customSources.has(source.sourceChain) : true,
      disabled: !source.usable,
    }];
  });
  const allocatedChains = new Set(input.allocations.map((allocation) => allocation.sourceChain));
  const remainingRows = input.sources
    .filter((source) => !allocatedChains.has(source.sourceChain))
    .map((source): GatewaySourceSelectionRow => ({
      sourceChain: source.sourceChain,
      source,
      allocation: null,
      selectionState: source.usable ? "available" : "unavailable",
      allocationOrder: null,
      checked: customSources?.has(source.sourceChain) ?? false,
      disabled: !source.usable,
    }))
    .sort((left, right) => {
      if (left.source.usable !== right.source.usable) return left.source.usable ? -1 : 1;
      if (left.source.usable && left.source.readyBalance !== right.source.readyBalance) {
        return right.source.readyBalance - left.source.readyBalance;
      }
      return left.sourceChain.localeCompare(right.sourceChain);
    });

  return [...allocatedRows, ...remainingRows];
}

export function recommendedGatewaySourceChains(
  allocations: GatewayAllocationEstimate[],
): string[] {
  const seen = new Set<string>();
  return allocations.flatMap((allocation) => {
    if (seen.has(allocation.sourceChain)) return [];
    seen.add(allocation.sourceChain);
    return [allocation.sourceChain];
  });
}

export function toggleGatewayCustomSource(input: {
  currentSourceChains: string[];
  sourceChain: string;
}): string[] {
  if (!input.currentSourceChains.includes(input.sourceChain)) {
    return [...input.currentSourceChains, input.sourceChain];
  }
  if (input.currentSourceChains.length === 1) return [...input.currentSourceChains];
  return input.currentSourceChains.filter((chain) => chain !== input.sourceChain);
}

export function gatewaySelectedSourceRequest(
  customSourceChains: string[] | null,
): { selectedSourceChains?: string[] } {
  if (!customSourceChains?.length) return {};
  return { selectedSourceChains: [...customSourceChains] };
}
