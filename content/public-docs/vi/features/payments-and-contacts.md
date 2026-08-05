---
slug: "features/payments-and-contacts"
title: "Pay và contacts"
description: "Lưu người nhận và thanh toán USDC qua preview an toàn."
section: "features"
order: 41
lastUpdated: "2026-08-05"
keywords: ["pay", "contacts", "recipient", "preview"]
tutorial: true
aiSummary:
  - "Payna cho phép lưu contact theo địa chỉ/rail rồi dùng /pay để tạo payment preview; người dùng phải xác nhận trước khi tiền di chuyển."
---

## Contacts

Dùng `/contacts add Minh 0x... on arc` để lưu tên và địa chỉ, hoặc `/contacts list` để xem danh sách. Luôn kiểm tra chain và địa chỉ đầy đủ trước lần thanh toán đầu tiên.

## Pay

`/pay 5 to Minh on arc` resolve contact, kiểm tra wallet/rail và tạo preview. Payna không thực thi chỉ vì AI hiểu câu tự nhiên; confirm là bước bắt buộc.

## Người nhận trực tiếp

Bạn có thể pay một địa chỉ thay vì contact. Lịch sử lưu loại giao dịch, amount, chain, status và transaction hash khi có. Contact không giữ private key và không có quyền ký thay người dùng.
