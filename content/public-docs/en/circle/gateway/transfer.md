---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Move USDC cross-chain from one explicitly selected source domain."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-05"
keywords: ["transfer", "burn intent", "mint", "source-scoped", "fee"]
tutorial: true
aiSummary:
  - "Payna estimates first, then requires amount plus fee on the named source domain before authorizing and signing one burn intent."
  - "Auto forwarding and manual mint produce different destination results; after submission, status must be checked before retrying."
---

## Command syntax and source selection

Use `/transfer 10 from base to arc`. The required fields are a positive USDC amount, an explicit source chain after `from`, and an explicit destination after `to`. USDC supports at most six decimal places. Payna defaults to `auto_forwarding`; add `manual`, `manual gas`, `no forwarding`, or `without forwarding` to request manual mint mode.

**Current Payna implementation behavior is source-scoped.** The `from` chain becomes the single `sourceDomain` in one burn intent. Payna does not silently aggregate ready balances from multiple domains, even though Circle Gateway's protocol can accept multiple burn intents and provide a unified cross-chain balance. `/transfer 5 from base to arc` therefore spends only the SCA depositor's ready Gateway balance on Base.

The destination may equal the source at API level, but users who want USDC returned to their own SCA should use `/withdraw`, which provides a constrained same-domain flow and clearer receipt.

## Estimate before mutation

Payna constructs a read-only burn-intent preview and calls Circle's `/v1/estimate` endpoint before creating a Gateway signer, authorizing a delegate, auto-depositing, or signing a burn intent. Fee calculation does not depend on the signer address, so the existing SCA address can be used as a placeholder during estimation. If Circle cannot return a usable quote, Payna stops with `GATEWAY_FEE_ESTIMATE_UNAVAILABLE`; it does not mutate wallet or balance state.

