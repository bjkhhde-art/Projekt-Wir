import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../../monopoly-engine.js");

/* Monopoly on two phones: lobby with the two start modes, rolling, buying, rent, building,
   an offer that is accepted, the computer player Udiou and the end of a short game */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await fetch(`${API}/t/monopoly_games/latest`)).json();
await fetch(`${API}/t/monopoly_games/reset`, { method: "POST" });

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
  await page.goto("http://localhost:9091/monopoly.html");
  await page.waitForTimeout(700);
  return page;
}
const isi = await phone("Isi");
const benji = await phone("Benji");

/* lobby */
ok(await isi.locator("#grStartBtn").count() === 1, "Monopoly starts with a lobby");
ok(await isi.locator(".gr-option").count() === 2, "two ways to play: short game or until bankruptcy");
await isi.click("#grStartBtn");
await until(async () => await benji.locator("#grJoinBtn").count() === 1, 4000, "invite");
await benji.click("#grJoinBtn");
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1, 4000, "begin");
await isi.click("#grBeginBtn");
await until(async () => await isi.locator("#moBoard:not(.hidden)").count() === 1 && await benji.locator("#moBoard:not(.hidden)").count() === 1, 5000, "board");
const first = await latest();
ok(first.status === "active" && first.state.mode === "short" && first.state.players.join() === "Isi,Benji", "the short game starts with both players");
ok(await isi.locator(".mo-sq").count() === 40 && await isi.locator(".mo-tok").count() === 2, "the board has 40 squares and two tokens");

