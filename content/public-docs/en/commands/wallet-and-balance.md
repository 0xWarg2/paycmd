---
slug: "commands/wallet-and-balance"
title: "Wallet and balance commands"
description: "Reference for wallet, link, fund, and balance."
section: "commands"
order: 60
lastUpdated: "2026-08-05"
keywords: ["wallet", "link", "fund", "balance"]
commands: ["wallet", "link", "fund", "balance"]
tutorial: true
aiSummary:
  - "Wallet commands include /wallet, /link, /fund, and /balance; /fund only funds the SCA while /balance combines SCA and Gateway visibility."
---

## `/wallet`

Syntax: `/wallet create`, `/wallet status`, `/wallet balance [chain]`. Create is idempotent; status returns SCA and signer details; balance reads only Circle SCA on-chain balance.

## `/link`

Syntax: `/link metamask`. MetaMask must be connected and its account must match the login session. The command stores an address association and never takes custody.

## `/fund`

Syntax: `/fund <amount> from metamask on <chain>`. MetaMask needs USDC and native gas. The preview exposes source address, SCA destination, amount, and chain. The result is SCA balance, not Gateway balance.

## `/balance`

Syntax: `/balance [chain]`. Results separate SCA and Gateway and expose pending or unavailable sources. Payna total does not mean that the whole amount is ready for a Gateway transfer.
