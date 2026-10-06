import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Versus on two phones: invite, type own answers and guesses, judge each other, reveal, next round */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await (await fetch(`${API}/t/versus_games/latest`)).json());
await fetch(`${API}/t/versus_games/reset`, { method: "POST" });

async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function open(person, query = "?mode=versus") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/questions.html" + query);
  await page.waitForTimeout(600);
  return page;
}

/* type into all six fields: "own" and "guess" texts with a prefix */
async function typeAll(page, prefix) {
  const inputs = page.locator(".vs-input");
  const count = await inputs.count();
  for (let i = 0; i < count; i++) await inputs.nth(i).fill(`${prefix} ${i + 1}`);
}

const isi = await open("Isi");
const benji = await open("Benji", "");

/* mode switch */
ok(await isi.locator("#versusMode").isVisible() && await isi.locator("#talkMode").isHidden(), "?mode=versus opens the Versus tab");
ok(await benji.locator("#talkMode").isVisible(), "without a hint the questions page opens on the conversation questions");
ok((await benji.locator(".mode-btn").allTextContents()).join("|") === "💬 Gesprächsfragen|✨ Andere", "the tabs are 'Gesprächsfragen' and 'Andere'");
await benji.click('.mode-btn[data-mode="other"]');
const others = (await benji.locator(".other-card strong").allTextContents()).join("|");
ok(others === "Frage des Tages|Wer von uns beiden?|Hot oder Not?|Versus", `'Andere' lists the other question games (${others})`);
ok(await benji.locator('.other-card[href="duo.html?mode=daily"]').count() === 1 && await benji.locator('.other-card[href="duo.html?mode=hotnot"]').count() === 1, "the daily question and hot-or-not lead to their lobby");
await benji.click(".other-versus");
ok(await benji.locator("#versusMode").isVisible() && await benji.locator('.mode-btn[data-mode="other"]').evaluate(el => el.classList.contains("active")), "Versus opens under 'Andere'");

/* lobby + invite */
ok((await isi.locator(".gr-option-label").allTextContents()).includes("Essen & Trinken"), "the lobby offers question categories");
await isi.click('.gr-option[data-option="essen"]');
await isi.click("#grStartBtn");
await wait(400);
const invites = await isi.evaluate(() => window.__mockInvocations || []);
ok(invites.some(i => i.body.category === "games" && i.body.url === "questions.html?mode=versus" && i.body.title.includes("Versus")), "starting sends a Versus invitation");
await until(async () => await benji.locator("#grJoinBtn").count() > 0, 4000, "Benji sees the invite");
await benji.click("#grJoinBtn");
await until(async () => await isi.locator(".vs-question").count() === 6, 4000, "Isi in answer stage");
await until(async () => await benji.locator(".vs-question").count() === 6, 4000, "Benji in answer stage");
ok(true, "both get the same six questions to type into");
const questionsIsi = await isi.locator(".vs-q-text").allTextContents();
ok(JSON.stringify(questionsIsi) === JSON.stringify(await benji.locator(".vs-q-text").allTextContents()), "in the same order on both phones");
ok(new Set(questionsIsi).size === 6, "six different questions");
ok((await isi.locator(".vs-stage-title").allTextContents()).join("|") === "Über dich 🙋|Über Benji 🔮", "Isi: 1–3 about herself, 4–6 guessing Benji");
ok((await benji.locator(".vs-stage-title").allTextContents()).join("|") === "Über Isi 🔮|Über dich 🙋", "Benji: 1–3 guessing Isi, 4–6 about himself");
ok(await isi.locator(".vs-input").count() === 6 && await isi.locator(".vs-choice, .vs-dot, .vs-rank-item").count() === 0, "everything is typed in, no answers to pick");
ok((await isi.locator(".vs-q-hint").first().textContent()).length > 3, "the old options stay as a small hint");
ok((await isi.locator(".vs-round").textContent()).includes("Essen & Trinken"), "the chosen category is shown");

/* typing */
ok(await isi.locator("#vsSubmit").isDisabled(), "sending is only possible when all six are filled");
await typeAll(isi, "Isi");
ok(await isi.locator("#vsSubmit").isEnabled(), "after six answers Isi can send");

/* Benji starts typing while Isi sends: his text and focus survive the live update */
await benji.locator(".vs-input").first().fill("Halb fertig");
await benji.locator(".vs-input").nth(1).click();
await benji.keyboard.type("Ich tip");
await isi.click("#vsSubmit");
await until(async () => (await isi.locator(".vs-wait").count()) === 1, 4000, "Isi waits");
ok((await isi.locator(".vs-wait").textContent()).includes("Benji tippt noch"), "Isi waits for Benji");
const afterIsi = await isi.evaluate(() => window.__mockInvocations || []);
ok(afterIsi.some(i => i.body.onlyPerson === "Benji" && i.body.body.includes("Isi hat getippt")), "Benji gets a nudge that Isi is done");
await until(async () => (await benji.locator("#vsPartnerStatus").textContent()).includes("Isi ist schon fertig"), 4000, "Benji sees Isi done");
await benji.keyboard.type("pe weiter");
ok(await benji.locator(".vs-input").first().inputValue() === "Halb fertig" && await benji.locator(".vs-input").nth(1).inputValue() === "Ich tippe weiter", "Benji keeps typing undisturbed while Isi's update arrives");

