---
slug: "commands/wallet-and-balance"
title: "Wallet và balance commands"
description: "Reference cho wallet, link, fund và balance."
section: "commands"
order: 60
lastUpdated: "2026-08-05"
keywords: ["wallet", "link", "fund", "balance"]
commands: ["wallet", "link", "fund", "balance"]
tutorial: true
aiSummary:
  - "Nhóm wallet gồm /wallet, /link, /fund và /balance; /fund chỉ nạp SCA còn /balance tổng hợp SCA và Gateway."
---

## `/wallet`

Syntax: `/wallet create`, `/wallet status`, `/wallet balance [chain]`. Create idempotent; status trả SCA và signer; balance chỉ đọc Circle SCA on-chain balance.

## `/link`

Syntax: `/link metamask`. MetaMask phải đang connect và account phải khớp phiên đăng nhập. Lệnh chỉ lưu liên kết địa chỉ, không lấy quyền custody.

## `/fund`

Syntax: `/fund <amount> from metamask on <chain>`. MetaMask cần USDC và native gas. Preview hiển thị source address, SCA destination, amount và chain. Kết quả là SCA balance, chưa phải Gateway balance.

## `/balance`

Syntax: `/balance [chain]`. Kết quả tách SCA và Gateway, kèm pending/unavailable source khi có. Tổng Payna không đồng nghĩa toàn bộ amount đều sẵn sàng cho Gateway transfer.
