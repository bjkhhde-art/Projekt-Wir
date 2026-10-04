import { chromium } from "playwright";
import assert from "node:assert/strict";

/* watchlist filter panel: several choices per group, groups combined, remembered */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const daysAgo = d => new Date(Date.now() - d * 86400000).toISOString();
const entry = (id, title, media_type, extra = {}) => ({
  id, title, media_type, watched: false, seen_by: null, platform: null, added_by: "Isi", rating: null, watched_at: null,
  created_at: `2026-01-${String(id).padStart(2, "0")}T10:00:00Z`, ...extra
});
await post("/t/watchlist/seed", { rows: [
  entry(1, "Barbie", "film", { watched: true, seen_by: "both", platform: "Netflix", watched_at: daysAgo(5) }),
  entry(2, "Lupin", "serie", { watched: true, seen_by: "Benji", platform: "Netflix", watched_at: daysAgo(60) }),
  entry(3, "Beat", "serie", { watched: true, platform: "Prime Video", watched_at: "2025-11-02T20:00:00Z" }),
  entry(4, "Dune", "film", { platform: "Kino" }),
  entry(5, "Arcane", "serie", { watched: true, seen_by: "Isi", platform: "netflix", watched_at: daysAgo(200) }),
  entry(6, "The Bear", "serie", { platform: "Disney+" })
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await page.goto("http://localhost:9091/wir.html?tab=watchlist");
await page.waitForTimeout(800);

const shown = async () => {
  const cards = await page.locator(".watchlist-title").allTextContents();
  const rows = await page.locator(".watched-title").allTextContents();
  return [...cards, ...rows].sort();
};
const chip = (group, text) => page.locator(`.wl-filter-group[data-group="${group}"] .wl-chip`, { hasText: text });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b.slice().sort());

ok(await page.locator(".watchlist-filter-btn").count() === 0, "the three fixed buttons are gone");
ok(await page.locator("#watchlistFilterPanel").isHidden(), "the filter panel starts folded");
await page.click("#watchlistFilterToggle");
ok(await page.locator("#watchlistFilterPanel").isVisible(), "'Filter' opens the panel");
ok(await page.locator('.wl-filter-group[data-group="status"] .wl-chip').count() === 5, "status: open, together, Isi, Benji, without info");
const platforms = await page.locator('.wl-filter-group[data-group="platforms"] .wl-chip').allTextContents();
ok(platforms.map(p => p.replace(/\s+/g, " ").trim()).join("|") === "Netflix 3|Disney+ 1|Kino 1|Prime Video 1", `platforms come from the list with counts, Netflix/netflix merged (${platforms.map(p => p.replace(/\s+/g, " ").trim()).join(", ")})`);
ok((await page.locator('.wl-filter-group[data-group="periods"] .wl-chip').allTextContents()).map(t => t.trim()).join("|").includes("2025"), "years come from the watch dates");

/* several choices within one group */
await chip("types", "Serien").click();
ok(same(await shown(), ["Lupin", "Beat", "Arcane", "The Bear"]), "Serien only");
await chip("types", "Filme").click();
ok(same(await shown(), ["Barbie", "Lupin", "Beat", "Dune", "Arcane", "The Bear"]), "Filme + Serien together = everything");
ok((await page.locator("#watchlistFilterCount").textContent()) === "2", "the button counts the active choices");
await page.click("#watchlistFilterReset");
ok(await page.locator("#watchlistFilterCount").isHidden(), "Zurücksetzen clears everything");

await chip("status", "Isi allein").click();
await chip("status", "Benji allein").click();
ok(same(await shown(), ["Lupin", "Arcane"]), "Isi alone OR Benji alone");
ok(await page.locator(".watched-list").isVisible(), "the watched list opens automatically while filtering");
ok((await page.locator("#watchlistResultCount").textContent()) === "2 von 6", "the result count is shown");

/* groups combine */
await chip("platforms", "Netflix").click();
await chip("periods", "Letzte 3 Monate").click();
ok(same(await shown(), ["Lupin"]), "Isi/Benji alone AND Netflix AND last 3 months → Lupin");
await page.click("#watchlistFilterReset");

await chip("status", "Noch offen").click();
ok(same(await shown(), ["Dune", "The Bear"]), "not watched yet");
await chip("platforms", "Kino").click();
ok(same(await shown(), ["Dune"]), "not watched yet AND Kino");
await page.click("#watchlistFilterReset");

/* date range */
await page.fill("#watchlistFilterFrom", "2025-10-01");
await page.fill("#watchlistFilterTo", "2025-12-31");
await page.locator("#watchlistFilterTo").dispatchEvent("change");
ok(same(await shown(), ["Beat"]), "a custom from–to range");
await chip("periods", "Letzte 30 Tage").click();
ok(same(await shown(), []), "range and period both have to fit");
ok((await page.locator(".watchlist-empty").textContent()).includes("Nichts gefunden"), "an empty result says so");
await page.click("#watchlistFilterReset");
ok(await page.locator("#watchlistFilterFrom").inputValue() === "", "reset also clears the dates");

/* remembered on this phone, works together with search */
await chip("platforms", "Netflix").click();
await page.reload();
await page.waitForTimeout(800);
ok((await page.locator("#watchlistFilterCount").textContent()) === "1" && same(await shown(), ["Barbie", "Lupin", "Arcane"]), "the filter is remembered after reloading");
await page.fill("#watchlistSearchInput", "arcan");
await page.waitForTimeout(200);
ok(same(await shown(), ["Arcane"]), "search and filters work together");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (watchlist: filter panel)`);
