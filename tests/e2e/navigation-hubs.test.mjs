import { chromium } from "playwright";
import assert from "node:assert/strict";

/* where things live: Home · KPIs · Wir · ToDos · Reisen · Spiele (the hand-drawn plan) */
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
ok(JSON.stringify(tabs) === JSON.stringify(["🎯 Quest", "🔭 Vision"]), `ToDos has the Quest and Vision tabs (${tabs.join(", ")})`);
ok((await page.locator("h1").textContent()).startsWith("ToDos"), "the page is called ToDos");
await page.click('.hub-tab[data-tab="quest"]');
ok(await page.locator("#board").count() === 1 && await visible("#openAddModal") && !(await visible("#openVisionModal")), "the Quest tab shows the bingo board with its own + button");
await page.click("#openAddModal"); await page.waitForTimeout(200);
ok(!(await page.locator("#addModal").evaluate(el => el.classList.contains("hidden"))), "adding a bingo field opens its form");
await page.click("#closeModal");
await page.click('.hub-tab[data-tab="vision"]');
ok(await visible("#visionTimeline") && await visible("#openVisionModal") && !(await visible("#openAddModal")), "the Vision tab shows the timeline with its own + button");
ok(await activeNav() === "ziele.html", "ToDos lights up ToDos in the nav");

/* old Couple Quest links land on the Quest tab */
await page.goto(base + "couple-quest.html"); await page.waitForTimeout(800);
ok(page.url().endsWith("ziele.html?tab=quest"), "the old couple-quest.html address forwards to ToDos");
ok(await page.locator('.hub-tab.active').getAttribute("data-tab") === "quest", "and opens the Quest tab");
await page.goto(base + "erinnerungen.html"); await page.waitForTimeout(800);
ok(page.url().endsWith("reise.html?tab=erinnerungen"), "old addresses land on the right tab");
await page.goto(base + "gibt-es-nicht.html"); await page.waitForTimeout(500);
ok((await page.locator("h1").textContent()).includes("Diese Seite gibt es nicht") && await page.locator('a[href="index.html"]').count() === 1, "unknown addresses show a friendly page with a way home");
await page.goto(base + "ziele.html?tab=quest"); await page.waitForTimeout(400);
ok(page.url().includes("ziele.html") && await page.locator('.hub-tab.active').getAttribute("data-tab") === "quest", "push links to ziele.html?tab=quest open the Quest tab");

/* Spiele: the questions next to the games; Chat-Wrapped moved to the KPIs */
await page.goto(base + "games.html"); await page.waitForTimeout(400);
const tiles = await page.locator(".game-tile h2").allTextContents();
ok(JSON.stringify(tiles) === JSON.stringify(["Wir zwei", "Cabo", "6 nimmt!", "Qwixx", "Flip 7", "Monopoly", "Geo-Guesser", "Fragen"]), `Spiele lists the questions next to the games (${tiles.join(", ")})`);
await page.locator(".game-tile", { hasText: "Fragen" }).click(); await page.waitForTimeout(600);
ok(page.url().endsWith("questions.html") && (await page.locator("h1").textContent()).startsWith("Fragen"), "the tile opens the questions page");
ok(await page.locator(".category-btn").count() === 4 && await visible("#newQuestionBtn"), "the questions page has its four categories and the next button");
ok(await activeNav() === "games.html", "the questions page highlights Spiele in the nav");

/* Wir: Kuschelakku, Watchlist, Briefe (+ Nur für uns); old links forward */
await page.goto(base + "wir.html"); await page.waitForTimeout(400);
const wirTabs = await page.locator(".hub-tab").allTextContents();
ok(JSON.stringify(wirTabs) === JSON.stringify(["🔋 Akku", "🎬 Watchlist", "💌 Briefe", "🔥 Nur für uns"]), `Wir has Kuschelakku, Watchlist, Briefe and 'Nur für uns' (${wirTabs.join(", ")})`);
ok(await page.locator(".hub-tab.active").getAttribute("data-tab") === "watchlist", "Wir opens on the Watchlist, the Akku tab is a link");
await page.setViewportSize({ width: 360, height: 740 });
ok(await page.locator(".hub-tabs").evaluate(el => [...el.children].every(tab => tab.scrollWidth <= tab.clientWidth + 1) && el.scrollWidth <= el.clientWidth + 1), "the four Wir tabs fit on a 360 px phone");
await page.setViewportSize({ width: 390, height: 844 });
await page.click('.hub-tab[href="batterien.html"]');
await page.waitForURL(/batterien\.html$/); await page.waitForTimeout(400);
ok(await page.locator(".hub-tab.active").textContent() === "🔋 Akku" && await activeNav() === "wir.html" && await page.locator(".battery-shell").count() === 2, "the Akku tab opens the batteries, Wir stays lit in the bar");
await page.click('.hub-tab[href="wir.html?tab=briefe"]');
await page.waitForURL(/wir\.html\?tab=briefe$/); await page.waitForTimeout(400);
ok(await page.locator(".hub-tab.active").getAttribute("data-tab") === "briefe", "from the batteries the Briefe tab leads back into Wir");
await page.goto(base + "wir.html?tab=fragen"); await page.waitForTimeout(600);
ok(page.url().endsWith("questions.html"), "old links to wir.html?tab=fragen land on the questions page");

