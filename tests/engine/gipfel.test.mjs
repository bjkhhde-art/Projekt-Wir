import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../../gipfel-engine.js");
const Bots = require("../../game-bots.js");

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
/* a hand-made table: Isi is to act (already drew), `deck` lists the cards in the order they will be drawn */
function table(hands, extra = {}) {
  const players = Object.keys(hands);
  const s = G.createInitialState(players, seeded(1));
  s.hands = JSON.parse(JSON.stringify(hands));
  s.deck = (extra.deck || ["m9-1", "m8-1", "m7-1"]).slice().reverse();
  s.discard = extra.discard || ["g1-1"];
  s.groups = [];
  s.laid = Object.fromEntries(players.map(p => [p, false]));
  s.skip = Object.fromEntries(players.map(p => [p, false]));
  s.turnPerson = players[0];
  s.step = "act";
  delete extra.deck;
  delete extra.discard;
  return Object.assign(s, extra);
}

/* ---------- the cards ---------- */
const deck = G.createDeck();
ok(deck.length === 90 && new Set(deck).size === 90, "90 different cards");
ok(deck.filter(G.isNatural).length === 80 && deck.filter(G.isJoker).length === 6 && deck.filter(G.isStone).length === 4, "80 numbers, 6 Sterne, 4 Steinschläge");
ok(G.COLOURS.every(c => deck.filter(x => G.colourOf(x) === c).length === 20), "each colour: 1–10 twice");
ok(G.pointsOf("r7-0") === 7 && G.pointsOf("J-0") === 20 && G.pointsOf("S-0") === 15, "points: the number, Stern 20, Steinschlag 15");
ok(G.ETAPPEN.length === 10 && G.ETAPPEN.every(e => e.groups.reduce((s, g) => s + g.size, 0) <= G.HAND_SIZE), "ten Phasen, each fits into a hand of 9");

/* ---------- groups ---------- */
ok(G.makeGroup("set", ["r5-0", "v5-1", "J-0"], 3).value === 5, "a Drilling with a Stern");
ok(G.makeGroup("set", ["r5-0", "v6-1"], 2) === null, "different numbers are no Paar");
ok(G.makeGroup("set", ["J-0", "J-1"], 2) === null, "a group needs at least one real number");
ok(G.makeGroup("set", ["S-0", "r5-0"], 2) === null, "a Steinschlag never goes into a group");
const run = G.makeGroup("run", ["r3-0", "J-1", "m5-0", "g6-0", "v7-1"], 5);
ok(run && run.start === 3 && run.cards[1] === "J-1", "a Fünferreihe 3–7, the Stern stands in for the 4");
ok(G.makeGroup("run", ["r3-0", "m3-1", "g4-0"], 3) === null, "a number twice breaks a row");
ok(G.makeGroup("run", ["r9-0", "m10-1", "J-0"], 3).start === 8, "at the top end the Stern goes below: 8–10");
ok(G.makeGroup("run", ["r1-0", "m5-1", "J-0"], 3) === null, "1 and 5 are too far apart for three cards");
ok(G.makeGroup("color", ["m1-0", "m9-0", "m4-1", "J-2", "m2-0"], 5).colour === "m", "Fünf in Grün");
ok(G.makeGroup("crun", ["v2-0", "v3-0", "J-0", "v5-1"], 4).start === 2, "a Farbreihe in Blau");
ok(G.makeGroup("crun", ["v2-0", "r3-0", "v4-0", "v5-1"], 4) === null, "a Farbreihe needs one colour");

ok(G.extendGroup(run, "m8-0").cards.length === 6 && G.extendGroup(run, "r2-1").start === 2, "a row grows at both ends");
ok(G.extendGroup(run, "r5-1") === null, "but not in the middle");
ok(G.extendGroup(G.makeGroup("run", ["r8-0", "r9-0", "r10-0"], 3), "J-0").start === 7, "a Stern on a row that ends at 10 goes below");
ok(G.extendGroup(G.makeGroup("set", ["r5-0", "v5-0"], 2), "g5-1") && !G.extendGroup(G.makeGroup("set", ["r5-0", "v5-0"], 2), "g6-1"), "a Paar takes the same number only");
ok(G.extendGroup(G.makeGroup("crun", ["v2-0", "v3-0", "v4-0", "v5-1"], 4), "r6-0") === null, "a Farbreihe takes its colour only");

