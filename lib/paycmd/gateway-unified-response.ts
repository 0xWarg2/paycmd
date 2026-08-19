import type { UnifiedGatewayQuote } from "./gateway-unified-server.ts";
import {
  gatewayFeeBreakdownToDecimal,
  gatewayManualMintSupported,
  gatewaySupportedMintGasModes,
} from "./gateway-transfer.ts";

function atomicUsdc(value: bigint) {
  return Number(value) / 1_000_000;
}

export function gatewayUnifiedEstimateResponse(
  unified: UnifiedGatewayQuote,
  amountAtomic = unified.amountAtomic,
  options: { selectedSourceChains?: readonly string[] } = {},
) {
  const selectedSources = options.selectedSourceChains
    ? new Set(options.selectedSourceChains)
    : undefined;
  return {
    engine: "legacy" as const,
    allocationPolicy: "payna_explicit" as const,
    sourceMode: "unified" as const,
    amount: atomicUsdc(amountAtomic),
    destinationChain: unified.destinationChain,
    allocations: unified.allocations.map((allocation, index) => {
      const source = unified.sourceStatuses.find((item) => item.chain === allocation.sourceChain);
      return {
        sourceChain: allocation.sourceChain,
        amount: atomicUsdc(allocation.valueAtomic),
        readyBalance: atomicUsdc(allocation.balanceAtomic),
        estimatedFee: atomicUsdc(allocation.estimatedFeeAtomic),
        maximumFeeReserve: atomicUsdc(allocation.maxFeeAtomic),
        maximumDebit: atomicUsdc(allocation.maximumDebitAtomic),
        maxBlockHeight: unified.quote.intents[index]!.maxBlockHeight.toString(),
        priorityReason: allocation.priorityReason,
        authorized: source?.authorized ?? false,
      };
    }),
    sources: unified.sourceStatuses
      .filter((source) => source.balanceAtomic > 0n)
      .map((source) => {
        const usable = source.authorized;
        return {
          sourceChain: source.chain,
          readyBalance: atomicUsdc(source.balanceAtomic),
          authorized: source.authorized,
          authorizationSupported: source.authorizationSupported,
          usable,
          exclusionReason: usable ? null : "sca_not_supported_by_current_circle_sdk",
          selected: usable && (selectedSources ? selectedSources.has(source.chain) : true),
          allocated: unified.allocations.some((allocation) => allocation.sourceChain === source.chain),
        };
      }),
    readyBalance: atomicUsdc(unified.readyBalanceAtomic),
    maximumUsableCapacity: atomicUsdc(unified.maximumUsableCapacityAtomic),
    totalEstimatedFee: atomicUsdc(unified.quote.atomicFee),
    totalFeeBuffer: atomicUsdc(unified.totalFeeBufferAtomic),
    maximumGatewayFee: atomicUsdc(unified.quote.maxFeeAtomic),
    maximumDebit: atomicUsdc(amountAtomic + unified.quote.maxFeeAtomic),
    feeEstimateKind: unified.quote.feeEstimateKind,
    feeBreakdown: gatewayFeeBreakdownToDecimal(unified.quote.feeBreakdown),
    exclusions: unified.exclusions,
    allocationGuard: unified.allocationGuard,
    fingerprint: unified.fingerprint,
    forwarding: unified.forwarding,
    mintGasMode: unified.mintGasMode,
    supportedMintGasModes: gatewaySupportedMintGasModes(unified.destinationChain),
    manualMintSupported: gatewayManualMintSupported(unified.destinationChain),
  };
}
