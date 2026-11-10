-- Preview pictures for shared links: fetched once by the link-preview function and kept in our
-- own bucket, so showing the list never contacts the linked site.
alter table public.private_links
  add column if not exists preview_image text,
  add column if not exists preview_title text check (preview_title is null or char_length(preview_title) <= 120),
  add column if not exists preview_status text check (preview_status in ('pending', 'ok', 'none', 'error'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('link-previews', 'link-previews', true, 5000000, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;
