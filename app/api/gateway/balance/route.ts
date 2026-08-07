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
import { supportedGatewayChains } from "@/lib/circle/gateway-sdk";
import { loadGatewayBalanceResponse } from "@/lib/paycmd/ai/wallet-context-server";
import { isSupportedChain, type PayCmdChain } from "@/lib/paycmd/chains";
import { createClient } from "@/lib/supabase/server";

type BalanceRequest = {
  addresses?: string[];
  chain?: PayCmdChain;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as BalanceRequest;
    const { addresses: requestAddresses, chain: requestedChain } = body;
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
    return NextResponse.json(
      await loadGatewayBalanceResponse(addresses, chainsToCheck, undefined, chainFilter),
    );
  } catch (error: any) {
    console.error("Error fetching balances:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
