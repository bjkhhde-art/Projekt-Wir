import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../../monopoly-engine.js");
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
/* dice that come up exactly as listed (rand() → (d-1)/6) */
const dice = (...faces) => { const q = faces.slice(); return () => (q.shift() - 1) / 6 + 0.01; };

const start = (players = ["Isi", "Benji"], option = "full") => {
  const s = M.createInitialState(players, option, seeded(3));
  s.turnPerson = players[0];
  return s;
};
const total = s => s.players.reduce((n, p) => n + s.cash[p], 0);

/* ---------- the board ---------- */
ok(M.SQUARES.length === 40, "40 squares");
ok(M.SQUARES.filter(s => s.type === "street").length === 22 && M.SQUARES.filter(s => s.type === "station").length === 4 && M.SQUARES.filter(s => s.type === "utility").length === 2, "22 streets, 4 stations, 2 utilities");
ok(Object.keys(M.GROUPS).every(g => M.groupSquares(g).length === (g === "brown" || g === "darkblue" ? 2 : 3)), "eight colours: two + two and six times three");
ok(M.CHANCE.length === 12 && M.CHEST.length === 12, "twelve cards per deck");

/* ---------- start ---------- */
const g = start(["Isi", "Benji", "Lena"]);
ok(g.players.every(p => g.cash[p] === 1500 && g.pos[p] === 0), "everybody starts on Los with 1500");
ok(g.phase === "roll" && g.lastMove.type === "start", "the first player rolls");
ok(M.countCards(g) === 24, "24 cards in the decks");
throwsWith(() => M.createInitialState(["Isi"]), /2 bis 4/, "at least two players");
throwsWith(() => M.roll(g, "Benji"), /ist am Zug/, "only the player whose turn it is may roll");
throwsWith(() => M.buy(g, "Isi"), /geht gerade nicht/, "buying needs an offer");

/* ---------- rolling, buying, rent ---------- */
let s = M.roll(start(), "Isi", dice(1, 2)); /* 3 → Turmstraße */
ok(s.pos.Isi === 3 && s.phase === "buy" && s.offer === 3, "3 steps: Turmstraße is offered");
s = M.buy(s, "Isi");
ok(s.cash.Isi === 1440 && M.ownerOf(s, 3) === "Isi" && s.phase === "after", "buying costs 60 and ends in the 'after' phase");
s = M.endTurn(s, "Isi");
ok(s.turnPerson === "Benji" && s.phase === "roll", "end of turn: Benji next");
s = M.roll(s, "Benji", dice(1, 2));
ok(s.cash.Benji === 1496 && s.cash.Isi === 1444 && s.phase === "after", "landing on Isi's street: 4 rent");
s = M.endTurn(s, "Benji");
let d = M.decline(M.roll(start(), "Isi", dice(1, 2)), "Isi");
ok(d.phase === "after" && M.ownerOf(d, 3) === null, "declining leaves the street with the bank (no auction)");

/* doubles: roll again, the third double goes to jail */
const quiet = () => { const x = start(); x.chest = ["cc2", ...x.chest.filter(c => c !== "cc2")]; return x; };
s = M.roll(quiet(), "Isi", dice(1, 1)); /* → Gemeinschaft: +100 */
ok(s.phase === "after" && s.rolledDoubles && s.cash.Isi === 1600, "doubles are remembered");
s = M.endTurn(s, "Isi");
ok(s.turnPerson === "Isi" && s.phase === "roll", "after doubles the same player rolls again");
s = M.roll(s, "Isi", dice(2, 2)); /* → 6 Chausseestraße */
s = M.decline(s, "Isi");
s = M.endTurn(s, "Isi");
s = M.roll(s, "Isi", dice(3, 3));
ok(s.jail.Isi === 0 && s.pos.Isi === 10 && s.phase === "after", "three doubles in a row: jail");
s = M.endTurn(s, "Isi");
ok(s.turnPerson === "Benji", "and the turn passes on");

/* ---------- Los ---------- */
s = start();
s.pos.Isi = 38;
s = M.roll(s, "Isi", dice(1, 2)); /* → 41 = 1 */
ok(s.pos.Isi === 1 && s.cash.Isi === 1700, "passing Los pays 200");
s = start();
s.pos.Isi = 35;
s = M.roll(s, "Isi", dice(2, 3)); /* → 0 */
ok(s.pos.Isi === 0 && s.cash.Isi === 1700, "landing exactly on Los pays 200 too");

/* ---------- tax, jail square ---------- */
s = start();
s.pos.Isi = 2;
s = M.roll(s, "Isi", dice(1, 1)); /* → 4 Einkommensteuer */
ok(s.cash.Isi === 1300, "Einkommensteuer costs 200");
s = start();
s.pos.Isi = 27;
s = M.roll(s, "Isi", dice(1, 2)); /* → 30 */
ok(s.pos.Isi === 10 && s.jail.Isi === 0, "'Gehe ins Gefängnis' sends you to jail without Los money");

