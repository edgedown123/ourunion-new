-- Push quiet hours settings (global)
create table if not exists public.push_settings (
  id integer primary key,
  quiet_enabled boolean not null default false,
  quiet_start text not null default '22:00',
  quiet_end text not null default '09:00',
  updated_at timestamptz null
);

insert into public.push_settings (id)
values (1)
on conflict (id) do nothing;
