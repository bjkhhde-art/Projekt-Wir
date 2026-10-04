-- Who watched a title: both of us together, or Isi / Benji alone (empty = not recorded).
alter table public.watchlist
  add column if not exists seen_by text check (seen_by in ('both', 'Isi', 'Benji'));
