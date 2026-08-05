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

The swap adapter currently supports USDC (6 decimals), EURC (6 decimals), and cirBTC (8 decimals) on Arc Testnet. This is a testnet flow, not a Circle Gateway transfer.

## Route and slippage

Pairs containing USDC use a direct route. EURC ↔ cirBTC routes through USDC. The quote shows expected output, minimum output, and a default 1% slippage guard; AMM math assumes a 0.3% fee.

## Execution

Run `/swap 1 USDC to EURC`, review the quote, and sign with MetaMask. The wallet needs Arc Testnet selected, enough input token, and Arc native gas. After a transaction hash returns, Payna records history and attempts a proof receipt.
