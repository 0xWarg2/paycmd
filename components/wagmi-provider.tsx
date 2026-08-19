/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";
import { WagmiConfig, createConfig } from "wagmi";
import { http, type Transport } from '@wagmi/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from "react";

import { cctpBridgeViemChains } from "@/lib/paycmd/cctp-bridge";
import { rpcTransport } from "@/lib/paycmd/rpc-endpoints";
import { payCmdChainByChainId } from "@/lib/paycmd/web3-chains";

const chains = cctpBridgeViemChains;

// `http()` with no URL falls back to whatever endpoint the chain object happens to ship, and those
// go stale: viem's Base Sepolia default answered `eth_chainId` while returning
// `-32011: no backend is currently healthy` to every `eth_call`, which surfaced here as a wallet
// balance that would not load. Chains the app supports read through their endpoint list in
// lib/paycmd/rpc-endpoints.ts, which walks alternates on failure. The bridge-only chains have no
// entry there, so they keep their chain-object endpoint — named explicitly rather than left to the
// bare-`http()` default, so which host is being called is visible here.
const transports = Object.fromEntries(chains.map((chain) => {
  const payCmdChain = payCmdChainByChainId(chain.id);
  return [
    chain.id,
    payCmdChain
      ? rpcTransport(payCmdChain, { timeout: 10_000 })
      : http(chain.rpcUrls.default.http[0]),
  ];
})) as Record<(typeof chains)[number]["id"], Transport>;

const wagmiConfig = createConfig({
  chains: chains, // Add chains to wagmiConfig
  transports: transports, // Add transports to wagmiConfig
});

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
}
