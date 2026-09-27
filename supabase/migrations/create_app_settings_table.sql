create table if not exists public.app_settings (
  id text primary key default 'shared',
  alicante_start date not null default '2026-09-01',
  alicante_end date not null default '2027-01-24',
  updated_at timestamptz not null default now()
);

alter table public.app_settings add column if not exists alicante_start date not null default '2026-09-01';
alter table public.app_settings add column if not exists alicante_end date not null default '2027-01-24';
alter table public.app_settings add column if not exists updated_at timestamptz not null default now();

insert into public.app_settings (id)
values ('shared')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Allow everyone to read" on public.app_settings;
create policy "Allow everyone to read"
  on public.app_settings for select
  using (true);

drop policy if exists "Allow everyone to update" on public.app_settings;
create policy "Allow everyone to update"
  on public.app_settings for update
  using (true)
  with check (true);

drop policy if exists "Allow everyone to insert" on public.app_settings;
create policy "Allow everyone to insert"
  on public.app_settings for insert
  with check (true);
