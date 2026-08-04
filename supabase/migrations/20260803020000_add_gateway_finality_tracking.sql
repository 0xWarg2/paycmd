alter table public.transaction_history
  add column if not exists deposit_block_number bigint,
  add column if not exists gateway_finalized_at timestamptz,
  add column if not exists finality_source text,
  add column if not exists circle_notification_id text;

alter table public.transaction_history
  drop constraint if exists transaction_history_finality_source_check;

alter table public.transaction_history
  add constraint transaction_history_finality_source_check
  check (
    finality_source is null
    or finality_source in ('circle_webhook', 'circle_reconciliation', 'legacy_timeout')
  );

create index if not exists transaction_history_deposit_tx_hash_lower_idx
  on public.transaction_history (lower(tx_hash))
  where tx_type = 'deposit' and tx_hash is not null;

create table if not exists public.circle_gateway_webhook_events (
  notification_id text primary key,
  notification_type text not null,
  tx_hash text,
  wallet_address text,
  domain bigint,
  environment text,
  payload jsonb not null,
  processing_status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  constraint circle_gateway_webhook_processing_status_check
    check (processing_status in ('received', 'processed', 'unmatched', 'failed'))
);

alter table public.circle_gateway_webhook_events enable row level security;

revoke all on public.circle_gateway_webhook_events from anon, authenticated;
grant all on public.circle_gateway_webhook_events to service_role;

create index if not exists circle_gateway_webhook_events_tx_hash_idx
  on public.circle_gateway_webhook_events (lower(tx_hash))
  where tx_hash is not null;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'command_executions'
  ) then
    alter publication supabase_realtime add table public.command_executions;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
