---
slug: "features/activity-and-notifications"
title: "Activity, history và notifications"
description: "Đối soát transaction receipt, lifecycle state, explorer link và operational alert."
section: "features"
order: 44
lastUpdated: "2026-08-05"
keywords: ["activity", "history", "notification", "status"]
tutorial: true
aiSummary:
  - "Activity tách transaction history khỏi notifications; dùng receipt và explorer link đúng chain để đối soát từng stage."
  - "Gateway finality notification chỉ được tạo sau khi settlement evidence đã xác minh cập nhật pending deposit; unread state hiện chỉ mang tính thông tin."
---

## Hai tab Activity

Trang `/activity` cần đăng nhập có tab Transactions và Notifications. Transactions là ledger view của onchain và Gateway work đã ghi. Notifications là inbox cho outcome và event cần chú ý. Dùng `/activity?tab=transactions` hoặc `/activity?tab=notifications` để deep-link đến tab; route cũ `/notifications` redirect sang notification tab.

Hai tab trả lời câu hỏi khác nhau. Notification nói một việc đã xảy ra hoặc cần chú ý. Transaction row cung cấp route, amount, state và explorer evidence. Với payment quan trọng, luôn đối soát trong Transactions dù inbox message trông như đã thành công.

## Transaction history

`/history` mở history từ chat, còn Activity có table hoặc mobile card. Search khớp hash, chain, type, status hoặc reason. Filter gồm transaction type và `success`, `failed`, `pending` hoặc `pending_gateway_finality`; sort ngày và pagination áp dụng trên history đã load.

Mỗi row hiển thị action, rail, route, amount, status, date và explorer link khi có primary hash. Reason có thể chứa failure context hoặc metadata. “No transactions found” cũng có thể do search hoặc filter.

## Chat receipt và proof link

Command receipt trong chat có thể giàu chi tiết hơn Activity row. CCTP bridge có thể có source-burn link trên source explorer và mint link trên destination explorer. Gateway transfer hoặc payment có thể hiện explicit deposit user đã yêu cầu, source allocation và destination mint hoặc forwarder transaction. Swap có thể gồm approval và swap detail.

Payna cũng có thể hiện “Payna proof” transaction trên Arc Testnet. Đây là application receipt riêng được ghi sau business action; nó không phải Circle attestation, không phải source payment và không thay cho kiểm tra destination delivery. Proof lỗi hoặc không có không được dùng làm lý do tạo duplicate payment.

## Pending, waiting và finalized

`pending` nghĩa recorded transaction chưa kết thúc. `pending_gateway_finality` hẹp hơn: Gateway deposit transaction đã tồn tại, nhưng Payna chưa chấp nhận evidence rằng balance đã available. Trong command execution progress, `queued`, `running`, `waiting_gateway`, `success` và `failed` mô tả các processing stage khác nhau.

Source transaction có thể thành công khi destination mint, forwarder action hoặc Gateway finality vẫn chưa xong. Chỉ coi final state liên quan là hoàn tất. Nếu lỗi xảy ra sau khi funds di chuyển, lifecycle đánh dấu finalization thay vì wallet approval; hãy điều tra trước khi retry.

## Notification inbox

Tab Notifications hiển thị tối đa 50 record non-archived mới nhất. Nó có text search và filter all, unread, waiting, failed. Các counter phía trên tổng hợp item unread, waiting/finality và failed/error. Notification có thể gồm payment đã nhận, request đã trả, payroll result, transaction failure và Gateway balance availability.

Storage có `unread`, `read` và `archived`, nhưng Activity UI hiện chưa có mark-read action. Vì vậy unread badge nghĩa record chưa được cập nhật thành `read`, không có nghĩa chưa ai điều tra. Pending Gateway notice có thể tự archive khi không còn deposit pending. Deep link từ từng notification đến command execution detail cũng chưa có.

## Gateway webhook và finality alert

Với Gateway deposit, Payna có thể nhận webhook `gateway.deposit.finalized` của Circle. Server xác minh chữ ký Circle, chỉ nhận environment và event type được cấu hình, đối chiếu transaction hash, domain, wallet và amount với pending deposit, rồi ghi event để xử lý duplicate an toàn. Chỉ sau đó app mới settle history row và tạo unread notification “Gateway balance is ready.”

Notification này là application view của settlement evidence đã xác minh, không phải chính webhook. Nếu webhook delivery chậm, authenticated sync path của Payna có thể kiểm tra pending deposit và đạt cùng stored settlement boundary. App refresh notification và balance theo chu kỳ, khi focus và sau settlement event; hãy reload Activity nếu list cũ.

## Deep link và quy tắc explorer

Chia sẻ Activity tab URL để điều hướng, nhưng chia sẻ transaction evidence bằng chain-specific explorer URL. Hash chỉ có ý nghĩa trên chain đi kèm. Với cross-chain work, gắn nhãn source, destination mint/forwarder và Arc proof riêng. Đừng dán hash vào explorer ngẫu nhiên rồi kết luận nó không tồn tại.

Vì execution-detail deep link chưa có, hãy giữ command time, amount, route, command name và hash cùng nhau khi escalation. Notification text có thể bỏ qua field cần thiết cho điều tra.

## Checklist đối soát

Xóa search và filter, xác định rail, so amount và route, mở mọi receipt link trên đúng explorer, rồi phân biệt submitted với finalized. Với bridge, giữ source và mint hash. Với Gateway deposit, chờ balance-ready event hoặc verified sync result. Không bao giờ đưa seed phrase, private key, password hoặc API credential vào notification search hay support message, và không retry chỉ vì proof hoặc inbox update đến chậm.
