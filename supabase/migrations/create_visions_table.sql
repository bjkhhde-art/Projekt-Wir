create table if not exists public.visions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_year integer,
  person text not null,
  image_url text,
  achieved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.visions add column if not exists target_year integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visions' and column_name = 'horizon'
  ) then
    update public.visions
    set target_year = coalesce(target_year, case horizon
      when 'bald' then extract(year from now())::integer
      when '1_2' then extract(year from now())::integer + 1
      when '3_5' then extract(year from now())::integer + 4
      when '5_plus' then extract(year from now())::integer + 6
      else extract(year from now())::integer + 3
    end);

    alter table public.visions drop column horizon;
  end if;
end $$;

update public.visions set target_year = extract(year from now())::integer where target_year is null;

alter table public.visions alter column target_year set not null;

alter table public.visions enable row level security;

drop policy if exists "Allow all access to visions" on public.visions;
create policy "Allow all access to visions" on public.visions
  for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('vision-images', 'vision-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to vision-images" on storage.objects;
create policy "Public read access to vision-images" on storage.objects
  for select using (bucket_id = 'vision-images');

drop policy if exists "Public write access to vision-images" on storage.objects;
create policy "Public write access to vision-images" on storage.objects
  for insert with check (bucket_id = 'vision-images');

drop policy if exists "Public delete access to vision-images" on storage.objects;
create policy "Public delete access to vision-images" on storage.objects
  for delete using (bucket_id = 'vision-images');
