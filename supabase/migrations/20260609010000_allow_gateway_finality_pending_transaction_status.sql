alter table public.transaction_history
  drop constraint if exists transaction_history_status_check;

alter table public.transaction_history
  add constraint transaction_history_status_check
  check (status in ('success', 'failed', 'pending', 'pending_gateway_finality'));

create index if not exists transaction_history_pending_gateway_finality_idx
  on public.transaction_history(user_id, chain, created_at desc)
  where tx_type = 'deposit' and status = 'pending_gateway_finality';
