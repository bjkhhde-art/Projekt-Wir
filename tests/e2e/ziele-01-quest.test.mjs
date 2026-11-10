import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Couple Quest (ToDos): open quests first, adding, ticking off, finishing, resetting, editing and deleting */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rows = async () => (await (await fetch(`${API}/t/bingo_items/dump`)).json());
const byTitle = async title => (await rows()).find(r => r.title === title);

const quest = (id, title, extra = {}) => ({
  id, title, category: "Liebe ❤️", author: "Isi", due_date: null, target: 1, current: 0, done: false,
  created_at: `2026-01-0${id}T10:00:00Z`, ...extra
});
await post("/t/bingo_items/seed", { rows: [
  quest(1, "Sonnenaufgang anschauen", { done: true, current: 1 }),
  quest(2, "Zusammen kochen", { target: 3, current: 1, author: "Benji", due_date: "2026-12-24" }),
  quest(3, "Brief schreiben")
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));

const titles = () => page.locator("#board .cell:not(.empty) .cell-title").allTextContents();
const cell = title => page.locator("#board .cell", { has: page.locator(".cell-title", { hasText: title }) });
async function until(fn, ms = 3000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); }
  throw new Error("timed out waiting for " + what);
}

await page.goto("http://localhost:9091/ziele.html");
await page.waitForSelector("#board .cell-title");

/* ---------- the board ---------- */
ok(await page.locator("#board .cell").count() === 16, "the bingo board always has 16 fields");
ok(JSON.stringify(await titles()) === JSON.stringify(["Zusammen kochen", "Brief schreiben", "Sonnenaufgang anschauen"]), "open quests come first, finished ones last");
ok(await cell("Sonnenaufgang anschauen").evaluate(el => el.classList.contains("done")) && (await cell("Sonnenaufgang anschauen").textContent()).includes("Geschafft"), "a finished quest is marked as done");
const cooking = await cell("Zusammen kochen").textContent();
ok(cooking.includes("Von: Benji") && cooking.includes("24.12.2026") && cooking.includes("✅ ⬜ ⬜"), "a field shows who added it, when it is due and its progress");
ok(await page.locator("#board .cell.empty").count() === 13, "the free fields offer a +");

/* ---------- adding ---------- */
await page.locator("#board .cell.empty").first().click();
ok(await page.locator("#addModal").isVisible() && (await page.locator("#questModalTitle").textContent()) === "Neues Bingofeld", "tapping a free field opens the form for a new quest");
await page.click("#addBtn");
ok(await page.locator("#addModal").isVisible(), "a quest without a title is not saved");
await page.fill("#newItemInput", "Picknick im Park");
await page.selectOption("#targetInput", "2");
await page.click("#addBtn");
await until(async () => Boolean(await byTitle("Picknick im Park")), 3000, "the new quest");
const picnic = await byTitle("Picknick im Park");
ok(picnic.target === 2 && picnic.current === 0 && picnic.done === false && picnic.author === "Isi", "the new quest is saved with its goal and nothing done yet");
await page.waitForSelector("text=Picknick im Park");
ok((await titles()).includes("Picknick im Park"), "and appears on the board");
const notices = await page.evaluate(() => window.__mockInvocations || []);
ok(notices.some(i => i.body.category === "quest" && i.body.excludePerson === "Isi"), "Benji gets a notification about the new quest");

/* ---------- ticking off ---------- */
await cell("Brief schreiben").locator(".cell-title").click();
await until(async () => (await byTitle("Brief schreiben")).done === true, 3000, "finishing a one-step quest");
await page.waitForTimeout(300);
ok(JSON.stringify(await titles()) === JSON.stringify(["Zusammen kochen", "Picknick im Park", "Sonnenaufgang anschauen", "Brief schreiben"]), "a finished quest moves behind the open ones");
await cell("Zusammen kochen").locator(".cell-title").click();
await until(async () => (await byTitle("Zusammen kochen")).current === 2, 3000, "one more step");
ok((await byTitle("Zusammen kochen")).done === false, "a quest with three steps is not done after two");

/* tapping a finished quest asks before starting over */
await cell("Sonnenaufgang anschauen").locator(".cell-title").click();
await page.waitForSelector(".confirm-box");
await page.click(".confirm-no");
await page.waitForTimeout(300);
ok((await byTitle("Sonnenaufgang anschauen")).current === 1, "cancelling keeps a finished quest finished");
await cell("Sonnenaufgang anschauen").locator(".cell-title").click();
await page.click(".confirm-yes");
await until(async () => (await byTitle("Sonnenaufgang anschauen")).current === 0, 3000, "reset");
ok((await byTitle("Sonnenaufgang anschauen")).done === false, "confirming starts it over at 0");

/* ---------- editing ---------- */
await cell("Picknick im Park").locator(".cell-edit-btn").click();
ok((await page.locator("#questModalTitle").textContent()) === "Feld bearbeiten" && (await page.inputValue("#newItemInput")) === "Picknick im Park", "✏️ opens the quest with its values");
await page.fill("#newItemInput", "Picknick an der Alster");
await page.selectOption("#targetInput", "1");
await page.click("#addBtn");
await until(async () => Boolean(await byTitle("Picknick an der Alster")), 3000, "the edit");
ok((await rows()).length === 4 && (await byTitle("Picknick an der Alster")).target === 1, "editing changes the quest instead of adding a new one");

/* ---------- deleting ---------- */
await page.click("#openDeleteMode");
ok(await page.locator("#deleteBar").isVisible() && await page.locator("#board .cell-edit-btn").count() === 0, "delete mode shows the delete bar and hides the edit buttons");
await cell("Picknick an der Alster").click();
await cell("Brief schreiben").click();
ok(await page.locator("#board .cell.selected-delete").count() === 2, "tapping fields selects them");
await page.click("#confirmDelete");
await page.click(".confirm-yes");
await until(async () => (await rows()).length === 2, 3000, "deleting");
ok(!(await byTitle("Brief schreiben")) && !(await byTitle("Picknick an der Alster")) && Boolean(await byTitle("Zusammen kochen")), "exactly the selected quests are deleted");
await page.waitForTimeout(300);
ok(await page.locator("#deleteBar").isHidden(), "and delete mode ends");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/bingo_items/reset", {});
console.log(`\n${n} assertions passed (Couple Quest)`);
