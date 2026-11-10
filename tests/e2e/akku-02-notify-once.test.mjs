import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Kuschelakku, found in the test report: one notification per adjustment (not per step), to the other
   person – also when Isi changes Benji's battery – and the battery is called "Isi", not "Isi G" */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const level = async person => (await (await fetch(`${API}/t/cuddle_batteries/dump`)).json()).find(r => r.person === person).level;

await post("/t/cuddle_batteries/seed", { rows: [
  { id: 1, person: "Isi G", level: 40, created_at: "2026-01-01T10:00:00Z", updated_at: new Date().toISOString() },
  { id: 2, person: "Benji", level: 80, created_at: "2026-01-01T10:00:01Z", updated_at: new Date().toISOString() }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const notices = () => page.evaluate(() => (window.__mockInvocations || []).filter(i => i.body.category === "battery"));

await page.goto("http://localhost:9091/batterien.html");
await page.waitForFunction(() => document.getElementById("percent-benji").textContent === "80%");
ok(await page.locator(".battery-name").first().textContent() === "Isi", "the battery is called Isi (not 'Isi G')");

/* Isi gives her own battery four quick taps */
await page.focus("#battery-isi-g");
for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
await new Promise(r => setTimeout(r, 400));
ok(await level("Isi G") === 60, "every step is saved (40 → 60)");
ok((await notices()).length === 0, "no notification while she is still adjusting");
await page.waitForFunction(() => (window.__mockInvocations || []).some(i => i.body.category === "battery"), null, { timeout: 4000 });
await new Promise(r => setTimeout(r, 300));
const own = await notices();
ok(own.length === 1 && own[0].body.body === "Isi hat den Akku auf 60% gesetzt." && own[0].body.excludePerson === "Isi", "then exactly one notification with the final level, to Benji");

/* Isi changes Benji's battery: Benji is told, Isi's own phone is not */
await page.focus("#battery-benji");
await page.keyboard.press("PageDown");
await page.waitForFunction(() => (window.__mockInvocations || []).filter(i => i.body.category === "battery").length === 2, null, { timeout: 4000 });
const theirs = (await notices())[1];
ok(theirs.body.excludePerson === "Isi" && theirs.body.body === "Isi hat Benjis Akku auf 70% gesetzt.", "changing Benji's battery notifies Benji and says who did it");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/cuddle_batteries/reset", {});
console.log(`\n${n} assertions passed (Kuschelakku: notifications)`);
