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
const isi = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })).newPage();
const benji = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })).newPage();

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
await benji.waitForTimeout(500);
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(600);

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
  await benji.waitForTimeout(200);
}
const handOf = async (person) => (await latest()).state.hands[person];
const status = (page) => page.locator("#caboStatus").textContent();
const eventLine = (page) => page.locator("#caboEvent").textContent();

/* ================= Swap power (11): blind swap with the opponent ================= */
await setup(s => {
  s.hands.Isi = [1, 2, 3, 4];
  s.hands.Benji = [10, 20, 30, 40].map(v => v % 13);
  s.deck.push(11);
  s.turnPerson = "Isi";
  s.turnPhase = "awaiting-draw";
});
const benjiBefore = await handOf("Benji");

await isi.locator("#drawPile").click();
await isi.waitForTimeout(300);
ok((await status(isi)).includes("Swap zu nutzen"), "drawing an 11 hints at the Swap power");
await isi.locator("#discardPile").click();
await isi.waitForTimeout(400);
ok((await status(isi)).includes("Swap:"), "putting the 11 down starts the Swap power");

/* tapping an opponent card first only nudges, nothing happens */
await isi.locator("#opponentHand .cabo-card-slot").nth(2).click();
await isi.waitForTimeout(300);
ok((await latest()).state.turnPhase === "await-swap-target", "tapping the opponent first does not swap anything");

await isi.locator("#ownHand .cabo-card-slot").nth(1).click();
await isi.waitForTimeout(200);
ok(await isi.locator("#ownHand .cabo-card-slot").nth(1).evaluate(el => el.classList.contains("selected")), "own card is marked for the swap");
ok((await status(isi)).includes("Jetzt eine Karte von Benji"), "status asks for Benji's card next");
await isi.locator("#opponentHand .cabo-card-slot").nth(2).click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(600);

const isiAfterSwap = await handOf("Isi");
const benjiAfterSwap = await handOf("Benji");
ok(isiAfterSwap[1] === benjiBefore[2] && benjiAfterSwap[2] === 2, "Isi's 2nd card and Benji's 3rd card were exchanged");
ok((await isi.locator("#ownHand .cabo-card-slot.flipped").count()) === 0, "the swap is blind: Isi's cards all stay face-down");
ok((await eventLine(benji)).includes("Isi hat deine 3. Karte mit der eigenen 2. getauscht"), `Benji is told which cards were swapped (got "${await eventLine(benji)}")`);
ok(await benji.locator("#ownHand .cabo-card-slot").nth(2).evaluate(el => el.classList.contains("just-swapped")), "Benji's affected card is highlighted");
ok((await status(benji)).includes("Du bist dran"), "turn passed to Benji");

/* ================= Swap power can be waived via the discard pile (12) ================= */
await setup(s => { s.deck.push(12); });
await benji.locator("#drawPile").click();
await benji.waitForTimeout(300);
await benji.locator("#discardPile").click();
await benji.waitForTimeout(400);
ok((await status(benji)).includes("verzichten"), "Swap via a 12 explains that it can be waived");
const handsBeforeWaive = JSON.stringify((await latest()).state.hands);
await benji.locator("#discardPile").click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(500);
ok(JSON.stringify((await latest()).state.hands) === handsBeforeWaive, "waiving the swap leaves both hands untouched");
ok((await status(isi)).includes("Du bist dran"), "turn passed to Isi after waiving");

/* ================= Several equal cards for one drawn card ================= */
await setup(s => {
  s.hands.Isi = [6, 2, 6, 6];
  s.deck.push(0);
});
await isi.locator("#drawPile").click();
await isi.waitForTimeout(300);
for (const i of [0, 2, 3]) {
  await isi.locator("#ownHand .cabo-card-slot").nth(i).click();
  await isi.waitForTimeout(150);
}
ok((await isi.locator("#ownHand .cabo-card-slot.selected").count()) === 3, "three cards can be selected at once");
ok((await status(isi)).includes("3 Karten gewählt"), "status confirms 3 selected cards and warns about the risk");

