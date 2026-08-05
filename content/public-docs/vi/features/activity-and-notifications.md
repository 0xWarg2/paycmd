---
slug: "features/activity-and-notifications"
title: "Activity, history và notifications"
description: "Theo dõi transaction lifecycle, proof và các cảnh báo cần xử lý."
section: "features"
order: 44
lastUpdated: "2026-08-05"
keywords: ["activity", "history", "notification", "status"]
tutorial: true
aiSummary:
  - "Activity tập hợp transaction history và notifications, gồm trạng thái Gateway finality, failure, tx hash và proof metadata."
---

## Transaction history

`/history` và trang Activity hiển thị loại giao dịch, amount, chain, status, timestamps và tx hash. Bridge có thể có source và mint transaction; Payna proof có thể có ArcScan link riêng.

## Lifecycle

Các trạng thái queued, running, waiting Gateway finality, success và failed phản ánh từng giai đoạn. Một source transaction thành công chưa luôn có nghĩa destination hoặc finality đã hoàn tất.

## Notifications

Notifications nêu deposit finalized, transaction failure, schedule issue và sự kiện cần chú ý. Realtime giúp UI cập nhật webhook-settled deposit; reload vẫn phải phục hồi được trạng thái đã lưu.