ok(G.partition(0, ["r1-0", "v1-0", "r4-0", "g4-0", "m9-0", "J-0"]).length === 3, "Drei Paare, one with a Stern");
ok(G.partition(1, ["r5-0", "v5-1", "g5-0", "m1-0", "m2-0", "r3-1"]) !== null, "Drilling + Dreierreihe in any order");
ok(G.partition(1, ["r5-0", "v5-1", "g5-0", "m1-0", "m2-0"]) === null, "one card short");
ok(G.partition(2, ["r1-0", "v2-0", "g3-1", "m7-0", "J-1", "r9-0"]) !== null, "Zwei Dreierreihen: 1–3 and 7–9 with a Stern");
ok(G.partition(2, ["r1-0", "v2-0", "g3-1", "m7-0", "m7-1", "r9-0"]) === null, "a 7 twice is no row");
ok(G.partition(8, ["r6-0", "v6-0", "g6-1", "J-2", "m2-0", "m3-0", "r4-1"]) !== null, "Vierling + Dreierreihe");
ok(G.findLaydown(3, ["r1-0", "r2-1", "J-0", "g4-0", "m5-0", "S-1", "v9-0", "r9-1", "g9-1"]).length === 5, "the hint finds the Fünferreihe");
ok(G.findLaydown(3, ["r1-0", "r2-1", "g4-0", "m6-0", "S-1", "v9-0", "r9-1", "g9-1", "m10-0"]) === null, "and says when there is none");
ok(G.findLaydown(0, ["r1-0", "v1-0", "r4-0", "g4-0", "m9-0", "J-0", "m2-0"]).includes("J-0"), "the hint spends a Stern when it is needed");
ok(!G.findLaydown(0, ["r1-0", "v1-0", "r4-0", "g4-0", "m9-0", "g9-0", "J-0"]).includes("J-0"), "no Stern spent when three real Paare are there");

/* ---------- the deal ---------- */
const s0 = G.createInitialState(["Isi", "Benji", "Udiou"], seeded(7));
ok(s0.players.every(p => s0.hands[p].length === 9) && s0.discard.length === 1 && G.countCards(s0) === 90, "everybody gets 9 cards, one lies open");
ok(s0.turnPerson === s0.players[(s0.dealer + 1) % 3] && s0.step === "draw", "the one after the dealer starts by drawing");
ok(s0.lastMove.type === "deal" && s0.lastMove.events.filter(e => e.type === "deal").length === 27, "the deal is one move with every card in it (for the animation)");
throwsWith(() => G.createInitialState(["Isi"]), /2 bis 4/, "at least two");

/* ---------- a turn ---------- */
let s = G.createInitialState(["Isi", "Benji"], seeded(3));
const first = s.turnPerson;
const other = s.players.find(p => p !== first);
throwsWith(() => G.drawDeck(s, other), /am Zug/, "only the one whose turn it is");
throwsWith(() => G.discard(s, first, s.hands[first][0]), /Zieh zuerst/, "first draw, then discard");
const open = s.discard[0];
if (!G.isStone(open)) {
  const took = G.drawDiscard(s, first);
  ok(took.hands[first].includes(open) && took.discard.length === 0 && took.step === "act", "the open card can be taken");
}
s = G.drawDeck(s, first);
ok(s.hands[first].length === 10 && s.step === "act", "drawing from the deck");
throwsWith(() => G.drawDeck(s, first), /schon eine Karte/, "only one card per turn");
const thrown = s.hands[first].find(c => !G.isStone(c));
s = G.discard(s, first, thrown);
ok(s.hands[first].length === 9 && s.discard[s.discard.length - 1] === thrown && s.turnPerson === other && s.step === "draw", "discarding ends the turn");

