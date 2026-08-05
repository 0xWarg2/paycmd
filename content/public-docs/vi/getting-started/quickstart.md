---
slug: "getting-started/quickstart"
title: "Bắt đầu nhanh"
description: "Đăng nhập, tạo ví, nạp testnet USDC và chạy giao dịch Payna đầu tiên."
section: "getting-started"
order: 10
lastUpdated: "2026-08-05"
keywords: ["quickstart", "MetaMask", "Circle wallet", "USDC"]
tutorial: true
aiSummary:
  - "Đăng nhập bằng MetaMask, link ví ngoài, tạo Circle wallet, nạp testnet USDC rồi chạy command có preview và confirm."
---

## 1. Đăng nhập và liên kết MetaMask

Chọn **Sign in with MetaMask**, xác nhận chữ ký đăng nhập rồi chạy `/link metamask`. Payna không yêu cầu seed phrase hoặc private key.

## 2. Tạo Circle wallet

Chạy `/wallet create`. Lệnh idempotent: nếu SCA wallet và Gateway signer đã tồn tại, Payna trả trạng thái hiện tại thay vì tạo trùng.

## 3. Chuẩn bị USDC và gas

Lấy testnet USDC từ [Circle Faucet](https://faucet.circle.com/) trên chain muốn dùng. MetaMask cần native gas cho `/fund`, `/bridge` và `/swap`. Circle SCA hoặc Gateway signer chỉ cần gas trong các nhánh manual được UI ghi rõ.

## 4. Chạy lệnh đầu tiên

Thử `/fund 10 from metamask on base`, sau đó `/balance`. Với lệnh chuyển tiền, hãy kiểm tra amount, source, destination, fee và địa chỉ người nhận trong preview trước khi confirm.
