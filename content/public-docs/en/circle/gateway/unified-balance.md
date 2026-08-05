---
slug: "circle/gateway/unified-balance"
title: "Circle Gateway unified balance"
description: "Understand Gateway unified balance, Circle SCA balance, and the total balance shown by Payna."
section: "circle.gateway"
order: 21
lastUpdated: "2026-08-05"
keywords: ["Circle Gateway", "unified balance", "SCA", "depositor"]
tutorial: true
aiSummary:
  - "Gateway ready balance includes finalized deposits recorded for a depositor and domain; SCA USDC and pending deposits are separate."
  - "Payna may display SCA and Gateway amounts together for visibility, but current transfers debit one explicitly selected Gateway source domain."
---

The phrase “unified balance” describes Circle Gateway's deposited-liquidity model. It must not be used as shorthand for every USDC amount visible in Payna. The safest way to read the balance screen is to keep the owner, location, domain, and settlement state attached to every number.

## Balance locations, not just one number

USDC shown by Payna can be in several locations:

- **SCA on-chain balance** is ordinary USDC held at the Circle smart contract account on a particular chain.
- **Gateway pending deposit** is USDC for which a deposit transaction exists but Circle has not yet credited ready balance.
- **Gateway ready balance** is the amount returned for a depositor and domain by Circle's balance API and available for an instant transfer request.
- **External-wallet balance** can be visible during funding or MetaMask operations, but it is not owned by the SCA or Gateway ledger.

Moving between locations is a transaction, not a display toggle. `/fund` moves external-wallet USDC to the SCA. `/deposit` moves SCA USDC into the Gateway lifecycle. `/withdraw` returns Gateway liquidity to the same-domain SCA. A transfer consumes ready Gateway balance and mints at its destination.

## What unified balance means

Circle describes Gateway as an off-chain ledger that tracks finalized deposited balances for each combination of chain, token, and address. Once established, that liquidity can support fast minting on a destination. The system observes finalized deposits, decrements balances when it issues transfer attestations, and coordinates source burns with destination mints. See the official [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide#balances).

The protocol can accept multiple burn intents, including sources from more than one domain, to produce an attestation set. That is the broad meaning of cross-chain unification: applications can design transfers that use deposited liquidity without forcing users to pre-position the exact destination balance. It does not merge wallet ownership, ignore tokens, or count unfinalized deposits.

Balances remain attributable. A depositor address with 4 USDC ready on domain 6 and 9 USDC ready on domain 26 has 13 USDC of ready Gateway liquidity across those entries. The API still exposes the entries so an integration can choose sources correctly.

## What Payna total balance means

Payna's balance route reads two independent systems: ERC-20 `balanceOf` for the SCA on supported chains and Circle Gateway `/v1/balances` for the depositor. It reports per-chain rows, an SCA wallet total, a Gateway total, and a combined `totalUnified` visibility value.

That combined label is a product view, not a protocol balance. **SCA wallet is not Gateway balance.** If the SCA holds 20 USDC and Gateway reports 8 USDC ready, Payna can show 28 USDC visible, but only the 8 is immediately eligible for a Gateway burn intent. The other 20 needs a successful deposit and finality first.

Payna also preserves uncertainty. If a chain RPC fails, its SCA value is `unknown`, not zero. If the Gateway request fails, Gateway is marked unavailable. The resulting combined number is partial and must be read as a lower bound. Refreshing a partial result is safe because a balance read does not move funds.

## Pending, ready, and already spent

Circle's `/v1/deposits` endpoint lists deposits that have been submitted but not processed; the documented status is pending. `/v1/balances` is the latest amount available for instant transfer. Payna therefore does not infer finality merely because the deposit transaction has a block confirmation or because a total happens to increase.

The primary Payna settlement signal is Circle's signed `gateway.deposit.finalized` webhook. The recovery sync requires two pieces of evidence for current records: Circle has processed at least the block containing the deposit, and the exact transaction hash is no longer in the pending deposit list. The database transition is conditional on the row still being `pending_gateway_finality`, so overlapping refreshes are idempotent.

After Gateway accepts a transfer request, its ledger can decrement before every local display has refreshed. Do not interpret a stale source row as reusable funds. Use the transfer ID, forwarding state, and destination transaction hash to reconcile submitted work.

## Why transfer remains source-scoped

**Current Payna implementation behavior:** the command must name one source, and Payna constructs one burn intent for that source domain. It compares that domain's ready amount with `amount + estimatedGatewayFee`. It does not sum several domains for execution even though the balance screen may sum them for visibility and the Circle protocol can represent multi-source requests.

This boundary makes a preview auditable. The user sees which chain supplies liquidity, where signer authorization may be needed, what source fee was estimated, whether an auto-deposit is proposed, and what retry command applies. A unified total is never a promise that every source choice can spend that total.

## Example with balances on two domains

Suppose one SCA address has these successfully read balances:

| Balance category | Base Sepolia | Arc Testnet | Category total |
| --- | ---: | ---: | ---: |
| SCA on-chain | 6 USDC | 14 USDC | 20 USDC |
| Gateway ready | 11 USDC | 3 USDC | 14 USDC |

The **Circle Gateway ready total is 14 USDC**. The **Payna visible total is 34 USDC**, calculated as 20 SCA plus 14 Gateway. The 20 SCA is not silently converted into deposited liquidity.

Now consider `/transfer 10 from arc to base`. If the quote is 0.03 USDC, Arc needs 10.03 ready. Arc has only 3, so the transfer cannot debit the 11 ready on Base under current Payna behavior. With auto-deposit enabled, Payna may determine that Arc's SCA has enough to deposit the 7.03 shortfall, submit it, and return a pending-finality response. The user should wait for that exact deposit to become ready, then retry. Alternatively, selecting Base as source creates a different route and requires a fresh quote.

## Depositor and signer scope

Gateway credits the depositor, while the signer authorizes spending. Payna deposits from the SCA and delegates a Circle-managed EOA. Accordingly, its main balance reads use the SCA address. Recovery code may query both SCA and historical signer addresses so older deposits remain discoverable, but that does not combine ownership between the addresses.

If a user has multiple SCA records or an older deposit made by another address, support should compare the deposit transaction caller, the webhook `walletAddress`, the domain, and the queried depositor. Do not “fix” a zero signer balance by moving funds or repeating a deposit.

## State and safety checklist

- Label every amount as SCA, Gateway pending, or Gateway ready and retain its chain/domain.
- Exclude pending deposits from spendable Gateway balance.
- Treat partial reads as lower bounds; inspect `failedChains` and `gatewayUnavailable` before drawing conclusions.
- For a transfer, check the selected source row rather than the cross-domain display total.
- Require the selected row to cover both amount and the current fee estimate.
- Keep transaction hashes and transfer IDs until history and balance views agree.
- Never paste a private key, Circle API key, or private RPC URL into a support message.

## Related official references

Circle's [Gateway overview](https://developers.circle.com/gateway) defines the unified cross-chain value proposition. The [technical guide](https://developers.circle.com/gateway/references/technical-guide) explains the ledger, balance inputs, multiple burn intents, and delegates. The [EVM unified-balance quickstart](https://developers.circle.com/gateway/quickstarts/unified-balance-evm) demonstrates finalized deposits and balance queries. Use [supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains) for domain and finality data, and [webhook events](https://developers.circle.com/gateway/references/webhook-events) for the authoritative finalized-deposit payload.
