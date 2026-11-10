-- "Nur für uns": own hashtags per link (lowercase, without "#")
alter table public.private_links add column if not exists tags text[] not null default '{}';
alter table public.private_links add constraint private_links_tags_limit check (cardinality(tags) <= 12);
