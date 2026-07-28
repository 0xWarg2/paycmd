alter table public.transaction_history
  drop constraint if exists transaction_history_tx_type_check;

alter table public.transaction_history
  add constraint transaction_history_tx_type_check
  check (tx_type in ('fund', 'deposit', 'withdraw', 'transfer', 'unify', 'bridge', 'swap'));
