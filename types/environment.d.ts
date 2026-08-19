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

namespace NodeJS {
  interface ProcessEnv {
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
    SUPABASE_SERVICE_ROLE_KEY?: string

    // Circle
    CIRCLE_API_KEY: string
    CIRCLE_ENTITY_SECRET: string
    GATEWAY_QUOTE_SIGNING_SECRET?: string
    CIRCLE_GATEWAY_WEBHOOK_ENABLED?: string
    CIRCLE_GATEWAY_ENVIRONMENT?: "TEST" | "LIVE"
    CIRCLE_GATEWAY_WEBHOOK_URL?: string
    CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID?: string
    CIRCLE_GATEWAY_DOMAINS?: string
    PAYCMD_DEFAULT_LOCALE?: "vi" | "en"

    // Arc remains testnet-only until the mainnet registry is complete and verified.
    ARC_NETWORK?: "testnet" | "mainnet"
    ARC_RPC_URL?: string
    ARC_RPC_FALLBACK_URL?: string
    NEXT_PUBLIC_ARC_RPC_URL?: string
    ARC_MAINNET_CHAIN_ID?: string
    ARC_MAINNET_RPC_URL?: string
    ARC_MAINNET_EXPLORER_URL?: string
    ARC_MAINNET_USDC_ADDRESS?: string
    ARC_MAINNET_GATEWAY_WALLET_ADDRESS?: string
    ARC_MAINNET_GATEWAY_MINTER_ADDRESS?: string
    ARC_MAINNET_CCTP_DOMAIN?: string
    ARC_MAINNET_TOKEN_MESSENGER_ADDRESS?: string
    ARC_MAINNET_MESSAGE_TRANSMITTER_ADDRESS?: string
  }
}
