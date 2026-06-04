alter table public.user_profiles add column if not exists auth_provider text;
alter table public.user_profiles add column if not exists primary_external_wallet_address text;

create table if not exists public.user_external_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_type text not null,
  chain_type text not null,
  wallet_address text not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_external_wallets_wallet_type_check check (wallet_type in ('metamask')),
  constraint user_external_wallets_chain_type_check check (chain_type in ('evm')),
  constraint user_external_wallets_address_lower_check check (wallet_address = lower(wallet_address))
);

create unique index if not exists user_external_wallets_user_wallet_unique_idx
  on public.user_external_wallets(user_id, wallet_type, wallet_address);

create index if not exists user_external_wallets_user_primary_idx
  on public.user_external_wallets(user_id, is_primary);

alter table public.user_external_wallets enable row level security;

drop policy if exists "external wallets are owned by user" on public.user_external_wallets;
create policy "external wallets are owned by user" on public.user_external_wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Remove profiles created by the old MetaMask login logic where the external
-- wallet was stored in circle_wallet_address before any Circle wallet existed.
delete from public.user_profiles profile
where profile.auth_provider is null
  and profile.primary_external_wallet_address is null
  and profile.circle_wallet_address ~* '^0x[0-9a-f]{40}$'
  and not exists (
    select 1
    from public.wallets wallet
    where wallet.user_id = profile.user_id
  );
