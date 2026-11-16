import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const W = require("../../watchlist-filter.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

const NOW = new Date("2026-10-04T12:00:00").getTime();
const entries = [
  { id: 1, title: "Barbie", media_type: "film", watched: true, seen_by: "both", platform: "Netflix", watched_at: "2026-09-20T20:00:00" },
  { id: 2, title: "Lupin", media_type: "serie", watched: true, seen_by: "Benji", platform: "netflix ", watched_at: "2026-03-24T20:00:00" },
  { id: 3, title: "Beat", media_type: "serie", watched: true, seen_by: null, platform: "Prime Video", watched_at: "2025-11-02T20:00:00" },
  { id: 4, title: "Dune", media_type: "film", watched: false, seen_by: null, platform: "Kino", watched_at: null },
  { id: 5, title: "Arcane", media_type: "serie", watched: true, seen_by: "Isi", platform: null, watched_at: "2026-08-01T20:00:00" },
  { id: 6, title: "The Bear", media_type: "serie", watched: false, seen_by: null, platform: "Disney+", watched_at: null }
];
const pick = filters => entries.filter(e => W.matches(e, { ...W.emptyFilters(), ...filters }, NOW)).map(e => e.id);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(same(pick({}), [1, 2, 3, 4, 5, 6]), "no filter shows everything");
ok(same(pick({ types: ["film"] }), [1, 4]), "type: films only");
ok(same(pick({ types: ["film", "serie"] }), [1, 2, 3, 4, 5, 6]), "both types together = everything");
ok(same(pick({ status: ["open"] }), [4, 6]), "status: not watched yet");
ok(same(pick({ status: ["both", "Isi"] }), [1, 5]), "several statuses at once: together OR Isi alone");
ok(same(pick({ status: ["unknown"] }), [3]), "watched without who-saw-it recorded");
ok(same(pick({ platforms: ["netflix"] }), [1, 2]), "platforms ignore case and spaces ('Netflix' = 'netflix ')");
ok(same(pick({ platforms: ["netflix", "prime video"] }), [1, 2, 3]), "several platforms at once");
ok(same(pick({ platforms: [W.NO_PLATFORM] }), [5]), "entries without a platform can be filtered too");
ok(same(pick({ periods: ["30d"] }), [1]), "watched in the last 30 days");
ok(same(pick({ periods: ["90d"] }), [1, 5]), "watched in the last 3 months");
ok(same(pick({ periods: ["2025"] }), [3]), "watched in a year");
ok(same(pick({ periods: ["2025", "30d"] }), [1, 3]), "several periods at once");
ok(same(pick({ from: "2026-03-01", to: "2026-08-31" }), [2, 5]), "custom from–to range (inclusive)");
ok(same(pick({ from: "2026-09-20" }), [1]), "only a start date");
ok(same(pick({ to: "2026-03-24" }), [2, 3]), "only an end date, the end day counts");
ok(same(pick({ types: ["serie"], status: ["Benji", "Isi"], platforms: ["netflix"] }), [2]), "groups combine with AND");
ok(same(pick({ status: ["open"], periods: ["2026"] }), []), "a date filter leaves out titles not watched yet");

ok(W.statusOf({ watched: false, watching: true }) === "watching", "an unfinished series we are watching has its own status");
ok(W.matches({ media_type: "serie", watched: false, watching: true }, { ...W.emptyFilters(), status: ["watching"] }, NOW), "status filter: läuft gerade");
ok(!W.matches({ media_type: "serie", watched: false, watching: true }, { ...W.emptyFilters(), status: ["open"] }, NOW), "a running series is not 'noch offen'");

const opts = W.options(entries);
ok(same(opts.platforms.map(p => p.label), ["Netflix", "Disney+", "Kino", "Prime Video", "Ohne Anbieter"]), "platform choices come from the list, most used first, 'Ohne Anbieter' last");
ok(opts.platforms[0].count === 2, "'Netflix' and 'netflix ' are one platform");
ok(same(opts.periods.map(p => p.value), ["30d", "90d", "2026", "2025"]), "years come from the watch dates, newest first");
ok(W.activeCount({ types: ["film"], status: ["open", "both"], platforms: [], periods: [], from: "2026-01-01", to: "" }) === 4, "active choices are counted (a date range counts once)");
const cleaned = W.sanitize({ types: ["film", 3], from: "gestern", to: "2026-01-31", junk: true });
ok(same(cleaned, { types: ["film"], status: [], platforms: [], periods: [], from: "", to: "2026-01-31" }), "stored filters are cleaned up");
ok(same(W.sanitize(null), W.emptyFilters()), "missing stored filters mean no filter");

/* how something was watched: together live, both separately, only one of us */
ok(W.STATUS_OPTIONS.some(o => o.value === "separate"), "'Beide getrennt' can be filtered");
ok(W.matches({ watched: true, seen_by: "separate", media_type: "film" }, { ...W.emptyFilters(), status: ["separate"] }), "a title watched separately matches its filter");
ok(JSON.stringify(W.episodeModes({ episodes_seen: ["1-1", "1-2"], episode_seen_by: { "1-2": "Isi" } })) === '{"1-1":"both","1-2":"Isi"}', "old ticks without a way count as together");
ok(JSON.stringify(W.episodeModes({ episodes_seen: ["1-1"], episode_seen_by: { "1-1": "nonsense", "9-9": "Isi" } })) === '{"1-1":"both"}', "unknown ways and unticked keys are ignored");
ok(W.modeCounts({ a: "both", b: "Isi", c: "Isi" }).Isi === 2, "counts per way");
ok(W.seriesSeenBy({}) === "both", "no episodes → together");
ok(W.seriesSeenBy({ a: "Isi", b: "Isi" }) === "Isi", "all episodes by Isi alone → only Isi");
ok(W.seriesSeenBy({ a: "Isi", b: "Benji" }) === "separate", "Isi alone and Benji alone → both separately");
ok(W.seriesSeenBy({ a: "both", b: "both", c: "Isi" }) === "both", "mostly together → together");
ok(W.seriesSeenBy({ a: "both", b: "separate", c: "separate" }) === "separate", "mostly separately → separately");
ok(W.seriesSeenBy({ a: "both", b: "Benji" }) === "both", "a tie goes to together");

console.log(`\n${assertions} assertions passed (watchlist filter)`);