/* a stacked game: Isi (on turn) is on square 0, the dice are Math.random – so set the position beside a street */
const seeded = M.createInitialState(["Isi", "Benji"], "short");
Object.assign(seeded, { turnPerson: "Isi", pos: { Isi: 0, Benji: 0 } });
async function setState(state) {
  const g = await latest();
  await fetch(`${API}/t/monopoly_games/games/${g.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, version: (g.version || 0) + 1 }) });
}
const who = page => page === isi ? "Isi" : "Benji";
const myTurn = page => page.locator("#moRoll, #moBuy, #moEnd").count();

/* whoever is on turn rolls: the dice are random, so only check the effects that always hold */
let page = isi;
await until(async () => await isi.locator("#moRoll").count() === 1 || await benji.locator("#moRoll").count() === 1, 4000, "roll button");
const roller = (await isi.locator("#moRoll").count()) ? isi : benji;
ok(await (roller === isi ? benji : isi).locator("#moRoll").count() === 0, "only the player on turn sees the dice button");
const before = await latest();
await roller.click("#moRoll");
await until(async () => (await latest()).state.lastMove.type === "roll", 4000, "rolled");
const rolled = await latest();
const [d1, d2] = rolled.state.dice;
ok(d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6, `the dice show ${d1} and ${d2}`);
ok(rolled.state.pos[before.state.turnPerson] === (d1 + d2) % 40 || rolled.state.pos[before.state.turnPerson] !== 0, "the token moved");
await until(async () => (await roller.locator(".mo-die").first().textContent()).trim().length === 1, 2000, "dice drawn");
ok(true, "both dice are drawn in the middle of the board");

/* a prepared position: Isi owns the brown pair's first street, Benji stands one before the second */
const s = JSON.parse(JSON.stringify(rolled.state));
Object.assign(s, { phase: "roll", turnPerson: "Benji", doublesCount: 0, rolledDoubles: false, offer: null, trade: null, dice: [1, 2], pos: { Isi: 20, Benji: 2 }, jail: { Isi: null, Benji: null } });
s.cash = { Isi: 1500, Benji: 1500 };
s.props = { 1: { owner: "Isi", houses: 0 } };
await setState(s);
await until(async () => await benji.locator("#moRoll").count() === 1, 4000, "Benji's turn");
await until(async () => await benji.locator("#moMine .mo-empty").count() === 1, 6000, "Benji's streets");
ok(true, "Benji owns nothing yet");
await until(async () => await isi.locator("#moMine .mo-own li").count() === 1 && (await isi.locator("#moMine").textContent()).includes("Badstraße"), 6000, "Isi's streets");
ok(true, "Isi lists Badstraße among her streets");
await isi.locator('.mo-sq[data-sq="1"]').click();
ok((await isi.locator("#moInfo").textContent()).includes("Badstraße") && (await isi.locator("#moInfo").textContent()).includes("Haus: 50"), "tapping a square shows its rents");

/* Benji needs a 1 – let the engine decide with the real button, so use a prepared deterministic move instead:
   put Benji on the street directly in front of the offer */
const t = JSON.parse(JSON.stringify(s));
Object.assign(t, { phase: "buy", offer: 3, pos: { Isi: 20, Benji: 3 } });
await setState(t);
await until(async () => await benji.locator("#moBuy").count() === 1, 4000, "buy offer");
await until(async () => (await benji.locator("#moBuy").textContent()).includes("60"), 4000, "price");
ok(true, "Benji is offered Turmstraße for 60 €");
await benji.click("#moBuy");
await until(async () => (await latest()).state.props[3] && (await latest()).state.props[3].owner === "Benji", 4000, "bought");
ok((await latest()).state.cash.Benji === 1440, "buying costs 60 €");
await until(async () => await benji.locator("#moEnd").count() === 1, 3000, "end button");
await benji.click("#moEnd");
await until(async () => await isi.locator("#moRoll").count() === 1, 4000, "Isi's turn");

/* trading: Isi asks for Turmstraße, offering 100 on top */
await isi.click("#moTradeOpen");
await isi.locator('.mo-pick[data-key="get"]').first().click();
await isi.fill("#moPay", "100");
await isi.click("#moTradeSend");
await until(async () => (await latest()).state.trade, 4000, "offer stored");
await until(async () => await benji.locator("#moTradeYes").count() === 1, 4000, "offer arrives");
await until(async () => (await benji.locator(".mo-offer").textContent()).includes("Turmstraße"), 4000, "offer text");
ok(true, "Benji sees the offer: Turmstraße for cash");
await until(async () => await isi.locator("#moTradeBack").count() === 1 && await isi.locator("#moRoll").count() === 1, 4000, "Isi's offer box");
ok(true, "Isi can take it back and still roll");
await benji.click("#moTradeYes");
await until(async () => !(await latest()).state.trade, 4000, "accepted");
const traded = (await latest()).state;
ok(traded.props[3].owner === "Isi" && traded.cash.Benji === 1540 && traded.cash.Isi === 1400, "the street and the 100 € changed hands");
await until(async () => await isi.locator("[data-build]").count() === 2, 3000, "build buttons");
ok(await isi.locator("[data-build]:not([disabled])").count() >= 1, "with both brown streets Isi can build");
await isi.locator("[data-build]:not([disabled])").first().click();
await until(async () => Object.values((await latest()).state.props).some(p => p.houses === 1), 4000, "house built");
ok((await latest()).state.cash.Isi === 1350, "a house costs 50 €");

/* debts: Isi owes Benji 150 with 50 in cash – houses can be sold, streets mortgaged, or she gives up */
const dstate = JSON.parse(JSON.stringify((await latest()).state));
Object.assign(dstate, { phase: "debt", turnPerson: "Isi", offer: null, trade: null });
dstate.cash = { Isi: 50, Benji: 1500 };
dstate.props = { 1: { owner: "Isi", houses: 1 }, 3: { owner: "Isi", houses: 1 }, 5: { owner: "Isi", houses: 0 }, 15: { owner: "Isi", houses: 0 } };
dstate.debt = { person: "Isi", owed: [{ to: "Benji", amount: 150 }], reason: "rent" };
await setState(dstate);
await until(async () => await isi.locator("#moGiveUp").count() === 1, 4000, "debt box");
await until(async () => (await isi.locator(".mo-debt-box").textContent()).includes("150") && await isi.locator("#moRoll, #moEnd").count() === 0, 4000, "debt box");
ok(true, "in debt Isi sees what she owes and cannot roll or end the turn");
await until(async () => (await benji.locator("#moStatus").textContent()).includes("Isi muss Geld auftreiben"), 6000, "Benji's status");
ok(true, "Benji sees that Isi is raising money");
await isi.locator("[data-sell]:not([disabled])").first().click();
await until(async () => (await latest()).state.cash.Isi === 75, 4000, "house sold");
await isi.locator("[data-mortgage]:not([disabled])").first().click();
await until(async () => (await latest()).state.phase === "after", 4000, "debt paid");
const paid = (await latest()).state;
ok(paid.cash.Benji === 1650 && !paid.debt && Object.values(paid.props).some(p => p.mortgaged), "a house sale and a mortgage raised the money; the debt was paid automatically");
await until(async () => await isi.locator("[data-redeem]").count() === 1, 3000, "redeem button");
ok(await isi.locator(".mo-sq.mortgaged").count() === 1, "the mortgaged street is marked on the board");

/* Udiou joins another game: he plays by himself and the short game ends */
await isi.click("#moLeaveBtn"); await isi.click("#moLeaveBtn");
await until(async () => (await latest()).status === "closed", 4000, "closed");
await until(async () => await isi.locator("#grStartBtn").count() === 1, 4000, "lobby again");
await isi.click("#grStartBtn");
await until(async () => await isi.locator(".gr-bot-btn").count() > 0, 4000, "bot buttons");
await isi.locator('.gr-bot-btn[data-bot="Udiou"]').click();
await until(async () => (await latest()).state.lobby.includes("Udiou"), 4000, "Udiou in the lobby");
await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 4000, "started");
const withBot = await latest();
withBot.state.turnCount = M.SHORT_TURNS_EACH * 2 - 2;
await setState(withBot.state);
for (let i = 0; i < 60; i++) {
  const g = (await latest()).state;
  if (g.phase === "finished") break;
  if (g.turnPerson === "Isi") {
    if (await isi.locator("#moRoll").count()) await isi.click("#moRoll");
    else if (await isi.locator("#moDecline").count()) await isi.click("#moDecline");
    else if (await isi.locator("#moEnd").count()) await isi.click("#moEnd");
    else if (await isi.locator("#moJailPay").count()) await isi.click("#moRoll");
  }
  await wait(500);
}
await until(async () => (await latest()).state.phase === "finished", 15000, "game over");
await until(async () => await isi.locator(".mo-summary").count() === 1, 6000, "summary");
ok((await isi.locator(".mo-summary").textContent()).includes("Endstand"), "the short game ends with a result");
ok(await isi.locator(".gr-ready-btn").count() === 1, "and offers a new game");

ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
console.log(`\n${n} assertions passed (monopoly-01: two-device flow)`);