/* ---------- laying out, adding, going out ---------- */
s = table({
  Isi: ["r1-0", "v1-0", "r4-0", "g4-0", "m9-0", "J-0", "v6-0", "v7-0", "S-0", "m10-0"],
  Benji: ["g2-0", "g2-1", "r3-0", "m3-0", "v8-0", "v8-1", "g5-0", "g6-0", "g7-0"]
});
throwsWith(() => G.addToGroup(s, "Isi", "v6-0", 1), /erst, wenn deine Phase/, "adding only after the own Phase");
throwsWith(() => G.layDown(s, "Isi", ["r1-0", "v1-0", "r4-0", "m9-0", "J-0", "g4-0", "v6-0"]), /klappt/, "every chosen card must fit into the Phase");
s = G.layDown(s, "Isi", ["r1-0", "v1-0", "r4-0", "g4-0", "m9-0", "J-0"]);
ok(s.laid.Isi && s.groups.length === 3 && s.groups.every(gr => gr.owner === "Isi") && s.hands.Isi.length === 4, "Drei Paare lie on the table");
ok(s.lastMove.events[0].type === "lay" && s.lastMove.events[0].cards.length === 6, "the move tells which cards flew where");
throwsWith(() => G.layDown(s, "Isi", ["v6-0", "v7-0"]), /schon aus/, "only one Phase per round");
const pairOf9 = s.groups.find(gr => gr.value === 9).id;
throwsWith(() => G.addToGroup(s, "Isi", "v6-0", pairOf9), /passt da nicht/, "a 6 does not fit a 9er Paar");
s = G.discard(s, "Isi", "S-0");
ok(s.skip.Benji === false && s.turnPerson === "Isi" && s.lastMove.events.some(e => e.type === "stone" && e.target === "Benji") && s.lastMove.events.some(e => e.type === "skip" && e.person === "Benji"), "a Steinschlag: Benji sits out, Isi plays again");
s = G.drawDeck(s, "Isi");
ok(s.hands.Isi.includes("m9-1"), "Isi draws the Grün 9");
s = G.addToGroup(s, "Isi", "m9-1", pairOf9);
ok(s.groups.find(gr => gr.id === pairOf9).cards.length === 3, "and adds it to her 9er Paar");
s.hands.Isi = ["v6-0"];
s = G.discard(s, "Isi", "v6-0");
ok(s.phase === "round-over" && s.lastRound.out === "Isi", "no cards left: the round is over");
ok(s.etappe.Isi === 1 && s.etappe.Benji === 0, "Isi climbs to Phase 2, Benji stays");
ok(s.lastRound.points.Benji === 2 + 2 + 3 + 3 + 8 + 8 + 5 + 6 + 7 && s.scores.Benji === 44 && s.scores.Isi === 0, "Benji counts his hand: 44 points");
throwsWith(() => G.drawDeck(s, "Benji"), /vorbei/, "nothing more to play");
const r2 = G.nextRound(s, "Isi", seeded(5));
ok(r2.round === 2 && r2.groups.length === 0 && G.countCards(r2) === 90 && r2.etappe.Isi === 1 && r2.scores.Benji === 44, "next round: fresh cards, Phasen and points carry over");

/* going out by laying everything at once */
s = table({ Isi: ["r5-0", "r6-0", "J-0", "r8-0", "m9-0", "r10-1", "g7-0"], Benji: ["g2-0"] }, { etappe: { Isi: 9, Benji: 9 } });
s = G.layDown(s, "Isi", ["r5-0", "r6-0", "J-0", "r8-0", "m9-0", "r10-1", "g7-0"]);
ok(s.phase === "finished" && s.result.winners.join() === "Isi" && s.wins.Isi === 1, "the Siebenerreihe on the last Phase: Isi wins");

