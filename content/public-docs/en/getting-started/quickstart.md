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

## 1. Sign in and link MetaMask

Choose **Sign in with MetaMask**, approve the login signature, then run `/link metamask`. Payna never asks for a seed phrase or private key.

## 2. Create the Circle wallet

Run `/wallet create`. The command is idempotent: if the SCA wallet and Gateway signer already exist, Payna returns their current status instead of creating duplicates.

## 3. Prepare USDC and gas

Get testnet USDC from [Circle Faucet](https://faucet.circle.com/) on the chain you intend to use. MetaMask needs native gas for `/fund`, `/bridge`, and `/swap`. A Circle SCA or Gateway signer needs gas only in manual branches explicitly shown by the UI.

## 4. Run the first command

Try `/fund 10 from metamask on base`, followed by `/balance`. Before confirming a money-moving preview, verify the amount, source, destination, fee, and recipient.
