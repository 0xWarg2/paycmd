---
slug: "features/payment-requests-and-payroll"
title: "Payment requests và payroll"
description: "Tạo link yêu cầu thanh toán và preview batch payroll."
section: "features"
order: 42
lastUpdated: "2026-08-05"
keywords: ["request", "payment link", "payroll", "batch"]
tutorial: true
aiSummary:
  - "Payna tạo payment request có link/QR và payroll preview hiển thị từng recipient trước khi chạy batch."
---

## Payment request

`/request 25 from Minh on arc` tạo request record và public link/QR để người trả mở. Request có amount, token, chain và trạng thái; việc tạo request không tự rút tiền từ người nhận link.

## Payroll

`/payroll` chuẩn bị batch payment từ danh sách recipient. Preview phải hiển thị số người nhận, tổng amount và từng destination. Kết quả lưu success/failure theo từng payment để partial failure không bị báo nhầm là toàn bộ thành công.

## Quy tắc an toàn

Kiểm tra CSV hoặc danh sách đầu vào, địa chỉ trùng, chain, balance và fee. Payroll vẫn cần explicit confirmation và không bỏ qua wallet policy của từng payment.
