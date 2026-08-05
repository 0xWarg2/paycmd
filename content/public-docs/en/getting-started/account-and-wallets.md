---
slug: "getting-started/account-and-wallets"
title: "Accounts and wallet roles"
description: "Understand the Payna account, MetaMask, Circle SCA wallet, and Gateway signer."
section: "getting-started"
order: 11
lastUpdated: "2026-08-05"
keywords: ["account", "MetaMask", "SCA", "Gateway signer"]
tutorial: true
aiSummary:
  - "A Payna account can link MetaMask, a Circle SCA wallet, and a Gateway signer; each wallet has a separate role and balance."
---

## Your Payna account identity

Your Payna account is the authenticated identity that groups a login session, a linked MetaMask address, and Circle-managed wallet records. It is not itself an on-chain address and it does not merge the balances of every wallet shown in the app. The account lets Payna present related actions in one history and apply the correct wallet to a chosen rail. One user can therefore see multiple addresses because the rails have different ownership and signing responsibilities.

## MetaMask is your external wallet

MetaMask is the user-controlled wallet outside Payna. You select the account in the extension and approve its login signature, funding transaction, CCTP v2 bridge, or Arc swap when a flow asks for it. Payna reads the connected address and asks MetaMask to sign; it does not hold the wallet’s key material. MetaMask also pays native gas for actions it submits, so its USDC balance and native-gas balance are separate requirements.

## Circle SCA wallet handles Payna wallet actions

The Circle SCA wallet is the on-chain wallet Payna orchestrates for Circle-wallet and payment operations. `/wallet create` provisions it, `/fund` sends USDC to it from MetaMask, and `/wallet balance [chain]` reads its chain-scoped USDC balance. The SCA address can receive the funds shown by an SCA-oriented preview. Its balance is not automatically available to Circle Gateway; `/deposit` is the separate action that moves eligible SCA USDC into that liquidity layer.

## Gateway signer authorizes Gateway intents

The Gateway signer is a separate multichain EOA used in Gateway flows for delegation and required burn-intent signatures. It is not a replacement for the SCA and should not be treated as a default receiving address. Gateway also tracks deposited USDC by depositor and domain, so a signer address, a depositor record, and an SCA address may all appear in one status view. This separation lets Payna show the correct source, authorization, and destination for each Gateway preview.

## Addresses you may see

Use `/wallet status` to identify the Circle SCA, Gateway signer, and Circle wallets; the command does not report whether MetaMask is linked. Check the linked MetaMask address and status badge in **Profile**. Use `/gateway info` for Gateway configuration such as depositor and signer information. `/balance` separates SCA and Gateway views; `/gateway balance [chain]` reads the Gateway side without adding USDC that remains in SCA. Copy an address only from the field labeled for the intended action. A recipient address for a MetaMask CCTP bridge, an SCA receiving address, and Gateway configuration are not interchangeable just because they are associated with the same Payna account.

## Recovery and re-linking behavior

If you reconnect the same MetaMask account, run `/link metamask` again to restore the address association for the active Payna session. If the extension is using another account, switch it deliberately and sign in or re-link so the session matches. `/wallet create` is idempotent and returns existing Circle wallet status instead of duplicating it. Re-linking does not transfer balances, convert SCA USDC into Gateway balance, or change a pending transaction; use history and the relevant rail status to inspect those states.

## Private-key boundaries

Never enter a seed phrase or private key into Payna, chat, or a support request. MetaMask signatures are approved in the extension, and Circle-wallet flows are displayed through Payna’s wallet experience. Before confirmation, check the named wallet, address, rail, amount, token, chain, fee, and gas requirement. Reject a request that names an unknown address or a wallet role you did not intend. Payna’s ability to parse a request does not remove the explicit confirmation requirement for money movement.

## Compare wallet roles

| Role | Who controls signing | Primary use | Balance to check |
| --- | --- | --- | --- |
| Payna account | Authenticated user session | Groups related records and history | It is not an on-chain balance |
| MetaMask | You, through the extension | Login, fund, CCTP bridge, Arc swap | MetaMask USDC and native gas |
| Circle SCA wallet | Circle-wallet flow orchestrated by Payna | Hold funded USDC and Payna payment actions | `/wallet balance [chain]` |
| Gateway signer | Gateway flow signer | Authorization and burn-intent signatures | Use `/gateway info` and `/gas check <chain>` when requested |
| Gateway depositor balance | Circle Gateway by depositor and domain | Ready Gateway transfer liquidity | `/gateway balance [chain]` |

When deciding what to do next, follow the rail rather than the shortest-looking address. Fund MetaMask USDC into the SCA with `/fund`; deposit SCA USDC with `/deposit` before Gateway use; use CCTP only when the preview says MetaMask is the source. That distinction keeps the visible addresses and balances understandable.
