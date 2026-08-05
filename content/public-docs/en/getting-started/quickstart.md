---
slug: "getting-started/quickstart"
title: "Quickstart"
description: "Sign in, create wallets, fund testnet USDC, and run your first Payna transaction."
section: "getting-started"
order: 10
lastUpdated: "2026-08-05"
keywords: ["quickstart", "MetaMask", "Circle wallet", "USDC"]
tutorial: true
aiSummary:
  - "Sign in with MetaMask, link the external wallet, create a Circle wallet, fund testnet USDC, and run commands through preview and confirmation."
---

## Prepare your testnet session

Use a MetaMask account intended for testing and select the testnet chain you plan to use. Keep a small native-token balance for transaction gas; USDC alone cannot pay MetaMask network fees. Payna is testnet-oriented, so use faucet funds and do not enter a seed phrase or private key anywhere in the app. Public docs can be read without an account, but commands and wallet information need an authenticated Payna session.

## Sign in with MetaMask

Choose **Sign in with MetaMask** and approve the login signature in the extension. A login signature proves control of the selected account; it is not a token transfer. Check the address shown by MetaMask before signing, especially if the extension has several accounts or networks available. If the wrong account is active, switch it in MetaMask, then refresh or sign in again so the session and extension agree.

## Link the MetaMask wallet with `/link metamask`

After signing in, run `/link metamask`. The command associates the connected external address with the current Payna account; it does not give Payna custody of the wallet. The MetaMask account must match the logged-in session. This association lets Payna prepare funding, CCTP bridge, and swap flows that need a user signature. You can inspect the linked address later with `/wallet status`.

## Create a Circle wallet with `/wallet create`

Run `/wallet create` to provision the Circle SCA wallet and the related Gateway signer information used by Payna flows. The command is idempotent: if the required wallet records already exist, it returns their current status rather than creating duplicates. Wait for the status response before trying a money-moving command. A successful wallet creation does not move USDC into the SCA and does not make a Gateway balance.

## Get faucet USDC and native gas

Get testnet USDC from the [Circle Faucet](https://faucet.circle.com/) on the chain you want to fund. Confirm that the faucet deposit reaches the linked MetaMask address, not an SCA or Gateway address copied from another screen. MetaMask needs USDC plus native gas for `/fund`, CCTP bridge, and Arc swap actions. Circle SCA or Gateway signer gas is relevant only for Circle-wallet transactions or manual branches explicitly called out in the UI; use `/gas <chain>` when a Gateway flow asks you to check it.

## Fund the Circle wallet with `/fund`

Move a small test amount from MetaMask to the Circle SCA wallet:

```text
/fund 10 from metamask on base
```

The preview should show the MetaMask source, SCA destination, amount, and chain. Approve the MetaMask transaction only if those details are correct. `/fund` increases the SCA balance; it does not deposit USDC into Circle Gateway. For a Gateway transfer later, use `/deposit` after funding and wait for the displayed finality state.

## Check balances with `/balance`

Then ask Payna for the balance view:

```text
/balance
```

The result separates available SCA and Gateway information when applicable. You can also ask for a chain-scoped check such as:

```text
/balance on base
```

Do not interpret one displayed total as permission to use every dollar in a Gateway transfer. SCA USDC remains SCA USDC until it is deposited and becomes ready in Gateway.

## Review the first preview and confirm

Use a small payment or the funding command above as your first confirmation exercise. Read the action name, rail, amount, token, source, destination, chain, recipient, fee, and gas warning. A preview prepares an action; it does not execute it. Confirm only after it matches your intent, and reject or edit it if Payna selected the wrong chain, wallet, or recipient. Natural-language input never bypasses this confirmation step.

## Verify the result in history

After confirmation, wait for the result state and open the activity or history entry. Record the displayed transaction reference, status, and the rail used. Gateway flows may also expose source and destination transaction references or proof metadata; a pending deposit or transfer should not be treated as final simply because the first transaction was submitted. Re-run `/balance` to confirm which balance changed, and use the exact activity entry when asking for help.

## Troubleshoot your first session

If `/link metamask` fails, make sure the extension is connected and the selected account matches the login session. If `/fund` cannot proceed, check that MetaMask has faucet USDC, source native gas, and the intended network. If `/balance` shows SCA USDC but Gateway is empty, that is expected until `/deposit` has finalized. For an uncertain pending state, check history and the troubleshooting guide instead of repeating the command, which can create a second request.

## First-session checklist

- MetaMask is signed in with the intended testnet account.
- `/link metamask` and `/wallet create` completed successfully.
- The linked MetaMask address has testnet USDC and native gas.
- `/fund 10 from metamask on base` was reviewed before approval.
- `/balance` and history show the result on the intended rail.
- No seed phrase or private key was shared with Payna.
