---
slug: "commands/metamask-and-data"
title: "Bridge, swap và history commands"
description: "Reference cho bridge, swap và history."
section: "commands"
order: 63
lastUpdated: "2026-08-05"
keywords: ["bridge", "swap", "history", "MetaMask"]
commands: ["bridge", "swap", "history"]
tutorial: true
aiSummary:
  - "Nhóm MetaMask/data gồm /bridge, /swap và /history; bridge và swap cần chữ ký MetaMask, history chỉ đọc dữ liệu đã lưu."
---

## `/bridge`

Syntax: `/bridge <amount> USDC from <source> to <destination> on my metamask`. Dùng CCTP v2, cần source USDC/gas và signature. Preview phân biệt self recipient hoặc external address.

## `/swap`

Syntax: `/swap <amount> <token> to <token>`. Hiện chạy trên Arc Testnet cho USDC, EURC và cirBTC. Kiểm tra expected/minimum output, route và slippage trước khi MetaMask ký.

## `/history`

Syntax: `/history`. Chỉ đọc transaction records của account, gồm status và explorer hashes. History không tự chứng minh finality nếu record vẫn ở trạng thái pending.
