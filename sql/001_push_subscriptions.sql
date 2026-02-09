-- 001_push_subscriptions.sql
-- Supabase SQL Editor에서 실행하세요.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text,
  auth text,
  user_agent text,
  updated_at timestamptz default now()
);

-- RLS 정책(원하면 강화 가능)
alter table public.push_subscriptions enable row level security;

-- 로그인한 사용자만 upsert 가능하게 하려면 별도 컬럼(user_id) 추가가 필요합니다.
-- 테스트 단계에서는 간단하게 모두 insert/upsert 허용(권한 오픈)으로 두고,
-- 운영 전에는 user_id 연동/정책을 강화하세요.
create policy if not exists "allow upsert push subs"
on public.push_subscriptions
for all
to public
using (true)
with check (true);
