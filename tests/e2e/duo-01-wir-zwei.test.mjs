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
/* what the flame should show: the carried-over LovBirdz days plus the seeded ones */
const seeded = [D.shiftDay(today, -2), D.shiftDay(today, -1)].flatMap(day => [{ day, person: "Isi" }, { day, person: "Benji" }]);
const before = D.streakInfo([...D.historyRows(), ...seeded], today, D.HISTORY);
const after = D.streakInfo([...D.historyRows(), ...seeded, { day: today, person: "Isi" }, { day: today, person: "Benji" }], today, D.HISTORY);

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
ok((await benji.locator("#dashDailyState").textContent()).includes("Heute noch offen"), "the start page says today is still open");
ok(!(await benji.locator("#dashDailyTile").textContent()).includes(question.text), "without giving the question away");
ok((await benji.locator("#dashDailyStreak").textContent()) === `🔥 ${before.current}`, `with our flame: ${before.current} days`);
ok((await benji.locator("#dashDailyStatus").textContent()).includes(`Rekord: ${before.record} Tage`) && before.record >= 19, "and our record (at least the 19 days from LovBirdz)");
ok(await benji.locator("#dashDailyTile").getAttribute("href") === "duo.html?mode=daily", "the tile leads to the question of the day");

/* the games page has the tile – it leads to the colourful list of modes */
await isi.goto("http://localhost:9091/games.html");
ok(await isi.locator('a[href="questions.html?mode=other"]', { hasText: "Wir zwei" }).count() === 1, "'Wir zwei' on the games page leads to the list of modes");

/* the question of the day is answered together, in a lobby – tapping the card opens it right away */
await isi.goto("http://localhost:9091/questions.html?mode=other");
await isi.click(".other-daily");
await isi.waitForURL(/duo\.html\?mode=daily/);
await isi.waitForSelector(".duo-streak-number");
await wait(900);
ok((await isi.locator(".duo-streak-number").textContent()) === String(before.current) && (await isi.locator(".duo-headline").textContent()).includes("braucht euch heute"), `the flame shows ${before.current} and needs us today`);
ok((await isi.locator(".duo-record").textContent()).includes(`${before.record} Tage`), "the record is shown");
ok(await isi.locator(".duo-flame.done").count() === before.lastSeven.filter(d => d.status === "done").length && await isi.locator(".duo-flame").count() === 7, "seven flames, the done days lit");
ok(await isi.locator("#duoCountdown span").count() === 3, "the time left today counts down");
ok(!(await isi.locator("#duoDaily").textContent()).includes(question.text), "the question stays hidden until both are there");
ok(await isi.locator(".gr-option").count() === 0 && (await isi.locator("#duoTitle").textContent()).includes("Frage des Tages"), "no second menu – the page is just the question of the day");
ok((await latest()).status === "waiting" && (await latest()).state.option === "daily", "the card opened a lobby for the question of the day by itself");
ok(await isi.locator(".gr-lobby-waiting").isVisible(), "Isi waits for Benji");
ok(await isi.evaluate(() => (window.__mockInvocations || []).some(i => i.body && i.body.url === "duo.html?mode=daily" && i.body.excludePerson === "Isi")), "Benji gets an invitation straight to the question of the day");

