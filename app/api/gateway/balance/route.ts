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

import { NextRequest, NextResponse } from "next/server";
import { fetchGatewayBalance, getUsdcBalance, CHAIN_BY_DOMAIN, supportedGatewayChains } from "@/lib/circle/gateway-sdk";
import { isSupportedChain, type PayCmdChain } from "@/lib/paycmd/chains";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "viem";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { addresses: requestAddresses, chain: requestedChain } = await req.json().catch(() => ({}));
    if (requestedChain && (typeof requestedChain !== "string" || !isSupportedChain(requestedChain))) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }
    const chainFilter = requestedChain as PayCmdChain | undefined;
    let addresses = requestAddresses;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      const { data: wallets, error: walletError } = await supabase
        .from("wallets")
        .select("address, wallet_address")
        .eq("user_id", user.id)
        .eq("type", "sca")
        .limit(1);

      if (walletError) {
        return NextResponse.json({ error: walletError.message }, { status: 500 });
      }

      addresses = (wallets ?? [])
        .map((wallet) => wallet.address || wallet.wallet_address)
        .filter(Boolean);
    }

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "No wallet address found. Run /wallet create first." },
        { status: 404 }
      );
    }

    const chainsToCheck = chainFilter ? [chainFilter] : supportedGatewayChains;

    // Fetch balances for all addresses
    const balancePromises = addresses.map(async (address: string) => {
      try {
        // Fetch Gateway balance (available balance on Gateway contracts)
        let gatewayBalances: Array<{ domain: number; balance: number; chain: string }> = [];
        let gatewayTotal = 0;
        // Same trap as the per-chain catch below: if this call fails, gatewayTotal stays 0,
        // which is indistinguishable from "nothing deposited on Gateway" unless we say so.
        let gatewayUnavailable = false;

        try {
          const gatewayResponse = await fetchGatewayBalance(address as Address);
          console.log(`Gateway API response for ${address}:`, JSON.stringify(gatewayResponse, null, 2));

          gatewayBalances = gatewayResponse.balances.map((b) => {
            // Gateway API returns balance as decimal string (e.g., "1.000000"), not atomic units
            const balance = parseFloat(b.balance);
            const chainName = CHAIN_BY_DOMAIN[b.domain] || "unknown";

            console.log(`Gateway balance on domain ${b.domain} (${chainName}): ${balance} USDC`);

            return {
              domain: b.domain,
              balance,
              chain: chainName,
              address,
            };
          }).filter((balance) => !chainFilter || balance.chain === chainFilter);

          gatewayTotal = gatewayBalances.reduce((sum, b) => sum + b.balance, 0);
          console.log(`Total Gateway balance for ${address}: ${gatewayTotal} USDC`);
        } catch (error: any) {
          console.error(`Error fetching Gateway balance for ${address}:`, error.message);
          console.log(`Will fetch on-chain balances only`);
          gatewayUnavailable = true;
        }

        // Fetch on-chain USDC balances (wallet balances not yet deposited)
        const chainBalances = await Promise.all(
          chainsToCheck.map(async (chain) => {
            try {
              const balance = await getUsdcBalance(address as Address, chain);
              return {
                chain,
                balance: Number(balance) / 1_000_000, // Convert to USDC
                address,
              };
            } catch (error) {
              // A failed lookup must not masquerade as a zero balance. Returning `balance: 0`
              // here let a dead RPC silently understate real funds inside a 200 response, so
              // the UI had no way to tell "no USDC on this chain" from "could not check".
              const message = error instanceof Error ? error.message : String(error);
              console.error(`Error fetching on-chain balance for ${chain}:`, message);
              return {
                chain,
                balance: null as number | null,
                address,
                error: message,
              };
            }
          })
        );

        const failedChains = chainBalances.filter((cb) => cb.balance === null).map((cb) => cb.chain);

        // Only successful lookups contribute. With any failedChains this is a floor, not the total.
        const walletTotal = chainBalances.reduce((sum, cb) => sum + (cb.balance ?? 0), 0);

        return {
          address,
          gatewayBalances,
          gatewayTotal,
          chainBalances,
          walletTotal,
          totalBalance: gatewayTotal + walletTotal,
          failedChains,
          gatewayUnavailable,
        };
      } catch (error: any) {
        console.error(`Error fetching balance for ${address}:`, error);
        return {
          address,
          error: error.message,
          totalBalance: 0,
          // Nothing was read for this address, so every chain counts as unchecked.
          failedChains: [...chainsToCheck] as string[],
          gatewayUnavailable: true,
        };
      }
    });

    const balances = await Promise.all(balancePromises);

    // Calculate total unified balance from all addresses
    const totalUnified = balances.reduce((sum, b) => {
      return sum + (b.totalBalance || 0);
    }, 0);

    // Union across addresses so callers get one flag instead of re-walking every entry.
    const failedChains = [...new Set(balances.flatMap((b) => b.failedChains ?? []))];
    const gatewayUnavailable = balances.some((b) => b.gatewayUnavailable);

    return NextResponse.json({
      success: true,
      totalUnified,
      // `totalUnified` only counts chains that answered, so with any failedChains it is a
      // lower bound. Callers must render it as "at least", never as an exact total.
      partial: failedChains.length > 0 || gatewayUnavailable,
      failedChains,
      gatewayUnavailable,
      balances,
    });
  } catch (error: any) {
    console.error("Error fetching balances:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
