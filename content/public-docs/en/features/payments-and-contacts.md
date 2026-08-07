---
slug: "features/payments-and-contacts"
title: "Payments and contacts"
description: "Resolve a saved contact or direct address, preview both chains, and confirm a USDC payment safely."
section: "features"
order: 41
lastUpdated: "2026-08-07"
keywords: ["pay", "contacts", "recipient", "preview", "15 seconds", "AskPayna"]
tutorial: true
aiSummary:
  - "A Payna payment requires amount, recipient, source chain, and destination chain, then shows a 15-second confirmation preview before Gateway execution."
  - "AskPayna never turns /pay or transfer-like text into a preview; switch to Payna and resubmit there to prepare a payment."
  - "Contacts store identity and routing hints, never signing authority; verify the resolved address and destination every time."
  - "Payna understands clear Vietnamese and English contact-group imperatives, but never turns a group question into an action."
---

## Address or saved contact

`/pay` accepts either a complete EVM address or the display name of a saved contact. A direct address is useful for a one-off payment and is not silently added to Contacts. A contact gives a memorable label, stored wallet address, preferred chain, status, and—when Payna can identify it—a link to another Payna user. Neither form owns a private key or can authorize a payment.

Use `/contacts list` to inspect the directory. Use `/contacts add Minh 0x1111...1111 on arc` to save an external wallet. Enter the full 42-character address in the real command; the abbreviated value here is only illustrative.

## Add and resolve contacts

When an address belongs to a Payna account, Payna can resolve it as an internal contact and use that user's current Circle wallet at payment time. This avoids relying only on an old stored address. An address-only add can autofill an internal profile name. An external wallet cannot be autofilled, so provide a display name.

If a display name already exists in your directory, adding it again updates that contact. Contact lookup for `/pay` is case-insensitive by display name. A requested destination chain overrides the saved preferred chain; the stored preference is a routing hint, not an immutable guarantee.

## Contact groups in chat

Manage groups with slash commands: `/contacts group create Core Team`, `/contacts group list`, `/contacts group add Core Team Minh`, `/contacts group remove Core Team Minh`, and `/contacts group delete Core Team`. Deleting a group only removes its memberships; its contacts remain in the directory.

In Payna mode, AI also routes clear imperatives such as “Tạo nhóm Core Team”, “thêm Minh vào nhóm Core Team”, “Xóa Lan khỏi nhóm Core Team”, or “delete group Core Team” into that grammar. It recognizes an action only when the request is explicit: “How do I create a group?” remains a question and never creates or changes a group.

## Source and destination are required

Payna's command parser requires a destination and either a named source or Unified Gateway. For example, `/pay 25 to Minh on arc from base` selects the source-scoped Base balance, while `/pay 25 to Minh on arc from gateway` opens a multi-source `BurnIntentSet` preview. A contact's preferred chain is only a routing hint.

This payment uses the Circle Gateway rail, not MetaMask CCTP. If a scoped ready balance is short, Payna asks the user to choose an explicit minimum deposit or a unified ready-balance quote. It never auto-deposits or treats Circle SCA wallet balance, Gateway balance, and MetaMask balance as interchangeable.

## Preview before confirmation

The preview must show amount and token, source network, destination network, and the resolved recipient. It also identifies the rail, cross-chain or recipient risk, destination gas mode, and fee or wallet estimate when available. Expand advanced details before approving a forwarding choice.

Every transaction preview has an exact 15-second lease. Confirm within that window only after checking every field. When it expires, Payna disables confirmation, cancels the preview as expired, and requires the user to submit the command again for a fresh preview. The old confirmation callback cannot execute, and editing the old card does not extend its lease.

The confirmation label repeats the amount, but it does not replace checking the full address. For a new contact, compare the address with a second trusted channel. If the destination or recipient is wrong, cancel and edit the draft. Understanding a natural-language instruction never moves money; the user must explicitly confirm execution in Payna mode.

AskPayna remains non-executing even for `/pay 50 USDC to Minh on arc from base` or transfer-like prose. It never parses, renders, confirms, or executes a payment preview. Its explanation can offer **Switch to Payna**, which only changes mode and prefills the text; the user must submit it in Payna to create a new 15-second preview.

## What happens after confirm

Payna resolves the address, validates both chains, and requests a Gateway transfer to the destination. Manual destination mint means the destination gas policy differs from auto forwarding; use the preview rather than assuming the same fee behavior on every route. An internal recipient can receive a Payna notification after success. External wallets receive funds onchain but do not gain a Payna account or notification subscription.

Where enabled, Payna writes a separate receipt proof on Arc Testnet after the payment. That proof records application receipt data; it is not the payment transaction and a proof-writing problem does not justify resending the payment.

## History and receipts

The chat receipt can expose the payment route, source allocations, destination or mint transaction, any explicitly requested deposit transaction, forwarding transaction, and optional Payna proof. Activity shows the underlying transaction type, route, amount, state, date, reason, and an explorer link when a hash is present. `/history` opens the same operational record set; use Activity filters to narrow it.

A submitted transaction can be pending even after chat confirmation. Match the explorer chain to the hash and wait for the relevant destination/finality stage before declaring the recipient paid. Save the receipt when reconciling a business payment.

## Common identity errors

“Contact not found” means no saved display name matched; add it or use a direct address. “Invalid EVM wallet address” means the address format failed validation. An internal-only add can return `INTERNAL_WALLET_NOT_FOUND`; save a named external contact only after confirming that this is intended. An internal contact without an available Circle wallet cannot be paid as internal. Lookup service failures are not proof that an address is external—retry instead of changing identity type blindly.

## Safety checklist

Verify amount, full address, source, destination, and gas mode. Treat look-alike names as untrusted, keep separate contacts for intentionally different addresses, and test unfamiliar recipients with a small amount. Never paste seed phrases, private keys, or wallet recovery data into a contact or command. If a result is ambiguous, inspect history and explorers before retrying; a duplicate command can create a duplicate payment.
