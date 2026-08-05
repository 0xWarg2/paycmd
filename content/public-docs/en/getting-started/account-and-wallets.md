---
slug: "getting-started/account-and-wallets"
title: "Accounts and wallet roles"
description: "Understand the Payna account, MetaMask, Circle SCA wallet, and Gateway signer."
section: "getting-started"
order: 11
lastUpdated: "2026-08-05"
keywords: ["account", "MetaMask", "SCA", "Gateway signer"]
tutorial: true
aiSummary:
  - "A Payna account can link MetaMask, a Circle SCA wallet, and a Gateway signer; each wallet has a separate role and balance."
---

## MetaMask

MetaMask is the user-controlled external wallet. It signs login, funding, CCTP bridge, and Arc swap operations. Payna only reads its address and requests signatures through the extension.

## Circle SCA wallet

The SCA wallet is the Circle wallet orchestrated by Payna for wallet and payment operations. USDC in the SCA is its on-chain balance and does not automatically become Gateway liquidity.

## Gateway signer

The Gateway signer is a multichain EOA used for delegation and burn-intent signatures in a Gateway flow. It differs from the SCA wallet and should not be treated as the default receiving address.

## Check status

Use `/wallet status` for addresses, `/wallet balance arc` for a chain-scoped SCA balance, and `/gateway info` for Gateway-related configuration.
