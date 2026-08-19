alter table public.transaction_history
  add column if not exists source_mode text not null default 'scoped',
  add column if not exists source_allocations jsonb;

alter table public.transaction_history
  drop constraint if exists transaction_history_source_mode_check;

alter table public.transaction_history
  add constraint transaction_history_source_mode_check
  check (source_mode in ('scoped', 'unified'));

create index if not exists transaction_history_unified_source_idx
  on public.transaction_history (user_id, created_at desc)
  where source_mode = 'unified';
