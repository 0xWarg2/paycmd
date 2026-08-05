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
  - "Circle Gateway separates the SCA wallet, depositor balance, and Gateway signer; Payna presents them in one flow without mixing their roles."
---

## Mental model

Circle Gateway provides a cross-chain USDC liquidity layer after USDC is deposited. **A Circle SCA wallet is not Gateway balance**: the SCA holds on-chain USDC, Gateway tracks deposited USDC by depositor and domain, and the Gateway signer authorizes required intents.

See the official [Circle Gateway overview](https://developers.circle.com/gateway) and [Gateway technical guide](https://developers.circle.com/gateway/references/technical-guide) for protocol-level behavior.

## Standard flow

1. MetaMask can fund USDC into the SCA.
2. The SCA deposits USDC into Gateway on a source domain.
3. Gateway waits for finality and moves the deposit from pending to ready.
4. A transfer uses ready balance on the selected source, creates a burn intent, and mints on the destination.
5. The user can withdraw Gateway balance to the SCA on the same domain.

## Unified does not mean automatic source aggregation

Gateway offers unified visibility and cross-chain minting. Payna's current `/transfer ... from <chain>` implementation remains source-scoped and does not consume balance from another domain automatically.
