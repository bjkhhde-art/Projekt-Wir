import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Versus on two phones like LovBirdz: roles, question by question, swap after three, summary, next round */
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

/* one question: both type, the answerer judges; both phones then see the result and tap "Weiter" */
async function playQuestion(answerer, guesser, right, label) {
  await until(async () => (await answerer.locator("#vsInput").count()) === 1 && (await guesser.locator("#vsInput").count()) === 1, 4000, "input " + label);
  await answerer.fill("#vsInput", `Antwort ${label}`);
  await answerer.click("#vsSubmit");
  await guesser.fill("#vsInput", `Tipp ${label}`);
  await guesser.click("#vsSubmit");
  await until(async () => (await answerer.locator(".vs-verdict-btn").count()) === 2, 4000, "judge " + label);
  await answerer.click(right ? ".vs-verdict-btn.right" : ".vs-verdict-btn.wrong");
  await until(async () => (await answerer.locator(".vs-outcome").count()) === 1 && (await guesser.locator(".vs-outcome").count()) === 1, 4000, "outcome " + label);
}

async function goOn(page) {
  await page.click("#vsContinue");
  await wait(150);
  if (await page.locator("#vsRolesGo").count()) await page.click("#vsRolesGo");
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
/* roles first, like LovBirdz */
await until(async () => (await isi.locator(".vs-role-card").count()) === 2 && (await benji.locator(".vs-role-card").count()) === 2, 4000, "role cards");
ok((await isi.locator(".vs-roles-title").textContent()).includes("Rollenverteilung"), "a round starts with the role assignment");
ok((await isi.locator(".vs-role-card.answer").textContent()).includes("Du bist dran mit Antworten") && (await isi.locator(".vs-role-card.guess").textContent()).includes("Benji ist dran mit Raten"), "Isi answers first, Benji guesses");
ok((await benji.locator(".vs-role-card.guess").textContent()).includes("Du bist dran mit Raten"), "Benji's phone tells him he guesses");
ok((await isi.locator(".vs-round").textContent()).includes("Essen & Trinken"), "the chosen category is shown");
await isi.click("#vsRolesGo");
await benji.click("#vsRolesGo");

/* question 1, step by step */
await until(async () => (await isi.locator("#vsInput").count()) === 1 && (await benji.locator("#vsInput").count()) === 1, 4000, "question 1");
const q1 = await isi.locator(".vs-q-text").textContent();
ok(q1 === await benji.locator(".vs-q-text").textContent(), "both see the same question");
ok((await isi.locator(".vs-role").textContent()).includes("Antworten") && (await benji.locator(".vs-role").textContent()).includes("Raten"), "each phone shows its role");
ok((await benji.locator(".vs-q-lead").textContent()).includes("Was antwortet Isi"), "Benji guesses what Isi answers");
ok(await isi.locator(".vs-step").count() === 6 && await isi.locator(".vs-swap").count() === 1, "six steps with the role swap in the middle");
ok(await isi.locator("#vsSubmit").isDisabled(), "confirming needs some text");
if (await isi.locator(".vs-chip").count()) {
  await isi.locator(".vs-chip").first().click();
  ok((await isi.locator("#vsInput").inputValue()) === (await isi.locator(".vs-chip").first().textContent()), "a suggestion fills the text field");
}
await isi.fill("#vsInput", "Pasta, ganz klar");

/* Benji types while Isi confirms: his text and focus survive the live update */
await benji.click("#vsInput");
await benji.keyboard.type("Pas");
await isi.click("#vsSubmit");
await until(async () => (await isi.locator(".vs-wait").count()) === 1, 4000, "Isi waits");
ok((await isi.locator(".vs-wait").textContent()).includes("Benji rät noch"), "Isi waits for Benji's guess");
await until(async () => (await benji.locator("#vsPartnerStatus").textContent()).includes("Isi ist schon fertig"), 4000, "Benji sees Isi done");
await benji.keyboard.type("ta");
ok(await benji.locator("#vsInput").inputValue() === "Pasta", "Benji keeps typing undisturbed");
await benji.click("#vsSubmit");

/* resolved right away: Isi judges */
await until(async () => (await isi.locator(".vs-verdict-btn").count()) === 2, 4000, "Isi judges");
ok((await isi.locator(".vs-judge").textContent()).includes("Pasta, ganz klar") && (await isi.locator(".vs-judge").textContent()).includes("Tipp von Benji:"), "Isi sees her answer and Benji's tip");
await until(async () => (await benji.locator(".vs-wait").count()) === 1, 4000, "Benji waits for verdict");
ok((await benji.locator(".vs-wait").textContent()).includes("Isi entscheidet"), "Benji waits for Isi's verdict");
ok(await benji.locator(".vs-verdict-btn").count() === 0, "only the one who answered can judge");
await isi.click(".vs-verdict-btn.right");
await until(async () => (await benji.locator(".vs-outcome").count()) === 1, 4000, "Benji sees outcome");
ok((await benji.locator(".vs-outcome h2").textContent()).includes("Richtig") && (await benji.locator(".vs-outcome-text").textContent()).includes("+1 Punkt für dich"), "Benji sees right away that he was right");
ok((await isi.locator(".vs-outcome-text").textContent()).includes("+1 Punkt für Benji"), "Isi sees it too");
ok((await isi.locator(".vs-player-points").last().textContent()) === "1", "the score updates at once");
await goOn(isi);
await goOn(benji);

/* questions 2 and 3 */
await playQuestion(isi, benji, false, "2");
ok((await benji.locator(".vs-outcome h2").textContent()).includes("Oh je"), "a wrong guess: 'Oh je!'");
await goOn(isi); await goOn(benji);
await playQuestion(isi, benji, true, "3");
await isi.click("#vsContinue");
await benji.click("#vsContinue");

/* the role swap */
await until(async () => (await isi.locator(".vs-roles-title").count()) === 1 && (await benji.locator(".vs-roles-title").count()) === 1, 4000, "swap");
ok((await benji.locator(".vs-roles-title").textContent()).includes("Rollenwechsel"), "after three questions: role swap");
ok((await benji.locator(".vs-role-card.answer").textContent()).includes("Du bist dran mit Antworten") && (await isi.locator(".vs-role-card.guess").textContent()).includes("Du bist dran mit Raten"), "now Benji answers and Isi guesses");
await isi.click("#vsRolesGo"); await benji.click("#vsRolesGo");
await until(async () => (await benji.locator(".vs-role").count()) === 1, 4000, "q4");
ok((await benji.locator(".vs-role").textContent()).includes("Antworten") && (await isi.locator(".vs-q-lead").textContent()).includes("Was antwortet Benji"), "Benji answers question 4");
await playQuestion(benji, isi, true, "4");
ok(await isi.locator(".vs-verdict-btn").count() === 0, "Benji judges the second half");
await goOn(isi); await goOn(benji);
await playQuestion(benji, isi, false, "5");
await goOn(isi); await goOn(benji);
await playQuestion(benji, isi, false, "6");
await goOn(isi); await goOn(benji);

/* summary */
await until(async () => (await isi.locator(".vs-headline").count()) === 1 && (await benji.locator(".vs-headline").count()) === 1, 5000, "summary");
const state = (await latest()).state;
ok(state.phase === "reveal" && state.scores.Benji === 2 && state.scores.Isi === 1, `Benji knows Isi better (Isi ${state.scores.Isi} : ${state.scores.Benji} Benji)`);
ok((await benji.locator(".vs-headline").textContent()).includes("Du kennst Isi diese Runde besser"), "Benji's phone celebrates");
ok((await isi.locator(".vs-headline").textContent()).includes("Benji kennt dich diese Runde besser"), "Isi's phone says Benji won the round");
ok(await isi.locator(".vs-result").count() === 6 && await benji.locator(".vs-result.hit").count() === 3, "all six questions with their verdicts");
ok((await isi.locator(".vs-result").first().textContent()).includes("Antwort 4") || (await isi.locator(".vs-result").first().textContent()).includes("Tipp 4"), "the typed texts are shown");
ok((await isi.locator(".vs-player:not(.me) .vs-player-name").textContent()).includes("👑"), "the leader wears the crown");
ok((await isi.locator(".vs-player-points").first().textContent()) === "1" && (await isi.locator(".vs-player-points").last().textContent()) === "2", "the running score shows 1 : 2");
const questionsRound1 = state.questions.slice();

/* next round */
await isi.click("#vsNext");
await wait(700);
ok((await benji.locator(".vs-round").textContent()).includes("Runde 1") && (await isi.locator("#vsNext").textContent()).includes("warte auf Benji"), "the next round waits until Benji is ready too");
await benji.click("#vsNext");
await until(async () => (await benji.locator(".vs-roles-title").count()) === 1, 4000, "round 2");
ok((await benji.locator(".vs-round").textContent()).includes("Runde 2"), "a new round starts for both");
const round2 = (await latest()).state.questions;
ok(round2.every(q => !questionsRound1.includes(q)), "round 2 brings new questions");
ok((await isi.locator(".vs-player-points").last().textContent()) === "2", "the score carries over");

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
