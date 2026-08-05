---
slug: "commands/payments"
title: "Payment commands"
description: "Reference for pay, request, payroll, and contacts."
section: "commands"
order: 62
lastUpdated: "2026-08-05"
keywords: ["pay", "request", "payroll", "contacts"]
commands: ["pay", "request", "payroll", "contacts"]
tutorial: true
aiSummary:
  - "Payment commands include /pay, /request, /payroll, and /contacts; Payna resolves recipients and requires preview plus confirmation before execution."
---

## `/contacts`

Syntax: `/contacts list` or `/contacts add <name> <address> on <chain>`. Verify resolution before using a saved name in a payment.

## `/pay`

Syntax: `/pay <amount> to <contact-or-address> on <chain>`. The preview exposes resolved address, amount, token, and rail. Insufficient balance or gas is reported before execution where possible.

## `/request`

Syntax: `/request <amount> from <name> on <chain>`. The result is a request link or QR, not an automatic debit transaction.

## `/payroll`

Syntax follows the recipient list supplied by the UI or command. The preview exposes every recipient and total amount; results retain success or failure for each payment.
