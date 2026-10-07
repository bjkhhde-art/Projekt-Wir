import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const V = require("../../versus-engine.js");
const { QUESTIONS, CATEGORIES } = require("../../versus-questions.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}
function throwsWith(fn, pattern, msg) {
  assert.throws(fn, pattern);
  assertions++;
  console.log("PASS:", msg);
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- question bank ---------- */
ok(new Set(QUESTIONS.map(q => q.id)).size === QUESTIONS.length, `all ${QUESTIONS.length} question ids are unique`);
ok(QUESTIONS.every(q => CATEGORIES[q.cat]), "every question belongs to a known category");
ok(Object.keys(CATEGORIES).every(c => QUESTIONS.filter(q => q.cat === c).length >= 12), "each category has enough questions for several rounds");
ok(QUESTIONS.every(q => (q.type === "pick" && q.options.length === 2) || (q.type === "scale" && q.low && q.high) || (q.type === "rank" && q.options.length === 3)), "every question has the right options for its type");
ok(["pick", "scale", "rank"].every(t => QUESTIONS.some(q => q.type === t)), "all three question types are used");

/* ---------- a full round ---------- */
let s = V.createInitialState("Isi", "Benji", "essen", seeded(1));
ok(s.v === 4 && V.isCurrentFormat(s) && !V.isCurrentFormat({ v: 3 }) && !V.isCurrentFormat({ phase: "guess" }), "new rounds use the current format, older ones are recognised");
ok(s.phase === "play" && s.round === 1 && V.progressOf(s, "Isi") === 0 && s.category === "essen", "a game starts with question 1 for both");
const all = s.questions.slice();
ok(all.length === 6 && new Set(all).size === 6, "six different questions per round");
ok(all.every(id => V.questionById(id).cat === "essen"), "the chosen category is respected");
ok(V.createInitialState("Isi", "Benji", "nonsense", seeded(2)).category === V.MIXED, "unknown categories fall back to mixed");

/* roles: 1–3 Isi answers and Benji guesses, 4–6 swapped */
ok([0, 1, 2].every(i => V.rolesAt(s, i).answerer === "Isi" && V.rolesAt(s, i).guesser === "Benji"), "questions 1–3: Isi answers, Benji guesses");
ok([3, 4, 5].every(i => V.rolesAt(s, i).answerer === "Benji" && V.rolesAt(s, i).guesser === "Isi"), "questions 4–6: the roles swap");

throwsWith(() => V.submitText(s, "Isi", "   "), /eintippen/, "an empty answer is not accepted");
throwsWith(() => V.submitText(s, "Mochi", "Hallo"), /spielst/, "only players can answer");
throwsWith(() => V.judge(s, "Isi", 0, true), /nicht aufgelöst/, "nobody judges before both are done");

/* everybody at their own pace */
s = V.submitText(s, "Benji", "  Pasta   mit Pesto ");
s = V.submitText(s, "Benji", "Pizza");
ok(V.progressOf(s, "Benji") === 2 && V.progressOf(s, "Isi") === 0 && s.inputs.Benji[0] === "Pasta mit Pesto", "Benji is already at question 3 while Isi is at 1 (texts tidied)");
for (const t of ["Pasta", "Sushi", "Wein", "Tipp 4", "Tipp 5"]) s = V.submitText(s, "Isi", t);
ok(s.phase === "play" && V.progressOf(s, "Isi") === 5, "Isi is at her last question");
s = V.submitText(s, "Isi", "Tipp 6");
throwsWith(() => V.submitText(s, "Isi", "noch eins"), /alle Fragen/, "after six there is nothing more to type");
ok(s.phase === "play", "the reveal waits until both are done");
for (const t of ["Burger", "Antwort 4", "Antwort 5", "Antwort 6"]) s = V.submitText(s, "Benji", t);
ok(s.phase === "judge", "when both have six, the reveal starts");
ok(V.answerAt(s, 0) === "Pasta" && V.guessAt(s, 0) === "Pasta mit Pesto" && V.answerAt(s, 4) === "Antwort 5" && V.guessAt(s, 4) === "Tipp 5", "answers and guesses line up per question");

/* the reveal: whoever answered decides */
throwsWith(() => V.judge(s, "Benji", 0, true), /Isi entscheidet/, "only the one who answered decides");
throwsWith(() => V.judge(s, "Isi", 9, true), /gibt es nicht/, "only questions of this round");
s = V.judge(s, "Isi", 0, true);
throwsWith(() => V.judge(s, "Isi", 0, false), /schon bewertet/, "a verdict cannot be changed");
throwsWith(() => V.judge(s, "Isi", 1, "ja"), /Richtig oder falsch/, "only right or wrong");
s = V.judge(s, "Isi", 1, false);
s = V.judge(s, "Benji", 3, true);
s = V.judge(s, "Isi", 2, true);
s = V.judge(s, "Benji", 5, false);
ok(s.phase === "judge" && s.scores.Benji === 0, "points only count when the round is complete");
s = V.judge(s, "Benji", 4, false);
ok(s.phase === "reveal", "after all six verdicts the round is summed up");
ok(JSON.stringify(V.roundTotals(s)) === JSON.stringify({ Isi: 1, Benji: 2 }) && s.scores.Isi === 1 && s.scores.Benji === 2, "Benji 2, Isi 1 this round");
ok(V.leader(s) === "Benji" && s.history.length === 1 && s.history[0].totals.Benji === 2, "Benji leads, the round goes into the history");
throwsWith(() => V.submitText(s, "Isi", "x"), /nicht getippt/, "nothing to type after the round");

/* ---------- next rounds ---------- */
throwsWith(() => V.nextRound(V.createInitialState("Isi", "Benji", "mixed", seeded(3)), "Isi"), /läuft noch/, "a new round only after the summary");
let r = V.nextRound(s, "Benji", seeded(4));
ok(r.round === 2 && r.phase === "play" && V.progressOf(r, "Isi") === 0 && r.verdicts.every(v => v === null), "the next round starts fresh");
ok(r.scores.Benji === 2 && r.v === 4, "the score carries over");
ok(r.questions.every(id => !all.includes(id)), "no question repeats in the next round");

/* a small category runs out and starts over without breaking */
let g = V.createInitialState("Isi", "Benji", "gewagt", seeded(5));
for (let round = 0; round < 6; round++) {
  for (let i = 0; i < 6; i++) {
    g = V.submitText(g, "Isi", "i" + i);
    g = V.submitText(g, "Benji", "b" + i);
  }
  for (let i = 0; i < 6; i++) g = V.judge(g, V.rolesAt(g, i).answerer, i, V.rolesAt(g, i).guesser === "Benji");
  assert.equal(new Set(g.questions).size, 6);
  g = V.nextRound(g, "Isi", seeded(10 + round));
}
ok(g.round === 7 && g.history.length === 6 && g.scores.Benji === 18 && g.scores.Isi === 0, "six rounds in a small category keep working (questions start over)");

/* ---------- names in who-of-us questions ---------- */
const whoQ = QUESTIONS.find(q => q.options && q.options.includes("@self"));
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Isi")) === JSON.stringify(["Isi (ich)", "Benji"]), "Isi answering sees herself as '(ich)'");
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Benji")) === JSON.stringify(["Isi", "Benji (ich)"]), "Benji guessing Isi's answer sees the same names");

console.log(`\n${assertions} assertions passed (versus-engine)`);
