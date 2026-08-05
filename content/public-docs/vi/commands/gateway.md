---
slug: "commands/gateway"
title: "Circle Gateway commands"
description: "Reference cho deposit, withdraw, transfer, gas và gateway."
section: "commands"
order: 61
lastUpdated: "2026-08-05"
keywords: ["deposit", "withdraw", "transfer", "gas", "gateway"]
commands: ["deposit", "withdraw", "transfer", "gas", "gateway"]
tutorial: true
aiSummary:
  - "Gateway commands gồm /deposit, /withdraw, /transfer, /gas và /gateway; mọi money movement có preview và source-scoped checks."
---

## `/deposit`

Syntax: `/deposit <amount> from <chain>`. Chuyển SCA USDC vào Gateway và trả pending cho đến finality. Không chạy lặp khi deposit trước còn pending.

## `/withdraw`

Syntax: `/withdraw <amount> from <chain>`. Chuyển ready Gateway balance về SCA trên cùng domain. Preview hiển thị fee và destination SCA.

## `/transfer`

Syntax: `/transfer <amount> from <source> to <destination> [manual]`. Source cần `amount + fee`. Mặc định auto forwarding; manual cần destination native gas.

## `/gas` và `/gateway`

`/gas <chain>` kiểm tra native gas của wallet liên quan. `/gateway info` hiển thị depositor, signer và configuration; `/gateway balance [chain]` chỉ đọc Gateway balance, không cộng SCA.
