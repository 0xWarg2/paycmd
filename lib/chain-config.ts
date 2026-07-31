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

import { supportedChains } from "@/lib/paycmd/chains";
import { web3Chains } from "@/lib/paycmd/web3-chains";

// Derived rather than hand-listed: a second hardcoded list here is what kept the UI
// showing only three of the twelve supported chains. `web3Chains` is the client-safe
// source (same keys as GATEWAY_CHAIN_CONFIGS); gateway-sdk cannot be imported here
// because these consumers are client components and it pulls in the server-only SDK.
export type SupportedChain = (typeof supportedChains)[number];

export const CHAIN_NAMES = supportedChains.reduce(
  (acc, chain) => {
    acc[chain] = web3Chains[chain].name;
    return acc;
  },
  {} as Record<SupportedChain, string>,
);

export const NATIVE_TOKENS: Record<string, string> = supportedChains.reduce(
  (acc, chain) => {
    acc[chain] = web3Chains[chain].nativeCurrency.symbol;
    return acc;
  },
  {} as Record<string, string>,
);

export const SUPPORTED_CHAINS: Array<{ value: SupportedChain; label: string }> = supportedChains.map(
  (value) => ({ value, label: web3Chains[value].name }),
);

export interface ChainBalance {
  chain: string;
  // `null` means the balance could not be read (dead RPC, timeout), which is not the
  // same as a zero balance. Callers must render the two differently.
  balance: number | null;
  address: string;
  error?: string;
}
