import { chromium } from "playwright";
import assert from "node:assert/strict";

/* the existing Mochi features keep working on top of the versioned writes: shop, room, sleep */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const petRow = async () => (await (await fetch(API + "/t/pet_state/dump")).json())[0];
const hoursAgo = h => new Date(Date.now() - h * 3600000).toISOString();

await post("/t/mochi_messages/seed", { rows: [] });
await post("/t/pet_state/seed", { rows: [{
  id: "shared", version: 7, hunger: 80, energy: 40, cleanliness: 80, bond: 60, coins: 50, care_score: 10,
  total_care_actions: 5, total_coins_earned: 60, owned_items: [], room_decor: [], daily: {},
  updated_at: hoursAgo(4), created_at: hoursAgo(100), last_interacted_by: "Benji"
}] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/mochi.html");
await wait(1200);

/* buying an outfit */
await page.click("#openShopBtn");
await page.click('.shop-tab[data-tab="outfit"]');
await page.click('.shop-item-btn[data-action="buy"][data-id="party"]');
await wait(500);
let row = await petRow();
ok(row.coins === 35 && row.owned_items.includes("party") && row.equipped_hat === "party", "buying the party hat costs 15 coins and puts it on");
ok(row.version === 8, "the purchase is a single versioned write");
ok(row.hunger < 80, `a purchase stores the decayed stats instead of resetting them (hunger ${row.hunger})`);
ok(!(await page.locator("#hatParty").evaluate(el => el.classList.contains("hidden"))), "Mochi wears the party hat");

/* a stale write from the other phone is retried on fresh data */
await fetch(API + "/t/pet_state/games/shared", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coins: 100, version: 9 }) });
await page.click('.shop-item-btn[data-action="buy"][data-id="cap"]');
await wait(800);
row = await petRow();
ok(row.coins === 85 && row.owned_items.includes("cap") && row.version === 10, "a purchase after the other phone changed coins reloads and charges the fresh balance (100 → 85)");

/* room decoration */
await page.click('.shop-tab[data-tab="room"]');
await page.click('.shop-item-btn[data-action="buy"][data-id="plant"]');
await wait(400);
await page.click('.shop-item-btn[data-action="unequip"][data-id="plant"]');
await wait(400);
row = await petRow();
ok(row.owned_items.includes("plant") && !row.room_decor.includes("plant"), "decor can be bought and put away again");
await page.click("#closeShopModal");

/* sleeping and waking */
await page.click("#sleepBtn");
await wait(400);
row = await petRow();
ok(!!row.sleep_started_at, "Mochi falls asleep");
ok(await page.locator("#petCreature").evaluate(el => el.classList.contains("sleeping")), "the sleeping scene is shown");
ok(await page.locator("#messengerBtn").evaluate(el => el.classList.contains("hidden")), "activities are hidden while Mochi sleeps");
await page.click("#sleepBtn");
await wait(2200);
row = await petRow();
ok(row.sleep_started_at === null, "waking Mochi clears the nap");
ok(!(await page.locator("#petCreature").evaluate(el => el.classList.contains("sleeping"))), "Mochi is awake again");

/* feeding still works */
const before = await petRow();
await page.click("#feedBtn");
await page.click('.food-btn[data-food="Karotte"]');
await wait(600);
row = await petRow();
ok(row.hunger >= Math.min(100, before.hunger + 40) && row.total_care_actions === before.total_care_actions + 1, "feeding fills the carrot bar");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (mochi: shop, room, sleep, stale writes)`);
