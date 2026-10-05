import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Animations ON (no reducedMotion): checks that cards really fly/turn and that nothing stays hidden. */
const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

await fetch("http://localhost:8991/reset", { method: "POST" });

const browser = await chromium.launch({ executablePath: BROWSER_PATH });
const isi = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const benji = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

const errors = [];
isi.on("pageerror", e => errors.push("isi: " + e.message));
benji.on("pageerror", e => errors.push("benji: " + e.message));

await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
await isi.goto("http://localhost:9091/cabo.html");
await benji.goto("http://localhost:9091/cabo.html");
await isi.waitForTimeout(300);

const ghostAppears = page => page.waitForSelector(".ga-ghost", { timeout: 2000 }).then(() => true, () => false);
const ghostCount = page => page.locator(".ga-ghost").count();
/* most cards in the air at the same moment during the next ~0.9 s */
const peakGhosts = page => page.evaluate(() => new Promise(resolve => {
  let peak = 0;
  const started = performance.now();
  const tick = () => {
    peak = Math.max(peak, document.querySelectorAll(".ga-ghost").length);
    if (performance.now() - started < 900) requestAnimationFrame(tick); else resolve(peak);
  };
  tick();
}));
const hiddenCount = page => page.locator(".anim-hidden").count();
const settle = async () => { await isi.waitForTimeout(1800); await benji.waitForTimeout(100); };

