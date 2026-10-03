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

await isi.locator("#startGameBtn").click();
await isi.waitForTimeout(300);
await benji.waitForTimeout(600);
await benji.locator("#joinGameBtn").click();
await benji.waitForTimeout(500);

/* ---------- no modal overlays should exist anymore ---------- */
ok(await isi.locator("#initialPeekOverlay").count() === 0, "initialPeekOverlay element no longer exists in the DOM");
ok(await isi.locator("#peekResultOverlay").count() === 0, "peekResultOverlay element no longer exists in the DOM");

/* ---------- initial peek now flips the LEFT two cards (index 0,1) in place ---------- */
const isiOwnSlots = isi.locator("#ownHand .cabo-card-slot");
ok(await isiOwnSlots.count() === 4, "Isi has 4 own card slots");

const slot0Flipped = await isiOwnSlots.nth(0).evaluate(el => el.classList.contains("flipped"));
const slot1Flipped = await isiOwnSlots.nth(1).evaluate(el => el.classList.contains("flipped"));
const slot2Flipped = await isiOwnSlots.nth(2).evaluate(el => el.classList.contains("flipped"));
const slot3Flipped = await isiOwnSlots.nth(3).evaluate(el => el.classList.contains("flipped"));

ok(slot0Flipped === true, "left card (slot 0) is flipped face-up during initial peek");
ok(slot1Flipped === true, "second-from-left card (slot 1) is flipped face-up during initial peek");
ok(slot2Flipped === false, "third card (slot 2) stays face-down during initial peek");
ok(slot3Flipped === false, "rightmost card (slot 3) stays face-down during initial peek");

/* the front face should show a real card image, not the cover */
const slot0FrontImg = await isiOwnSlots.nth(0).locator(".cabo-flip-face-front img").getAttribute("src");
ok(slot0FrontImg.includes("Karte-"), `flipped slot's front face shows an actual card image (got "${slot0FrontImg}")`);

/* confirming is done by tapping a flipped card directly, not a button */
const initialPeekStatus = await isi.locator("#caboStatus").textContent();
ok(initialPeekStatus.includes("tippe"), `status instructs Isi to tap a card to confirm (got "${initialPeekStatus}")`);

/* Benji's opponent-view of Isi should show nothing flipped (still all face down) */
const benjiOppSlots = benji.locator("#opponentHand .cabo-card-slot");
const benjiSeesIsiFlipped = await benjiOppSlots.evaluateAll(els => els.some(el => el.classList.contains("flipped")));
ok(benjiSeesIsiFlipped === false, "Benji cannot see Isi's initial-peek cards flipped on his own screen");

/* confirm both */
await isiOwnSlots.nth(1).click();
await isi.waitForTimeout(300);

/* after confirming, all cards flip back face-down -- initial peek is a one-time look only */
const slot0FlippedAfter = await isiOwnSlots.nth(0).evaluate(el => el.classList.contains("flipped"));
const slot1FlippedAfter = await isiOwnSlots.nth(1).evaluate(el => el.classList.contains("flipped"));
ok(slot0FlippedAfter === false, "after confirming, slot 0 flips back face-down (no persistent memory aid)");
ok(slot1FlippedAfter === false, "after confirming, slot 1 flips back face-down too");

await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(500);

/* ---------- force a 7 for Isi -> in-place own-card flip, not an overlay ---------- */
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

let game = await getLatestGame();
let state = game.state;
state.deck.push(7);
await patchGame(game.id, { state });
await isi.waitForTimeout(400);

await isi.locator("#drawPile").click();
await isi.waitForTimeout(250);
await isi.locator("#discardPile").click();
await isi.waitForTimeout(350);

/* pick own slot 2 (currently face-down) to peek */
await isiOwnSlots.nth(2).click();
await isi.waitForTimeout(350);

const slot2NowFlipped = await isiOwnSlots.nth(2).evaluate(el => el.classList.contains("flipped"));
ok(slot2NowFlipped === true, "peeking at own slot 2 flips it in place (no overlay)");
const slot2Peeking = await isiOwnSlots.nth(2).evaluate(el => el.classList.contains("peeking"));
ok(slot2Peeking === true, "the freshly peeked slot gets the transient 'peeking' highlight");

ok(await isi.locator("#peekResultOverlay").count() === 0, "still no overlay element appeared for the peek result");
const dismissStatusText = await isi.locator("#caboStatus").textContent();
ok(dismissStatusText.includes("nochmal an"), `status instructs to tap the card again instead of a modal button (got "${dismissStatusText}")`);

/* Benji should NOT see Isi's slot 2 flipped */
const benjiSeesSlot2 = await benjiOppSlots.nth(2).evaluate(el => el.classList.contains("flipped"));
ok(benjiSeesSlot2 === false, "Benji's screen does not show Isi's newly-peeked card flipped");

/* dismiss by tapping the card again -> flips back face-down, one-time look like the round start */
await isiOwnSlots.nth(2).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const slot2AfterDismiss = await isiOwnSlots.nth(2).evaluate(el => el.classList.contains("flipped"));
ok(slot2AfterDismiss === false, "after dismissing, slot 2 flips back face-down (no persistent memory aid)");
const slot2PeekingAfter = await isiOwnSlots.nth(2).evaluate(el => el.classList.contains("peeking"));
ok(slot2PeekingAfter === false, "the transient amber 'peeking' highlight is gone after dismissing");
const anyOwnFlipped = await isiOwnSlots.evaluateAll(els => els.some(el => el.classList.contains("flipped")));
ok(anyOwnFlipped === false, "all 4 own cards are face-down again after the peek");

/* ---------- force a 9 for Benji -> in-place SPY flip on Isi's card, visible only to Benji ---------- */
game = await getLatestGame();
state = game.state;
state.deck.push(9);
await patchGame(game.id, { state });
await benji.waitForTimeout(400);

await benji.locator("#drawPile").click();
await benji.waitForTimeout(250);
await benji.locator("#discardPile").click();
await benji.waitForTimeout(350);

await benjiOppSlots.nth(3).click();
await benji.waitForTimeout(350);

const benjiSeesIsiSlot3Flipped = await benjiOppSlots.nth(3).evaluate(el => el.classList.contains("flipped"));
ok(benjiSeesIsiSlot3Flipped === true, "Benji's spy target (Isi's slot 3) flips in place on Benji's screen");

/* Isi's own view of her own slot 3 must NOT show the spy reveal (she doesn't know Benji spied) */
const isiSeesOwnSlot3 = await isiOwnSlots.nth(3).evaluate(el => el.classList.contains("flipped"));
ok(isiSeesOwnSlot3 === false, "Isi's own screen does not reveal that Benji spied on her slot 3");

await benjiOppSlots.nth(3).click();
await benji.waitForTimeout(400);

const benjiSeesIsiSlot3AfterDismiss = await benjiOppSlots.nth(3).evaluate(el => el.classList.contains("flipped"));
ok(benjiSeesIsiSlot3AfterDismiss === false, "after dismissing a spy result, the opponent's card flips back face-down (not persistently known)");

console.log(`\n${assertions} assertions passed (mp-test3: card-flip rendering)`);
await browser.close();
