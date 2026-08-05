---
slug: "features/budgets-and-schedules"
title: "Budgets và schedules"
description: "Theo dõi giới hạn chi tiêu và quản lý command được lên lịch."
section: "features"
order: 43
lastUpdated: "2026-08-05"
keywords: ["budget", "schedule", "automation", "limit"]
tutorial: true
aiSummary:
  - "Budgets theo dõi usage trong rolling window; schedules lưu command và thời điểm chạy nhưng money movement vẫn tuân theo confirmation/runtime policy."
---

## Budgets

Trang Budgets hiển thị limit, amount đã dùng, phần còn lại và rolling period. Budget là guardrail của Payna, không thay thế balance on-chain và không tạo thêm tiền có thể chi.

## Schedules

Schedules lưu command, thời điểm, trạng thái và lần chạy tiếp theo. Người dùng có thể xem, bật/tắt hoặc xóa schedule. Command cần MetaMask vẫn phải chạy trong context có ví và chữ ký phù hợp; schedule không có quyền ký thay.

## Theo dõi lỗi

Các lần chạy queued, running, success hoặc failed được phản ánh trong app. Kiểm tra notification và activity khi một schedule thiếu balance, gas, contact hoặc confirmation cần thiết.
