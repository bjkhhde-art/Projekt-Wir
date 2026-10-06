import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Versus on two phones: invite, answer about yourself, guess the other, reveal, next round */
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

/* fill all three cards: "first" picks the first option / 1 / given order, "last" the opposite */
async function fillCards(page, style) {
  const cards = page.locator(".vs-question");
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    if (await card.locator(".vs-choice").count()) {
      await card.locator(".vs-choice").nth(style === "first" ? 0 : 1).click();
    } else if (await card.locator(".vs-dot").count()) {
      await card.locator(".vs-dot").nth(style === "first" ? 0 : 4).click();
    } else {
      const order = style === "first" ? [0, 1, 2] : [2, 1, 0];
      for (const index of order) await card.locator(".vs-rank-item").nth(index).click();
    }
  }
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
await until(async () => await isi.locator(".vs-question").count() === 3, 4000, "Isi in answer stage");
await until(async () => await benji.locator(".vs-question").count() === 3, 4000, "Benji in answer stage");
ok(true, "both get three questions about themselves");
const isiOwnQuestions = await isi.locator(".vs-q-text").allTextContents();
const benjiOwnQuestions = await benji.locator(".vs-q-text").allTextContents();
ok(isiOwnQuestions.every(q => !benjiOwnQuestions.includes(q)), "Isi and Benji answer different questions");
ok((await isi.locator(".vs-round").textContent()).includes("Essen & Trinken"), "the chosen category is shown");

/* answering */
ok(await isi.locator("#vsSubmit").isDisabled(), "sending is only possible when all three are answered");
await fillCards(isi, "first");
ok(await isi.locator("#vsSubmit").isEnabled(), "after three answers Isi can send");

/* Benji starts answering while Isi sends: his choice survives the live update */
await benji.locator(".vs-question").first().locator(".vs-choice, .vs-dot, .vs-rank-item").first().click();
await isi.click("#vsSubmit");
await until(async () => (await isi.locator(".vs-wait").count()) === 1, 4000, "Isi waits");
ok((await isi.locator(".vs-wait").textContent()).includes("Benji beantwortet"), "Isi waits for Benji");
const afterIsi = await isi.evaluate(() => window.__mockInvocations || []);
ok(afterIsi.some(i => i.body.onlyPerson === "Benji" && i.body.body.includes("Isi hat geantwortet")), "Benji gets a nudge that Isi has answered");
await wait(800);
ok(await benji.locator(".vs-question").first().locator(".selected, .ranked").count() >= 1, "Benji's half-filled answers survive Isi's update");

/* rank items can be taken back (on a freshly loaded page) */
await benji.reload(); await benji.waitForTimeout(800);
const rankCard = benji.locator(".vs-question", { has: benji.locator(".vs-rank-item") }).first();
if (await rankCard.count()) {
  await rankCard.locator(".vs-rank-item").nth(0).click();
  await rankCard.locator(".vs-rank-item").nth(1).click();
  ok(await rankCard.locator(".vs-rank-item.ranked").count() === 2, "ranking: tapped items get places 1 and 2");
  await rankCard.locator(".vs-rank-item").nth(0).click();
  ok(await rankCard.locator(".vs-rank-item.ranked").count() === 1, "tapping a ranked item takes it back");
}
/* fresh cards, then answer "last" everywhere */
await benji.reload(); await benji.waitForTimeout(800);
await fillCards(benji, "last");
await benji.click("#vsSubmit");

/* guessing */
await until(async () => (await isi.locator(".vs-stage-title").textContent()).includes("Benji"), 4000, "Isi guesses");
await until(async () => (await benji.locator(".vs-stage-title").textContent()).includes("Isi"), 4000, "Benji guesses");
ok(true, "after both answered, both guess");
ok(JSON.stringify(await benji.locator(".vs-q-text").allTextContents()) === JSON.stringify(isiOwnQuestions), "Benji guesses on exactly Isi's questions");
ok((await benji.locator(".vs-q-lead").first().textContent()).includes("Isi über sich"), "the cards say whose answer is being guessed");
const doc = await latest();
ok(doc.state.answers.Isi && doc.state.answers.Benji, "both answers are stored");

await fillCards(isi, "first");   // Isi guesses wrong (Benji answered "last")
await fillCards(benji, "first"); // Benji guesses right (Isi answered "first")
await isi.click("#vsSubmit");
await benji.click("#vsSubmit");

/* reveal */
await until(async () => (await isi.locator(".vs-headline").count()) === 1 && (await benji.locator(".vs-headline").count()) === 1, 5000, "reveal");
const state = (await latest()).state;
ok(state.phase === "reveal" && state.scores.Benji === 3 && state.scores.Isi === 0, `Benji knows Isi perfectly (Isi ${state.scores.Isi} : ${state.scores.Benji} Benji)`);
ok((await benji.locator(".vs-headline").textContent()).includes("Du kennst Isi diese Runde besser"), "Benji's phone celebrates");
ok((await isi.locator(".vs-headline").textContent()).includes("Benji kennt dich diese Runde besser"), "Isi's phone says Benji won the round");
ok(await isi.locator(".vs-result").count() === 6, "both sets of three answers are revealed");
ok(await benji.locator(".vs-result.hit").count() === 3, "Benji's three hits are marked");
ok((await isi.locator(".vs-player:not(.me) .vs-player-name").textContent()).includes("👑"), "the leader wears the crown");
ok((await isi.locator(".vs-player-points").first().textContent()) === "0" && (await isi.locator(".vs-player-points").last().textContent()) === "3", "the running score shows 0 : 3");

/* next round */
await isi.click("#vsNext");
await wait(700);
ok((await benji.locator(".vs-round").textContent()).includes("Runde 1") && (await isi.locator("#vsNext").textContent()).includes("warte auf Benji"), "the next round waits until Benji is ready too");
await benji.click("#vsNext");
await until(async () => (await benji.locator(".vs-question").count()) === 3, 4000, "round 2");
ok((await benji.locator(".vs-round").textContent()).includes("Runde 2"), "a new round starts for both");
const round2 = await isi.locator(".vs-q-text").allTextContents();
ok(round2.every(q => !isiOwnQuestions.includes(q) && !benjiOwnQuestions.includes(q)), "round 2 brings new questions");
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
