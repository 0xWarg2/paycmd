---
slug: "features/payments-and-contacts"
title: "Payments and contacts"
description: "Save recipients and pay USDC through a safe preview."
section: "features"
order: 41
lastUpdated: "2026-08-05"
keywords: ["pay", "contacts", "recipient", "preview"]
tutorial: true
aiSummary:
  - "Payna saves contacts by address and rail, then uses /pay to create a payment preview that requires explicit confirmation."
---

## Contacts

Use `/contacts add Minh 0x... on arc` to save a name and address, or `/contacts list` to inspect the list. Verify the full chain and address before the first payment.

## Pay

`/pay 5 to Minh on arc` resolves the contact, checks the wallet and rail, and creates a preview. Payna never executes merely because AI understood natural language; confirmation is mandatory.

## Direct recipients

You can pay an address without saving a contact. History records transaction type, amount, chain, status, and transaction hash when available. A contact stores no private key and cannot sign for the user.
