import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Einstellungen: who am I, each person's notification switches (loaded and saved per person)
   and the shared Alicante dates */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

await post("/t/notification_settings/seed", { rows: [
  { id: 1, person: "Isi", letters_enabled: false, quest_enabled: true, battery_enabled: true, mochi_enabled: false, games_enabled: true, created_at: "2026-01-01T10:00:00Z" },
  { id: 2, person: "Benji", letters_enabled: true, quest_enabled: false, battery_enabled: true, mochi_enabled: true, games_enabled: true, created_at: "2026-01-01T10:00:01Z" }
] });
await post("/t/app_settings/seed", { rows: [
  { id: "shared", alicante_start: "2026-09-01", alicante_end: "2027-01-24", bot_names: {}, created_at: "2026-01-01T10:00:00Z" }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const isOn = field => page.locator(`.settings-switch[data-field="${field}"]`).getAttribute("aria-checked").then(v => v === "true");
const upserts = () => page.evaluate(() => window.__mockUpserts || []);
async function until(fn, ms = 3000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); }
  throw new Error("timed out waiting for " + what);
}

await page.goto("http://localhost:9091/einstellungen.html");

/* ---------- who am I ---------- */
await page.waitForSelector("#personModal:not(.hidden)");
ok(true, "a phone that does not know its owner asks first");
await page.locator('#personModal .person-choice-btn[data-person="Isi"]').click();
await until(async () => !(await isOn("letters_enabled")), 3000, "Isi's settings");
ok(await page.evaluate(() => localStorage.getItem("pw_person")) === "Isi", "the choice is remembered");

/* ---------- Isi's switches ---------- */
ok(!(await isOn("letters_enabled")) && !(await isOn("mochi_enabled")) && await isOn("quest_enabled") && await isOn("games_enabled"), "Isi's saved switches are shown (letters and Mochi off)");
await page.click('.settings-switch[data-field="letters_enabled"]');
await until(async () => (await upserts()).some(u => u.table === "notification_settings"), 3000, "saving");
const saved = (await upserts()).find(u => u.table === "notification_settings");
ok(saved.payload.person === "Isi" && saved.payload.letters_enabled === true && Object.keys(saved.payload).length === 2, "turning letters on saves just that switch, for Isi");
ok(await isOn("letters_enabled"), "the switch shows on");

/* ---------- Benji has his own ---------- */
await page.evaluate(() => localStorage.setItem("pw_person", "Benji"));
await page.reload();
await until(async () => !(await isOn("quest_enabled")), 3000, "Benji's settings");
ok(await isOn("letters_enabled") && await isOn("mochi_enabled") && !(await isOn("quest_enabled")), "Benji sees his own switches, not Isi's");

/* ---------- Alicante dates (shared) ---------- */
ok(await page.inputValue("#alicanteStartInput") === "2026-09-01" && await page.inputValue("#alicanteEndInput") === "2027-01-24", "the shared Alicante dates are filled in");
await page.fill("#alicanteEndInput", "2027-02-14");
await page.locator("#alicanteEndInput").dispatchEvent("change");
await until(async () => (await upserts()).some(u => u.table === "app_settings" && u.payload.alicante_end), 3000, "saving the date");
const dates = (await upserts()).find(u => u.table === "app_settings" && u.payload.alicante_end);
ok(dates.payload.id === "shared" && dates.payload.alicante_end === "2027-02-14" && !("alicante_start" in dates.payload), "changing the return flight saves only that date, for both");
await page.waitForSelector(".toast", { timeout: 3000 });
ok((await page.locator(".toast").last().textContent()).includes("gespeichert"), "and confirms it");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
for (const table of ["notification_settings", "app_settings"]) await post(`/t/${table}/reset`, {});
console.log(`\n${n} assertions passed (Einstellungen)`);
