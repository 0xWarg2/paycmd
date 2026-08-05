---
slug: "features/payments-and-contacts"
title: "Payments and contacts"
description: "Resolve a saved contact or direct address, preview both chains, and confirm a USDC payment safely."
section: "features"
order: 41
lastUpdated: "2026-08-05"
keywords: ["pay", "contacts", "recipient", "preview"]
tutorial: true
aiSummary:
  - "A Payna payment requires amount, recipient, source chain, and destination chain, then resolves the recipient and shows a confirmation preview before Gateway execution."
  - "Contacts store identity and routing hints, never signing authority; verify the resolved address and destination every time."
---

## Address or saved contact

`/pay` accepts either a complete EVM address or the display name of a saved contact. A direct address is useful for a one-off payment and is not silently added to Contacts. A contact gives a memorable label, stored wallet address, preferred chain, status, and—when Payna can identify it—a link to another Payna user. Neither form owns a private key or can authorize a payment.

Use `/contacts list` to inspect the directory. Use `/contacts add Minh 0x1111...1111 on arc` to save an external wallet. Enter the full 42-character address in the real command; the abbreviated value here is only illustrative.

## Add and resolve contacts

When an address belongs to a Payna account, Payna can resolve it as an internal contact and use that user's current Circle wallet at payment time. This avoids relying only on an old stored address. An address-only add can autofill an internal profile name. An external wallet cannot be autofilled, so provide a display name.

If a display name already exists in your directory, adding it again updates that contact. Contact lookup for `/pay` is case-insensitive by display name. A requested destination chain overrides the saved preferred chain; the stored preference is a routing hint, not an immutable guarantee.

## Source and destination are required

Payna's command parser requires both sides of the payment. For example: `/pay 25 to Minh on arc from base`. `from base` selects the source-scoped Gateway balance and `on arc` selects the destination network. Omitting either leaves the draft incomplete, even if a contact has a preferred chain.

This payment uses the Circle Gateway rail, not MetaMask CCTP. Payna may auto-deposit eligible source wallet funds into Gateway when configured, but it never treats Circle SCA wallet balance, Gateway balance, and MetaMask balance as interchangeable.

## Preview before confirmation

The preview must show amount and token, source network, destination network, and the resolved recipient. It also identifies the rail, cross-chain or recipient risk, destination gas mode, and fee or wallet estimate when available. Expand advanced details before approving a forwarding choice.

The confirmation label repeats the amount, but it does not replace checking the full address. For a new contact, compare the address with a second trusted channel. If the destination or recipient is wrong, cancel and edit the draft. Understanding a natural-language instruction never moves money; the user must explicitly confirm execution.

## What happens after confirm

Payna resolves the address, validates both chains, and requests a Gateway transfer to the destination. Manual destination mint means the destination gas policy differs from auto forwarding; use the preview rather than assuming the same fee behavior on every route. An internal recipient can receive a Payna notification after success. External wallets receive funds onchain but do not gain a Payna account or notification subscription.

Where enabled, Payna writes a separate receipt proof on Arc Testnet after the payment. That proof records application receipt data; it is not the payment transaction and a proof-writing problem does not justify resending the payment.

## History and receipts

The chat receipt can expose the payment route, destination or mint transaction, any source auto-deposit transaction, forwarding transaction, and optional Payna proof. Activity shows the underlying transaction type, route, amount, state, date, reason, and an explorer link when a hash is present. `/history` opens the same operational record set; use Activity filters to narrow it.

A submitted transaction can be pending even after chat confirmation. Match the explorer chain to the hash and wait for the relevant destination/finality stage before declaring the recipient paid. Save the receipt when reconciling a business payment.

## Common identity errors

“Contact not found” means no saved display name matched; add it or use a direct address. “Invalid EVM wallet address” means the address format failed validation. An internal-only add can return `INTERNAL_WALLET_NOT_FOUND`; save a named external contact only after confirming that this is intended. An internal contact without an available Circle wallet cannot be paid as internal. Lookup service failures are not proof that an address is external—retry instead of changing identity type blindly.

## Safety checklist

Verify amount, full address, source, destination, and gas mode. Treat look-alike names as untrusted, keep separate contacts for intentionally different addresses, and test unfamiliar recipients with a small amount. Never paste seed phrases, private keys, or wallet recovery data into a contact or command. If a result is ambiguous, inspect history and explorers before retrying; a duplicate command can create a duplicate payment.
