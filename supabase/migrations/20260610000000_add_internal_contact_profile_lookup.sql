create or replace function public.lookup_internal_contact_profile_by_address(p_wallet_address text)
returns table (
  contact_user_id uuid,
  wallet_id uuid,
  wallet_address text,
  address text,
  type text,
  blockchain text,
  created_at timestamptz,
  display_name text,
  handle text,
  default_chain text
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
    wallets.created_at,
    user_profiles.display_name,
    user_profiles.handle,
    user_profiles.default_chain
  from public.wallets
  left join public.user_profiles on user_profiles.user_id = wallets.user_id
  where lower(trim(p_wallet_address)) in (
    lower(wallets.wallet_address),
    lower(coalesce(wallets.address, wallets.wallet_address))
  )
  order by
    case when wallets.type = 'sca' then 0 else 1 end,
    wallets.created_at desc
  limit 1;
$$;

revoke all on function public.lookup_internal_contact_profile_by_address(text) from public;
grant execute on function public.lookup_internal_contact_profile_by_address(text) to authenticated;
