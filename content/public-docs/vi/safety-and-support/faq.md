---
slug: "safety-and-support/faq"
title: "Câu hỏi thường gặp"
description: "Các câu trả lời ngắn về Payna, Circle Gateway, Arc và AskPayna."
section: "safety-and-support"
order: 72
lastUpdated: "2026-08-05"
keywords: ["FAQ", "Payna", "Gateway", "Arc", "AskPayna"]
tutorial: true
aiSummary:
  - "FAQ giải thích docs public, testnet scope, Gateway balance, confirmation, proof và AskPayna citations."
---

## Docs có cần đăng nhập không?

Không. Landing và docs public. App cần sign in khi đọc hoặc ghi chat, contact, wallet, transaction, notification và payment request của user.

## Unified balance có tiêu được từ mọi chain không?

Gateway cho unified visibility, nhưng Payna transfer hiện source-scoped. Source ghi trong command phải có ready balance đủ `amount + fee`.

## Tại sao `/fund` xong vẫn thiếu Gateway balance?

Vì `/fund` chỉ chuyển vào SCA. Chạy `/deposit` và chờ Gateway finality.

## Proof contract có chuyển tiền không?

Không. Nó chỉ emit receipt event trên Arc; Circle hoặc MetaMask transaction xử lý tiền.

## AskPayna có tự tạo nguồn không?

Không. Citation phải đến từ tutorial, MCP hoặc Tavily retrieval; lỗi nguồn được đánh dấu partial/unavailable.
