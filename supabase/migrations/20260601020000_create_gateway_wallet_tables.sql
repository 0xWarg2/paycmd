create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_wallet_id text not null unique,
  wallet_set_id text not null,
  wallet_address text not null,
  address text,
  blockchain text,
  type text,
  name text,
  created_at timestamptz not null default now()
);

alter table public.wallets add column if not exists address text;
alter table public.wallets add column if not exists blockchain text;
alter table public.wallets add column if not exists type text;
alter table public.wallets add column if not exists name text;

update public.wallets
set address = wallet_address
where address is null;

update public.wallets
set type = 'sca'
where type is null;

create table if not exists public.transaction_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain text not null,
  tx_type text not null,
  amount numeric not null,
  tx_hash text,
  gateway_wallet_address text,
  destination_chain text,
  status text not null default 'success',
  reason text,
  created_at timestamptz not null default now(),
  constraint transaction_history_tx_type_check check (tx_type in ('deposit', 'transfer', 'unify')),
  constraint transaction_history_status_check check (status in ('success', 'failed', 'pending'))
);

alter table public.transaction_history add column if not exists status text not null default 'success';
alter table public.transaction_history add column if not exists reason text;
alter table public.transaction_history add column if not exists destination_chain text;
alter table public.transaction_history add column if not exists gateway_wallet_address text;
alter table public.transaction_history add column if not exists tx_hash text;

alter table public.wallets enable row level security;
alter table public.transaction_history enable row level security;

drop policy if exists "wallets are owned by user" on public.wallets;
create policy "wallets are owned by user" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transaction history is owned by user" on public.transaction_history;
create policy "transaction history is owned by user" on public.transaction_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists wallets_user_id_type_idx on public.wallets(user_id, type);
create index if not exists transaction_history_user_created_idx on public.transaction_history(user_id, created_at desc);
create index if not exists transaction_history_user_type_idx on public.transaction_history(user_id, tx_type);
