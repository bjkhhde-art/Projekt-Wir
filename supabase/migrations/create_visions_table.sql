create table if not exists public.visions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  horizon text not null,
  person text not null,
  image_url text,
  achieved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.visions enable row level security;

create policy "Allow all access to visions" on public.visions
  for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('vision-images', 'vision-images', true)
on conflict (id) do nothing;

create policy "Public read access to vision-images" on storage.objects
  for select using (bucket_id = 'vision-images');

create policy "Public write access to vision-images" on storage.objects
  for insert with check (bucket_id = 'vision-images');

create policy "Public delete access to vision-images" on storage.objects
  for delete using (bucket_id = 'vision-images');
