alter table public.chat_threads
  add column if not exists last_message_preview text,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_role text,
  add column if not exists last_message_kind text,
  add column if not exists message_count integer not null default 0;

create or replace function public.update_chat_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set
    last_message_preview = left(new.content, 220),
    last_message_at = new.created_at,
    last_message_role = new.role,
    last_message_kind = new.kind,
    message_count = coalesce(message_count, 0) + 1,
    updated_at = greatest(updated_at, new.created_at)
  where id = new.thread_id
    and user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists chat_messages_update_thread_last_message on public.chat_messages;
create trigger chat_messages_update_thread_last_message
after insert on public.chat_messages
for each row
execute function public.update_chat_thread_last_message();

with latest_messages as (
  select distinct on (thread_id)
    thread_id,
    user_id,
    content,
    created_at,
    role,
    kind
  from public.chat_messages
  order by thread_id, created_at desc
),
message_counts as (
  select thread_id, count(*)::integer as message_count
  from public.chat_messages
  group by thread_id
)
update public.chat_threads thread
set
  last_message_preview = left(latest.content, 220),
  last_message_at = latest.created_at,
  last_message_role = latest.role,
  last_message_kind = latest.kind,
  message_count = counts.message_count,
  updated_at = greatest(thread.updated_at, latest.created_at)
from latest_messages latest
join message_counts counts on counts.thread_id = latest.thread_id
where thread.id = latest.thread_id
  and thread.user_id = latest.user_id;

create index if not exists chat_threads_user_last_message_idx
  on public.chat_threads(user_id, status, last_message_at desc nulls last);
