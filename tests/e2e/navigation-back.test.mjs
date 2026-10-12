import { chromium } from "playwright";
import assert from "node:assert/strict";

/* the phone's back button inside a page: back to the previous tab, from a trip back to the overview,
   from Versus back to the other games – and only then to the page before */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

await post("/t/trips/seed", { rows: [
  { id: 1, title: "Alicante", location: "Alicante", start_date: "2026-08-29", end_date: "2026-09-02", cover_url: null, coordinates: null, created_at: "2026-08-01T10:00:00Z" }
] });
await post("/t/trip_images/seed", { rows: [] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  localStorage.setItem("pw_person", "Isi");
  localStorage.removeItem("pw_hub_tab_wir");
  localStorage.removeItem("pw_hub_tab_reise");
  localStorage.removeItem("pw_questions_mode");
});
await ctx.route(/leaflet.*\.js/, route => route.fulfill({
  contentType: "text/javascript",
  body: `(function () {
    const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? undefined : chain(), apply: () => chain() });
    window.L = chain();
  })();`
}));
await ctx.route(/leaflet.*\.css/, route => route.fulfill({ contentType: "text/css", body: "" }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const back = async () => {
  await page.evaluate(() => history.back());
  await wait(500);
};
const activeTab = () => page.locator(".hub-tab.active").getAttribute("data-tab");

/* ---------- Wir: three tabs ---------- */
await page.goto("http://localhost:9091/index.html");
await wait(400);
await page.goto("http://localhost:9091/wir.html");
await wait(500);
ok(await activeTab() === "watchlist", "Wir opens with the first tab");
await page.click('.hub-tab[data-tab="briefe"]');
await wait(200);
await page.click('.hub-tab[data-tab="privat"]');
await wait(200);
ok(page.url().endsWith("wir.html?tab=privat"), "the address shows the open tab");
await back();
ok(await activeTab() === "briefe" && page.url().endsWith("?tab=briefe"), "back: the previous tab (Briefe), not the start page");
await back();
ok(await activeTab() === "watchlist", "back again: the first tab");
await back();
ok(page.url().endsWith("/index.html"), "only then back to the page before");

/* ---------- Reise: tab, trip, overview ---------- */
await page.goto("http://localhost:9091/reise.html");
await wait(600);
await page.click('.hub-tab[data-tab="erinnerungen"]');
await wait(400);
await page.locator(".memory-card", { hasText: "Alicante" }).click();
await wait(500);
ok(!(await page.locator("#galleryView").evaluate(el => el.classList.contains("hidden"))), "a trip is open");
await back();
ok(await page.locator("#galleryView").evaluate(el => el.classList.contains("hidden")) && !(await page.locator("#memoryOverview").evaluate(el => el.classList.contains("hidden"))), "back closes the trip and shows the overview");
ok(await activeTab() === "erinnerungen", "still on Erinnerungen");
await page.locator(".memory-card", { hasText: "Alicante" }).click();
await wait(500);
await page.click("#backToMemories");
await wait(500);
ok(await page.locator("#galleryView").evaluate(el => el.classList.contains("hidden")), "the on-page back button closes the trip as well");
await back();
ok(await activeTab() === "vergleich", "and the next back goes to the previous tab – the trip is not reopened");

/* ---------- questions: talk → other → Versus ---------- */
await page.goto("http://localhost:9091/questions.html");
await wait(700);
ok(!(await page.locator("#talkMode").isHidden()), "the questions page opens with the talk questions");
await page.click('.mode-btn[data-mode="other"]');
await wait(300);
ok(!(await page.locator("#otherMode").isHidden()), "Andere is open");
await back();
ok(!(await page.locator("#talkMode").isHidden()) && await page.locator("#otherMode").isHidden(), "back returns to the talk questions");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (back button inside pages)`);
