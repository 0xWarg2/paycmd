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

## Danh tính payment và rail

Contacts resolve identity; `/pay` và payroll chuyển Gateway USDC; request tạo payment instruction. Saved label không thay việc kiểm tra address và destination. Đọc [payments và contacts](/docs/features/payments-and-contacts) cùng [lifecycle request/payroll](/docs/features/payment-requests-and-payroll).

## `/contacts`

- **Mục đích:** List recipient hoặc add/update EVM recipient nội bộ hay external; contact không giữ key hoặc authorize payment.
- **Syntax và variants:** `/contacts list`; `/contacts add <name> <0x-address> on <chain>`; hoặc add chỉ address cho internal Payna wallet resolve được.
- **Ví dụ:** `/contacts add Minh 0x1111111111111111111111111111111111111111 on arc`; natural language: “Lưu address này là Minh.”
- **Điều kiện:** Đăng nhập, dùng full address hợp lệ và cung cấp name cho external wallet. Chain chỉ là routing preference.
- **Preview:** Không có transaction preview; review action, profile đã resolve hoặc name đã nhập, full address, preferred chain và phân loại internal/external.
- **Ranh giới confirm:** Không có onchain confirm. Command đọc hoặc ghi directory ngay và không thể spend funds.
- **Kết quả và dữ liệu lưu:** List trả contacts thuộc user. Add insert hoặc update row `contacts` với display name, wallet, chain, status và optional internal-user link.
- **Lỗi và cách sửa:** **“Invalid EVM wallet address”**: sửa đủ address 42 ký tự. **`INTERNAL_WALLET_NOT_FOUND`**: thêm display name và chỉ lưu external sau khi verify. **“external name required”**: thêm `<name>`.

## `/pay`

- **Mục đích:** Gửi USDC từ một scoped Gateway domain hoặc unified allocation đã chọn rõ tới contact/address được resolve.
- **Syntax và variants:** `/pay <amount> [USDC] to <recipient> on <destination> from <source> [manual]`; dùng `from gateway` cho BurnIntentSet allocation.
- **Ví dụ:** `/pay 25 to Minh on arc from base`; nếu Base thiếu, chọn minimum deposit hoặc bảng unified source. `/pay 25 to Minh on arc from gateway` vào unified ngay.
- **Điều kiện:** Recipient resolve được, signed quote hợp lệ, confirmed capacity sau fee reserve và destination gas chỉ khi Manual mint không được sponsor.
- **Preview:** Verify recipient, destination, mint mode, từng source allocation, total estimated fee, maximum reserve/debit, exclusion và quote fingerprint. Không auto-deposit.
- **Ranh giới confirm:** Deposit là confirmation riêng. Final payment confirmation yêu cầu Circle SCA ký Burn Intent trực tiếp bằng ERC-1271; MetaMask không ký.
- **Kết quả và dữ liệu lưu:** Response gồm recipient resolution, một transfer ID, source allocation, settled fee, history ID, destination explorer/proof link và notification.
- **Lỗi và cách sửa:** **“Contact not found”**: add contact hoặc dùng full address. **`GATEWAY_INSUFFICIENT_SCOPED_BALANCE`**: chọn deposit hoặc unified. **`GATEWAY_QUOTE_EXPIRED`**: review lại. **`INSUFFICIENT_GAS`**: nạp SCA được nêu hoặc chọn forwarding.

## `/request`

- **Mục đích:** Tạo request chia sẻ để người khác trả USDC vào SCA của bạn; không tự debit payer.
- **Syntax và variants:** `/request <amount> [USDC] from <payer> on <destination-chain>`.
- **Ví dụ:** `/request 25 from Minh on arc`; natural language: “Yêu cầu Minh trả 25 USDC trên Arc.”
- **Điều kiện:** Đăng nhập, tạo SCA, cung cấp positive amount, payer label/contact và destination được hỗ trợ.
- **Preview:** Không có money-movement card; review payer label, amount/token, destination và full recipient SCA của bạn trước khi share.
- **Ranh giới confirm:** Tạo request không cần blockchain signature. Payer sau đó review và authorize payment riêng trên request page.
- **Kết quả và dữ liệu lưu:** Payna lưu `payment_requests` ở `pending` với requester, payer contact, amount, chain, recipient, memo; rồi trả request URL và QR image URL.
- **Lỗi và cách sửa:** **“amount and payer are required”**: thêm positive amount và payer. **“Create your wallet first with /wallet create”**: provision SCA nhận tiền. Payer không resolve vẫn được giữ dạng label; verify identity trước khi share.

## `/payroll`

- **Mục đích:** Snapshot tối đa 25 active contacts; `run` chạy Gateway payment cho mỗi item.
- **Syntax và variants:** `/payroll create <name> <amount> [from <source>]` lưu; `/payroll run <name> <amount> [from <source>]` tạo và execute. Source mặc định Arc; amount tính mỗi contact.
- **Ví dụ:** `/payroll run august 25 from base`; natural language: “Trả active contacts 25 USDC từ Base.”
- **Điều kiện:** Active contacts có route đã verify và source-scoped Gateway liquidity đủ total cộng fees.
- **Preview:** Payna chỉ hiện active-recipient count và aggregate total được tính—không có name, address, destination hay snapshot. Load lỗi hoặc zero recipient khóa confirm.
- **Ranh giới confirm:** Confirm authorize batch từ active contacts fetch sau đó; count/total không phải approval list và có thể đổi. `run` dùng Gateway-signer attempt tuần tự—không phải MetaMask hay atomic transaction.
- **Kết quả và dữ liệu lưu:** `payroll_batches` lưu `draft/running/success/failed/partial_failed`; items lưu recipient, amount, status và hash/error. Notification tổng kết.
- **Lỗi và cách sửa:** **“No active contacts found for payroll”**: add/activate recipient. **“Payroll batch not found”**: mở đúng batch thuộc user. Với **`partial_failed`**, reconcile item hash và chỉ retry recipient chưa nhận—không chạy lại toàn batch mù quáng.
