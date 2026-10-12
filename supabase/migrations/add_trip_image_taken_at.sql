-- when a trip photo was taken: read from the photo (EXIF) or its file name on upload,
-- estimated for older uploads, and changeable by hand in the edit menu
alter table public.trip_images add column if not exists taken_at timestamptz;
alter table public.trip_images add column if not exists taken_at_source text
  check (taken_at_source in ('exif', 'filename', 'manual', 'estimate'));

create index if not exists trip_images_trip_taken_idx on public.trip_images (trip_id, taken_at);
