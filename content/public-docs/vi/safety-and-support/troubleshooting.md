---
slug: "safety-and-support/troubleshooting"
title: "Troubleshooting"
description: "Xử lý lỗi wallet, gas, balance, Gateway finality và MetaMask."
section: "safety-and-support"
order: 71
lastUpdated: "2026-08-05"
keywords: ["troubleshooting", "gas", "pending", "MetaMask", "Gateway"]
tutorial: true
aiSummary:
  - "Khi lệnh lỗi, kiểm tra đúng account/network, USDC và native gas, SCA so với Gateway balance, pending finality và source amount cộng fee."
---

## Wallet hoặc network sai

Kiểm tra MetaMask account khớp account đã link và chọn đúng testnet. Nếu Payna đề nghị add network, đọc chain name, chain ID và RPC trước khi chấp nhận.

## Thiếu balance hoặc gas

Phân biệt MetaMask, SCA và Gateway balance. `/fund` không tăng Gateway balance; `/deposit` cần chờ finality. Transfer source cần `amount + fee`. Dùng `/gas <chain>` trước manual mode.

## Deposit pending lâu

Không submit deposit trùng. Xem Activity để kiểm tra source tx và trạng thái finality. Webhook là primary path; recovery sync đối chiếu processed height và pending list. Nếu Circle source unavailable, UI phải giữ pending/partial thay vì báo success.

## AskPayna thiếu nguồn

Thử câu hỏi cụ thể hơn. Trạng thái partial/unavailable nghĩa là một retrieval source không phản hồi; không coi model text không có citation là dữ liệu đã xác minh.
