# Môi Trường Và Triển Khai

## Supabase

Project: `paycmd`.

Migration chính:

```text
supabase/migrations/20260601000000_create_paycmd_core_tables.sql
```

Sau khi tạo project, áp migration bằng Supabase MCP hoặc Supabase CLI.

## Vercel

Deploy Next.js project lên Vercel. Các biến môi trường cần có:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
CIRCLE_API_KEY
CIRCLE_ENTITY_SECRET
CIRCLE_WALLET_SET_ID
NEXT_PUBLIC_PAYCMD_DEMO_MODE
```

## Circle

V1 giữ demo mode cho UI. Khi nối thật:

- Dùng Developer Controlled Wallets.
- Dùng Circle Gateway cho unified USDC flow.
- Ghi kết quả Gateway vào `command_executions.result`.
- Tạo notification sau khi command success hoặc failed.
