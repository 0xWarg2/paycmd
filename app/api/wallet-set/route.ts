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

import { NextResponse } from "next/server";
import { ensureUserCircleWallet } from "@/lib/circle/ensure-user-wallet";
import { createClient } from "@/lib/supabase/server";

async function ensureWalletForAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { wallet, created } = await ensureUserCircleWallet(supabase, user.id);

    return NextResponse.json({
      success: true,
      message: created ? "Wallet set created" : "Wallet set already exists for this user",
      walletSetId: wallet.wallet_set_id,
      wallets: [wallet],
    });
  } catch (error: any) {
    console.error("Wallet set creation failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wallet set" },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return ensureWalletForAuthenticatedUser();
}

export async function POST() {
  return ensureWalletForAuthenticatedUser();
}
