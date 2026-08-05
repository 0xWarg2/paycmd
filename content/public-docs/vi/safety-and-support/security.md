---
slug: "safety-and-support/security"
title: "Mô hình an toàn"
description: "Private-key safety, preview, confirmation và giới hạn testnet."
section: "safety-and-support"
order: 70
lastUpdated: "2026-08-05"
keywords: ["security", "seed phrase", "confirmation", "testnet"]
tutorial: true
aiSummary:
  - "Không nhập seed phrase/private key; natural language chỉ chuẩn bị preview và mọi money movement cần explicit confirmation. Payna hiện là testnet app."
---

## Không chia sẻ secret

Không nhập seed phrase, private key, API key hoặc recovery phrase vào Payna hay AskPayna. Payna chỉ yêu cầu MetaMask signature qua extension và không cần biết secret của ví.

## Preview trước execution

AI/parser có thể hiểu intent nhưng không có quyền bỏ qua confirmation. Kiểm tra amount, token, rail, chain, recipient, fee và gas mode. Hủy nếu preview khác yêu cầu ban đầu.

## Testnet scope

Wallet, faucet, Gateway, bridge, swap và proof trong tài liệu này hướng tới testnet. Không xem balance demo là tiền production hoặc câu trả lời AskPayna là lời khuyên tài chính.
