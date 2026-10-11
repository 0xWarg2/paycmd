# HeyPayna

**HeyPayna** là DApp chatbox-first cho agentic stablecoin payments. Phiên Circle/Gateway tại `/app` dùng testnet. Luồng ví tại `/pay` hỗ trợ chuyển USDC cùng mạng Arc mainnet/testnet bằng MetaMask, với mạng riêng, preview và xác minh receipt; mainnet mặc định tắt cho đến khi migration và deployment được kiểm tra.

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

## Deploy

Project deploy bằng Vercel Git Integration. Dùng `dev` để phát triển và preview, merge vào `main` để Vercel tự deploy production. GitHub Actions chỉ chạy lint/build.

## Biến Môi Trường

Sao chép `.env.example` thành `.env.local` và điền các biến cần thiết.

## Tài Liệu

Tài liệu bàn giao tiếng Việt nằm trong `docs/`.

## Nguồn Gốc

Ra được khởi tạo từ sample [`circlefin/arc-multichain-wallet`](https://github.com/circlefin/arc-multichain-wallet) và giữ lại nền Circle/Supabase để mở rộng Gateway flow.

## Arc wallet payments

Mở `/pay`, đăng nhập và kết nối MetaMask. Ví phải có USDC trên mạng đã chọn cho cả khoản chuyển và gas.

```text
/pay 0.000001 USDC to <địa chỉ ví nhận> on arc-mainnet
```

Apply `supabase/migrations/20261012000000_add_arc_wallet_payments.sql`, cấu hình server `SUPABASE_SERVICE_ROLE_KEY`, rồi bật `ARC_MAINNET_PAYMENTS_ENABLED=true` trên môi trường đã kiểm tra. Giữ `ARC_NETWORK=testnet` cho các rail Circle/swap hiện có. Mainnet wallet RPC riêng là `https://rpc.mainnet.arc.io`, chain ID `5042`, explorer `https://explorer.arc.io`.

Kiến trúc: `/pay` → `/api/arc-payments` tạo preview lưu trong ledger riêng → ownership signature + xác nhận atomic → MetaMask ký/gửi ERC-20 transfer → lưu hash → server kiểm tra transaction/receipt/Transfer event → lịch sử theo mạng. Chỉ server được ghi ledger; RLS giới hạn quyền đọc theo user. USDC ERC-20 dùng 6 decimals; gas native dùng 18 decimals và chia sẻ cùng số dư USDC. Không cần receipt-registry contract hay private key người dùng trên server.

Gateway, bridge, swap và schedules vẫn thuộc testnet. Metrics cũ là hoạt động testnet; USDC moved không phải doanh thu. Hash mainnet và testnet có explorer và lịch sử riêng.

```bash
npm test
npm run lint
npm run build
ARC_MAINNET_PAYMENTS_ENABLED=true npx playwright test tests/ui/arc-wallet-payments.spec.ts --project=desktop-1440 --project=mobile-390 --workers=2
```

Kiểm thử UI dùng API/ví giả lập, không chuyển tiền. Xem [runbook phát hành và rollback](docs/plans/2026-10-12-arc-mainnet-release-runbook.md) và [hồ sơ Microgrants đang chuẩn bị](docs/plans/2026-10-12-arc-microgrants-submission-draft.md) để biết các gate còn thiếu và cách reviewer kiểm tra thực tế.
