-- who may see a link: null = both, 'Isi' or 'Benji' = only that person
alter table public.private_links add column if not exists visible_to text
  check (visible_to is null or visible_to in ('Isi', 'Benji'));