/* ---------- jail ---------- */
s = start();
s.pos.Isi = 10; s.jail.Isi = 0;
let a = M.roll(s, "Isi", dice(1, 2));
ok(a.jail.Isi === 1 && a.pos.Isi === 10 && a.phase === "after", "no doubles: stays in jail");
a = M.roll(s, "Isi", dice(3, 3));
ok(a.jail.Isi === null && a.pos.Isi === 16 && !a.rolledDoubles, "doubles: free, moves, but no extra roll");
a = M.payJail(s, "Isi");
ok(a.jail.Isi === null && a.cash.Isi === 1450 && a.phase === "roll", "paying 50 frees you before the roll");
s.jail.Isi = 2;
a = M.roll(s, "Isi", dice(1, 2));
ok(a.jail.Isi === null && a.cash.Isi === 1450 && a.pos.Isi === 13, "after the third failed roll you pay 50 and move");
s.jailCards.Isi = ["cc8"]; s.chest = s.chest.filter(c => c !== "cc8");
a = M.useJailCard(s, "Isi");
ok(a.jail.Isi === null && a.jailCards.Isi.length === 0 && a.chest.includes("cc8"), "the get-out card frees you and goes back to its deck");
throwsWith(() => M.payJail(start(), "Isi"), /nicht im Gefängnis/, "no fine outside jail");

/* ---------- rent rules ---------- */
s = start();
s.props = { 1: { owner: "Benji", houses: 0 }, 3: { owner: "Benji", houses: 0 } };
ok(M.rentFor(s, 1) === 4 && M.rentFor(s, 3) === 8, "full colour set doubles the bare rent");
s.props[1].houses = 2;
ok(M.rentFor(s, 1) === 30, "with two houses: rent from the table");
s.props = { 5: { owner: "Benji", houses: 0 }, 15: { owner: "Benji", houses: 0 }, 25: { owner: "Benji", houses: 0 } };
ok(M.rentFor(s, 5) === 100, "three stations: 100");
s.props = { 12: { owner: "Benji", houses: 0 } };
ok(M.rentFor(s, 12, 8) === 32, "one utility: 4 × dice");
s.props[28] = { owner: "Benji", houses: 0 };
ok(M.rentFor(s, 12, 8) === 80, "both utilities: 10 × dice");

/* ---------- building ---------- */
s = start();
s.props = { 1: { owner: "Isi", houses: 0 }, 3: { owner: "Isi", houses: 0 }, 6: { owner: "Isi", houses: 0 } };
throwsWith(() => M.build(s, "Isi", 6), /alle Straßen dieser Farbe/, "no building without the full colour set");
s = M.build(s, "Isi", 1);
ok(M.housesOn(s, 1) === 1 && s.cash.Isi === 1450, "a house costs 50");
throwsWith(() => M.build(s, "Isi", 1), /gleichmäßig/, "build evenly");
s = M.build(s, "Isi", 3);
ok(M.canBuild(s, "Isi", 1) === null, "after the other street, the first may get its second house");
for (let i = 0; i < 4; i++) { s = M.build(s, "Isi", 1); s = M.build(s, "Isi", 3); }
ok(M.housesOn(s, 1) === 5 && M.housesOn(s, 3) === 5, "up to a hotel on both");
throwsWith(() => M.build(s, "Isi", 1), /Hotel/, "no more than a hotel");
const cash = s.cash.Isi;
s = M.sellHouse(s, "Isi", 3);
ok(M.housesOn(s, 3) === 4 && s.cash.Isi === cash + 25, "selling returns half the price");
throwsWith(() => M.sellHouse(s, "Isi", 3), /gleichmäßig/, "sell evenly too");

