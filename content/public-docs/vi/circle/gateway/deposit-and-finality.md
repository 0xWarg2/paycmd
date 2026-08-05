---
slug: "circle/gateway/deposit-and-finality"
title: "Deposit và Gateway finality"
description: "Từ SCA deposit đến Gateway ready balance, webhook và recovery sync."
section: "circle.gateway"
order: 22
lastUpdated: "2026-08-05"
keywords: ["deposit", "finality", "pending", "webhook", "sync"]
tutorial: true
aiSummary:
  - "Lệnh /deposit chuyển USDC từ Circle SCA vào Gateway; deposit chỉ usable sau Gateway finality. Webhook là completion path chính và sync là recovery path."
---

## `/fund` khác `/deposit`

`/fund 10 from metamask on base` chuyển USDC từ MetaMask vào Circle SCA wallet. `/deposit 10 from base` chuyển USDC từ SCA vào Gateway. Sau `/fund`, Gateway vẫn chưa thể dùng phần USDC đó.

## Trạng thái deposit

Sau khi transaction deposit được submit, Payna lưu trạng thái `pending_gateway_finality`. Pending deposit chưa được tính vào ready balance và không nên bị deposit lại tự động.

## Webhook và recovery

Sự kiện Circle `gateway.deposit.finalized` là tín hiệu hoàn tất chính. Payna xác minh chữ ký webhook, cập nhật transaction và phát thay đổi qua Realtime. `/api/gateway/deposit/sync` là recovery path khi webhook bị trễ: chỉ settle khi processed height đã qua block deposit và hash không còn trong pending list. Heuristic thời gian chỉ áp dụng cho dữ liệu legacy thiếu deposit block.
