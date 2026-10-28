import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { API_BASE, SITE } from "../support/ports.mjs";
const require = createRequire(import.meta.url);
const F = require("../../flip7-engine.js");

/* Flip 7 on two phones: lobby, deal with flying cards, Noch eine / Stopp, Freeze with a target,
   busting, the round summary and the next round – with a stacked deck so every rule shows up */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = API_BASE;
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await fetch(`${API}/t/flip7_games/latest`)).json();
await fetch(`${API}/t/flip7_games/reset`, { method: "POST" });

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
  await page.goto(`${SITE}/flip7.html`);
  await page.waitForTimeout(700);
  return page;
}
const isi = await phone("Isi");
const benji = await phone("Benji");

/* lobby: up to four, friends by link */
ok(await isi.locator("#grStartBtn").count() === 1, "Flip 7 starts with a lobby");
await isi.click("#grStartBtn");
await until(async () => await benji.locator("#grJoinBtn").count() === 1, 4000, "invite");
ok(await isi.locator("#grInviteLink").count() === 1, "friends can be invited by link");
await benji.click("#grJoinBtn");
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1, 4000, "begin");
await isi.click("#grBeginBtn");

/* the deal: everybody gets one open card, flying from the deck (like Cabo) */
await until(async () => await isi.locator("#f7Board:not(.hidden)").count() === 1 && await benji.locator("#f7Board:not(.hidden)").count() === 1, 5000, "board");
const dealt = await latest();
ok(dealt.status === "active" && dealt.state.players.join() === "Isi,Benji" && dealt.state.lastMove.type === "deal", "the round starts with a deal");
await until(async () => await isi.locator(".ga-ghost").count() > 0, 3000, "flying cards");
ok(true, "cards fly from the deck while dealing");
await until(async () => await isi.locator(".anim-hidden").count() === 0 && await isi.locator(".ga-ghost").count() === 0, 6000, "deal finished");
ok(await isi.locator("#f7Opps .f7-seat").count() === 1 && await isi.locator("#f7Own").isVisible(), "Benji's cards on top, mine below");

