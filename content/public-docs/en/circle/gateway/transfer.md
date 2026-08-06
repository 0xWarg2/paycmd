---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Use a scoped source first, then explicitly deposit or allocate a BurnIntentSet across Gateway sources."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-05"
keywords: ["transfer", "burn intent set", "unified gateway", "source allocation", "fee"]
tutorial: true
aiSummary:
  - "`/transfer 5 from base to arc` remains source-scoped. If that ready balance is short, Payna offers an explicit minimum deposit or a unified BurnIntentSet; it never auto-deposits."
  - "A unified preview shows every allocation, maximum fee reserve and maximum debit, then binds confirmation to a fresh quote fingerprint."
---

## Scoped-first command model

Use `/transfer 10 from base to arc` for a strict Base source. It signs one `BurnIntent` and never spends another Gateway domain silently. Use `/transfer 10 from gateway to arc` to request unified allocation immediately. `/pay 10 to Minh on arc from gateway` uses the same transfer engine after Payna resolves the recipient.

This feature does not mean that Circle supports exactly “16 chains.” Circle's EVM `BurnIntentSet` format accepts **at most 16 intents in one transfer**. Payna currently discovers eligible sources from its supported testnet Gateway matrix; the product is deployed on Arc Testnet, but a source intent may belong to another supported Gateway testnet domain.

## What happens when the scoped source is short

The scoped preview compares the source's ready Gateway balance with `amount + maximum fee reserve`. If it is short, normal transfer confirmation is disabled and Payna shows two choices:

1. **Deposit into this source.** Payna proposes the exact minimum shortfall. The amount is editable but cannot be lower than that minimum. Confirming creates a `/deposit` action only. After Gateway finality, preview the transfer again; Payna does not send the payment automatically.
2. **Use Unified Gateway.** Payna obtains a multi-source quote and opens a source-selection table. This path uses only ready Gateway balance and never auto-deposits from an SCA.

The deposit panel identifies the source, minimum amount, SCA funding requirement, source gas requirement, and finality boundary. During **pending finality**, the deposit must be reconciled instead of duplicated.

## Unified allocation table

Each selectable row shows the source chain, ready balance, proposed amount, per-intent maximum fee reserve, maximum debit, delegate status, and priority reason. Changing a checkbox requests a fresh estimate.

Payna orders candidates using current quote data:

1. lower quoted per-source cost;
2. for a tie, larger usable capacity (`ready balance - maxFee`) so fewer intents are needed;
3. deterministic source order for a stable result.

Allocation is greedy after sorting. An intent can contribute at most `balance - maxFee`; the reserve is never treated as transferable value. Payna emits no more than 16 intents. If the set cannot cover the amount, `GATEWAY_INSUFFICIENT_UNIFIED_BALANCE` reports ready balance, maximum usable capacity, shortfall, and excluded sources. It does not create deposits.

## Estimate, fees, and fingerprint

Preview is read-only. Payna may use the existing multichain Gateway signer address, or the SCA address as a fee-only placeholder. It does not create a wallet, add a delegate, deposit, sign, or submit a transfer while estimating.

For a set, Payna sends one partial object containing `intents[]` to Circle's [`/v1/estimate`](https://developers.circle.com/api-reference/gateway/all/estimate-transfer). Circle returns a `burnIntentSet.intents[]` with a `maxBlockHeight` and `maxFee` for every intent. Payna displays:

- `fees.total` as the point-in-time estimated total fee when Circle supplies it;
- each intent's `maxFee` as its signed maximum reserve;
- the sum of `maxFee` values as the maximum fee reserve, not the expected charge;
- `amount + sum(maxFee)` as maximum debit.

Do not hard-code a fee table. Base, transfer, forwarding, and destination execution conditions can change. A preview fingerprint covers amount, destination, mint mode, source allocations, values, and maximum fees. Execution quotes again; a changed economic allocation returns `GATEWAY_QUOTE_CHANGED` and requires another review. Fresh `maxBlockHeight` constraints are used for execution without causing a false mismatch merely because blocks advanced.

## Persistent delegate consent

All intents in a set use the same multichain EOA `sourceSigner` and one common EIP-712 signature. That signer must be authorized for the SCA depositor's USDC balance on every selected source.

`addDelegate` is a persistent permission, so Payna asks separately the first time. The **Authorize selected sources** action may create the signer only after a valid quote, checks source gas, submits zero-value delegate transactions in deterministic source order, and returns `pending_gateway_finality`. It does not burn any part of the set. Preview again after authorization becomes visible.

An already-authorized source can remain usable even when the current Circle Wallet SDK cannot submit a new delegate transaction for that chain. A source that is not authorized and cannot be authorized by the current SDK is excluded with an explanation; Payna never silently counts that balance.

## EIP-712 BurnIntentSet and one transfer ID

After final confirmation, Payna creates fresh salts, signs one EIP-712 `BurnIntentSet`, and submits:

```json
[{ "burnIntentSet": { "intents": ["..."] }, "signature": "0x..." }]
```

Each intent constrains its source domain, depositor, token, value, destination, recipient, signer, `maxBlockHeight`, and `maxFee`. The common signature proves that the signer approved the entire set as one structured message; changing any signed field invalidates it.

Circle returns one `transferId`. The same attestation bytes support either manual `gatewayMint` or the Forwarding Service. Settlement and polling remain keyed by that single ID even when several source domains funded the transfer.

## Manual mint and forwarding

Mint capability is destination-side. Auto forwarding uses `enableForwarder=true`; Circle draws forwarding cost from available `maxFee` headroom in intent order and can continue into later intents. Payna polls the one transfer ID and requires a valid forwarded destination transaction hash.

Manual mode uses the returned attestation and signature in `gatewayMint` and requires destination native gas from the designated SCA or signer. If the current Circle Wallet SDK does not support manual mint on the destination, Payna offers only forwarding. A source chain's manual-mint limitation does not by itself invalidate already-authorized source balance because minting occurs at the destination.

## Receipt, history, and retry safety

A unified result includes `sourceMode: unified`, `sourceAllocations`, total estimated fee, maximum fee reserve, actual fee when Circle settles it, one transfer ID, and the mode-appropriate destination hash. History stores `chain: gateway`, `source_mode: unified`, and the allocation JSON. The Activity UI expands the contributing sources.

Before any transfer ID exists, refresh a changed quote or complete the requested deposit/delegate action. Once a transfer ID exists, inspect Circle status before retrying. A timeout after submission is not proof that no burn occurred, and Payna never falls back automatically from forwarding to manual mint.

Common responses are:

- `GATEWAY_INSUFFICIENT_SCOPED_BALANCE`: choose deposit or unified allocation.
- `GATEWAY_INSUFFICIENT_UNIFIED_BALANCE`: reduce the amount or select more usable sources; no deposit was created.
- `GATEWAY_DELEGATE_REQUIRED`: explicitly authorize the listed persistent delegates; no partial burn was submitted.
- `GATEWAY_QUOTE_CHANGED`: review the refreshed allocation and fingerprint.
- `GATEWAY_FEE_ESTIMATE_UNAVAILABLE`: Circle did not return a safe quote; preview caused no wallet or balance mutation.
- `GATEWAY_FORWARDING_FAILED`: preserve the transfer ID and reconcile settlement before retrying.
