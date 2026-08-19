---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Estimate and execute durable Gateway transfers through Circle Unified Balance Kit."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-18"
keywords: ["transfer", "ERC-1271", "unified balance", "idempotency", "forwarding"]
tutorial: true
aiSummary:
  - "All new Gateway transfers use Circle Unified Balance Kit with direct ERC-1271 SCA signatures."
  - "A signed 60-second quote and durable operation ID prevent stale execution and duplicate spending."
---

## Estimate

`/transfer 10 from gateway to arc` requests a Circle Kit unified allocation. The estimate reports confirmed, pending, and funds-in-motion balances; allocation; fee; quote fingerprint and expiry; and the mint modes actually supported by the destination.

Amounts, allocation, and fees remain decimal strings backed by atomic bigint arithmetic. Only confirmed funds are allocated, with no more than 16 intents.

The estimate separates ready money from pending deposits and funds already moving through settlement. It also returns the actual destination capability list rather than assuming every network supports forwarding. The signed quote covers the authenticated user, amount, normalized recipient, destination, mint mode, and funding mode. Any change to those fields requires a new estimate.

Preview is read-only. It does not provision another wallet, authorize a delegate, submit a deposit, sign a Burn Intent, or move USDC. The server uses a dedicated HMAC secret and does not fall back to Circle entity credentials for quote signing. A quote from the removed legacy engine is deliberately incompatible even if its visible amount and destination appear identical.

## Allocation and fee policy

Circle Kit chooses the contributing sources from confirmed SCA-owned Gateway balances. Payna verifies that every returned source belongs to its approved SCA-capable allowlist and that no plan exceeds Circle's 16-intent maximum. Pending balance cannot fill a shortfall. If confirmed capacity cannot cover the amount and bounded fees, the estimate fails without creating an operation.

Every money value crosses the API as a decimal string and is converted to atomic USDC units with bigint. This avoids binary floating-point rounding in amounts, allocation totals, and fees. The receipt converts atomic values back to display strings but preserves the exact settled value.

The 5% tolerance is a ceiling around the reviewed fee, not permission to change the recipient, amount, destination, allocation identity, or mint mode. A fresh quote outside the ceiling returns a refresh error before submission. An explicit zero actual fee is preserved as zero rather than being mistaken for missing data.

## Confirm and execute

Confirmation requires a UUID operation ID and the signed quote fingerprint. The server resolves the authenticated user and Circle SCA; the client cannot choose a Gateway engine or signer.

Payna creates the operation before submission, verifies the 60-second quote and 5% fee tolerance, then asks the SCA to sign with ERC-1271 (`contractSigner: true`). Reusing the operation ID with changed transfer inputs returns `409 GATEWAY_OPERATION_ID_CONFLICT`.

The durable row exists before the first externally visible money-moving call. Its request fingerprint and unique operation ID provide server-side idempotency. A duplicate with the same fingerprint returns the stored state or result; it does not sign and spend again. The server never trusts a user ID, SCA address, or engine value supplied by the browser.

State changes are conditional. A retry may advance an operation only from the expected prior state, which prevents two requests from both claiming the same pending action. Once source submission is known, generic “retry transfer” is no longer safe. Activity instead shows settlement or the one permitted destination continuation.

## Forwarding and Manual mint

Available modes come from Circle Kit destination capabilities. Auto forwarding asks Circle to submit the destination mint. Manual mode submits `gatewayMint` with the user's SCA and uses Circle Gas Station when sponsorship policy permits.

If forwarding fails after the source spend was submitted, Payna stores the recovery payload privately and exposes a Manual-mint continuation. That continuation never creates another Burn Intent. If mint succeeds but receipt persistence fails, retry remains locked for operator reconciliation.

The private recovery record contains only the material needed to continue the existing mint and is linked to the transaction, authenticated user, and operation ID. It has an expiry and an atomic claim timestamp. Browser clients receive a Boolean recovery state and public identifiers, never the attestation or signature itself.

When a user starts Manual mint, Payna claims that record before calling Circle Kit. A failed pre-mint call may release the claim for a later controlled attempt. Once a destination transaction hash is returned, a database failure does not release it: the operation becomes `reconciliation_required`, because another mint attempt could duplicate settlement.

## Receipt and privacy

The receipt exposes actual source allocation, actual fee, Circle transfer ID, transaction hash, and settlement state. It never exposes raw Circle Kit steps, signatures, attestations, or recovery data.

Legacy history remains readable, but every new operation is labeled `circle_kit`. A legacy or expired quote must be re-estimated and is never silently converted.

The legacy label is retained only as historical data. There is no runtime engine selector, feature flag, canary branch, or automatic rollback path. Deposit, withdrawal, and balance helpers that still use lower-level Gateway APIs remain separate from the unified transfer engine and cannot select the removed multi-source implementation.

## Arc safety

Before signing a transfer to Arc, Payna verifies chain ID `5042002` and checks the destination against native USDC `isBlacklisted`. A blocked address, unavailable check, or RPC mismatch fails closed. RPC rate limits use bounded retry and configured failover; gas is estimated dynamically.

Arc uses `https://rpc.testnet.arc.io` as the canonical testnet endpoint and `https://testnet.arcscan.app` for public transaction inspection. Native gas accounting uses 18 decimals while ERC-20/display USDC uses 6. Payna never uses a hard-coded gas price in an estimate or receipt. Mainnet registry entries remain disabled until official parameters are complete and a live chain probe matches them.

## End-to-end example

A user previews 8 USDC from unified Gateway balance to an Arc address. Circle Kit reports two confirmed sources, an allocation, a fee, and support for both forwarding and Manual mint. Payna first checks Arc chain identity and the recipient blocklist, then returns a fingerprint expiring in 60 seconds. The UI gives the user only 50 seconds to confirm so normal network latency does not cross the server expiry boundary.

On confirmation, the server creates operation `A`, recalculates its fingerprint, validates the signed quote and fee ceiling, and requests direct ERC-1271 signatures from the user's SCA domains. Circle returns one transfer ID. If forwarding settles, operation `A` stores the actual allocation, actual fee, and destination hash. Reposting `A` returns that existing receipt.

If forwarding fails after Circle accepted the spend, operation `A` enters `pending_mint` with private recovery material. The UI offers Manual mint for `A`, not a new transfer. If another tab tries the same continuation, only one request can claim it. This boundary is why a post-submit failure must never be handled by generating a new UUID and repeating the original spend.

## Common responses

- `GATEWAY_QUOTE_EXPIRED`: request and review a new estimate.
- `GATEWAY_QUOTE_ENGINE_MISMATCH`: discard the old tab's legacy quote.
- `GATEWAY_OPERATION_ID_CONFLICT`: the UUID was already bound to different inputs.
- `ARC_ADDRESS_BLOCKLISTED`: the Arc USDC contract reports the recipient blocked.
- `ARC_BLOCKLIST_CHECK_UNAVAILABLE`: Payna could not safely complete the pre-sign check.
- `GATEWAY_MINT_RECONCILIATION_REQUIRED`: mint completed; do not retry it.
