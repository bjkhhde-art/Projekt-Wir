import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../../murphy-engine.js");
const Bots = require("../../game-bots.js");
const json = require("../../murphy-karten.json");

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
const rules = M.parseCards(json);
const fresh = (players = ["Isi", "Benji"], seed = 1) => M.createInitialState(players, seeded(seed), rules);
/* a hand-made table: Isi is to take; deck lists cards in the order they will be drawn */
function table(hands, extra = {}) {
  const s = fresh(Object.keys(hands));
  const placed = new Set([...Object.values(hands).flat(), ...(extra.deck || []), ...(extra.basar || []), ...(extra.piles || []).flat()]);
  const rest = [...M.numberCards(), ...M.actionCards(rules)].filter(c => !placed.has(c));
  s.hands = JSON.parse(JSON.stringify(hands));
  s.basar = extra.basar || [];
  s.piles = extra.piles || [[], []];
  s.actionPile = rest.filter(M.isAction);
  s.deck = [...rest.filter(M.isNumber), ...(extra.deck || []).slice().reverse()];
  s.turnPerson = Object.keys(hands)[0];
  s.step = "take";
  s.trade = null;
  s.tradesLeft = 1;
  s.actionPlayed = false;
  s.murphy = Object.fromEntries(Object.keys(hands).map(p => [p, extra.murphy && extra.murphy[p] || "m02"]));
  return s;
}

/* ---------- the cards ---------- */
const numbers = M.numberCards();
ok(numbers.length === 72 && new Set(numbers).size === 72, "72 different number cards");
ok(["r", "y", "g"].every(c => numbers.filter(n => M.colourOf(n) === c).length === 24), "24 per colour");
ok(numbers.filter(n => M.valueOf(n) === 2).length === 3 && numbers.filter(n => M.valueOf(n) === 5).length === 6 && numbers.filter(n => M.valueOf(n) === 9).length === 9,
  "1–3 once, 4–6 twice, 7–11 three times per colour");
ok(M.actionCards(rules).length === 17 && rules.murphy.length === 21, "the card file has 17 action cards and 21 Murphy cards");
ok(rules.actions.filter(a => a.colour === "rot").reduce((s, a) => s + a.copies, 0) === 9, "9 red action cards, 8 green ones");

/* ---------- murphy-karten.json ---------- */
const withMurphy = list => ({ ...json, murphy: list });
throwsWith(() => M.parseCards(withMurphy([...json.murphy, { id: "m01", text: "doppelt" }])), /zweimal/, "a Murphy id twice is refused");
throwsWith(() => M.parseCards(withMurphy([{ id: "x1", text: "t", bedingung: { quatsch: 1 } }, ...json.murphy])), /quatsch/, "an unknown condition says which word it does not know");
throwsWith(() => M.parseCards(withMurphy([{ id: "x1", text: "t", bedingung: { farbe: "blau" } }, ...json.murphy])), /rot/, "an unknown colour is refused");
throwsWith(() => M.parseCards({ ...json, aktionen: [{ id: "a", farbe: "rot", wirkung: "doppelzug" }] }), /nur als grüne/, "doppelzug only as a green card");
throwsWith(() => M.parseCards({ ...json, aktionen: [{ id: "a", farbe: "rot", wirkung: "fliegen" }] }), /wirkung/, "an unknown effect is refused");
const fewer = M.parseCards(withMurphy(json.murphy.map((m, i) => (i < 3 ? { ...m, aktiv: false } : m))));
ok(fewer.murphy.length === 18 && !fewer.murphy.some(m => m.id === "m01"), "\"aktiv\": false takes a Murphy card out without deleting it");
const added = M.parseCards(withMurphy([...json.murphy, { id: "neu-1", text: "Nur noch Siebenen", bild: "murphy-neu-1.png" }]));
ok(added.murphy.length === 22 && added.murphy[21].check === null && added.murphy[21].image === "murphy-neu-1.png", "a new card without condition is added, with its picture");
ok(M.parseCards(withMurphy([{ id: "x", text: "t", bild: "../geheim.png" }, ...json.murphy])).murphy[0].image === undefined, "picture names cannot leave the card folder");

