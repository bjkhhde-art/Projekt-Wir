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

const isiErrors = [];
const benjiErrors = [];
isi.on("pageerror", e => isiErrors.push(e.message));
benji.on("pageerror", e => benjiErrors.push(e.message));

await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));

await isi.goto("http://localhost:9091/cabo.html");
await benji.goto("http://localhost:9091/cabo.html");
await isi.waitForTimeout(300);

/* ---------- no overlay elements anywhere in the DOM ---------- */
for (const id of ["initialPeekOverlay", "peekResultOverlay", "roundOverOverlay"]) {
  ok(await isi.locator(`#${id}`).count() === 0, `#${id} does not exist in the DOM`);
}

await isi.locator("#grStartBtn").click();
await isi.waitForTimeout(300);
await benji.waitForTimeout(600);
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await benji.waitForTimeout(500);

ok(isiErrors.length === 0, `no JS errors on Isi's page so far (${JSON.stringify(isiErrors)})`);
ok(benjiErrors.length === 0, `no JS errors on Benji's page so far (${JSON.stringify(benjiErrors)})`);

/* ---------- initial peek: confirm by tapping the SECOND flipped card (slot 1), not a button ---------- */
ok(await isi.locator(".cabo-actions button", { hasText: "Gemerkt" }).count() === 0, "no 'Gemerkt' button exists anymore");
await isi.locator("#ownHand .cabo-card-slot").nth(1).click();
await isi.waitForTimeout(300);
ok((await isi.locator("#caboStatus").textContent()).includes("Warte"), "tapping the 2nd initial-peek card confirms it (status now waiting on Benji)");

await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.waitForTimeout(300);
await isi.waitForTimeout(600);

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

/* ---------- draw + discard by tapping the discard pile (no 'Ablegen' button) ---------- */
let game = await getLatestGame();
let state = game.state;
state.deck.push(3); // plain card, no power
await patchGame(game.id, { state });
await isi.waitForTimeout(400);

await isi.locator("#drawPile").click();
await isi.waitForTimeout(300);

ok(await isi.locator(".cabo-actions button", { hasText: "Ablegen" }).count() === 0, "no separate 'Ablegen' button exists");
const preview = isi.locator(".cabo-drawn-preview");
ok(await preview.count() === 1, "drawn card preview is shown");
ok(await isi.locator("#discardPile").evaluate(el => el.classList.contains("drop-target")), "discard pile is highlighted as the place to put the drawn card down");

/* tapping the drawn card with nothing selected does nothing (just nudges the hint) */
await preview.click();
await isi.waitForTimeout(400);
ok((await isi.locator("#caboStatus").textContent()).includes("Ablagestapel"), "tapping the drawn card with no card selected keeps the turn going");

await isi.locator("#discardPile").click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const benjiStatusAfterDiscard = await benji.locator("#caboStatus").textContent();
ok(benjiStatusAfterDiscard.includes("dran"), "turn passed to Benji after Isi put the card on the discard pile");

/* ---------- drawing from discard: can't be put back, must be swapped ---------- */
await benji.locator("#discardPile").click();
await benji.waitForTimeout(300);
ok(await benji.locator("#discardPile").evaluate(el => el.disabled), "a card taken from the discard pile cannot be put straight back");
await benji.locator("#ownHand .cabo-card-slot").nth(2).click();
await benji.waitForTimeout(200);
ok(await benji.locator("#ownHand .cabo-card-slot").nth(2).evaluate(el => el.classList.contains("selected")), "tapping a hand card marks it as selected");
ok((await isi.locator("#caboStatus").textContent()).includes("Benji ist am Zug"), "selecting is local, Isi's screen is unaffected");
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(400);
await isi.waitForTimeout(600);

/* ---------- own-peek via 7, dismiss by tapping the card again (no button) ---------- */
game = await getLatestGame();
state = game.state;
state.deck.push(8);
await patchGame(game.id, { state });
await isi.waitForTimeout(400);

await isi.locator("#drawPile").click();
await isi.waitForTimeout(250);
ok((await isi.locator("#caboStatus").textContent()).includes("Peek zu nutzen"), "drawing an 8 hints that putting it down grants Peek");
await isi.locator("#discardPile").click();
await isi.waitForTimeout(350);

const peekStatus = await isi.locator("#caboStatus").textContent();
ok(peekStatus.includes("Peek"), `prompt to choose own card to peek (got "${peekStatus}")`);

await isi.locator("#ownHand .cabo-card-slot").nth(2).click();
await isi.waitForTimeout(350);
await benji.waitForTimeout(500);

ok(await isi.locator(".cabo-actions button", { hasText: "Verdecken" }).count() === 0, "no 'Verdecken' dismiss button exists");
const dismissStatus = await isi.locator("#caboStatus").textContent();
ok(dismissStatus.includes("nochmal an"), `status instructs to tap the card again (got "${dismissStatus}")`);

/* the peek belongs to Isi's turn: Benji waits and sees which card she is looking at */
ok((await benji.locator("#caboStatus").textContent()).includes("schaut sich eine eigene Karte an"), "Benji is told Isi is looking at a card, it is not his turn yet");
ok(await benji.locator("#drawPile").evaluate(el => el.disabled), "Benji cannot draw while Isi is still looking");
ok(await benji.locator("#opponentHand .cabo-card-slot").nth(2).evaluate(el => el.classList.contains("watched") && !el.classList.contains("flipped")), "Benji sees Isi's peeked slot highlighted but face-down");

const peekedSlot = isi.locator("#ownHand .cabo-card-slot").nth(2);
ok(await peekedSlot.evaluate(el => el.classList.contains("clickable")), "the peeked card itself is clickable to dismiss");

await peekedSlot.click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const benjiTurnAfter = await benji.locator("#caboStatus").textContent();
ok(benjiTurnAfter.includes("dran"), "tapping the peeked card dismisses it and passes the turn to Benji");

const peekedSlotStillFlipped = await isi.locator("#ownHand .cabo-card-slot").nth(2).evaluate(el => el.classList.contains("flipped"));
ok(peekedSlotStillFlipped === false, "after dismissing, the peeked card flips back face-down (one-time look)");

await isi.close();
await benji.close();
await browser.close();
console.log(`\n${assertions} assertions passed (mp-test5: card-only interactions, no overlays)`);
