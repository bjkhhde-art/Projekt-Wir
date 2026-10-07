import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Conversation questions: groups with more than 1000 questions load completely (page by page),
   and questions do not repeat until all of a group were shown */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const RELATIONSHIP = ["Beziehung", "Kommunikation", "Konflikte", "Intimität", "Träume & Ziele", "Zukunft", "Familie", "Finanzen"];
const rows = [];
let id = 1;
RELATIONSHIP.forEach(category => {
  for (let i = 0; i < 300; i++) rows.push({ id: id++, category, question: `${category} Frage ${i + 1}?`, active: true });
});
for (let i = 0; i < 5; i++) rows.push({ id: id++, category: "Eisbrecher", question: `Eisbrecher ${i + 1}?`, active: true });
rows.push({ id: id++, category: "Eisbrecher", question: "Abgeschaltet?", active: false });
await post("/t/questions/seed", { rows });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/questions.html?mode=talk");
await page.waitForTimeout(800);

ok((await page.locator("#questionCounter").textContent()).startsWith("5 Fragen"), "inactive questions are left out");
await page.click('.category-btn[data-group="relationship"]');
await page.waitForFunction(() => /Fragen in dieser Kategorie/.test(document.getElementById("questionCounter").textContent), null, { timeout: 5000 });
ok((await page.locator("#questionCounter").textContent()).startsWith("2400 Fragen"), "all 2400 questions of the group arrive, not just the first 1000");
const shown = new Set([await page.locator("#questionText").textContent()]);
for (let i = 0; i < 40; i++) {
  await page.click("#newQuestionBtn");
  shown.add(await page.locator("#questionText").textContent());
}
ok(shown.size === 41, "41 questions in a row, no repeat");
const late = [...shown].some(q => RELATIONSHIP.slice(4).some(c => q.startsWith(c)));
ok(late, "questions from beyond the first 1000 come up too");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (conversation questions: large groups)`);
