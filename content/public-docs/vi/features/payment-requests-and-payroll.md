---
slug: "features/payment-requests-and-payroll"
title: "Payment requests và payroll"
description: "Tách inbound payment-request link khỏi outbound payroll batch cần confirm."
section: "features"
order: 42
lastUpdated: "2026-08-07"
keywords: ["request", "payment link", "payroll", "batch"]
tutorial: true
aiSummary:
  - "Payment request tạo inbound link hoặc QR ở trạng thái pending; payroll tạo và confirm outbound Gateway payments cho tối đa 25 thành viên hợp lệ của một contact group đã chọn rõ ràng."
  - "Payroll chụp recipient snapshot có fingerprint, hiện tổng chính xác trước execution, rồi giữ success hoặc failure theo từng item và toàn batch."
---

## Hai workflow ngược chiều

Payment request và payroll đều liên quan nhiều người, nhưng hướng tiền và quyền hạn khác nhau. `/request 25 from Minh on arc` tạo inbound request: requester muốn nhận 25 USDC. Nó không debit Minh. `/payroll run team 25 from base` chuẩn bị outbound payments: operator đang đăng nhập muốn gửi 25 USDC cho mỗi thành viên hợp lệ của group `team`.

Không dùng request làm bằng chứng payment đã xảy ra, và không dùng payroll khi mỗi recipient cần amount khác nhau. Command payroll hiện tại áp dụng một amount cho mọi contact được đưa vào.

## Tạo inbound request

Request command cần amount dương, payer label và destination chain. Payna dùng Circle SCA wallet của requester làm recipient address, lưu USDC, amount, destination, payer label, memo và status `pending`. Nếu payer name resolve được contact, request giữ liên kết contact đó; text không resolve được vẫn có thể là label.

Tạo record sẽ sinh public payment URL và QR image. Hành động này không tạo onchain transaction, không cần chữ ký payer và không thể tự rút tiền. Chia sẻ link qua kênh tin cậy và xác nhận riêng rằng destination address hiển thị thuộc requester.

## Payer review và request lifecycle

Payer đã đăng nhập mở link và thấy amount, token, destination chain, recipient address, memo và status hiện tại. Payer có thể nhập source chain; nếu bỏ trống, destination chain được dùng làm source mặc định. Chọn “Confirm and pay” sẽ chạy Circle Gateway transfer. Chỉ request `pending` mới có thể được trả.

Sau transfer thành công, Payna chuyển request sang `paid`, lưu payer và paid transaction hash, rồi ghi thời điểm hoàn tất. Payer và requester nhận notification liên quan. Data model còn nhận `cancelled` và `expired`, nhưng request page hiện chỉ cho payment—không có quản lý cancel hoặc expiry—nên không nên kỳ vọng các control đó trong version này.

## Chuẩn bị payroll recipient

Tạo group trong Contacts hoặc bằng `/contacts group create Team`, sau đó thêm contact bằng `/contacts group add Team Minh`. Payroll luôn yêu cầu một group name rõ ràng; không có fallback “toàn bộ contacts active”. Tối đa 25 thành viên có status `active`, địa chỉ EVM hợp lệ và destination chain đã lưu được đưa vào snapshot. Inactive hoặc địa chỉ không hợp lệ hiện là excluded; không làm batch fail nếu vẫn còn recipient hợp lệ.

Mỗi item snapshot contact ID, label, wallet address, preferred destination chain, common per-recipient amount và token USDC. Snapshot cũng có recipient fingerprint: nếu membership hoặc recipient hợp lệ đổi sau lúc review, Payna từ chối batch cũ, tạo preview mới 15 giây và bắt confirm lại.

Command flow hiện chưa có CSV upload control. Nếu team bắt đầu từ CSV, hãy validate ngoài Payna, rồi add và review contacts trước khi tạo batch. Kiểm tra tên bắt buộc, địa chỉ EVM đầy đủ, destination chain, dòng trùng, active status và identity internal hay external. Một spreadsheet row không ghi đè contact đã lưu trong Payna.

## Aggregate preview và confirmation

Trước confirmation, Payna load chính xác group đã chọn, giới hạn tập ở 25 và hiện recipient count, excluded count, per-recipient amount, aggregate total, source chain và danh sách recipient có thể mở rộng. Total exposure được tính bằng USDC six-decimal arithmetic, không bằng JavaScript floating point. Confirm button ghi aggregate USDC total và recipient count; nút bị disable khi preview đang load, không có recipient hợp lệ hoặc validation lỗi.

Kiểm tra group, source chain, per-recipient amount, aggregate total, excluded rows và Contacts directory. Confirmation authorize đúng snapshot đó, không tạo payroll policy không giới hạn.

## Execution và partial failure

Sau confirm, batch chuyển từ `draft` sang `running`. Payna xử lý item tuần tự qua Gateway bằng source chain của batch, destination và address đã lưu của từng item, cùng auto forwarding. Mỗi item đi qua `queued`, `running`, rồi `success` hoặc `failed`; item thành công lưu transaction reference, còn item lỗi lưu error.

Item đã thành công không rollback khi payment sau thất bại. Nếu item thứ 10 fail, item 11–25 vẫn tiếp tục theo thứ tự. Batch cuối cùng là `success`, `failed` hoặc `partial_failed` theo item result. Bản demo này không có retry tự động, queue, resume batch hay parallel processing. Vì vậy đừng chạy lại toàn command chỉ vì một recipient lỗi: trước tiên đối soát item nào đã chuyển tiền, rồi chỉ xử lý phần chưa trả.

## History và đối soát

Payna lưu batch thuộc user và các item, đồng thời tạo completion notification như “23/25 payroll payments succeeded.” Transaction Activity ghi các Gateway payment nền và explorer reference. Hãy đối soát ba lớp: final status của batch, status/error/hash của từng item, và trạng thái onchain hoặc Gateway transaction tương ứng.

Với request, giữ request ID, status và paid transaction hash. Với payroll, export hoặc ghi lại recipient snapshot trước execution và giữ completion notification. Success count trong chat là summary, không thay cho item-level reconciliation.

## Checklist an toàn

Chạy batch thử nhỏ trước. Xác nhận source balance, fee, destination chain, quyền sở hữu contact, dòng trùng và aggregate exposure. Coi QR code và request link là payment instruction có thể bị thay thế; kiểm tra URL và recipient trên trang. Không bao giờ đặt private key, seed phrase, bí mật nhân viên hoặc API credential vào memo, contact, CSV, batch name hay chat command.