/* ---------- Murphy tasks ---------- */
const m = id => rules.murphy.find(c => c.id === id).check;
ok(M.fulfils(m("m01"), ["r1-0", "r3-0", "r4-0", "r4-1", "r8-0"]), "the rule book example: Rot 1, 3, 4, 4, 8 fulfils 'one colour, at most 29, at least 5'");
ok(M.fulfils(m("m01"), ["r1-0", "r3-0", "r4-0", "r4-1", "r8-0", "r7-0"]), "with the Rot 7 too (sum 27)");
ok(!M.fulfils(m("m01"), ["r1-0", "r3-0", "r4-0", "r4-1", "r8-0", "g1-0"]), "an extra Grün 1 spoils it – the hand must fulfil it exactly");
ok(M.fulfils(m("m01"), ["r1-0", "r3-0", "r4-0", "r4-1", "r8-0", "A.klauen.0"]), "green action cards in hand do not count");
ok(M.fulfils(m("m08"), ["r4-0", "g4-0", "y7-0", "y7-1", "g2-0", "r2-0"]) && !M.fulfils(m("m08"), ["r4-0", "g4-0", "y4-0", "y7-1", "g2-0", "r2-0"]), "three pairs, and not a Drilling instead");
ok(M.fulfils(m("m03"), ["r3-0", "y4-0", "g5-0", "r6-0", "y7-0"]) && !M.fulfils(m("m03"), ["r3-0", "y4-0", "g5-0", "r6-0", "y8-0"]), "a row needs no gap");
ok(M.fulfils(m("m19"), ["r3-0", "r5-0", "r9-0", "g1-0", "g2-0", "g11-0"]) && !M.fulfils(m("m19"), ["r3-0", "r5-0", "r9-0", "g1-0", "g2-0", "y11-0"]), "two colours with three each");
ok(M.fulfils(m("m20"), ["g11-2"]) && !M.fulfils(m("m20"), ["g10-2"]), "a single 11");
ok(M.fulfils({ oder: [{ farbe: "rot" }, { farbe: "gelb" }] }, ["y1-0", "y2-0"]) && !M.fulfils({ oder: [{ farbe: "rot" }, { farbe: "gelb" }] }, ["y1-0", "r2-0"]), "'oder' takes either");
ok(M.taskDistance(m("m02"), ["r7-0", "g7-0", "y7-0", "r1-0"]) < M.taskDistance(m("m02"), ["r7-0", "g3-0", "y5-0", "r1-0"]), "the distance shows which hand is closer");

/* ---------- the deal ---------- */
const s0 = fresh(["Isi", "Benji", "Lea"], 3);
const total = M.totalCards(rules);
ok(M.countCards(s0) === total, "every card is somewhere after the deal");
const sizes = [1, 2, 3].map(k => s0.hands[s0.players[(s0.dealer + k) % 3]].length);
ok(sizes[0] === 8 && sizes[1] === 9 && sizes[2] === 10, `8, 9, 10 cards from the dealer's left (${sizes})`);
ok(s0.players.every(p => s0.hands[p].every(c => !M.isRed(s0, c))), "no red action card stays in a hand");
ok(s0.basar.length === 7 && s0.basar.every(M.isNumber) && s0.piles.every(p => p.length === 1 && M.isNumber(p[0])), "Basar of 7 and two open piles, numbers only");
ok(s0.players.every(p => s0.murphy[p]) && new Set(Object.values(s0.murphy)).size === 3, "everybody has their own Murphy card");
ok(s0.turnPerson === s0.players[(s0.dealer + 1) % 3] && s0.step === "take", "the one after the dealer begins by taking");

