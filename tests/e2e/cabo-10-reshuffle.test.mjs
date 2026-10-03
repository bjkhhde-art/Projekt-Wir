import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Empty draw pile: empty-state look, reshuffle animation on both screens, correct counts. */
const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }

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
await isi.locator("#startGameBtn").click();
await benji.waitForTimeout(700);
await benji.locator("#joinGameBtn").click();
await benji.waitForTimeout(1800);
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(1200);

const latest = async () => (await fetch("http://localhost:8991/latest")).json();
const game = await latest();
const s = game.state;
const topBefore = s.discard[s.discard.length - 1];
s.discard = [...s.deck, ...s.discard];   // keep all 52 cards in play, just move them over
s.deck = [];
s.turnPerson = "Isi";
s.turnPhase = "awaiting-draw";
const discardBefore = s.discard.length;
await fetch(`http://localhost:8991/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: s }) });
await isi.waitForTimeout(700);
await benji.waitForTimeout(200);

/* empty state */
ok(await isi.locator("#drawPile").evaluate(el => el.classList.contains("is-empty")), "an empty draw pile is shown as an empty spot");
ok((await isi.locator("#drawPileCount").textContent()) === "leer", "its badge says 'leer'");
ok(await isi.locator("#drawPile").evaluate(el => !el.disabled), "it can still be tapped to draw");
ok((await isi.locator("#caboStatus").textContent()).includes("neu gemischt"), "the status explains that tapping it reshuffles");

/* draw -> reshuffle animation */
await isi.locator("#drawPile").click();
await isi.waitForSelector(".ga-ghost", { timeout: 2000 });
const ghostsEarly = await isi.locator(".ga-ghost").count();
ok(ghostsEarly >= 1 && ghostsEarly <= 8, `discard cards start flying onto the draw pile one after another (${ghostsEarly} in the air right away)`);
const pileRect = await isi.locator("#drawPile").boundingBox();
const ghostsOnEmptyPile = await isi.locator(".ga-ghost").evaluateAll((els, r) => els.filter(el => {
  const b = el.getBoundingClientRect();
  return Math.abs(b.left - r.x) < 2 && Math.abs(b.top - r.y) < 2;
}).length, pileRect);
ok(ghostsOnEmptyPile === 0, "no card is already sitting on the empty draw pile spot");
ok(await isi.locator("#drawPile").evaluate(el => el.classList.contains("anim-hidden")), "the new draw pile appears only when the first card lands");
await benji.waitForSelector(".ga-ghost", { timeout: 2000 });
ok(true, "Benji sees the reshuffle animation too");
await isi.waitForTimeout(500);
ok(await isi.locator("#drawPile").evaluate(el => !el.classList.contains("anim-hidden")), "the pile is visible again while it is being shuffled");
ok(await isi.locator(".cabo-drawn-preview.anim-hidden").count() === 1, "the drawn card waits until the shuffle is done");

await isi.waitForTimeout(2200);
ok(await isi.locator(".anim-hidden").count() === 0 && await isi.locator(".ga-ghost").count() === 0, "after the animation everything is visible and no flying cards remain");
ok(await benji.locator(".anim-hidden").count() === 0, "same on Benji's screen");

const after = (await latest()).state;
ok(after.deck.length === discardBefore - 2, `the new deck holds all former discards except the top card and the drawn one (${after.deck.length})`);
ok(after.discard.length === 1 && after.discard[0] === topBefore, "the old top card stays on the discard pile");
ok((await isi.locator("#drawPileCount").textContent()) === String(after.deck.length), "the badge shows the new deck size");
ok(await isi.locator("#drawPile").evaluate(el => !el.classList.contains("is-empty")), "the draw pile no longer looks empty");
const isiEvent = await isi.locator("#caboEvent").textContent();
const benjiEvent = await benji.locator("#caboEvent").textContent();
ok(isiEvent.includes("neu gemischt") && benjiEvent.includes("neu gemischt"), `both are told the pile was reshuffled ("${benjiEvent}")`);

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${assertions} assertions passed (mp-test10: empty deck reshuffle)`);
