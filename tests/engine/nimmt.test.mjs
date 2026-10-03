import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../nimmt-engine.js");

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

/* ---------- Hornochsen (from the rule sheet) ---------- */
ok(E.bullsFor(55) === 7, "55 has 7 bulls");
ok([11, 22, 33, 44, 66, 77, 88, 99].every(c => E.bullsFor(c) === 5), "doubles have 5 bulls");
ok([10, 20, 50, 100].every(c => E.bullsFor(c) === 3), "tens have 3 bulls");
ok([5, 15, 25, 95].every(c => E.bullsFor(c) === 2), "fives have 2 bulls");
ok([1, 2, 7, 104].every(c => E.bullsFor(c) === 1), "all other cards have 1 bull");
const all = Array.from({ length: 104 }, (_, i) => i + 1);
ok(E.sumBulls(all) === 171, `the whole deck has 171 bulls (got ${E.sumBulls(all)})`);

/* ---------- setup ---------- */
let s = E.createInitialState("Isi", "Benji");
ok(s.hands.Isi.length === 10 && s.hands.Benji.length === 10, "each player gets 10 cards");
ok(s.rows.length === 3 && s.rows.every(r => r.length === 1), "three rows with one card each (house rule for two)");
const inPlay = [...s.hands.Isi, ...s.hands.Benji, ...s.rows.flat()];
ok(new Set(inPlay).size === 23 && inPlay.every(c => c >= 1 && c <= 104), "23 distinct cards from 1-104 are in play");
ok(s.phase === "choose" && s.trick === 1, "the game starts with everyone choosing a card");
ok(s.lastMove.type === "deal", "the deal is recorded for the animation");

/* ---------- rules 1 + 2 with Abb. 1 / Abb. 2 ---------- */
const abb1 = [[12], [37], [43], [58]];
ok(E.rowFor(abb1, 14) === 0 && E.rowFor(abb1, 15) === 0, "14 and 15 go behind the 12");
ok(E.rowFor(abb1, 44) === 2, "44 fits rows 1-3 but goes to row 3 (smallest difference)");
ok(E.rowFor(abb1, 61) === 3, "61 goes to row 4");
ok(E.rowFor(abb1, 3) === -1, "a card lower than every row end has no row");

/* helper: fixed state with chosen hands and rows */
function fixed(rows, isiHand, benjiHand) {
  const st = E.createInitialState("Isi", "Benji");
  st.rows = rows.map(r => r.slice());
  st.hands = { Isi: isiHand.slice(), Benji: benjiHand.slice() };
  return st;
}

/* ---------- simultaneous choosing ---------- */
s = fixed([[12], [37], [43], [58]], [14, 90], [44, 91]);
s = E.chooseCard(s, "Isi", 14);
ok(s.chosen.Isi === 14 && s.phase === "choose", "Isi's choice waits for Benji");
ok(s.lastMove.type === "choose" && s.lastMove.person === "Isi", "choosing is recorded (Benji sees that Isi has chosen)");
s = E.chooseCard(s, "Isi", 90);
ok(s.chosen.Isi === 90, "Isi can switch her card until both have chosen");
s = E.chooseCard(s, "Isi", 90);
ok(s.chosen.Isi === null, "tapping the chosen card again takes it back");
s = E.chooseCard(s, "Isi", 14);
throwsWith(() => E.chooseCard(s, "Isi", 44), /nicht auf der Hand/, "you can only play your own cards");
s = E.chooseCard(s, "Benji", 44);
ok(s.lastMove.type === "reveal", "once both have chosen the cards are revealed");
ok(JSON.stringify(s.rows) === JSON.stringify([[12, 14], [37], [43, 44], [58]]), `cards placed by rules 1 + 2 (${JSON.stringify(s.rows)})`);
ok(s.lastMove.placements[0].card === 14 && s.lastMove.placements[1].card === 44, "the lower card is placed first");
ok(!s.hands.Isi.includes(14) && !s.hands.Benji.includes(44), "played cards leave the hands");
ok(s.phase === "choose" && s.trick === 2, "next trick");

/* ---------- rule 3: sixth card takes the row (Abb. 3) ---------- */
s = fixed([[12, 14, 15, 21, 26], [37], [43, 44], [58, 61]], [30, 1], [36, 2]);
s = E.chooseCard(s, "Isi", 30);
s = E.chooseCard(s, "Benji", 36);
ok(JSON.stringify(s.rows[0]) === JSON.stringify([30, 36]), `30 takes the full row and becomes its first card, 36 follows (${JSON.stringify(s.rows[0])})`);
ok(JSON.stringify(s.penalties.Isi) === JSON.stringify([12, 14, 15, 21, 26]), "Isi takes the five cards");
ok(s.penalties.Benji.length === 0, "Benji takes nothing");
const fullPlacement = s.lastMove.placements[0];
ok(fullPlacement.reason === "full" && fullPlacement.took.length === 5, "the placement records why and what was taken");

