alter table public.support_messages add column if not exists read_at timestamptz;
create index if not exists support_messages_unread_idx on public.support_messages(thread_id) where read_at is null;