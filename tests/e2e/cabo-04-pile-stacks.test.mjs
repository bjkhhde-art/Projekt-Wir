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

const errors = [];
isi.on("pageerror", e => errors.push(e.message));

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
await benji.waitForTimeout(600);

ok(errors.length === 0, `no JS errors (got: ${JSON.stringify(errors)})`);

/* full deck (43 cards after deal) -> draw pile should show "full" stack */
const drawStack1 = await isi.locator("#drawPile").getAttribute("data-stack");
ok(drawStack1 === "full", `draw pile shows full stack with 43 cards (got "${drawStack1}")`);

/* discard pile starts with exactly 1 card -> should show "none" (just a single card, no stack) */
const discardStack1 = await isi.locator("#discardPile").getAttribute("data-stack");
ok(discardStack1 === "none", `discard pile with 1 card shows no stack effect (got "${discardStack1}")`);

/* the draw pile's pseudo-element layers should be present (computed style check) */
const beforeDisplay = await isi.locator("#drawPile").evaluate(el => getComputedStyle(el, "::before").display);
const afterDisplay = await isi.locator("#drawPile").evaluate(el => getComputedStyle(el, "::after").display);
ok(beforeDisplay !== "none", `draw pile ::before stack layer is visible (got "${beforeDisplay}")`);
ok(afterDisplay !== "none", `draw pile ::after stack layer is visible (got "${afterDisplay}")`);

/* confirm initial peeks so we can actually play turns */
await isi.locator("#ownHand .cabo-card-slot").nth(1).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(500);

/* Isi draws from deck and discards it (a plain low card most likely, but doesn't matter) -> discard pile grows to 2 */
await isi.locator("#drawPile").click();
await isi.waitForTimeout(250);
const drawnPlain = await isi.locator(".cabo-drawn-preview img").getAttribute("src");
console.log("drawn card for discard test:", drawnPlain);

// put the drawn card down by tapping the discard pile
await isi.locator("#discardPile").click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

const discardStack2 = await benji.locator("#discardPile").getAttribute("data-stack");
ok(discardStack2 === "thin", `discard pile with 2 cards now shows a thin stack, synced to Benji's screen (got "${discardStack2}")`);

const drawStack2 = await benji.locator("#drawPile").getAttribute("data-stack");
ok(drawStack2 === "full", `draw pile still shows full stack after one card drawn (got "${drawStack2}")`);

/* the pile count badge still reflects the real number */
const countText = await benji.locator("#drawPileCount").textContent();
ok(countText === "42", `draw pile count badge shows 42 after one draw (got "${countText}")`);

await isi.close();
await benji.close();
await browser.close();
console.log(`\n${assertions} assertions passed (mp-test4: pile stack visuals)`);