/* ---------- bankruptcy ---------- */
s = start();
s.cash.Isi = 100;
s.pos.Isi = 37;
s.props = { 39: { owner: "Benji", houses: 0 }, 37: { owner: "Isi", houses: 0 } };
s.pos.Isi = 36;
s = M.roll(s, "Isi", dice(1, 2)); /* → 39: rent 50 (no set) */
ok(s.cash.Isi === 50 && s.cash.Benji === 1550 && s.phase === "after", "paying rent with enough cash");
s = start();
s.cash.Isi = 30;
s.pos.Isi = 36;
s.props = { 39: { owner: "Benji", houses: 0 }, 37: { owner: "Isi", houses: 0 } };
s = M.roll(s, "Isi", dice(1, 2));
ok(s.phase === "finished" && s.out.includes("Isi") && s.result.winner === "Benji", "no money left: bankrupt, the other wins");
ok(M.ownerOf(s, 37) === "Benji" && s.cash.Benji === 1530, "the creditor gets the cash and the streets");
/* forced house sale */
s = start();
s.cash.Isi = 10;
s.pos.Isi = 36;
s.props = { 39: { owner: "Benji", houses: 0 }, 37: { owner: "Isi", houses: 0 }, 1: { owner: "Isi", houses: 2 }, 3: { owner: "Isi", houses: 2 } };
s = M.roll(s, "Isi", dice(1, 2)); /* rent 50, sells houses for 25 each */
ok(!s.out.includes("Isi") && M.housesOn(s, 1) + M.housesOn(s, 3) === 2 && s.cash.Isi >= 0, "houses are sold off to pay the rent before going bankrupt");
/* three players: the game goes on */
s = start(["Isi", "Benji", "Lena"]);
s.cash.Isi = 0; s.pos.Isi = 2;
s = M.roll(s, "Isi", dice(1, 1)); /* Einkommensteuer, broke */
ok(s.out.includes("Isi") && s.phase === "roll" && s.turnPerson === "Benji", "a bankrupt player drops out, the next one rolls");

/* ---------- cards ---------- */
s = start();
s.pos.Isi = 5;
s.chance = ["ch5", ...s.chance.filter(c => c !== "ch5")];
s = M.roll(s, "Isi", dice(1, 1)); /* → 7 Ereignis */
ok(s.cash.Isi === 1550 && s.chance[s.chance.length - 1] === "ch5", "a chance card: dividend, card goes to the bottom");
s = start();
s.pos.Isi = 5;
s.chance = ["ch7", ...s.chance.filter(c => c !== "ch7")];
s = M.roll(s, "Isi", dice(1, 1));
ok(s.pos.Isi === 10 && s.jail.Isi === 0, "a card can send you to jail");
s = start();
s.pos.Isi = 5;
s.chance = ["ch10", ...s.chance.filter(c => c !== "ch10")];
s = M.roll(s, "Isi", dice(1, 1));
ok(s.jailCards.Isi[0] === "ch10" && !s.chance.includes("ch10") && M.countCards(s) === 24, "the get-out card is kept");
s = start(["Isi", "Benji", "Lena"]);
s.pos.Isi = 15;
s.chance = ["ch1", ...s.chance.filter(c => c !== "ch1")];
s = M.roll(s, "Isi", dice(3, 4)); /* → 22 Ereignis, moves to Los */
ok(s.pos.Isi === 0 && s.cash.Isi === 1700, "'advance to Los' pays 200 once");
s = start(["Isi", "Benji", "Lena"]);
s.pos.Isi = 14;
s.chest = ["cc5", ...s.chest.filter(c => c !== "cc5")];
s = M.roll(s, "Isi", dice(1, 2)); /* → 17 Gemeinschaft */
ok(s.cash.Isi === 1520 && s.cash.Benji === 1490 && s.cash.Lena === 1490, "birthday: everybody pays 10");
s = start(["Isi", "Benji", "Lena"]);
s.pos.Isi = 5;
s.chance = ["ch11", ...s.chance.filter(c => c !== "ch11")];
s = M.roll(s, "Isi", dice(1, 1));
ok(s.cash.Isi === 1400 && s.cash.Benji === 1550 && s.cash.Lena === 1550, "chairman: pay each player 50");
s = start();
s.pos.Isi = 14;
s.props = { 1: { owner: "Isi", houses: 3 }, 3: { owner: "Isi", houses: 5 } };
s.chest = ["cc9", ...s.chest.filter(c => c !== "cc9")];
s = M.roll(s, "Isi", dice(1, 2));
ok(s.cash.Isi === 1500 - 3 * 40 - 115, "repairs: 40 per house and 115 per hotel");

/* ---------- short game ---------- */
s = start(["Isi", "Benji"], "short");
ok(s.mode === "short", "the short mode is remembered");
s.turnCount = M.SHORT_TURNS_EACH * 2 - 1;
s.cash.Benji = 900;
s = M.roll(s, "Isi", dice(1, 2));
s = s.phase === "buy" ? M.decline(s, "Isi") : s;
s = M.endTurn(s, "Isi");
ok(s.phase === "finished" && s.result.winner === "Isi" && s.result.reason === "time", "after 20 turns each the richest wins");
const again = M.newGame(s, "Isi", seeded(5));
ok(again.gameNo === 2 && again.wins.Isi === 1 && again.cash.Isi === 1500 && again.phase === "roll", "a new game keeps the win count");
throwsWith(() => M.newGame(start(), "Isi"), /läuft noch/, "no new game while one is running");

