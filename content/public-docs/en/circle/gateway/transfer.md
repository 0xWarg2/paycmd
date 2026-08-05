---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Move USDC cross-chain from one explicitly selected source domain."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-05"
keywords: ["transfer", "burn intent", "mint", "source-scoped", "fee"]
tutorial: true
aiSummary:
  - "A Payna Gateway transfer uses ready balance on the source chain named by the command, requires amount plus fee, and mints on the destination."
  - "For example, /transfer 5 from base to arc uses Gateway ready balance on Base and never aggregates another domain silently."
---

## Prepare a transfer

`/transfer 5 from base to arc` selects Base as the source domain and Arc as the destination. Payna checks the wallets, Gateway signer, ready source balance, and fee estimate before creating a preview.

## Balance requirement

The source needs at least `amount + fee`. If the SCA has USDC while Gateway is short, Payna may propose or execute an auto-deposit shown by the preview; transfer must wait for finality before it is retried.

## Execution

The Gateway signer authorizes a burn intent against the source-scoped balance. The destination mint uses auto forwarding or manual mode. The UI exposes source and destination transactions when available plus related proof metadata.

## No silent domain aggregation

A Base shortfall is not silently covered with Avalanche or Arc balance. Deposit into the intended source or choose another source that already has `amount + fee`.
