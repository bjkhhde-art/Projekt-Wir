-- Series we are watching right now: how many seasons / episodes per season,
-- and which episodes are ticked off (entries like "1-3" = season 1, episode 3).
alter table public.watchlist add column if not exists watching boolean not null default false;
alter table public.watchlist add column if not exists season_count smallint check (season_count between 1 and 99);
alter table public.watchlist add column if not exists episodes_per_season smallint check (episodes_per_season between 1 and 999);
alter table public.watchlist add column if not exists episodes_seen jsonb not null default '[]'::jsonb;
