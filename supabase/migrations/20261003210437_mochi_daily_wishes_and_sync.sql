-- Mochi syncs live between both phones; every write is guarded by "version" so two people
-- cuddling at the same moment never overwrite each other's coins.
alter table public.pet_state
  add column if not exists version integer not null default 0,
  -- today's wishes / chest / visitors: { date, wishes_done: {wishId: person}, chest: {person: coins}, visitors: [person], bonus_claimed }
  add column if not exists daily jsonb not null default '{}'::jsonb,
  add column if not exists streak_days integer not null default 0,
  add column if not exists best_streak integer not null default 0,
  add column if not exists streak_last_date date,
  add column if not exists wishes_fulfilled integer not null default 0,
  add column if not exists messages_sent integer not null default 0,
  add column if not exists double_cuddles integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pet_state') then
    alter publication supabase_realtime add table public.pet_state;
  end if;
end $$;
