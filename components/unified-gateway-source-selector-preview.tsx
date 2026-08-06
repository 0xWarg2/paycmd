"use client";

import { useEffect, useRef, useState } from "react";

import { UnifiedGatewaySourceSelector } from "@/components/unified-gateway-source-selector";
import {
  recommendedGatewaySourceChains,
  toggleGatewayCustomSource,
  type GatewayAllocationEstimate,
  type GatewaySourceEstimate,
} from "@/lib/paycmd/gateway-source-selection";

const sources: GatewaySourceEstimate[] = [
  { sourceChain: "arcTestnet", readyBalance: 2.887169, authorized: true, authorizationSupported: true, usable: true, selected: true, allocated: false },
  { sourceChain: "arbitrumSepolia", readyBalance: 5, authorized: true, authorizationSupported: true, usable: true, selected: true, allocated: false },
  { sourceChain: "avalancheFuji", readyBalance: 10, authorized: true, authorizationSupported: true, usable: true, selected: true, allocated: false },
  { sourceChain: "baseSepolia", readyBalance: 10.438783, authorized: true, authorizationSupported: true, usable: true, selected: true, allocated: false },
  { sourceChain: "optimismSepolia", readyBalance: 5, authorized: true, authorizationSupported: true, usable: true, selected: true, allocated: true },
  { sourceChain: "unichainSepolia", readyBalance: 5, authorized: true, authorizationSupported: true, usable: true, selected: true, allocated: true },
];

const allocations: GatewayAllocationEstimate[] = [
  {
    sourceChain: "unichainSepolia",
    amount: 4.937,
    readyBalance: 5,
    estimatedFee: 0.001653,
    maximumFeeReserve: 0.063,
    maximumDebit: 5,
    maxBlockHeight: "100",
    priorityReason: "lowest_quoted_fee",
    authorized: true,
    delegateRequired: false,
  },
  {
    sourceChain: "optimismSepolia",
    amount: 0.063,
    readyBalance: 5,
    estimatedFee: 0.001653,
    maximumFeeReserve: 0.007,
    maximumDebit: 0.07,
    maxBlockHeight: "101",
    priorityReason: "remaining_capacity",
    authorized: true,
    delegateRequired: false,
  },
];

export function UnifiedGatewaySourceSelectorPreview({ delegateRequired = false }: { delegateRequired?: boolean }) {
  const [customSourceChains, setCustomSourceChains] = useState<string[] | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [delegateMessage, setDelegateMessage] = useState("");
  const quoteTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (quoteTimer.current !== null) window.clearTimeout(quoteTimer.current);
  }, []);

  const toggleSource = (sourceChain: string) => {
    setCustomSourceChains((current) => toggleGatewayCustomSource({
      currentSourceChains: current ?? recommendedGatewaySourceChains(allocations),
      sourceChain,
    }));
    setQuoteLoading(true);
    if (quoteTimer.current !== null) window.clearTimeout(quoteTimer.current);
    quoteTimer.current = window.setTimeout(() => setQuoteLoading(false), 450);
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl">
        <UnifiedGatewaySourceSelector
          amount="5"
          destinationChain="baseSepolia"
          totalEstimatedFee="0.053882"
          totalFeeBuffer="0.016118"
          maximumGatewayFee="0.07"
          maximumDebit="5.07"
          mintGasMode="auto_forwarding"
          sources={sources}
          allocations={allocations.map((allocation, index) => (
            index === 0 && delegateRequired
              ? { ...allocation, authorized: false, delegateRequired: true }
              : allocation
          ))}
          customSourceChains={customSourceChains}
          quoteLoading={quoteLoading}
          active
          delegateLoading={false}
          delegateMessage={delegateMessage}
          onCustomize={() => setCustomSourceChains(recommendedGatewaySourceChains(allocations))}
          onToggleSource={toggleSource}
          onRestoreRecommended={() => {
            setCustomSourceChains(null);
            setQuoteLoading(false);
          }}
          onAuthorizeSources={() => setDelegateMessage("Authorization submitted. Wait for Gateway finality and preview again; no burn was sent.")}
        />
      </div>
    </main>
  );
}
