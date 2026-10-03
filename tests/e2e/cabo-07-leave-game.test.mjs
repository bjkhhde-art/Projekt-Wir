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
isi.on("pageerror", e => errors.push("isi: " + e.message));
benji.on("pageerror", e => errors.push("benji: " + e.message));

await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));

await isi.goto("http://localhost:9091/cabo.html");
await benji.goto("http://localhost:9091/cabo.html");
await isi.waitForTimeout(300);

async function startAndJoin() {
  await isi.locator("#startGameBtn").click();
  await isi.waitForTimeout(300);
  await benji.waitForTimeout(600);
  await benji.locator("#joinGameBtn").click();
  await benji.waitForTimeout(500);
  await isi.waitForTimeout(500);
}

async function dump() {
  return (await fetch("http://localhost:8991/dump")).json();
}

/* ---------- leave mid-game: needs two taps ---------- */
await startAndJoin();

const leaveBtn = isi.locator("#leaveGameBtn");
ok(await leaveBtn.isVisible(), "'Spiel beenden' is visible during an active game (even during initial peek)");
ok((await leaveBtn.textContent()).includes("Spiel beenden"), "label reads 'Spiel beenden'");

await leaveBtn.click();
await isi.waitForTimeout(200);
ok((await leaveBtn.textContent()).includes("Nochmal tippen"), "first tap only arms the button (asks to tap again)");
ok(await leaveBtn.evaluate(el => el.classList.contains("armed")), "armed state is visually highlighted");
ok(await isi.locator("#caboBoard").isVisible(), "game is NOT left after a single tap");
ok((await dump())[0].status === "active", "game row still active after a single tap");

/* armed state survives an opponent re-render */
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(500);
ok((await leaveBtn.textContent()).includes("Nochmal tippen"), "armed state survives a realtime re-render caused by the opponent");

/* armed state times out */
await isi.waitForTimeout(4200);
ok((await leaveBtn.textContent()).includes("Spiel beenden"), "armed state resets after ~4s without a second tap");

/* two quick taps -> leave */
await leaveBtn.click();
await isi.waitForTimeout(150);
await leaveBtn.click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(700);

ok((await dump())[0].status === "closed", "game row is marked closed");
ok(await isi.locator("#startGameBtn").count() === 1, "Isi is back in the lobby and can start a new game");
ok(await benji.locator("#startGameBtn").count() === 1, "Benji is moved back to the lobby live, without a reload");
const benjiNote = await benji.locator(".cabo-lobby-note").textContent().catch(() => "");
ok(benjiNote.includes("Isi hat das letzte Spiel beendet"), `Benji is told who ended the game (got "${benjiNote}")`);
ok(await isi.locator(".cabo-lobby-note").count() === 0, "Isi (who left herself) gets no such note");

/* ---------- a new game can start right after ---------- */
await startAndJoin();
ok(await isi.locator("#caboBoard").isVisible() && await benji.locator("#caboBoard").isVisible(), "a fresh game starts normally after leaving the previous one");

/* ---------- game over -> leave without confirmation ---------- */
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await isi.waitForTimeout(500);

let games = await dump();
let game = games[games.length - 1];
game.state.scores = { Isi: [60, 45], Benji: [10, 5] };
game.state.turnPerson = "Isi";
game.state.turnPhase = "awaiting-draw";
await fetch(`http://localhost:8991/games/${game.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ state: game.state })
});
await isi.waitForTimeout(500);
await benji.waitForTimeout(300);

await isi.locator(".cabo-actions button", { hasText: "Cabo rufen" }).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(600);
await benji.locator("#drawPile").click();
await benji.waitForTimeout(300);
await benji.locator("#ownHand .cabo-card-slot").nth(3).click();
await benji.locator(".cabo-drawn-preview").click();
await benji.waitForTimeout(600);
await isi.waitForTimeout(700);

ok((await isi.locator("#caboStatus").textContent()).includes("gewonnen"), "game is over (winner shown)");
ok((await benji.locator("#leaveGameBtn").textContent()).includes("Zurück zur Übersicht"), "after game over the button reads 'Zurück zur Übersicht'");

await benji.locator("#leaveGameBtn").click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(700);
ok(await benji.locator("#startGameBtn").count() === 1, "a finished game is left with a single tap, no confirmation");
ok(await isi.locator("#startGameBtn").count() === 1, "Isi also returns to the lobby");
ok(await isi.locator(".cabo-lobby-note").count() === 0, "no 'hat beendet' note when the game was already over");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);

await browser.close();
console.log(`\n${assertions} assertions passed (mp-test7: leave game)`);