/* ---------- rule 4: too-low card picks a row (Abb. 4) ---------- */
s = fixed([[30, 36], [37, 47, 52], [43, 44], [58, 61, 63]], [3, 68], [9, 83]);
s = E.chooseCard(s, "Isi", 3);
s = E.chooseCard(s, "Benji", 9);
ok(s.phase === "pick-row" && s.pickPerson === "Isi", "the 3 fits nowhere: Isi has to pick a row");
ok(s.lastMove.type === "reveal" && s.lastMove.placements.length === 0, "both cards are revealed but not placed yet");
ok(s.revealed.length === 2, "both revealed cards wait on the table");
throwsWith(() => E.pickRow(s, "Benji", 0), /Nicht du/, "only Isi may pick the row");
throwsWith(() => E.chooseCard(s, "Benji", 83), /kann keine Karte/, "nobody can play while a row is being picked");
s = E.pickRow(s, "Isi", 1);
ok(JSON.stringify(s.rows[1]) === JSON.stringify([3, 9]), `Isi took row 2, the 3 starts it and the 9 follows (${JSON.stringify(s.rows[1])})`);
ok(JSON.stringify(s.penalties.Isi) === JSON.stringify([37, 47, 52]), "Isi takes the cards of the row she picked");
ok(s.lastMove.type === "resolve" && s.lastMove.placements.length === 2 && s.lastMove.placements[0].reason === "low", "the resolution is recorded");
ok(s.phase === "choose", "play continues");

/* ---------- a whole game ends after 10 tricks ---------- */
function playRandomGame(st) {
  let steps = 0;
  while (st.phase !== "finished") {
    if (++steps > 200) throw new Error("game did not end");
    if (st.phase === "choose") {
      for (const p of st.players) {
        if (st.phase === "choose" && st.chosen[p] === null) {
          const hand = st.hands[p];
          st = E.chooseCard(st, p, hand[Math.floor(Math.random() * hand.length)]);
        }
      }
    } else if (st.phase === "pick-row") {
      st = E.pickRow(st, st.pickPerson, Math.floor(Math.random() * st.rows.length));
    }
    const cards = [...st.players.flatMap(p => st.hands[p]), ...st.rows.flat(), ...st.players.flatMap(p => st.penalties[p]), ...(st.revealed || []).map(r => r.card)];
    assert.equal(cards.length, 23, "card conservation: always 23 cards in play");
    assert.equal(st.rows.length, 3, "always three rows");
    assert.equal(new Set(cards).size, 23, "no card duplicated");
    assert.ok(st.rows.every(r => r.length >= 1 && r.length <= 5), "rows hold 1-5 cards");
    assert.ok(st.rows.every(r => r.every((c, i) => i === 0 || c > r[i - 1])), "rows are always ascending");
  }
  return st;
}

let g = playRandomGame(E.createInitialState("Isi", "Benji"));
ok(g.phase === "finished" && g.trick === 10, "a game ends after 10 tricks");
ok(g.result.bulls.Isi === E.sumBulls(g.penalties.Isi) && g.result.bulls.Benji === E.sumBulls(g.penalties.Benji), "the result counts each player's bulls");
const expectedWinner = g.result.bulls.Isi === g.result.bulls.Benji ? null : (g.result.bulls.Isi < g.result.bulls.Benji ? "Isi" : "Benji");
ok(g.result.winner === expectedWinner, `fewer bulls wins (${JSON.stringify(g.result)})`);
throwsWith(() => E.chooseCard(g, "Isi", 1), /kann keine Karte/, "no plays after the game is over");

const r = E.rematch(g);
ok(r.phase === "choose" && r.gameNo === 2 && r.hands.Isi.length === 10, "a rematch deals a fresh game");
ok(JSON.stringify(r.wins) === JSON.stringify(g.wins), "the win tally carries over");
ok(r.moveSeq === g.moveSeq + 1 && r.lastMove.type === "deal", "the rematch deal continues the move sequence");
throwsWith(() => E.rematch(r), /läuft noch/, "no rematch while a game is running");

/* ---------- many random games: invariants + tie handling ---------- */
let ties = 0;
for (let i = 0; i < 300; i++) {
  const end = playRandomGame(E.createInitialState("Isi", "Benji"));
  if (end.result.winner === null) {
    ties++;
    assert.ok(end.wins.Isi === 0 && end.wins.Benji === 0, "a tie gives nobody a win");
  }
}
ok(true, `300 random games played with all invariants holding (${ties} ties)`);

console.log(`\n${assertions} assertions passed (nimmt-engine)`);
