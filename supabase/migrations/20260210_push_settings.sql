-- Push quiet hours settings (global)
-- NOTE: The project already has a per-user `push_settings` table.
-- Use a dedicated table for global quiet-hours to avoid column/PK conflicts.
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
