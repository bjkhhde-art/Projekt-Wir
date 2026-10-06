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
ok(s.phase === "answer" && s.round === 1 && s.category === "essen", "a game starts in the answer phase");
const all = [...s.questions.Isi, ...s.questions.Benji];
ok(s.questions.Isi.length === 3 && s.questions.Benji.length === 3 && new Set(all).size === 6, "six different questions, three about each of us");
ok(all.every(id => V.questionById(id).cat === "essen"), "the chosen category is respected");
ok(V.createInitialState("Isi", "Benji", "nonsense", seeded(2)).category === V.MIXED, "unknown categories fall back to mixed");

const texts = (prefix) => [1, 2, 3].map(i => `${prefix} ${i}`);
ok(s.v === 2 && V.isCurrentFormat(s) && !V.isCurrentFormat({ phase: "guess" }), "new rounds use the typed-answer format, old ones are recognised");

throwsWith(() => V.submitAnswers(s, "Isi", texts("a"), ["x", "", "y"]), /alle sechs/, "all six fields must be filled");
throwsWith(() => V.submitAnswers(s, "Isi", texts("a"), ["x", "   ", "y"]), /alle sechs/, "blank answers do not count");
throwsWith(() => V.submitAnswers(s, "Mochi", texts("a"), texts("b")), /spielst/, "only players can answer");
throwsWith(() => V.submitVerdicts(s, "Isi", [true, true, true]), /nicht bewertet/, "nobody judges before both typed");

s = V.submitAnswers(s, "Isi", ["  Kaffee   schwarz ", "Pasta", "Wein"], ["Tee", "Burger", "Wasser"]);
ok(s.phase === "answer" && s.answers.Isi[0] === "Kaffee schwarz" && s.guesses.Isi[1] === "Burger", "Isi's answers and guesses are stored (tidied), Benji still types");
throwsWith(() => V.submitAnswers(s, "Isi", texts("a"), texts("b")), /schon geantwortet/, "answers cannot be changed afterwards");
ok(V.cleanText("x".repeat(500)).length === V.MAX_TEXT, "very long answers are cut");
s = V.submitAnswers(s, "Benji", ["Tee", "Pizza", "Wasser"], ["Kaffee", "Pasta", "Bier"]);
ok(s.phase === "judge", "when both typed, both judge");

throwsWith(() => V.submitVerdicts(s, "Isi", [true, false]), /alle drei/, "all three tips must be judged");
throwsWith(() => V.submitVerdicts(s, "Isi", [true, "ja", false]), /alle drei/, "only right or wrong");
/* Isi judges Benji's tips on her questions (1–3), Benji judges Isi's tips on his (4–6) */
s = V.submitVerdicts(s, "Isi", [true, true, false]);
ok(s.phase === "judge" && !s.results, "results wait for both verdicts");
throwsWith(() => V.submitVerdicts(s, "Isi", [true, true, true]), /schon bewertet/, "a verdict cannot be changed");
s = V.submitVerdicts(s, "Benji", [true, false, true]);
ok(s.phase === "reveal", "after both verdicts all is revealed");
ok(s.results.Benji.total === 2 && s.scores.Benji === 2, "Benji gets the 2 points Isi gave him");
ok(s.results.Isi.total === 2 && JSON.stringify(s.results.Isi.points) === "[1,0,1]", "Isi gets the points Benji gave her");
ok(V.leader(s) === null, "2 : 2 – nobody leads");
ok(s.history.length === 1 && s.history[0].totals.Isi === 2, "the round goes into the history");

/* ---------- next rounds ---------- */
throwsWith(() => V.nextRound(V.createInitialState("Isi", "Benji", "mixed", seeded(3)), "Isi"), /läuft noch/, "a new round only after the reveal");
let r = V.nextRound(s, "Benji", seeded(4));
ok(r.round === 2 && r.phase === "answer" && !r.results && Object.keys(r.answers).length === 0 && Object.keys(r.verdicts).length === 0, "the next round starts fresh");
ok(r.scores.Isi === 2 && r.v === 2, "the score carries over");
ok([...r.questions.Isi, ...r.questions.Benji].every(id => !all.includes(id)), "no question repeats in the next round");

/* a small category runs out and starts over without breaking */
let g = V.createInitialState("Isi", "Benji", "gewagt", seeded(5));
for (let round = 0; round < 6; round++) {
  g = V.submitAnswers(g, "Isi", texts("i"), texts("ig"));
  g = V.submitAnswers(g, "Benji", texts("b"), texts("bg"));
  g = V.submitVerdicts(g, "Isi", [true, false, false]);
  g = V.submitVerdicts(g, "Benji", [false, false, false]);
  assert.equal(new Set([...g.questions.Isi, ...g.questions.Benji]).size, 6);
  g = V.nextRound(g, "Isi", seeded(10 + round));
}
ok(g.round === 7 && g.history.length === 6 && g.scores.Benji === 6 && g.scores.Isi === 0, "six rounds in a small category keep working (questions start over)");

/* ---------- names in who-of-us questions ---------- */
const whoQ = QUESTIONS.find(q => q.options && q.options.includes("@self"));
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Isi")) === JSON.stringify(["Isi (ich)", "Benji"]), "Isi answering sees herself as '(ich)'");
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Benji")) === JSON.stringify(["Isi", "Benji (ich)"]), "Benji guessing Isi's answer sees the same names");

console.log(`\n${assertions} assertions passed (versus-engine)`);
