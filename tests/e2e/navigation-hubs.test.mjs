import { chromium } from "playwright";
import assert from "node:assert/strict";

/* where things live: Couple Quest + Vision under Ziele, the questions under Games */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(page.url() + ": " + e.message));
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const base = "http://localhost:9091/";
const activeNav = () => page.locator(".nav-item.active").getAttribute("href");
const visible = selector => page.locator(selector).isVisible();

/* Ziele: Quest tab with the bingo board, Vision tab with the timeline */
await page.goto(base + "ziele.html"); await page.waitForTimeout(500);
const tabs = await page.locator(".hub-tab").allTextContents();
ok(JSON.stringify(tabs) === JSON.stringify(["🎯 Quest", "🔭 Vision"]), `Ziele has the Quest and Vision tabs (${tabs.join(", ")})`);
await page.click('.hub-tab[data-tab="quest"]');
ok(await page.locator("#board").count() === 1 && await visible("#openAddModal") && !(await visible("#openVisionModal")), "the Quest tab shows the bingo board with its own + button");
await page.click("#openAddModal"); await page.waitForTimeout(200);
ok(!(await page.locator("#addModal").evaluate(el => el.classList.contains("hidden"))), "adding a bingo field opens its form");
await page.click("#closeModal");
await page.click('.hub-tab[data-tab="vision"]');
ok(await visible("#visionTimeline") && await visible("#openVisionModal") && !(await visible("#openAddModal")), "the Vision tab shows the timeline with its own + button");
ok(await activeNav() === "ziele.html", "Ziele highlights Ziele in the nav");

/* old Couple Quest links land on the Quest tab */
await page.goto(base + "couple-quest.html"); await page.waitForTimeout(800);
ok(page.url().endsWith("ziele.html"), "couple-quest.html forwards to Ziele");
ok(await page.locator('.hub-tab.active').getAttribute("data-tab") === "quest", "and opens the Quest tab");
await page.goto(base + "ziele.html?tab=quest"); await page.waitForTimeout(400);
ok(page.url().includes("ziele.html") && await page.locator('.hub-tab.active').getAttribute("data-tab") === "quest", "push links to ziele.html?tab=quest open the Quest tab");

/* Games: the questions instead of the quest */
await page.goto(base + "games.html"); await page.waitForTimeout(400);
const tiles = await page.locator(".game-tile h2").allTextContents();
ok(JSON.stringify(tiles) === JSON.stringify(["Wir zwei", "Cabo", "6 nimmt!", "Qwixx", "Fragen"]), `Games lists the questions next to the games (${tiles.join(", ")})`);
await page.locator(".game-tile", { hasText: "Fragen" }).click(); await page.waitForTimeout(600);
ok(page.url().endsWith("questions.html") && (await page.locator("h1").textContent()).startsWith("Fragen"), "the tile opens the questions page");
ok(await page.locator(".category-btn").count() === 4 && await visible("#newQuestionBtn"), "the questions page has its four categories and the next button");
ok(await activeNav() === "games.html", "the questions page highlights Games in the nav");

/* Wir without questions; old links forward */
await page.goto(base + "wir.html"); await page.waitForTimeout(400);
const wirTabs = await page.locator(".hub-tab").allTextContents();
ok(JSON.stringify(wirTabs) === JSON.stringify(["🎬 Watchlist", "💌 Briefe", "🔥 Nur für uns"]), `Wir has Watchlist, Briefe and 'Nur für uns', no questions (${wirTabs.join(", ")})`);
await page.goto(base + "wir.html?tab=fragen"); await page.waitForTimeout(600);
ok(page.url().endsWith("questions.html"), "old links to wir.html?tab=fragen land on the questions page");

for (const game of ["cabo.html", "nimmt.html", "qwixx.html"]) {
  await page.goto(base + game); await page.waitForTimeout(300);
  ok(await activeNav() === "games.html", `${game} highlights Games in the nav`);
}

/* home page */
await page.goto(base + "index.html"); await page.waitForTimeout(500);
ok((await page.locator(".home-card", { hasText: "Ziele" }).textContent()).includes("Couple Quest"), "the Ziele card mentions the Couple Quest again");
ok((await page.locator(".home-card", { hasText: "Games" }).textContent()).includes("Fragen"), "the Games card mentions the questions");
ok(await page.locator("#dashQuestionText").count() === 0 && !(await page.locator("main").textContent()).includes("Frage für uns"), "the 'Frage für uns' card is gone from the start page");

/* every single game has a back arrow to the games overview */
for (const game of ["nimmt", "cabo", "qwixx", "questions"]) {
  await page.goto(`http://localhost:9091/${game}.html`);
  await page.waitForTimeout(400);
  const back = page.locator(".page-back");
  const box = await back.boundingBox();
  ok(await back.isVisible() && box.x < 40 && box.y < 80, `${game}: a back arrow sits in the top left corner`);
  /* the heading is a full-width block – measure the text itself */
  const title = await page.locator(".page-title").evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  ok(box.x + box.width <= title.x || box.y + box.height <= title.y, `${game}: the arrow does not cover the title`);
  await back.click();
  await page.waitForURL(/games\.html$/);
  ok(true, `${game}: the arrow leads back to the games`);
}

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${n} assertions passed (navigation: quest in Ziele, questions in Games)`);
