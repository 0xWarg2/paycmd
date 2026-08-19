alter table public.transaction_history
  add column if not exists gateway_operation_id uuid,
  add column if not exists gateway_engine text,
  add column if not exists gateway_transfer_id text,
  add column if not exists gateway_expiration_block text,
  add column if not exists gateway_state text,
  add column if not exists quote_fingerprint text,
  add column if not exists gateway_request_fingerprint text;

alter table public.transaction_history
  drop constraint if exists transaction_history_gateway_engine_check;

alter table public.transaction_history
  add constraint transaction_history_gateway_engine_check
  check (gateway_engine is null or gateway_engine in ('legacy', 'circle_kit'));

alter table public.transaction_history
  drop constraint if exists transaction_history_gateway_state_check;

alter table public.transaction_history
  add constraint transaction_history_gateway_state_check
  check (
    gateway_state is null or gateway_state in (
      'pre_submit',
      'transfer_submitted',
      'pending_forwarding',
      'pending_mint',
      'forwarding_failed',
      'failed_before_submit',
      'success'
    )
  );

create unique index if not exists transaction_history_gateway_operation_unique
  on public.transaction_history (user_id, gateway_operation_id)
  where gateway_operation_id is not null;

create index if not exists transaction_history_gateway_transfer_id_idx
  on public.transaction_history (gateway_transfer_id)
  where gateway_transfer_id is not null;

create index if not exists transaction_history_gateway_request_fingerprint_idx
  on public.transaction_history (user_id, gateway_request_fingerprint)
  where gateway_request_fingerprint is not null;
