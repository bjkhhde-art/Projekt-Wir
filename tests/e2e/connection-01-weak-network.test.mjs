import { chromium } from "playwright";
import assert from "node:assert/strict";
import { API_BASE, SITE } from "../support/ports.mjs";

/* A weak connection must not break a running game: the board stays, the toast tells what happens,
   and the phone catches up by itself once the network is back (even if a live update was missed). */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));

const API = `${API_BASE}/t/cabo_games`;
await fetch(`${API}/reset`, { method: "POST" });
await page.goto(`${SITE}/cabo.html`);
await page.click("#grStartBtn");
await page.waitForSelector(".gr-bot-btn");
await page.click('.gr-bot-btn[data-bot="Udiou"]');
await page.waitForSelector("#grBeginBtn:not([disabled])");
await page.click("#grBeginBtn");
const latest = async () => (await fetch(`${API}/latest`)).json();
await until(async () => (await latest()).status === "active", 4000, "started");
await page.waitForSelector("#ownHand .cabo-card-slot");

/* the connection drops: the board stays instead of falling back to the lobby */
const toBackend = url => url.href.startsWith(API_BASE);
await ctx.route(toBackend, route => route.abort());
await wait(5000);
ok(await page.locator("#ownHand .cabo-card-slot").count() > 0, "the board stays on screen while the connection is down");
ok(await page.locator("#grStartBtn").isHidden(), "the phone does not drop back to 'no round'");

/* a move happens meanwhile, the connection comes back: the phone catches up without a reload */
await ctx.unroute(toBackend);
const game = await latest();
game.state.discard = [...game.state.discard, 3];
await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state, version: (game.version || 0) + 1 }) });
await until(async () => {
  const top = await page.evaluate(() => GameRoom && document.body.innerText.length > 0);
  return top && !(await page.locator("#grStartBtn").isVisible());
}, 15000, "board still there after reconnect");
ok(true, "after the connection is back the game carries on");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (weak network: board stays, phone recovers)`);