/* two on the summit in the same round: fewer points win */
s = table({ Isi: ["r9-0"], Benji: ["g2-0"] }, { etappe: { Isi: 9, Benji: 9 }, scores: { Isi: 10, Benji: 30 } });
s.laid = { Isi: true, Benji: true };
s = G.discard(s, "Isi", "r9-0");
ok(s.phase === "finished" && s.result.winners.join() === "Isi" && s.scores.Benji === 32, "both on the summit – Isi has fewer points");

/* an empty deck: the discard is shuffled into a new one */
s = table({ Isi: ["r1-0"], Benji: ["g2-0"] }, { deck: [], discard: ["m1-0", "m2-0", "m3-0"] });
s.step = "draw";
s = G.drawDeck(s, "Isi", seeded(2));
ok(s.discard.join() === "m3-0" && s.hands.Isi.length === 2 && s.lastMove.events[0].type === "reshuffle", "the deck runs out: all but the open card are shuffled anew");
s = table({ Isi: ["r1-0"], Benji: ["g2-0"] }, { discard: ["S-1"] });
s.step = "draw";
throwsWith(() => G.drawDiscard(s, "Isi"), /Aussetzen/, "an Aussetzen card cannot be picked up");

/* ---------- whole games with the computer players ---------- */
for (const players of [["Udiou", "Klausi"], ["Isi", "Udiou", "Klausi"], ["Isi", "Benji", "Udiou", "Klausi"]]) {
  let rounds = 0;
  for (let game = 0; game < 25; game++) {
    let st = G.createInitialState(players);
    for (let guard = 0; st.phase !== "finished"; guard++) {
      assert.ok(guard < 20000, "a game hangs");
      if (st.phase === "round-over") { st = G.nextRound(st, players[0]); continue; }
      st = Bots.gipfel.play(st, st.turnPerson);
      assert.ok(st && G.countCards(st) === 90, "every card stays somewhere");
    }
    rounds += st.round;
    assert.ok(st.result.winners.every(p => st.etappe[p] === G.ETAPPEN.length));
  }
  ok(rounds / 25 >= 8, `${players.length} bots always reach the summit (${(rounds / 25).toFixed(1)} rounds on average)`);
}
const bot = table({ Udiou: ["r5-0", "v5-0", "g5-0", "m1-0", "m2-0", "m3-0", "S-0", "v9-1", "g10-0", "r7-0"], Isi: ["g2-0"] }, { etappe: { Udiou: 1, Isi: 0 } });
const laidByBot = Bots.gipfel.play(bot, "Udiou");
ok(laidByBot.laid.Udiou && laidByBot.groups.length === 2, "a bot lays out its Phase as soon as it can");
ok(Bots.gipfel.play(laidByBot, "Isi") === null, "and never plays for anybody else");
const stoneThrow = Bots.gipfel.play({ ...laidByBot, hands: { ...laidByBot.hands, Udiou: ["S-0", "v9-1"] } }, "Udiou");
ok(stoneThrow.lastMove.events.some(e => e.type === "stone" && e.target === "Isi"), "a bot throws a Steinschlag at the next one");

/* the third time the deck runs empty, the round ends without anybody going out */
{
  let st = table({ Isi: ["r1-0"], Benji: ["g2-0"] }, { deck: [], discard: ["m1-0", "m2-0", "m3-0"], reshuffles: 2 });
  st.laid = { Isi: true, Benji: false };
  st.step = "draw";
  st = G.drawDeck(st, "Isi");
  ok(st.phase === "round-over" && st.lastMove.events.some(e => e.type === "deck-end") && st.lastRound.out === null, "deck empty for the third time: the round ends");
  ok(st.etappe.Isi === 1 && st.etappe.Benji === 0 && st.scores.Isi === 1 && st.scores.Benji === 2, "whoever laid out climbs, everybody counts their cards");
}

