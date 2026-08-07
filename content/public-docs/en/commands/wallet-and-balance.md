---
slug: "commands/wallet-and-balance"
title: "Wallet and balance commands"
description: "Reference for wallet, link, fund, and balance."
section: "commands"
order: 60
lastUpdated: "2026-08-07"
keywords: ["wallet", "link", "fund", "balance", "AskPayna", "wallet observations"]
commands: ["wallet", "link", "fund", "balance"]
tutorial: true
aiSummary:
  - "Wallet commands include /wallet, /link, /fund, and /balance; /fund only funds the SCA while /balance labels SCA and Gateway visibility separately."
  - "Authenticated AskPayna observations keep Gateway ready/pending, Circle SCA USDC, external-wallet USDC, and native gas separate and add no signing rail."
---

## Read wallet roles first

These commands expose four distinct things: your Payna account, user-controlled MetaMask, the Circle SCA wallet, and source-scoped Circle Gateway balance. They do not merge ownership or move funds automatically. See [accounts and wallet roles](/docs/getting-started/account-and-wallets) for the conceptual model.

## Wallet context in AskPayna

For an authenticated user, AskPayna may read wallet observations only when the question is operationally relevant—for example, “Can I afford 50 USDC?” or “How can I send 50 USDC to Arc?” It does not load private wallet context for general protocol or educational questions. These observations describe a point in time and may be partial.

AskPayna labels Gateway-ready USDC, Gateway-pending USDC, Circle SCA USDC, external-wallet USDC, and external-wallet native gas as separate families. It does not aggregate them into a rail-independent total, convert unavailable reads to zero, or imply that one family can fund another. Adding these read-only observations did not add a MetaMask signing or transaction rail to AskPayna; there is no preview, wallet prompt, signature, or transaction from a research answer.

## `/wallet`

- **Purpose:** Provision or inspect the authenticated user's Circle SCA; its balance is not Gateway balance.
- **Syntax and variants:** `/wallet create`, `/wallet status`, or `/wallet balance [chain]`. The chain is optional only for `balance`.
- **Example:** `/wallet balance base`; natural language: “Show the USDC in my Circle wallet on Base.”
- **Prerequisites:** Sign in. Balance/status require an existing SCA; create is idempotent and returns the existing wallet instead of duplicating it.
- **Preview:** `create` shows an action preview; `status` and `balance` are immediate reads. Check action, SCA address, blockchain, type, and any chain scope.
- **Confirmation boundary:** Only `create` has a Payna confirmation card. Status and balance never sign or move funds.
- **Success and persisted data:** Create returns wallet-set ID and wallet record stored in `wallets`; status returns stored SCA details; balance returns onchain SCA USDC data.
- **Named errors and fixes:** **“No wallet address found. Run /wallet create first”**: create the SCA. **“Unsupported chain”**: use a key from the [Gateway support matrix](/docs/circle/gateway/support-matrix). **“Unauthorized”**: sign in again.

## `/link`

- **Purpose:** Associate a verified user-controlled MetaMask EVM address with the current Payna account; it grants no custody.
- **Syntax and variants:** `/link metamask`; other wallet types are not implemented.
- **Example:** `/link metamask`; natural language: “Connect this MetaMask account to Payna.”
- **Prerequisites:** Sign in, install/unlock MetaMask, select the intended account, and clear any older pending wallet prompt.
- **Preview:** The intent identifies wallet type; MetaMask then shows account access and a human-readable `personal_sign` message containing address and timestamp.
- **Confirmation boundary:** There is no Payna money-movement confirmation. Account selection and the MetaMask signature are the authorization boundaries; no blockchain transaction or gas is involved.
- **Success and persisted data:** Payna verifies the signature, upserts `user_external_wallets`, marks it primary, and updates the profile's primary external address and default chain.
- **Named errors and fixes:** **“MetaMask is not available”**: install/enable it. **“MetaMask request was rejected”**: retry and approve only the expected message. **“signature verification failed”**: switch to the address named in the message and sign again.

## `/fund`

- **Purpose:** Transfer USDC from linked MetaMask to your Circle SCA on one supported chain; it does not fund Gateway.
- **Syntax and variants:** `/fund <amount> from metamask on <chain>`; amount supports up to six decimals.
- **Example:** `/fund 50 from metamask on base`; natural language: “Move 50 USDC from my MetaMask into my Circle wallet on Base.”
- **Prerequisites:** Existing SCA, linked/connected matching MetaMask, source USDC, native gas, and supported chain.
- **Preview:** Verify amount/token, source chain, connected source address, SCA destination, Circle-wallet rail, and wallet-reported gas.
- **Confirmation boundary:** Payna confirmation precedes execution; MetaMask separately confirms the ERC-20 `transfer`. Cancel either boundary to avoid movement.
- **Success and persisted data:** Result includes hash and `success`, `failed`, or `pending`; Payna stores a `fund` history row with addresses, amount, chain, status, and reason. SCA USDC changes, Gateway does not.
- **Named errors and fixes:** **“does not match linked wallet”**: select/re-link the correct account. **“Insufficient USDC”**: fund that MetaMask address. **“does not have ... native gas”**: add the chain's gas token, then retry after confirming no hash exists.

## `/balance`

- **Purpose:** Read a combined visibility report while keeping SCA and Gateway components explicit.
- **Syntax and variants:** `/balance` for all supported chains, or `/balance <chain>` for one scope.
- **Example:** `/balance arc`; natural language: “How much USDC can Payna see on Arc?”
- **Prerequisites:** Sign in and create an SCA. No MetaMask connection, signature, or gas is needed.
- **Preview:** This is an immediate read, not a transaction preview. Results list SCA `chainBalances`, Gateway domain balances, totals, failed chains, and Gateway availability.
- **Confirmation boundary:** None; the command cannot spend funds.
- **Success and persisted data:** Returns current fetched balances only; it does not write transaction history. In the `/balance` command result, an all-chain `totalUnified` adds visible SCA and Gateway values for display, not spendability; AskPayna wallet observations do not use that aggregation.
- **Named errors and fixes:** **“No wallet address found”**: run `/wallet create`. **“Unsupported chain”**: correct the scope. A **partial** result or failed chain means the displayed total is only a lower bound; retry the read instead of treating unavailable data as zero.
