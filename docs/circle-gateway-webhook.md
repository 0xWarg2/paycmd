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
CIRCLE_GATEWAY_DOMAINS=26,3,1,6,0,19,2,7,10,5,12,13
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

## Verification

Deposit on Arc Testnet and Base Sepolia and confirm:

- `transaction_history.status` changes from `pending_gateway_finality` to `success`;
- `finality_source` is `circle_webhook` under normal delivery;
- `gateway_finalized_at` and `circle_notification_id` are populated;
- the open chat card changes to Completed through Supabase Realtime without a reload;
- replaying the same notification does not create a second completion notification;
- disabling the subscription still allows reconciliation to complete from `processedHeight`.
