import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../../murphy-engine.js");
const rules = M.parseCards(require("../../murphy-karten.json"));

/* Murphys Gesetz, every kind of move once through the page: the hidden deck card by card, an open pile
   (top two), both open piles, Mac, a blue card that hits a chosen person, every kind of green card,
   an open Murphy card, and the end of a game with a new one. Three players (Lea needs no phone). */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/murphy_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await fetch(`${API}/latest`)).json();

async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}

/* a whole table, laid out by hand: every card not named goes to the deck (numbers) or the action pile */
function table(players, b) {
  const s = M.createInitialState(players, Math.random, rules, b.winCards || null);
  const placed = new Set([...Object.values(b.hands).flat(), ...b.basar, ...b.piles.flat(), ...(b.deck || [])]);
  const rest = [...M.numberCards(), ...M.actionCards(rules)].filter(c => !placed.has(c));
  return Object.assign(s, {
    hands: JSON.parse(JSON.stringify(b.hands)),
    basar: b.basar.slice(),
    piles: b.piles.map(p => p.slice()),
    deck: [...rest.filter(M.isNumber), ...(b.deck || []).slice().reverse()],
    actionPile: rest.filter(M.isAction),
    murphy: b.murphy,
    murphyOpen: Object.fromEntries(players.map(p => [p, Boolean(b.open && b.open[p])])),
    turnPerson: b.turn || players[0],
    step: "take",
    trade: null,
    pending: null,
    tradesLeft: 1,
    actionPlayed: false,
    direction: 1,
    skip: Object.fromEntries(players.map(p => [p, false])),
    won: Object.fromEntries(players.map(p => [p, (b.won && b.won[p]) || []])),
    phase: "play"
  });
}

let seq = 1000;
async function put(state) {
  const game = await latest();
  seq += 1;
  state.moveSeq = seq;
  state.lastMove = { type: "setup", events: [], seq };
  await fetch(`${API}/games/${game.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, status: "active", version: (game.version || 0) + 1 })
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function phone(person) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(person + " console: " + m.text()); });
  await page.goto("http://localhost:9091/murphy.html");
  return page;
}

const P3 = ["Isi", "Benji", "Lea"];
const start = table(P3, { hands: { Isi: ["b1-0"], Benji: ["b2-0"], Lea: ["b3-0"] }, basar: [], piles: [[], []], murphy: { Isi: "m01", Benji: "m02", Lea: "m03" } });
await fetch(`${API}/seed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ rows: [{ id: 1, status: "active", host_person: "Isi", guest_person: "Benji", state: start, version: 1, invite_code: "abcdefgh", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] })
});
const isi = await phone("Isi");
const benji = await phone("Benji");
const status = () => isi.locator("#mgStatus").textContent();
const hand = card => isi.locator(`#mgOwn [data-card="${card}"]`);
const settled = async (label, check) => until(async () => check((await latest()).state), 5000, label);

/* every scene starts from the same kind of hand: Isi with blue 4–9, a yellow 2 and green 3 */
const baseHands = extra => ({
  Isi: ["b4-0", "b5-0", "b6-0", "b7-0", "b8-0", "b9-0", "y2-0", "g3-0", ...(extra || [])],
  Benji: ["y5-0", "y6-0", "g7-0", "g8-0"],
  Lea: ["y9-0", "g10-0", "b10-0", "y4-0"]
});
/* Isi's task (a single 11) is never fulfilled by accident in these scenes */
const murphy3 = { Isi: "m20", Benji: "m09", Lea: "m04" };
/* stage a table and wait until Isi's page shows exactly that hand – not the one of the scene before */
async function scene(b, label) {
  const state = table(P3, { murphy: murphy3, basar: ["g1-0", "g2-0", "y1-0", "b11-0", "y11-0", "g11-0"], piles: [["y7-0", "y8-0"], ["g9-0"]], ...b });
  await put(state);
  const want = state.hands.Isi.slice().sort().join();
  await until(async () => (await isi.locator("#mgOwn .mg-hand .mg-card").evaluateAll(els => els.map(e => e.dataset.card).sort().join())) === want
    && (await status()).includes("Du bist dran"), 6000, label);
}

