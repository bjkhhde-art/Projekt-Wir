-- games for up to four: invite code for friends' links, version guard for Cabo moves
alter table public.cabo_games add column if not exists version integer not null default 0;
alter table public.cabo_games add column if not exists invite_code text;
alter table public.nimmt_games add column if not exists invite_code text;
alter table public.qwixx_games add column if not exists invite_code text;
