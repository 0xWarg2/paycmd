---
slug: "commands/gateway"
title: "Circle Gateway commands"
description: "Reference for deposit, withdraw, transfer, gas, and gateway."
section: "commands"
order: 61
lastUpdated: "2026-08-05"
keywords: ["deposit", "withdraw", "transfer", "gas", "gateway"]
commands: ["deposit", "withdraw", "transfer", "gas", "gateway"]
tutorial: true
aiSummary:
  - "Gateway commands include /deposit, /withdraw, /transfer, /gas, and /gateway; all money movement uses previews and source-scoped checks."
---

## `/deposit`

Syntax: `/deposit <amount> from <chain>`. Moves SCA USDC into Gateway and remains pending until finality. Do not repeat it while the prior deposit is pending.

## `/withdraw`

Syntax: `/withdraw <amount> from <chain>`. Moves ready Gateway balance to the SCA on the same domain. The preview exposes fee and SCA destination.

## `/transfer`

Syntax: `/transfer <amount> from <source> to <destination> [manual]`. The source needs `amount + fee`. Auto forwarding is default; manual mode requires destination native gas.

## `/gas` and `/gateway`

`/gas <chain>` checks native gas for relevant wallets. `/gateway info` exposes depositor, signer, and configuration; `/gateway balance [chain]` reads only Gateway balance and does not add SCA funds.
