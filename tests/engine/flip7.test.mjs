import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const F = require("../../flip7-engine.js");

let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }
function throwsWith(fn, pattern, msg) { assert.throws(fn, pattern); assertions++; console.log("PASS:", msg); }
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
const seat = (numbers = [], extra = {}) => ({ numbers, mods: [], actions: [], status: "active", flip7: false, bust: null, ...extra });
/* a hand-made table: `next` lists the cards in the order they will be drawn */
function table(players, seats, next, extra = {}) {
  const s = F.createInitialState(players, seeded(1));
  s.phase = "play";
  s.table = Object.fromEntries(players.map(p => [p, seats[p] || seat()]));
  s.deck = next.slice().reverse();
  s.discard = [];
  s.queue = [];
  s.flip3 = null;
  s.choice = null;
  s.dealer = players.length - 1;
  s.turnPerson = players[0];
  s.flip7By = null;
  return Object.assign(s, extra);
}

/* ---------- the deck (rule sheet) ---------- */
const deck = F.createDeck();
ok(deck.length === 94, "94 cards");
ok(deck.filter(F.isNumber).length === 79, "79 number cards");
ok(deck.filter(c => c === "n12").length === 12 && deck.filter(c => c === "n11").length === 11 && deck.filter(c => c === "n1").length === 1 && deck.filter(c => c === "n0").length === 1, "twelve 12s, eleven 11s … one 1 and one 0");
ok(deck.filter(F.isModifier).length === 6 && ["x2", "p2", "p4", "p6", "p8", "p10"].every(c => deck.includes(c)), "six bonus cards ×2, +2 … +10");
ok(["freeze", "second", "flip3"].every(c => deck.filter(d => d === c).length === 3), "Freeze, Second Chance and Flip Three three times each");

/* ---------- scoring examples from the rule sheet ---------- */
ok(F.scoreOf(seat([3, 11, 5, 7, 10])) === 36, "3+11+5+7+10 = 36");
ok(F.scoreOf(seat([3, 11, 5, 7, 10], { mods: ["x2"] })) === 72, "×2 doubles the numbers: 72");
ok(F.scoreOf(seat([3, 11, 5, 7, 10], { mods: ["x2", "p10"] })) === 82, "bonus after doubling: 82");
ok(F.scoreOf(seat([3, 11, 5, 7, 10, 9, 6], { flip7: true })) === 66, "Flip 7: 51 + 15 extra = 66");
ok(F.scoreOf(seat([], { mods: ["p4"] })) === 4, "only a +4 card still counts");
ok(F.scoreOf(seat([5, 9], { status: "busted", mods: ["p10"] })) === 0, "busted: no points at all");

/* ---------- a new game ---------- */
const g = F.createInitialState(["Isi", "Benji", "Lena"], seeded(7));
ok(F.countCards(g) === 94, "no card gets lost while dealing");
ok(g.players.every(p => {
  const s = g.table[p];
  return s.numbers.length + s.mods.length + s.actions.length + (s.bust ? 1 : 0) >= 1 || s.status !== "active";
}), "everybody got an open card");
ok(g.lastMove.type === "deal" && g.lastMove.events.some(e => e.type === "card"), "the deal is recorded for the animation");
throwsWith(() => F.createInitialState(["Isi"]), /2 bis 4/, "at least two players");
throwsWith(() => F.createInitialState(["A", "B", "C", "D", "E"]), /2 bis 4/, "at most four players");
const two = F.createInitialState("Isi", "Benji");
ok(two.players.join() === "Isi,Benji", "the old (host, guest) form still works");

/* ---------- Stopp / Noch eine, turn order ---------- */
let s = table(["Isi", "Benji", "Lena"], { Isi: seat([4]), Benji: seat([7]), Lena: seat([2]) }, ["n9", "n5"]);
throwsWith(() => F.hit(s, "Benji"), /Isi ist am Zug/, "only the player whose turn it is");
s = F.hit(s, "Isi");
ok(s.table.Isi.numbers.join() === "4,9" && s.turnPerson === "Benji", "Noch eine: one more open card, then the next player");
s = F.stay(s, "Benji");
ok(s.table.Benji.status === "stayed" && s.turnPerson === "Lena", "Stopp: out of the round, the next player");
s = F.hit(s, "Lena");
ok(s.turnPerson === "Isi", "players who stopped are skipped");

/* ---------- busting ---------- */
s = table(["Isi", "Benji"], { Isi: seat([6, 8]), Benji: seat([1]) }, ["n6"]);
s = F.hit(s, "Isi");
ok(s.table.Isi.status === "busted" && s.table.Isi.bust === "n6" && s.lastMove.events.some(e => e.result === "bust"), "a number you already have: busted");
ok(s.turnPerson === "Benji", "the turn goes on");

