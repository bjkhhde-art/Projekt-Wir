import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Einstellungen, found in the test report: "Wer bin ich" can be changed and moves this phone's push
   subscription along; the push status is the phone's real one; signing out affects only this phone */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

await post("/t/notification_settings/seed", { rows: [] });
await post("/t/app_settings/seed", { rows: [{ id: "shared", alicante_start: "2026-09-01", alicante_end: "2027-01-24", bot_names: {}, created_at: "2026-01-01T10:00:00Z" }] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  /* notifications are allowed (headless Chromium always says "denied") – but no push subscription is held */
  Object.defineProperty(Notification, "permission", { get: () => "granted" });
  localStorage.setItem("pw_person", "Isi");
  /* an old phone: push was turned on once, but the browser holds no subscription any more */
  localStorage.setItem("pw_push_enabled", "true");
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));

await page.goto("http://localhost:9091/einstellungen.html");
await page.evaluate(() => localStorage.setItem("pw_milestones", JSON.stringify({ anniversary: { date: "2026-01-10", place: "Test" } })));
await page.waitForFunction(() => document.getElementById("devicePersonName").textContent === "Isi");
ok(true, "the settings say whose phone this is (Isi)");

/* the push status comes from the phone, not from an old note */
await page.waitForFunction(() => !document.getElementById("pushStatusText").textContent.includes("geladen"));
const pushText = await page.locator("#pushStatusText").textContent();
ok(!pushText.includes("aktiviert ✅") && pushText.includes("nicht mehr aktiv") && await page.locator("#enablePushBtn").isVisible(), "push that no longer works is not shown as on – it says so and the button is back");

/* changing who I am */
await page.click("#changePersonBtn");
await page.locator('#personModal .person-choice-btn[data-person="Benji"]').click();
await page.waitForFunction(() => document.getElementById("devicePersonName").textContent === "Benji");
ok(await page.evaluate(() => localStorage.getItem("pw_person")) === "Benji", "'Ändern' switches this phone to Benji");

/* the push subscription follows the person (a fake subscription stands in for the browser's) */
await page.evaluate(() => {
  window.currentPushSubscription = async () => ({ endpoint: "https://push.example/abc", toJSON: () => ({ keys: { p256dh: "k", auth: "a" } }) });
});
await page.click("#changePersonBtn");
await page.locator('#personModal .person-choice-btn[data-person="Isi"]').click();
await page.waitForFunction(() => (window.__mockUpserts || []).some(u => u.table === "push_subscriptions"));
const moved = (await page.evaluate(() => window.__mockUpserts)).find(u => u.table === "push_subscriptions");
ok(moved.payload.person === "Isi" && moved.payload.endpoint === "https://push.example/abc", "switching moves this phone's push subscription to the new person");

/* signing out: asks, only this phone, our dates are removed from it */
await page.click("#signOutBtn");
await page.waitForSelector(".confirm-box");
await page.click(".confirm-yes");
await page.waitForURL(/index\.html/);
await page.waitForFunction(() => document.readyState === "complete" && sessionStorage.getItem("__mock_last_signout"));
const signedOut = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__mock_last_signout")));
ok(signedOut.scope === "local", "'Abmelden' signs out only this phone and goes to the start page");
ok(await page.evaluate(() => localStorage.getItem("pw_milestones")) === null, "and removes the copy of our dates from it");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
for (const table of ["notification_settings", "app_settings"]) await post(`/t/${table}/reset`, {});
console.log(`\n${n} assertions passed (Einstellungen: who am I, push status, sign out)`);
