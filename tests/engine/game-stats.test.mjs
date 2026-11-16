import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../../game-stats.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

const at = (day, h, m = 0) => new Date(Date.UTC(2026, 9, day, h, m)).toISOString();
const row = (id, created, updated, state, status = "closed") => ({ id, status, created_at: created, updated_at: updated, state });

/* who won and how much was played, per kind of game */
{
  const nimmt = G.outcome("nimmt_games", { wins: { Isi: 3, Benji: 1, Udiou: 2 } });
  ok(nimmt.played === 6 && nimmt.wins.Isi === 3 && nimmt.wins.Benji === 1, "wins-based games: every win is a finished game, bots count for the number but not for us");
  const cabo = G.outcome("cabo_games", { round: 4, gameOver: true, winner: "Benji", scores: { Isi: [1, 2, 3, 4], Benji: [0, 1, 2, 3] } });
  ok(cabo.played === 4 && cabo.wins.Benji === 1, "Cabo: rounds with a score, the whole game's winner");
  const caboRunning = G.outcome("cabo_games", { round: 3, gameOver: false, winner: null, scores: { Isi: [1, 2], Benji: [0, 1] } });
  ok(caboRunning.played === 2 && caboRunning.wins.Isi === 0, "Cabo still running: the round in progress does not count, no winner yet");
  const geo = G.outcome("geo_games", { round: 2, phase: "play", moveSeq: 12, scores: { Isi: 6, Benji: 4 } });
  ok(geo.played === 1 && geo.wins.Isi === 1, "Geo-Guesser: finished rounds, the one ahead wins the table");
  ok(G.outcome("songquiz_games", { round: 1, phase: "summary", moveSeq: 15, scores: { Isi: 3, Benji: 3 } }).wins.Isi === 0, "a draw is nobody's win");
  ok(G.outcome("qwixx_games", {}).played === 0, "an empty state does not break");
}

/* time: plausible spans as they are, tables left open by the game's pace, measured ones exactly */
const tables = {
  nimmt_games: [
    row(1, at(5, 18), at(5, 18, 30), { moveSeq: 300, wins: { Isi: 2, Benji: 1 }, players: ["Isi", "Benji"] }),
    row(2, at(6, 18), at(9, 10), { moveSeq: 120, wins: { Isi: 0, Benji: 1 }, players: ["Isi", "Benji", "Udiou"] }),
    row(3, at(7, 18), at(7, 18), {}, "waiting")
  ],
  geo_games: [row(5, at(12, 20), at(12, 20, 10), { moveSeq: 10, round: 2, phase: "play", scores: { Isi: 3, Benji: 5 }, players: ["Isi", "Benji"] })],
  songquiz_games: [row(7, at(13, 21), at(15, 9), { moveSeq: 30, round: 3, phase: "play", scores: { Isi: 9, Benji: 4 }, players: ["Isi", "Benji"] })],
  cabo_games: []
};
const plays = [{ game: "songquiz_games", game_id: 7, started_at: at(13, 21), active_seconds: 754, moves: 31, players: ["Isi", "Benji"], summary: { moveSeq: 31, round: 3, phase: "play", scores: { Isi: 10, Benji: 4 } } }];

{
  const list = G.sessions(tables, plays);
  ok(list.length === 4, "tables still waiting in the lobby do not count");
  const pace = G.paces(list);
  ok(Math.round(pace.nimmt_games) === 6, "the pace is learned from the plausible table: 30 min for 300 moves = 6 s per move");
  ok(pace.cabo_games === G.paces([]).cabo_games, "a game without plausible tables uses the default pace");
  const s = G.summarize(tables, plays);
  const nimmt = s.games.find(g => g.table === "nimmt_games");
  ok(Math.round(nimmt.seconds) === 30 * 60 + 120 * 6, `a table open for days counts its moves at the game's pace (${Math.round(nimmt.seconds)} s)`);
  ok(nimmt.withOthers === 1 && nimmt.tables === 2 && nimmt.played === 4, "tables, games and tables with a bot");
  const quiz = s.games.find(g => g.table === "songquiz_games");
  ok(quiz.seconds === 754 && quiz.moves === 31, "a measured table counts exactly what the server measured");
  ok(quiz.wins.Isi === 1, "the measured summary is used for the winner");
  ok(s.measuredTables === 1 && s.estimatedTables === 1, "how many tables are measured, how many estimated");
  ok(s.wins.Isi === 3 && s.wins.Benji === 3, "wins add up over all games (2 + 1 nimmt, Geo for Benji, quiz for Isi)");
  ok(s.games[0].table === "nimmt_games" && s.games[s.games.length - 1].tables === 0, "games are sorted by play time, unplayed ones last");
  ok(s.totalSeconds === s.games.reduce((sum, g) => sum + g.seconds, 0), "the total is the sum of the games");
  ok(s.longest.table === "nimmt_games" || s.longest.seconds >= 1800, "the longest table is found");
  ok(s.weekdays.reduce((a, b) => a + b, 0) === s.totalSeconds && s.weeks.reduce((sum, w) => sum + w.seconds, 0) === s.totalSeconds, "weeks and weekdays add up to the total");
  ok(s.measuredSince === at(13, 21), "measured since the first game_plays row");
}

/* a pace learned from enough plausible tables */
{
  const many = { cabo_games: [
    row(1, at(1, 10), at(1, 10, 10), { moveSeq: 100 }),
    row(2, at(2, 10), at(5, 10), { moveSeq: 50 })
  ] };
  const pace = G.paces(G.sessions(many, []));
  ok(Math.round(pace.cabo_games) === 6, "seconds per move learned from a 10-minute table with 100 moves");
  ok(Math.round(G.summarize(many, []).totalSeconds) === 600 + 300, "the open table counts 50 moves × 6 s");
}

{
  ok(G.weekOf("2026-11-16T10:00:00") === "2026-11-16" && G.weekOf("2026-11-22T23:00:00") === "2026-11-16", "weeks start on Monday");
  ok(G.formatSeconds(45) === "45 Sek." && G.formatSeconds(720) === "12 Min." && G.formatSeconds(114360) === "31 Std. 46 Min." && G.formatSeconds(7200) === "2 Std.", "times read as Std./Min./Sek.");
  const empty = G.summarize({}, []);
  ok(empty.totalSeconds === 0 && empty.longest === null && empty.games.length === G.GAMES.length, "no games at all does not break");
}

console.log(`\n${assertions} assertions passed (game stats)`);