/* ---------- Second Chance ---------- */
s = table(["Isi", "Benji"], { Isi: seat([6], { actions: ["second"] }), Benji: seat([1]) }, ["n6"]);
s = F.hit(s, "Isi");
ok(s.table.Isi.status === "active" && !s.table.Isi.actions.includes("second") && s.discard.includes("second") && s.discard.includes("n6"), "Second Chance saves you – both cards are discarded");
s = table(["Isi", "Benji", "Lena"], { Isi: seat([6], { actions: ["second"] }), Benji: seat([1]), Lena: seat([2], { actions: ["second"] }) }, ["second"]);
s = F.hit(s, "Isi");
ok(s.table.Benji.actions.includes("second") && !s.choice, "a second Second Chance goes on – automatically if only one person can take it");
s = table(["Isi", "Benji", "Lena"], { Isi: seat([6], { actions: ["second"] }), Benji: seat([1]), Lena: seat([2]) }, ["second"]);
s = F.hit(s, "Isi");
ok(s.choice && s.choice.type === "second" && s.choice.candidates.join() === "Benji,Lena", "with two candidates Isi chooses who gets it");
throwsWith(() => F.chooseTarget(s, "Isi", "Isi"), /nicht wählen/, "not yourself");
throwsWith(() => F.chooseTarget(s, "Benji", "Lena"), /Isi wählt/, "only Isi chooses");
throwsWith(() => F.hit(s, "Benji"), /wählt gerade/, "nobody plays on while Isi chooses");
s = F.chooseTarget(s, "Isi", "Lena");
ok(s.table.Lena.actions.includes("second") && s.turnPerson === "Benji", "Lena gets it, then the turn goes on");
s = table(["Isi", "Benji"], { Isi: seat([6], { actions: ["second"] }), Benji: seat([1], { status: "stayed" }) }, ["second"]);
s = F.hit(s, "Isi");
ok(s.discard.includes("second"), "nobody else in the round: the extra Second Chance is discarded");

/* ---------- Freeze ---------- */
s = table(["Isi", "Benji", "Lena"], { Isi: seat([3]), Benji: seat([9, 12]), Lena: seat([5]) }, ["freeze"]);
s = F.hit(s, "Isi");
ok(s.choice && s.choice.type === "freeze" && s.choice.candidates.join() === "Isi,Benji,Lena", "Freeze: choose anybody still in the round (yourself too)");
s = F.chooseTarget(s, "Isi", "Benji");
ok(s.table.Benji.status === "frozen" && s.turnPerson === "Lena", "Benji is frozen and out, Lena is next");
s = table(["Isi", "Benji"], { Isi: seat([3]), Benji: seat([9], { status: "stayed" }) }, ["freeze"]);
s = F.hit(s, "Isi");
ok(s.phase === "round-over" && s.lastRound.scores.Isi === 3, "only you are left: Freeze hits yourself – and you keep your points");

/* ---------- Flip Three ---------- */
s = table(["Isi", "Benji"], { Isi: seat([3]), Benji: seat([1]) }, ["flip3", "n4", "n5", "n6", "n7"]);
s = F.hit(s, "Isi");
ok(s.choice && s.choice.type === "flip3", "Flip Three: choose who gets three cards");
s = F.chooseTarget(s, "Isi", "Benji");
ok(s.table.Benji.numbers.join() === "1,4,5,6" && s.deck.length === 1 && s.turnPerson === "Benji", "Benji gets exactly three cards");
s = table(["Isi", "Benji"], { Isi: seat([3]), Benji: seat([1]) }, ["flip3", "n1", "n5", "n6"]);
s = F.chooseTarget(F.hit(s, "Isi"), "Isi", "Benji");
ok(s.table.Benji.status === "busted" && s.deck.length === 2, "busting stops Flip Three at once");
s = table(["Isi", "Benji", "Lena"], { Isi: seat([3]), Benji: seat([1]), Lena: seat([2]) }, ["flip3", "freeze", "n4", "n5"]);
s = F.chooseTarget(F.hit(s, "Isi"), "Isi", "Benji");
ok(s.table.Benji.numbers.join() === "1,4,5" && s.choice && s.choice.type === "freeze" && s.choice.chooser === "Benji", "an action card during Flip Three only counts after the three cards");
ok(s.choice.candidates.includes("Benji"), "still in: Benji may freeze himself too");
s = table(["Isi", "Benji", "Lena"], { Isi: seat([3]), Benji: seat([1]), Lena: seat([2]) }, ["flip3", "freeze", "n1"]);
s = F.chooseTarget(F.hit(s, "Isi"), "Isi", "Benji");
ok(s.table.Benji.status === "busted" && s.choice && !s.choice.candidates.includes("Benji"), "busted during Flip Three: the saved action goes to somebody else");

