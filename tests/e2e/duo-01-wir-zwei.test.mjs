import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../../duo-daily.js");
const C = require("../../duo-content.js");

/* "Wir zwei": question of the day with the flame, start page tile, who-of-us and hot-or-not */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const answers = async () => (await (await fetch(`${API}/t/daily_answers/dump`)).json());
const latest = async () => (await fetch(`${API}/t/duo_games/latest`)).json();

const today = D.dayKey();
const question = D.questionFor(today, C.DAILY);
const row = (id, day, person) => ({ id, day, person, question_id: "d01", answer: 0, guess: 1, created_at: `${day}T10:00:00Z` });
await post("/t/daily_answers/seed", { rows: [
  row(1, D.shiftDay(today, -2), "Isi"), row(2, D.shiftDay(today, -2), "Benji"),
  row(3, D.shiftDay(today, -1), "Isi"), row(4, D.shiftDay(today, -1), "Benji")
] });
await fetch(`${API}/t/duo_games/reset`, { method: "POST" });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function phone(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), name);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  return page;
}
const isi = await phone("Isi");
const benji = await phone("Benji");

/* the start page shows the question of the day */
await benji.goto("http://localhost:9091/index.html");
await benji.waitForTimeout(900);
ok((await benji.locator("#dashDailyQuestion").textContent()) === question.text, "the start page shows today's question");
ok((await benji.locator("#dashDailyStreak").textContent()).includes("2"), "with our flame: 2 days");
ok((await benji.locator("#dashDailyStatus").textContent()).includes("damit eure Flamme weiterbrennt"), "and asks us both to answer");
ok(await benji.locator("#dashDailyTile").getAttribute("href") === "duo.html?mode=daily", "the tile leads to the question of the day");

/* the games page has the new tile */
await isi.goto("http://localhost:9091/games.html");
ok(await isi.locator('a[href="duo.html"]', { hasText: "Wir zwei" }).count() === 1, "'Wir zwei' is on the games page");

/* the question of the day is answered together, in a lobby */
await isi.goto("http://localhost:9091/duo.html?mode=daily");
await isi.waitForSelector("#duoDailyStart");
ok((await isi.locator(".duo-streak-number").textContent()) === "2" && (await isi.locator(".duo-headline").textContent()).includes("braucht euch heute"), "the flame shows 2 and needs us today");
ok(await isi.locator(".duo-flame.done").count() === 2 && await isi.locator(".duo-flame").count() === 7, "seven flames, two lit");
ok(await isi.locator("#duoCountdown span").count() === 3, "the time left today counts down");
ok(!(await isi.locator("#duoDaily").textContent()).includes(question.text), "the question stays hidden until both are there");
ok(await isi.locator('.gr-option[data-option="daily"]').evaluate(el => el.classList.contains("selected")), "coming from 'Frage des Tages' preselects it in the lobby");
await isi.click("#duoDailyStart");
await wait(800);
ok((await latest()).status === "waiting" && (await latest()).state.option === "daily", "Isi opens a lobby for the question of the day");
ok(await isi.evaluate(() => (window.__mockInvocations || []).some(i => i.body && i.body.url === "duo.html" && i.body.excludePerson === "Isi")), "Benji gets an invitation");