/* rotation of a card's inner element: 1 = face-down, -1 = face-up, in between = mid-turn */
const turnOf = (page, selector) => page.locator(selector).evaluate(el => {
  const t = getComputedStyle(el.querySelector(".cabo-flip-inner")).transform;
  if (!t || t === "none") return 1;
  return Number(t.replace(/^matrix(3d)?\(/, "").split(",")[0]);
});

async function latest() {
  return (await fetch("http://localhost:8991/latest")).json();
}
async function setup(mutate) {
  const game = await latest();
  mutate(game.state);
  await fetch(`http://localhost:8991/games/${game.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: game.state })
  });
  await isi.waitForTimeout(500);
  await benji.waitForTimeout(100);
}

/* ================= deal ================= */
await isi.locator("#grStartBtn").click();
await benji.waitForTimeout(700);
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();

ok(await ghostAppears(benji), "joining deals the cards: flying cards appear on Benji's screen");
ok(await ghostAppears(isi), "Isi sees the deal animation too");
ok(await hiddenCount(benji) > 0, "dealt cards stay hidden until their flying copy lands");
ok(await benji.locator("#ownHand .cabo-card-slot.flipped").count() === 0, "the initial-peek cards wait for the deal before turning over");

await settle();
ok(await hiddenCount(benji) === 0 && await hiddenCount(isi) === 0, "after the deal every card is visible");
ok(await ghostCount(benji) === 0 && await ghostCount(isi) === 0, "no flying cards are left behind");
ok(await benji.locator("#ownHand .cabo-card-slot.flipped").count() === 2, "after the deal the two left cards are turned up");
ok(await turnOf(benji, "#ownHand .cabo-card-slot >> nth=0") < -0.99, "the turned card has fully completed its flip");

/* confirming the initial peek turns the cards back with an animation */
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.waitForTimeout(220);
const midTurn = await turnOf(benji, "#ownHand .cabo-card-slot >> nth=0");
ok(midTurn > -0.99 && midTurn < 0.99, `the card visibly turns back over time (rotation mid-way: ${midTurn.toFixed(2)})`);
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await settle();
ok(await turnOf(benji, "#ownHand .cabo-card-slot >> nth=0") > 0.99, "and ends face-down");

/* ================= draw + swap (Isi) ================= */
await setup(s => { s.deck.push(5); s.turnPerson = "Isi"; s.turnPhase = "awaiting-draw"; });

await isi.locator("#drawPile").click();
ok(await ghostAppears(isi), "drawing: a card flies from the deck on Isi's screen");
ok(await ghostAppears(benji), "Benji sees Isi draw a card");
await settle();
ok(await isi.locator(".cabo-drawn-preview:not(.anim-hidden)").count() === 1, "the drawn card is shown once it has landed");

await isi.locator("#ownHand .cabo-card-slot").nth(2).click();
const benjiSeesSwap = ghostAppears(benji);
await isi.locator(".cabo-drawn-preview").click();
const swapPeakPromise = peakGhosts(isi);
await isi.waitForTimeout(150);
ok(await isi.locator('[data-anim-key="hand-Isi-2"]').evaluate(el => el.classList.contains("anim-hidden")), "the hand slot stays empty until the new card lands");
const swapPeak = await swapPeakPromise;
ok(swapPeak === 2, `swap moves two cards at once: new card into the hand, old card onto the pile (peak ${swapPeak})`);
ok(await benjiSeesSwap, "Benji sees the swap animation");
await settle();
ok(await hiddenCount(isi) === 0 && await hiddenCount(benji) === 0, "after the swap everything is visible again");

/* the realtime echo of Isi's own move must not replay the animation */
await isi.waitForTimeout(700);
ok(await ghostCount(isi) === 0, "the move is animated exactly once (no replay on the realtime echo)");

/* ================= peek: real flip, then back ================= */
await setup(s => { s.deck.push(7); });
await benji.locator("#drawPile").click();
await benji.waitForTimeout(700);
await benji.locator("#discardPile").click();
await benji.waitForTimeout(700);
await benji.locator("#ownHand .cabo-card-slot").nth(3).click();
await benji.waitForTimeout(220);
const peekMid = await turnOf(benji, "#ownHand .cabo-card-slot >> nth=3");
ok(peekMid > -0.99 && peekMid < 0.99, `peeking turns the card over visibly (rotation mid-way: ${peekMid.toFixed(2)})`);
await benji.waitForTimeout(800);
ok(await turnOf(benji, "#ownHand .cabo-card-slot >> nth=3") < -0.99, "the peeked card ends face-up");
await benji.locator("#ownHand .cabo-card-slot").nth(3).click();
await settle();
ok(await turnOf(benji, "#ownHand .cabo-card-slot >> nth=3") > 0.99, "turning it back ends face-down");

/* ================= blind swap ================= */
await setup(s => { s.deck.push(11); });
await isi.locator("#drawPile").click();
await isi.waitForTimeout(700);
await isi.locator("#discardPile").click();
await isi.waitForTimeout(700);
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.locator("#opponentHand .cabo-card-slot").nth(1).click();
ok(await ghostAppears(isi), "blind swap: cards fly on Isi's screen");
ok(await ghostCount(isi) === 2, "the two swapped cards cross over");
ok(await ghostAppears(benji), "Benji sees his card being taken");
await settle();
ok(await hiddenCount(isi) === 0 && await hiddenCount(benji) === 0, "after the blind swap all cards are visible");

/* ================= multi-swap shrinks the hand ================= */
await setup(s => { s.hands.Benji = [8, 3, 8, 8]; s.deck.push(1); });
await benji.locator("#drawPile").click();
await benji.waitForTimeout(700);
for (const i of [0, 2, 3]) await benji.locator("#ownHand .cabo-card-slot").nth(i).click();
await benji.locator(".cabo-drawn-preview").click();
const multiPeak = await peakGhosts(benji);
ok(multiPeak === 4, `three cards fly to the pile and one into the hand (peak ${multiPeak})`);
await settle();
ok(await benji.locator("#ownHand .cabo-card-slot").count() === 2 && await hiddenCount(benji) === 0, "Benji ends with 2 visible cards");

/* ================= round end: cards are revealed one after another ================= */
await setup(s => { s.deck.push(4); s.turnPerson = "Isi"; s.turnPhase = "awaiting-draw"; s.caboCalledBy = "Benji"; s.finalTurnsRemaining = ["Isi"]; });
await isi.locator("#drawPile").click();
await isi.waitForTimeout(700);
await isi.locator("#discardPile").click();
await isi.waitForTimeout(350);
const earlyFlipped = await isi.locator(".cabo-card-slot.flipped").count();
const total = await isi.locator(".cabo-card-slot").count();
ok(earlyFlipped < total, `at round end the cards are not all revealed at once (${earlyFlipped}/${total} after 350 ms)`);
await isi.waitForTimeout(2200);
ok(await isi.locator(".cabo-card-slot.flipped").count() === total, `then all ${total} cards end face-up`);
ok(await turnOf(isi, "#opponentHand .cabo-card-slot >> nth=0") < -0.99, "the reveal flips complete");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${assertions} assertions passed (mp-test9: animations)`);
