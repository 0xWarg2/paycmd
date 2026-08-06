---
slug: "safety-and-support/security"
title: "Safety model"
description: "Private-key safety, previews, confirmations, and testnet recovery boundaries."
section: "safety-and-support"
order: 70
lastUpdated: "2026-08-05"
keywords: ["security", "seed phrase", "confirmation", "testnet"]
tutorial: true
aiSummary:
  - "Payna is testnet-oriented: never share wallet secrets, verify every preview and signature, and inspect submitted work before retrying."
---

## Start with the testnet boundary

Payna's wallet, Gateway, CCTP, Arc swap, and proof flows target testnet. Testnet assets are not production money or a promise that a production route is supported. Start small, verify the network, and do not treat AskPayna as financial, legal, or investment advice.

## Keep every secret out of chat

Never enter a seed phrase, mnemonic, recovery phrase, private key, password, API key, session token, RPC credential, or signing secret into Payna, AskPayna, support, or a chat-linked form. MetaMask handles its own authentication, `/fund`, CCTP, and swap prompts; Circle SCA/Gateway operations use their named Circle wallet and Gateway signing roles, not MetaMask. Payna never needs wallet secrets. AskPayna blocks secret-bearing queries and redacts public identifiers for search, but redaction is not permission to paste sensitive data.

A public address, transaction hash, transfer ID, chain, time, and sanitized error are normally enough to investigate an incident. If a prompt asks for a secret to restore a balance, close it and use the official wallet recovery process instead.

## Verify the wallet prompt itself

Before approving a MetaMask authentication, `/fund`, CCTP, or swap prompt, check account, chain, contract/spender, amount, and gas. Payna confirmation is separate from a wallet signature. Circle SCA/Gateway operations instead use their named Circle wallet and Gateway signer roles. Reject unexpected signatures or network additions; compare proposed network name, chain ID, and RPC with the guide.

The Circle SCA, Gateway depositor, delegated Gateway signer, and MetaMask account have different roles. In particular, SCA USDC is not ready Gateway balance, and a Gateway signer is not automatically the balance owner. See [wallet roles](/docs/getting-started/account-and-wallets) and the [Gateway overview](/docs/circle/gateway/overview) before moving funds.

## Treat previews as a required checkpoint

Natural language and parsers prepare intent; they cannot bypass explicit confirmation. Check amount, token, rail, chains, full recipient, mint mode, estimated fee, source debit, and gas payer. For swaps, inspect route, minimum output, and slippage; for payments/transfers, verify the named source.

Cancel when any field differs from your request. Re-open a fresh preview after changing amount, recipient, route, source, destination, or mint mode: quotes and balances can become stale. The deeper [Gateway fees and forwarding](/docs/circle/gateway/fees-gas-and-forwarding), [CCTP bridge](/docs/circle/cctp-bridge), and [Arc swap](/docs/arc/overview-and-swap) guides explain each rail's extra confirmation steps.

## Check addresses, chains, and allowances

Verify the complete copied address character-for-character against a trusted source or a previously verified address-book entry; never use prefix/suffix-only checks because they do not prevent address poisoning. Confirm the source and destination are the intended testnets and open a hash only in that chain's explorer. A hash missing from the wrong explorer says nothing about the transaction.

An ERC-20 approval authorizes a spender and is a separate gas-using action. Read its scope/network in MetaMask. Never plain-transfer USDC to a Gateway contract: it is not a deposit and may be lost; use `/deposit`. Be cautious with external links and never import a wallet, approve a contract, or install an extension only because chat asks.

## Know when a retry is safe

It is normally safe to correct and retry a validation error, rejected wallet request, read-only balance check, or transfer quote error when no transaction, deposit hash, burn hash, or transfer ID exists. Refreshing Gateway deposit recovery, checking status, or reopening Activity is also safe because it does not submit another transfer.

Once a deposit, approval, delegate, CCTP burn, Gateway transfer, forwarding, manual mint, or swap hash exists, state may have changed. Do not repeat it because chat/history/proof is late. A burn can await mint, a deposit can be `pending_gateway_finality`, and Arc proof never moves funds. Reconcile identifiers in [Activity](/docs/features/activity-and-notifications).

## Incident checklist

1. Stop signing and preserve the command, route, time, public hashes, and transfer ID.
2. Identify the last confirmed stage: approval, deposit, source burn, forwarding, mint, swap, or proof.
3. Check the correct explorer and the matching Activity row; distinguish `pending` from `success`.
4. Use the rail-specific recovery guidance before any new submission.
5. Escalate only public identifiers and sanitized errors. Never disclose secrets, authentication tokens, or private configuration.

For a suspected wallet compromise, disconnect the affected session and contact the wallet provider through a verified official channel. Payna cannot recover a seed phrase or reverse a completed onchain transaction.