/* ---------- 1. the hidden deck, card by card ---------- */
await until(async () => await isi.locator("#mgBoard:not(.hidden)").count() === 1, 6000, "board");
await scene({ hands: baseHands(), deck: ["b1-1", "y10-0"] }, "deck scene");
ok(await isi.locator(".mg-table .mg-pile-wrap").evaluateAll(els => els.map(e => e.querySelector(".mg-pile").id).join()) === "mgPile0,mgDeck,mgPile1,mgActionPile", "left pile, deck, right pile, actions – in this order");
await isi.click("#mgDeck");
await settled("drew one", s => s.step === "give" && s.trade.taken === 1);
await until(async () => await hand("b1-1").count() === 1, 3000, "drawn card shown");
ok(await isi.locator('#mgOwn .mg-card.fresh[data-card="b1-1"]').count() === 1, "deck: the drawn card is shown at once and marked new");
await isi.click("#mgDeck");
await settled("drew two", s => s.trade && s.trade.taken === 2);
await until(async () => await hand("y10-0").count() === 1, 3000, "second card shown");
ok(await isi.locator('#mgOwn .mg-card.locked[data-card="y10-0"]').count() === 1 && await isi.locator('#mgOwn .mg-card.pickable[data-card="y10-0"]').count() === 0, "house rule: the drawn cards can't be picked to give back");
await hand("y2-0").click();
await until(async () => await isi.locator(".mg-drop-right").count() === 1, 3000, "pile buttons after drawing");
await isi.locator(".mg-drop-right").click();
await settled("gave an old card", s => s.turnPerson === "Benji");
let s = (await latest()).state;
ok(s.piles[1].slice(-1)[0] === "y2-0" && s.hands.Isi.includes("b1-1") && s.hands.Isi.includes("y10-0"), "deck: two drawn and kept, Gelb 2 from before onto the right pile");

/* the same, but a tap on the pile instead of the button */
await scene({ hands: baseHands(), deck: ["y10-0"] }, "deck tap scene");
await isi.click("#mgDeck");
await settled("drew", s => s.step === "give");
await until(async () => await hand("y10-0").count() === 1, 3000, "drawn");
await hand("g3-0").click();
await hand("y2-0").click();
await isi.click("#mgPile0");
await settled("gave two", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.piles[0].slice(-2).sort().join() === "g3-0,y2-0" && s.hands.Isi.includes("y10-0"), "deck: one drawn and kept, two old cards given by tapping the left pile");

/* ---------- 2. the top two of an open pile ---------- */
await scene({ hands: baseHands() }, "pile scene");
await isi.click("#mgPile0");
await isi.click("#mgPile0");
ok(await isi.locator("#mgPile0 .mg-card.selected").count() === 2, "pile: two taps choose the top two cards");
await hand("y2-0").click();
await until(async () => await isi.locator(".mg-drop-left").count() === 1, 3000, "pile buttons");
await isi.locator(".mg-drop-right").click();
await settled("pile trade", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.hands.Isi.includes("y7-0") && s.hands.Isi.includes("y8-0") && s.piles[0].length === 0 && s.piles[1].slice(-1)[0] === "y2-0", "pile: Gelb 7 and 8 taken, Gelb 2 onto the right pile");

/* ---------- 3. one from each open pile ---------- */
await scene({ hands: baseHands() }, "both scene");
await isi.click("#mgPile0");
await isi.click("#mgPile1");
await hand("g3-0").click();
await until(async () => await isi.locator(".mg-drop-left").count() === 1, 3000, "both: pile buttons");
await isi.locator(".mg-drop-left").click();
await settled("both trade", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.hands.Isi.includes("y8-0") && s.hands.Isi.includes("g9-0") && s.piles[0].slice(-1)[0] === "g3-0", "both piles: one from each, Grün 3 onto the left");

