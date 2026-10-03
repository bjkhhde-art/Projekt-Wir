import { chromium } from "playwright";
import assert from "node:assert/strict";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(page.url() + ": " + e.message));
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const base = "http://localhost:9091/";
const activeNav = () => page.locator(".nav-item.active").getAttribute("href");

await page.goto(base + "games.html"); await page.waitForTimeout(400);
const tiles = await page.locator(".game-tile h2").allTextContents();
ok(JSON.stringify(tiles) === JSON.stringify(["Cabo", "6 nimmt!", "Qwixx", "Couple Quest"]), `Games tab lists Couple Quest next to the other games (${tiles.join(", ")})`);
await page.locator(".game-tile", { hasText: "Couple Quest" }).click();
await page.waitForTimeout(600);
ok(page.url().endsWith("couple-quest.html"), "the tile opens the Couple Quest page");
ok(await page.locator("h1").textContent() === "Couple Quest 🎯", "Couple Quest has its own page");
ok(await page.locator("#board").count() === 1 && await page.locator("#openAddModal").isVisible(), "board and add button are there");
await page.locator("#openAddModal").click(); await page.waitForTimeout(200);
ok(!(await page.locator("#addModal").evaluate(el => el.classList.contains("hidden"))), "adding a bingo field still opens its form");
await page.locator("#closeModal").click();
ok(await activeNav() === "games.html", "the bottom nav highlights Games");

await page.goto(base + "ziele.html"); await page.waitForTimeout(500);
ok(await page.locator(".hub-tab").count() === 0 && await page.locator("#board").count() === 0, "Ziele no longer contains the quest");
ok(await page.locator("#visionTimeline").count() === 1 && await page.locator("#openVisionModal").isVisible(), "Ziele shows the vision with its add button");
ok((await page.locator(".page-subtitle").textContent()).includes("Vision"), "Ziele's subtitle is about the vision");
ok(await activeNav() === "ziele.html", "Ziele highlights Ziele");

await page.goto(base + "ziele.html?tab=quest"); await page.waitForTimeout(600);
ok(page.url().endsWith("couple-quest.html"), "old quest links (e.g. from push notifications) land on Couple Quest");

for (const game of ["cabo.html", "nimmt.html", "qwixx.html"]) {
  await page.goto(base + game); await page.waitForTimeout(300);
  ok(await activeNav() === "games.html", `${game} highlights Games in the nav`);
}

await page.goto(base + "index.html"); await page.waitForTimeout(500);
const cards = await page.locator(".home-card h2").allTextContents();
ok(cards.includes("Games"), `home page has a Games card (${cards.join(", ")})`);
ok((await page.locator(".home-card", { hasText: "Ziele" }).textContent()).includes("Vision") && !(await page.locator(".home-card", { hasText: "Ziele" }).textContent()).includes("Quest"), "the Ziele card no longer mentions the quest");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${n} assertions passed (couple quest move)`);
