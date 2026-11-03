import { chromium } from "playwright";
import assert from "node:assert/strict";

/* garden (plant, water, harvest, feed the fruit), the star rain mini game and the new shop items */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const petRow = async () => (await (await fetch(API + "/t/pet_state/dump")).json())[0];
const hoursAgo = h => new Date(Date.now() - h * 3600000).toISOString();

await post("/t/mochi_messages/seed", { rows: [] });
await post("/t/pet_state/seed", { rows: [{
  id: "shared", version: 1, hunger: 40, energy: 90, cleanliness: 80, bond: 60, coins: 100, care_score: 10,
  total_care_actions: 5, total_coins_earned: 60, owned_items: [], room_decor: [], daily: {}, extras: {},
  updated_at: hoursAgo(0), created_at: hoursAgo(100), last_interacted_by: "Benji"
}] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/mochi.html");
await wait(1200);

/* planting a cherry (ripe after one watering) */
await page.click("#gardenBtn");
await wait(500);
ok(await page.locator(".garden-plot").count() === 4, "the garden shows four plots");
await page.click('.garden-plot-btn[data-action="plant"][data-plot="0"]');
await page.click('#seedList .shop-item-btn[data-seed="cherry"]');
await wait(500);
let row = await petRow();
ok(row.coins === 94 && row.extras.garden[0].seed === "cherry", "planting a cherry costs 6 coins");
await page.click('.garden-plot-btn[data-action="water"][data-plot="0"]');
await wait(500);
row = await petRow();
ok(row.extras.garden[0].waterings === 1 && row.coins === 95, "watering pays a coin");
ok(await page.locator('.garden-plot-btn[data-action="harvest"][data-plot="0"]').count() === 1, "the ripe cherry can be harvested");
await page.click('.garden-plot-btn[data-action="harvest"][data-plot="0"]');
await wait(500);
row = await petRow();
ok(row.extras.pantry.Kirsche === 1 && row.extras.garden[0] === null && row.extras.harvests === 1, "the cherry lands in the pantry");
ok((await page.textContent("#gardenPantry")).includes("Kirsche"), "the pantry shows the cherry");
await page.click("#leaveGardenScene");
await wait(800);

/* feeding the home-grown cherry */
const before = await petRow();
await page.click("#feedBtn");
ok(await page.locator(".garden-food-btn").count() === 1, "the food menu offers the cherry from the garden");
await page.click('.garden-food-btn[data-food="Kirsche"]');
await wait(700);
row = await petRow();
ok(!row.extras.pantry.Kirsche && row.hunger >= Math.min(100, before.hunger + 55), "the cherry is eaten and fills Mochi up");

/* star rain */
await page.click("#starsBtn");
await wait(600);
await page.click("#starsPlayBtn");
await wait(1500);
const caught = await page.evaluate(() => {
  let hits = 0;
  document.querySelectorAll(".stars-drop.star, .stars-drop.golden").forEach(el => {
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    hits++;
  });
  return hits;
});
ok(caught > 0, `stars fall and can be caught (${caught})`);
await page.waitForSelector("#starsStart:not(.hidden)", { timeout: 25000 });
await wait(600);
row = await petRow();
ok(row.extras.star_games === 1 && row.extras.star_best > 0, `the round is saved (best ${row.extras.star_best})`);
ok(row.daily.star_rounds && row.daily.star_rounds.Isi === 1, "the paid round is counted for Isi");
ok(row.energy <= 90 - 15 + 1, "playing costs Mochi energy");
await page.click("#leaveStarsScene");
await wait(800);

/* a new outfit */
await page.click("#openShopBtn");
await page.click('.shop-tab[data-tab="outfit"]');
await page.click('.shop-item-btn[data-action="buy"][data-id="bunny"]');
await wait(500);
ok(!(await page.locator("#hatBunny").evaluate(el => el.classList.contains("hidden"))), "Mochi wears the new bunny ears");
await page.click("#closeShopModal");

await page.click("#openAchievementsBtn");
ok((await page.textContent("#achievementsList")).includes("Grüner Daumen"), "the garden achievements are listed");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (mochi: garden, star rain, new shop items)`);
