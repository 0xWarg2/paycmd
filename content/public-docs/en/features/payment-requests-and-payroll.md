---
slug: "features/payment-requests-and-payroll"
title: "Payment requests and payroll"
description: "Create payment-request links and review batched payroll."
section: "features"
order: 42
lastUpdated: "2026-08-05"
keywords: ["request", "payment link", "payroll", "batch"]
tutorial: true
aiSummary:
  - "Payna creates payment requests with a link or QR and payroll previews that expose every recipient before batch execution."
---

## Payment request

`/request 25 from Minh on arc` creates a request record and a public link or QR for the payer. The request includes amount, token, chain, and status; creating it never pulls funds automatically from the person opening the link.

## Payroll

`/payroll` prepares a payment batch from a recipient list. The preview exposes recipient count, total amount, and every destination. Results retain success or failure per payment so a partial failure is never reported as a fully successful batch.

## Safety rules

Verify the CSV or input list, duplicate addresses, chains, balance, and fees. Payroll still requires explicit confirmation and respects the wallet policy of every payment.
