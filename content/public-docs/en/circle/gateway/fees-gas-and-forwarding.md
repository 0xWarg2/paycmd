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
  - "`fees.total` is the current estimated/settled charge; per-intent `maxFee` is a signed cap, and their sum is maximum reserve rather than expected fee."
  - "Unified allocation uses confirmed balance and fee reserves; deposit remains a separate confirmation."
---

## Four costs that must stay separate

A Gateway operation can involve four different cost categories:

1. **Gateway protocol fee** is charged in USDC against the source balance. Circle describes it as source burn gas plus a transfer fee based on amount.
2. **Forwarding fee** is additional source-side USDC when Circle's Forwarding Service relays the destination mint. It includes the forwarding service and destination gas component.
3. **Source native gas** pays for explicit SCA on-chain actions such as approving USDC or depositing when Gas Station does not sponsor them. It is not deducted from Gateway USDC.
4. **Destination native gas** is paid by the SCA for an unsponsored Manual mint. With forwarding, Circle covers destination execution and charges the forwarding fee in source USDC instead.

“Fee” in a receipt should identify which category it means. Adding a USDC fee to a source debit is different from checking a wallet's native-token balance.

## Gateway protocol fee and source debit

Circle's [Gateway fee reference](https://developers.circle.com/gateway/references/fees) explains that a burn intent's `maxFee` must cover the source gas component, transfer fee, and forwarding fee headroom. Gateway collects fees from source burns. Consequently, a scoped source must hold **`amount + maxFee`**; in a BurnIntentSet, every source can contribute at most **`ready balance - its maxFee`**.

If a user sends 10 USDC and a scoped reserve is 0.02 USDC, maximum source debit is 10.02. The recipient amount remains 10. In unified mode, the same 10 may be allocated across sources, but the sum of allocated values remains 10 and each row reserves its own cap.

Do not copy static fee examples into an operational promise. Network costs and route conditions can change, and a forwarding route has a different composition from a manual one.

## Quote fields in current Payna

**Current Payna implementation behavior:** scoped mode sends one partial burn intent; unified mode sends one partial set containing `intents[]`. Both omit caller placeholders for `maxFee`. With auto forwarding, Payna adds `enableForwarder=true`. It reads `fees.total` as the current aggregate estimate and reads every returned intent's atomic `maxFee` and `maxBlockHeight` as execution constraints.

For a scoped non-forwarding quote, a positive returned `maxFee` can be labeled `max_fee_reserve` when no total exists. Forwarding requires a usable positive `fees.total`. A set requires a usable positive cap for every intent; Payna sums those caps as maximum reserve and fails closed if the quoted total exceeds it. It never invents a zero fee.

`fees.total` and `sum(maxFee)` answer different questions. The first is “what Circle currently estimates or settled”; the second is “what the signature permits Circle to debit at most.” UI should show both when they differ. Base and transfer components come from `fees.perIntent`; forwarding is an aggregate component. Hard-coded fee tables become stale and must not replace `/v1/estimate`.

