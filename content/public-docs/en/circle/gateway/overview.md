---
slug: "circle/gateway/overview"
title: "Circle Gateway in Payna"
description: "The mental model and unified USDC flow used by Circle Gateway."
section: "circle.gateway"
order: 20
lastUpdated: "2026-08-05"
keywords: ["Circle Gateway", "SCA", "signer", "depositor", "unified"]
tutorial: true
aiSummary:
  - "Payna keeps three roles distinct: the Circle SCA holds on-chain USDC, the depositor owns domain balances inside Gateway, and a delegated EOA signs burn intents."
  - "Gateway can represent a unified cross-chain balance, while Payna's current transfer command spends only the explicitly selected source domain."
---

Circle Gateway is a non-custodial USDC liquidity system made from Gateway Wallet contracts on source chains, Gateway Minter contracts on destination chains, and Circle's off-chain Gateway service. A user deposits first and waits for source-chain finality. After that wait has been front-loaded, a valid signed transfer can receive an attestation and mint USDC on a destination without waiting for source finality in the middle of that transfer. This is the protocol model described in Circle's [Gateway overview](https://developers.circle.com/gateway) and [technical guide](https://developers.circle.com/gateway/references/technical-guide).

Payna wraps that model in commands, previews, managed wallets, history, and recovery. The wrapper does not erase the protocol boundaries. In particular, **a Circle SCA wallet is not Gateway balance**. Seeing USDC in the SCA does not mean it can immediately fund a Gateway transfer.

## The three wallet roles

The **Circle SCA wallet** is the user's application wallet. It holds ordinary on-chain USDC before deposit, sends the approval and `deposit` contract calls, pays native gas for those Circle wallet transactions, and receives a Payna withdrawal. It is also the depositor in Payna's current deposit flow because the SCA calls `GatewayWallet.deposit`.

The **Gateway depositor** is the address to which Gateway attributes a balance for a token and domain. This is a balance owner, not a separate wallet type that Payna invents. Circle tracks balances by the combination of chain/domain, token, and depositor address. In current Payna deposits, that address is the SCA. Deposits made by another address would be credited under that caller unless a protocol method explicitly deposits for someone else.

The **Gateway signer** is a Circle-managed EOA used as an authorized delegate. Payna creates or finds it for the relevant chain and has the SCA authorize it. The signer signs the EIP-712 burn intent; it does not automatically own the deposited USDC. This distinction matters during balance diagnostics: looking up only the signer address can show zero while the SCA depositor has a ready balance. Circle documents delegates and the special SCA requirement in the [technical guide](https://developers.circle.com/gateway/references/technical-guide#delegates).

Never expose seed phrases, private keys, API credentials, or RPC secrets while identifying these roles. A public address, domain number, transaction hash, or transfer ID is normally sufficient for support.

## The complete Payna Gateway flow

The normal lifecycle is:

1. `/fund 10 from metamask on base` moves USDC from MetaMask to the Circle SCA. It does not deposit into Gateway.
2. `/deposit 10 from base` initializes or finds the signer, authorizes the Gateway contract to spend the SCA's USDC, submits the deposit from the SCA, and records its transaction hash.
3. Payna marks the transaction `pending_gateway_finality`. On-chain confirmation of the submitted deposit is not yet proof that Circle has credited ready balance.
4. Circle observes a finalized deposit. Payna's primary completion path is the signed `gateway.deposit.finalized` webhook. A reconciliation sync is available as recovery.
5. `/transfer 5 from base to arc` estimates the fee, checks the selected Base Gateway balance for `amount + fee`, ensures signer authorization, signs one burn intent, and requests the Gateway transfer.
6. Auto forwarding asks Circle's Forwarding Service to execute the destination mint. Manual mode obtains an attestation and Payna submits the mint with an appropriate Circle wallet.
7. `/withdraw 2 from base` uses a same-domain burn-and-mint path to return USDC to the user's Base SCA balance.

Each transition has a different retry boundary. A draft or failed quote has not moved funds. A submitted deposit, delegate transaction, burn intent, or forwarding request might have moved state and must be checked by its identifier before retrying.

## What unified balance means

At protocol level, finalized deposits for a depositor can form a unified balance accessible for transfers to supported destinations. Circle's protocol supports multiple burn intents and even intent sets that can draw from multiple source domains. The unified model means an integration can make deposited liquidity available cross-chain; it does not mean un-deposited wallet USDC is part of that ledger.

Gateway's `/v1/balances` response is the ready, recorded balance. `/v1/deposits` identifies deposits observed but not yet processed. Circle explicitly waits for the required confirmations before updating the unified balance; confirmation requirements vary by network and are listed in [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains).

## What Payna total balance means

Payna also presents a broader visibility total. It adds successful on-chain SCA USDC reads to ready Gateway balances. That number answers “how much USDC can Payna currently see across these two locations?” It is not a new on-chain pool, and it does not grant Gateway permission to spend the SCA portion.

If an RPC or the Gateway API fails, Payna marks the result partial. A partial total is a lower bound, not evidence that the missing chain has zero. Likewise, a deposit between on-chain submission and Gateway finality can temporarily be absent from both the reduced SCA balance and the ready Gateway response. Use transaction state rather than treating a temporary display difference as loss.

## Why transfer remains source-scoped

**Current Payna implementation behavior:** `/transfer <amount> from <source> to <destination>` creates one burn intent with one `sourceDomain`. Payna queries the depositor's ready balance on that source and requires it to cover `amount + estimated fee`. It does not silently construct a multi-source intent set or consume another domain.

This is narrower than the Circle protocol's unified capability. It is deliberate product behavior today: the preview, signer authorization, gas checks, history, and retry command all retain an explicit source. A shortfall on Base is not automatically filled by ready balance on Arc. Choose Arc as the source or deposit enough finalized USDC on Base.

## Example with balances on two domains

Assume Payna can read the following values for the same SCA depositor:

| Location | Base | Arc | Separate total |
| --- | ---: | ---: | ---: |
| SCA on-chain USDC | 12 | 7 | 19 USDC |
| Gateway ready USDC | 4 | 9 | 13 USDC |

Circle Gateway visibility for the depositor is **13 USDC ready**. Payna's broader visible total is **19 + 13 = 32 USDC**. Payna does not describe the SCA's 19 USDC as deposited Gateway liquidity.

For `/transfer 5 from base to arc`, a quoted 0.02 USDC fee makes the Base requirement 5.02 USDC. The overall Gateway ready total is 13, but Base has only 4, so current Payna behavior rejects or offers an auto-deposit from Base SCA funds. It will not take the missing 1.02 from Arc's 9. A transfer sourced from Arc could pass the balance check, subject to a fresh route quote and other prerequisites.

## State and safety checklist

- Confirm which address is the SCA depositor and which is only the delegated signer.
- Treat `submitted` and `pending_gateway_finality` as waiting states, not ready balance.
- Match the command's `from` chain to the domain that has enough ready balance for `amount + fee`.
- Read a partial balance as “at least this much,” then retry failed chain lookups.
- Review recipient, source, destination, mint mode, estimated fee, and required source debit before confirmation.
- After a submitted transfer error, retain the transfer ID and transaction hashes; inspect status before retrying.
- Never send USDC with a plain ERC-20 `transfer` to a Gateway Wallet contract. Circle warns that it will not credit a unified balance and can cause loss.

## Related official references

- [Circle Gateway overview](https://developers.circle.com/gateway) — protocol purpose and unified cross-chain balance.
- [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide) — contracts, balances, deposits, transfers, withdrawals, and delegates.
- [Gateway supported blockchains](https://developers.circle.com/gateway/references/supported-blockchains) — domain identifiers and required confirmations.
- [Gateway fees](https://developers.circle.com/gateway/references/fees) and [Forwarding Service](https://developers.circle.com/gateway/references/forwarding-service) — protocol fee composition and destination forwarding.
- [Gateway webhook events](https://developers.circle.com/gateway/references/webhook-events) — finalized deposit and mint event schemas.
