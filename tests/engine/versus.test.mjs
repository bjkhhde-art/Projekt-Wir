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
ok(s.questions.Isi.length === 3 && s.questions.Benji.length === 3 && new Set(all).size === 6, "each of us gets three different questions");
ok(all.every(id => V.questionById(id).cat === "essen"), "the chosen category is respected");
ok(V.createInitialState("Isi", "Benji", "nonsense", seeded(2)).category === V.MIXED, "unknown categories fall back to mixed");

function answersFor(ids, seed) {
  return ids.map((id, i) => {
    const q = V.questionById(id);
    if (q.type === "pick") return (seed + i) % 2;
    if (q.type === "scale") return ((seed + i) % 5) + 1;
    return [[0, 1, 2], [2, 0, 1], [1, 2, 0]][(seed + i) % 3];
  });
}

throwsWith(() => V.submitAnswers(s, "Isi", [0]), /alle drei/, "all three questions must be answered");
throwsWith(() => V.submitAnswers(s, "Mochi", answersFor(s.questions.Isi, 0)), /spielst/, "only players can answer");
throwsWith(() => V.submitGuesses(s, "Isi", answersFor(s.questions.Benji, 0)), /nicht geraten/, "nobody guesses before both answered");

const isiAnswers = answersFor(s.questions.Isi, 1);
const benjiAnswers = answersFor(s.questions.Benji, 2);
s = V.submitAnswers(s, "Isi", isiAnswers);
ok(s.phase === "answer" && s.answers.Isi, "Isi's answers are stored, Benji still answers");
throwsWith(() => V.submitAnswers(s, "Isi", isiAnswers), /schon geantwortet/, "answers cannot be changed afterwards");
s = V.submitAnswers(s, "Benji", benjiAnswers);
ok(s.phase === "guess", "when both answered, guessing starts");

/* Isi guesses all of Benji's answers right; Benji gets them all wrong-ish */
s = V.submitGuesses(s, "Isi", benjiAnswers);
ok(s.phase === "guess" && !s.results, "results wait for both guesses");
const benjiGuesses = s.questions.Isi.map((id, i) => {
  const q = V.questionById(id);
  const a = isiAnswers[i];
  if (q.type === "pick") return 1 - a;
  if (q.type === "scale") return a <= 3 ? a + 3 : a - 3;
  return [a[1], a[2], a[0]];
});
s = V.submitGuesses(s, "Benji", benjiGuesses);
ok(s.phase === "reveal", "after both guesses the answers are revealed");
ok(s.results.Isi.total === 3 && s.scores.Isi === 3, "Isi knows Benji perfectly: 3 points");
ok(s.results.Benji.total === 0 && s.scores.Benji === 0, "Benji missed everything: 0 points");
ok(V.leader(s) === "Isi", "Isi leads");
ok(s.history.length === 1 && s.history[0].totals.Isi === 3, "the round goes into the history");

/* ---------- scoring details ---------- */
const scaleQ = QUESTIONS.find(q => q.type === "scale");
const rankQ = QUESTIONS.find(q => q.type === "rank");
const pickQ = QUESTIONS.find(q => q.type === "pick");
ok(V.scoreGuess(pickQ, 1, 1) === 1 && V.scoreGuess(pickQ, 1, 0) === 0, "either-or: right or wrong");
ok(V.scoreGuess(scaleQ, 3, 3) === 1 && V.scoreGuess(scaleQ, 3, 4) === 0.5 && V.scoreGuess(scaleQ, 3, 5) === 0, "scale: exact 1, one off ½, further 0");
ok(V.scoreGuess(rankQ, [2, 0, 1], [2, 0, 1]) === 1 && V.scoreGuess(rankQ, [2, 0, 1], [2, 1, 0]) === 0.5 && V.scoreGuess(rankQ, [2, 0, 1], [0, 2, 1]) === 0, "ranking: exact 1, right favourite ½");
ok(!V.validAnswer(rankQ, [0, 0, 1]) && !V.validAnswer(scaleQ, 6) && !V.validAnswer(pickQ, 2), "invalid answers are rejected");

/* ---------- next rounds ---------- */
throwsWith(() => V.nextRound(V.createInitialState("Isi", "Benji", "mixed", seeded(3)), "Isi"), /läuft noch/, "a new round only after the reveal");
let r = V.nextRound(s, "Benji", seeded(4));
ok(r.round === 2 && r.phase === "answer" && !r.results && Object.keys(r.answers).length === 0, "the next round starts fresh");
ok(r.scores.Isi === 3, "the score carries over");
ok([...r.questions.Isi, ...r.questions.Benji].every(id => !all.includes(id)), "no question repeats in the next round");

/* a small category runs out and starts over without breaking */
let g = V.createInitialState("Isi", "Benji", "gewagt", seeded(5));
for (let round = 0; round < 6; round++) {
  g = V.submitAnswers(g, "Isi", answersFor(g.questions.Isi, round));
  g = V.submitAnswers(g, "Benji", answersFor(g.questions.Benji, round + 1));
  g = V.submitGuesses(g, "Isi", answersFor(g.questions.Benji, round));
  g = V.submitGuesses(g, "Benji", answersFor(g.questions.Isi, round));
  assert.equal(new Set([...g.questions.Isi, ...g.questions.Benji]).size, 6);
  g = V.nextRound(g, "Isi", seeded(10 + round));
}
ok(g.round === 7 && g.history.length === 6, "six rounds in a small category keep working (questions start over)");

/* ---------- names in who-of-us questions ---------- */
const whoQ = QUESTIONS.find(q => q.options && q.options.includes("@self"));
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Isi")) === JSON.stringify(["Isi (ich)", "Benji"]), "Isi answering sees herself as '(ich)'");
ok(JSON.stringify(V.optionLabels(whoQ, "Isi", "Benji")) === JSON.stringify(["Isi", "Benji (ich)"]), "Benji guessing Isi's answer sees the same names");

console.log(`\n${assertions} assertions passed (versus-engine)`);
