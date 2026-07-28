# Payment Copilot MVP

Ra V1 mở rộng từ Gateway command console sang USDC payment copilot. Scope hiện tại là Circle-first: user đăng nhập, tạo Circle Developer-Controlled Wallet, fund wallet bằng testnet USDC/gas, rồi dùng chat command để trả tiền, tạo payment request hoặc chạy payroll batch.

## Commands

- `/contacts add Minh 0x... on arc`: lưu contact để resolve tên sang wallet address và preferred chain.
- `/pay 25 to Minh on arc from base`: chuyển USDC cho contact hoặc địa chỉ ví ngoài. API dùng `/api/payments/pay`, resolve contact rồi gọi lại `/api/gateway/transfer` với `recipientAddress`.
- `/request 25 from Minh on arc`: tạo payment request link `/pay/request/:id` và QR image URL. Người trả mở link, login, preview và confirm.
- `/payroll run team 25 from base`: tạo payroll batch từ active contacts và chạy tuần tự từng item qua Circle Gateway transfer.

## Data

- `contacts`: danh bạ người nhận, có `wallet_address` và `preferred_chain`.
- `payment_requests`: request thanh toán từ A tới B, trạng thái `pending|paid|cancelled|expired`.
- `payroll_batches` và `payroll_items`: batch payroll và trạng thái từng người nhận.
- `notifications`: kết quả payment/request/payroll cho user hiện tại.

## Runtime Flow

Ra không tự custody tiền ngoài chain. Tiền nằm ở Circle wallet address trên từng testnet chain. Khi user confirm payment, Ra backend gọi Circle Gateway transfer flow hiện có: check balance, auto-deposit nếu cần, ký burn intent, lấy attestation, mint/receive ở destination chain, rồi lưu history/notification.

## Limitations

- V1 chưa dùng MetaMask-first. User cần fund Ra/Circle wallet.
- Payroll chạy tuần tự trong request để demo nhanh, chưa có queue/cron.
- QR dùng link request và external QR image URL; payment source of truth vẫn là `payment_requests`.
- Notification cho requester khi B trả request cần service-role hoặc worker ở bản sau; hiện route ghi notification cho payer.
