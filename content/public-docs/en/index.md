---
slug: ""
title: "Hey Payna documentation"
description: "Get started with the stablecoin copilot for USDC payments, Circle Gateway, CCTP, and Arc."
section: "overview"
order: 0
lastUpdated: "2026-08-05"
keywords: ["Payna", "USDC", "Circle", "Arc"]
tutorial: true
aiSummary:
  - "Hey Payna is a chat-first stablecoin copilot for testnet USDC wallet actions, payments, cross-chain transfers, swaps, and grounded Web3 research."
---

## Payna is a stablecoin command center

Payna is a chat-first workspace for understanding and preparing testnet USDC actions. In Payna mode, a natural-language request or slash command becomes a structured action: wallet setup, funding, a payment, a bridge, a Gateway transfer, or a swap. AskPayna is the public research surface for questions about Web3, Circle, Arc, crypto, and L1/L2 concepts; it does not move funds. Signing in unlocks the authenticated workspace, where Payna can associate your wallets and show your activity. Public documentation remains readable without an account.

## Choose the correct payment rail

The same word “transfer” can mean different on-chain workflows. Start with where the USDC is held and where it needs to arrive. Payna names the rail in the preview so you can stop when the proposed route does not match that intent.

### Circle wallet and Gateway

Use the Circle SCA wallet for wallet and payment flows managed in Payna. `/fund` moves USDC from MetaMask into that SCA. Circle Gateway is a separate liquidity layer: `/deposit` moves SCA USDC into Gateway, and the deposit must reach finality before it is ready for Gateway transfer. Gateway balance is not the same as SCA balance, even when both belong to one account.

### MetaMask and CCTP

Use MetaMask when the USDC starts in your external wallet. It signs login, funding, and CCTP v2 bridge actions. For example, `/bridge 5 usdc from base to arc on my metamask` is a MetaMask CCTP flow, not a Gateway transfer. It needs the selected account, source USDC, and source-chain native gas.

### Arc swap and proof

Use the Arc swap flow when you want to exchange through the route and token pair shown by Payna. The preview identifies the input, expected output, route, and wallet that will sign. For Gateway operations, receipts can include source and destination transaction references plus proof metadata when available. A receipt is useful for verification, but it does not change the balance or finality rules of the chosen rail.

## A command always starts with intent

State the amount, source, destination, and chain whenever you know them. A command parser may normalize that request, but it should not silently choose a different wallet or rail. Use `/balance` to inspect the available SCA and Gateway views, `/wallet status` to identify addresses, and `/gateway info` when a Gateway flow is involved. If the suggested command is not what you meant, edit or cancel it before continuing.

## Preview first, confirm second

Money-moving actions are prepared as previews. Read the amount, token, chain, source address or balance, destination, fee, and any manual-gas requirement. Confirmation is a separate, explicit decision; understanding a natural-language request never authorizes execution. MetaMask signatures are requested through the extension. Payna never needs your seed phrase or private key.

## Testnet boundaries

Payna is testnet-oriented. Treat faucet USDC, network availability, estimates, supported routes, and receipts as testnet behavior rather than a production payment guarantee. Keep a small amount of the native token on the relevant source wallet for flows that require gas. If a deposit is pending, a balance is unavailable, or a signer needs authorization, check the displayed state and the troubleshooting guide rather than retrying blindly.

## Recommended learning path

Begin with Getting Started: sign in, link MetaMask, create the Circle wallet, fund it, and inspect balances. Then learn the Circle Gateway overview and deposit/finality behavior before attempting `/transfer`. Read the wallet, payment, and Gateway command references for exact syntax, followed by CCTP and Arc guides for those rails. Finish with activity, proof, safety, and troubleshooting guidance so you know how to verify a completed action and diagnose the first-session failures.
