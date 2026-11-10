import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Home: on a fixed day (1 March 2026) – days together, Alicante progress, Mochi's mood, the partner's battery
   (asking who you are first) and the last trip */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const TODAY = new Date("2026-03-01T10:00:00+01:00");

await post("/t/app_settings/seed", { rows: [
  { id: "shared", alicante_start: "2026-01-01", alicante_end: "2026-03-02", bot_names: {}, created_at: "2026-01-01T10:00:00Z" }
] });
await post("/t/cuddle_batteries/seed", { rows: [
  { id: 1, person: "Isi G", level: 30, created_at: "2026-01-01T10:00:00Z" },
  { id: 2, person: "Benji", level: 80, created_at: "2026-01-01T10:00:01Z" }
] });
await post("/t/pet_state/seed", { rows: [
  { id: "shared", hunger: 95, energy: 95, cleanliness: 95, bond: 95, updated_at: TODAY.toISOString(), created_at: "2026-01-01T10:00:00Z" }
] });
await post("/t/trips/seed", { rows: [
  { id: 1, title: "Kopenhagen", location: "Dänemark", start_date: "2025-12-27", end_date: "2025-12-30", cover_url: "/icons/icon-192.png", created_at: "2025-12-01T10:00:00Z" },
  { id: 2, title: "Lissabon", location: "Portugal", start_date: "2026-03-11", end_date: "2026-03-15", created_at: "2026-01-01T10:00:00Z" }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
/* reduced motion: the numbers appear at once instead of counting up */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin", reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.clock.setFixedTime(TODAY);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const text = sel => page.locator(sel).textContent();

await page.goto("http://localhost:9091/index.html");
await page.waitForFunction(() => document.getElementById("dashTripTitle").textContent === "Kopenhagen");

/* the push question comes first on a phone that has not enabled notifications */
if (await page.locator("#pushModal").isVisible()) {
  await page.click("#dismissPushModal");
  ok(await page.locator("#pushModal").isHidden(), "the notification question can be put off");
} else {
  ok(true, "no notification question where the browser cannot do push");
}

ok(await text("#heroDays") === "55 🎉", "the hero counts 55 days together");
await page.waitForFunction(() => document.getElementById("alicanteDaysLeft").textContent.length > 0);
ok(await text("#alicantePercent") === "99%", "Alicante: 59 of 60 days are behind us (99 %)");
ok(await text("#alicanteDaysLeft") === "Noch 1 Tag, bis Isi wieder in Deutschland ist", "and it says how long until Isi is back, in the singular");
await page.waitForFunction(() => document.getElementById("dashMochiMood").textContent.includes("🥰"));
ok(await text("#dashMochiMood") === "Überglücklich 🥰", "a well cared-for Mochi is shown as overjoyed");
ok(await text("#dashTripTitle") === "Kopenhagen" && await text("#dashTripMeta") === "Dänemark · 27.12.2025 – 30.12.2025", "the trip tile shows the last trip that already happened, not the next one");
ok(await page.locator("#dashTripImg").isVisible(), "with its cover picture");

/* battery tile: unknown person first */
ok(await text("#dashBatteryValue") === "Wer bist du?", "without knowing who is holding the phone the battery tile asks");
await page.click("#dashBatteryTile");
ok(await page.locator("#personModal").isVisible(), "tapping it asks who you are");
await page.locator('#personModal .person-choice-btn[data-person="Benji"]').click();
await page.waitForFunction(() => document.getElementById("dashBatteryValue").textContent === "30%");
ok(await text("#dashBatteryLabel") === "Akku von Isi", "Benji sees Isi's battery (30 %)");
ok(await page.evaluate(() => localStorage.getItem("pw_person")) === "Benji", "and the phone remembers who it belongs to");

/* Isi sees Benji's battery */
await page.evaluate(() => localStorage.setItem("pw_person", "Isi"));
await page.reload();
await page.waitForFunction(() => document.getElementById("dashBatteryValue").textContent === "80%");
ok(await text("#dashBatteryLabel") === "Akku von Benji", "Isi sees Benji's battery (80 %)");

/* a neglected Mochi and no trips yet */
await post("/t/pet_state/seed", { rows: [
  { id: "shared", hunger: 30, energy: 30, cleanliness: 30, bond: 30, updated_at: new Date(TODAY.getTime() - 48 * 3600000).toISOString(), created_at: "2026-01-01T10:00:00Z" }
] });
await post("/t/trips/seed", { rows: [] });
await page.reload();
await page.waitForFunction(() => document.getElementById("dashTripTitle").textContent === "Noch keine Reise");
await page.waitForFunction(() => document.getElementById("dashMochiMood").textContent.length > 0);
ok(await text("#dashMochiMood") === "Vermisst uns sehr 💔", "after two days without care Mochi misses us");
ok(await text("#dashTripMeta") === "Wir tragen unsere erste Reise ein", "without trips the tile invites to add the first one");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
for (const table of ["app_settings", "cuddle_batteries", "pet_state", "trips"]) await post(`/t/${table}/reset`, {});
console.log(`\n${n} assertions passed (Home)`);
