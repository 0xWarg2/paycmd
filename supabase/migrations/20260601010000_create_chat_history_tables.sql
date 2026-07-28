create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Payna chat',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_status_check check (status in ('active', 'archived'))
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  kind text not null default 'text',
  metadata jsonb not null default '{}'::jsonb,
  command_execution_id uuid references public.command_executions(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_check check (role in ('assistant', 'user', 'system')),
  constraint chat_messages_kind_check check (kind in ('text', 'preview', 'status'))
);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy "chat threads are owned by user" on public.chat_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat messages are owned by user" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists chat_threads_user_status_idx on public.chat_threads(user_id, status);
create index if not exists chat_messages_thread_created_idx on public.chat_messages(thread_id, created_at desc);
create index if not exists chat_messages_user_created_idx on public.chat_messages(user_id, created_at desc);