/* ---------- 4. Mac: one in, two out – at once ---------- */
await scene({ hands: baseHands() }, "mac scene");
await isi.locator('#mgBasar [data-card="b11-0"]').click();
await hand("y2-0").click();
ok((await latest()).state.turnPerson === "Isi", "Mac: one taken and one own card – not yet");
await hand("g3-0").click();
await settled("mac trade", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.hands.Isi.includes("b11-0") && s.basar.includes("y2-0") && s.basar.includes("g3-0") && s.basar.length === 7, "Mac: Blau 11 taken, two cards back, Mac has 7");
/* Mac with 7 cards: one for two would give him 8 */
await scene({ hands: baseHands(), basar: ["g1-0", "g2-0", "y1-0", "b11-0", "y11-0", "g11-0", "b3-0"] }, "full mac");
await isi.locator('#mgBasar [data-card="b11-0"]').click();
await hand("y2-0").click();
await hand("g3-0").click();
await until(async () => await isi.locator(".toast").filter({ hasText: "mehr als 7" }).count() >= 1, 4000, "mac full toast");
ok((await latest()).state.turnPerson === "Isi", "Mac with 7: one for two is refused with a message");

/* ---------- 5. a blue card that hits a chosen person ---------- */
await scene({ hands: baseHands(), deck: ["A.tausch-alles-blau.0"] }, "blue scene");
await isi.click("#mgDeck");
await until(async () => await isi.locator(".mg-target-pick").count() === 2, 4000, "target buttons");
ok((await status()).includes("Wen trifft es"), "blue card with three players: Isi chooses who");
await isi.locator(".mg-target-pick", { hasText: "Lea" }).click();
await settled("swapped", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.hands.Isi.includes("y9-0") && s.hands.Lea.includes("b4-0") && s.murphy.Isi === "m04" && s.murphy.Lea === "m20", "Alles tauschen: hands and Murphy cards changed with Lea");

/* ---------- 6. green cards ---------- */
async function green(card, label) {
  await scene({ hands: baseHands([card]) }, label);
  await hand(card).click();
  await until(async () => await isi.locator(".mg-green").count() === 1, 3000, label + " panel");
}

await green("A.fordern.0", "fordern");
await isi.locator(".mg-target", { hasText: "Lea" }).click();
await isi.selectOption(".mg-wish-colour", "g");
await isi.selectOption(".mg-wish-value", "10");
await isi.locator(".mg-play").click();
await settled("fordern", s => s.turnPerson === "Benji");
ok((await latest()).state.hands.Isi.includes("g10-0"), "Fordern: Grün 10 from Lea");

