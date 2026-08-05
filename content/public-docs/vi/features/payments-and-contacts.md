---
slug: "features/payments-and-contacts"
title: "Pay và contacts"
description: "Resolve saved contact hoặc địa chỉ trực tiếp, preview hai chain và confirm USDC payment an toàn."
section: "features"
order: 41
lastUpdated: "2026-08-05"
keywords: ["pay", "contacts", "recipient", "preview"]
tutorial: true
aiSummary:
  - "Payment Payna cần amount, recipient, source chain và destination chain, rồi resolve người nhận và hiện confirmation preview trước khi chạy Gateway."
  - "Contact chỉ lưu identity và routing hint, không có quyền ký; luôn kiểm tra địa chỉ đã resolve và destination."
---

## Địa chỉ hay saved contact

`/pay` nhận địa chỉ EVM đầy đủ hoặc display name của saved contact. Địa chỉ trực tiếp phù hợp payment một lần và không tự thêm vào Contacts. Contact cung cấp label dễ nhớ, wallet address đã lưu, preferred chain, status và—khi Payna xác định được—liên kết đến một user Payna khác. Không loại nào giữ private key hay có thể authorize payment.

Dùng `/contacts list` để kiểm tra danh bạ. Dùng `/contacts add Minh 0x1111...1111 on arc` để lưu external wallet. Trong command thật, phải nhập đủ địa chỉ 42 ký tự; giá trị rút gọn ở đây chỉ để minh họa.

## Thêm và resolve contact

Khi địa chỉ thuộc một tài khoản Payna, app có thể resolve nó như internal contact và lấy Circle wallet hiện tại của user đó lúc thanh toán. Nhờ vậy, payment không chỉ dựa vào stored address cũ. Lệnh add chỉ có address có thể tự điền tên profile nội bộ. External wallet không tự điền được, nên cần display name.

Nếu display name đã tồn tại trong danh bạ, việc add lại sẽ cập nhật contact đó. `/pay` tìm contact theo display name không phân biệt hoa thường. Destination chain ghi trong command sẽ ghi đè preferred chain đã lưu; preference chỉ là routing hint, không phải cam kết cố định.

## Bắt buộc source và destination

Command parser của Payna yêu cầu cả hai đầu payment. Ví dụ: `/pay 25 to Minh on arc from base`. `from base` chọn source-scoped Gateway balance và `on arc` chọn destination network. Thiếu một trong hai thì draft chưa hoàn chỉnh, kể cả khi contact có preferred chain.

Payment này dùng Circle Gateway rail, không phải MetaMask CCTP. Payna có thể auto-deposit nguồn từ SCA wallet đủ điều kiện vào Gateway khi được cấu hình, nhưng không bao giờ coi Circle SCA wallet balance, Gateway balance và MetaMask balance là một.

## Preview trước khi confirm

Preview phải hiện amount và token, source network, destination network và recipient đã resolve. Nó còn xác định rail, rủi ro cross-chain hoặc recipient, destination gas mode, cùng fee hoặc wallet estimate khi có. Mở advanced details trước khi duyệt forwarding choice.

Confirmation label nhắc lại amount nhưng không thay cho việc kiểm tra địa chỉ đầy đủ. Với contact mới, đối chiếu địa chỉ qua kênh tin cậy thứ hai. Nếu destination hoặc recipient sai, hãy cancel và sửa draft. AI hiểu natural-language instruction không làm tiền di chuyển; user phải confirm execution rõ ràng.

## Điều xảy ra sau confirm

Payna resolve địa chỉ, validate hai chain và yêu cầu Gateway transfer đến destination. Manual destination mint có gas policy khác auto forwarding; hãy đọc preview thay vì giả định mọi route có fee giống nhau. Internal recipient có thể nhận notification Payna sau thành công. External wallet nhận funds onchain nhưng không tự có tài khoản Payna hoặc subscription notification.

Khi được bật, Payna ghi receipt proof riêng trên Arc Testnet sau payment. Proof ghi dữ liệu receipt ở tầng ứng dụng; nó không phải payment transaction, và lỗi ghi proof không phải lý do gửi payment lại.

## History và receipt

Receipt trong chat có thể hiện payment route, destination hoặc mint transaction, source auto-deposit transaction nếu có, forwarding transaction và Payna proof tùy chọn. Activity hiển thị transaction type nền, route, amount, state, date, reason và explorer link khi có hash. `/history` mở cùng tập operational record; dùng filter trong Activity để thu hẹp.

Submitted transaction có thể còn pending sau chat confirmation. Đối chiếu explorer chain với hash và chờ destination/finality stage liên quan trước khi kết luận người nhận đã được trả. Lưu receipt khi đối soát payment nghiệp vụ.

## Lỗi identity thường gặp

“Contact not found” nghĩa không saved display name nào khớp; hãy add contact hoặc dùng địa chỉ trực tiếp. “Invalid EVM wallet address” nghĩa format địa chỉ không hợp lệ. Lệnh add bắt buộc internal có thể trả `INTERNAL_WALLET_NOT_FOUND`; chỉ lưu named external contact sau khi xác nhận đó là chủ ý. Internal contact thiếu Circle wallet khả dụng không thể được trả như internal. Lookup service lỗi không chứng minh địa chỉ là external—hãy retry thay vì đổi identity type một cách mù quáng.

## Checklist an toàn

Xác minh amount, địa chỉ đầy đủ, source, destination và gas mode. Coi tên gần giống nhau là không đáng tin, giữ contact riêng cho các địa chỉ khác nhau có chủ ý và thử amount nhỏ với recipient lạ. Không bao giờ dán seed phrase, private key hoặc wallet recovery data vào contact hay command. Nếu kết quả mơ hồ, kiểm tra history và explorer trước khi retry; command trùng có thể tạo payment trùng.
