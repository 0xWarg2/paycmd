---
slug: "circle/gateway/transfer"
title: "Gateway transfer"
description: "Chuyển USDC cross-chain từ một source domain được chỉ định."
section: "circle.gateway"
order: 23
lastUpdated: "2026-08-05"
keywords: ["transfer", "burn intent", "mint", "source-scoped", "fee"]
tutorial: true
aiSummary:
  - "Gateway transfer của Payna lấy ready balance trên source chain ghi trong command, yêu cầu amount cộng fee và mint ở destination."
  - "Ví dụ /transfer 5 from base to arc dùng Gateway ready balance trên Base và không tự gom balance từ domain khác."
---

## Chuẩn bị transfer

Ví dụ `/transfer 5 from base to arc` chọn Base làm source domain và Arc làm destination. Payna kiểm tra wallet, Gateway signer, ready source balance và fee estimate trước khi tạo preview.

## Yêu cầu balance

Source cần ít nhất `amount + fee`. Nếu SCA có USDC nhưng Gateway thiếu, Payna có thể đề xuất hoặc thực hiện auto-deposit theo preview; sau đó phải chờ finality trước khi chạy lại transfer.

## Thực thi

Gateway signer ký burn intent cho source-scoped balance. Destination nhận mint theo auto-forwarding hoặc manual mode. UI hiển thị source transaction, destination transaction khi có và proof metadata liên quan.

## Không tự gom domain

Thiếu balance trên Base không được bù âm thầm bằng balance trên Avalanche hoặc Arc. Hãy deposit vào source mong muốn hoặc chọn source khác có đủ `amount + fee`.
