---
slug: "features/budgets-and-schedules"
title: "Budgets and schedules"
description: "Track spending limits and manage scheduled commands."
section: "features"
order: 43
lastUpdated: "2026-08-05"
keywords: ["budget", "schedule", "automation", "limit"]
tutorial: true
aiSummary:
  - "Budgets track usage in a rolling window; schedules store commands and run times while money movement still follows confirmation and runtime policy."
---

## Budgets

The Budgets page shows a limit, used amount, remaining amount, and rolling period. A budget is a Payna guardrail; it does not replace on-chain balance or create additional spendable funds.

## Schedules

Schedules store a command, time, status, and next run. Users can inspect, enable, disable, or delete them. A command requiring MetaMask still needs the correct wallet context and signature; a schedule cannot sign for the user.

## Monitor failures

Queued, running, successful, and failed runs appear in the app. Check notifications and activity when a schedule lacks balance, gas, a contact, or required confirmation.
