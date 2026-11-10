import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Couple Quest, found in the test report: who it is from, double taps, the 16-field limit with two phones,
   ticking on both phones at once, quests without a goal and overdue quests */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rows = async () => (await (await fetch(`${API}/t/bingo_items/dump`)).json());
const byTitle = async title => (await rows()).find(r => r.title === title);
const quest = (id, title, extra = {}) => ({
  id, title, category: "Liebe ❤️", author: "Isi", due_date: null, target: 1, current: 0, done: false,
  created_at: `2026-01-${String(id).padStart(2, "0")}T10:00:00Z`, ...extra
});

await post("/t/bingo_items/seed", { rows: [
  quest(1, "Zusammen kochen", { target: 3, current: 1 }),
  quest(2, "Ohne Ziel", { target: 0 }),
  quest(3, "Steuererklärung", { due_date: "2020-01-01" })
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const cell = title => page.locator("#board .cell", { has: page.locator(".cell-title", { hasText: title }) });
async function until(fn, ms = 3000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); }
  throw new Error("timed out waiting for " + what);
}

await page.goto("http://localhost:9091/ziele.html");
await page.waitForSelector("#board .cell-title");

/* ---------- overdue ---------- */
ok(await cell("Steuererklärung").evaluate(el => el.classList.contains("overdue")) && (await cell("Steuererklärung").textContent()).includes("Überfällig"), "an open quest past its day is marked as overdue");
ok(!(await cell("Zusammen kochen").evaluate(el => el.classList.contains("overdue"))), "a quest without a date is not");

/* ---------- from whom ---------- */
await page.locator("#board .cell.empty").first().click();
ok(await page.inputValue("#authorInput") === "Benji", "on Benji's phone a new quest is from Benji");
ok(!(await page.locator("#targetInput option").allTextContents()).includes("0"), "a goal of 0 (never finishable) is no longer offered");

/* ---------- a double tap adds it once ---------- */
await page.fill("#newItemInput", "Doppelt getippt");
await page.evaluate(() => { const b = document.getElementById("addBtn"); b.click(); b.click(); });
await until(async () => Boolean(await byTitle("Doppelt getippt")), 3000, "the new quest");
await page.waitForTimeout(600);
ok((await rows()).filter(r => r.title === "Doppelt getippt").length === 1, "a double tap on 'Hinzufügen' saves the quest only once");
ok((await byTitle("Doppelt getippt")).author === "Benji", "and it is saved as Benji's");
await until(async () => (await page.evaluate(() => window.__mockInvocations || [])).some(i => i.body.category === "quest"), 3000, "the notification");
const notice = (await page.evaluate(() => window.__mockInvocations)).find(i => i.body.category === "quest");
ok(notice.body.excludePerson === "Benji" && notice.body.body.startsWith("Benji"), "Isi gets the notification, not Benji himself");

/* ---------- ticking on two phones at once ---------- */
/* the other phone ticked a moment ago (1 → 2); this phone still shows 1 */
await post("/t/bingo_items/update", { filters: [["eq", "id", 1]], payload: { current: 2 } });
await cell("Zusammen kochen").locator(".cell-title").click();
await until(async () => (await byTitle("Zusammen kochen")).current === 3, 3000, "both ticks");
ok((await byTitle("Zusammen kochen")).done === true, "both ticks count: 2 from the other phone + this one = 3 of 3, done");

/* ---------- a quest without a goal ---------- */
await cell("Ohne Ziel").locator(".cell-title").click();
ok(await page.locator("#addModal").isVisible() && await page.inputValue("#targetInput") === "1", "tapping a quest without a goal opens it to choose one (1 suggested)");
await page.click("#closeModal");

/* ---------- the 16-field limit with two phones ---------- */
const now = await rows();
const more = Array.from({ length: 16 - now.length }, (_, i) => quest(20 + i, `Feld ${i + 1}`));
/* this phone still shows the old board; the other phone filled it up meanwhile */
await page.locator("#board .cell.empty").first().click();
await page.fill("#newItemInput", "Eins zu viel");
await post("/t/bingo_items/seed", { rows: [...now, ...more] });
await page.click("#addBtn");
await page.waitForTimeout(800);
ok(!(await byTitle("Eins zu viel")) && (await rows()).length === 16, "the limit is checked against the database, not the old board");
ok((await page.locator(".toast").last().textContent()).includes("voll"), "and it says the bingo is full");

/* if both phones still squeezed in a 17th field, it shows (and can be deleted) instead of vanishing */
await post("/t/bingo_items/seed", { rows: [...(await rows()), quest(40, "Siebzehntes")] });
await page.reload();
await page.waitForSelector("#board .cell-title");
ok(await page.locator("#board .cell:not(.empty)").count() === 17 && (await cell("Siebzehntes").count()) === 1, "a 17th field is shown, not hidden");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/bingo_items/reset", {});
console.log(`\n${n} assertions passed (Couple Quest: sender, limits, ticks)`);
