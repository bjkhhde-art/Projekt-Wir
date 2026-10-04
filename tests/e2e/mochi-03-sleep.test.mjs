import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Mochi keeps sleeping – across closing and reopening the page – until one of us wakes him */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const petRow = async () => (await (await fetch(API + "/t/pet_state/dump")).json())[0];
const hoursAgo = h => new Date(Date.now() - h * 3600000).toISOString();

await post("/t/mochi_messages/seed", { rows: [] });
await post("/t/pet_state/seed", { rows: [{
  id: "shared", version: 3, hunger: 90, energy: 40, cleanliness: 90, bond: 90, coins: 20, care_score: 10,
  total_care_actions: 5, total_coins_earned: 30, owned_items: [], room_decor: [], daily: {},
  sleep_started_at: hoursAgo(6), updated_at: hoursAgo(6), created_at: hoursAgo(100), last_interacted_by: "Benji"
}] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const sleeping = () => page.locator("#petCreature").evaluate(el => el.classList.contains("sleeping"));

await page.goto("http://localhost:9091/mochi.html");
await wait(1200);
ok(await sleeping(), "put to bed six hours ago, Mochi is still asleep when the page opens");
ok((await page.locator("#sleepLabel").textContent()) === "Aufwecken", "the button offers to wake him");
const energyWidth = await page.locator("#statEnergyFill").evaluate(el => el.style.width);
ok(energyWidth === "40%", `his energy did not drop while he slept (${energyWidth})`);

await page.reload();
await wait(1200);
ok(await sleeping(), "closing and reopening the page does not wake him");

/* stroking or tapping does not wake him either – only holding him or the wake button */
const box = await page.locator("#petCreature").boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.7);
await wait(400);
ok(await sleeping() && !!(await petRow()).sleep_started_at, "a quick tap keeps him asleep");

await page.click("#sleepBtn");
await wait(2400);
const row = await petRow();
ok(!(await sleeping()) && row.sleep_started_at === null, "the wake button wakes him");
ok(row.energy === 90 && row.coins === 26, `fully rested: +50 energy and 6 coins (energy ${row.energy}, coins ${row.coins})`);

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (mochi: sleeps until woken)`);