await benji.reload();
await benji.waitForTimeout(1000);
ok((await benji.locator("#dashDailyStatus").textContent()).includes("Isi wartet in der Lobby auf dich"), "Benji's start page says Isi is waiting in the lobby");
ok((await benji.locator("#dashDailyCta").textContent()).includes("Beitreten"), "with a button to join");
if (await benji.locator("#pushModal").isVisible()) await benji.click("#dismissPushModal");
await benji.click("#dashDailyTile");
await benji.waitForSelector("#grJoinBtn");
await benji.click("#grJoinBtn");
await wait(1000);
ok((await isi.locator(".duo-card-text").textContent()) === question.text && (await benji.locator(".duo-card-text").textContent()) === question.text, "now both see today's question at the same time");
await isi.locator(".duo-option").nth(1).click();
ok((await isi.locator(".duo-q-step").textContent()).includes("Was antwortet Benji"), "after her own answer Isi guesses Benji's");
await isi.locator(".duo-option").nth(2).click();
await wait(900);
ok((await isi.locator(".duo-waiting").textContent()).includes("Warte auf Benji"), "Isi waits for Benji");
ok((await benji.locator(".duo-daily-game").textContent()).includes("Isi ist schon fertig"), "Benji sees that Isi is done");
await benji.locator(".duo-option").nth(2).click();
await benji.locator(".duo-option").nth(1).click();
await wait(1200);
ok(await benji.locator(".duo-daily-game .duo-reveal").count() === 1 && await isi.locator(".duo-daily-game .duo-reveal").count() === 1, "with both answers they are revealed together");
ok((await benji.locator(".duo-daily-game .duo-reveal-guess.hit").count()) === 2, "both guessed right");
await wait(800);
const rows = (await answers()).filter(r => r.day === today);
ok(rows.length === 2 && rows.find(r => r.person === "Isi").answer === 1 && rows.find(r => r.person === "Benji").guess === 1 && rows.every(r => r.question_id === question.id), "both answers are stored for the flame");
ok((await benji.locator(".duo-streak-number").textContent()) === "3" && await benji.locator("#duoCountdown").count() === 0, "the flame grows to 3, no countdown needed");
ok((await isi.locator("#duoDaily .duo-reveal").count()) === 1, "the card at the top now shows today's result");
ok((await isi.locator("#duoLeaveBtn").textContent()).includes("Zurück"), "afterwards the round is simply closed");
await isi.locator("#duoLeaveBtn").click();
await wait(900);

/* Hot oder Not */
await isi.locator('.gr-option[data-option="hotnot"]').click();
await isi.click("#grStartBtn");
await benji.waitForSelector("#grJoinBtn", { timeout: 4000 });
await benji.click("#grJoinBtn");
await wait(900);
ok(await isi.locator(".duo-card").isVisible() && await benji.locator(".duo-choice.hot").count() === 1, "Benji joining starts the round right away – only for us two");
ok(await isi.locator("#grInviteLink").count() === 0, "no invite link for friends here");
for (let i = 0; i < 6; i++) await isi.locator(".duo-choice.hot").click();
await wait(700);
ok((await isi.locator(".duo-waiting").textContent()).includes("Warte auf Benji"), "Isi is done and waits");
const pattern = ["hot", "not", "hot", "not", "hot", "hot"];
for (let i = 0; i < 6; i++) {
  if (i === 1) await benji.locator("#duoBack").count().then(c => ok(c === 1, "Benji can go back a question"));
  await benji.locator(`.duo-choice.${pattern[i]}`).click();
}
await wait(1000);
ok((await isi.locator(".duo-score-number").textContent()).startsWith("4"), "4 of 6 alike");
ok(await isi.locator(".duo-result.match").count() === 4 && await isi.locator(".duo-result.differ").count() === 2, "each item shows both votes");
await isi.locator(".gr-ready-btn").click();
await wait(700);
ok((await latest()).state.round === 1, "the next round waits for both");
await benji.locator(".gr-ready-btn").click();
await wait(1000);
ok((await latest()).state.round === 2 && await isi.locator(".duo-card-count").count() === 1, "then round 2 begins");

/* Wer von uns beiden? */
await isi.locator("#duoLeaveBtn").click();
await isi.locator("#duoLeaveBtn").click();
await wait(800);
await isi.locator('.gr-option[data-option="who"]').click();
await isi.click("#grStartBtn");
await benji.waitForSelector("#grJoinBtn", { timeout: 4000 });
await benji.click("#grJoinBtn");
await wait(900);
ok((await isi.locator(".duo-card-text").textContent()).startsWith("Wer von uns beiden"), "'Wer von uns beiden?' asks about us");
ok((await isi.locator(".duo-choice").allTextContents()).join() === "Isi,Benji", "the answers are our names");
for (let i = 0; i < 6; i++) await isi.locator(".duo-choice.isi").click();
for (let i = 0; i < 6; i++) await benji.locator(".duo-choice.benji").click();
await wait(1000);
ok((await benji.locator(".duo-score-number").textContent()).startsWith("0") && (await benji.locator(".duo-score-verdict").textContent()).includes("Gegensätze"), "0 of 6 – opposites attract");
ok((await benji.locator(".duo-chip").first().textContent()) === "Du: Benji", "the result shows the names chosen");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Wir zwei: daily question, who-of-us, hot-or-not)`);