For auto forwarding, the request includes `enableForwarder=true`. Payna prefers Circle's decimal `fees.total` as the quoted total. For a legacy manual response without that field, it can use the returned burn intent's atomic `maxFee` as a reserve. The preview exposes `feeEstimateKind` as `quoted_total` or `max_fee_reserve` so callers do not mislabel a reserve as a settled charge. Circle documents the estimate request in the [Gateway API reference](https://developers.circle.com/api-reference/gateway/all/estimate-transfer).

## Preview and confirmation

Before confirming, review:

- `amount`, `sourceChain`, and `destinationChain`;
- the destination `recipient`, especially when it is not the user's SCA;
- `estimatedGatewayFee` and `requiredGatewayBalance`;
- `feeEstimateKind`, `mintGasMode`, and whether `forwarding` is enabled;
- any proposed auto-deposit amount and the wallet that must pay source gas;
- manual-mode destination gas requirements.

The source requirement is **`amount + estimated fee`**, not merely the displayed transfer amount. A preview is a point-in-time estimate. It is not a promise of a permanently fixed fee, and execution must not proceed with a missing or malformed quote.

Confirmation authorizes the next stateful steps. Re-check the full external address character by character or use a trusted contact. A valid EVM-shaped address can still be the wrong recipient, and a destination mint is not reversible by Payna.

## Balance, signer, and gas preflight

After a valid estimate, Payna finds or creates the source-chain Gateway signer. It reads the SCA depositor's Gateway entry for exactly the selected source domain and compares it with `amount + fee`.

With auto-deposit enabled, a shortfall may be filled from the same-chain SCA USDC. Payna first detects existing deposits in finality so it does not submit another one. If no deposit is already pending, it checks SCA USDC and source native gas, submits only the missing amount, records the hash as `pending_gateway_finality`, and usually returns a retry instruction. A transfer cannot burn the new amount until it is ready.

Manual mode performs destination gas preflight before burning. When sending to the user's own wallet, the SCA will execute the mint; for an external recipient, Payna's destination Gateway signer executes it. The relevant wallet must have native gas and the current Circle Wallet SDK must support that destination. Auto forwarding avoids user-supplied destination gas, but source-side delegate or auto-deposit transactions can still need native gas.

## Burn intent and Gateway acceptance

Payna checks whether the EOA signer is authorized for the SCA depositor's token balance. If it is not authorized, the SCA submits an `addDelegate` transaction with a zero deposit amount and Payna returns `pending_gateway_finality`; retry only after that authorization is visible. If the authorization read fails, Payna may attempt the burn and handle Circle's explicit not-authorized result.

The signer then signs EIP-712 data containing source and destination domains, source depositor, signer, recipient, token contracts, transfer amount, maximum fee, salt, and other constraints. Payna sets the quote as `maxFee`, submits the signed request to `/v1/transfer`, and receives a transfer ID plus either attestation data or forwarding state. Circle's [technical guide](https://developers.circle.com/gateway/references/technical-guide#instant-transfer) explains the burn-intent and attestation protocol.

Gateway acceptance is a state-change boundary. Once a transfer ID exists, do not treat a later network error as proof that nothing happened.

## Destination mint and forwarding result

In default `auto_forwarding` mode, Circle's Forwarding Service handles the destination mint. Payna polls `/v1/transfer/{transferId}` until status is `confirmed` or `finalized`; it treats `failed` and `expired` as terminal errors. A successful settled response must include a valid destination transaction hash under `forwardingDetails.transactionHash`. Payna returns the forwarding details, settled fees when present, and normalizes that hash as `destinationTxHash`. Circle's official [Forwarding Service how-to](https://developers.circle.com/gateway/howtos/forwarding-service) documents this poll-to-settlement flow.

In `manual` mode, Payna waits for the attestation and signature, then calls `gatewayMint` on the destination. The resulting Circle transaction provides `mintTxHash`, which also becomes the normalized `destinationTxHash`. For the user's own recipient, the SCA submits the mint; for an external recipient, the user's Gateway signer wallet submits it. This transaction submitter is not the recipient and does not take ownership of the minted USDC.

## Receipt and history fields

The successful API result can include `transferId`, `fees`, `actualGatewayFee`, `actualSourceDebit`, `estimatedGatewayFee`, `requiredGatewayBalance`, `feeEstimateKind`, `forwarding`, `mintGasMode`, `forwardingDetails`, `mintTxHash`, `destinationTxHash`, auto-deposit fields, source, destination, amount, recipient, and the source SCA address.

When Circle returns settled `fees.total`, Payna reports the actual Gateway fee and computes `actualSourceDebit = amount + actual fee`. The initial estimate remains useful for comparison but must not be presented as actual. In history, Payna records the source chain, destination chain, amount, success state, and normalized destination hash. It may also record RA proof metadata; proof failure is reported separately and does not reverse the already completed Gateway transfer.

Auto forwarding often has no Payna-submitted `mintTxHash`; the destination evidence is the forwarded hash. Manual mint has `mintTxHash` and may have no forwarding details. A UI must not require both.

## External recipient checks

Before transferring to an external address:

1. Confirm the destination chain supports the intended Payna operation, not merely Gateway listing.
2. Verify the recipient is an address for that destination and not a source-chain contract copied by mistake.
3. Decide who will execute the mint. Manual external mint uses the Gateway signer and needs destination native gas; auto forwarding does not.
4. Confirm the recipient can use USDC on that network.
5. Run a small test amount when operational risk justifies it, remembering that each attempt has its own fee.

Payna currently targets EVM chains in its generated matrix. Do not infer Solana recipient setup behavior from Circle's broader protocol documentation.

## Common failures

**Insufficient Gateway balance:** the selected source entry does not cover `amount + fee`. Wait for an existing deposit, allow a same-source auto-deposit, reduce the amount, or explicitly choose another funded source.

**Quote failure:** Circle returned an error or no usable `fees.total`/reserve. No signer creation or balance mutation should have happened. Wait and request a fresh preview.

**Source gas failure:** the SCA cannot authorize a signer or auto-deposit. Fund native gas on the source wallet named in the response.

**Destination gas failure:** manual mint cannot be safely attempted. Fund the SCA or Gateway signer specified by the preflight, or obtain a new auto-forwarding preview.

**Pending finality:** a deposit or delegate transaction has been submitted but is not usable. Preserve its hash and run the provided retry command only after readiness.

**Forwarding settlement failure:** Circle already accepted the forwarded request, but Payna did not observe a successful destination result. This is not a safe point for blind re-submission.

## Retry safety

Before a quote or before any transaction hash/transfer ID exists, correcting input and retrying is generally safe. After an auto-deposit or delegate hash exists, reconcile that transaction and wait for finality instead of repeating it. After a transfer ID exists, inspect `/v1/transfer/{id}`, `forwardingDetails.failureReason`, and any destination hash.

Payna intentionally does not auto-fallback from failed forwarding to manual mint and does not automatically retry a submitted transfer. Either could duplicate delivery if the first request later settles. Retain the original source, destination, recipient, amount, mint mode, quote, transfer ID, and hashes when escalating. Never include private keys or API secrets.
