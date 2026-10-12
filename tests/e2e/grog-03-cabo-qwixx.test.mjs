import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Benji alone against Grog: Cabo (Grog looks at his cards and plays whole turns) and Qwixx
   (Grog decides on the white sum and rolls when it is his turn) */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
const benji = await ctx.newPage();
benji.on("pageerror", e => errors.push("Benji: " + e.message));

async function startAgainstGrog(page, file, table) {
  const API = `http://localhost:8991/t/${table}`;
  await fetch(`${API}/reset`, { method: "POST" });
  await page.goto(`http://localhost:9091/${file}`);
  await page.click("#grStartBtn");
  await page.waitForSelector("#grBotBtn");
  await page.click("#grBotBtn");
  await page.waitForSelector("#grBeginBtn:not([disabled])");
  await page.click("#grBeginBtn");
  const latest = async () => (await fetch(`${API}/latest`)).json();
  await until(async () => (await latest()).status === "active", 4000, "started " + file);
  return latest;
}

/* ---------- Cabo ---------- */
{
  const latest = await startAgainstGrog(benji, "cabo.html", "cabo_games");
  ok((await latest()).state.players.join() === "Benji,Grog", "Cabo: Benji against Grog");
  await until(async () => (await latest()).state.initialPeekDone.Grog === true, 5000, "Grog peeks");
  const peeked = (await latest()).state;
  ok(Object.keys(peeked.botMemory.Grog.own).join() === "0,1", "Grog looks at his two start cards by himself – and remembers only those");
  await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
  await until(async () => (await benji.locator("#caboStatus").textContent()).includes("Du bist dran"), 4000, "Benji starts");

  /* Benji draws a 1 and throws it away – then Grog plays a whole turn */
  const game = await latest();
  game.state.deck.push(1);
  await fetch(`http://localhost:8991/t/cabo_games/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state, version: (game.version || 0) + 1 }) });
  await wait(700);
  await benji.click("#drawPile");
  await until(async () => (await latest()).state.drawnCard === 1, 4000, "drawn");
  await benji.click("#discardPile");
  await until(async () => (await latest()).state.turnPerson === "Grog", 4000, "Grog's turn");
  ok((await benji.locator("#caboStatus").textContent()).includes("Grog"), "Benji's phone says it is Grog's turn");
  await until(async () => (await latest()).state.turnPerson === "Benji", 15000, "back to Benji");
  const after = (await latest()).state;
  ok(after.turnPhase === "awaiting-draw" && after.moveSeq > game.state.moveSeq + 2, "Grog drew, decided and handed the turn back on his own");
  await until(async () => (await benji.locator("#caboStatus").textContent()).includes("Du bist dran"), 4000, "Benji again");
  ok(true, "then it is Benji's turn again");
  await benji.click("#leaveGameBtn");
  await benji.click("#leaveGameBtn");
  await until(async () => (await latest()).status === "closed", 4000, "closed");
}

/* ---------- Qwixx ---------- */
{
  const latest = await startAgainstGrog(benji, "qwixx.html", "qwixx_games");
  ok((await latest()).state.players.join() === "Benji,Grog", "Qwixx: Benji against Grog");
  await benji.click("#qxDice");
  await until(async () => (await latest()).state.white.Grog.done === true, 8000, "Grog decides");
  ok(true, "Grog decides on the white sum by himself");
  await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
  await until(async () => (await latest()).state.phase === "color", 4000, "color phase");
  await benji.locator(".qx-actions button", { hasText: "Fehlwurf" }).click();
  await until(async () => (await latest()).state.active === "Grog", 4000, "Grog's turn");
  ok((await benji.locator("#qxStatus").textContent()).includes("Grog"), "Benji's phone says Grog rolls next");
  await until(async () => (await latest()).state.rollNo === 2, 8000, "Grog rolls");
  ok((await latest()).state.lastMove.person === "Grog", "Grog rolls the dice himself");
  await until(async () => await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).count() === 1, 4000, "Benji's white choice");
  await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
  await until(async () => {
    const s = (await latest()).state;
    return s.active === "Benji" && s.phase === "roll";
  }, 20000, "Grog's whole turn");
  ok(true, "Grog rolled, waited for Benji's choice, decided and passed the dice on");
}

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Grog: Cabo and Qwixx)`);
