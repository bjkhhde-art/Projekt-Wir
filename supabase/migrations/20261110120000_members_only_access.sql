-- Only signed-in members may read or change anything.
--
-- Before this, every table and the trip-images bucket allowed everything to everyone, and the
-- publishable key is public (it has to be, it is in the website). The password lock only hid the
-- pages. Now pin-lock.js signs in to one shared Supabase account and the database checks it.
--
-- Run this only AFTER the shared login exists (Supabase → Authentication → Users → Add user,
-- e-mail projekt-wir@example.com, "Auto Confirm User") and the new website is live.
-- Invited friends in a game are not signed in: they send their invite code as the header
-- "x-pw-invite" and may read and play only the round with that code.

do $$
begin
  if not exists (select 1 from auth.users where email = 'projekt-wir@example.com') then
    raise exception 'Erst den Login-Nutzer projekt-wir@example.com in Supabase anlegen (Authentication → Users), dann diese Migration ausführen.';
  end if;
end $$;

-- ---------- who is a member ----------

create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- no policies: nobody can read or change this table through the API
alter table public.members enable row level security;

insert into public.members (user_id)
select id from auth.users where email = 'projekt-wir@example.com'
on conflict (user_id) do nothing;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to anon, authenticated;

-- the invite code an invited friend's page sends along (null for everybody else)
create or replace function public.request_invite()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-pw-invite', '');
$$;

grant execute on function public.request_invite() to anon, authenticated;

-- ---------- every table: members only ----------

do $$
declare
  t record;
  p record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'members'
  loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.relname loop
      execute format('drop policy %I on public.%I', p.policyname, t.relname);
    end loop;
    execute format('alter table public.%I enable row level security', t.relname);
    execute format(
      'create policy "Members only" on public.%I for all to authenticated using ((select public.is_member())) with check ((select public.is_member()))',
      t.relname
    );
  end loop;
end $$;

-- ---------- invited friends: only their own round ----------

do $$
declare
  t text;
begin
  foreach t in array array['cabo_games', 'nimmt_games', 'qwixx_games', 'flip7_games', 'gipfel_games'] loop
    execute format(
      'create policy "Invited guests see their round" on public.%I for select to anon using (invite_code is not null and invite_code = (select public.request_invite()))',
      t
    );
    execute format(
      'create policy "Invited guests play their round" on public.%I for update to anon using (invite_code is not null and invite_code = (select public.request_invite())) with check (invite_code = (select public.request_invite()))',
      t
    );
  end loop;
end $$;

-- the computer players' chosen names, for an invited friend's game page (nothing else from the settings)
create or replace function public.guest_bot_names()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bot_names, '{}'::jsonb) from public.app_settings where id = 'shared';
$$;

revoke all on function public.guest_bot_names() from public;
grant execute on function public.guest_bot_names() to anon, authenticated;

-- ---------- storage ----------
-- trip-images: only members may list, upload, change or delete. (The bucket stays "public" for now,
-- so a picture still opens by its full, unguessable address – those addresses are only in member-only rows.)
-- vision-images: the feature is gone; nobody may write there any more.

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ '''(trip|vision)-images'''
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "Members manage trip images" on storage.objects
  for all to authenticated
  using (bucket_id = 'trip-images' and (select public.is_member()))
  with check (bucket_id = 'trip-images' and (select public.is_member()));
