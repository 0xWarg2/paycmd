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

## `/bridge`

Syntax: `/bridge <amount> USDC from <source> to <destination> on my metamask`. It uses CCTP v2 and needs source USDC, gas, and a signature. The preview distinguishes self and external recipients.

## `/swap`

Syntax: `/swap <amount> <token> to <token>`. Current support is Arc Testnet with USDC, EURC, and cirBTC. Verify expected and minimum output, route, and slippage before MetaMask signs.

## `/history`

Syntax: `/history`. It only reads account transaction records, including statuses and explorer hashes. History does not imply finality while a record remains pending.
