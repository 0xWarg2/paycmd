# Circle Gateway deposit finality webhook

Payna treats `gateway.deposit.finalized` as the authoritative completion signal for new Gateway
deposits. `/api/gateway/deposit/sync` remains a recovery path and requires both positive
`processedHeight` evidence and absence from Circle's pending-deposit list. The previous 90-second
heuristic remains only for rows created before `deposit_block_number` existed.

## Required server environment

```env
SUPABASE_SERVICE_ROLE_KEY=...
CIRCLE_API_KEY=...
CIRCLE_GATEWAY_WEBHOOK_ENABLED=true
CIRCLE_GATEWAY_ENVIRONMENT=TEST
CIRCLE_GATEWAY_WEBHOOK_URL=https://your-domain.example/api/webhooks/circle-gateway
CIRCLE_GATEWAY_DOMAINS=26,3,1,6,0,19,2,7,16,13,10,14
PAYCMD_DEFAULT_LOCALE=vi
```

Never expose the service-role or Circle API key through a `NEXT_PUBLIC_` variable.

## Rollout order

1. Apply `supabase/migrations/20260803020000_add_gateway_finality_tracking.sql`.
2. Deploy the application with the environment above.
3. Register the current SCA wallet addresses:

   ```bash
   npm run gateway:webhook:configure
   ```

4. Save the printed subscription ID as `CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID`. Future runs update
   that subscription instead of creating another one.
5. Re-run the configure command after onboarding new SCA wallets. Circle currently limits a
   developer account to 50 registered addresses; keep polling reconciliation enabled and request a
   higher limit before exceeding that threshold.

## Production website with Circle TEST

`https://heypayna.xyz` runs the public deployment while Gateway stays on Circle testnet. Production
must contain these Vercel environment variables:

```env
SUPABASE_SERVICE_ROLE_KEY=...
CIRCLE_API_KEY=...
CIRCLE_GATEWAY_WEBHOOK_ENABLED=true
CIRCLE_GATEWAY_ENVIRONMENT=TEST
CIRCLE_GATEWAY_WEBHOOK_URL=https://heypayna.xyz/api/webhooks/circle-gateway
CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID=<production-testnet-subscription-id>
CIRCLE_GATEWAY_DOMAINS=26,3,1,6,0,19,2,7,16,13,10,14
PAYCMD_DEFAULT_LOCALE=vi
```

The production subscription is separate from the ngrok/local subscription. Create it once after the
webhook route is live:

```bash
npm run gateway:webhook:configure
```

Store that ID in both Vercel Production and the GitHub Actions secret
`CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID`. The workflow
`.github/workflows/sync-circle-gateway-webhook.yml` runs after the current `main` commit reaches a
successful Vercel Production deployment. It waits for the webhook route, reads all current SCA
wallets from Supabase, and runs:

```bash
npm run gateway:webhook:update
```

Unlike `configure`, `update` fails if the subscription ID is missing and can never create a duplicate
subscription. The same workflow can be started manually from GitHub Actions for recovery. A failed
sync does not roll back the website; Gateway reconciliation polling remains the fallback.

## Chạy webhook trên local từ branch `dev`

Nếu worktree đang sạch và cần cập nhật code mới nhất từ `dev`:

```bash
git switch dev
git pull --ff-only origin dev
npm install
```

Đảm bảo `.env.local` có các biến server cần thiết. Không commit hoặc chia sẻ giá trị secret:

```env
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-or-secret-key>
CIRCLE_API_KEY=<circle-testnet-api-key>
CIRCLE_GATEWAY_WEBHOOK_ENABLED=true
CIRCLE_GATEWAY_ENVIRONMENT=TEST
CIRCLE_GATEWAY_WEBHOOK_URL=https://unlimited-doily-previous.ngrok-free.dev/api/webhooks/circle-gateway
CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID=376359b3-d5db-4264-af6b-204f7099bc8d
CIRCLE_GATEWAY_DOMAINS=26,3,1,6,0,19,2,7,16,13,10,14
PAYCMD_DEFAULT_LOCALE=vi
```

Chạy ba terminal riêng biệt.

Terminal 1 — khởi động Next.js:

```bash
npm run dev
```

Terminal 2 — public hóa port 3000 cho Circle:

```bash
ngrok http 3000
```

Kiểm tra URL ngrok hiện tại:

```bash
curl -sS http://127.0.0.1:4040/api/tunnels \
  | jq -r '.tunnels[] | "\(.public_url) -> \(.config.addr)"'
```

Nếu URL khác `CIRCLE_GATEWAY_WEBHOOK_URL`, sửa `.env.local`, restart `npm run dev`, rồi mới thực
hiện bước tiếp theo.

Terminal 3 — đọc toàn bộ SCA hiện tại từ Supabase và PATCH subscription Circle:

```bash
npm run gateway:webhook:configure
```

Kết quả hợp lệ có dạng:

```text
Circle Gateway webhook subscription ready: <subscription-id>
Registered <sca-count> SCA addresses across 12 domains.
```

Nếu tạo subscription lần đầu, lưu ID được in ra vào
`CIRCLE_GATEWAY_WEBHOOK_SUBSCRIPTION_ID`, restart Next.js, rồi chạy lại lệnh configure. Khi có SCA
mới, chạy lại cùng lệnh để thay toàn bộ danh sách address trên subscription hiện tại.

Kiểm tra endpoint public và request Circle:

```bash
curl -sS -o /dev/null -w 'Local: HTTP %{http_code}\n' http://127.0.0.1:3000
curl -sS -o /dev/null -w 'Public: HTTP %{http_code}\n' \
  https://unlimited-doily-previous.ngrok-free.dev
```

Mở trang inspector để xem Circle gọi `POST /api/webhooks/circle-gateway`:

```text
http://127.0.0.1:4040
```

Sau khi configure, một request `webhooks.test` phải nhận HTTP `200`. Để test toàn bộ luồng, thực
hiện deposit USDC testnet bằng một SCA đã đăng ký và quan sát:

```text
pending_gateway_finality
→ Circle gateway.deposit.finalized
→ webhook HTTP 200
→ transaction_history.status = success
→ Supabase Realtime
→ UI Complete
```

`npm run dev` và ngrok là hai process độc lập. Restart Next.js không đổi URL ngrok; nếu ngrok không
chạy thì Circle không thể gọi vào localhost.

## Verification

Deposit on Arc Testnet and Base Sepolia and confirm:

- `transaction_history.status` changes from `pending_gateway_finality` to `success`;
- `finality_source` is `circle_webhook` under normal delivery;
- `gateway_finalized_at` and `circle_notification_id` are populated;
- the open chat card changes to Completed through Supabase Realtime without a reload;
- replaying the same notification does not create a second completion notification;
- disabling the subscription still allows reconciliation to complete from `processedHeight`.
