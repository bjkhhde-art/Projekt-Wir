import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Versus on two phones like LovBirdz, full screen: roles, own pace, swap after three, reveal at the end */
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

/* type the next question (and confirm the role card when it comes) */
async function typeNext(page, text) {
  await until(async () => (await page.locator("#vsInput").count()) === 1 || (await page.locator("#vsRolesGo").count()) === 1, 4000, "next question");
  if (await page.locator("#vsRolesGo").count()) await page.click("#vsRolesGo");
  await until(async () => (await page.locator("#vsInput").count()) === 1, 4000, "input");
  await page.fill("#vsInput", text);
  await page.click("#vsSubmit");
  await wait(250);
}

/* the reveal card: the answerer decides, then both tap "Weiter" */
async function judgeAndGoOn(page, right) {
  await until(async () => (await page.locator(".qz-verdict .qz-option").count()) === 2, 4000, "verdict buttons");
  await page.click(right ? ".qz-verdict .right" : ".qz-verdict .wrong");
  await until(async () => (await page.locator("#vsContinue:not([disabled])").count()) === 1, 4000, "continue");
  await page.click("#vsContinue");
}

async function goOn(page) {
  await until(async () => (await page.locator("#vsContinue:not([disabled])").count()) === 1, 4000, "continue after verdict");
  await page.click("#vsContinue");
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
/* full screen, roles first – like LovBirdz */
await until(async () => (await isi.locator(".qz-role-card").count()) === 2 && (await benji.locator(".qz-role-card").count()) === 2, 4000, "role cards");
ok(await isi.evaluate(() => {
  const r = document.getElementById("vsBoard").getBoundingClientRect();
  return r.top === 0 && r.left === 0 && r.width === innerWidth && r.height === innerHeight;
}), "a running round fills the whole screen");
ok(await isi.evaluate(() => {
  const nav = document.querySelector(".app-nav").getBoundingClientRect();
  return document.elementFromPoint(nav.left + 10, nav.top + 10)?.closest("#vsBoard") !== null;
}), "the navigation is covered by the round");
ok((await isi.locator(".qz-head").textContent()).includes("Rollenverteilung"), "a round starts with the role assignment");
ok((await isi.locator(".qz-role-card.answer").textContent()).includes("Du bist dran mit Antworten") && (await isi.locator(".qz-role-card.guess").textContent()).includes("Benji ist dran mit Raten"), "Isi answers first, Benji guesses");
ok((await benji.locator(".qz-role-card.guess").textContent()).includes("Du bist dran mit Raten"), "Benji's phone tells him he guesses");
await isi.click("#vsRolesGo");
await benji.click("#vsRolesGo");

/* question 1: upper half the question, lower half the text field */
await until(async () => (await isi.locator("#vsInput").count()) === 1 && (await benji.locator("#vsInput").count()) === 1, 4000, "question 1");
const q1 = await isi.locator(".qz-text").textContent();
ok(q1 === await benji.locator(".qz-text").textContent(), "both see the same first question");
ok(await isi.evaluate(() => {
  const q = document.querySelector(".qz-question").getBoundingClientRect();
  const a = document.querySelector(".qz-answers").getBoundingClientRect();
  return q.bottom <= a.top + 1 && q.height > 100 && a.height > 100;
}), "question on top, answer field below");
ok((await isi.locator(".qz-head").textContent()).includes("Antworten") && (await benji.locator(".qz-head").textContent()).includes("Raten"), "each phone shows its role");
ok((await benji.locator(".qz-lead").textContent()).includes("Was antwortet Isi"), "Benji guesses what Isi answers");
ok(await isi.locator(".qz-progress-half").count() === 2 && await isi.locator(".qz-progress-swap").count() === 1, "the progress bar has the role swap in the middle");
ok(await isi.locator("#vsSubmit").isDisabled(), "confirming needs some text");
if (await isi.locator(".qz-chip-btn").count()) {
  await isi.locator(".qz-chip-btn").first().click();
  ok((await isi.locator("#vsInput").inputValue()) === (await isi.locator(".qz-chip-btn").first().textContent()), "a suggestion fills the text field");
}

/* Benji types while Isi moves on: his text and focus survive the live update */
await benji.click("#vsInput");
await benji.keyboard.type("Pas");
await isi.fill("#vsInput", "Antwort 1");
await isi.click("#vsSubmit");
await until(async () => (await isi.locator(".qz-lead").textContent()).includes("Frage 2"), 4000, "Isi at question 2");
ok(true, "after confirming, Isi goes straight to the next question – no waiting");
await until(async () => (await benji.locator("#vsPartnerStatus").textContent()).includes("Frage 2"), 4000, "Benji sees Isi's progress");
await benji.keyboard.type("ta");
ok(await benji.locator("#vsInput").inputValue() === "Pasta", "Benji keeps typing undisturbed and sees how far Isi is");
await benji.click("#vsSubmit");

/* Isi races ahead: question 2 and 3, then the swap */
await typeNext(isi, "Antwort 2");
await typeNext(isi, "Antwort 3");
await until(async () => (await isi.locator(".qz-head").textContent()).includes("Rollenwechsel"), 4000, "swap");
ok((await isi.locator(".qz-role-card.answer").textContent()).includes("Benji ist dran mit Antworten") && (await isi.locator(".qz-role-card.guess").textContent()).includes("Du bist dran mit Raten"), "after three questions the roles swap");
await isi.click("#vsRolesGo");
ok((await isi.locator(".qz-head").textContent()).includes("Raten") && (await isi.locator(".qz-lead").textContent()).includes("Frage 4 von 6 · Was antwortet Benji"), "Isi now guesses Benji's answers");
await typeNext(isi, "Tipp 4");
await typeNext(isi, "Tipp 5");
await typeNext(isi, "Tipp 6");
await until(async () => (await isi.locator(".qz-center h2").count()) === 1, 4000, "Isi waits");
ok((await isi.locator(".qz-center").textContent()).includes("Warte auf Benji"), "Isi is done and waits for Benji");
ok((await latest()).state.phase === "play", "no reveal before both are done");

await typeNext(benji, "Tipp 2");
await typeNext(benji, "Tipp 3");
await typeNext(benji, "Antwort 4");
await typeNext(benji, "Antwort 5");
await typeNext(benji, "Antwort 6");

/* the reveal, question by question */
await until(async () => (await isi.locator(".qz-head").textContent()).includes("Aufklärung 1/6") && (await benji.locator(".qz-head").textContent()).includes("Aufklärung 1/6"), 5000, "reveal");
ok(true, "when both are done, the reveal starts on both phones");
ok((await isi.locator(".qz-pair").textContent()).includes("Antwort 1") && (await isi.locator(".qz-pair").textContent()).includes("Pasta"), "Isi sees her answer and Benji's tip");
ok(await benji.locator(".qz-verdict").count() === 0 && (await benji.locator(".qz-result.open").textContent()).includes("Isi entscheidet"), "Benji waits for Isi's verdict");
ok(await benji.locator("#vsContinue").isDisabled(), "and cannot skip ahead");
await isi.click(".qz-verdict .right");
await until(async () => (await benji.locator(".qz-result.hit").count()) === 1, 4000, "Benji sees the verdict");
ok((await benji.locator(".qz-result.hit").textContent()).includes("Richtig") && (await benji.locator(".qz-points").textContent()).includes("+1 Punkt für dich"), "Benji sees right away that he was right");
await goOn(isi); await goOn(benji);
await judgeAndGoOn(isi, false);
await until(async () => (await benji.locator(".qz-result.miss").count()) === 1, 4000, "miss");
ok((await benji.locator(".qz-result.miss h3").textContent()).includes("Oh je"), "a wrong guess: 'Oh je!'");
await goOn(benji);
await judgeAndGoOn(isi, true);
await goOn(benji);
/* 4–6: Benji decides */
ok((await isi.locator(".qz-lead").textContent()).includes("Über Benji") && await isi.locator(".qz-verdict").count() === 0, "for 4–6 Benji decides");
await judgeAndGoOn(benji, true); await goOn(isi);
await judgeAndGoOn(benji, false); await goOn(isi);
await judgeAndGoOn(benji, false); await goOn(isi);

/* summary */
await until(async () => (await isi.locator("#vsSummary").count()) === 1 && (await benji.locator("#vsSummary").count()) === 1, 5000, "summary");
const state = (await latest()).state;
ok(state.phase === "reveal" && state.scores.Benji === 2 && state.scores.Isi === 1, `Benji knows Isi better (Isi ${state.scores.Isi} : ${state.scores.Benji} Benji)`);
ok((await benji.locator("#vsSummary").textContent()).includes("Du kennst Isi diese Runde besser"), "Benji's phone celebrates");
ok((await isi.locator("#vsSummary").textContent()).includes("Benji kennt dich diese Runde besser"), "Isi's phone says Benji won the round");
ok(await isi.locator(".qz-item").count() === 6 && await benji.locator(".qz-item.hit").count() === 3, "all six questions with their verdicts");
ok((await isi.locator(".qz-list").first().textContent()).includes("Antwort 4") && (await isi.locator(".qz-list").first().textContent()).includes("Tipp 4"), "the typed texts are shown");
ok((await isi.locator(".qz-chip:not(.me)").textContent()).includes("👑"), "the leader wears the crown");
ok((await isi.locator(".qz-chip.me").textContent()).includes("Du 1") && (await isi.locator(".qz-chip:not(.me)").textContent()).includes("Benji 2"), "the running score shows 1 : 2");
const questionsRound1 = state.questions.slice();

/* next round */
await isi.click("#vsNext");
await wait(700);
ok((await isi.locator("#vsNext").textContent()).includes("warte auf Benji"), "the next round waits until Benji is ready too");
await benji.click("#vsNext");
await until(async () => (await benji.locator(".qz-role-card").count()) === 2, 4000, "round 2");
ok((await latest()).state.round === 2, "a new round starts for both");
const round2 = (await latest()).state.questions;
ok(round2.every(q => !questionsRound1.includes(q)), "round 2 brings new questions");
ok((await isi.locator(".qz-chip:not(.me)").textContent()).includes("Benji 2"), "the score carries over");

/* "‹" leaves the full screen without ending the round */
await isi.click("#vsBackBtn");
await wait(300);
ok(await isi.locator("#otherMode").isVisible() && await isi.locator("#vsBoard").isHidden(), "the back arrow shows the list of modes again");
ok((await latest()).status === "active", "the round keeps running");
await isi.click('.mode-btn[data-mode="talk"]');
ok(await isi.locator("#talkMode").isVisible() && await isi.locator("#newQuestionBtn").isVisible(), "the conversation questions are still there");
await isi.goto("http://localhost:9091/questions.html"); await isi.waitForTimeout(600);
ok(await isi.locator("#talkMode").isVisible() && await isi.locator("#vsBoard").isHidden(), "the chosen tab is remembered – no full screen over the conversation questions");
await isi.click('.mode-btn[data-mode="other"]');
await isi.click(".other-versus");
await until(async () => await isi.locator("#vsBoard").isVisible(), 3000, "back in the round");
ok(true, "opening Versus again continues the round");

/* leaving */
await isi.click("#vsLeaveBtn");
await isi.click("#vsLeaveBtn");
await until(async () => (await benji.locator(".gr-lobby-note").count()) === 1, 4000, "Benji sees Isi left");
ok((await benji.locator(".gr-lobby-note").textContent()).includes("Isi hat das letzte Spiel beendet"), "leaving ends the game on both phones");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (versus: two-device round)`);