/* ---------- Flip 7 ---------- */
s = table(["Isi", "Benji", "Lena"], { Isi: seat([0, 2, 3, 4, 5, 6]), Benji: seat([10, 11], { status: "stayed" }), Lena: seat([9, 9], { status: "busted" }) }, ["n12"]);
s = F.hit(s, "Isi");
ok(s.phase === "round-over" && s.lastRound.flip7By === "Isi", "seven different numbers: Flip 7 ends the round at once");
ok(s.lastRound.scores.Isi === 32 + 15 && s.lastRound.scores.Benji === 21 && s.lastRound.scores.Lena === 0, "Flip 7 gets 15 extra, the others count, busted gets nothing");

/* ---------- round end, next round ---------- */
s = table(["Isi", "Benji"], { Isi: seat([5], { status: "stayed" }), Benji: seat([8]) }, ["n3", "n12", "n12", "n11"]);
s.turnPerson = "Benji";
s = F.stay(s, "Benji");
ok(s.phase === "round-over" && s.scores.Isi === 5 && s.scores.Benji === 8, "everybody out: the round ends and the points are added");
const discarded = s.discard.length;
const deckLeft = s.deck.length;
throwsWith(() => F.hit(s, "Isi"), /niemand am Zug/, "no moves between rounds");
const dealerBefore = s.dealer;
const r2 = F.nextRound(s, "Isi");
ok(r2.round === s.round + 1 && r2.dealer === (dealerBefore + 1) % 2 && r2.readyNext.length === 0, "next round: the deal moves on");
ok(r2.discard.length === discarded && r2.discard.includes("n5") && r2.discard.includes("n8") && r2.deck.length === deckLeft - 2, "used cards stay on the discard pile instead of going back into the deck");
throwsWith(() => F.nextRound(r2, "Isi"), /läuft noch/, "only after a round");

/* ---------- empty deck ---------- */
s = table(["Isi", "Benji"], { Isi: seat([5]), Benji: seat([8]) }, []);
s.discard = ["n9"];
s = F.hit(s, "Isi");
ok(s.table.Isi.numbers.includes(9) && s.lastMove.events.some(e => e.type === "reshuffle"), "empty deck: the discard pile becomes the new deck, cards on the table stay");

/* ---------- end of the game ---------- */
s = table(["Isi", "Benji"], { Isi: seat([10], { status: "stayed" }), Benji: seat([4]) }, ["n3"]);
s.scores = { Isi: 195, Benji: 150 };
s.turnPerson = "Benji";
s = F.stay(s, "Benji");
ok(s.phase === "finished" && s.result.winner === "Isi" && s.wins.Isi === 1, "205 points: Isi wins the game");
const rematch = F.newGame(s, "Benji");
ok(rematch.scores.Isi === 0 && rematch.gameNo === 2 && rematch.wins.Isi === 1 && rematch.phase !== "finished", "a new game keeps the tally of wins");
s = table(["Isi", "Benji"], { Isi: seat([10], { status: "stayed" }), Benji: seat([10]) }, ["n3"]);
s.scores = { Isi: 195, Benji: 195 };
s.turnPerson = "Benji";
s = F.stay(s, "Benji");
ok(s.phase === "round-over" && s.tieBreak, "a tie at the top over 200: one more round");

/* ---------- simulation: hundreds of random games ---------- */
let games = 0;
let rounds = 0;
let flip7s = 0;
for (let seed = 1; seed <= 300; seed++) {
  const rand = seeded(seed);
  const players = ["A", "B", "C", "D"].slice(0, 2 + (seed % 3));
  let st = F.createInitialState(players, rand);
  for (let step = 0; step < 4000 && st.phase !== "finished"; step++) {
    assert.equal(F.countCards(st), 94, `card count at seed ${seed}`);
    if (st.phase === "round-over") {
      rounds++;
      if (st.lastRound.flip7By) flip7s++;
      st = F.nextRound(st, players[0], rand);
    } else if (st.choice) {
      const c = st.choice.candidates;
      st = F.chooseTarget(st, st.choice.chooser, c[Math.floor(rand() * c.length)], rand);
    } else {
      const me = st.turnPerson;
      const points = F.scoreOf(st.table[me]);
      st = rand() < (points > 25 ? 0.3 : 0.75) ? F.hit(st, me, rand) : F.stay(st, me, rand);
    }
  }
  assert.equal(st.phase, "finished", `game ${seed} ends`);
  assert.ok(Math.max(...players.map(p => st.scores[p])) >= 200);
  games++;
}
ok(games === 300, `300 random games with 2–4 players end properly (${rounds} rounds, ${flip7s} Flip 7s), no card ever lost`);

console.log(`\n${assertions} assertions passed (flip7-engine)`);
