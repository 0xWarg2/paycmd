---
slug: "getting-started/account-and-wallets"
title: "Tài khoản và các loại ví"
description: "Hiểu tài khoản Payna, MetaMask, Circle SCA wallet và Gateway signer."
section: "getting-started"
order: 11
lastUpdated: "2026-08-05"
keywords: ["account", "MetaMask", "SCA", "Gateway signer"]
tutorial: true
aiSummary:
  - "Một tài khoản Payna có thể liên kết MetaMask, Circle SCA wallet và Gateway signer; mỗi ví có vai trò và balance riêng."
---

## MetaMask

MetaMask là ví ngoài do người dùng kiểm soát. Nó ký login, fund, CCTP bridge và Arc swap. Payna chỉ đọc địa chỉ và yêu cầu chữ ký qua extension.

## Circle SCA wallet

SCA wallet là ví Circle do Payna điều phối cho các thao tác wallet và payment. USDC trong SCA là balance on-chain của ví, chưa tự động trở thành Gateway liquidity.

## Gateway signer

Gateway signer là EOA đa chain dùng để ủy quyền và ký burn intent trong Gateway flow. Địa chỉ này khác SCA wallet và không nên được dùng như địa chỉ nhận tiền mặc định.

## Kiểm tra trạng thái

Dùng `/wallet status` để xem các địa chỉ, `/wallet balance arc` để xem SCA balance theo chain và `/gateway info` để xem cấu hình Gateway liên quan.
