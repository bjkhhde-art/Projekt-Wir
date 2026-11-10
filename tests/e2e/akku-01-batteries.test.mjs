import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Kuschelakku: both batteries load, swiping and arrow keys change and save the level, the partner's change shows live */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const level = async person => (await (await fetch(`${API}/t/cuddle_batteries/dump`)).json()).find(r => r.person === person).level;

await post("/t/cuddle_batteries/seed", { rows: [
  { id: 1, person: "Isi G", level: 40, created_at: "2026-01-01T10:00:00Z", updated_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 2, person: "Benji", level: 80, created_at: "2026-01-01T10:00:01Z", updated_at: new Date().toISOString() }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
async function until(fn, ms = 3000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); }
  throw new Error("timed out waiting for " + what);
}
const text = sel => page.locator(sel).textContent();

await page.goto("http://localhost:9091/batterien.html");
await page.waitForFunction(() => document.getElementById("percent-isi-g").textContent === "40%");

/* ---------- loading ---------- */
ok(await text("#percent-isi-g") === "40%" && await text("#percent-benji") === "80%", "both batteries show their saved level");
ok(await text("#status-isi-g") === "Bereit zum Kuscheln" && await text("#emoji-benji") === "🥰", "each level comes with its own status and face");
ok((await text("#updated-isi-g")).includes("vor 2 Std."), "it says when a battery was last changed");
ok(await page.locator("#battery-isi-g .battery-fill").evaluate(el => el.style.height) === "40%", "the fill matches the level");

/* ---------- arrow keys ---------- */
await page.focus("#battery-isi-g");
await page.keyboard.press("ArrowUp");
await until(async () => await level("Isi G") === 45, 3000, "saving 45");
ok(await text("#percent-isi-g") === "45%", "arrow up adds 5 % and saves it");
await page.keyboard.press("PageDown");
await until(async () => await level("Isi G") === 35, 3000, "saving 35");
ok(await text("#status-isi-g") === "Braucht bald Kuscheleinheiten", "page down takes 10 % off, the status follows");
const noticeFor35 = async () => (await page.evaluate(() => window.__mockInvocations || [])).find(i => i.body.body.includes("35%"));
await until(noticeFor35, 3000, "the notification");
const notices = [await noticeFor35()];
ok(notices.some(i => i.body.category === "battery" && i.body.excludePerson === "Isi" && i.body.body.includes("35%")), "the other one is notified about the new level");

/* ---------- swiping ---------- */
const box = await page.locator("#battery-isi-g").boundingBox();
const x = box.x + box.width / 2;
await page.mouse.move(x, box.y + box.height * 0.8);
await page.mouse.down();
await page.mouse.move(x, box.y + box.height * 0.5, { steps: 6 });
ok(await page.locator("#battery-isi-g").evaluate(el => el.classList.contains("dragging")), "while swiping the battery is marked as being dragged");
await page.mouse.move(x, box.y - box.height, { steps: 6 });
ok(await text("#percent-isi-g") === "100%", "swiping far up fills it to 100 % (never more)");
await page.mouse.up();
await until(async () => await level("Isi G") === 100, 3000, "saving 100");
ok(await page.locator("#battery-isi-g").evaluate(el => el.classList.contains("full")) && await text("#status-isi-g") === "Voll aufgeladen 💗", "a full battery is celebrated");

await page.mouse.move(x, box.y + box.height * 0.2);
await page.mouse.down();
await page.mouse.move(x, box.y + box.height * 3, { steps: 8 });
await page.mouse.up();
await until(async () => await level("Isi G") === 0, 3000, "saving 0");
ok(await text("#percent-isi-g") === "0%" && await text("#emoji-isi-g") === "😴", "swiping far down empties it to 0 % (never less)");

/* ---------- live from the other phone ---------- */
await post("/t/cuddle_batteries/update", { filters: [["eq", "person", "Benji"]], payload: { level: 15, updated_at: new Date().toISOString() } });
await page.waitForFunction(() => document.getElementById("percent-benji").textContent === "15%", null, { timeout: 4000 });
ok(await text("#status-benji") === "Akku leer, Zeit zum Kuscheln!", "Benji's change shows up without reloading");
ok(await level("Isi G") === 0, "and does not touch Isi's battery");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/cuddle_batteries/reset", {});
console.log(`\n${n} assertions passed (Kuschelakku)`);
