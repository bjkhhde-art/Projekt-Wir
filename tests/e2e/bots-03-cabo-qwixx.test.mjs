import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Benji alone against Udiou: Cabo (Udiou looks at his cards and plays whole turns) and Qwixx
   (Udiou decides on the white sum and rolls when it is his turn) */
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

async function startAgainstUdiou(page, file, table) {
  const API = `http://localhost:8991/t/${table}`;
  await fetch(`${API}/reset`, { method: "POST" });
  await page.goto(`http://localhost:9091/${file}`);
  await page.click("#grStartBtn");
  await page.waitForSelector(".gr-bot-btn");
  await page.click('.gr-bot-btn[data-bot="Udiou"]');
  await page.waitForSelector("#grBeginBtn:not([disabled])");
  await page.click("#grBeginBtn");
  const latest = async () => (await fetch(`${API}/latest`)).json();
  await until(async () => (await latest()).status === "active", 4000, "started " + file);
  return latest;
}

/* ---------- Cabo ---------- */
{
  const latest = await startAgainstUdiou(benji, "cabo.html", "cabo_games");
  ok((await latest()).state.players.join() === "Benji,Udiou", "Cabo: Benji against Udiou");
  await until(async () => (await latest()).state.initialPeekDone.Udiou === true, 5000, "Udiou peeks");
  const peeked = (await latest()).state;
  ok(Object.keys(peeked.botMemory.Udiou.own).join() === "0,1", "Udiou looks at his two start cards by himself – and remembers only those");
  await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
  await until(async () => (await benji.locator("#caboStatus").textContent()).includes("Du bist dran"), 4000, "Benji starts");

  /* Benji draws a 1 and throws it away – then Udiou plays a whole turn */
  const game = await latest();
  game.state.deck.push(1);
  await fetch(`http://localhost:8991/t/cabo_games/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state, version: (game.version || 0) + 1 }) });
  await wait(700);
  await benji.click("#drawPile");
  await until(async () => (await latest()).state.drawnCard === 1, 4000, "drawn");
  await benji.click("#discardPile");
  await until(async () => (await latest()).state.turnPerson === "Udiou", 4000, "Udiou's turn");
  ok((await benji.locator("#caboStatus").textContent()).includes("Udiou"), "Benji's phone says it is Udiou's turn");
  await until(async () => (await latest()).state.turnPerson === "Benji", 15000, "back to Benji");
  const after = (await latest()).state;
  ok(after.turnPhase === "awaiting-draw" && after.moveSeq > game.state.moveSeq + 2, "Udiou drew, decided and handed the turn back on his own");
  await until(async () => (await benji.locator("#caboStatus").textContent()).includes("Du bist dran"), 4000, "Benji again");
  ok(true, "then it is Benji's turn again");
  await benji.click("#leaveGameBtn");
  await benji.click("#leaveGameBtn");
  await until(async () => (await latest()).status === "closed", 4000, "closed");
}

/* ---------- Qwixx ---------- */
{
  const latest = await startAgainstUdiou(benji, "qwixx.html", "qwixx_games");
  ok((await latest()).state.players.join() === "Benji,Udiou", "Qwixx: Benji against Udiou");
  await benji.click("#qxDice");
  await until(async () => (await latest()).state.white.Udiou.done === true, 8000, "Udiou decides");
  ok(true, "Udiou decides on the white sum by himself");
  await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
  await until(async () => (await latest()).state.phase === "color", 4000, "color phase");
  await benji.locator(".qx-actions button", { hasText: "Fehlwurf" }).click();
  await until(async () => (await latest()).state.active === "Udiou", 4000, "Udiou's turn");
  ok((await benji.locator("#qxStatus").textContent()).includes("Udiou"), "Benji's phone says Udiou rolls next");
  await until(async () => (await latest()).state.rollNo === 2, 8000, "Udiou rolls");
  ok((await latest()).state.lastMove.person === "Udiou", "Udiou rolls the dice himself");
  await until(async () => await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).count() === 1, 4000, "Benji's white choice");
  await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
  await until(async () => {
    const s = (await latest()).state;
    return s.active === "Benji" && s.phase === "roll";
  }, 20000, "Udiou's whole turn");
  ok(true, "Udiou rolled, waited for Benji's choice, decided and passed the dice on");
}

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Udiou: Cabo and Qwixx)`);
