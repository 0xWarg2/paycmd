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
  - "Payna's /withdraw burns ready Gateway balance and mints it to the user's own SCA on the same domain, requiring amount plus fee and SCA mint gas."
  - "This application path is distinct from Gateway's protocol-level delayed trustless withdrawal mechanism."
---

## What Payna withdraw does

`/withdraw 5 from base` returns USDC from the SCA depositor's ready Gateway balance on Base to that same user's Circle SCA on Base. The source and destination domain are identical, and the recipient is fixed to the user's SCA address. It is not a bridge to another chain and does not accept an external recipient.

**Current Payna implementation behavior:** withdraw uses Gateway's transfer API with a same-domain burn intent, waits for an attestation, and submits `gatewayMint` through the Circle SCA. After success, the amount is ordinary SCA on-chain USDC and no longer part of ready Gateway balance.

Circle also documents an on-chain trustless withdrawal mechanism with an initiation transaction and a delay for periods when its APIs are unavailable. That is a distinct protocol capability in the [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide#withdrawal). Payna's `/withdraw` command described here is the application-managed same-domain transfer path, not the delayed trustless path.

## Command and amount validation

The command syntax is `/withdraw <amount> from <source>`, for example `/withdraw 5.25 from base`. The amount must be positive USDC with no more than six decimal places. Payna rejects missing fields, unsupported chain aliases, zero or negative values, malformed decimals, and values above its safety ceiling before execution.

The command does not withdraw “all” implicitly and does not infer a source from the largest visible total. Name the domain whose Gateway row owns the ready liquidity. Because current Payna selection is source-scoped, a shortfall on Base is not covered by Gateway balance on Arc.

## Prerequisites

Before confirmed withdrawal execution can complete:

- the user must have a Circle SCA wallet and address;
- the selected chain must be both listed in Payna's Gateway configuration and operable through the current Circle Wallet SDK;
- the SCA depositor must have finalized Gateway ready balance on that domain;
- the associated Gateway signer must exist and be authorized, or the SCA must have gas to authorize it;
- the SCA must have native gas on the same domain to execute the destination mint;
- Circle's estimate and transfer APIs must be available.

A pending deposit is not ready. `/withdraw` does not auto-deposit or use SCA USDC to cover a Gateway shortfall because that would send funds in the opposite direction.

These are execution prerequisites, not checks already proven by the command preview. The current preview does not contact the withdraw route to inspect the signer, quote, balance, authorization, or gas.

## Fee and balance validation

After the user confirms, Payna resolves the Circle SCA and finds or creates the Gateway signer. It then constructs a same-domain burn-intent preview for Circle's estimate, computes `requiredGatewayBalance = amount + estimatedGatewayFee`, and reads the SCA depositor's Gateway balance on exactly the selected domain.

If the row is short, Payna returns `INSUFFICIENT_GATEWAY_BALANCE` with current balance, amount, fee, and total required. Reduce the amount or wait for an existing deposit to finalize. Do not compare only the amount with the balance; Gateway fees are collected from the source and must also fit.

The estimate is not the settled receipt. Circle explains that a burn intent's `maxFee` covers protocol gas and transfer fee, with forwarding fee added only when forwarding is used; see [Gateway fees](https://developers.circle.com/gateway/references/fees). Payna's withdraw path does not enable forwarding, but it still needs a usable quote.

## Preview and confirmation

**Current Payna UI boundary:** the withdrawal preview confirms the amount, selected source, and that the recipient is the user's Circle SCA on the same domain. It does not yet show a runtime fee estimate or required Gateway balance, inspect mint gas, create or look up the signer, or check delegate authorization. Those operations begin only after the user confirms and Payna calls the withdrawal route.

Check the amount and source carefully, and understand that the recipient role is the same-domain SCA—not MetaMask or the signer EOA. Confirmation authorizes Payna to begin the execution checks; it is not proof that the fee, ready balance, native gas, or signer authorization will pass. Execution returns the resolved SCA address or a specific error after those checks.

## Signer authorization and pending state

Payna finds or creates the Gateway signer before requesting the final burn. It checks `isAuthorizedForBalance(token, depositor, signer)` on the selected chain. If authorization is explicitly false, the SCA submits an `addDelegate` call with no deposit amount, and Payna returns a `GATEWAY_FINALITY_PENDING` response with the transaction hash and retry command.

The user should wait for authorization to become observable, then retry the same withdrawal. Submitting repeated delegate calls does not make finality faster and spends additional source gas. If the authorization lookup itself fails, Payna can attempt the burn and convert Circle's “signer not authorized” response into the same pending guidance.

## Burn and same-domain mint

Once prerequisites pass, the delegated EOA signs a burn intent whose source and destination domains are identical, whose source depositor and destination recipient are both the SCA, and whose `maxFee` is the estimate. Payna submits it to Circle Gateway and waits for the attestation and signature.

Payna then asks the Circle SCA to execute `gatewayMint(bytes,bytes)` on the same chain. The SCA must have native gas. This final mint transaction is why a user can have plenty of Gateway USDC yet still receive `INSUFFICIENT_GAS`. Replenish the exact SCA address and network stated in the error; USDC itself is not automatically the native gas token on every supported chain.

## Expected receipt and balance change

A successful response includes `success`, `transferId`, `mintTxHash`, `amount`, `chain`, `recipient`, and `estimatedGatewayFee`. Payna records a history row with type `withdraw`, the same source and destination chain, the amount, successful state, and mint transaction hash.

After balance refresh, the selected Gateway ready row should decrease by the amount plus the actual fee applied by Gateway, while SCA on-chain USDC should increase by the minted amount. These reads may update at different times. Use the transfer ID and mint hash as evidence if the totals temporarily disagree.

The response currently reports the pre-execution estimate rather than a separate settled-fee field. Interfaces should label it estimated and avoid promising that it is the exact final charge.

## Errors and safe retries

**Invalid amount or chain:** no stateful work should occur; correct the command.

**Quote unavailable:** after confirmation, Payna may already have created or looked up the signer, but it has not submitted the burn intent. Wait and confirm a fresh execution attempt later.

**Insufficient ready balance:** wait for the exact pending deposit or lower the amount. Do not deposit again without checking its hash.

**Missing source/mint gas:** fund native gas to the SCA address on the selected chain.

**Authorization pending:** keep the delegate transaction hash and retry only after it is confirmed and indexed.

**Error after a transfer ID or mint challenge exists:** inspect that identifier before retrying. An API timeout does not prove the burn or mint failed. Blind repetition can create another debit request.

For support, provide the public SCA address, domain, transfer ID, and transaction hashes. Never provide a private key, seed phrase, Circle API key, or private RPC URL.
