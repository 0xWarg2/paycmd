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
  - "Payna keeps scoped commands strict, but an explicit unified fallback can allocate ready balance across up to 16 BurnIntentSet intents."
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

## Scoped-first transfer and unified execution

**Current Payna implementation behavior:** a named command remains source-scoped. `/transfer 5 from base to arc` constructs one burn intent, compares Base ready balance with `amount + maxFee`, and never spends another domain silently. `/transfer 5 from gateway to arc`, or the explicit **Use Unified Gateway** fallback, constructs a BurnIntentSet from selected ready sources.

Unified execution still does not blindly spend the displayed total. The preview subtracts each intent's `maxFee`, excludes unusable or unauthorized sources, shows every proposed allocation, and binds confirmation to a quote fingerprint. SCA balances and pending deposits remain excluded. A unified total is therefore visibility; `maximumUsableCapacity` is the safer execution number.

## Example with balances on two domains

Suppose one SCA address has these successfully read balances:

| Balance category | Base Sepolia | Arc Testnet | Category total |
| --- | ---: | ---: | ---: |
| SCA on-chain | 6 USDC | 14 USDC | 20 USDC |
| Gateway ready | 11 USDC | 3 USDC | 14 USDC |

The **Circle Gateway ready total is 14 USDC**. The **Payna visible total is 34 USDC**, calculated as 20 SCA plus 14 Gateway. The 20 SCA is not silently converted into deposited liquidity.

Now consider `/transfer 10 from arc to base`. If the maximum reserve is 0.03 USDC, Arc needs 10.03 ready. Arc has only 3, so scoped confirmation is disabled. Payna offers an explicit minimum deposit of 7.03 or a unified preview. Unified mode can propose Base plus Arc only after reserving each source intent's fee; it never deposits the SCA's 20 USDC automatically. Changing the selected sources creates a fresh quote and fingerprint.

## Depositor and signer scope

Gateway credits the depositor, and Payna uses that same Circle SCA to authorize spending directly through ERC-1271. Balance reads and new transfers therefore use the SCA address. Historical records can still identify legacy signer addresses, but new operations never use them.

If a user has multiple SCA records or an older deposit made by another address, support should compare the deposit transaction caller, the webhook `walletAddress`, the domain, and the queried depositor. Do not “fix” a zero signer balance by moving funds or repeating a deposit.

## State and safety checklist

- Label every amount as SCA, Gateway pending, or Gateway ready and retain its chain/domain.
- Exclude pending deposits from spendable Gateway balance.
- Treat partial reads as lower bounds; inspect `failedChains` and `gatewayUnavailable` before drawing conclusions.
- For scoped transfer, check the selected source row rather than the cross-domain display total.
- For unified transfer, check every allocation, maximum fee reserve, exclusion, and `maximumUsableCapacity`.
- Keep transaction hashes and transfer IDs until history and balance views agree.
- Never paste a private key, Circle API key, or private RPC URL into a support message.

## Related official references

Circle's [Gateway overview](https://developers.circle.com/gateway) defines the unified cross-chain value proposition. The [ERC-1271 reference](https://developers.circle.com/gateway/references/erc-1271) explains direct smart-account signing. Use [supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains) for domain and finality data, and [webhook events](https://developers.circle.com/gateway/references/webhook-events) for the authoritative finalized-deposit payload.
