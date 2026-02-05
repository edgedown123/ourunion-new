-- Push subscriptions table for Web Push (PWA)
-- Run in Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid null,
  endpoint text not null unique,
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null
);

alter table public.push_subscriptions enable row level security;

-- Members can manage their own subscription rows
create policy "push_subscriptions: insert own"
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_subscriptions: update own"
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_subscriptions: delete own"
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

-- Optional: allow select own (for debugging UI)
create policy "push_subscriptions: select own"
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());
