-- 1) Our dates (first meeting, first date, anniversary) move out of the public website code into the
--    database, which only signed-in members can read (see 20261110120000_members_only_access.sql).
--    Shape: {"firstMeeting": {"date": "YYYY-MM-DD", "place": "…"}, "firstDate": {…}, "anniversary": {…}}
--    The values themselves are NOT in this file (the repository is public) – they were entered directly:
--      update public.app_settings set milestones = '{…}'::jsonb where id = 'shared';
alter table public.app_settings add column if not exists milestones jsonb;

-- 2) Invite links only open the round they were made for, and only until it is over. game-room.js now
--    clears invite_code when a round is closed or a new one is started; this clears the codes that
--    older rounds still carry: closed rounds, and any round nobody touched for two days.
do $$
declare
  t text;
begin
  foreach t in array array['cabo_games', 'nimmt_games', 'qwixx_games', 'flip7_games', 'gipfel_games'] loop
    execute format(
      'update public.%I set invite_code = null where invite_code is not null and (status = ''closed'' or updated_at < now() - interval ''2 days'')',
      t
    );
  end loop;
end $$;
