import { chromium } from "playwright";
import assert from "node:assert/strict";

const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

await fetch("http://localhost:8991/reset", { method: "POST" });

const browser = await chromium.launch({ executablePath: BROWSER_PATH });
const isiCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const benjiCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const isi = await isiCtx.newPage();
const benji = await benjiCtx.newPage();

await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));

await isi.goto("http://localhost:9091/cabo.html");
await benji.goto("http://localhost:9091/cabo.html");
await isi.waitForTimeout(300);

await isi.locator("#grStartBtn").click();
await isi.waitForTimeout(300);
await benji.waitForTimeout(600);
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await benji.waitForTimeout(500);
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(500);

async function getLatestGame() {
  const res = await fetch("http://localhost:8991/latest-nonfinished");
  return res.json();
}
async function patchGame(id, patch) {
  await fetch(`http://localhost:8991/games/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
}

/* ---------- Isi calls Cabo immediately, Benji takes final turn, round ends ---------- */
await isi.locator(".cabo-actions button", { hasText: "Cabo rufen" }).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

await benji.locator("#drawPile").click();
await benji.waitForTimeout(250);
await benji.locator("#ownHand .cabo-card-slot").nth(1).click();
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(700);

/* ---------- round-over summary is INLINE, not an overlay ---------- */
ok(await isi.locator("#roundOverOverlay").count() === 0, "still no round-over overlay element in the DOM");
const scoreboard = isi.locator(".cabo-scoreboard");
ok(await scoreboard.count() === 1, "scoreboard table rendered inline on the board");
const scoreboardVisible = await scoreboard.isVisible();
ok(scoreboardVisible === true, "scoreboard is actually visible (not hidden behind anything)");

/* the board itself (hands, piles) should still be visible underneath/around the summary */
ok(await isi.locator("#caboBoard").isVisible(), "the game board remains visible, summary is part of it, not a separate screen");
const revealedOwn = await isi.locator("#ownHand .cabo-card-slot.flipped").count();
ok(revealedOwn === 4, "all 4 of Isi's own cards are revealed at round end");
const revealedOpp = await isi.locator("#opponentHand .cabo-card-slot.flipped").count();
ok(revealedOpp === 4, "all 4 of the opponent's cards are revealed at round end too");

const nextRoundBtn = isi.locator(".cabo-actions button", { hasText: "Nächste Runde" });
ok(await nextRoundBtn.count() === 1, "inline 'Nächste Runde' button present");

await nextRoundBtn.click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

ok(await isi.locator(".cabo-scoreboard").count() === 0, "scoreboard disappears once the next round starts");
const freshFlipped = await isi.locator("#ownHand .cabo-card-slot.flipped").count();
ok(freshFlipped === 2, "fresh round deals new cards with a new initial-peek phase (2 flipped)");

/* confirm initial peek for round 2 before continuing */
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(500);

/* ---------- force game-over by directly setting cumulative scores close to the 100 threshold ---------- */
let game = await getLatestGame();
let state = game.state;
state.scores = { Isi: [40, 35, 30], Benji: [10, 5, 8] };
state.turnPerson = "Isi";
state.turnPhase = "awaiting-draw";
await patchGame(game.id, { state });
await isi.waitForTimeout(400);
await benji.waitForTimeout(400);

await isi.locator(".cabo-actions button", { hasText: "Cabo rufen" }).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);
await benji.locator("#drawPile").click();
await benji.waitForTimeout(250);
await benji.locator("#ownHand .cabo-card-slot").nth(2).click();
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(600);
await isi.waitForTimeout(700);

const finalStatus = await isi.locator("#caboStatus").textContent();
console.log("final status:", finalStatus);
ok(finalStatus.includes("gewonnen"), `game-over status announces a winner inline (got "${finalStatus}")`);

const newGameBtn = isi.locator(".cabo-actions button", { hasText: "Neues Spiel" });
ok(await newGameBtn.count() === 1, "inline 'Neues Spiel' button shown once the game is fully over");

await newGameBtn.click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

ok(await isi.locator("#caboBoard").isVisible() && (await isi.locator("#caboScoreStrip").textContent()).replace(/\s+/g, " ").includes("Du: 0"), "'Neues Spiel' starts over at the same table with fresh scores");
ok(await benji.locator("#caboBoard").isVisible() && await benji.locator("#ownHand .cabo-card-slot.flipped").count() === 2, "Benji is dealt in right away – nobody has to join again");

await isi.close();
await benji.close();
await browser.close();
console.log(`\n${assertions} assertions passed (mp-test6: inline round-over, cabo call, game-over)`);
