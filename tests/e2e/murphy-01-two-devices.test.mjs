import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../../murphy-engine.js");
const rules = M.parseCards(require("../../murphy-karten.json"));

/* Murphys Gesetz on two phones: lobby, the deal, a trade at the open piles that fulfils Isi's
   Murphy card, the round summary on both phones, the next round, a Basar trade and a green action card */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/murphy_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await fetch(`${API}/latest`)).json();
await fetch(`${API}/reset`, { method: "POST" });

async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function phone(person) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/murphy.html");
  await page.waitForTimeout(700);
  return page;
}
const isi = await phone("Isi");
const benji = await phone("Benji");

/* lobby like the other games */
await until(async () => await isi.locator("#grStartBtn").count() === 1, 4000, "lobby");
ok(await isi.locator("#mgRulesList li").count() === rules.murphy.length, "the rules list every Murphy card from murphy-karten.json");
await isi.click("#grStartBtn");
await until(async () => await benji.locator("#grJoinBtn").count() === 1, 4000, "invite");
ok(await isi.locator(".gr-bot-btn").count() === 2, "Udiou and Klausi can join");
await benji.click("#grJoinBtn");
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1, 4000, "begin");
await isi.click("#grBeginBtn");
await until(async () => await isi.locator("#mgBoard:not(.hidden)").count() === 1 && await benji.locator("#mgBoard:not(.hidden)").count() === 1, 5000, "board");

const dealt = (await latest()).state;
ok(dealt.players.join() === "Isi,Benji" && dealt.basar.length === 7, "the game starts with a Basar of seven");
await until(async () => await isi.locator("#mgOwn .mg-hand .mg-card").count() === dealt.hands.Isi.length, 4000, "own hand");
ok(await benji.locator("#mgOpps .mg-opp-hand .mg-back").count() === dealt.hands.Isi.length, "Benji sees Isi's cards face down");
ok(await isi.locator("#mgBasar .mg-card").count() === 7 && await isi.locator("#mgPile0 .mg-card").count() >= 1, "Basar and open piles on the table");
const isiTask = M.murphyOf(dealt, dealt.murphy.Isi).text;
ok((await isi.locator("#mgOwn .mg-murphy-text").textContent()) === isiTask, "Isi sees her own Murphy card");
ok(!(await benji.locator("#mgBoard").textContent()).includes(isiTask) || M.murphyOf(dealt, dealt.murphy.Benji).text === isiTask, "Benji does not see it");

