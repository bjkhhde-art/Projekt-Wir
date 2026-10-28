import { chromium } from "playwright";
import assert from "node:assert/strict";
import { API_BASE, SITE } from "../support/ports.mjs";

/* 6 nimmt! with Isi, Benji and Udiou: Udiou chooses his card by himself; when Isi's phone (which plays
   for him) is gone, Benji's phone takes over */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = `${API_BASE}/t/nimmt_games`;
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
async function phone(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), name);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  return page;
}

const isi = await phone("Isi");
const benji = await phone("Benji");
await isi.goto(`${SITE}/nimmt.html`);
await benji.goto(`${SITE}/nimmt.html`);
await wait(400);
await isi.click("#grStartBtn");
await benji.waitForSelector("#grJoinBtn");
await benji.click("#grJoinBtn");
await isi.waitForSelector(".gr-bot-btn");
await until(async () => (await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Benji", 4000, "Benji in");
await isi.click('.gr-bot-btn[data-bot="Udiou"]');
await until(async () => (await benji.locator(".gr-player-name").allTextContents()).join() === "Isi,Benji,Udiou", 4000, "Udiou in");
ok(await benji.locator(".gr-player-tag.bot").count() === 1, "Benji sees Udiou joining as the computer");
ok(await benji.locator('.gr-bot-btn[data-bot="Udiou"][data-action="remove"]').count() === 1, "Benji could send him away as well");
await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 4000, "started");

/* fixed cards; Udiou chooses on his own while the two think */
const game = await latest();
game.state.rows = [[10], [30], [50], [70]];
game.state.hands = { Isi: [11, 12, 13], Benji: [31, 32, 33], Udiou: [51, 52, 53] };
game.state.chosen = { Isi: null, Benji: null, Udiou: null };
await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state, version: (game.version || 0) + 1 }) });
await until(async () => (await latest()).state.chosen.Udiou !== null, 6000, "Udiou chooses");
ok(true, "Udiou chooses his card by himself");
await until(async () => (await isi.locator("#nmStatus").textContent()).includes("Udiou"), 4000, "Isi sees it");
ok((await isi.locator("#nmStatus").textContent()).includes("Udiou hat schon gewählt"), "Isi sees that Udiou has chosen – not which card");
await isi.locator('[data-anim-key="hand-11"]').click();
await until(async () => (await latest()).state.chosen.Isi === 11, 4000, "Isi chose");

/* Isi's phone (which plays for Udiou) goes away – from now on Benji's phone steps in */
await isi.close();
await benji.locator('[data-anim-key="hand-31"]').click();
await until(async () => (await latest()).state.trick === 2, 5000, "trick 2");
const trick = (await latest()).state;
ok(trick.lastTrick.plays.map(p => p.person).join() === "Isi,Benji,Udiou" && trick.rows[2].length === 2, "the trick is played out, Udiou's card goes onto the 50s");
ok(trick.chosen.Udiou === null, "a new trick – Udiou has to choose again");
const started = Date.now();
await until(async () => (await latest()).state.chosen.Udiou !== null, 15000, "Udiou chooses via Benji");
ok(Date.now() - started > 3000, "without Isi's phone, Benji's phone makes Udiou's move after a short wait");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Udiou: 6 nimmt! and stepping in)`);
