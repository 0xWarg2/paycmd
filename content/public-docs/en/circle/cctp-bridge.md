---
slug: "circle/cctp-bridge"
title: "CCTP v2 bridge with MetaMask"
description: "Bridge USDC through a MetaMask-signed source burn and destination mint."
section: "circle.cctp"
order: 30
lastUpdated: "2026-08-05"
keywords: ["CCTP v2", "bridge", "burn", "mint", "MetaMask"]
tutorial: true
aiSummary:
  - "The /bridge command is a MetaMask CCTP v2 flow, separate from Circle Gateway transfer, and requires source gas plus a user signature."
---

## When to use CCTP

Use `/bridge 5 usdc from base to arc on my metamask` when USDC is held in MetaMask and the user wants a CCTP v2 bridge. This differs from `/transfer`, which uses Circle wallets and Gateway balance.

Refer to Circle's official [CCTP technical guide](https://developers.circle.com/cctp/references/technical-guide) for protocol-level behavior.

## Burn and mint

MetaMask signs the source transaction that burns or locks USDC and emits a message. After attestation, the destination transaction mints or receives USDC. Payna stores source and mint transactions for explorer verification.

## Requirements

MetaMask must be on the correct network with enough USDC and source native gas. Destination behavior follows the route and mint mode shown by the preview; never provide a seed phrase or private key to Payna.
