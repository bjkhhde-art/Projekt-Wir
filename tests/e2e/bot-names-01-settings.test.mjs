import { chromium } from "playwright";
import assert from "node:assert/strict";
import { API_BASE, SITE } from "../support/ports.mjs";

/* the computer players get new names in the settings; the games show them everywhere,
   while the games themselves keep the ids Udiou/Klausi */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = API_BASE;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}
const seedSettings = rows => fetch(`${API}/t/app_settings/seed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
await seedSettings([{ id: "shared", alicante_start: "2026-09-01", alicante_end: "2027-01-24", bot_names: {} }]);
await fetch(`${API}/t/monopoly_games/reset`, { method: "POST" });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { localStorage.setItem("pw_person", "Isi"); localStorage.setItem("pw_unlocked", "true"); });
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));

/* settings */
await page.goto(`${SITE}/einstellungen.html`);
await page.waitForTimeout(600);
ok(await page.locator("#botNameUdiou").isVisible() && await page.locator("#botNameKlausi").isVisible(), "the settings have a field for each computer player");
ok(await page.locator("#botNameUdiou").getAttribute("placeholder") === "Udiou", "empty fields show the original names");
await page.fill("#botNameUdiou", "Benji");
await page.locator("#botNameUdiou").blur();
await until(async () => (await page.locator(".toast").allTextContents()).some(t => t.includes("vergeben")), 3000, "toast");
ok(await page.locator("#botNameUdiou").inputValue() === "", "Benji is not allowed as a bot name");
await page.fill("#botNameUdiou", "  Robo  ");
await page.locator("#botNameUdiou").blur();
await until(async () => (await page.evaluate(() => window.__mockUpserts || [])).length > 0, 3000, "saved");
const upserts = await page.evaluate(() => window.__mockUpserts);
const last = upserts[upserts.length - 1];
ok(last.table === "app_settings" && last.payload.id === "shared" && last.payload.bot_names.Udiou === "Robo" && !("Klausi" in last.payload.bot_names), "the new name is saved for both phones");
ok(await page.locator("#botNameUdiou").inputValue() === "Robo", "the field shows the cleaned name");

/* the other phone's renaming arrives through the database */
await seedSettings([{ id: "shared", bot_names: { Udiou: "Robo", Klausi: "Blechi" } }]);
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx2.addInitScript(() => { localStorage.setItem("pw_person", "Isi"); });
const game = await ctx2.newPage();
game.on("pageerror", e => errors.push(e.message));
await game.goto(`${SITE}/monopoly.html`);
await until(async () => await game.locator("#grStartBtn").count() === 1, 4000, "lobby");
await game.click("#grStartBtn");
await until(async () => await game.locator(".gr-bot-btn").count() === 2, 4000, "bot buttons");
const buttons = await game.locator(".gr-bot-btn").allTextContents();
ok(buttons.some(t => t.includes("Robo dazuholen")) && buttons.some(t => t.includes("Blechi dazuholen")) && !buttons.join().includes("Udiou"), `the lobby offers the new names (${buttons.join(" / ")})`);
await game.locator('.gr-bot-btn[data-bot="Udiou"]').click();
await until(async () => (await game.locator(".gr-players").textContent()).includes("Robo"), 4000, "bot in lobby");
ok(!(await game.locator(".gr-players").textContent()).includes("Udiou"), "the player list shows Robo");
const lobbyRow = await (await fetch(`${API}/t/monopoly_games/latest`)).json();
ok(lobbyRow.state.lobby.includes("Udiou"), "inside the game he is still Udiou – running rounds stay valid");
await game.click("#grBeginBtn");
await until(async () => await game.locator("#moBoard:not(.hidden)").count() === 1, 5000, "board");
await game.waitForTimeout(600);
const board = await game.locator("#moBoard").textContent();
ok(board.includes("Robo") && !board.includes("Udiou"), "the board shows Robo, never Udiou");
const token = await game.locator(".mo-tok").allTextContents();
ok(token.includes("R"), "his token carries an R");

ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
await seedSettings([]);
await fetch(`${API}/t/monopoly_games/reset`, { method: "POST" });
console.log(`\n${n} assertions passed (bot names: settings and games)`);
