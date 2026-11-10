-- Removes the storage bucket of the deleted "Vision" feature (one old picture is left in it).
--
-- Supabase blocks deleting from the storage tables by SQL unless storage.allow_delete_query is set for the
-- transaction. This removes the entries; the file itself is then no longer reachable by any address.
-- (Deleting the bucket in the dashboard under Storage does the same and also frees the file's space.)

begin;

set local storage.allow_delete_query = 'true';

delete from storage.objects where bucket_id = 'vision-images';
delete from storage.buckets where id = 'vision-images';

commit;
