---
slug: "circle/gateway/fees-gas-and-forwarding"
title: "Gateway fee, gas và forwarding"
description: "Chọn auto forwarding hoặc manual destination gas cho transfer."
section: "circle.gateway"
order: 25
lastUpdated: "2026-08-05"
keywords: ["fee", "gas", "auto forwarding", "manual mint"]
tutorial: true
aiSummary:
  - "Auto forwarding trả thêm fee bằng USDC và không cần destination native gas; manual thường rẻ hơn nhưng wallet thực thi mint cần gas ở destination."
---

## Auto forwarding

Đây là mặc định của Payna. Fee USDC gồm forwarding cost và source cần đủ `amount + fee`. Circle Forwarding Service xử lý destination mint nên người dùng không cần nạp native gas ở chain đích.

## Manual gas

Thêm `manual` hoặc `no forwarding` vào command để dùng nhánh manual khi được hỗ trợ. Fee USDC có thể thấp hơn, nhưng SCA hoặc Gateway signer thực thi mint phải có native gas tại destination.

## Gas theo từng rail

MetaMask trả gas cho fund, CCTP bridge và Arc swap. SCA/signer gas chỉ liên quan các Circle wallet transaction hoặc manual destination mint được preview chỉ rõ. Luôn dùng `/gas <chain>` trước khi chọn manual.
