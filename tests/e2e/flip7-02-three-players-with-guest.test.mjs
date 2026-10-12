import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const F = require("../../flip7-engine.js");

/* Flip 7 with three: Isi, a friend from the invite link and Benji – a Flip Three with three
   possible targets, the 200 points that end the game and a new game for everyone */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/flip7_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
await fetch(`${API}/reset`, { method: "POST" });
const latest = async () => (await fetch(`${API}/latest`)).json();
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
async function phone(name, guest) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(([p, g]) => g ? sessionStorage.setItem("__pw_locked", "1") : localStorage.setItem("pw_person", p), [name, guest]);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  return page;
}
const status = page => page.locator("#f7Status").textContent();

const isi = await phone("Isi");
const benji = await phone("Benji");
await isi.goto("http://localhost:9091/flip7.html");
await benji.goto("http://localhost:9091/flip7.html");
await wait(400);
await isi.click("#grStartBtn");
await isi.waitForSelector("#grInviteLink");
const lena = await phone("Lena", true);
await lena.goto(await isi.locator("#grInviteLink").inputValue());
await lena.waitForSelector("#grGuestName");
await lena.fill("#grGuestName", "Lena");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector("text=Du bist dabei");
await benji.waitForTimeout(400);
await benji.click("#grJoinBtn");
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1, 4000, "begin");
await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 4000, "started");

const game = await latest();
ok(game.state.players.join() === "Isi,Lena,Benji", "three at the table in the order they joined");
for (const [page, name] of [[isi, "Isi"], [benji, "Benji"], [lena, "Lena"]]) {
  await until(async () => await page.locator("#f7Board:not(.hidden)").count() === 1, 4000, name + " board");
  ok(await page.locator("#f7Opps .f7-seat").count() === 2 && await page.locator("#f7Score .f7-chip").count() >= 3, `${name} sees the two others and everybody's score`);
}

/* Isi is close to 200 and draws a Flip Three – three people to choose from */
const s = F.createInitialState(["Isi", "Lena", "Benji"]);
Object.assign(s, {
  phase: "play",
  dealer: 2,
  turnPerson: "Isi",
  table: {
    Isi: { numbers: [10], mods: [], actions: [], status: "active", flip7: false, bust: null },
    Lena: { numbers: [2], mods: [], actions: [], status: "active", flip7: false, bust: null },
    Benji: { numbers: [4], mods: [], actions: [], status: "active", flip7: false, bust: null }
  },
  deck: ["n12", "n11", "n9", "n8", "n6", "n1", "flip3"],
  discard: [],
  queue: [],
  flip3: null,
  choice: null,
  scores: { Isi: 190, Lena: 150, Benji: 100 },
  moveSeq: game.state.moveSeq + 1,
  lastMove: { type: "setup", events: [], seq: game.state.moveSeq + 1 }
});
await fetch(`${API}/games/${game.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ state: s, version: (game.version || 0) + 1 })
});
await until(async () => await isi.locator("#f7Stay").count() === 1 && (await isi.locator("#f7Stay").textContent()).includes("(10 Pkt.)"), 5000, "Isi's turn");
await until(async () => (await status(lena)).includes("Isi ist dran"), 4000, "Lena waits for Isi");
ok(true, "the friend waits for Isi");
await isi.click("#f7Hit");
await until(async () => await isi.locator(".f7-target").count() === 3, 4000, "targets");
ok((await status(isi)).includes("Wer bekommt drei Karten"), "a Flip Three: Isi chooses who");
ok((await isi.locator(".f7-target").allTextContents()).join("|") === "⚡ Ich nehme drei Karten|⚡ Lena bekommt drei Karten|⚡ Benji bekommt drei Karten", "anybody still in the round can get it");
await until(async () => (await status(lena)).includes("Isi wählt"), 4000, "Lena waits");
await isi.click('.f7-target[data-target="Lena"]');
await until(async () => (await latest()).state.table.Lena.numbers.join() === "2,1,6,8", 4000, "three cards");
ok(true, "Lena gets three cards one after another");
await until(async () => (await lena.locator("#f7Event").textContent()).includes("Du bekommst drei Karten"), 4000, "Lena is told");
ok(true, "the friend's phone says she gets three cards");
await until(async () => await lena.locator("#f7Own .f7-card").count() === 5, 4000, "Lena's row");
ok(true, "the Flip Three card and the three numbers lie in front of her");

/* the turn moves on: Lena, Benji and Isi stop – Isi reaches 200 */
await until(async () => await lena.locator("#f7Stay").count() === 1, 4000, "Lena's turn");
ok((await lena.locator("#f7Stay").textContent()).includes("17 Pkt."), "it is Lena's turn next, she would bank 17");
await lena.click("#f7Stay");
await until(async () => await benji.locator("#f7Stay").count() === 1, 4000, "Benji's turn");
await benji.click("#f7Stay");
await until(async () => await isi.locator("#f7Stay").count() === 1, 4000, "Isi again");
await isi.click("#f7Stay");
await until(async () => (await latest()).state.phase === "finished", 4000, "finished");
const end = (await latest()).state;
ok(end.result.winner === "Isi" && end.scores.Isi === 200 && end.scores.Lena === 167 && end.wins.Isi === 1, "200 points end the game: Isi wins");
await until(async () => await lena.locator(".f7-summary").count() === 1, 4000, "summary");
ok((await status(lena)).includes("Isi hat gewonnen") && (await status(isi)).includes("Du hast gewonnen"), "everybody reads who won");
ok((await lena.locator(".f7-summary h3").textContent()).includes("Endstand"), "the final standings are shown");

/* a new game once all three are ready */
await isi.locator(".f7-summary .gr-ready-btn").click();
await lena.locator(".f7-summary .gr-ready-btn").click();
await wait(700);
ok((await latest()).state.phase === "finished" && (await benji.locator(".gr-ready-chip.ready").count()) === 2, "with two of three ready it still waits");
await benji.locator(".f7-summary .gr-ready-btn").click();
await until(async () => (await latest()).state.gameNo === 2, 4000, "new game");
const again = (await latest()).state;
ok(again.round === 1 && again.scores.Isi === 0 && again.wins.Isi === 1 && again.dealer === 0, "a new game: scores reset, wins kept, the deal moves on");
ok(F.countCards(again) === 94, "a fresh deck of 94 cards");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (flip7: three players with a guest)`);
