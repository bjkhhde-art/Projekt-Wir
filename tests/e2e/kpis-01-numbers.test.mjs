import { chromium } from "playwright";
import assert from "node:assert/strict";

/* KPIs: on a fixed day (1 March 2026) the numbers are exact – days together, next anniversary,
   the milestones and the "Wie lange noch bis …" countdowns */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const TODAY = new Date("2026-03-01T10:00:00+01:00");

await post("/t/trips/seed", { rows: [
  { id: 1, title: "Kopenhagen", location: "Dänemark", start_date: "2025-12-27", created_at: "2025-12-01T10:00:00Z" },
  { id: 2, title: "Lissabon", location: "Portugal", start_date: "2026-03-11", created_at: "2026-01-01T10:00:00Z" },
  { id: 3, title: "Rom", location: "Italien", start_date: "2026-05-01", created_at: "2026-01-02T10:00:00Z" }
] });
await post("/t/app_settings/seed", { rows: [
  /* made-up dates – the real ones are only in the database */
  { id: "shared", alicante_start: "2026-01-01", alicante_end: "2026-03-02", bot_names: {}, milestones: { firstMeeting: { date: "2025-11-20", place: "Testkino" }, firstDate: { date: "2025-12-03", place: "Testmarkt" }, anniversary: { date: "2026-01-10", place: "Testpark am See" } }, created_at: "2026-01-01T10:00:00Z" }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin" });
const page = await ctx.newPage();
await page.clock.setFixedTime(TODAY);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const text = sel => page.locator(sel).textContent();

await page.goto("http://localhost:9091/kpis.html");
await page.waitForSelector("#kpiCountdowns .kpi-countdown-row");
await page.waitForFunction(() => document.querySelectorAll("#kpiCountdowns .kpi-countdown-row").length === 2);

/* ---------- milestones ---------- */
await page.waitForFunction(() => document.getElementById("daysTogether").textContent.includes("Tage"));
ok(await text("#daysTogether") === "50 Tage", "10 Jan → 1 Mar 2026 is 50 days together");
ok(await text("#nextAnniversaryCountdown") === "315 Tage" && await text("#nextAnniversaryDate") === "10.1.2027", "the next anniversary is 10 Jan 2027, in 315 days");
ok(await text("#anniversaryDate") === "10.1.2026" && await text("#anniversaryPlace") === "Testpark am See", "the anniversary shows date and place");
ok(await text("#firstMeetingDate") === "20.11.2025" && await text("#firstDateDate") === "3.12.2025", "first meeting and first date are listed");
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("pw_milestones")).anniversary.date) === "2026-01-10", "the dates come from the database and a copy stays on the phone");
const shipped = (await (await fetch("http://localhost:9091/shared.js")).text()) + (await (await fetch("http://localhost:9091/kpis.js")).text());
ok(!/\d{4}-\d{2}-\d{2}/.test(shipped.replace(/YYYY-MM-DD/g, "")), "no personal dates are written into the website code");

/* ---------- countdowns ---------- */
const countdowns = await page.locator("#kpiCountdowns .kpi-countdown-row").allTextContents();
ok(countdowns[0].includes("Unsere nächste Reise: Lissabon") && countdowns[0].includes("Portugal") && countdowns[0].includes("10 Tage"), "the next trip is the nearest one still ahead (Lissabon in 10 days), past trips are skipped");
ok(countdowns[1].includes("Isi ist wieder in Deutschland") && countdowns[1].includes("1 Tag") && !countdowns[1].includes("1 Tage"), "Isi's return counts down too, with the right singular");
ok(await page.locator("#kpiCountdowns a").first().getAttribute("href") === "reise.html?tab=kommend", "the trip countdown leads to the upcoming trips");

/* on the anniversary itself and without planned trips */
await post("/t/trips/seed", { rows: [] });
await page.clock.setFixedTime(new Date("2027-01-10T09:00:00+01:00"));
await page.reload();
await page.waitForSelector("#kpiCountdowns .kpi-countdown-row");
await page.waitForFunction(() => document.getElementById("nextAnniversaryCountdown").textContent.length > 0);
ok(await text("#nextAnniversaryCountdown") === "Heute! 🎉", "on the anniversary it says Heute!");
ok(await text("#daysTogether") === "365 Tage", "one year together is 365 days");
const empty = await page.locator("#kpiCountdowns .kpi-countdown-row").allTextContents();
ok(empty.length === 1 && empty[0].includes("Noch nichts geplant"), "without a trip ahead it invites to plan one, and Isi's past return is no longer shown");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/trips/reset", {});
await post("/t/app_settings/reset", {});
console.log(`\n${n} assertions passed (KPIs)`);
