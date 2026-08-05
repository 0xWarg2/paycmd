---
slug: "circle/gateway/unified-balance"
title: "Circle Gateway unified balance"
description: "Understand Gateway unified balance, Circle SCA balance, and the total balance shown by Payna."
section: "circle.gateway"
order: 21
lastUpdated: "2026-08-05"
keywords: ["Circle Gateway", "unified balance", "SCA", "depositor"]
tutorial: true
aiSummary:
  - "Circle Gateway unified balance is USDC that a depositor has placed into Gateway across domains; it excludes USDC that remains in a Circle SCA wallet."
  - "Payna total balance adds SCA on-chain balances and Gateway deposited balances for visibility, but only Gateway ready balance can fund a Gateway transfer."
---

## Two different balance concepts

**Circle Gateway unified balance** is USDC deposited into Gateway by the same depositor across source domains. USDC that remains in a Circle SCA wallet is not Gateway balance.

**Payna total balance** is a combined view of SCA on-chain balances and Gateway deposited balances. This display does not turn SCA balance into Gateway liquidity.

## Ready and pending

A deposit awaiting finality is not Gateway ready balance. Only ready balance on the explicitly selected source domain can fund the current transfer implementation.

## Transfers remain source-scoped

`/transfer 5 from base to arc` consumes ready Gateway balance on Base and requires at least `amount + fee`. Payna does not silently combine multiple source domains to cover a transfer shortfall.