/* ---------- trading at the table ---------- */
const hands = { Isi: ["r1-0", "r2-0", "r3-0", "g9-0"], Benji: ["y5-0", "y6-0"] };
let s = table(hands, { piles: [["g5-0", "g6-0"], ["r10-0"]], deck: ["r11-0", "y11-0"] });
throwsWith(() => M.give(s, "Isi", ["r1-0"], [0]), /Nimm zuerst/, "first take, then give");
throwsWith(() => M.takeOpen(s, "Benji", 0, 1), /Isi ist am Zug/, "only the one whose turn it is");
let t = M.takeOpen(s, "Isi", 0, 2);
ok(t.hands.Isi.includes("g6-0") && t.hands.Isi.includes("g5-0") && t.piles[0].length === 0 && t.step === "give" && t.trade.give === 1, "two from an open pile → give one");
throwsWith(() => M.give(t, "Isi", ["r1-0", "r2-0"], [0, 0]), /genau eine/, "two for one means giving exactly one");
t = M.give(t, "Isi", ["g6-0"], [1]);
ok(t.piles[1].slice(-1)[0] === "g6-0" && t.turnPerson === "Benji" && t.step === "take", "a card just taken may go straight back; then it is Benji's turn");
t = M.takeBothOpen(table(hands, { piles: [["g5-0"], ["r10-0"]] }), "Isi");
ok(t.hands.Isi.includes("g5-0") && t.hands.Isi.includes("r10-0") && t.trade.give === 1, "one from each open pile");
t = M.takeOpen(table(hands, { piles: [["g5-0"], ["r10-0"]] }), "Isi", 1, 1);
ok(t.trade.give === 2, "one taken → two to give");
t = M.give(t, "Isi", ["r1-0", "r2-0"], [0, 1]);
ok(t.piles[0].slice(-1)[0] === "r1-0" && t.piles[1].slice(-1)[0] === "r2-0", "the two given cards may go on both piles");
throwsWith(() => M.takeOpen(table({ Isi: ["r1-0"], Benji: ["y5-0"] }, { piles: [["g5-0"], ["r10-0"]] }), "Isi", 0, 1), /zu wenige/, "one for two is not possible with only one number card");
throwsWith(() => M.give(M.takeOpen(table({ Isi: ["A.klauen.0", "r1-0"], Benji: ["y5-0"] }, { piles: [["g5-0", "g6-0"], ["r10-0"]] }), "Isi", 0, 2), "Isi", ["A.klauen.0"], [0]), /nur Zahlenkarten/, "action cards cannot be given away in a trade");

/* the hidden deck */
t = M.takeDeck(table(hands, { piles: [["g5-0"], ["r10-0"]], deck: ["r11-0", "y11-0"] }), "Isi", 2);
ok(t.hands.Isi.includes("r11-0") && t.hands.Isi.includes("y11-0") && t.trade.at === "stapel", "two from the deck");
t = M.takeDeck(table(hands, { piles: [["g5-0"], ["r10-0"]], deck: ["A.aussetzen.0", "y11-0"] }), "Isi", 2);
ok(t.step === "take" && t.trade === null, "a red card drawn ends the turn at once – nothing to give");
ok(t.hands.Isi.includes("y11-0") && !t.hands.Isi.includes("A.aussetzen.0") && t.actionPile.includes("A.aussetzen.0"), "the red card acts and is put on the action pile, the other card stays");
ok(t.lastMove.events.some(e => e.type === "skip" && e.person === "Benji") && t.turnPerson === "Isi", "Aussetzen: Benji sits out, so Isi again");
t = M.takeDeck(table({ Isi: ["r1-0"], Benji: ["y5-0"] }, { piles: [["g5-0"], ["r10-0"]], deck: ["A.klauen.0", "A.klauen.1", "r11-0", "y11-0"] }), "Isi", 2);
ok(t.step === "give" && t.hands.Isi.filter(M.isNumber).length >= 2, "one number card and two green cards drawn: they are swapped for new ones");

/* the Basar */
const basar = ["r4-0", "r5-0", "r6-0", "r7-0", "r8-0", "r9-0", "r10-0"];
s = table(hands, { basar, piles: [["g5-0"], ["r10-1"]] });
throwsWith(() => M.takeBasar(s, "Isi", ["r4-0"]), /mehr als 7/, "the Basar never has more than 7");
t = M.takeBasar(s, "Isi", ["r4-0", "r5-0"]);
ok(t.basar.length === 5 && t.trade.at === "basar" && t.trade.give === 1, "two from the Basar → give one there");
t = M.give(t, "Isi", ["g9-0"]);
ok(t.basar.length === 6 && t.basar.includes("g9-0") && t.piles[1].length === 1, "given into the Basar, not onto a pile");
t = M.takeBasar(t, "Benji", ["r6-0"]);
ok(t.trade.give === 2, "with six in the Basar one may be taken");

