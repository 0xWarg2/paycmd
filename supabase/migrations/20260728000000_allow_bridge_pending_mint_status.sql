-- Bridge burns are recorded before the mint signature so a rejected/failed mint
-- still leaves a traceable row carrying the source tx hash.
alter table public.transaction_history
  drop constraint if exists transaction_history_status_check;

alter table public.transaction_history
  add constraint transaction_history_status_check
  check (status in ('success', 'failed', 'pending', 'pending_gateway_finality', 'pending_mint'));

create index if not exists transaction_history_pending_mint_idx
  on public.transaction_history(user_id, tx_hash)
  where tx_type = 'bridge';
