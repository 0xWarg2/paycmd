---
slug: "safety-and-support/troubleshooting"
title: "Troubleshooting"
description: "Resolve wallet, gas, balance, Gateway finality, and MetaMask errors."
section: "safety-and-support"
order: 71
lastUpdated: "2026-08-05"
keywords: ["troubleshooting", "gas", "pending", "MetaMask", "Gateway"]
tutorial: true
aiSummary:
  - "When a command fails, verify account and network, USDC and native gas, SCA versus Gateway balance, pending finality, and source amount plus fee."
---

## Wrong wallet or network

Verify that the MetaMask account matches the linked account and the intended testnet is selected. If Payna proposes adding a network, review its name, chain ID, and RPC first.

## Missing balance or gas

Distinguish MetaMask, SCA, and Gateway balances. `/fund` does not increase Gateway balance; `/deposit` must reach finality. A transfer source needs `amount + fee`. Run `/gas <chain>` before manual mode.

## Deposit pending too long

Do not submit a duplicate deposit. Check Activity for source transaction and finality state. The webhook is primary; recovery sync compares processed height and the pending list. When Circle data is unavailable, the UI must retain pending or partial status instead of claiming success.

## AskPayna lacks sources

Try a narrower question. Partial or unavailable means a retrieval source did not respond; model text without a citation is not verified evidence.
