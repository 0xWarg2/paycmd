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
  - "Payna's /deposit approves USDC and calls Gateway from the SCA; the confirmed transaction remains pending until Circle finalizes and processes it."
  - "A signed webhook is the primary finality signal, while idempotent sync reconciles processed height and Circle's pending-deposit list."
---

## `/fund` versus `/deposit`

`/fund 10 from metamask on base` sends USDC from MetaMask to the user's Circle SCA on Base. The result is ordinary SCA on-chain balance. It is useful for payments or as the input to a later deposit, but **SCA wallet is not Gateway balance**.

`/deposit 10 from base` starts a different flow. Payna uses the Circle SCA to authorize the Gateway Wallet contract and calls its deposit function on Base. Only after Circle observes the finalized event and updates its ledger does that amount become Gateway ready balance.

Use `/balance` between operations. Confirm that funding appears in the SCA section before depositing, then confirm that the deposited amount eventually appears in the Gateway ready section. Do not expect `/fund` to bypass deposit finality.

## Allowance, delegate, and deposit transaction

Circle supports several protocol deposit methods: allowance followed by `deposit`, EIP-2612 permit, and ERC-3009 authorization, with variants for crediting another depositor. They are documented in the [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide#deposit).

**Current Payna implementation behavior:** `/deposit` uses the allowance path. Before funds move, it creates or finds a Gateway signer EOA for the user. The SCA first submits `addDelegate` so that EOA may sign later burn intents. It then submits `approve(GatewayWallet, amount)` to USDC and finally calls `deposit(token, amount)` from the SCA. These are Circle developer-controlled wallet contract-execution transactions, and the route waits for their confirmed or complete state.

The calling SCA is the depositor credited by Gateway. The delegated EOA signs future transfer requests but does not receive this balance. Delegate initialization or approval can consume native source gas even though neither action transfers the requested USDC into Gateway.

## Never send USDC directly to Gateway

**Warning:** do not use a standard ERC-20 `transfer` to send USDC to a Gateway Wallet contract address. Circle explicitly warns that a plain transfer is not credited to unified balance and may cause permanent loss. You must use one of the Gateway deposit contract methods. See Circle's [EVM unified-balance quickstart](https://developers.circle.com/gateway/quickstarts/unified-balance-evm#step-3-deposit-into-a-unified-crosschain-balance-circle-wallets).

Payna's `/deposit` command constructs the supported call. Do not copy a Gateway address from history and send tokens to it manually. A correct contract address does not make an incorrect call safe.

## Submitted is not ready

When Payna receives the confirmed deposit transaction hash, it records the chain, amount, hash, deposit block number when available, and status `pending_gateway_finality`. The submitted on-chain transaction may already be visible in an explorer, yet the amount must not be used by a transfer until Circle has processed it.

Circle's `/v1/deposits` endpoint identifies observed deposits still pending. Its `/v1/balances` endpoint reports liquidity available for instant transfer. The protocol waits for network-specific confirmations before changing the balance; current estimates and requirements are maintained in [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains#required-block-confirmations).

Do not repeatedly submit the same deposit because the balance has not appeared. A second valid deposit moves another amount. Keep the first transaction hash and wait or reconcile it.

## Webhook finality

The primary Payna completion path is Circle's `gateway.deposit.finalized` webhook. Circle says this event fires after tokens are deposited, the on-chain transaction is finalized, and Gateway processes the deposit. The payload includes the depositor wallet address, domain, decimal amount, and transaction hash; see [Gateway webhook events](https://developers.circle.com/gateway/references/webhook-events#gatewaydepositfinalized).

Payna validates the notification type and deployment environment, verifies Circle's ECDSA signature using Circle's published notification key, and matches the transaction hash to a pending record. Settlement conditionally changes that record to `success`, stores the finality source and notification ID, updates waiting chat/execution state, and creates an availability notification. Duplicate webhook delivery cannot settle the same pending row twice because the update requires its prior pending status.

Webhook finality is different from a browser polling timer. Closing the page does not undo a submitted deposit, and reopening it does not create finality; it only refreshes the recorded state.

## Recovery sync and idempotent refresh

`/api/gateway/deposit/sync` is Payna's recovery path when webhook delivery, a browser event, or Realtime propagation is delayed. For current rows with a recorded deposit block, sync requests Circle's pending deposits and Gateway domain processing heights. It settles only when the exact hash is absent from the pending list **and** Circle's processed height has reached or passed the deposit block.

Rows created before block-number recording can use a legacy grace rule, but that timeout is not the standard finality model. Webhooks remain authoritative, and new records require positive Circle reconciliation evidence.

Refresh is idempotent. Multiple sync calls may overlap, but each settlement update is conditional, remaining pending rows are re-read, and duplicate completion snapshots are deduplicated by normalized transaction hash. It is safe to refresh or run recovery again; it is not safe to submit another deposit merely to force the display to change.

## Failure before submission

A validation, wallet lookup, signer creation, allowance, quote-independent gas, or approval failure can happen before the deposit call is submitted. Typical signals are no deposit transaction hash, an explicit user rejection, insufficient SCA USDC, missing native gas, an unsupported Wallet SDK chain, or a network/RPC error.

Confirm which step failed. An approval hash alone is not a deposit. Replenish the specific wallet named in the error, correct the amount or chain, and retry the command only after verifying that no deposit transaction exists. Amounts must be positive; the current route also applies a high safety ceiling.

## Failure after funds moved

A timeout, failed block-number lookup, database problem, closed browser, or lost response can occur after the deposit transaction was submitted or confirmed. In that case the command may look unsuccessful while on-chain USDC has already left the SCA. Do not assume “error” means “no state change.”

Search history and the chain explorer for the deposit hash. If the transaction succeeded, preserve it and use recovery sync. Compare its caller with the SCA depositor, its domain with the selected chain, Circle's pending-deposit membership, and the processed height. Escalate with those public identifiers if it remains unresolved. Never share wallet credentials.

## Diagnostic checklist

1. Verify the command: `/deposit <positive amount> from <supported source>`.
2. Confirm the Circle SCA exists, holds enough USDC, and has native gas for delegate, approval, and deposit calls.
3. Distinguish the signer EOA from the SCA depositor; query balance under the depositor.
4. Identify the last on-chain step: delegate, approval, or deposit. Only the deposit hash tracks moved USDC.
5. If a deposit hash exists, check chain success and its block number; do not resubmit.
6. While status is `pending_gateway_finality`, check Circle's pending list and wait for required confirmations.
7. Refresh or invoke recovery sync. Duplicate refreshes are safe; duplicate deposits are not.
8. When ready, verify the Gateway row on the same domain before running transfer or withdraw.
