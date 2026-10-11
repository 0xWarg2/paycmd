-- A separate ledger keeps wallet payments out of the testnet Gateway ledger and metrics.
create table public.arc_wallet_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  network text not null check (network in ('mainnet', 'testnet')),
  chain_id bigint not null,
  sender text not null check (sender ~ '^0x[0-9a-fA-F]{40}$'),
  recipient text not null check (recipient ~ '^0x[0-9a-fA-F]{40}$'),
  amount numeric(78,6) not null check (amount > 0),
  amount_units text not null check (amount_units ~ '^[0-9]+$'),
  call_data text not null,
  gas_limit text not null,
  max_fee_per_gas text not null,
  max_priority_fee_per_gas text not null,
  status text not null default 'prepared' check (status in ('prepared','signing','submitted','success','failed','rejected')),
  tx_hash text check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  error_message text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  settled_at timestamptz,
  constraint arc_wallet_payment_network_chain check (
    (network = 'mainnet' and chain_id = 5042) or (network = 'testnet' and chain_id = 5042002)
  ),
  constraint arc_wallet_payment_hash_required check (status not in ('submitted','success','failed') or tx_hash is not null),
  unique (user_id, request_key)
);
create unique index arc_wallet_payment_hash_idx on public.arc_wallet_payments(network, lower(tx_hash)) where tx_hash is not null;
-- Atomic confirmation prevents double sends even across tabs/requests/accounts.
create unique index arc_wallet_payment_inflight_idx on public.arc_wallet_payments(network, lower(sender)) where status in ('signing','submitted');
create index arc_wallet_payment_history_idx on public.arc_wallet_payments(user_id, network, created_at desc);
alter table public.arc_wallet_payments enable row level security;
create policy "users read their Arc wallet payments" on public.arc_wallet_payments for select to authenticated using (auth.uid() = user_id);
revoke all on public.arc_wallet_payments from anon, authenticated;
grant select on public.arc_wallet_payments to authenticated;
grant all on public.arc_wallet_payments to service_role;

create function public.get_arc_wallet_payment_metrics(p_network text)
returns table (completed_payments bigint, usdc_moved numeric, network text, as_of timestamptz)
language sql stable security definer set search_path = public, pg_catalog as $$
  select count(*)::bigint, coalesce(sum(amount), 0), p_network, statement_timestamp()
  from public.arc_wallet_payments
  where status = 'success' and network = p_network
    -- Self-transfers are useful smoke evidence, not payments to another person.
    and lower(sender) <> lower(recipient)
$$;
revoke all on function public.get_arc_wallet_payment_metrics(text) from public;
grant execute on function public.get_arc_wallet_payment_metrics(text) to anon, authenticated;
