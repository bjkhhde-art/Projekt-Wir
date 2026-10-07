-- Couple Quest, trips + their photos, visions and the watchlist already listen for live changes
-- in the app; without being in the realtime publication the other phone only saw them after a reload.
alter publication supabase_realtime add table public.bingo_items, public.trips, public.trip_images, public.visions, public.watchlist;
