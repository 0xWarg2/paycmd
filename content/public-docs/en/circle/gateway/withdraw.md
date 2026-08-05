---
slug: "circle/gateway/withdraw"
title: "Withdraw from Gateway"
description: "Move Gateway balance back to the Circle SCA wallet on the same domain."
section: "circle.gateway"
order: 24
lastUpdated: "2026-08-05"
keywords: ["withdraw", "Gateway", "SCA", "same domain"]
tutorial: true
aiSummary:
  - "Payna withdraw moves Gateway balance back to the Circle SCA wallet on the same domain; it is not a cross-chain transfer."
---

## Same-domain withdrawal

`/withdraw 5 from base` moves Gateway balance on Base to the Circle SCA wallet on the **same domain**. It does not bridge to another chain and is not a multi-day trustless withdrawal model.

## Before confirmation

Verify the amount, source chain, receiving SCA address, and fee in the preview. Source Gateway balance must be ready; a pending deposit cannot be withdrawn.

## After completion

The USDC returns to the SCA on-chain balance. It is no longer part of Gateway ready balance unless the user deposits it again.
