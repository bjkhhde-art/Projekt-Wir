import { chromium } from "playwright";
import assert from "node:assert/strict";

/* watchlist: choosing when a title was watched – while marking it, and later when editing */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rows = async () => (await (await fetch(`${API}/t/watchlist/dump`)).json());
const row = async id => (await rows()).find(r => r.id === id);
const TZ = "Europe/Berlin";
const berlinDay = iso => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
const berlinTime = iso => new Date(iso).toLocaleTimeString("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const today = berlinDay(new Date().toISOString());
const tomorrow = berlinDay(new Date(Date.now() + 36 * 3600000).toISOString());

const entry = (id, title, watched, extra = {}) => ({
  id, title, media_type: "film", watched, seen_by: null, platform: null, added_by: "Isi", rating: null, watched_at: null,
  created_at: `2026-01-${String(id).padStart(2, "0")}T10:00:00Z`, ...extra
});
await post("/t/watchlist/seed", { rows: [
  entry(1, "Dune", false),
  entry(2, "The Bear", false),
  entry(3, "Barbie", true, { seen_by: "both", watched_at: "2025-09-20T18:15:00Z" }),
  entry(4, "Arcane", true, { seen_by: "Isi", watched_at: "2025-06-01T19:00:00Z" })
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: TZ });
await ctx.addInitScript(() => {
  localStorage.setItem("pw_person", "Isi");
  localStorage.setItem("pw_watchlist_seen_open", "1");
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/wir.html?tab=watchlist");
await page.waitForTimeout(800);

async function hold(locator) {
  await locator.evaluate(el => el.scrollIntoView({ block: "center" }));
  await wait(300);
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await wait(650);
  await page.mouse.up();
  await wait(200);
}
const watchedTitles = () => page.locator(".watched-title").allTextContents();
const markButton = title => page.locator(".watchlist-card", { hasText: title }).locator("button", { hasText: "Als gesehen markieren" });

/* marking as watched: today unless changed */
await markButton("Dune").click();
ok(await page.locator("#seenByDateInput").inputValue() === today, "marking as watched suggests today");
ok(await page.locator("#seenByDateInput").getAttribute("max") === today, "days after today cannot be picked");
await page.fill("#seenByDateInput", "2025-12-24");
await page.click('#seenByModal .seen-by-btn[data-seen="both"]');
await wait(700);
const dune = await row(1);
ok(dune.watched && dune.seen_by === "both" && berlinDay(dune.watched_at) === "2025-12-24", "an earlier day can be chosen right away");
ok((await page.locator(".watched-row", { hasText: "Dune" }).locator(".watched-meta").textContent()).includes("gesehen 24.12.2025"), "the row shows the chosen day");
ok(JSON.stringify(await watchedTitles()) === JSON.stringify(["Dune", "Barbie", "Arcane"]), "the list is ordered by that day");

/* a day in the future is refused */
await markButton("The Bear").click();
await page.fill("#seenByDateInput", tomorrow);
await page.click('#seenByModal .seen-by-btn[data-seen="Benji"]');
await wait(400);
ok((await row(2)).watched === false && await page.locator("#seenByModal").isVisible(), "a future day is not stored and the question stays open");
await page.fill("#seenByDateInput", today);
await page.click('#seenByModal .seen-by-btn[data-seen="Benji"]');
await wait(700);
ok(berlinDay((await row(2)).watched_at) === today, "with today it is stored");

/* changing the day later, by holding the row */
await hold(page.locator(".watched-row", { hasText: "Barbie" }).locator(".watched-main"));
ok(await page.locator("#watchlistWatchedAtInput").isVisible() && await page.locator("#watchlistWatchedAtInput").inputValue() === "2025-09-20", "the edit form shows the watch day");
await page.fill("#watchlistWatchedAtInput", "2026-01-05");
await page.click("#saveWatchlistBtn");
await wait(700);
const barbie = await row(3);
ok(berlinDay(barbie.watched_at) === "2026-01-05", "the new day is stored");
ok(berlinTime(barbie.watched_at) === "20:15", "the time of day stays the same (20:15 in Berlin)");
ok(barbie.seen_by === "both", "who watched it is untouched");
ok((await page.locator(".watched-row", { hasText: "Barbie" }).locator(".watched-meta").textContent()).includes("gesehen 5.1.2026"), "the row shows the new day");
ok(JSON.stringify(await watchedTitles()) === JSON.stringify(["The Bear", "Barbie", "Dune", "Arcane"]), "and the list re-sorts");

/* editing something else does not touch the date; emptying the field keeps it */
const arcaneBefore = (await row(4)).watched_at;
await hold(page.locator(".watched-row", { hasText: "Arcane" }).locator(".watched-main"));
await page.click('#watchlistSeenByField .seen-by-btn[data-seen="both"]');
await page.click("#saveWatchlistBtn");
await wait(700);
ok((await row(4)).watched_at === arcaneBefore && (await row(4)).seen_by === "both", "saving other changes leaves the date exactly as it was");
await hold(page.locator(".watched-row", { hasText: "Arcane" }).locator(".watched-main"));
await page.fill("#watchlistWatchedAtInput", "");
await page.click("#saveWatchlistBtn");
await wait(700);
ok((await row(4)).watched_at === arcaneBefore, "an emptied date field keeps the old date");
await hold(page.locator(".watched-row", { hasText: "Arcane" }).locator(".watched-main"));
await page.fill("#watchlistWatchedAtInput", tomorrow);
await page.click("#saveWatchlistBtn");
await wait(500);
ok((await row(4)).watched_at === arcaneBefore && await page.locator("#watchlistModal").isVisible(), "a future day is refused when editing too");
await page.click("#closeWatchlistModal");

/* the date filter follows the edited day */
await page.click("#watchlistFilterToggle");
await page.locator('.wl-filter-group[data-group="periods"] .wl-chip', { hasText: "2025" }).click();
ok(JSON.stringify((await watchedTitles()).sort()) === JSON.stringify(["Arcane", "Dune"]), "the year filter uses the edited days");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (watchlist: watch date)`);
