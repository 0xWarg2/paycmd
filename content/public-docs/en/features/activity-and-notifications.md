---
slug: "features/activity-and-notifications"
title: "Activity, history, and notifications"
description: "Reconcile transaction receipts, lifecycle states, explorer links, and operational alerts."
section: "features"
order: 44
lastUpdated: "2026-08-05"
keywords: ["activity", "history", "notification", "status"]
tutorial: true
aiSummary:
  - "Activity separates transaction history from notifications; use receipts and chain-correct explorer links to reconcile every stage."
  - "Gateway finality notifications are created only after verified settlement evidence updates a pending deposit; unread state is informational in the current UI."
---

## Two Activity tabs

The authenticated `/activity` page has Transactions and Notifications tabs. Transactions is the ledger-style view of recorded onchain and Gateway work. Notifications is an inbox of outcomes and events requiring attention. Use `/activity?tab=transactions` or `/activity?tab=notifications` to deep-link to a tab; the legacy `/notifications` route redirects to the notification tab.

The two tabs answer different questions. A notification says something happened or needs attention. A transaction row provides route, amount, state, and explorer evidence. Reconcile important payments in Transactions even if an inbox message looks successful.

## Transaction history

`/history` opens Payna's history result from chat, while Activity provides the full searchable table or mobile cards. Search can match hash, chain, type, status, or stored reason. Filters cover transaction type and `success`, `failed`, `pending`, or `pending_gateway_finality`; date sorting and pagination operate on the loaded history.

Each row shows action, Payna rail, source/destination route, amount, status, date, and one explorer link when its primary hash is available. The reason field can contain failure context or structured metadata. “No transactions found” can also mean the current search or filters excluded every row.

## Chat receipts and proof links

The richer command receipt in chat can expose more than the Activity row. A CCTP bridge may have a source-burn link on the source explorer and a mint link on the destination explorer. Gateway transfer or payment may show an auto-deposit transaction and a destination mint or forwarder transaction. A swap can include approval and swap details.

Payna may also show a “Payna proof” transaction on Arc Testnet. This is a separate application receipt written after the business action; it is not Circle attestation, not the source payment, and not a substitute for checking destination delivery. Proof failure or absence must not trigger a duplicate payment.

## Pending, waiting, and finalized

`pending` means the recorded transaction is not yet concluded. `pending_gateway_finality` is narrower: a Gateway deposit transaction exists, but Payna has not yet accepted evidence that its balance is available. In command execution progress, `queued`, `running`, `waiting_gateway`, `success`, and `failed` describe different processing stages.

A source transaction can succeed while a destination mint, forwarder action, or Gateway finality remains incomplete. Treat only the relevant final state as completion. If a failure occurred after funds moved, the lifecycle highlights finalization rather than wallet approval; investigate before retrying.

## Notification inbox

The Notifications tab shows up to 50 newest non-archived records. It provides text search and filters for all, unread, waiting, and failed. Counts at the top summarize unread, waiting/finality, and failed/error items. Notifications can include received payments, paid requests, payroll results, transaction failures, and Gateway balance availability.

`unread`, `read`, and `archived` exist in storage, but the current Activity UI has no mark-read action. An unread badge therefore means the record has not been updated to `read`, not that nobody investigated it. Pending Gateway notices can be archived automatically when no deposit remains pending. Per-notification deep links to command execution details are also not available yet.

## Gateway webhooks and finality alerts

For Gateway deposits, Payna can receive Circle's `gateway.deposit.finalized` webhook. The server verifies Circle's signature, accepts only the configured environment and event type, matches transaction hash, domain, wallet, and amount to a pending deposit, and records the event for duplicate-safe processing. Only then does it settle the history row and insert the “Gateway balance is ready” unread notification.

This notification is an application view of verified settlement evidence, not the webhook itself. If webhook delivery is delayed, Payna's authenticated sync path can check pending deposits and reach the same stored settlement boundary. The app refreshes notifications and balances periodically, on focus, and after settlement events; reload Activity if the list is stale.

## Deep links and explorer discipline

Share the Activity tab URL for navigation, but share transaction evidence by its chain-specific explorer URL. A hash is meaningful only on its associated chain. For cross-chain work, label source, destination mint/forwarder, and Arc proof separately. Do not paste a hash into a random explorer and conclude that it is missing.

Because execution-detail deep links are not yet present, keep the command time, amount, route, command name, and hashes together when escalating. Notification text alone may omit fields required for investigation.

## Reconciliation checklist

Clear search and filters, identify the rail, compare amount and route, inspect every receipt link on the correct explorer, and distinguish submitted from finalized. For a bridge, preserve source and mint hashes. For Gateway deposits, wait for the balance-ready event or verified sync result. Never include seed phrases, private keys, passwords, or API credentials in notification searches or support messages, and do not retry merely because a proof or inbox update is late.
