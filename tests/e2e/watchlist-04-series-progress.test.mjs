import { chromium } from "playwright";
import assert from "node:assert/strict";

/* watchlist: a series we are watching – seasons and episodes are entered once, episodes are ticked off,
   and the last tick moves the series to "Schon gesehen" */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const row = async id => (await (await fetch(`${API}/t/watchlist/dump`)).json()).find(r => r.id === id);

await post("/t/watchlist/seed", { rows: [
  { id: 1, title: "Maxton Hall", media_type: "serie", watched: false, watching: false, seen_by: null, platform: "Prime Video", added_by: "Isi", rating: null, watched_at: null, created_at: "2026-01-01T10:00:00Z" },
  { id: 2, title: "Dune", media_type: "film", watched: false, watching: false, seen_by: null, platform: null, added_by: "Isi", rating: null, watched_at: null, created_at: "2026-01-02T10:00:00Z" }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  localStorage.setItem("pw_person", "Isi");
  localStorage.setItem("pw_watchlist_seen_open", "1");
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/wir.html?tab=watchlist");
await page.waitForTimeout(800);

ok(await page.locator(".watchlist-card", { hasText: "Dune" }).locator("button", { hasText: "Wir schauen gerade" }).count() === 0, "films have no 'watching' button");

/* start: counts are asked for first */
await page.locator(".watchlist-card", { hasText: "Maxton Hall" }).locator("button", { hasText: "Wir schauen gerade" }).click();
ok(await page.locator("#watchlistWatchingInput").isChecked(), "the form opens with 'Wir schauen gerade' ticked");
await page.click("#saveWatchlistBtn");
await wait(300);
ok((await row(1)).watching === false, "saving without counts is refused");
await page.fill("#watchlistSeasonsInput", "2");
await page.fill("#watchlistEpisodesInput", "2");
await page.click("#saveWatchlistBtn");
await wait(700);
let r = await row(1);
ok(r.watching && r.season_count === 2 && r.episodes_per_season === 2, "series is running with 2 seasons × 2 episodes");
ok(await page.locator(".watch-episode").count() === 4, "four episode buttons");
ok((await page.locator(".watchlist-section-label").first().textContent()).includes("Wir schauen gerade"), "own section above the rest");

/* ticking */
await page.locator(".watch-episode").nth(0).click();
await wait(500);
ok(JSON.stringify((await row(1)).episodes_seen) === '["1-1"]', "episode 1 of season 1 stored");
await page.locator(".watch-season-all").nth(1).click();
await wait(500);
ok(JSON.stringify((await row(1)).episodes_seen.sort()) === '["1-1","2-1","2-2"]', "'Alle gesehen' ticks a whole season");
ok((await page.locator(".watch-progress").textContent()).includes("3 von 4"), "progress shows 3 of 4");
await page.locator(".watch-episode").nth(2).click();
await wait(500);
ok(JSON.stringify((await row(1)).episodes_seen.sort()) === '["1-1","2-2"]', "a ticked episode can be unticked");

/* finishing */
await page.locator(".watch-episode").nth(1).click();
await wait(500);
ok(!(await row(1)).watched, "three of four is not finished yet");
await page.locator(".watch-episode").nth(2).click();
await wait(800);
r = await row(1);
ok(r.watched && !r.watching && r.seen_by === "both" && r.watched_at, "last episode moves the series to 'gesehen'");
ok((await page.locator(".watched-title").allTextContents()).includes("Maxton Hall"), "it shows up under 'Schon gesehen'");
ok(await page.locator(".watch-episode").count() === 0, "no episode grid any more");

ok(errors.length === 0, "no page errors: " + errors.join("; "));
await browser.close();
console.log(`\n${n} assertions passed (watchlist series progress)`);
