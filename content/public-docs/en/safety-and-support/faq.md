---
slug: "safety-and-support/faq"
title: "Frequently asked questions"
description: "Short answers about Payna, Circle Gateway, Arc, and AskPayna."
section: "safety-and-support"
order: 72
lastUpdated: "2026-08-05"
keywords: ["FAQ", "Payna", "Gateway", "Arc", "AskPayna"]
tutorial: true
aiSummary:
  - "The FAQ covers public docs, testnet scope, Gateway balance, confirmation, proof, and AskPayna citations."
---

## Do docs require sign-in?

No. Landing and docs are public. The app requires sign-in when reading or writing a user's chats, contacts, wallets, transactions, notifications, and payment requests.

## Can unified balance spend from every chain?

Gateway provides unified visibility, but Payna transfers are currently source-scoped. The source named by the command needs ready balance covering `amount + fee`.

## Why is Gateway balance missing after `/fund`?

Because `/fund` only moves USDC into the SCA. Run `/deposit` and wait for Gateway finality.

## Does the proof contract move funds?

No. It emits a receipt event on Arc; Circle or MetaMask transactions handle funds.

## Can AskPayna invent sources?

No. Citations must come from tutorial, MCP, or Tavily retrieval; source failures are marked partial or unavailable.
