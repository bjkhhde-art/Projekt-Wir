import { chromium } from "playwright";
import assert from "node:assert/strict";

/* watchlist in ToDos: how something was watched – together live, both separately, only Isi, only Benji –
   for films, whole series and single episodes */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const row = async id => (await (await fetch(`${API}/t/watchlist/dump`)).json()).find(r => r.id === id);

const base = { platform: null, added_by: "Isi", rating: null, watched_at: null, seen_by: null, watching: false };
await post("/t/watchlist/seed", { rows: [
  { ...base, id: 1, title: "Severance", media_type: "serie", watched: false, watching: true, platform: "Apple TV+",
    season_episodes: [3, 2], episodes_seen: ["1-1"], episode_seen_by: {}, created_at: "2026-01-01T10:00:00Z" },
  { ...base, id: 2, title: "Oppenheimer", media_type: "film", watched: false, created_at: "2026-01-02T10:00:00Z" },
  { ...base, id: 3, title: "Barbie", media_type: "film", watched: true, seen_by: "both", watched_at: "2026-02-01T20:00:00Z", created_at: "2026-01-03T10:00:00Z" }
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

/* the watchlist lives in ToDos now; old links still find it */
await page.goto("http://localhost:9091/wir.html?tab=watchlist");
await page.waitForURL(/ziele\.html\?tab=watchlist$/);
await page.waitForTimeout(800);
ok(await page.locator('.hub-tab.active[data-tab="watchlist"]').count() === 1, "old Wir links open the Watchlist tab in ToDos");
ok(await page.locator("#openWatchlistModal").isVisible() && await page.locator("#openAddModal").isHidden(), "only the watchlist + button shows on its tab");
ok(await page.locator("#board").isHidden(), "the quest board is hidden on the watchlist tab");
const stats = (await page.locator("#watchlistStats").textContent()).replace(/\s+/g, " ");
ok(stats.includes("🍿 1") && stats.includes("📺 1") && stats.includes("✅ 1") && stats.includes("👫 1"), `overview numbers: open, running, watched, together (${stats.trim()})`);

/* episodes: the old tick counts as together, the next one is marked */
const card = page.locator(".watchlist-card", { hasText: "Severance" });
ok(await card.locator(".watch-episode").nth(0).getAttribute("data-mode") === "both", "an episode ticked before the modes existed shows as together");
ok((await card.locator(".watchlist-type-badge").textContent()).includes("S1 · F2"), "the card says where to go on");
ok(await card.locator(".watch-mode-btn.selected").getAttribute("data-mode") === "both", "ticking starts as 'Zusammen live'");

/* Isi watched episode 2 alone */
await card.locator('.watch-mode-btn[data-mode="Isi"]').click();
await card.locator(".watch-episode").nth(1).click();
await wait(500);
let r = await row(1);
ok(JSON.stringify(r.episode_seen_by) === '{"1-1":"both","1-2":"Isi"}' && r.episodes_seen.length === 2, "episode 2 is stored as 'only Isi'");
ok(await card.locator(".watch-episode").nth(1).getAttribute("data-mode") === "Isi", "and shown in Isi's colour");
ok(await card.locator(".watch-mode-btn.selected").getAttribute("data-mode") === "Isi", "the chosen way stays for the next ticks");
ok((await card.locator(".watch-mode-summary").textContent()).includes("Nur Isi 1"), "the summary counts episodes per way");

/* tapping it again with the same way takes it back; another way switches it */
await card.locator(".watch-episode").nth(1).click();
await wait(500);
ok(!(await row(1)).episodes_seen.includes("1-2"), "same way again unticks the episode");
await card.locator(".watch-episode").nth(1).click();
await wait(500);
await card.locator('.watch-mode-btn[data-mode="separate"]').click();
await card.locator(".watch-episode").nth(1).click();
await wait(500);
ok((await row(1)).episode_seen_by["1-2"] === "separate", "another way switches the tick to 'Beide getrennt'");

/* the choice per series is remembered on this phone */
await page.reload(); await page.waitForTimeout(800);
ok(await page.locator(".watchlist-card", { hasText: "Severance" }).locator(".watch-mode-btn.selected").getAttribute("data-mode") === "separate", "the chosen way survives a reload");

/* the rest separately → the whole series counts as watched separately */
await page.locator(".watchlist-card", { hasText: "Severance" }).locator(".watch-season-all").nth(1).click();
await wait(500);
await page.locator(".watchlist-card", { hasText: "Severance" }).locator(".watch-episode").nth(2).click();
await wait(800);
r = await row(1);
ok(r.watched && r.seen_by === "separate", `finished series: mostly separately → 'Beide getrennt' (${r.seen_by})`);
ok((await page.locator(".watched-row", { hasText: "Severance" }).locator(".watched-meta").textContent()).includes("👥 Beide getrennt"), "the row says so");

/* a film watched separately */
await page.locator(".watchlist-card", { hasText: "Oppenheimer" }).locator("button", { hasText: "Als gesehen markieren" }).click();
ok(await page.locator("#seenByModal .seen-by-btn").count() === 4, "the question offers four ways");
await page.click('#seenByModal .seen-by-btn[data-seen="separate"]');
await wait(700);
ok((await row(2)).seen_by === "separate", "'Beide getrennt' is stored for a film");

/* and it can be changed later in the form */
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
await hold(page.locator(".watched-row", { hasText: "Barbie" }).locator(".watched-main"));
ok(await page.locator("#watchlistSeenByField .seen-by-btn").count() === 4, "the edit form has the same four ways");
await page.click('#watchlistSeenByField .seen-by-btn[data-seen="Benji"]');
await page.click("#saveWatchlistBtn");
await wait(700);
ok((await row(3)).seen_by === "Benji", "changed to 'only Benji'");

/* taking a series back clears the episode ways too */
await hold(page.locator(".watched-row", { hasText: "Severance" }).locator(".watched-main"));
await page.click("#watchlistToggleWatchedBtn");
await page.click(".confirm-yes");
await wait(700);
r = await row(1);
ok(!r.watched && r.episodes_seen.length === 0 && JSON.stringify(r.episode_seen_by) === "{}", "'noch nicht gesehen' clears the episodes and how they were watched");

/* the quest is still one tap away */
await page.click('.hub-tab[data-tab="quest"]');
await wait(300);
ok(await page.locator("#board").isVisible() && await page.locator("#openAddModal").isVisible() && await page.locator("#openWatchlistModal").isHidden(), "the Couple Quest tab shows the board and its own + button");

/* nothing sticks out sideways on a small phone */
await page.setViewportSize({ width: 360, height: 740 });
await page.click('.hub-tab[data-tab="watchlist"]');
await wait(300);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scrolling at 360 px");

ok(errors.length === 0, "no page errors: " + errors.join("; "));
await browser.close();
console.log(`\n${n} assertions passed (watchlist: how we watched)`);
