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

## Payment identity and rail

Contacts resolve identity; `/pay` and payroll move Gateway USDC; a request creates payment instructions. Never assume a saved label replaces checking the full address and destination. Read [payments and contacts](/docs/features/payments-and-contacts) and the [request/payroll lifecycle](/docs/features/payment-requests-and-payroll) for deeper recovery guidance.

## `/contacts`

- **Purpose:** List saved recipients or add/update an internal or external EVM recipient; contacts never hold keys or authorize payments.
- **Syntax and variants:** `/contacts list`; `/contacts add <name> <0x-address> on <chain>`; or address-only add for a resolvable internal Payna wallet.
- **Example:** `/contacts add Minh 0x1111111111111111111111111111111111111111 on arc`; natural language: “Save this Arc address as Minh.”
- **Prerequisites:** Sign in, use a full valid address, and provide a name for an external wallet. Chain is a routing preference.
- **Preview:** No transaction preview; review action, resolved profile or supplied name, full address, preferred chain, and internal/external classification.
- **Confirmation boundary:** None onchain. The command immediately reads or writes your directory and cannot spend funds.
- **Success and persisted data:** List returns owned contacts. Add inserts or updates a `contacts` row with display name, wallet, chain, status, and optional internal-user link.
- **Named errors and fixes:** **“Invalid EVM wallet address”**: correct the 42-character address. **`INTERNAL_WALLET_NOT_FOUND`**: provide a display name and save it as external only after verification. **“external name required”**: add `<name>`.

## `/pay`

- **Purpose:** Send USDC from one scoped Gateway domain or an explicitly selected unified allocation to a resolved contact/address.
- **Syntax and variants:** `/pay <amount> [USDC] to <recipient> on <destination> from <source> [manual]`; use `from gateway` for BurnIntentSet allocation.
- **Example:** `/pay 25 to Minh on arc from base`; if Base is short, choose a minimum deposit or the unified source table. `/pay 25 to Minh on arc from gateway` starts unified.
- **Prerequisites:** Resolvable recipient, valid quote, ready capacity after fee reserves, delegate authorization on selected sources, and destination gas only for manual mint.
- **Preview:** Verify recipient, destination, mint mode, each source allocation, total estimated fee, maximum reserve/debit, exclusions, and quote fingerprint. No auto-deposit occurs.
- **Confirmation boundary:** Deposit and persistent delegate consent are separate confirmations. Final payment confirmation signs the bounded BurnIntent/BurnIntentSet; MetaMask does not sign.
- **Success and persisted data:** Response includes recipient resolution, one transfer ID, source allocations, settled fees, history ID, destination explorer/proof links, and notifications.
- **Named errors and fixes:** **“Contact not found”**: add the contact or use a full address. **`GATEWAY_INSUFFICIENT_SCOPED_BALANCE`**: choose deposit or unified. **`GATEWAY_DELEGATE_REQUIRED`**: authorize and wait. **`GATEWAY_QUOTE_CHANGED`**: review again. **`INSUFFICIENT_GAS`**: fund the named wallet or select forwarding.

## `/request`

- **Purpose:** Create a shareable request for someone to pay USDC to your SCA; it never debits the payer automatically.
- **Syntax and variants:** `/request <amount> [USDC] from <payer> on <destination-chain>`.
- **Example:** `/request 25 from Minh on arc`; natural language: “Ask Minh for 25 USDC to my Arc wallet.”
- **Prerequisites:** Sign in, create your SCA, provide a positive amount, payer label/contact, and supported destination.
- **Preview:** No money-movement card; review payer label, amount/token, destination, and your full recipient SCA before sharing.
- **Confirmation boundary:** Creating the request needs no blockchain signature. The payer later reviews and authorizes a separate payment on the request page.
- **Success and persisted data:** Payna stores a `payment_requests` row as `pending` with requester, optional payer contact, amount, chain, recipient, memo, then returns request URL and QR image URL.
- **Named errors and fixes:** **“amount and payer are required”**: add a positive amount and payer. **“Create your wallet first with /wallet create”**: provision the receiving SCA. An unresolved payer is retained as a label; verify identity before sharing.

## `/payroll`

- **Purpose:** Snapshot up to 25 active contacts and optionally run a Gateway payment per item.
- **Syntax and variants:** `/payroll create <batch-name> <amount> [from <source>]` saves; `/payroll run <batch-name> <amount> [from <source>]` creates and executes. Source defaults to Arc; amount is per contact.
- **Example:** `/payroll run august 25 from base`; natural language: “Pay active contacts 25 USDC from Base.”
- **Prerequisites:** Active contacts with verified routes and source-scoped Gateway liquidity for total amount plus fees.
- **Preview:** Payna shows only the active-recipient count and calculated aggregate total—not names, addresses, destinations, or a frozen snapshot. Zero/failed loading disables confirmation.
- **Confirmation boundary:** Confirmation authorizes a batch from active contacts fetched afterward; count/total is not an approval list and may change. `run` uses sequential Gateway-signer attempts—not MetaMask or an atomic transaction.
- **Success and persisted data:** `payroll_batches` stores `draft/running/success/failed/partial_failed`; items store recipient, amount, status, hash/error, with explorer evidence in Activity. A notification summarizes successes.
- **Named errors and fixes:** **“No active contacts found for payroll”**: add/activate recipients. **“Payroll batch not found”**: reopen the owned batch. For **`partial_failed`**, reconcile item hashes and retry only unpaid recipients—never rerun the whole batch blindly.