/* a stacked table: Isi needs four Siebenen and has three plus two small cards */
async function stage(build) {
  const game = await latest();
  const s = game.state;
  const hands = build.hands;
  const placed = new Set([...Object.values(hands).flat(), ...build.basar, ...build.piles.flat(), ...(build.deck || [])]);
  const rest = [...M.numberCards(), ...M.actionCards(s.rules)].filter(c => !placed.has(c));
  Object.assign(s, {
    hands,
    basar: build.basar,
    piles: build.piles,
    deck: [...rest.filter(M.isNumber), ...(build.deck || []).slice().reverse()],
    actionPile: rest.filter(M.isAction),
    murphy: build.murphy,
    turnPerson: build.turn,
    step: "take",
    trade: null,
    tradesLeft: 1,
    actionPlayed: false,
    direction: 1,
    skip: { Isi: false, Benji: false },
    moveSeq: s.moveSeq + 1,
    lastMove: { type: "setup", events: [], seq: s.moveSeq + 1 }
  });
  await fetch(`${API}/games/${game.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: s, version: (game.version || 0) + 1 })
  });
}
await stage({
  turn: "Isi",
  hands: { Isi: ["b7-0", "g7-0", "y7-0", "b1-0", "b2-0", "A.alle-geben.0"], Benji: ["y5-0", "y6-0", "g3-0", "b9-0"] },
  basar: ["b4-0", "b5-0", "b6-0", "g4-0", "g5-0", "g6-0"],
  piles: [["b7-1"], ["y3-0"]],
  murphy: { Isi: "m02", Benji: "m03" }
});
await until(async () => await isi.locator('#mgOwn [data-card="A.alle-geben.0"]').count() === 1 && await isi.locator('#mgPile0 [data-card="b7-1"]').count() === 1, 5000, "stacked state");
await until(async () => (await benji.locator("#mgStatus").textContent()).includes("Isi ist dran"), 5000, "Benji waits");
ok((await isi.locator("#mgStatus").textContent()).includes("Du bist dran"), "Isi is asked to take first");
ok((await isi.locator("#mgOwn .mg-murphy-text").textContent()).includes("4 Karten mit derselben Zahl"), "her task: four of the same number");
ok(await isi.locator(".mg-seg-btn, .mg-basar-take").count() === 0, "no buttons for one or two – the cards are tapped");
ok(!(await benji.locator("#mgOpps").textContent()).includes("Zahlen"), "nobody sees how many number and action cards the others hold");

/* one for two: tap the open Blau 7, then Blau 1 and Blau 2, then choose where they go */
await isi.click("#mgPile0");
ok(await isi.locator("#mgPile0 .mg-card.selected").count() === 1 && (await latest()).state.step === "take", "the open card is chosen, nothing happens yet");
await isi.locator('#mgOwn [data-card="b1-0"]').click();
ok((await latest()).state.step === "take", "one own card chosen: still waiting");
await isi.locator('#mgOwn [data-card="b2-0"]').click();
await until(async () => await isi.locator(".mg-drop-both").count() === 1, 3000, "pile choice");
ok((await latest()).state.step === "take" && await isi.locator(".mg-drop-left").count() === 1 && await isi.locator(".mg-drop-right").count() === 1, "everything chosen: Isi picks the pile herself");
await isi.locator(".mg-drop-both").click();
await until(async () => (await latest()).state.phase === "round-over", 4000, "round over");
const won = (await latest()).state;
ok(won.won.Isi.join() === "m02" && won.piles[0].includes("b1-0") && won.piles[1].includes("b2-0") && !won.hands.Isi.includes("b1-0"), "one taken, two given: four Siebenen, Isi keeps her Murphy card");
await until(async () => (await benji.locator("#mgActions .mg-summary").textContent()).includes("Dumm gelaufen"), 4000, "summary");
ok((await benji.locator("#mgActions .mg-summary").textContent()).includes("4 Karten mit derselben Zahl"), "Benji sees the fulfilled task");
ok(await benji.locator('#mgActions .mg-proof [data-card="b7-1"]').count() === 1, "and Isi's cards as proof");
ok((await benji.locator("#mgScore").textContent()).includes("1/3"), "the score shows one Murphy card for Isi");

/* both ready: next round, new tasks, the hands stay */
await isi.locator(".gr-ready-btn").click();
await benji.locator(".gr-ready-btn").click();
await until(async () => (await latest()).state.phase === "play", 5000, "next round");
const r2 = (await latest()).state;
ok(r2.round === 2 && r2.turnPerson === "Benji" && r2.murphy.Isi && r2.murphy.Benji && r2.hands.Isi.join() === won.hands.Isi.join(), "round 2: Benji begins, new Murphy cards, same hands");

/* Benji trades with the Basar: two in, one back */
await until(async () => (await benji.locator("#mgStatus").textContent()).includes("Du bist dran"), 5000, "Benji's turn");
await benji.locator('#mgOwn [data-card="b9-0"]').click();
await benji.locator('#mgBasar [data-card="g4-0"]').click();
ok((await latest()).state.turnPerson === "Benji", "one own card and one from the Basar: not yet");
await benji.locator('#mgBasar [data-card="g5-0"]').click();
await until(async () => (await latest()).state.turnPerson === "Isi", 4000, "Isi's turn");
const afterBasar = (await latest()).state;
ok(afterBasar.basar.includes("b9-0") && afterBasar.basar.length === 5 && afterBasar.hands.Benji.includes("g4-0"), "the Basar now has the Blau 9 and five cards");

/* Isi plays her green card instead of a trade */
await until(async () => (await isi.locator("#mgStatus").textContent()).includes("Du bist dran"), 5000, "Isi's turn on her phone");
ok(!(await isi.locator("#mgActions").textContent()).includes("Tippe an"), "no small explanation text between Mac and the hand");
await isi.locator('#mgOwn [data-card="A.alle-geben.0"]').click();
ok((await isi.locator("#mgStatus").textContent()).includes("Jede Person gibt dir"), "the chosen green card explains itself");
const benjiBefore = afterBasar.hands.Benji.length;
await isi.locator(".mg-play").click();
await until(async () => (await latest()).state.turnPerson === "Benji", 4000, "played");
const stolen = (await latest()).state;
ok(stolen.hands.Benji.length === benjiBefore - 1 && stolen.actionPile.includes("A.alle-geben.0"), "Alle geben dir: Benji gave Isi a card, the green card is on the action pile");
await until(async () => (await benji.locator("#mgEvent").textContent()).includes("Alle geben dir"), 4000, "Benji sees it");
ok(true, "Benji sees what Isi played");

/* Benji draws from the deck card by card; the drawn cards stay, he gives one he held before */
await until(async () => (await benji.locator("#mgStatus").textContent()).includes("Du bist dran"), 5000, "Benji's turn again");
await benji.click("#mgDeck");
await until(async () => (await latest()).state.step === "give", 4000, "Benji drew one");
const one = (await latest()).state;
ok(one.trade.taken === 1 && one.trade.from === "deck", "a tap on the deck draws one card at once");
const drawnCard = one.trade.cards[0];
await benji.click("#mgDeck");
await until(async () => (await latest()).state.trade && (await latest()).state.trade.taken === 2, 4000, "Benji drew two");
const twoDrawn = (await latest()).state;
/* house rule: the drawn cards stay – Benji gives one he held before */
const giveBack = twoDrawn.hands.Benji.find(c => /^[byg]\d+-\d+$/.test(c) && !twoDrawn.trade.cards.includes(c));
await benji.locator(`#mgOwn [data-card="${giveBack}"]`).click();
await until(async () => await benji.locator(".mg-drop-right").count() === 1, 3000, "pile buttons");
await benji.locator(".mg-drop-right").click();
await until(async () => (await latest()).state.turnPerson === "Isi", 4000, "Benji gave");
ok((await latest()).state.piles[1].slice(-1)[0] === giveBack, `second tap draws another; the chosen card (${giveBack}, drawn: ${drawnCard}) lands on the right pile`);

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (murphy: two devices)`);