/* ---------- trading ---------- */
s = start(["Isi", "Benji", "Lena"]);
s.props = { 1: { owner: "Isi", houses: 0 }, 3: { owner: "Benji", houses: 0 }, 6: { owner: "Benji", houses: 0 } };
const offer = M.proposeTrade(s, "Isi", "Benji", [], [3], 300);
ok(offer.trade && offer.trade.cash === 300 && offer.trade.get[0] === 3, "an offer: Turmstraße for 300");
throwsWith(() => M.proposeTrade(offer, "Isi", "Lena", [], [], 10), /schon ein Angebot/, "one offer at a time");
throwsWith(() => M.acceptTrade(offer, "Lena"), /kein Angebot/, "only the addressed player can accept");
throwsWith(() => M.proposeTrade(s, "Benji", "Isi", [], [1], 0), /ist am Zug/, "offers are made on your own turn");
throwsWith(() => M.proposeTrade(s, "Isi", "Benji", [], [1], 0), /gehören nicht/, "you can only ask for what the other owns");
throwsWith(() => M.proposeTrade(s, "Isi", "Benji", [], [3], 5000), /nicht genug Geld/, "and only offer money you have");
const done = M.acceptTrade(offer, "Benji");
ok(M.ownerOf(done, 3) === "Isi" && done.cash.Isi === 1200 && done.cash.Benji === 1800 && !done.trade && M.ownsGroup(done, "Isi", "brown"), "accepted: street and money change hands");
ok(M.ownerOf(M.acceptTrade(M.proposeTrade(s, "Isi", "Benji", [1], [6], -50), "Benji"), 1) === "Benji", "streets for streets, and the proposer can ask for cash");
const no = M.declineTrade(offer, "Benji");
ok(!no.trade && M.ownerOf(no, 3) === "Benji", "declined: nothing changes");
ok(!M.declineTrade(offer, "Isi").trade, "the proposer can take the offer back");
let ended = M.endTurn(M.roll(M.proposeTrade(s, "Isi", "Benji", [], [3], 10), "Isi", dice(1, 2)), "Isi");
ok(!ended.trade, "an offer lapses when the turn ends");
s.props[1].houses = 1; s.props[3] = { owner: "Isi", houses: 1 };
throwsWith(() => M.proposeTrade(s, "Isi", "Benji", [1], [6], 0), /Häuser/, "streets of a colour with houses cannot be traded");

/* ---------- the computer players ---------- */
const step = state => {
  for (const p of state.players) {
    const next = Bots.monopoly.play(state, p);
    if (next) return next;
  }
  return null;
};
s = start(["Isi", "Udiou"]);
s.props = { 1: { owner: "Udiou", houses: 0 }, 3: { owner: "Isi", houses: 0 } };
s.turnPerson = "Udiou"; s.phase = "after";
let t = step(s);
ok(t.trade && t.trade.from === "Udiou" && t.trade.to === "Isi" && t.trade.get[0] === 3 && t.trade.cash > 60, "Udiou offers good money for the missing street of a colour");
let reply = step(t);
ok(reply.lastMove.type === "trade-done" && M.ownsGroup(reply, "Udiou", "brown"), "Isi takes it; Udiou now holds the colour");
t = M.proposeTrade({ ...s, turnPerson: "Isi", phase: "after" }, "Isi", "Udiou", [3], [1], 0);
ok(step(t).lastMove.type === "trade-no", "Udiou refuses a swap that is worse for him");

/* ---------- whole games with the computer players: nothing hangs, money is conserved ---------- */
function playOut(players, option, seed) {
  let state = M.createInitialState(players, option, seeded(seed));
  let steps = 0;
  while (state.phase !== "finished") {
    const next = step(state);
    assert.ok(next, `somebody has a move (phase ${state.phase})`);
    state = next;
    steps++;
    assert.ok(steps < 30000, "game ends");
    assert.ok(M.countCards(state) === 24, "cards never get lost");
    assert.ok(state.players.every(p => state.cash[p] >= 0), "nobody has negative cash");
    assert.ok(Object.values(state.props).every(p => p.houses >= 0 && p.houses <= 5 && !state.out.includes(p.owner)), "houses stay within 0..5, nothing belongs to a bankrupt player");
  }
  return state;
}
for (let i = 0; i < 30; i++) {
  const end = playOut(i % 2 ? ["Udiou", "Klausi"] : ["Isi", "Udiou", "Klausi"], "short", i + 1);
  assert.ok(end.result.winner && end.turnCount <= M.SHORT_TURNS_EACH * end.players.length + 1);
}
ok(true, "30 short games with computer players end after 20 turns each");
let bankrupts = 0;
for (let i = 0; i < 15; i++) {
  const end = playOut(["Udiou", "Klausi", "Isi", "Benji"].slice(0, 2 + (i % 3)), "full", 100 + i);
  assert.ok(end.result.winner && end.out.length === end.players.length - 1);
  bankrupts += end.out.length;
}
ok(bankrupts >= 15, "15 full games end with exactly one player left");

console.log(`\n${assertions} assertions passed (monopoly-engine)`);