/* six places in the bar; Mochi is reached from its tile on Home */
await page.setViewportSize({ width: 384, height: 740 });
await page.goto(base + "mochi.html"); await page.waitForTimeout(500);
const navLabels = await page.locator(".nav-item .nav-label").allTextContents();
ok(JSON.stringify(navLabels) === JSON.stringify(["Home", "KPIs", "Wir", "ToDos", "Reisen", "Spiele"]), `the bar has six places (${navLabels.join(", ")})`);
ok(await page.locator(".app-nav, nav.app-nav").first().evaluate(el => el.scrollWidth <= el.clientWidth + 1), "on a 384 px phone (S25 FE) nothing scrolls sideways in the bar");
ok(await activeNav() === "index.html" && await page.locator('.page-back[href="index.html"]').isVisible(), "Mochi belongs to Home and has a back arrow there");
await page.setViewportSize({ width: 390, height: 844 });

/* KPIs: the numbers, WhatsApp Wrapped and the countdowns */
await page.goto(base + "kpis.html"); await page.waitForTimeout(700);
const kpiHeadings = await page.locator(".kpi-card h2").allTextContents();
ok(JSON.stringify(kpiHeadings.slice(0, 2)) === JSON.stringify(["Tage zusammen", "Nächster Jahrestag"]) && kpiHeadings.includes("Erstes Treffen"), `KPIs start with Tage zusammen and the next anniversary (${kpiHeadings.join(", ")})`);
ok(await page.locator("#kpiCountdowns .kpi-countdown-row").count() >= 1, "KPIs count down to what comes next");
await page.click("#kpiWrapped");
await page.waitForURL(/chat\.html$/); await page.waitForTimeout(400);
ok(await activeNav() === "kpis.html" && await page.locator('.page-back[href="kpis.html"]').count() === 1, "WhatsApp Wrapped opens from the KPIs and belongs to them");

/* Reisen: Karte, Kommt noch, Vergangen (+ Vergleich) */
await page.goto(base + "reise.html"); await page.waitForTimeout(500);
ok(JSON.stringify(await page.locator(".hub-tab").allTextContents()) === JSON.stringify(["🗺️ Karte", "✈️ Kommt noch", "📸 Vergangen", "🌍 Vergleich"]), "Reisen has Karte, Kommt noch, Vergangen and Vergleich");
await page.setViewportSize({ width: 360, height: 740 });
ok(await page.locator(".hub-tabs").evaluate(el => [...el.children].every(tab => tab.scrollWidth <= tab.clientWidth + 1) && el.scrollWidth <= el.clientWidth + 1), "the four Reisen tabs fit on a 360 px phone");
await page.setViewportSize({ width: 390, height: 844 });

for (const game of ["cabo.html", "nimmt.html", "qwixx.html", "flip7.html", "monopoly.html", "geo.html"]) {
  await page.goto(base + game); await page.waitForTimeout(300);
  ok(await activeNav() === "games.html", `${game} highlights Games in the nav`);
}

/* home page */
await page.goto(base + "index.html"); await page.waitForTimeout(500);
ok((await page.locator(".home-card", { hasText: "ToDos" }).textContent()).includes("Couple Quest"), "the ToDos card mentions the Couple Quest");
ok((await page.locator(".home-card", { hasText: "Spiele" }).textContent()).includes("Fragen"), "the Spiele card mentions the questions");
ok(await page.locator("#dashQuestionText").count() === 0 && !(await page.locator("main").textContent()).includes("Frage für uns"), "the 'Frage für uns' card is gone from the start page");

/* every single game has a back arrow to the games overview */
for (const game of ["nimmt", "cabo", "qwixx", "flip7", "monopoly", "geo", "questions"]) {
  /* the lobby page with its title – a round left over from another test (Flip 7 with three hides the title) is cleared */
  if (game !== "questions") await fetch(`http://localhost:8991/t/${game}_games/reset`, { method: "POST" });
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
console.log(`\n${n} assertions passed (navigation: Home, KPIs, Wir, ToDos, Reisen, Spiele)`);
