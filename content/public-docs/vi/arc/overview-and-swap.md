---
slug: "arc/overview-and-swap"
title: "Arc Testnet và swap"
description: "Swap USDC, EURC và cirBTC trên Arc bằng MetaMask."
section: "arc"
order: 50
lastUpdated: "2026-08-05"
keywords: ["Arc", "swap", "USDC", "EURC", "cirBTC"]
tutorial: true
aiSummary:
  - "Payna swap trên Arc Testnet dùng MetaMask, hỗ trợ USDC/EURC/cirBTC, direct route cho USDC pair và route qua USDC cho cặp còn lại."
---

## Tài sản hỗ trợ

Swap adapter hiện hỗ trợ USDC (6 decimals), EURC (6 decimals) và cirBTC (8 decimals) trên Arc Testnet. Đây là testnet flow, không phải Circle Gateway transfer.

## Route và slippage

Pair có USDC dùng direct route. EURC ↔ cirBTC đi qua USDC. Quote hiển thị expected output, minimum output và slippage guard mặc định 1%; AMM math dùng fee assumption 0.3%.

## Thực thi

Chạy `/swap 1 USDC to EURC`, kiểm tra quote rồi ký bằng MetaMask. Ví cần đúng Arc Testnet, đủ input token và Arc native gas. Sau tx hash, Payna lưu history và cố ghi proof receipt.
