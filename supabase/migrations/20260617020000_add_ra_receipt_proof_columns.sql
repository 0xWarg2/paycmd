alter table public.transaction_history
  add column if not exists proof_chain text,
  add column if not exists proof_contract_address text,
  add column if not exists proof_tx_hash text,
  add column if not exists proof_status text default 'skipped',
  add column if not exists proof_error text;

create index if not exists transaction_history_proof_status_idx
  on public.transaction_history(user_id, proof_status, created_at desc);
