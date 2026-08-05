---
slug: "commands/metamask-and-data"
title: "Bridge, swap, and history commands"
description: "Reference for bridge, swap, and history."
section: "commands"
order: 63
lastUpdated: "2026-08-05"
keywords: ["bridge", "swap", "history", "MetaMask"]
commands: ["bridge", "swap", "history"]
tutorial: true
aiSummary:
  - "MetaMask and data commands include /bridge, /swap, and /history; bridge and swap need MetaMask signatures while history only reads stored data."
---

## Choose the MetaMask rail deliberately

`/bridge` spends MetaMask USDC across CCTP testnet domains; `/swap` trades supported tokens inside Arc Testnet; `/history` only reads Payna records. Neither MetaMask command spends SCA or Gateway balance. Compare [CCTP bridge](/docs/circle/cctp-bridge), [Arc Swap](/docs/arc/overview-and-swap), and [wallet roles](/docs/getting-started/account-and-wallets) before signing.

## `/bridge`

- **Purpose:** Burn MetaMask-held native USDC through CCTP v2 on a source testnet and mint it on a different destination testnet.
- **Syntax and variants:** `/bridge <amount> USDC from <source> to <destination> [to <0x-recipient>] [on my metamask] [manual mint] [fast|standard]`. External recipient requires auto forwarding; source and destination must differ.
- **Example:** `/bridge 10 USDC from base to arc on my metamask`; natural language: “Bridge 10 MetaMask USDC from Base to my Arc address using Fast forwarding.”
- **Prerequisites:** Connected MetaMask, supported CCTP route/capability, source USDC for amount plus quoted fee, source native gas, and destination gas only for self/manual mint.
- **Preview:** Verify amount, source/destination, full recipient and self/external mode, Fast/Standard, auto/manual mint, expected receive/source debit, fee items, and who pays each gas item.
- **Confirmation boundary:** Payna confirmation precedes MetaMask. The user signs allowance when needed and source burn; manual mint later requires another MetaMask signature on destination. Forwarding uses Circle's forwarder instead.
- **Success and persisted data:** Receipt can link source burn and destination mint/forwarder explorers, transfer ID, fees/modes, and optional Arc proof. History stores `bridge`; the burn is persisted immediately as `pending_mint` and the same row is updated after mint.
- **Named errors and fixes:** **“same chain”/“unsupported route”**: choose two compatible networks. **“Insufficient USDC”/no native gas**: fund the named source account. **“burned ... awaiting mint”**: preserve burn hash and recover attestation/mint—never burn again. **MetaMask rejected/pending request**: finish the existing prompt.

## `/swap`

- **Purpose:** Exchange USDC, EURC, or cirBTC held by MetaMask through Payna's adapter on Arc Testnet only.
- **Syntax and variants:** `/swap <amount> <token-in> to <token-out>`; supported aliases normalize to USDC, EURC, or cirBTC, and assets must differ.
- **Example:** `/swap 1 USDC to EURC`; natural language: “Convert one USDC to EURC on Arc Testnet.”
- **Prerequisites:** Connected MetaMask, configured adapter, Arc input balance, nonzero Arc native gas, live pair reserves, and allowance when needed.
- **Preview:** Check input, estimated output, minimum output, fixed 1% slippage, direct or USDC-routed path, pool count, and Payna Swap rail. Confirmation is disabled on quote error.
- **Confirmation boundary:** Confirm in Payna, then MetaMask may request a separate ERC-20 approval before the adapter swap signature. Payna refreshes reserves before encoding `amountOutMin` and a ten-minute deadline.
- **Success and persisted data:** Returns approval/swap hashes, route/pairs, estimate/minimum, and `success/failed/pending`; writes a `swap` history row and attempts a separate V2 Arc proof. Explorer links target ArcScan.
- **Named errors and fixes:** **“Choose two different swap tokens”**: change output. **“No liquidity pair”/“insufficient liquidity”**: reduce amount or choose another pair. **“Could not read ... balances”**: retry preflight. With a swap hash, check ArcScan before any retry.

## `/history`

- **Purpose:** Retrieve transaction-history rows owned by the current account for reconciliation.
- **Syntax and variants:** `/history` or `/history <fund|deposit|withdraw|transfer|unify|bridge|swap>`.
- **Example:** `/history bridge`; natural language: “Show my recorded bridge transactions.”
- **Prerequisites:** Sign in. No wallet, balance, gas, or signature is required.
- **Preview:** Immediate read; there is no transaction preview. Review type filter, status, source/destination, amount, reason, date, and chain-correct explorer references.
- **Confirmation boundary:** None; history cannot sign, settle, retry, or change a transaction.
- **Success and persisted data:** Returns existing rows newest-first (up to the route limit) and creates no new history. Chat receipts may expose more hashes than the Activity table.
- **Named errors and fixes:** **“Unauthorized”**: sign in again. **“Failed to fetch transaction history”**: retry without issuing a payment. Empty results: clear the filter. A `pending` or `pending_gateway_finality` row is not final success; reconcile its hashes.

## Recovery and result links

Label every hash by chain and stage: CCTP burn, destination mint, Arc swap, approval, or Payna proof. A history-write or proof failure can follow successful movement, so its absence never authorizes a duplicate. If a source hash exists, open the correct explorer and follow the deeper guide's recovery boundary. Share public hashes and sanitized errors only—never seed phrases, private keys, session tokens, or API credentials.
