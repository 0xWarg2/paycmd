alter table public.user_profiles
  add column if not exists ai_quota_notice_seen_at timestamptz;

create or replace function public.get_deepseek_quota()
returns table (unlimited boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  requesting_user_id uuid := auth.uid();
  successful_requests integer;
begin
  if requesting_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if exists (select 1 from public.ai_user_whitelist where user_id = requesting_user_id) then
    return query select true, null::integer, null::integer;
    return;
  end if;

  select count(*)::integer into successful_requests
  from public.ai_request_reservations
  where user_id = requesting_user_id and status = 'succeeded';

  return query select false, successful_requests, greatest(0, 10 - successful_requests);
end;
$$;

revoke all on function public.get_deepseek_quota() from public, anon;
grant execute on function public.get_deepseek_quota() to authenticated;