/* deselect + reselect works */
await isi.locator("#ownHand .cabo-card-slot").nth(3).click();
await isi.waitForTimeout(150);
ok((await isi.locator("#ownHand .cabo-card-slot.selected").count()) === 2, "tapping a selected card deselects it");
await isi.locator("#ownHand .cabo-card-slot").nth(3).click();
await isi.waitForTimeout(150);

await isi.locator(".cabo-drawn-preview").click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(600);

ok(JSON.stringify(await handOf("Isi")) === JSON.stringify([0, 2]), "three 6s were replaced by the drawn 0 - Isi now holds 2 cards");
ok((await isi.locator("#ownHand .cabo-card-slot").count()) === 2, "Isi's hand shows 2 cards");
ok((await benji.locator("#opponentHand .cabo-card-slot").count()) === 2, "Benji sees Isi's hand shrink to 2 cards");
ok((await eventLine(benji)).includes("Isi hat 3 gleiche Karten auf einmal abgelegt"), "Benji is told about the multi-swap");
ok((await benji.locator("#discardPile img").getAttribute("src")).includes("Karte-6"), "a 6 now lies on top of the discard pile");

/* ================= Mismatch: cards stay, drawn card is discarded, turn lost ================= */
await setup(s => {
  s.hands.Benji = [4, 9, 4, 5];
  s.deck.push(1);
});
await benji.locator("#drawPile").click();
await benji.waitForTimeout(300);
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator("#ownHand .cabo-card-slot").nth(1).click();
await benji.waitForTimeout(150);
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(600);

ok(JSON.stringify(await handOf("Benji")) === JSON.stringify([4, 9, 4, 5]), "mismatched cards stay in Benji's hand");
ok((await benji.locator("#discardPile img").getAttribute("src")).includes("Karte-1"), "the drawn 1 went onto the discard pile instead");
ok((await eventLine(benji)).includes("nicht gleich"), "Benji is told the cards did not match");
ok((await eventLine(isi)).includes("Benji hat sich vertan"), "Isi is told Benji got it wrong");
ok((await status(isi)).includes("Du bist dran"), "Benji's turn was lost, Isi is up");
ok((await benji.locator("#ownHand .cabo-card-slot.flipped").count()) === 0, "nothing was revealed by the mismatch");

/* ================= Spy belongs to the spying player's turn ================= */
await setup(s => { s.deck.push(9); });
await isi.locator("#drawPile").click();
await isi.waitForTimeout(300);
await isi.locator("#discardPile").click();
await isi.waitForTimeout(400);
await isi.locator("#opponentHand .cabo-card-slot").nth(1).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);

ok(await isi.locator("#opponentHand .cabo-card-slot").nth(1).evaluate(el => el.classList.contains("flipped")), "Isi sees the spied card");
ok((await status(benji)).includes("schaut sich deine markierte Karte an"), "Benji is told Isi is looking at one of his cards");
ok(await benji.locator("#ownHand .cabo-card-slot").nth(1).evaluate(el => el.classList.contains("watched") && !el.classList.contains("flipped")), "Benji sees which card, still face-down for him");

await isi.locator("#opponentHand .cabo-card-slot").nth(1).click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(600);
ok((await isi.locator(".cabo-card-slot.flipped").count()) === 0, "after turning it back, every card on Isi's screen is face-down");
ok((await status(benji)).includes("Du bist dran"), "turning the card back ends Isi's turn");

/* ================= Cabo can only be called once ================= */
await benji.locator(".cabo-actions button", { hasText: "Cabo rufen" }).click();
await benji.waitForTimeout(400);
await isi.waitForTimeout(600);
ok((await eventLine(isi)).includes("Benji hat Cabo gerufen"), "Isi is told Benji called Cabo");
ok((await status(isi)).includes("Dein letzter Zug"), "Isi's status says it is her last turn");
ok((await isi.locator(".cabo-actions button", { hasText: "Cabo rufen" }).count()) === 0, "no second Cabo call is offered");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);

await browser.close();
console.log(`\n${assertions} assertions passed (mp-test8: swap power, multi-swap, mismatch, spy turn, cabo once)`);
