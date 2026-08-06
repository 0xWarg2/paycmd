---
slug: "features/payment-requests-and-payroll"
title: "Payment requests and payroll"
description: "Separate inbound payment-request links from confirmed outbound payroll batches."
section: "features"
order: 42
lastUpdated: "2026-08-05"
keywords: ["request", "payment link", "payroll", "batch"]
tutorial: true
aiSummary:
  - "A payment request creates a pending inbound link or QR; payroll creates and confirms outbound Gateway payments for up to 25 active contacts."
  - "Payroll exposes recipient count and aggregate amount before execution, then preserves success or failure per item and at batch level."
---

## Two opposite workflows

Payment requests and payroll both involve multiple people, but their direction and authority differ. `/request 25 from Minh on arc` creates an inbound request: the requester wants to receive 25 USDC. It does not debit Minh. `/payroll run team 25 from base` prepares outbound payments: the signed-in operator intends to send 25 USDC to each selected active contact.

Do not use a request as evidence that payment occurred, and do not use payroll when every recipient needs a different amount. The current payroll command applies one amount to each included contact.

## Create an inbound request

The request command needs a positive amount, payer label, and destination chain. Payna uses the requester's Circle SCA wallet as the recipient address and stores USDC, amount, destination, payer label, optional memo, and `pending` status. If the payer name resolves to a contact, the request retains that contact association; unresolved text can remain a label.

Creating the record produces a public payment URL and QR image. It creates no onchain transaction, requires no payer signature, and cannot pull funds. Share the link through a trusted channel and separately confirm that the displayed destination address belongs to the requester.

## Payer review and request lifecycle

An authenticated payer opens the link and sees amount, token, destination chain, recipient address, memo, and current status. The payer may supply a source chain; if omitted, the destination chain is used as the source default. Selecting “Confirm and pay” runs a Circle Gateway transfer. Only a `pending` request can be paid.

After a successful transfer, Payna sets the request to `paid`, stores the payer and paid transaction hash, and timestamps completion. The payer and requester receive their relevant notifications. The data model also recognizes `cancelled` and `expired`, but the current request page exposes payment—not cancellation or expiry management—so do not promise those controls in this version.

## Prepare payroll recipients

Current Payna payroll builds its recipient list from at most 25 contacts whose status is `active`. Each item snapshots contact ID, label, wallet address, preferred destination chain, the common per-recipient amount, and USDC token. Inactive contacts are excluded. An empty active list blocks batch creation.

There is no CSV upload control in the current command flow. If a team begins with a CSV, validate it outside Payna, then add and review the contacts before creating the batch. Check required names, complete EVM addresses, destination chains, duplicates, active status, and whether each identity is internal or external. A spreadsheet row does not override the contact stored in Payna.

## Aggregate preview and confirmation

Before confirmation, Payna loads the active contacts, caps the set at 25, and shows recipient count. Total exposure is per-contact amount multiplied by that count. The confirm button states the aggregate USDC total and recipient count; it remains disabled while the list is loading, when no active recipient exists, or when validation fails.

Review the batch name, source chain, per-recipient amount, aggregate total, and the Contacts directory. The preview describes the recipient set as active contacts rather than displaying all full addresses inline, so the directory review is a necessary companion step. Confirmation authorizes the whole batch boundary, not an unlimited payroll policy.

## Execution and partial failures

After confirm, the batch moves from `draft` to `running`. Payna processes items sequentially through Gateway, using the batch source chain, each item's stored destination and address, and auto forwarding. Each item moves through `queued`, `running`, then `success` or `failed`; a successful item stores a transaction reference, while a failed item stores its error.

Already successful items are not rolled back when a later payment fails. The final batch is `success`, `failed`, or `partial_failed` according to the item results. Therefore never rerun the entire command merely because one recipient failed: first reconcile which items moved funds, then handle only the unpaid boundary.

## History and reconciliation

Payna stores owned batches and their items, and emits a completion notification such as “23/25 payroll payments succeeded.” Transaction Activity records the underlying Gateway payments and explorer references. Reconcile three layers: the batch final status, every item status/error/hash, and the corresponding onchain or Gateway transaction state.

For a request, keep the request ID, status, and paid transaction hash. For payroll, export or record the recipient snapshot before execution and retain the completion notification. A chat success count is a summary, not a substitute for item-level reconciliation.

## Safety checklist

Use a small test batch first. Confirm source balance, fees, destination chains, contact ownership, duplicates, and aggregate exposure. Treat QR codes and request links as payment instructions that can be substituted; verify the URL and recipient shown on the page. Never place private keys, seed phrases, employee secrets, or API credentials in a memo, contact, CSV, batch name, or chat command.