const doc1 = (await latest()).state;
ok(doc1.answers.Isi.join() === "Isi 1,Isi 2,Isi 3" && doc1.guesses.Isi.join() === "Isi 4,Isi 5,Isi 6", "Isi's own answers (1–3) and her guesses (4–6) are stored");
await typeAll(benji, "Benji");
await benji.click("#vsSubmit");

/* judging: Isi judges 1–3, Benji judges 4–6 */
await until(async () => (await isi.locator(".vs-judge").count()) === 3, 4000, "Isi judges");
await until(async () => (await benji.locator(".vs-judge").count()) === 3, 4000, "Benji judges");
ok(true, "after both typed, both judge three tips");
ok(JSON.stringify(await isi.locator(".vs-judge .vs-q-text").allTextContents()) === JSON.stringify(questionsIsi.slice(0, 3)), "Isi judges the first three questions");
ok(JSON.stringify(await benji.locator(".vs-judge .vs-q-text").allTextContents()) === JSON.stringify(questionsIsi.slice(3)), "Benji judges the second three");
const isiJudge = await isi.locator(".vs-judge").first().textContent();
ok(isiJudge.includes("Isi 1") && isiJudge.includes("Tipp von Benji:") && isiJudge.includes("Benji 1"), "Isi sees her answer next to Benji's tip");
ok(await isi.locator("#vsSubmit").isDisabled(), "all three must be judged");
for (let i = 0; i < 3; i++) await isi.locator(".vs-judge").nth(i).locator(".vs-verdict-btn.right").click();
for (let i = 0; i < 3; i++) await benji.locator(".vs-judge").nth(i).locator(i === 0 ? ".vs-verdict-btn.right" : ".vs-verdict-btn.wrong").click();
await benji.locator(".vs-judge").nth(2).locator(".vs-verdict-btn.right").click();
await benji.locator(".vs-judge").nth(2).locator(".vs-verdict-btn.wrong").click();
ok(await benji.locator(".vs-verdict-btn.selected").count() === 3, "a verdict can be changed before sending");
await isi.click("#vsSubmit");
await until(async () => (await isi.locator(".vs-wait").count()) === 1, 4000, "Isi waits for Benji's verdict");
ok((await isi.locator(".vs-wait").textContent()).includes("Benji bewertet noch"), "Isi waits for Benji's verdict");
await benji.click("#vsSubmit");

/* reveal */
await until(async () => (await isi.locator(".vs-headline").count()) === 1 && (await benji.locator(".vs-headline").count()) === 1, 5000, "reveal");
const state = (await latest()).state;
ok(state.phase === "reveal" && state.scores.Benji === 3 && state.scores.Isi === 1, `Benji knows Isi perfectly (Isi ${state.scores.Isi} : ${state.scores.Benji} Benji)`);
ok((await benji.locator(".vs-headline").textContent()).includes("Du kennst Isi diese Runde besser"), "Benji's phone celebrates");
ok((await isi.locator(".vs-headline").textContent()).includes("Benji kennt dich diese Runde besser"), "Isi's phone says Benji won the round");
ok(await isi.locator(".vs-result").count() === 6, "all six answers are revealed");
ok(await benji.locator(".vs-result.hit").count() === 4 && (await isi.locator(".vs-result").first().textContent()).includes("Benji 4"), "hits are marked, typed texts shown");
ok((await isi.locator(".vs-player:not(.me) .vs-player-name").textContent()).includes("👑"), "the leader wears the crown");
ok((await isi.locator(".vs-player-points").first().textContent()) === "1" && (await isi.locator(".vs-player-points").last().textContent()) === "3", "the running score shows 1 : 3");

/* next round */
await isi.click("#vsNext");
await wait(700);
ok((await benji.locator(".vs-round").textContent()).includes("Runde 1") && (await isi.locator("#vsNext").textContent()).includes("warte auf Benji"), "the next round waits until Benji is ready too");
await benji.click("#vsNext");
await until(async () => (await benji.locator(".vs-question").count()) === 6, 4000, "round 2");
ok((await benji.locator(".vs-round").textContent()).includes("Runde 2"), "a new round starts for both");
const round2 = await isi.locator(".vs-q-text").allTextContents();
ok(round2.every(q => !questionsIsi.includes(q)), "round 2 brings new questions");
ok((await isi.locator(".vs-player-points").last().textContent()) === "3", "the score carries over");

/* switching back to the conversation questions keeps working */
await isi.click('.mode-btn[data-mode="talk"]');
ok(await isi.locator("#talkMode").isVisible() && await isi.locator("#newQuestionBtn").isVisible(), "the conversation questions are still there");
await isi.goto("http://localhost:9091/questions.html"); await isi.waitForTimeout(600);
ok(await isi.locator("#talkMode").isVisible(), "the chosen tab is remembered");
await isi.click('.mode-btn[data-mode="other"]');
await isi.click(".other-versus");

/* leaving */
await isi.click("#vsLeaveBtn");
await isi.click("#vsLeaveBtn");
await until(async () => (await benji.locator(".gr-lobby-note").count()) === 1, 4000, "Benji sees Isi left");
ok((await benji.locator(".gr-lobby-note").textContent()).includes("Isi hat das letzte Spiel beendet"), "leaving ends the game on both phones");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (versus: two-device round)`);
