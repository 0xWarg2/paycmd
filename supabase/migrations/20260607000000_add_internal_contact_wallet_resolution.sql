alter table public.contacts add column if not exists contact_user_id uuid references auth.users(id) on delete set null;
alter table public.contacts add column if not exists preferred_chain text not null default 'arcTestnet';

create index if not exists contacts_user_display_name_lower_idx
  on public.contacts(user_id, lower(display_name));

create index if not exists wallets_address_lower_idx
  on public.wallets(lower(coalesce(address, wallet_address)));

create index if not exists wallets_wallet_address_lower_idx
  on public.wallets(lower(wallet_address));

create index if not exists wallets_user_sca_created_idx
  on public.wallets(user_id, created_at desc)
  where type = 'sca';

create or replace function public.lookup_internal_wallet_by_address(p_wallet_address text)
returns table (
  contact_user_id uuid,
  wallet_id uuid,
  wallet_address text,
  address text,
  type text,
  blockchain text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wallets.user_id as contact_user_id,
    wallets.id as wallet_id,
    wallets.wallet_address,
    wallets.address,
    wallets.type,
    wallets.blockchain,
    wallets.created_at
  from public.wallets
  where lower(trim(p_wallet_address)) in (
    lower(wallets.wallet_address),
    lower(coalesce(wallets.address, wallets.wallet_address))
  )
  order by
    case when wallets.type = 'sca' then 0 else 1 end,
    wallets.created_at desc
  limit 1;
$$;

create or replace function public.resolve_internal_contact_wallet(p_contact_id uuid)
returns table (
  contact_user_id uuid,
  wallet_id uuid,
  wallet_address text,
  address text,
  type text,
  blockchain text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wallets.user_id as contact_user_id,
    wallets.id as wallet_id,
    wallets.wallet_address,
    wallets.address,
    wallets.type,
    wallets.blockchain,
    wallets.created_at
  from public.contacts
  join public.wallets on wallets.user_id = contacts.contact_user_id
  where contacts.id = p_contact_id
    and contacts.user_id = auth.uid()
    and contacts.contact_user_id is not null
    and wallets.type = 'sca'
  order by wallets.created_at desc
  limit 1;
$$;

revoke all on function public.lookup_internal_wallet_by_address(text) from public;
revoke all on function public.resolve_internal_contact_wallet(uuid) from public;

grant execute on function public.lookup_internal_wallet_by_address(text) to authenticated;
grant execute on function public.resolve_internal_contact_wallet(uuid) to authenticated;
