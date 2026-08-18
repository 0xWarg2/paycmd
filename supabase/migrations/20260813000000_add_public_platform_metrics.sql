-- Public social proof must be derived from real Payna records and expose no user-level data.
-- Keep this function aggregate-only: it intentionally bypasses row-level policies while returning
-- counts, one USDC total, a network label, and the observation timestamp.
create or replace function public.get_public_platform_metrics()
returns table (
  registered_users bigint,
  completed_payments bigint,
  usdc_moved numeric,
  research_answers bigint,
  network text,
  as_of timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with verified_movements as (
    select amount
    from public.transaction_history
    where status = 'success'
      and tx_type in ('transfer', 'bridge')
      and tx_hash is not null
      and length(btrim(tx_hash)) > 0
  )
  select
    (select count(*) from public.user_profiles)::bigint as registered_users,
    (select count(*) from verified_movements)::bigint as completed_payments,
    coalesce((select sum(amount) from verified_movements), 0::numeric) as usdc_moved,
    (
      select count(*)
      from public.chat_messages
      where role = 'assistant'
        and metadata ->> 'provider' = 'asksurf'
    )::bigint as research_answers,
    'testnet'::text as network,
    statement_timestamp() as as_of
$$;

revoke all on function public.get_public_platform_metrics() from public;
grant execute on function public.get_public_platform_metrics() to anon, authenticated;

comment on function public.get_public_platform_metrics() is
  'Aggregate-only Payna usage metrics for truthful public social proof; returns no PII.';
