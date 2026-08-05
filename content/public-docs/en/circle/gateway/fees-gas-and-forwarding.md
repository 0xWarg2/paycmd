---
slug: "circle/gateway/fees-gas-and-forwarding"
title: "Gateway fees, gas, and forwarding"
description: "Choose auto forwarding or manual destination gas for a transfer."
section: "circle.gateway"
order: 25
lastUpdated: "2026-08-05"
keywords: ["fee", "gas", "auto forwarding", "manual mint"]
tutorial: true
aiSummary:
  - "Gateway fees debit source USDC, source-side wallet operations use native gas, and manual destination mint requires native gas from the minting wallet."
  - "Payna quotes before state changes, prefers Circle's fees.total, and treats forwarded and manual destination hashes as different result shapes."
---

## Four costs that must stay separate

A Gateway preview can involve four different cost categories:

1. **Gateway protocol fee** is charged in USDC against the source balance. Circle describes it as source burn gas plus a transfer fee based on amount.
2. **Forwarding fee** is additional source-side USDC when Circle's Forwarding Service relays the destination mint. It includes the forwarding service and destination gas component.
3. **Source native gas** pays for SCA on-chain actions such as adding a delegate, approving USDC, or auto-depositing. It is held by the transaction-sending SCA, not deducted from Gateway USDC.
4. **Destination native gas** is paid by the SCA or Gateway signer when Payna performs a manual mint. With forwarding, Circle covers destination execution and charges the forwarding fee in source USDC instead.

“Fee” in a receipt should identify which category it means. Adding a USDC fee to a source debit is different from checking a wallet's native-token balance.

## Gateway protocol fee and source debit

Circle's [Gateway fee reference](https://developers.circle.com/gateway/references/fees) explains that a burn intent's `maxFee` must cover the source gas component, the transfer fee, and any forwarding fee. Gateway collects the fee when funds are burned on the source. Consequently, Payna requires a selected source Gateway row to hold **`amount + estimated fee`**.

If a user sends 10 USDC and the current quote is 0.02 USDC, the previewed source requirement is 10.02. The recipient amount remains 10; the extra 0.02 is not part of the destination mint. A cross-domain visible total above 10.02 does not help when the explicitly selected source row is below it.

Do not copy static fee examples into an operational promise. Network costs and route conditions can change, and a forwarding route has a different composition from a manual one.

## Quote fields in current Payna

**Current Payna implementation behavior:** it sends a partial burn intent to Circle's `/v1/estimate`, omitting the placeholder `maxFee`. With auto forwarding, it adds `enableForwarder=true`. Payna prefers the decimal `fees.total` field from either the top-level response or the first response item and converts it to six-decimal USDC atomic units.

If a legacy manual quote does not contain a usable `fees.total`, Payna can fall back to the first `burnIntent.maxFee` as a positive atomic reserve. The response labels these cases `quoted_total` and `max_fee_reserve`. Zero, malformed, or absent values fail closed. Payna does not invent a zero fee.

This behavior should be distinguished from Circle's general API schema, where `maxFee` is the user's maximum authorization and the estimate endpoint may return additional burn-intent constraints. See the official [estimate API reference](https://developers.circle.com/api-reference/gateway/all/estimate-transfer).

## Preview timing and quote freshness

Payna estimates before signer creation, delegate authorization, auto-deposit, or burn signing. That ordering makes quote failure a read-only failure and prevents an unavailable preview from leaving behind wallets or balance mutations.

The preview should expose `estimatedGatewayFee`, `requiredGatewayBalance`, `feeEstimateKind`, mint mode, and forwarding state. It must not display a hard-coded fixed fee before the estimate returns. It must also avoid calling an estimate “actual.” A user who changes amount, source, destination, recipient, or mint mode needs a new quote.

At execution, Payna signs the quoted atomic fee as the burn intent's `maxFee`. When the settled response contains `fees.total`, the receipt uses that value as `actualGatewayFee` and computes `actualSourceDebit = amount + actual fee`. If settled fees are absent, the UI should keep the estimate label rather than fabricate precision.

## Source gas

The Gateway transfer request itself is signed as typed data by a Circle-managed EOA, but surrounding Payna operations can submit source-chain transactions. A first deposit can require `addDelegate`, USDC `approve`, and Gateway `deposit`. An existing depositor whose signer is not authorized may require another delegate call. Auto-deposit also requires the SCA to approve and deposit the shortfall.

Those operations require native gas on the source SCA and current Circle Wallet SDK support for that chain. An SCA can have sufficient USDC but still fail with `INSUFFICIENT_GAS`. Fund only the public address and network named by the error, then obtain a fresh preview. Do not send native gas to the depositor contract or signer unless the response identifies it as transaction sender.

## Automatic forwarding

Auto forwarding is Payna's default. The estimate and transfer requests use `enableForwarder=true`; Circle's Forwarding Service mints on the destination, so the user does not need destination native gas. Circle documents the service, fee collection, and polling model in [Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service) and its [end-to-end how-to](https://developers.circle.com/gateway/howtos/forwarding-service).

Payna waits for Circle's transfer status to become `confirmed` or `finalized`. It then expects a valid `forwardingDetails.transactionHash`, returns forwarding details and settled fee data, and uses that hash as `destinationTxHash`. It does not submit a separate manual mint, so `mintTxHash` may be absent.

If Circle reports `failed`, `expired`, times out, or omits the destination hash after settlement, Payna raises a forwarding-settlement error. It does not automatically fall back to manual mode, because the forwarded request was already submitted and might settle later.

## Manual mint

Add `manual` or `no forwarding` to choose manual mode. The quote excludes the forwarding service path, but the wallet executing `gatewayMint` must have destination native gas. Payna checks this before burning. For a transfer to the user's own address, the SCA is the minter wallet; for an external recipient, the Gateway signer is the transaction submitter. The recipient still receives the USDC.

Manual mode waits for an attestation and signature, submits the destination contract call, and returns `mintTxHash`. That hash becomes `destinationTxHash`; `forwardingDetails` can be absent. If destination gas cannot be verified, Payna stops before the burn with `DESTINATION_GAS_CHECK_UNAVAILABLE` rather than taking source balance into an unexecutable path.

Manual may reduce the USDC quote, but it is not automatically cheaper. Compare destination native gas, operational complexity, SDK support, and failure recovery as well as the displayed Gateway fee.

## Choosing a mode

Choose auto forwarding when the destination wallet lacks native gas, the route is supported by Circle forwarding, or simpler settlement is worth the quoted USDC cost. Choose manual when the designated minter already has reliable destination gas and the preview confirms a usable route.

For either mode, verify source, destination, recipient, source debit, and quote type. `/gas <chain>` can help inspect balances, but the execution preview remains authoritative about which wallet role needs gas. Same-chain routes are not automatically forced to manual; Payna honors the selected mint mode.

## Failure and retry checklist

- Quote unavailable: no stateful work should have occurred; request a fresh estimate later.
- Source balance short: include the fee, then wait for or perform a same-source deposit.
- Source gas short: fund the SCA for the named delegate/deposit operation.
- Manual destination gas short: fund the identified SCA or signer, or switch modes and re-estimate.
- Forwarded transfer submitted: preserve `transferId`; inspect Circle status before any retry.
- Manual attestation obtained: check whether a destination mint transaction or challenge already exists.
- Receipt mismatch: prefer settled `fees.total` and the mode-appropriate destination hash.
- Support request: share public identifiers only, never keys, credentials, or private RPC configuration.
