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
await benji.waitForTimeout(300);

await isi.locator("#startGameBtn").click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);
await benji.locator("#joinGameBtn").click();
await benji.waitForTimeout(400);
await isi.locator("#ownHand .cabo-card-slot").nth(1).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(500);

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

/* ---------- force a 7 on top of the deck for Isi's turn (peek-own power) ---------- */
let game = await getLatestGame();
let state = game.state;
state.deck.push(7);
await patchGame(game.id, { state });
await isi.waitForTimeout(500);

await isi.locator("#drawPile").click();
await isi.waitForTimeout(300);
await isi.locator("#discardPile").click();
await isi.waitForTimeout(400);

ok(await isi.locator("#ownHand .cabo-card-slot").count() === 4, "Isi's hand still has 4 slots after discarding the drawn 7");
const isiStatusPeek = await isi.locator("#caboStatus").textContent();
ok(isiStatusPeek.includes("Peek"), `discarding a 7 prompts Isi to pick her own card to peek (got "${isiStatusPeek}")`);

await isi.locator("#ownHand .cabo-card-slot").nth(2).click();
await isi.waitForTimeout(400);

ok(await isi.locator("#ownHand .cabo-card-slot").nth(2).evaluate(el => el.classList.contains("flipped")), "Isi sees her own-card peek result flipped in place, no overlay");

/* opponent must NOT see this flip at all */
ok(!(await benji.locator("#opponentHand .cabo-card-slot").nth(2).evaluate(el => el.classList.contains("flipped"))), "Benji does not see Isi's private peek-own result");

await isi.locator("#ownHand .cabo-card-slot").nth(2).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const benjiTurnAfterPeek = await benji.locator("#caboStatus").textContent();
ok(benjiTurnAfterPeek.includes("dran"), "turn correctly passes to Benji after Isi's peek-own resolves");

/* ---------- force a 9 on top of the deck for Benji's turn (spy power) ---------- */
game = await getLatestGame();
state = game.state;
state.deck.push(9);
await patchGame(game.id, { state });
await benji.waitForTimeout(500);

await benji.locator("#drawPile").click();
await benji.waitForTimeout(300);
await benji.locator("#discardPile").click();
await benji.waitForTimeout(400);

const benjiSpyStatus = await benji.locator("#caboStatus").textContent();
ok(benjiSpyStatus.includes("Isi"), `discarding a 9 prompts Benji to spy on Isi's card (got "${benjiSpyStatus}")`);

await benji.locator("#opponentHand .cabo-card-slot").nth(3).click();
await benji.waitForTimeout(400);

ok(await benji.locator("#opponentHand .cabo-card-slot").nth(3).evaluate(el => el.classList.contains("flipped")), "Benji sees his spy-target card flipped in place, no overlay");
const spyStatusText = await benji.locator("#caboStatus").textContent();
ok(spyStatusText.includes("Merk sie dir"), `status line tells Benji to memorise and turn it back (got "${spyStatusText}")`);
ok(!(await isi.locator("#ownHand .cabo-card-slot").nth(3).evaluate(el => el.classList.contains("flipped"))), "Isi does not see Benji's spy result about her own card");

await benji.locator("#opponentHand .cabo-card-slot").nth(3).click();
await benji.waitForTimeout(400);
await isi.waitForTimeout(600);

/* ---------- Isi calls Cabo ---------- */
const isiTurnStatus = await isi.locator("#caboStatus").textContent();
ok(isiTurnStatus.includes("dran"), "it's Isi's turn again before she calls Cabo");

await isi.locator(".cabo-actions button", { hasText: "Cabo rufen" }).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const benjiFinalTurnStatus = await benji.locator("#caboStatus").textContent();
ok(benjiFinalTurnStatus.includes("Dein letzter Zug"), `after Isi calls Cabo, Benji gets exactly one final turn (got "${benjiFinalTurnStatus}")`);

/* Benji takes his final turn: draw from deck, swap it in */
await benji.locator("#drawPile").click();
await benji.waitForTimeout(300);
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(700);

/* ---------- round should now be over on BOTH screens, shown inline (no overlay) ---------- */
ok(await isi.locator(".cabo-scoreboard").isVisible(), "Isi sees the inline round-over scoreboard after Benji's final turn");
ok(await benji.locator(".cabo-scoreboard").isVisible(), "Benji also sees the inline round-over scoreboard");

const isiScoreboardText = await isi.locator(".cabo-scoreboard").textContent();
const benjiScoreboardText = await benji.locator(".cabo-scoreboard").textContent();
ok(isiScoreboardText.includes("Diese Runde"), "Isi's round-over screen shows a scoreboard");
ok(benjiScoreboardText.includes("Diese Runde"), "Benji's round-over screen shows a scoreboard");

/* both hands should now be fully revealed to both players */
const isiOwnRevealedCount = await isi.locator("#ownHand .cabo-card-slot img:not([src*='Cover'])").count();
const isiOppRevealedCount = await isi.locator("#opponentHand .cabo-card-slot img:not([src*='Cover'])").count();
ok(isiOwnRevealedCount === 4, "Isi's own hand fully revealed at round end");
ok(isiOppRevealedCount === 4, "opponent's hand also fully revealed to Isi at round end");

const nextRoundBtn = isi.locator(".cabo-actions button", { hasText: "Nächste Runde" });
ok(await nextRoundBtn.count() === 1, "inline 'Nächste Runde' button offered");

/* ---------- start next round ---------- */
await nextRoundBtn.click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(700);

ok(await isi.locator(".cabo-scoreboard").count() === 0, "inline scoreboard disappears once the next round starts");
const isiFreshFlipped = await isi.locator("#ownHand .cabo-card-slot.flipped").count();
const benjiFreshFlipped = await benji.locator("#ownHand .cabo-card-slot.flipped").count();
ok(isiFreshFlipped === 2, `new round begins with a fresh initial-peek phase for Isi (${isiFreshFlipped} flipped)`);
ok(benjiFreshFlipped === 2, `new round begins with a fresh initial-peek phase for Benji too (${benjiFreshFlipped} flipped)`);

console.log(`\n${assertions} assertions passed (mp-test2: powers, cabo call, round end, next round)`);
await browser.close();
