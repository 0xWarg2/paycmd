---
slug: "circle/gateway/deposit-and-finality"
title: "Deposit and Gateway finality"
description: "From an SCA deposit to Gateway ready balance, including webhook and recovery sync."
section: "circle.gateway"
order: 22
lastUpdated: "2026-08-05"
keywords: ["deposit", "finality", "pending", "webhook", "sync"]
tutorial: true
aiSummary:
  - "The /deposit command moves USDC from a Circle SCA into Gateway; it becomes usable only after Gateway finality. The webhook is primary and sync is the recovery path."
---

## `/fund` versus `/deposit`

`/fund 10 from metamask on base` moves USDC from MetaMask into the Circle SCA wallet. `/deposit 10 from base` moves SCA USDC into Gateway. Gateway cannot spend newly funded SCA USDC until it is deposited.

## Deposit states

After the deposit transaction is submitted, Payna stores `pending_gateway_finality`. A deposit pending finality is not ready balance and must not be deposited again automatically.

## Webhook and recovery

Circle's `gateway.deposit.finalized` event is the primary completion signal. Payna verifies the webhook signature, updates the transaction, and broadcasts the change through Realtime. `/api/gateway/deposit/sync` is the recovery path when delivery is delayed: it settles only after processed height passes the deposit block and the hash is absent from the pending list. The time heuristic is limited to legacy records without a deposit block.