/* ---------- action cards ---------- */
s = table({ Isi: ["r1-0", "r2-0", "A.klauen.0", "A.doppelzug.0"], Benji: ["y5-0", "y6-0"], Lea: ["g1-0"] }, { piles: [["g5-0", "g6-0"], ["r10-0"]] });
throwsWith(() => M.playAction(s, "Isi", "A.klauen.0", {}), /andere Person/, "with three, the green card needs a target");
t = M.playAction(s, "Isi", "A.klauen.0", { target: "Benji" });
ok(t.hands.Benji.length === 1 && t.hands.Isi.filter(M.isNumber).length === 3 && t.turnPerson === "Benji", "Klauen takes one card, the turn is over");
t = M.playAction(s, "Isi", "A.doppelzug.0", {});
ok(t.step === "take" && t.tradesLeft === 2 && t.turnPerson === "Isi", "Doppelt tauschen: still Isi's turn");
throwsWith(() => M.playAction(t, "Isi", "A.klauen.0", { target: "Benji" }), /schon eine Aktionskarte/, "only one action card per turn");
t = M.give(M.takeOpen(t, "Isi", 0, 2), "Isi", ["r1-0"], [0]);
ok(t.turnPerson === "Isi" && t.step === "take", "after the first trade the second one");
t = M.give(M.takeBothOpen(t, "Isi"), "Isi", ["r2-0"], [0]);
ok(t.turnPerson === "Benji", "after the second trade the turn is over");
s = table({ Isi: ["r1-0", "r2-0", "r3-0", "A.abgeben.0", "A.ablegen.0", "A.neue-aufgabe.0"], Benji: ["y5-0"] }, { piles: [["g5-0"], ["r10-0"]] });
t = M.playAction(s, "Isi", "A.abgeben.0", { cards: ["r1-0", "r2-0"] });
ok(t.hands.Benji.includes("r1-0") && t.hands.Benji.includes("r2-0"), "Abgeben: the chosen cards go to the only other player");
throwsWith(() => M.playAction(s, "Isi", "A.ablegen.0", { cards: ["r1-0", "r2-0", "r3-0"] }), /1 bis 2/, "Ablegen: at most two");
t = M.playAction(s, "Isi", "A.ablegen.0", { cards: ["r1-0", "r2-0"] });
ok(t.hands.Isi.filter(M.isNumber).length === 1 && t.piles[0].includes("r2-0"), "Ablegen: discarded without taking");
t = M.playAction(s, "Isi", "A.neue-aufgabe.0", {});
ok(t.murphy.Isi !== s.murphy.Isi && t.murphyBack.includes(s.murphy.Isi), "Neue Aufgabe: the old Murphy card goes back, a new one comes");
s = table({ Isi: ["r1-0", "r2-0", "r3-0"], Benji: ["y5-0", "y6-0"], Lea: ["g1-0", "g2-0"] }, { piles: [["g5-0"], ["r10-0"]], deck: ["A.richtung.0", "r11-0"] });
t = M.takeDeck(s, "Isi", 2);
ok(t.direction === -1 && t.turnPerson === "Lea", "Richtungswechsel: Lea is next");
s = table({ Isi: ["r1-0", "r2-0", "r3-0"], Benji: ["y5-0", "y6-0"], Lea: ["g1-0", "g2-0"] }, { piles: [["g5-0"], ["r10-0"]], deck: ["A.murphy-weiter.0", "r11-0"], murphy: { Isi: "m01", Benji: "m03", Lea: "m04" } });
t = M.takeDeck(s, "Isi", 2);
ok(t.murphy.Benji === "m01" && t.murphy.Lea === "m03" && t.murphy.Isi === "m04", "Aufgaben weiter: every Murphy card moves on");
s = table({ Isi: ["r1-0", "r2-0", "r3-0"], Benji: ["y5-0"] }, { piles: [["g5-0"], ["r10-0"]], deck: ["A.tausch-zwang.0", "r11-0"] });
t = M.takeDeck(s, "Isi", 2);
ok(t.hands.Benji.filter(M.isNumber).sort().join() === "r1-0,r11-0,r2-0,r3-0" && t.hands.Isi.filter(M.isNumber).join() === "y5-0", "Zwangstausch: all number cards (with the one just drawn) change hands");

