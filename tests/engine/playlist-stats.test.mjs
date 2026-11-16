import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("../../playlist-stats.js");
const real = require("../../playlist.json");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

const song = (id, title, artists, released, durationMs, extra = {}) => ({ id, title, artists, released, durationMs, preview: `p${id}`, ...extra });
const playlist = {
  name: "Test",
  total: 7,
  tracks: [
    song("a", "Alt", ["Die Prinzen"], "1993-11-12", 191800, { addedBy: "Benji", addedAt: "2025-12-03T10:00:00Z" }),
    song("b", "Neu", ["Kraftklub", "Nina Chuba"], "2026-02-06", 140000, { addedBy: "Isi", addedAt: "2025-12-04T10:00:00Z" }),
    song("c", "Lang", ["Kraftklub"], "2024-05-01", 300000, { addedBy: "Benji", addedAt: "2026-01-10T10:00:00Z" }),
    song("d", "Kurz", ["CRO"], "2025-01-01", 100000, { addedBy: "Isi", addedAt: "2026-01-11T10:00:00Z" }),
    song("e", "⁠Viele", ["01099", "Dani", "Gustav", "Paul"], "2023-11-24", 150000, { addedBy: "Benji", addedAt: "2026-01-12T10:00:00Z", preview: "" })
  ]
};

{
  const s = S.summarize(playlist, new Date("2026-11-16T12:00:00Z"));
  ok(s.count === 5 && s.total === 7 && !s.complete, "counts the songs it has and knows the full number");
  ok(s.durationMs === 881800 && s.averageMs === 176360, "total and average length");
  ok(s.topArtists[0].name === "Kraftklub" && s.topArtists[0].count === 2, "Kraftklub leads – a feature counts for every artist");
  ok(s.artistCount === 8 && s.features === 2, "distinct artists and feature songs");
  ok(s.records.oldest.id === "a" && s.records.newest.id === "b", "oldest and newest release");
  ok(s.records.longest.id === "c" && s.records.shortest.id === "d", "longest and shortest song");
  ok(s.records.mostArtists.id === "e" && s.records.mostArtists.title === "Viele", "most artists on one song, invisible characters removed from the title");
  ok(s.freshness.recent === 2 && s.freshness.median === 2024, "songs from this and last year, median year");
  ok(s.people[0].name === "Isi" && s.people[0].count === 2 && s.people[1].count === 3, "who added how many");
  ok(s.people[0].topArtist.name === "CRO" && s.people[1].topArtist.name === "01099", "top artist per person (ties alphabetically)");
  ok(s.people[1].first.id === "a" && s.people[1].latest.id === "e", "first and latest song per person");
  ok(s.months.map(m => `${m.month}:${m.count}`).join() === "2025-12:2,2026-01:3", "songs added per month");
}

{
  const years = S.years(playlist.tracks);
  ok(years[0].older && years[0].label === "bis 15" && years[0].count === 1, "years older than the last twelve share one bar");
  ok(years[years.length - 1].year === 2026 && years.length === 12, "twelve bars up to the newest year");
  const short = S.years([song("x", "x", ["a"], "2024-01-01", 1), song("y", "y", ["a"], "2026-01-01", 1)]);
  ok(short.map(y => `${y.label}:${y.count}`).join() === "'24:1,'25:0,'26:1", "a short span shows every year, gaps as 0");
}

{
  const none = S.summarize({ tracks: playlist.tracks.map(({ addedBy, addedAt, ...t }) => t) });
  ok(none.people === null && none.months.length === 0, "without 'added by' data there is no who-added card");
  ok(none.complete && none.total === 5, "without a total the songs we have are all");
  ok(S.summarize({}).count === 0 && S.summarize({}).records.oldest === null, "an empty playlist does not break");
}

{
  ok(S.formatDuration(17625424) === "4 Std. 54 Min." && S.formatDuration(600000) === "10 Min." && S.formatDuration(7200000) === "2 Std.", "durations read as hours and minutes");
  ok(S.formatClock(191800) === "3:12" && S.formatClock(61000) === "1:01", "song length as m:ss");
  let r = 0;
  const pick = S.randomSong(playlist, "a", () => (r++ % 4) / 4);
  ok(pick && pick.id !== "a" && pick.preview, "a random song has a preview and is not the one just shown");
  ok(S.randomSong({ tracks: [] }) === null, "no songs, no random song");
}

{
  const s = S.summarize(real);
  ok(s.count >= 50 && s.topArtists.length === 5 && s.years.length > 0, `the real playlist.json summarizes (${s.count} songs, top: ${s.topArtists[0].name})`);
}

console.log(`\n${assertions} assertions passed (playlist stats)`);
