# Môi Trường Và Triển Khai

## Supabase

Project: `paycmd`.

Migration chính:

```text
supabase/migrations/20260601000000_create_paycmd_core_tables.sql
supabase/migrations/20260601010000_create_chat_history_tables.sql
```

Sau khi tạo project, áp migration bằng Supabase MCP hoặc Supabase CLI.

## Vercel

PayCMD dùng Vercel Git Integration để deploy tự động từ GitHub.

- Vercel project: `paycmd`.
- Vercel project id: `prj_OoE5yuJ12FN6WjdRsHAoeObaPNSh`.
- Production URL hiện tại: `https://paycmd.vercel.app`.
- Deployment đầu tiên đã được tạo bằng Vercel CLI từ branch `dev`.
- Branch phát triển: `dev`.
- Branch production: `main`.
- Pull request từ `dev` sang `main` tạo preview deployment.
- Khi merge vào `main`, Vercel tự deploy production.
- GitHub Actions chỉ chạy lint/build, không deploy để tránh double deploy.

Các bước cấu hình lần đầu:

1. Vào Vercel, import GitHub repo `0xWarg2/paycmd`.
2. Chọn framework `Next.js`.
3. Chọn production branch là `main`.
4. Thêm environment variables bên dưới cho cả Preview và Production.
5. Sau khi có domain Vercel, thêm URL đó vào Supabase Auth redirect URLs.

Trạng thái hiện tại:

- Đã tạo Vercel project.
- Đã set environment variables demo trên Vercel.
- Đã deploy production thành công lên `https://paycmd.vercel.app`.
- Chưa connect GitHub repo vào Vercel Git Integration vì Vercel báo tài khoản/token chưa có quyền truy cập GitHub repo qua Vercel GitHub App. Cần vào Vercel UI và cấp quyền GitHub App cho repo `0xWarg2/paycmd`, sau đó connect project `paycmd` với repo này.

Biến môi trường bắt buộc cho demo:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_PAYCMD_DEMO_MODE=true
```

Biến môi trường dùng khi nối Circle Gateway thật:

```text
CIRCLE_API_KEY
CIRCLE_ENTITY_SECRET
CIRCLE_WALLET_SET_ID
```

`vercel.json` đang ép Vercel dùng `npm install --legacy-peer-deps` để khớp cách cài local của project.

## GitHub Actions

Workflow `.github/workflows/ci.yml` chạy trên `dev`, `main` và pull request vào hai branch này:

- `npm ci --legacy-peer-deps`
- `npm run lint`
- `npm run build`

Trong GitHub repo, cần thêm các repository secrets:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Không lưu Circle secret trong code. Khi nối payment thật, thêm Circle secret trong Vercel Environment Variables và GitHub Actions secrets nếu CI cần build phần server phụ thuộc secret.

## Supabase Auth Redirect

Khi chạy local:

```text
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

Khi deploy Vercel:

```text
https://<vercel-domain>/auth/callback
```

Nếu sau này gắn custom domain thì thêm callback URL của custom domain vào Supabase.

## Circle

V1 giữ demo mode cho UI. Khi nối thật:

- Dùng Developer Controlled Wallets.
- Dùng Circle Gateway cho unified USDC flow.
- Ghi kết quả Gateway vào `command_executions.result`.
- Tạo notification sau khi command success hoặc failed.
