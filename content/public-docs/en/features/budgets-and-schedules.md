---
slug: "features/budgets-and-schedules"
title: "Budgets and schedules"
description: "Audit current spending context and understand Payna's manual-first schedule demo."
section: "features"
order: 43
lastUpdated: "2026-08-05"
keywords: ["budget", "schedule", "automation", "limit"]
tutorial: true
aiSummary:
  - "Budgets currently provide a read-only 30-day spending dashboard; enforcement and editing controls are not yet active."
  - "Schedules display stored recurring-payment rows in manual-first demo scope and do not autonomously sign or move funds."
---

## Current product scope

Budgets and Schedules are authenticated operational dashboards, but automation is intentionally limited in this release. The Budgets page reads real budget rows and recent transaction context; it does not yet create or enforce budget policies. The Schedules page reads real `payment_schedules` rows; it does not expose a production cron runner or controls to create, pause, resume, or delete schedules.

Treat both pages as audit and planning surfaces. A number shown there is not an approval, an onchain balance, a reservation of funds, or evidence that a future payment will execute.

## Budget records

Each budget row has a name, token, limit amount, used amount, and `active`, `paused`, or `archived` state. Payna displays the stored used-versus-limit ratio and clamps the progress bar to 100 percent. “Available” is the arithmetic difference between the stored limit and used amount, never less than zero in the UI.

That available figure is not spendable USDC. Before paying, separately check the source Circle wallet or Gateway balance, route eligibility, fees, gas, and any required confirmation. Pausing a stored budget label does not currently freeze an onchain wallet.

## The 30-day activity window

The dashboard's “tracked spend” is calculated from successful `pay`, `transfer`, `bridge`, `swap`, and `withdraw` transaction-history rows created during the rolling 30 days before the page load. It queries at most the newest 100 rows in that window. Failed rows do not add to spend; pending rows contribute to the pending counter, and failed rows to the failed counter.

The “top chain” is the most frequent chain value among the loaded recent rows, not necessarily the chain with the largest USDC volume. Because this activity calculation and each budget's stored `used_amount` come from different fields, they may differ. Reconcile against Activity rather than forcing them to match.

## Schedule records and time

A stored schedule connects an amount and token to a frequency such as daily, weekly, monthly, or quarterly, plus a status and `next_run_at`. The page counts active and paused rows, sorts scheduled times ascending, and shows the first active upcoming value as “Next planned run.” A missing time appears as “Not scheduled.” Displayed time follows the viewer's locale formatting.

The row does not currently expose its contact or budget details in the UI, even though the data model can relate them. Verify the intended recipient and budget in the system that created the record; do not infer them from amount and cadence alone.

## Confirmation is manual-first

The current page explicitly labels approval mode “Manual first.” A future schedule is expected to create a payment command within an approval window, but it must not bypass the same preview, balance, identity, fee, and signature rules as an interactive command. MetaMask operations always require the appropriate connected-wallet context and cannot be signed by a schedule.

For this version, run `/pay`, `/transfer`, or `/payroll` manually from chat and review its confirmation card. A stored `active` schedule indicates planning state, not authorization to move money at `next_run_at`.

## Demo runner and run states

Payna has a scoped schedule demo endpoint that can return a synthetic command execution with `queued` status. It demonstrates the boundary between a schedule and a run; it is not production cron and does not execute a payment. Real command executions use distinct lifecycle states: `queued`, `running`, `waiting_gateway`, `success`, or `failed`.

Do not label a queued or waiting run as paid. `waiting_gateway` means the relevant Gateway finality stage is incomplete. A failed run may happen before funds move or after submission, so inspect its receipt and Activity before deciding whether retry is safe.

## Schedules and transactions are separate

One schedule can produce many runs over time, and each successful run can produce one or more transaction records. The schedule ID answers “what was planned”; a command execution answers “what ran”; transaction hashes answer “what was submitted onchain.” Pausing or cancelling a schedule cannot reverse an already submitted transaction, and changing a budget display cannot edit an immutable receipt.

For reconciliation, record the schedule, expected run time, execution status, transaction route and hashes, and any finality notification. Missing a transaction hash is a signal to investigate, not proof that no funds moved.

## Operational checklist

Use explicit time zones when coordinating teams, compare `next_run_at` with the expected cadence, and confirm the recipient and aggregate exposure for every manual run. Review Activity after execution and resolve pending states before starting a replacement. Never store private keys, seed phrases, API credentials, or passwords in budget names or schedule metadata. Until enforcement and production automation ship, keep external approval and accounting controls in place.
