---
slug: "arc/onchain-proof"
title: "Payna onchain proof"
description: "Receipt event trên Arc liên kết command và transaction mà không giữ tiền."
section: "arc"
order: 51
lastUpdated: "2026-08-05"
keywords: ["Arc", "proof", "receipt", "contract", "ArcScan"]
tutorial: true
aiSummary:
  - "Payna proof contract trên Arc chỉ emit receipt event liên kết command, amount và tx hashes; contract không giữ hoặc chuyển tiền."
---

## Proof ghi gì

Sau pay, transfer, bridge hoặc swap phù hợp, relayer có thể gọi `recordReceipt`. Event liên kết command type, amount, sender/recipient và source/mint transaction hashes.

## Proof không làm gì

Contract không custody USDC, không bridge và không chứng minh nội dung off-chain là đúng tuyệt đối. Circle contracts hoặc MetaMask-signed transaction mới xử lý money movement.

## Kiểm tra

Payna lưu proof transaction hash vào history và liên kết ArcScan. Nếu proof recording lỗi sau khi tiền đã di chuyển, giao dịch gốc không bị đảo ngược; UI phải tách trạng thái payment và proof.
