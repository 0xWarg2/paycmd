# Bàn Giao Dự Án

## Tên Và Định Vị

Tên sản phẩm: **PayCMD**.

Định vị: **Command layer for stablecoin payments**.

PayCMD giúp người dùng vận hành thanh toán stablecoin bằng chat và slash command thay vì mở ví, sao chép địa chỉ, ký từng giao dịch, tự theo dõi ngân sách và tự quản lý lịch trả tiền.

## Trạng Thái V1

V1 là demo DApp chatbox-first:

- Nhập lệnh `/pay`, `/createbudget`, `/schedule`.
- Assistant hỏi lại khi thiếu dữ liệu.
- Luôn có preview trước khi execute.
- Confirm xong command chạy bất đồng bộ.
- Notification báo kết quả sau.

## Công Nghệ

- Next.js + TypeScript
- Supabase
- Circle Gateway
- Arc Testnet
- Vercel

V1 không dùng Redis, queue riêng hoặc backend Go/Gin.
