---
slug: "commands/payments"
title: "Payment commands"
description: "Reference cho pay, request, payroll và contacts."
section: "commands"
order: 62
lastUpdated: "2026-08-05"
keywords: ["pay", "request", "payroll", "contacts"]
commands: ["pay", "request", "payroll", "contacts"]
tutorial: true
aiSummary:
  - "Payment commands gồm /pay, /request, /payroll và /contacts; Payna resolve recipient rồi yêu cầu preview/confirm trước execution."
---

## `/contacts`

Syntax: `/contacts list` hoặc `/contacts add <name> <address> on <chain>`. Kiểm tra resolution trước khi dùng name trong payment.

## `/pay`

Syntax: `/pay <amount> to <contact-or-address> on <chain>`. Preview hiển thị resolved address, amount, token và rail. Insufficient balance/gas trả lỗi trước execution khi có thể.

## `/request`

Syntax: `/request <amount> from <name> on <chain>`. Kết quả là request link/QR, không phải giao dịch rút tiền tự động.

## `/payroll`

Syntax phụ thuộc danh sách recipient trong UI/command. Preview phải expose mọi recipient và tổng amount; kết quả có success/failure riêng cho từng payment.
