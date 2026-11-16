-- How a title was watched: together live ('both'), both of us but separately ('separate'),
-- or only Isi / only Benji. The same choice is stored per episode of a series we are watching:
-- episode_seen_by maps an episode key ("1-3" = season 1, episode 3) to one of these values.
-- Ticked episodes without an entry (ticked before this existed) count as 'both'.
alter table public.watchlist drop constraint if exists watchlist_seen_by_check;
alter table public.watchlist
  add constraint watchlist_seen_by_check check (seen_by in ('both', 'separate', 'Isi', 'Benji'));

alter table public.watchlist add column if not exists episode_seen_by jsonb not null default '{}'::jsonb;
alter table public.watchlist drop constraint if exists watchlist_episode_seen_by_check;
alter table public.watchlist
  add constraint watchlist_episode_seen_by_check check (jsonb_typeof(episode_seen_by) = 'object');
