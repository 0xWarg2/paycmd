---
slug: "features/activity-and-notifications"
title: "Activity, history, and notifications"
description: "Track transaction lifecycle, proof, and operational alerts."
section: "features"
order: 44
lastUpdated: "2026-08-05"
keywords: ["activity", "history", "notification", "status"]
tutorial: true
aiSummary:
  - "Activity combines transaction history and notifications, including Gateway finality, failures, transaction hashes, and proof metadata."
---

## Transaction history

`/history` and the Activity page expose transaction type, amount, chain, status, timestamps, and transaction hash. A bridge can have source and mint transactions; a Payna proof can have a separate ArcScan link.

## Lifecycle

Queued, running, waiting for Gateway finality, successful, and failed states represent distinct stages. A successful source transaction does not always mean destination execution or finality is complete.

## Notifications

Notifications report finalized deposits, failed transactions, schedule issues, and events requiring attention. Realtime updates webhook-settled deposits in the UI, while reload must recover the stored state.