/* ---------- a Murphy card fulfilled ---------- */
s = table({ Isi: ["r7-0", "g7-0", "y7-0", "r7-1", "r1-0"], Benji: ["y5-0", "y6-0"] }, { piles: [["g5-0", "g6-0"], ["r10-0"]], murphy: { Isi: "m02", Benji: "m03" } });
t = M.give(M.takeOpen(s, "Isi", 0, 2), "Isi", ["r1-0", "g6-0"].slice(0, 1), [0]);
ok(t.phase === "play", "not yet: two more cards in hand than the task");
s = table({ Isi: ["r7-0", "g7-0", "y7-0", "r7-1", "r1-0", "r2-0"], Benji: ["y5-0", "y6-0"] }, { piles: [["g7-1"], ["r10-0"]], murphy: { Isi: "m02", Benji: "m03" } });
t = M.give(M.takeOpen(s, "Isi", 0, 1), "Isi", ["r1-0", "r2-0", "g7-1"].slice(0, 2), [0, 1]);
ok(t.phase === "play" && t.hands.Isi.filter(M.isNumber).length === 5, "five Siebenen are not exactly four");
s = table({ Isi: ["r7-0", "g7-0", "y7-0", "r1-0", "r2-0"], Benji: ["y5-0", "y6-0"] }, { piles: [["r7-1"], ["r10-0"]], murphy: { Isi: "m02", Benji: "m03" } });
t = M.give(M.takeOpen(s, "Isi", 0, 1), "Isi", ["r1-0", "r2-0"], [0, 0]);
ok(t.phase === "round-over" && t.won.Isi.join() === "m02" && t.lastRound.winner === "Isi", "four Siebenen: Isi keeps her Murphy card");
ok(t.murphyBack.includes("m03") && t.murphy.Benji === null, "Benji hands his back – dumm gelaufen");
const r2 = M.nextRound(t, "Isi", seeded(4));
ok(r2.phase === "play" && r2.round === 2 && r2.murphy.Isi && r2.murphy.Benji && r2.turnPerson === "Benji", "next round: new Murphy cards, Benji (after Isi) begins");
ok(r2.hands.Isi.join() === t.hands.Isi.join(), "the cards in hand stay");
const nearly = { ...t, won: { Isi: ["m05", "m06"], Benji: [] } };
const done = M.nextRound(nearly, "Isi", seeded(5));
const fin = M.claimMurphy({ ...done, murphy: { ...done.murphy, Isi: "m02" }, hands: { ...done.hands, Isi: ["r7-0", "g7-0", "y7-0", "r7-1"] } }, "Isi");
ok(fin.phase === "finished" && fin.result.winner === "Isi" && fin.wins.Isi === 1, "the third Murphy card wins the game");
throwsWith(() => M.claimMurphy(done, "Benji"), /noch nicht erfüllt/, "a checked Murphy card cannot be claimed early");
const again = M.newGame(fin, "Isi", seeded(6));
ok(again.phase === "play" && again.gameNo === 2 && again.wins.Isi === 1 && again.won.Isi.length === 0, "a new game keeps the wins");
const manual = { ...done, rules: added, murphy: { ...done.murphy, Benji: "neu-1" } };
ok(M.claimMurphy(manual, "Benji").lastRound.winner === "Benji", "a card without condition is claimed with 'Erfüllt!'");

/* ---------- computer players ---------- */
ok(Bots.murphy.play(fresh(), "Niemand") === null, "a bot never plays for anybody else");
for (let game = 0; game < 12; game++) {
  const players = game % 3 === 0 ? ["Udiou", "Klausi"] : game % 3 === 1 ? ["Udiou", "Klausi", "Isi"] : ["Udiou", "Klausi", "Isi", "Benji"];
  let st = M.createInitialState(players, seeded(100 + game), rules);
  const count = M.countCards(st);
  let moves = 0;
  while (st.phase !== "finished" && moves < 4000) {
    if (st.phase === "round-over") { st = M.nextRound(st, players[0], seeded(game + moves)); continue; }
    st = Bots.murphy.play(st, st.turnPerson);
    moves++;
    assert.equal(M.countCards(st), count);
    assert.ok(st.basar.length <= 7);
    if (st.phase === "play") players.forEach(p => assert.ok(st.hands[p].some(M.isNumber), "a number card stays"));
    const all = [...st.deck, ...st.basar, ...st.actionPile, ...st.piles.flat(), ...players.flatMap(p => st.hands[p])];
    assert.equal(new Set(all).size, all.length);
  }
  ok(st.phase === "finished", `bots finish a game with ${players.length} (${moves} moves), no card lost or doubled`);
}

console.log(`\n${assertions} assertions passed (murphy engine)`);