/* ---------- own Phasen from phasen.json ---------- */
{
  const fs = require("node:fs");
  const file = JSON.parse(fs.readFileSync(new URL("../../phasen.json", import.meta.url), "utf8"));
  const fromFile = G.parseRules(file);
  ok(fromFile.handSize === 9 && fromFile.etappen.length === G.ETAPPEN.length && JSON.stringify(fromFile.etappen) === JSON.stringify(G.ETAPPEN), "phasen.json in the repository holds exactly the default Phasen");

  const own = G.parseRules({ handKarten: 11, phasen: [
    { name: "Zwei Vierer", gruppen: [{ art: "gleiche", anzahl: 4 }, { art: "gleiche", anzahl: 4 }] },
    { gruppen: [{ art: "folge", anzahl: 9 }] },
    { name: "Bunt", gruppen: [{ art: "farbe", anzahl: 6 }, { art: "farbfolge", anzahl: 3 }] }
  ] });
  ok(own.handSize === 11 && own.etappen.length === 3 && own.etappen[1].name === "Reihe aus 9", "own Phasen: hand size, groups, a missing name is made up");
  throwsWith(() => G.parseRules({ phasen: [{ name: "x", gruppen: [{ art: "drilling", anzahl: 3 }] }] }), /art/, "an unknown kind is refused");
  throwsWith(() => G.parseRules({ phasen: [{ name: "x", gruppen: [{ art: "folge", anzahl: 11 }] }] }), /anzahl/, "a row longer than 10 is refused");
  throwsWith(() => G.parseRules({ handKarten: 9, phasen: [{ name: "x", gruppen: [{ art: "gleiche", anzahl: 6 }, { art: "gleiche", anzahl: 5 }] }] }), /11 Karten/, "more cards than a hand can hold are refused");
  throwsWith(() => G.parseRules({ handKarten: 20, phasen: [{ gruppen: [{ art: "folge", anzahl: 3 }] }] }), /handKarten/, "the hand size is limited");
  throwsWith(() => G.parseRules({ phasen: [] }), /mindestens einer Phase/, "at least one Phase");

  const s1 = G.createInitialState(["Isi", "Benji"], seeded(4), own);
  ok(s1.players.every(p => s1.hands[p].length === 11) && s1.etappen.length === 3 && G.countCards(s1) === 90, "a game with own Phasen deals 11 cards each");
  const t1 = Object.assign(s1, { turnPerson: "Isi", step: "act", hands: { Isi: ["r4-0", "v4-0", "g4-0", "m4-1", "r8-0", "v8-1", "J-0", "m8-0", "S-0"], Benji: s1.hands.Benji } });
  const laidOwn = G.layDown(t1, "Isi", ["r4-0", "v4-0", "g4-0", "m4-1", "r8-0", "v8-1", "J-0", "m8-0"]);
  ok(laidOwn.laid.Isi && laidOwn.groups.length === 2, "the first own Phase (two Vierlinge) can be laid out");
  const old = G.createInitialState(["Isi", "Benji"], seeded(5));
  delete old.etappen;
  delete old.handSize;
  ok(G.etappenOf(old) === G.ETAPPEN && G.handSizeOf(old) === 9, "games from before keep the default Phasen");

  G.useRules(own);
  const fromDevice = G.createInitialState(["Isi", "Benji"], seeded(6));
  ok(fromDevice.etappen.length === 3 && fromDevice.handSize === 11, "new games use the Phasen loaded on the device");
  G.useRules(null);

  let rounds = 0;
  for (let game = 0; game < 20; game++) {
    let st = G.createInitialState(["Udiou", "Klausi", "Isi"], Math.random, own);
    for (let guard = 0; st.phase !== "finished"; guard++) {
      assert.ok(guard < 20000, "a game with own Phasen hangs");
      if (st.phase === "round-over") { st = G.nextRound(st, "Isi"); continue; }
      st = Bots.gipfel.play(st, st.turnPerson);
      assert.ok(G.countCards(st) === 90, "every card stays somewhere");
    }
    rounds += st.round;
    assert.ok(st.result.winners.every(p => st.etappe[p] === 3));
  }
  ok(rounds / 20 >= 3, `bots finish games with own Phasen too (${(rounds / 20).toFixed(1)} rounds on average)`);
}

console.log(`\n${assertions} assertions passed (gipfel engine)`);
