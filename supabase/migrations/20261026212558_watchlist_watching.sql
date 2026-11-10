-- Series we are watching right now: episodes per season (e.g. [8,10,6] – seasons differ in length)
-- and which episodes are ticked off (entries like "1-3" = season 1, episode 3).
alter table public.watchlist add column if not exists watching boolean not null default false;
alter table public.watchlist add column if not exists season_episodes jsonb check (jsonb_typeof(season_episodes) = 'array');
alter table public.watchlist add column if not exists episodes_seen jsonb not null default '[]'::jsonb;
