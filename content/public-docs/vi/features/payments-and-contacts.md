---
slug: "features/payments-and-contacts"
title: "Pay và contacts"
description: "Resolve saved contact hoặc địa chỉ trực tiếp, preview hai chain và confirm USDC payment an toàn."
section: "features"
order: 41
lastUpdated: "2026-08-07"
keywords: ["pay", "contacts", "recipient", "preview", "50 giây", "AskPayna"]
tutorial: true
aiSummary:
  - "Payment Payna cần amount, recipient, source chain và destination chain, rồi hiện confirmation preview 50 giây trước khi chạy Gateway."
  - "AskPayna không biến /pay hay transfer-like text thành preview; hãy chuyển sang Payna rồi submit lại tại đó để chuẩn bị payment."
  - "Contact chỉ lưu identity và routing hint, không có quyền ký; luôn kiểm tra địa chỉ đã resolve và destination."
  - "Payna hiểu các imperative contact-group rõ ràng bằng tiếng Việt/Anh, nhưng không biến câu hỏi về group thành hành động."
---

## Địa chỉ hay saved contact

`/pay` nhận địa chỉ EVM đầy đủ hoặc display name của saved contact. Địa chỉ trực tiếp phù hợp payment một lần và không tự thêm vào Contacts. Contact cung cấp label dễ nhớ, wallet address đã lưu, preferred chain, status và—khi Payna xác định được—liên kết đến một user Payna khác. Không loại nào giữ private key hay có thể authorize payment.

Dùng `/contacts list` để kiểm tra danh bạ. Dùng `/contacts add Minh 0x1111...1111 on arc` để lưu external wallet. Trong command thật, phải nhập đủ địa chỉ 42 ký tự; giá trị rút gọn ở đây chỉ để minh họa.

## Thêm và resolve contact

Khi địa chỉ thuộc một tài khoản Payna, app có thể resolve nó như internal contact và lấy Circle wallet hiện tại của user đó lúc thanh toán. Nhờ vậy, payment không chỉ dựa vào stored address cũ. Lệnh add chỉ có address có thể tự điền tên profile nội bộ. External wallet không tự điền được, nên cần display name.

Nếu display name đã tồn tại trong danh bạ, việc add lại sẽ cập nhật contact đó. `/pay` tìm contact theo display name không phân biệt hoa thường. Destination chain ghi trong command sẽ ghi đè preferred chain đã lưu; preference chỉ là routing hint, không phải cam kết cố định.

## Nhóm contact qua chat

Bạn có thể quản lý nhóm bằng slash command: `/contacts group create Core Team`, `/contacts group list`, `/contacts group add Core Team Minh`, `/contacts group remove Core Team Minh`, và `/contacts group delete Core Team`. Xóa group chỉ xóa membership; contact trong directory vẫn còn.

Trong Payna mode, AI cũng route các yêu cầu mệnh lệnh rõ ràng như “Tạo nhóm Core Team”, “thêm Minh vào nhóm Core Team”, “Xóa Lan khỏi nhóm Core Team”, hoặc “delete group Core Team” vào đúng command trên. AI chỉ nhận diện action khi câu yêu cầu rõ ràng; câu hỏi như “Làm sao tạo nhóm?” vẫn là câu hỏi, không tạo hoặc sửa group.

## Bắt buộc source và destination

Command parser của Payna yêu cầu destination và một named source hoặc Unified Gateway. Ví dụ, `/pay 25 to Minh on arc from base` chọn source-scoped balance trên Base, còn `/pay 25 to Minh on arc from gateway` mở multi-source preview bằng `BurnIntentSet`. Preferred chain của contact chỉ là routing hint.

Payment này dùng Circle Gateway rail, không phải MetaMask CCTP. Nếu scoped ready balance thiếu, Payna yêu cầu user chọn explicit minimum deposit hoặc unified ready-balance quote. App không auto-deposit và không bao giờ coi Circle SCA wallet balance, Gateway balance và MetaMask balance là một.

## Preview trước khi confirm

Preview phải hiện amount và token, source network, destination network, recipient đã resolve, rail, gas mode và fee estimate khi có.

Mọi transaction preview đều có lease chính xác 50 giây. Chỉ confirm trong cửa sổ đó sau khi đã kiểm tra mọi field. Khi preview hết hạn, Payna disable confirmation, cancel preview với lý do expired và yêu cầu user submit lại command để lấy preview mới. Callback confirm cũ không thể execute, và sửa card cũ không kéo dài lease.

Confirmation label nhắc lại amount nhưng không thay cho việc kiểm tra địa chỉ đầy đủ. Với contact mới, đối chiếu địa chỉ qua kênh tin cậy thứ hai. Nếu destination hoặc recipient sai, hãy cancel và sửa draft.

AskPayna vẫn không thực thi kể cả với `/pay 50 USDC to Minh on arc from base` hay transfer-like prose. Mode này không bao giờ parse, render, confirm hay execute payment preview. Phần giải thích có thể hiện **Chuyển sang Payna**; action đó chỉ đổi mode và prefill text. User vẫn phải submit trong Payna để tạo preview 50 giây mới.

## Điều xảy ra sau confirm

Payna resolve địa chỉ, validate hai chain và yêu cầu Gateway transfer đến destination. Manual destination mint có gas policy khác auto forwarding; hãy đọc preview thay vì giả định mọi route có fee giống nhau. Internal recipient có thể nhận notification Payna sau thành công. External wallet nhận funds onchain nhưng không tự có tài khoản Payna hoặc subscription notification.

Khi được bật, Payna ghi receipt proof riêng trên Arc Testnet. Proof không phải payment transaction; lỗi ghi proof không phải lý do gửi lại.

## History và receipt

Receipt trong chat hiện route, source allocation, transaction liên quan và Payna proof tùy chọn. Activity hiển thị amount, state, date, reason và explorer link. `/history` mở cùng tập record.

Submitted transaction có thể còn pending sau chat confirmation. Đối chiếu explorer chain với hash và chờ destination/finality stage liên quan trước khi kết luận người nhận đã được trả. Lưu receipt khi đối soát payment nghiệp vụ.

## Lỗi identity thường gặp

“Contact not found” nghĩa không có saved display name khớp; hãy add contact hoặc dùng địa chỉ trực tiếp. “Invalid EVM wallet address” nghĩa địa chỉ sai format. `INTERNAL_WALLET_NOT_FOUND` cho biết internal contact chưa có Circle wallet. Lookup lỗi không chứng minh địa chỉ là external—hãy retry thay vì đổi identity type.

## Checklist an toàn

Xác minh amount, địa chỉ đầy đủ, source, destination và gas mode. Coi tên gần giống nhau là không đáng tin, giữ contact riêng cho các địa chỉ khác nhau có chủ ý và thử amount nhỏ với recipient lạ. Không bao giờ dán seed phrase, private key hoặc wallet recovery data vào contact hay command. Nếu kết quả mơ hồ, kiểm tra history và explorer trước khi retry; command trùng có thể tạo payment trùng.