This behavior should be distinguished from Circle's general API schema, where `maxFee` is the user's maximum authorization and the estimate endpoint may return additional burn-intent constraints. See the official [estimate API reference](https://developers.circle.com/api-reference/gateway/all/estimate-transfer).

## Preview timing and quote freshness

For `/transfer` and `/pay`, Payna estimates before deposit or Burn Intent signing. Preview is read-only, so quote failure leaves no wallet or balance mutation.

`/withdraw` has a different boundary. Its UI preview confirms only amount, source, and the same-domain SCA recipient model. After confirmation, the withdraw route resolves the SCA and finds or creates the signer **before** requesting the fee estimate; balance, mint gas, and authorization checks follow. A withdraw quote failure can therefore occur after signer initialization, although no burn intent has been submitted.

The scoped panel exposes ready balance, current fee, maximum reserve/debit, mint mode, and explicit deposit/unified choices when short. The unified panel exposes every allocation and reserve, `fees.total`, `sum(maxFee)`, exclusions, and a fingerprint. Changing amount, sources, destination, or mint mode requires a new quote. Execution recomputes the plan and returns `GATEWAY_QUOTE_CHANGED` on mismatch.

At execution, Payna signs the quoted atomic fee as the burn intent's `maxFee`. When the settled response contains `fees.total`, the receipt uses that value as `actualGatewayFee` and computes `actualSourceDebit = amount + actual fee`. If settled fees are absent, the UI should keep the estimate label rather than fabricate precision.

## Source gas

The Gateway transfer request is signed directly by the Circle SCA through ERC-1271. A first explicit deposit can require USDC `approve` and Gateway `deposit`. Payna shows these actions separately and does not start a shortfall deposit without user confirmation.

Those operations require native gas on the source SCA and current Circle Wallet SDK support unless Gas Station sponsors them. Payna submits no partial burn while prerequisites are unavailable. Fund only the public address and network named by the error.

## Automatic forwarding

Auto forwarding is Payna's default. The estimate and transfer requests use `enableForwarder=true`; Circle's Forwarding Service mints on the destination, so the user does not need destination native gas. Circle documents the service, fee collection, and polling model in [Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service) and its [end-to-end how-to](https://developers.circle.com/gateway/howtos/forwarding-service).

Payna waits for Circle's transfer status to become `confirmed` or `finalized`. It then expects a valid `forwardingDetails.transactionHash`, returns forwarding details and settled fee data, and uses that hash as `destinationTxHash`. It does not submit a separate manual mint, so `mintTxHash` may be absent.

For BurnIntentSet, Circle can absorb forwarding cost from available `maxFee` headroom in intent order and continue into subsequent intents. This is why per-intent caps must remain in Circle's returned order and why “put all fee on the largest source” is not a safe client assumption.

If Circle reports `failed`, `expired`, times out, or omits the destination hash after settlement, Payna raises a forwarding-settlement error. It does not automatically fall back to manual mode, because the forwarded request was already submitted and might settle later.

## Manual mint

Add `manual` or `no forwarding` to choose Manual mode. The quote excludes the forwarding service path, and the SCA executing `gatewayMint` needs destination native gas unless Gas Station sponsors it. The recipient still receives the USDC.

Manual mode waits for an attestation and signature, submits the destination contract call, and returns `mintTxHash`. That hash becomes `destinationTxHash`; `forwardingDetails` can be absent. If destination gas cannot be verified, Payna stops before the burn with `DESTINATION_GAS_CHECK_UNAVAILABLE` rather than taking source balance into an unexecutable path.

Manual may reduce the USDC quote, but it is not automatically cheaper. Compare destination native gas, operational complexity, SDK support, and failure recovery as well as the displayed Gateway fee.

## Choosing a mode

Choose auto forwarding when the destination wallet lacks native gas, the route is supported by Circle forwarding, or simpler settlement is worth the quoted USDC cost. Choose manual when the designated minter already has reliable destination gas and the preview confirms a usable route.

For either transfer mode, verify source, destination, recipient, source debit, and quote type. `/gas check <chain>` can help inspect balances, but the transfer estimate and confirmed execution response identify which wallet role needs gas. Same-chain routes are not automatically forced to manual; Payna honors the selected mint mode.

## Failure and retry checklist

- Quote unavailable: a transfer preview has not performed stateful work; a confirmed withdrawal may already have initialized its signer, but neither path has submitted a burn intent at this point.
- Scoped source short: explicitly confirm the proposed minimum deposit, or review unified allocation. Deposit never auto-sends the transfer.
- Unified capacity short: inspect ready balance, maximum usable capacity, and exclusions; Payna never auto-deposits.
- Source gas short: fund the SCA for the named approval/deposit operation.
- Manual destination gas short: fund the identified SCA or signer, or switch modes and re-estimate.
- Forwarded transfer submitted: preserve `transferId`; inspect Circle status before any retry.
- Manual attestation obtained: check whether a destination mint transaction or challenge already exists.
- Receipt mismatch: prefer settled `fees.total` and the mode-appropriate destination hash.
- Support request: share public identifiers only, never keys, credentials, or private RPC configuration.
