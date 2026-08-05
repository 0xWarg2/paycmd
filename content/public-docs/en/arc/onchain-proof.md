---
slug: "arc/onchain-proof"
title: "Payna onchain proof"
description: "An Arc receipt event that links commands and transactions without holding funds."
section: "arc"
order: 51
lastUpdated: "2026-08-05"
keywords: ["Arc", "proof", "receipt", "contract", "ArcScan"]
tutorial: true
aiSummary:
  - "Payna's Arc proof contract only emits a receipt linking a command, amount, and transaction hashes; it neither holds nor moves funds."
---

## What proof records

After an eligible pay, transfer, bridge, or swap, a relayer can call `recordReceipt`. The event links command type, amount, sender or recipient, and source or mint transaction hashes.

## What proof does not do

The contract does not custody USDC, bridge funds, or prove that every off-chain statement is correct. Circle contracts or MetaMask-signed transactions handle money movement.

## Verify it

Payna stores the proof transaction hash in history and links to ArcScan. If proof recording fails after funds moved, the original transaction is not reversed; the UI separates payment and proof status.
