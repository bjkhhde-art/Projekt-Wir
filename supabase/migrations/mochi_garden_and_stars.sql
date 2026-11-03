-- Mochi's garden (4 plots, pantry of harvested fruit) and the star rain mini game:
-- { garden: [plot|null x4], pantry: {fruit: count}, harvests, harvested_kinds: [fruit], star_games, star_best }
-- Written together with the rest of pet_state, so the "version" guard covers it as well.
alter table public.pet_state
  add column if not exists extras jsonb not null default '{}'::jsonb;
