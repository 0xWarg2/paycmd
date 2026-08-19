---
slug: "circle/gateway/withdraw"
title: "Gateway withdrawal"
description: "Return confirmed Gateway USDC to the user's Circle SCA on the same domain."
section: "circle.gateway"
order: 24
lastUpdated: "2026-08-18"
keywords: ["withdraw", "Gateway", "ERC-1271", "SCA"]
tutorial: true
aiSummary:
  - "A Payna withdrawal burns and mints on the same Gateway domain back to the user's Circle SCA."
  - "The SCA signs directly with ERC-1271; no delegate EOA is created or authorized."
---

## Same-domain withdrawal

`/withdraw 10 from base` returns confirmed Gateway USDC on Base to ordinary USDC in the user's Base Circle SCA. It is a same-domain Gateway Burn Intent followed by `gatewayMint`; it is not the seven-day trustless recovery path.

The source and destination domain are identical, and the recipient is the authenticated user's SCA. A withdrawal does not choose an external recipient and does not move funds to MetaMask. The ordinary SCA balance increases only after the destination mint settles. Until then, Activity can show funds in motion even though the source Gateway balance has already been committed.

Gateway's seven-day recovery mechanism is a separate trustless fallback for protocol recovery. Payna's normal withdrawal uses Circle's regular spend-and-mint flow and should not be described with the recovery delay. Support should identify which path produced a transaction before giving timing guidance.

## Preview boundary

Preview confirms the amount, selected domain, receiving SCA, current balance states, estimated fee, and gas responsibility. It is read-only: it does not sign, burn, mint, or initialize a second wallet. If the quote expires, the user reviews a new quote rather than letting the server execute with stale fee or block constraints.

Only confirmed Gateway balance is spendable. Pending deposits remain visible but do not satisfy `amount + fee`. A deposit transaction that is confirmed on-chain can still be in pending finality while Circle waits for the domain's required confirmations and indexes it. Payna relies on the signed deposit webhook and reconciliation reads instead of assuming one receipt means the Gateway balance is ready.

All monetary values remain decimal strings backed by atomic bigint arithmetic. Payna does not use JavaScript `Number` or `parseFloat` to decide whether the balance covers the withdrawal. This is important near six-decimal USDC boundaries, where a display-friendly rounded value must not authorize a larger atomic debit.

## Authorization and fee checks

After confirmation, Payna resolves the authenticated user's SCA, estimates the Gateway fee, and requires confirmed source balance for `amount + fee`. The SCA signs the Burn Intent directly through ERC-1271 with `contractSigner: true`. There is no delegate stage or EOA fallback.

The destination mint transaction uses the same SCA and requires dynamically estimated native gas unless Circle Gas Station sponsors it.

Direct ERC-1271 authorization means the Gateway depositor and `sourceSigner` protocol field both resolve to the SCA address. Circle verifies the contract signature because the submitted request is marked `contractSigner: true`. A historical operation may still display a legacy engine label, but it cannot cause a new withdrawal to create or use an EOA delegate.

Before the burn, Payna checks the current fee, confirmed source capacity, SCA identity, and destination execution prerequisites. The browser cannot supply another user's wallet address or choose an execution engine. Wallet provisioning endpoints require an authenticated session and return the existing SCA idempotently when it has already been created.

Gas is a chain-specific execution prerequisite, not part of the Gateway USDC balance. Payna asks the RPC for a current estimate instead of embedding a gas price in the receipt. If Circle Gas Station policy accepts the SCA Manual-mint transaction, the user can have zero native balance. If sponsorship is unavailable, the response names the SCA, chain, and native-gas need without suggesting that more USDC solves it.

## Durable state transitions

The operation is persisted before the first submit. Its UUID and fingerprint bind the authenticated user, amount, recipient SCA, domain, and mint path. Reusing the UUID with identical data returns the known state; changing the payload returns a conflict. This prevents double withdrawal when a browser repeats a request after a timeout.

Typical states are created, source submitted, pending mint, success, failed before submit, and reconciliation required. A failure before Circle accepts a source spend may be reviewed safely. A failure after a transfer ID exists is ambiguous and must be reconciled. The UI does not turn the latter into a generic retry button.

Signature, attestation, and recovery data are never stored in a user-readable history column. When a continuation is necessary, those values live in a server-only RLS-protected table with an expiry and atomic claim. The public receipt contains only the transfer ID, transaction hash, actual fee when available, amount, chain, and settlement state.

## Retry safety

Once Circle returns a transfer ID or an on-chain hash, do not repeat the withdrawal blindly. Preserve the identifiers and reconcile the current state. Signature, attestation, and recovery material stay in server-only storage and are never returned by history APIs.

If the source spend is accepted but mint does not finish, continuation must call only the existing destination mint. It must not sign a new Burn Intent. Two tabs cannot claim the same continuation because the server atomically marks the recovery record before calling Circle Kit.

If Circle returns a destination transaction hash and the database update then fails, Payna keeps the recovery claim locked and marks the operation `reconciliation_required`. An operator can verify the hash and repair history, but the user cannot mint again. This conservative behavior treats a returned destination hash as evidence that state may already have changed.

## Worked example

Assume Base shows 12.000000 confirmed Gateway USDC, 2 pending, and no other transfer in motion. The user previews `/withdraw 10 from base`. Circle estimates a bounded fee, so Payna verifies that 12 confirmed covers both 10 and that fee. The pending 2 is displayed for context but excluded from the calculation.

The user confirms within the preview lease. Payna creates the durable operation, resolves the Base SCA from the session, refreshes the quote, and asks that SCA for the ERC-1271 Burn Intent signature. Circle returns one transfer ID. Payna then submits the same-domain mint through the SCA, sponsored by Gas Station when eligible, and records the destination hash and settled fee.

If the network response disappears after Circle returned the transfer ID, the user does not create another withdrawal. Activity uses that ID to determine whether mint is pending, successful, or requires controlled continuation. A second request with the same UUID returns the existing operation; a new amount under the same UUID returns `GATEWAY_OPERATION_ID_CONFLICT`.

## Common failures

- **Insufficient confirmed balance:** wait for pending deposits or reduce the amount.
- **Insufficient native gas:** fund the named SCA on the selected chain when sponsorship is unavailable.
- **Ambiguous post-submit failure:** reconcile the existing transfer ID; do not create another burn.
- **Expired quote:** obtain a fresh estimate and confirm its new fingerprint.
- **Legacy quote:** close the old preview and estimate again through Circle Kit.
- **Receipt persistence warning:** inspect the destination hash; do not retry mint.
