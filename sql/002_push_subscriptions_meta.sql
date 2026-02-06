-- 002_push_subscriptions_meta.sql
-- 기존 push_subscriptions 테이블에 (디버깅/기기구분용) 메타 컬럼을 추가합니다.
-- Supabase SQL Editor에서 실행하세요.

alter table public.push_subscriptions
  add column if not exists user_agent text,
  add column if not exists is_pwa boolean,
  add column if not exists display_mode text,
  add column if not exists platform text,
  add column if not exists last_seen_at timestamptz;

-- last_seen_at이 null인 기존 row는 updated_at/created_at 중 가능한 값으로 보정(있을 때만)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='push_subscriptions' and column_name='last_seen_at'
  ) then
    update public.push_subscriptions
      set last_seen_at = coalesce(last_seen_at, updated_at, created_at, now())
      where last_seen_at is null;
  end if;
exception when others then
  -- 컬럼이 일부 없거나 권한 문제가 있으면 무시
end $$;