await green("A.nimm-drei.0", "nehmen");
for (const c of ["g1-0", "g2-0", "y1-0"]) await isi.locator(`#mgBasar [data-card="${c}"]`).click();
ok(await isi.locator("#mgBasar .mg-card.selected").count() === 3, "3 nehmen: three Mac cards can be chosen");
await isi.locator(".mg-play-basar").click();
await settled("nehmen", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(["g1-0", "g2-0", "y1-0"].every(c => s.hands.Isi.includes(c)) && s.basar.length === 3, "3 nehmen: three from Mac");

await green("A.ablegen-farbe.0", "ablegen");
for (const c of ["b4-0", "b5-0", "b6-0"]) await hand(c).click();
await isi.locator(".mg-play-right").click();
await settled("ablegen", s => s.turnPerson === "Benji");
ok((await latest()).state.piles[1].slice(-3).sort().join() === "b4-0,b5-0,b6-0", "Farbe ablegen: three blue cards onto the right pile");

await green("A.abgeben.0", "abgeben");
await isi.locator(".mg-target", { hasText: "Benji" }).click();
await hand("y2-0").click();
await hand("g3-0").click();
await isi.locator(".mg-play").click();
await settled("abgeben", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.hands.Benji.includes("y2-0") && s.hands.Benji.includes("g3-0"), "2 abgeben: two cards to Benji");
await until(async () => (await benji.locator("#mgEvent").textContent()).includes("Gelb 2"), 4000, "Benji sees his cards");
ok(true, "Benji sees which cards he got");

await green("A.paar-abgeben.0", "paar");
await put(table(P3, { murphy: murphy3, basar: ["g1-0"], piles: [["y7-0"], ["g9-0"]], hands: { ...baseHands(["A.paar-abgeben.0"]), Isi: [...baseHands().Isi, "b9-1", "A.paar-abgeben.0"] } }));
await until(async () => await hand("b9-1").count() === 1, 4000, "pair hand");
await hand("A.paar-abgeben.0").click();
await isi.locator(".mg-target", { hasText: "Lea" }).click();
await hand("b9-0").click();
await hand("b9-1").click();
await isi.locator(".mg-play").click();
await settled("paar", s => s.turnPerson === "Benji");
ok((await latest()).state.hands.Lea.filter(c => c.startsWith("b9-")).length === 2, "Paar abgeben: both Blau 9 to Lea");

await green("A.alle-ablegen.0", "alle ablegen");
await hand("y2-0").click();
await isi.locator(".mg-play-left").click();
await settled("alle ablegen", s => s.turnPerson === "Benji");
s = (await latest()).state;
ok(s.piles[0].length === 5 && s.piles[0][2] === "y2-0" && s.hands.Benji.length === 3 && s.hands.Lea.length === 3, "Alle legen ab: Isi, then Benji and Lea, one card each onto the left pile");

await green("A.basar-auffuellen.0", "mac auffuellen");
await hand("y2-0").click();
await isi.locator(".mg-play").click();
await settled("auffüllen", s => s.turnPerson === "Benji");
ok((await latest()).state.basar.length === 7, "Mac auffüllen: Mac has 7 again");

for (const [card, check, label] of [
  ["A.alle-geben.0", st => st.hands.Isi.length === 10, "Alle geben dir: one card from Benji and from Lea"],
  ["A.alle-ziehen.0", st => st.hands.Benji.length === 5 && st.hands.Lea.length === 5, "Alle ziehen: everybody one card"],
  ["A.murphy-tausch.0", st => st.murphy.Isi === "m09" && st.murphy.Benji === "m20", "Murphy tauschen: with Benji"],
  ["A.tausch-alles.0", st => st.murphy.Isi === "m09" && st.hands.Isi.includes("y5-0"), "Alles tauschen (grün): with Benji"]
]) {
  await green(card, label);
  if (await isi.locator(".mg-target", { hasText: "Benji" }).count()) await isi.locator(".mg-target", { hasText: "Benji" }).click();
  await isi.locator(".mg-play").click();
  await settled(label, st => st.turnPerson === "Benji");
  ok(check((await latest()).state), label);
}

/* a green card put down again: back to trading, the chosen Mac cards are forgotten */
await green("A.nimm-drei.0", "doch nicht");
for (const c of ["g1-0", "g2-0", "y1-0"]) await isi.locator(`#mgBasar [data-card="${c}"]`).click();
await isi.getByRole("button", { name: "Doch nicht" }).click();
ok(await isi.locator("#mgBasar .mg-card.selected").count() === 0 && (await latest()).state.turnPerson === "Isi", "Doch nicht: nothing played, Mac cards unmarked");

/* ---------- 7. an open Murphy card is seen by the others ---------- */
await scene({ hands: baseHands(), open: { Benji: true } }, "open murphy");
await until(async () => (await isi.locator("#mgOpps").textContent()).includes(M.murphyOf({ rules }, "m09").text), 4000, "open murphy shown");
ok(true, "Murphy offen: Isi reads Benji's task");

/* ---------- 8. the end of a game (to 1 Murphy card) and a new one ---------- */
const P2 = ["Isi", "Benji"];
await put(table(P2, { winCards: 1, hands: { Isi: ["b7-0", "g7-0", "y7-0", "b1-0", "b2-0"], Benji: ["y5-0", "y6-0"] }, basar: ["g1-0"], piles: [["b7-1"], ["g9-0"]], murphy: { Isi: "m02", Benji: "m03" } }));
await until(async () => (await status()).includes("Du bist dran") && await hand("b1-0").count() === 1, 6000, "end scene");
await isi.click("#mgPile0");
await hand("b1-0").click();
await hand("b2-0").click();
await isi.locator(".mg-drop-both").click();
await settled("finished", st => st.phase === "finished");
s = (await latest()).state;
ok(s.result.winner === "Isi" && s.wins.Isi === 1, "to 1 Murphy card: Isi wins the game at once");
await until(async () => (await benji.locator("#mgActions").textContent()).includes("Endstand"), 5000, "Benji's summary");
await isi.locator(".gr-ready-btn").click();
await benji.locator(".gr-ready-btn").click();
await settled("new game", st => st.phase === "play" && st.gameNo === 2);
s = (await latest()).state;
ok(s.rules.winCards === 1 && s.wins.Isi === 1 && s.won.Isi.length === 0, "new game: again to 1 Murphy card, the win is kept");

ok(errors.length === 0, "no page or console errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (murphy: every move)`);