await benji.reload();
await benji.waitForTimeout(1000);
ok((await benji.locator("#dashDailyStatus").textContent()).includes("Isi wartet in der Lobby auf dich"), "Benji's start page says Isi is waiting in the lobby");
ok((await benji.locator("#dashDailyCta").textContent()).includes("Beitreten"), "with a button to join");
if (await benji.locator("#pushModal").isVisible()) await benji.click("#dismissPushModal");
await benji.click("#dashDailyTile");
await benji.waitForSelector(".qz-text", { timeout: 5000 });
await wait(600);
ok(true, "tapping the tile puts Benji straight into Isi's lobby");
ok(await isi.evaluate(() => {
  const r = document.getElementById("duoBoard").getBoundingClientRect();
  return r.top === 0 && r.left === 0 && r.width === innerWidth && r.height === innerHeight;
}), "the round fills the whole screen");
ok((await isi.locator(".qz-text").textContent()) === question.text && (await benji.locator(".qz-text").textContent()) === question.text, "now both see today's question at the same time");
ok(await isi.locator(".qz-answers .qz-option").count() === 4, "four possible answers below the question");
ok(await isi.locator("#duoConfirm").isDisabled(), "confirming needs a choice");
await isi.locator(".qz-answers .qz-option").nth(1).click();
ok(await isi.locator(".qz-option.selected").count() === 1 && await isi.locator("#duoConfirm").isEnabled(), "tapping an answer selects it");
await isi.click("#duoConfirm");
ok((await isi.locator(".qz-lead").textContent()).includes("Was antwortet Benji") && (await isi.locator(".qz-head").textContent()).includes("Raten"), "after her own answer Isi guesses Benji's");
await isi.locator(".qz-answers .qz-option").nth(2).click();
await isi.click("#duoConfirm");
await wait(900);
ok((await isi.locator(".qz-center").textContent()).includes("Warte auf Benji"), "Isi waits for Benji");
ok((await benji.locator(".qz-note").textContent()).includes("Isi ist schon fertig"), "Benji sees that Isi is done");
await benji.locator(".qz-answers .qz-option").nth(2).click();
await benji.click("#duoConfirm");
await benji.locator(".qz-answers .qz-option").nth(1).click();
await benji.click("#duoConfirm");
await wait(1200);
ok(await benji.locator("#duoDailyResult").count() === 1 && await isi.locator("#duoDailyResult").count() === 1, "with both answers they are revealed together");
ok((await benji.locator(".qz-pair-tip.hit").count()) === 2 && (await benji.locator("#duoDailyResult").textContent()).includes("Ihr kennt euch"), "both guessed right");
await wait(800);
const rows = (await answers()).filter(r => r.day === today);
ok(rows.length === 2 && rows.find(r => r.person === "Isi").answer === 1 && rows.find(r => r.person === "Benji").guess === 1 && rows.every(r => r.question_id === question.id), "both answers are stored for the flame");
ok((await benji.locator(".duo-streak-number").textContent()) === String(after.current) && after.current === before.current + 1 && await benji.locator("#duoCountdown").count() === 0, `the flame grows to ${after.current}, no countdown needed`);
ok((await isi.locator("#duoDaily .duo-reveal").count()) === 1, "the card at the top now shows today's result");
ok((await isi.locator("#duoLeaveBtn").textContent()).includes("Zurück"), "afterwards the round is simply closed");
await isi.click("#duoDone");
await wait(900);
ok(await isi.locator("#duoBoard").isHidden() && await isi.locator("#duoLobby").isHidden() && (await isi.locator("#duoDaily .duo-reveal").count()) === 1, "'Fertig' closes it – today is done, no new lobby, just today's result");
await isi.goto("http://localhost:9091/duo.html?mode=daily");
await wait(1200);
ok((await latest()).status === "closed", "opening it again today does not start another round");

