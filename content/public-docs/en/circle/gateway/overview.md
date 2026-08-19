---
slug: "circle/gateway/overview"
title: "Circle Gateway in Payna"
description: "The Circle Gateway unified USDC model and Payna's direct SCA authorization."
section: "circle.gateway"
order: 20
lastUpdated: "2026-08-18"
keywords: ["Circle Gateway", "SCA", "ERC-1271", "unified balance"]
tutorial: true
aiSummary:
  - "Payna uses the Circle SCA as both Gateway depositor and ERC-1271 signer; it does not create or use a delegate EOA."
  - "Every new unified operation runs through Circle Unified Balance Kit and is bound to a short-lived signed quote."
---

Circle Gateway is Circle's non-custodial USDC liquidity system. A finalized deposit becomes available to spend across supported Gateway domains. Wallet USDC that has not been deposited is not part of the Gateway balance.

## Direct SCA authorization

Payna uses one Circle smart contract account (SCA) for each user. The SCA owns the deposited balance and signs Gateway Burn Intents directly through ERC-1271. Unified Balance Kit sends `contractSigner: true`; there is no delegated EOA, delegate authorization step, or EOA fallback.

The SCA also submits approval/deposit transactions and, for Manual mint, the destination mint transaction. Those on-chain actions may require native gas unless Circle Gas Station sponsors the applicable SCA transaction.

## Balance states

Payna keeps these values separate:

- **Confirmed:** finalized Gateway balance available for allocation.
- **Pending:** deposits observed but not yet finalized.
- **Funds in motion:** submitted transfers that have not reached their terminal settlement state.

Only confirmed balance is allocatable. A partial RPC or Gateway response is never interpreted as a zero balance.

A deposit enters **pending finality** after its source transaction is confirmed but before Circle has indexed the required confirmations. Payna records the deposit hash and waits for the signed Gateway webhook or a reconciliation read. It does not let a user spend pending value and does not repeat the deposit simply because the ready balance has not changed yet. This distinction also prevents the interface from presenting an optimistic total as spendable money.

The broader wallet screen can show ordinary SCA USDC beside Gateway USDC, but the values stay separate. Moving ordinary USDC into Gateway requires an explicit `/deposit` confirmation. Likewise, withdrawing converts confirmed Gateway value back into ordinary SCA USDC by a same-domain Burn Intent and mint. Neither direction is a bookkeeping-only change.

## Source and destination model

A scoped command names one source domain. Payna checks that source's confirmed balance and the quote's maximum debit before it enables confirmation. A unified command asks Circle Kit to allocate across eligible source domains automatically. The allocation is returned by the estimate and shown to the user; the browser cannot replace it with an unsigned custom source list during execution.

Gateway destinations and funding sources have different capabilities. A chain can be visible for balance reads without being approved as an SCA spend source. Payna therefore intersects Circle Gateway support, Circle Wallet SDK support, and its own allowlist. Unsupported or ambiguous configurations fail closed instead of silently switching signers, engines, or networks.

Mint mode is also destination-specific. `auto_forwarding` is offered only when Unified Balance Kit reports destination forwarding support. `manual` remains the recovery-compatible path and requires the destination SCA transaction to be executable. Changing destination or mint mode changes the signed fingerprint and requires a new quote.

## Transfer lifecycle

1. Preview obtains a Circle Kit allocation and fee estimate without signing or moving funds.
2. Payna signs the quote fingerprint on the server. It expires after 60 seconds; the UI confirmation lease is 50 seconds.
3. Confirmation creates a durable operation before submission and binds user, amount, recipient, destination, mint mode, and funding mode to its fingerprint.
4. The SCA signs Burn Intents directly with ERC-1271. Circle Kit supports at most 16 source intents.
5. Circle forwards the destination mint when the destination capability permits it, or Payna performs Manual mint.
6. History records actual allocation, actual fee, transfer ID, transaction hash, and settlement state. Signatures, attestations, and recovery payloads remain server-only.

If forwarding fails after source submission, Payna never repeats the spend. It stores a resumable state and permits only the destination Manual mint continuation.

## Arc Testnet

Arc Testnet is chain ID `5042002`, with RPC `https://rpc.testnet.arc.io` and explorer `https://testnet.arcscan.app`. Its native USDC gas unit has 18 decimals; ERC-20/display USDC uses 6 decimals. Payna verifies the chain ID and checks `USDC.isBlacklisted(recipient)` before signing an Arc-bound Gateway transfer. A failed check blocks the transfer.

Arc forwarding is capability-driven, not hard-coded off. Manual mint uses Circle Gas Station when sponsorship policy is available; otherwise Payna reports the exact native-gas requirement.

## Retry safety

The client supplies a UUID operation ID. Reusing it with the same fingerprint returns the existing result; reusing it with different inputs returns `GATEWAY_OPERATION_ID_CONFLICT`. Legacy quotes return `GATEWAY_QUOTE_ENGINE_MISMATCH` and must be estimated again.

After a transfer ID or source transaction exists, an ambiguous error is reconciled by identifier rather than blindly retried. If destination mint succeeds but receipt persistence fails, the operation enters `reconciliation_required` and cannot mint again.

The durable operation moves through explicit states such as created, submitted, pending mint, success, failure, and reconciliation required. State transitions are stored with the authenticated user and transaction row. Raw Circle recovery material is stored in a separate RLS-protected table that browser sessions cannot select. A Manual-mint retry atomically claims that row, so two tabs cannot execute the same recovery at the same time.

Quote freshness and operation idempotency solve different problems. The quote prevents execution under stale prices, allocations, or capabilities. The UUID prevents an otherwise valid request from being submitted twice because a browser retried a network timeout. Both checks happen before signing. A five-percent fee tolerance permits bounded Circle fee movement without accepting an unrelated economic payload; a quote outside that policy must be reviewed again.

## Worked example

Suppose the SCA has 20 ordinary USDC on Base, 4 confirmed Gateway USDC on Base, 7 confirmed Gateway USDC on another supported domain, and a 3 USDC deposit still pending. The ordinary 20 and pending 3 are visible but unavailable to a Gateway transfer. A 10 USDC unified request can use only the confirmed 11, less fee reserves returned by Circle Kit.

Preview shows the proposed contributing domains, destination, recipient, estimated fee, maximum debit, supported mint modes, expiry, and fingerprint. Confirming creates the operation first, then requests direct SCA signatures. If Circle accepts the source spend but forwarding later fails, Activity shows `pending_mint`; the user may continue Manual mint without burning another 10 USDC. If the original UUID is submitted again with a different recipient, Payna rejects it with a conflict rather than guessing which payment was intended.

For an Arc recipient, the same preview also performs the chain and blocklist checks. A rate-limited primary RPC may use the configured fallback with bounded retries. A wrong chain ID, unavailable blocklist read, or blacklisted address prevents signing. This makes a missing safety signal a blocking condition, not permission to continue.

## Official references

- [Circle Gateway](https://developers.circle.com/gateway)
- [Gateway ERC-1271](https://developers.circle.com/gateway/references/erc-1271)
- [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains)
- [Gateway fees](https://developers.circle.com/gateway/references/fees)
