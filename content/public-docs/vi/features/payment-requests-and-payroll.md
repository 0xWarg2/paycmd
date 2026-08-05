---
slug: "features/payment-requests-and-payroll"
title: "Payment requests và payroll"
description: "Tách inbound payment-request link khỏi outbound payroll batch cần confirm."
section: "features"
order: 42
lastUpdated: "2026-08-05"
keywords: ["request", "payment link", "payroll", "batch"]
tutorial: true
aiSummary:
  - "Payment request tạo inbound link hoặc QR ở trạng thái pending; payroll tạo và confirm outbound Gateway payments cho tối đa 25 active contacts."
  - "Payroll hiện recipient count và aggregate amount trước execution, rồi giữ success hoặc failure theo từng item và toàn batch."
---

## Hai workflow ngược chiều

Payment request và payroll đều liên quan nhiều người, nhưng hướng tiền và quyền hạn khác nhau. `/request 25 from Minh on arc` tạo inbound request: requester muốn nhận 25 USDC. Nó không debit Minh. `/payroll run team 25 from base` chuẩn bị outbound payments: operator đang đăng nhập muốn gửi 25 USDC cho mỗi active contact được chọn.

Không dùng request làm bằng chứng payment đã xảy ra, và không dùng payroll khi mỗi recipient cần amount khác nhau. Command payroll hiện tại áp dụng một amount cho mọi contact được đưa vào.

## Tạo inbound request

Request command cần amount dương, payer label và destination chain. Payna dùng Circle SCA wallet của requester làm recipient address, lưu USDC, amount, destination, payer label, memo và status `pending`. Nếu payer name resolve được contact, request giữ liên kết contact đó; text không resolve được vẫn có thể là label.

Tạo record sẽ sinh public payment URL và QR image. Hành động này không tạo onchain transaction, không cần chữ ký payer và không thể tự rút tiền. Chia sẻ link qua kênh tin cậy và xác nhận riêng rằng destination address hiển thị thuộc requester.

## Payer review và request lifecycle

Payer đã đăng nhập mở link và thấy amount, token, destination chain, recipient address, memo và status hiện tại. Payer có thể nhập source chain; nếu bỏ trống, destination chain được dùng làm source mặc định. Chọn “Confirm and pay” sẽ chạy Circle Gateway transfer. Chỉ request `pending` mới có thể được trả.

Sau transfer thành công, Payna chuyển request sang `paid`, lưu payer và paid transaction hash, rồi ghi thời điểm hoàn tất. Payer và requester nhận notification liên quan. Data model còn nhận `cancelled` và `expired`, nhưng request page hiện chỉ cho payment—không có quản lý cancel hoặc expiry—nên không nên kỳ vọng các control đó trong version này.

## Chuẩn bị payroll recipient

Payroll Payna hiện tại tạo recipient list từ tối đa 25 contact có status `active`. Mỗi item snapshot contact ID, label, wallet address, preferred destination chain, common per-recipient amount và token USDC. Inactive contact bị loại. Active list trống sẽ chặn tạo batch.

Command flow hiện chưa có CSV upload control. Nếu team bắt đầu từ CSV, hãy validate ngoài Payna, rồi add và review contacts trước khi tạo batch. Kiểm tra tên bắt buộc, địa chỉ EVM đầy đủ, destination chain, dòng trùng, active status và identity internal hay external. Một spreadsheet row không ghi đè contact đã lưu trong Payna.

## Aggregate preview và confirmation

Trước confirmation, Payna load active contacts, giới hạn tập ở 25 và hiện recipient count. Total exposure bằng amount mỗi contact nhân số người nhận. Confirm button ghi aggregate USDC total và recipient count; nút bị disable khi list đang load, không có active recipient hoặc validation lỗi.

Kiểm tra batch name, source chain, per-recipient amount, aggregate total và Contacts directory. Preview mô tả recipient set là active contacts thay vì hiện mọi địa chỉ đầy đủ inline, nên review danh bạ là bước bổ sung bắt buộc. Confirmation authorize toàn bộ batch boundary, không tạo payroll policy không giới hạn.

## Execution và partial failure

Sau confirm, batch chuyển từ `draft` sang `running`. Payna xử lý item tuần tự qua Gateway bằng source chain của batch, destination và address đã lưu của từng item, cùng auto forwarding. Mỗi item đi qua `queued`, `running`, rồi `success` hoặc `failed`; item thành công lưu transaction reference, còn item lỗi lưu error.

Item đã thành công không rollback khi payment sau thất bại. Batch cuối cùng là `success`, `failed` hoặc `partial_failed` theo item result. Vì vậy đừng chạy lại toàn command chỉ vì một recipient lỗi: trước tiên đối soát item nào đã chuyển tiền, rồi chỉ xử lý phần chưa trả.

## History và đối soát

Payna lưu batch thuộc user và các item, đồng thời tạo completion notification như “23/25 payroll payments succeeded.” Transaction Activity ghi các Gateway payment nền và explorer reference. Hãy đối soát ba lớp: final status của batch, status/error/hash của từng item, và trạng thái onchain hoặc Gateway transaction tương ứng.

Với request, giữ request ID, status và paid transaction hash. Với payroll, export hoặc ghi lại recipient snapshot trước execution và giữ completion notification. Success count trong chat là summary, không thay cho item-level reconciliation.

## Checklist an toàn

Chạy batch thử nhỏ trước. Xác nhận source balance, fee, destination chain, quyền sở hữu contact, dòng trùng và aggregate exposure. Coi QR code và request link là payment instruction có thể bị thay thế; kiểm tra URL và recipient trên trang. Không bao giờ đặt private key, seed phrase, bí mật nhân viên hoặc API credential vào memo, contact, CSV, batch name hay chat command.