/* a stacked deck: Isi 3, Benji 5; then Isi gets a 7, Benji a Freeze, later Benji a second 5 */
const game = await latest();
const s = F.createInitialState(["Isi", "Benji"]);
Object.assign(s, {
  phase: "play",
  dealer: 1,
  turnPerson: "Isi",
  table: {
    Isi: { numbers: [3], mods: [], actions: [], status: "active", flip7: false, bust: null },
    Benji: { numbers: [5], mods: ["p4"], actions: [], status: "active", flip7: false, bust: null }
  },
  deck: ["n12", "n12", "n11", "n5", "freeze", "n7"],
  discard: [],
  queue: [],
  flip3: null,
  choice: null,
  scores: { Isi: 0, Benji: 0 },
  moveSeq: game.state.moveSeq + 1,
  lastMove: { type: "setup", events: [], seq: game.state.moveSeq + 1 }
});
await fetch(`${API}/t/flip7_games/games/${game.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ state: s, version: (game.version || 0) + 1 })
});
await until(async () => await isi.locator("#f7Hit").count() === 1, 5000, "Isi's turn");
await until(async () => await isi.locator("#f7Stay").count() === 1 && (await isi.locator("#f7Stay").textContent()).includes("(3 Pkt.)"), 5000, "stacked state on Isi's phone");
await until(async () => (await benji.locator("#f7Own .f7-seat-points").textContent()).startsWith("9") && (await benji.locator("#f7Status").textContent()).includes("Isi ist dran"), 5000, "stacked state on Benji's phone");
ok((await isi.locator("#f7Status").textContent()).includes("Noch eine oder Stopp"), "Isi is asked: Noch eine oder Stopp?");
ok(await benji.locator("#f7Hit").count() === 0 && (await benji.locator("#f7Status").textContent()).includes("Isi ist dran"), "Benji waits for Isi");
ok((await isi.locator("#f7Stay").textContent()).includes("3 Pkt."), "Stopp shows what Isi would bank");
ok((await benji.locator("#f7Own .f7-seat-points").textContent()).startsWith("9"), "Benji's points: 5 + bonus 4");

await isi.click("#f7Hit");
await until(async () => (await latest()).state.table.Isi.numbers.join() === "3,7", 4000, "Isi drew");
await until(async () => await benji.locator(".ga-ghost").count() > 0, 3000, "Benji sees the card fly");
ok(true, "the drawn card flies to Isi on Benji's phone too");
await until(async () => await benji.locator(`#f7Opps [data-card="n7"]:not(.anim-hidden)`).count() === 1, 4000, "landed");
ok(true, "and lands face up in Isi's row");

/* Benji draws a Freeze and picks who it hits */
await until(async () => await benji.locator("#f7Hit").count() === 1, 4000, "Benji's turn");
await benji.click("#f7Hit");
await until(async () => await benji.locator(".f7-target").count() === 2, 4000, "targets");
ok((await benji.locator("#f7Status").textContent()).includes("Wen frierst du ein"), "a Freeze: Benji chooses who");
ok((await benji.locator(".f7-target").allTextContents()).join("|") === "🧊 Isi einfrieren|🧊 Mich selbst einfrieren", "Isi or himself");
await until(async () => (await isi.locator("#f7Status").textContent()).includes("Benji wählt"), 4000, "Isi waits");
ok(await isi.locator("#f7Hit").count() === 0, "nobody plays on meanwhile");
await benji.click('.f7-target[data-target="Isi"]');
await until(async () => (await latest()).state.table.Isi.status === "frozen", 4000, "frozen");
await until(async () => (await isi.locator("#f7Own .f7-badge").textContent()).includes("Eingefroren"), 4000, "Isi sees it");
ok((await isi.locator("#f7Event").textContent()).includes("Benji friert dich ein"), "Isi is told she is frozen");
ok(await isi.locator(`#f7Own [data-card="freeze"]`).count() === 1, "the Freeze card lies in front of her");

/* Benji goes on alone – and busts with a second 5 */
await until(async () => await benji.locator("#f7Hit").count() === 1, 4000, "Benji again");
await benji.click("#f7Hit");
await until(async () => (await latest()).state.phase === "round-over", 4000, "round over");
const round = (await latest()).state;
ok(round.table.Benji.status === "busted" && round.lastRound.scores.Isi === 10 && round.lastRound.scores.Benji === 0, "Benji busts with the second 5: 0 points, frozen Isi keeps her 10");
await until(async () => await benji.locator(".f7-summary").count() === 1 && await isi.locator(".f7-summary").count() === 1, 5000, "summary");
ok((await benji.locator("#f7Event").textContent()).includes("verzockt"), "Benji's phone says he busted");
ok(await benji.locator(".bust-card").count() === 1, "the busting card is marked");
ok((await isi.locator(".f7-summary").textContent()).includes("+10"), "the summary shows the points of the round");
ok((await isi.locator(".f7-chip.me").textContent()).includes("10"), "the total score grows");

/* next round: both ready */
await isi.locator(".f7-summary .gr-ready-btn").click();
await wait(600);
ok((await latest()).state.phase === "round-over", "the next round waits for both");
await benji.locator(".f7-summary .gr-ready-btn").click();
await until(async () => (await latest()).state.round === 2, 4000, "round 2");
const r2 = (await latest()).state;
ok(r2.dealer === 0 && r2.discard.length === 0 && F.countCards(r2) === 94 && r2.scores.Isi === 10, "round 2: the deal moves on, all cards are shuffled anew, the score carries over");
await until(async () => await isi.locator(".f7-summary").count() === 0, 4000, "summary gone");
ok(true, "the table is cleared for the new round");

/* leaving ends it for both */
await isi.click("#f7LeaveBtn");
await isi.click("#f7LeaveBtn");
await until(async () => (await benji.locator(".gr-lobby-note").count()) === 1, 4000, "Benji sees Isi left");
ok(true, "leaving ends the game on both phones");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (flip7: two devices)`);
