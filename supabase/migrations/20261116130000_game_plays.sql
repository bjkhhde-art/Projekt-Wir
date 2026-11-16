-- Spiele-Statistik: one row per game table (a "Spieltisch" from the lobby until "Spiel beenden").
-- game-room.js calls record_game_play after every saved move. The server's own clock measures the
-- active play time: the time since the previous move counts, but at most 5 minutes, so a table that is
-- left open for days does not count as days of play. Older games (before this table) are estimated from
-- the game tables themselves (game-stats.js).
create table if not exists public.game_plays (
  game text not null,                 -- the game's table, e.g. 'cabo_games'
  game_id bigint not null,            -- id in that table
  started_at timestamptz not null default now(),
  last_move_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0,
  moves integer not null default 0,
  players text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,  -- moveSeq, gameNo, round, wins, winner … from the state
  primary key (game, game_id)
);

alter table public.game_plays enable row level security;

-- members only (see 20261110120000_members_only_access.sql); invited guests do not record
drop policy if exists "Members only" on public.game_plays;
create policy "Members only" on public.game_plays
  for all to authenticated
  using ((select public.is_member()))
  with check ((select public.is_member()));

create or replace function public.record_game_play(
  p_game text,
  p_game_id bigint,
  p_players text[],
  p_summary jsonb,
  p_ended boolean default false
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.game_plays as g (game, game_id, players, summary, moves, ended_at)
  values (
    p_game, p_game_id, coalesce(p_players, '{}'), coalesce(p_summary, '{}'::jsonb),
    coalesce((p_summary->>'moveSeq')::int, 0),
    case when p_ended then now() end
  )
  on conflict (game, game_id) do update set
    active_seconds = g.active_seconds
      + case when g.ended_at is null then least(300, greatest(0, extract(epoch from now() - g.last_move_at)))::int else 0 end,
    last_move_at = case when g.ended_at is null then now() else g.last_move_at end,
    moves = greatest(g.moves, coalesce((excluded.summary->>'moveSeq')::int, 0)),
    players = case when cardinality(excluded.players) > 0 then excluded.players else g.players end,
    summary = case when excluded.summary = '{}'::jsonb then g.summary else excluded.summary end,
    ended_at = coalesce(g.ended_at, excluded.ended_at);
$$;

revoke all on function public.record_game_play(text, bigint, text[], jsonb, boolean) from public, anon;
grant execute on function public.record_game_play(text, bigint, text[], jsonb, boolean) to authenticated;
