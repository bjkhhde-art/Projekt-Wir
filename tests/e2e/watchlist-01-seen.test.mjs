import { chromium } from "playwright";
import assert from "node:assert/strict";

/* watchlist: open titles as cards, watched ones as a compact, collapsible list */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rows = async () => (await (await fetch(`${API}/t/watchlist/dump`)).json());

const entry = (id, title, media_type, watched, extra = {}) => ({
  id, title, media_type, watched, platform: null, added_by: "Isi", rating: null, watched_at: null,
  created_at: `2026-09-${String(id).padStart(2, "0")}T10:00:00Z`, ...extra
});
await post("/t/watchlist/seed", { rows: [
  entry(1, "Dune Part Three", "film", false, { platform: "Kino" }),
  entry(2, "The Bear", "serie", false),
  entry(3, "Past Lives", "film", true, { rating: 5, platform: "Netflix", watched_at: "2026-09-20T20:00:00Z" }),
  entry(4, "Arcane", "serie", true, { rating: 4, watched_at: "2026-09-25T20:00:00Z" }),
  entry(5, "La La Land", "film", true, { rating: 3, watched_at: "2026-08-02T20:00:00Z" }),
  entry(6, "Shōgun", "serie", true, { watched_at: "2026-09-28T20:00:00Z" })
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/wir.html?tab=watchlist");
await page.waitForTimeout(800);

ok(await page.locator(".watchlist-card").count() === 2, "titles still to watch stay big cards");
ok((await page.locator(".watchlist-section-label").first().textContent()).includes("Noch zu schauen · 2"), "the open section shows how many are left");
ok(await page.locator(".watched-row").count() === 4, "the four watched titles are compact rows");
const titles = await page.locator(".watched-title").allTextContents();
ok(JSON.stringify(titles) === JSON.stringify(["Shōgun", "Arcane", "Past Lives", "La La Land"]), `newest watched first (${titles.join(", ")})`);
const rowHeight = (await page.locator(".watched-row").first().boundingBox()).height;
const cardHeight = (await page.locator(".watchlist-card").first().boundingBox()).height;
ok(rowHeight < 60 && rowHeight < cardHeight / 2, `a watched row is much smaller than a card (${Math.round(rowHeight)}px vs ${Math.round(cardHeight)}px)`);
ok((await page.locator(".watched-toggle").textContent()).includes("4") && (await page.locator(".watched-toggle").textContent()).includes("Ø 4,0"), "the header shows the count and the average rating");
ok((await page.locator(".watched-meta").nth(2).textContent()).includes("Netflix") && (await page.locator(".watched-meta").nth(2).textContent()).includes("gesehen 20.9.2026"), "each row shows where and when");

/* collapse and remember */
await page.click(".watched-toggle");
ok(await page.locator(".watched-list").isHidden(), "the watched list folds away");
await page.reload(); await page.waitForTimeout(800);
ok(await page.locator(".watched-list").isHidden(), "and stays folded after reloading");
await page.fill("#watchlistSearchInput", "arc");
await page.waitForTimeout(200);
ok(await page.locator(".watched-list").isVisible() && await page.locator(".watched-row").count() === 1, "searching opens it and finds watched titles");
await page.fill("#watchlistSearchInput", "");
await page.waitForTimeout(200);
await page.click(".watched-toggle");
ok(await page.locator(".watched-list").isVisible(), "tapping the header opens it again");

/* rate right in the row */
await page.locator(".watched-row", { hasText: "Shōgun" }).locator(".watchlist-rating-heart").nth(3).click();
await wait(500);
ok((await rows()).find(r => r.id === 6).rating === 4, "rating a watched title works from its row");

/* hold a row → edit modal with 'not watched yet' and delete */
async function hold(locator) {
  await locator.evaluate(el => el.scrollIntoView({ block: "center" })); // not behind the sticky nav
  await wait(300);
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await wait(650);
  await page.mouse.up();
  await wait(200);
}
await hold(page.locator(".watched-row", { hasText: "La La Land" }).locator(".watched-main"));
ok(!(await page.locator("#watchlistModal").evaluate(el => el.classList.contains("hidden"))), "holding a watched row opens the edit form");
ok(await page.locator("#watchlistEditExtras").isVisible() && (await page.locator("#watchlistToggleWatchedBtn").textContent()).includes("noch nicht gesehen"), "the form offers 'noch nicht gesehen' and delete");
await page.click("#watchlistToggleWatchedBtn");
await wait(600);
ok((await rows()).find(r => r.id === 5).watched === false, "La La Land is back on the list");
ok(await page.locator(".watchlist-card", { hasText: "La La Land" }).count() === 1 && await page.locator(".watched-row").count() === 3, "it moves back to the big cards");

await hold(page.locator(".watched-row", { hasText: "Arcane" }).locator(".watched-main"));
await page.click("#watchlistDeleteBtn");
await page.click(".confirm-yes");
await wait(600);
ok(!(await rows()).some(r => r.id === 4), "deleting from the edit form removes the title");

/* the + form for a new title has no edit extras */
await page.click("#openWatchlistModal");
ok(await page.locator("#watchlistEditExtras").isHidden(), "a new entry form shows no delete button");
await page.click("#closeWatchlistModal");

/* marking an open title as watched moves it into the compact list */
await page.locator(".watchlist-card", { hasText: "The Bear" }).locator("button", { hasText: "Als gesehen markieren" }).click();
await wait(700);
ok((await page.locator(".watched-title").first().textContent()) === "The Bear", "a freshly watched title appears at the top of the list");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (watchlist: compact watched list)`);
