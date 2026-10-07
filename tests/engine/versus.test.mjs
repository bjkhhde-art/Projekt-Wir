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
ok(s.v === 3 && V.isCurrentFormat(s) && !V.isCurrentFormat({ v: 2 }) && !V.isCurrentFormat({ phase: "guess" }), "new rounds use the LovBirdz format, older ones are recognised");
ok(s.phase === "input" && s.round === 1 && s.index === 0 && s.category === "essen", "a game starts with question 1");
const all = s.questions.slice();
ok(all.length === 6 && new Set(all).size === 6, "six different questions per round");
ok(all.every(id => V.questionById(id).cat === "essen"), "the chosen category is respected");
ok(V.createInitialState("Isi", "Benji", "nonsense", seeded(2)).category === V.MIXED, "unknown categories fall back to mixed");

/* roles: 1–3 Isi answers and Benji guesses, 4–6 swapped */
ok([0, 1, 2].every(i => V.rolesAt(s, i).answerer === "Isi" && V.rolesAt(s, i).guesser === "Benji"), "questions 1–3: Isi answers, Benji guesses");
ok([3, 4, 5].every(i => V.rolesAt(s, i).answerer === "Benji" && V.rolesAt(s, i).guesser === "Isi"), "questions 4–6: the roles swap");

throwsWith(() => V.submitText(s, "Isi", "   "), /eintippen/, "an empty answer is not accepted");
throwsWith(() => V.submitText(s, "Mochi", "Hallo"), /spielst/, "only players can answer");
throwsWith(() => V.judge(s, "Isi", true), /nicht bewertet/, "nobody judges before both typed");

s = V.submitText(s, "Benji", "  Pasta   mit Pesto ");
ok(s.phase === "input" && s.current.guess === "Pasta mit Pesto" && s.current.answer === null, "Benji's guess is stored (tidied), Isi still types");
throwsWith(() => V.submitText(s, "Benji", "Pizza"), /schon geantwortet/, "a guess cannot be changed afterwards");
s = V.submitText(s, "Isi", "Pasta");
ok(s.phase === "judge", "when both typed, the question is judged");
throwsWith(() => V.judge(s, "Benji", true), /Isi entscheidet/, "only the one who answered decides");
s = V.judge(s, "Isi", true);
ok(s.results.length === 1 && s.results[0].right && s.results[0].guesser === "Benji" && s.scores.Benji === 1, "resolved right away: +1 for Benji");
ok(s.phase === "input" && s.index === 1 && s.current.answer === null, "then question 2 starts");

function play(state, answerer, guesser, right) {
  state = V.submitText(state, answerer, "a");
  state = V.submitText(state, guesser, "g");
  return V.judge(state, answerer, right);
}
s = play(s, "Isi", "Benji", false);
s = play(s, "Isi", "Benji", true);
ok(s.index === 3 && V.rolesAt(s).answerer === "Benji" && s.scores.Benji === 2, "after three questions Benji answers");
s = play(s, "Benji", "Isi", false);
s = play(s, "Benji", "Isi", false);
ok(s.phase === "input" && s.index === 5, "the last question is still open");
s = play(s, "Benji", "Isi", true);
ok(s.phase === "reveal" && s.results.length === 6, "after six questions the round is summed up");
ok(JSON.stringify(V.roundTotals(s)) === JSON.stringify({ Isi: 1, Benji: 2 }) && s.scores.Isi === 1 && s.scores.Benji === 2, "Benji 2, Isi 1 this round");
ok(V.leader(s) === "Benji" && s.history.length === 1 && s.history[0].totals.Benji === 2, "Benji leads, the round goes into the history");
throwsWith(() => V.submitText(s, "Isi", "x"), /nicht getippt/, "nothing to type after the round");

/* ---------- next rounds ---------- */
throwsWith(() => V.nextRound(V.createInitialState("Isi", "Benji", "mixed", seeded(3)), "Isi"), /läuft noch/, "a new round only after the summary");
let r = V.nextRound(s, "Benji", seeded(4));
ok(r.round === 2 && r.phase === "input" && r.index === 0 && r.results.length === 0, "the next round starts fresh");
ok(r.scores.Benji === 2 && r.v === 3, "the score carries over");
ok(r.questions.every(id => !all.includes(id)), "no question repeats in the next round");

/* a small category runs out and starts over without breaking */
let g = V.createInitialState("Isi", "Benji", "gewagt", seeded(5));
for (let round = 0; round < 6; round++) {
  for (let i = 0; i < 6; i++) {
    const { answerer, guesser } = V.rolesAt(g);
    g = play(g, answerer, guesser, guesser === "Benji");
  }
  assert.equal(new Set(g.questions).size, 6);
  g = V.nextRound(g, "Isi", seeded(10 + round));
}
ok(g.round === 7 && g.history.length === 6 && g.scores.Benji === 18 && g.scores.Isi === 0, "six rounds in a small category keep working (questions start over)");

/* ---------- names in who-of-us questions ---------- */
const whoQ = QUESTIONS.find(q => q.options && q.options.includes("@self"));
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Isi")) === JSON.stringify(["Isi (ich)", "Benji"]), "Isi answering sees herself as '(ich)'");
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Benji")) === JSON.stringify(["Isi", "Benji (ich)"]), "Benji guessing Isi's answer sees the same names");

console.log(`\n${assertions} assertions passed (versus-engine)`);
