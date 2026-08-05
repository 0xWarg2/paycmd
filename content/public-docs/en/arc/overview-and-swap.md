---
slug: "arc/overview-and-swap"
title: "Arc Testnet and swaps"
description: "Swap USDC, EURC, and cirBTC on Arc with MetaMask."
section: "arc"
order: 50
lastUpdated: "2026-08-05"
keywords: ["Arc", "swap", "USDC", "EURC", "cirBTC"]
tutorial: true
aiSummary:
  - "Payna swaps on Arc Testnet use MetaMask, support USDC/EURC/cirBTC, route USDC pairs directly, and route the remaining pair through USDC."
---

## Supported assets

Payna Swap is currently an **Arc Testnet-only** MetaMask flow. It supports USDC and EURC with 6 decimals and cirBTC (Circle BTC) with 8 decimals. Those precisions control amount parsing and balance display; they do not imply equal prices. Use testnet assets only and verify that MetaMask shows Arc Testnet, chain ID `5042002`, before signing.

This flow spends tokens held by the selected MetaMask account. It does not spend a Circle SCA wallet or Circle Gateway balance, and it does not deposit, burn, mint, or transfer through Gateway. See [accounts and wallet roles](/docs/getting-started/account-and-wallets) before choosing a rail.

## Commands and supported routes

Use `/swap <amount> <token-in> to <token-out>`, for example `/swap 1 USDC to EURC`. `EURC`, `EUROC`, and “Euro Coin” normalize to EURC; `cirBTC`, “Circle BTC,” and `BTC` normalize to cirBTC. The input and output must differ, the amount must be positive, and the command parser accepts no more than six fractional digits even though cirBTC balances use eight.

Pairs containing USDC take a direct two-token path: USDC ↔ EURC or USDC ↔ cirBTC. EURC ↔ cirBTC uses two pools and routes through USDC. The preview names every token in route order, so a two-hop route is visible before confirmation. A missing pair or empty reserves stops the quote; Payna does not silently substitute another asset or route.

## Quote, slippage, and minimum output

Payna reads current pool reserves and applies constant-product AMM math with a 0.3% fee assumption per hop. The preview shows the entered amount, estimated output, route, direct or hop count, and minimum output. The fixed slippage guard is currently 1%, so `amountOutMin` is 99% of the freshly estimated output, rounded in atomic token units.

The estimate is not a promise. Reserves can change between preview and inclusion. At confirmation Payna bypasses its short quote cache and reads reserves again; that fresh minimum is encoded in the transaction. The adapter may revert instead of settling below it. Cancel if the route or minimum is unacceptable.

## Preflight, gas, and approvals

After switching MetaMask to Arc Testnet, Payna performs a server-side preflight for the connected account. It checks the input-token balance, adapter allowance, and whether the account has a nonzero Arc native-gas balance. The swap remains a testnet transaction even though Arc labels its native currency as USDC in Payna.

If allowance is below the input amount, MetaMask first requests an ERC-20 approval. That approval is a separate onchain transaction and consumes gas. Payna then requests the adapter swap signature. Read the account, token contract, spender, amount, network, and gas in each MetaMask window; the Payna confirmation card is not either wallet signature.

## Execution

Confirmation is disabled until a quote exists without an error. Once signed, the adapter calls `swapExactTokensForTokens` with the input/output tokens, amount, minimum output, your MetaMask address as recipient, and a ten-minute deadline. Payna polls an Arc receipt. An observed revert becomes `failed`; if receipt checks expire without proof either way, the result remains `pending`, not falsely failed.

The result can include approval and swap transaction hashes, route and pool addresses, estimated and minimum output, and status. Payna writes a `swap` row to transaction history with Arc as both source and destination plus the route details. It then attempts the separate [Payna onchain proof](/docs/arc/onchain-proof). Proof absence does not undo or invalidate the swap.

## Failures and safe retry

**“Choose two different swap tokens”** means the normalized assets match; select another output. **“No liquidity pair”** or **“insufficient liquidity”** means the required direct or USDC-routed pool cannot quote; reduce the amount or choose another supported pair. **“Insufficient USDC/EURC/cirBTC”** means the MetaMask input balance is below the fresh requirement; fund that exact account on Arc Testnet. **“Could not read your Arc Testnet balances”** is an RPC/preflight problem; retry the read without signing a second transaction.

For **“MetaMask request was rejected”** or a pending wallet request, open MetaMask and finish or cancel it. If an approval succeeded but the swap did not, do not repeat the approval unnecessarily; rerun the quote and check allowance. If a swap hash exists, inspect ArcScan and history before retrying because a delayed receipt or history write does not prove the swap failed.

## Arc Swap versus Circle Gateway

Arc Swap exchanges supported testnet tokens inside one MetaMask account on one chain. Circle Gateway unifies deposited USDC across supported domains and uses SCA/depositor/signer roles for `/deposit`, `/withdraw`, `/transfer`, and `/pay`. A Gateway transfer does not trade USDC for EURC or cirBTC, and a swap does not create ready Gateway balance. Use the [Gateway overview](/docs/circle/gateway/overview) when your goal is cross-chain USDC liquidity rather than an Arc token trade.
