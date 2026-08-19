alter table public.transaction_history
  add column if not exists gateway_fees jsonb,
  add column if not exists gateway_actual_fee numeric(78, 6);
