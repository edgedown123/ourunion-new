-- Run this in Supabase SQL Editor (once)
-- Global quiet-hours settings table used by /api/push-quiet-hours

create table if not exists public.push_quiet_hours (
  id integer primary key,
  quiet_enabled boolean not null default false,
  quiet_start text not null default '22:00',
  quiet_end text not null default '09:00',
  updated_at timestamptz null
);

insert into public.push_quiet_hours (id)
values (1)
on conflict (id) do nothing;