/* Hot oder Not: Isi taps the card, Benji opens the same mode and is in */
await isi.goto("http://localhost:9091/questions.html?mode=other");
await isi.click(".other-hotnot");
await isi.waitForURL(/duo\.html\?mode=hotnot/);
await wait(1000);
ok((await latest()).status === "waiting" && (await latest()).state.option === "hotnot", "the Hot-oder-Not card opens its lobby directly");
ok(await isi.locator("#daily").isHidden() && (await isi.locator("#duoTitle").textContent()).includes("Hot oder Not"), "the page is only about Hot oder Not");
await benji.goto("http://localhost:9091/duo.html?mode=hotnot");
await benji.waitForSelector(".qz-option.hot", { timeout: 5000 });
await wait(600);
ok(await isi.locator(".qz-card").isVisible() && await benji.locator(".qz-option.hot").count() === 1, "Benji opening the same mode joins and starts the round right away – only for us two");
ok(await isi.locator("#grInviteLink").count() === 0, "no invite link for friends here");
ok((await isi.locator(".qz-or").textContent()) === "ODER", "two answers with 'ODER' between them");
for (let i = 0; i < 6; i++) {
  await isi.locator(".qz-option.hot").click();
  await isi.click("#duoConfirm");
}
await wait(700);
ok((await isi.locator(".qz-center").textContent()).includes("Warte auf Benji"), "Isi is done and waits");
const pattern = ["hot", "not", "hot", "not", "hot", "hot"];
for (let i = 0; i < 6; i++) {
  if (i === 1) await benji.locator("#duoBack").count().then(c => ok(c === 1, "Benji can go back a question"));
  await benji.locator(`.qz-option.${pattern[i]}`).click();
  await benji.click("#duoConfirm");
}
await wait(1000);
/* the reveal, item by item */
ok((await isi.locator(".qz-head").textContent()).includes("Aufklärung 1/6") && (await isi.locator(".qz-result").textContent()).includes("Einig"), "the reveal goes through the six one by one");
for (let i = 0; i < 6; i++) await isi.click("#duoConfirm");
for (let i = 0; i < 6; i++) await benji.click("#duoConfirm");
ok((await isi.locator("#duoMatches").textContent()) === "4 von 6", "then the summary: 4 of 6 alike");
ok(await isi.locator(".qz-item.hit").count() === 4 && await isi.locator(".qz-item.miss").count() === 2, "each item shows both votes");
await isi.locator(".gr-ready-btn").click();
await wait(700);
ok((await latest()).state.round === 1, "the next round waits for both");
await benji.locator(".gr-ready-btn").click();
await wait(1000);
ok((await latest()).state.round === 2 && (await isi.locator(".qz-lead").textContent()).includes("Frage 1 von 6"), "then round 2 begins");

/* "‹" goes back to the list of modes, the round keeps running */
await isi.click("#duoBackBtn");
await isi.waitForURL(/questions\.html\?mode=other/);
ok((await latest()).status === "active", "the back arrow leaves the round running");
await isi.goto("http://localhost:9091/duo.html?mode=hotnot");
await isi.waitForSelector(".qz-option.hot", { timeout: 4000 });
ok(true, "opening the mode again continues the round");

/* Wer von uns beiden? */
await isi.locator("#duoLeaveBtn").click();
await isi.locator("#duoLeaveBtn").click();
await wait(800);
ok(await isi.locator(".gr-option").count() === 0 && (await isi.locator("#grStartBtn").count()) === 1, "after the game: just 'Neue Runde starten', no menu");
await isi.click("#grStartBtn");
await wait(800);
ok((await latest()).status === "waiting" && (await latest()).state.option === "hotnot", "a new Hot-oder-Not lobby");
/* Isi goes back and picks another card while still alone: her lobby switches */
await isi.goto("http://localhost:9091/duo.html?mode=who");
await wait(1200);
ok((await latest()).status === "waiting" && (await latest()).state.option === "who", "picking another card switches Isi's waiting lobby");
await benji.goto("http://localhost:9091/duo.html");
await benji.waitForSelector("#grJoinBtn", { timeout: 4000 });
ok((await benji.locator("#duoTitle").textContent()).includes("Wer von uns beiden"), "Benji sees what Isi wants to play");
await benji.click("#grJoinBtn");
await wait(900);
ok((await isi.locator(".qz-text").textContent()).startsWith("Wer von uns beiden"), "'Wer von uns beiden?' asks about us");
ok((await latest()).state.memory.hotnot.length === 12, "the new game remembers the 12 Hot-oder-Not items played before");
ok((await isi.locator(".qz-answers .qz-option").allTextContents()).join() === "Isi,Benji", "the answers are our names");
for (let i = 0; i < 6; i++) { await isi.locator(".qz-option.isi").click(); await isi.click("#duoConfirm"); }
for (let i = 0; i < 6; i++) { await benji.locator(".qz-option.benji").click(); await benji.click("#duoConfirm"); }
await wait(1000);
for (let i = 0; i < 6; i++) await benji.click("#duoConfirm");
ok((await benji.locator("#duoMatches").textContent()) === "0 von 6" && (await benji.locator("#duoVerdict").textContent()).includes("Gegensätze"), "0 of 6 – opposites attract");
ok((await benji.locator(".qz-item-line").first().textContent()) === "Du: Benji", "the result shows the names chosen");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Wir zwei: daily question, who-of-us, hot-or-not)`);
