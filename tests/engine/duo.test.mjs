import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../../duo-daily.js");
const E = require("../../duo-engine.js");
const C = require("../../duo-content.js");

let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }

/* ---------- days on German time ---------- */
ok(D.dayKey(new Date("2026-10-06T21:59:00Z")) === "2026-10-06", "23:59 in Germany is still the same day");
ok(D.dayKey(new Date("2026-10-06T22:01:00Z")) === "2026-10-07", "after midnight in Germany it is the next day");
ok(D.shiftDay("2026-03-01", -1) === "2026-02-28" && D.shiftDay("2026-12-31", 1) === "2027-01-01", "days shift across months and years");
ok(D.secondsLeftToday(new Date("2026-10-06T21:00:00Z")) === 3600, "an hour left at 23:00 in Germany");
ok(D.formatCountdown(4 * 3600 + 38 * 60 + 18).join(":") === "04:38:18", "the countdown reads hh:mm:ss");

/* ---------- question of the day ---------- */
const today = "2026-10-06";
const q1 = D.questionFor(today, C.DAILY);
ok(q1 === D.questionFor(today, C.DAILY) && q1.options.length === 4, "the same day always gives the same question with four answers");
const run = Array.from({ length: C.DAILY.length }, (_, i) => D.questionFor(D.shiftDay(today, i), C.DAILY).id);
ok(new Set(run).size === C.DAILY.length, `no question repeats until all ${C.DAILY.length} were asked`);
ok(new Set(C.DAILY.map(q => q.id)).size === C.DAILY.length, "every question has its own id");

/* ---------- flame streak ---------- */
const both = day => [{ day, person: "Isi" }, { day, person: "Benji" }];
let info = D.streakInfo([], today);
ok(info.current === 0 && info.record === 0 && !info.atRisk, "no answers, no flame");
info = D.streakInfo([...both("2026-10-04"), ...both("2026-10-05")], today);
ok(info.current === 2 && info.atRisk, "yesterday and the day before count, the flame waits for today");
info = D.streakInfo([...both("2026-10-04"), ...both("2026-10-05"), { day: today, person: "Isi" }], today);
ok(info.current === 2 && info.answeredToday.join() === "Isi" && info.lastSeven[6].status === "half", "half of today does not count yet but shows as half a flame");
info = D.streakInfo([...both("2026-10-04"), ...both("2026-10-05"), ...both(today)], today);
ok(info.current === 3 && info.doneToday && !info.atRisk, "with both answers today the flame grows to 3");
info = D.streakInfo([...both("2026-09-01"), ...both("2026-09-02"), ...both("2026-09-03"), ...both("2026-10-05")], today);
ok(info.current === 1 && info.record === 3, "an old longer run is the record");
info = D.streakInfo([...both("2026-10-03")], today);
ok(info.current === 0, "a missed day puts the flame out");
ok(D.streakInfo([...both(today)], today).lastSeven.map(d => d.status).join() === "none,none,none,none,none,none,done", "the last seven days show which were complete");
ok(D.streakInfo([{ day: today, person: "Lena" }, { day: today, person: "Isi" }], today).answeredToday.join() === "Isi", "only Isi and Benji count");
ok(D.streakHeadline({ current: 14, atRisk: false }) === "Nichts kann euch aufhalten!", "a long streak gets the big cheer");

/* ---------- Wer von uns beiden? / Hot oder Not? ---------- */
let s = E.createInitialState("Isi", "Benji", "who");
ok(s.items.length === 6 && new Set(s.items).size === 6 && s.phase === "answer", "a round has six different questions");
ok(E.itemText(s, s.items[0]).startsWith("Wer von uns beiden"), "who-mode asks 'Wer von uns beiden …'");
assert.throws(() => E.submitAnswers(s, "Isi", ["Isi"]), /alle Fragen/);
assert.throws(() => E.submitAnswers(s, "Isi", Array(6).fill("Lena")), /alle Fragen/);
assert.throws(() => E.submitAnswers(s, "Lena", Array(6).fill("Isi")), /nicht mit/);
ok(true, "incomplete or wrong answers are refused");
s = E.submitAnswers(s, "Isi", ["Isi", "Isi", "Benji", "Benji", "Isi", "Benji"]);
ok(s.phase === "answer" && !s.results, "nothing is revealed until both answered");
assert.throws(() => E.submitAnswers(s, "Isi", Array(6).fill("Isi")), /schon geantwortet/);
s = E.submitAnswers(s, "Benji", ["Isi", "Benji", "Benji", "Isi", "Isi", "Benji"]);
ok(s.phase === "reveal" && s.results.matches === 4 && s.results.perItem[1].match === false, "then both are revealed: 4 of 6 alike");
ok(s.history.length === 1 && s.history[0].matches === 4, "the round is kept in the history");
const n = E.nextRound({ ...s, readyNext: ["Isi"] }, "Benji");
ok(n.round === 2 && n.phase === "answer" && n.items.every(i => !s.items.includes(i)) && n.readyNext.length === 0, "the next round brings six new questions");
let h = E.createInitialState("Isi", "Benji", "hotnot");
ok(E.itemText(h, h.items[0]).length > 3 && h.mode === "hotnot", "hot-or-not has its own list");
h = E.submitAnswers(h, "Isi", ["hot", "not", "hot", "hot", "not", "not"]);
h = E.submitAnswers(h, "Benji", ["hot", "hot", "hot", "not", "not", "not"]);
ok(h.results.matches === 4, "votes are compared item by item");
let many = E.createInitialState("Isi", "Benji", "hotnot");
const seen = new Set(many.items);
let shown = many.items.length;
const fullRounds = Math.floor(C.HOTNOT.length / 6);
for (let r = 1; r < fullRounds; r++) {
  many = E.submitAnswers(E.submitAnswers(many, "Isi", Array(6).fill("hot")), "Benji", Array(6).fill("not"));
  many = E.nextRound(many, "Isi");
  many.items.forEach(i => seen.add(i));
  shown += many.items.length;
}
ok(seen.size === shown, `${fullRounds} rounds without a single repeat`);
many = E.nextRound(E.submitAnswers(E.submitAnswers(many, "Isi", Array(6).fill("hot")), "Benji", Array(6).fill("not")), "Isi");
ok(many.items.length === 6 && new Set(many.items).size === 6, "when the list runs out it starts over");
ok(E.verdict(6, 6).includes("Seelenverwandte") && E.verdict(0, 6).includes("Gegensätze"), "the verdict fits the score");

console.log(`\n${assertions} assertions passed (duo: daily question + who/hot-or-not)`);
