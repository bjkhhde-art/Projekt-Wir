-- One entry per title and type: capitalisation and extra spaces do not count as a new title.
create unique index if not exists watchlist_unique_title
  on public.watchlist (lower(regexp_replace(btrim(title), '\s+', ' ', 'g')), media_type);
