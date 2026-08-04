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

Ra dùng Vercel Git Integration để deploy tự động từ GitHub.

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

Biến môi trường AI:

```text
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_COMMAND_MODEL=deepseek-v4-flash
DEEPSEEK_INSTANT_MODEL=deepseek-v4-flash
DEEPSEEK_STANDARD_MODEL=deepseek-v4-flash
DEEPSEEK_DEEP_MODEL=deepseek-v4-pro
DEEPSEEK_RESEARCH_TIMEOUT_MS=240000
DEEPSEEK_QUOTA_ENABLED=false
TAVILY_API_KEY=<rotated-server-only-key>
```

`TAVILY_API_KEY` chỉ được dùng server-side bởi AskPayna. Không thêm prefix `NEXT_PUBLIC_`, không commit key và không dùng lại key từng xuất hiện trong chat/log. Nếu key bị lộ, revoke trên Tavily, tạo key mới, cập nhật local/Vercel rồi redeploy.

`DEEPSEEK_QUOTA_ENABLED=false` là mặc định trong giai đoạn test: mọi user đã đăng nhập dùng AI không giới hạn. Sau khi chạy migration `20260803000000_add_deepseek_quota_and_whitelist.sql`, bật giá trị này thành `true` để áp dụng 10 request DeepSeek trọn đời cho mỗi user thường. Các user trong `ai_user_whitelist` không bị trừ quota; usage đã dùng trước khi được whitelist vẫn giữ nguyên nếu sau đó bị gỡ khỏi whitelist.

Không cấp quyền ghi bảng whitelist cho trình duyệt. Admin thêm/gỡ Access ID (UUID hiển thị trong Profile) bằng Supabase SQL Editor với quyền database admin hoặc một server dùng `service_role`:

```sql
insert into public.ai_user_whitelist (user_id, note)
values ('<payna-access-id>', 'test team')
on conflict (user_id) do nothing;

delete from public.ai_user_whitelist
where user_id = '<payna-access-id>';
```

RLS cùng `revoke` chặn `anon` và `authenticated` đọc/ghi trực tiếp hai bảng quota. Client chỉ gọi RPC gắn với `auth.uid()`; RPC không nhận `user_id`, nên biết tên bảng hay UUID người khác không thể tự thêm whitelist hoặc sửa quota.

DeepSeek chạy cả hai đường AI. Command router route câu tự nhiên trong mode `Ra` thành command hoặc intent `crypto_research`. Khi user chọn mode research, câu hỏi không bắt đầu bằng `/` đi thẳng tới `/api/ai/crypto` để tránh route nhầm. Slash command luôn chạy Ra.

AskPayna không còn dựa vào Surf. Trước khi gọi DeepSeek, knowledge router chọn nguồn phù hợp:

- Tutorial `content/payna-tutorial.json` cho hướng dẫn Hey Payna.
- Circle MCP tại `https://api.circle.com/v1/codegen/mcp` cho USDC, CCTP, Gateway, Wallets và sản phẩm Circle.
- Arc MCP tại `https://docs.arc.io/mcp` cho blockchain Arc, RPC và triển khai contract.
- Tavily Search cho Web3/L1/L2/protocol hoặc thông tin cần tính thời sự.

Circle và Arc MCP chỉ chạy song song khi câu hỏi giao nhau, ví dụ `Circle Gateway trên Arc`. Tavily dùng `search_depth=basic`, tối đa 5 kết quả thô; DeepSeek tổng hợp context và không được tự tạo citation URL. Nếu một nguồn lỗi, response có grounding `partial`; nếu không có nguồn nào dùng được thì response ghi `unavailable`.

DeepSeek chỉ có đúng hai model: `deepseek-v4-flash` và `deepseek-v4-pro`. Reasoning (`reasoning_content`) **bật sẵn** trên cả hai, và token reasoning **rút từ chính `max_tokens`** — cùng budget với câu trả lời. Vì vậy các profile map như sau:

- Command router: flash, **thinking tắt** (`thinking: {type: "disabled"}`), `max_tokens` 900, timeout 25 giây. Tắt thinking là bắt buộc: nếu bật, chain-of-thought có thể ăn hết budget làm JSON bị cắt, zod fail, và route âm thầm rơi về `deterministicCommandFallback` với HTTP 200.
- `Instant`: flash, thinking tắt, `max_tokens` 2.200, timeout 60 giây.
- `Research / Standard`: flash, thinking bật, `max_tokens` 7.000, timeout theo `DEEPSEEK_RESEARCH_TIMEOUT_MS` mặc định 240 giây.
- `Research / Deep`: pro, thinking bật, `max_tokens` 12.000, timeout theo `DEEPSEEK_RESEARCH_TIMEOUT_MS` mặc định 240 giây.

DeepSeek **không hỗ trợ** `response_format: {type: "json_schema"}` (trả 400 `"This response_format type is unavailable now"`). Command router dùng `json_object`, nên zod schema trong `lib/paycmd/ai/schema.ts` là thứ duy nhất validate shape.

Chuỗi timeout phải giữ đúng thứ tự `server < client < platform`: research 240s (server) < 270s (client abort) < 300s (`maxDuration` của `/api/ai/crypto`). Command route export `maxDuration = 60` để platform không giết handler trước khi fallback kịp chạy.

Giá DeepSeek **nhân đôi** trong giờ cao điểm Bắc Kinh 09:00–12:00 và 14:00–18:00 (UTC+8). Muốn hạ chi phí giờ cao điểm mà không cần deploy, trỏ `DEEPSEEK_DEEP_MODEL` sang `deepseek-v4-flash`.

`vercel.json` đang ép Vercel dùng `npm install --legacy-peer-deps` để khớp cách cài local của project.

## GitHub Actions

Workflow `.github/workflows/ci.yml` chạy trên `dev`, `main` và pull request vào hai branch này:

- `npm ci --legacy-peer-deps`
- `npm run lint`
- `npm test`
- `npm run tutorial:validate`
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
