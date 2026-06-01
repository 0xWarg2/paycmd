# PayCMD

**PayCMD** là DApp chatbox-first cho agentic stablecoin payments. V1 dùng Arc Testnet, Circle Gateway và USDC để demo các lệnh tài chính như thanh toán, tạo ngân sách và lên lịch trả tiền cho contributor.

## Lệnh MVP

```text
/pay 50 USDC to Minh
/createbudget Marketing 500
/schedule 25 USDC monthly to Minh
```

Mọi payment command đi qua luồng `parse -> preview -> confirm -> async execution -> notification`.

## Stack

- Next.js + TypeScript
- Supabase Auth/Postgres
- Circle Developer Controlled Wallets + Circle Gateway
- Arc Testnet
- Vercel

## Chạy Local

```bash
npm install --legacy-peer-deps
npm run dev
```

Mở `http://localhost:3000`. App có demo mode nên vẫn chạy được khi chưa có Circle secrets.

## Biến Môi Trường

Sao chép `.env.example` thành `.env.local` và điền các biến cần thiết.

## Tài Liệu

Tài liệu bàn giao tiếng Việt nằm trong `docs/`.

## Nguồn Gốc

PayCMD được khởi tạo từ sample [`circlefin/arc-multichain-wallet`](https://github.com/circlefin/arc-multichain-wallet) và giữ lại nền Circle/Supabase để mở rộng Gateway flow.
