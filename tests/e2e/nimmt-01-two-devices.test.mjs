import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../nimmt-engine.js");

const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
const API = "http://localhost:8991/t/nimmt_games";
let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }

await fetch(`${API}/reset`, { method: "POST" });
const browser = await chromium.launch({ executablePath: BROWSER_PATH });
const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const isi = await (await ctx()).newPage();
const benji = await (await ctx()).newPage();
const errors = [];
isi.on("pageerror", e => errors.push("isi: " + e.message));
benji.on("pageerror", e => errors.push("benji: " + e.message));
await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
await isi.goto("http://localhost:9091/nimmt.html");
await benji.goto("http://localhost:9091/nimmt.html");
await isi.waitForTimeout(300);

const latest = async () => (await fetch(`${API}/latest`)).json();
async function setup(mutate) {
  const game = await latest();
  mutate(game.state);
  await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state }) });
  await isi.waitForTimeout(500);
  await benji.waitForTimeout(100);
}
const handCard = (page, card) => page.locator(`[data-anim-key="hand-${card}"]`);
const status = page => page.locator("#nmStatus").textContent();
const rowsOnScreen = page => page.locator(".nm-row").evaluateAll(rows => rows.map(r =>
  [...r.querySelectorAll(".nm-cell .nm-card-num")].map(n => Number(n.textContent))));

/* ================= lobby ================= */
ok(await isi.locator("#grStartBtn").count() === 1, "empty lobby offers to start a game");
await isi.locator("#grStartBtn").click();
await benji.waitForTimeout(700);
ok((await benji.locator(".gr-lobby-card h2").textContent()).includes("Isi lädt dich ein"), "Benji sees Isi's invite live");
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(500);
ok(await isi.locator("#nmBoard").isVisible() && await benji.locator("#nmBoard").isVisible(), "both boards are shown after joining");
ok(await isi.locator(".nm-row").count() === 4, "four rows on the table");
ok(await isi.locator(".nm-hand-card").count() === 10 && await benji.locator(".nm-hand-card").count() === 10, "each player holds 10 cards");
ok((await isi.locator("#nmOppHand").textContent()).includes("10 Karten"), "Isi sees how many cards Benji holds");
ok(await isi.locator("#nmHand .nm-card-num").count() === 10 && await isi.locator("#nmOppHand .nm-card-num").count() === 0, "only your own card values are shown");

/* ================= choosing secretly ================= */
let game = await latest();
const isiFirst = game.state.hands.Isi[0];
const benjiFirst = game.state.hands.Benji[9];
await handCard(isi, isiFirst).click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(500);
ok(await isi.locator("#nmSpotOwn .nm-card-num").textContent() === String(isiFirst), "Isi's chosen card lies face-up in front of her");
ok(await isi.locator(".nm-hand-card").count() === 9, "and leaves her hand");
ok(await benji.locator("#nmSpotOpp .nm-card-back").count() === 1, "Benji only sees a face-down card");
ok(await benji.locator("#nmSpotOpp .nm-card-num").count() === 0, "Benji cannot see its value");
ok((await status(benji)).includes("Isi hat schon gewählt"), "Benji is told Isi has chosen");

await isi.locator("#nmSpotOwn").click();
await isi.waitForTimeout(400);
await benji.waitForTimeout(500);
ok(await isi.locator(".nm-hand-card").count() === 10, "tapping the laid card takes it back");
ok(await benji.locator("#nmSpotOpp .nm-card-back").count() === 0, "Benji sees the card being taken back");

await handCard(isi, isiFirst).click();
await isi.waitForTimeout(300);
await handCard(benji, benjiFirst).click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(600);

game = await latest();
const expectedRows = game.state.rows;
ok(game.state.trick === 2 || game.state.phase === "pick-row", "both chose: the trick is resolved");
if (game.state.phase === "choose") {
  ok(JSON.stringify(await rowsOnScreen(isi)) === JSON.stringify(expectedRows), "Isi's table matches the game state");
  ok(JSON.stringify(await rowsOnScreen(benji)) === JSON.stringify(expectedRows), "Benji's table matches the game state");
}

/* ================= truly simultaneous taps: no choice gets lost ================= */
await setup(s => {
  s.phase = "choose"; s.revealed = null; s.pickPerson = null; s.currentTrick = null;
  s.rows = [[10], [20], [40]];
  s.hands = { Isi: [41, 42, 43], Benji: [44, 45, 46] };
  s.chosen = { Isi: null, Benji: null };
});
await Promise.all([handCard(isi, 41).click(), handCard(benji, 44).click()]);
await isi.waitForTimeout(1200);
await benji.waitForTimeout(400);
game = await latest();
ok(!game.state.hands.Isi.includes(41) && !game.state.hands.Benji.includes(44), "both simultaneous choices were kept (version guard retried the slower one)");
ok(JSON.stringify(game.state.rows[2]) === "[40,41,44]", `both cards landed in the right row (${JSON.stringify(game.state.rows[2])})`);

/* ================= rule 4: too low -> pick a row ================= */
await setup(s => {
  s.phase = "choose"; s.revealed = null; s.pickPerson = null; s.currentTrick = null;
  s.rows = [[50], [60, 61], [70, 75]];
  s.hands = { Isi: [3, 99], Benji: [90, 98] };
  s.chosen = { Isi: null, Benji: null };
  s.penalties = { Isi: [], Benji: [] };
});
await handCard(isi, 3).click();
await isi.waitForTimeout(300);
await handCard(benji, 90).click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(600);
ok((await status(isi)).includes("Deine 3 passt in keine Reihe"), "Isi is asked to pick a row");
ok(await isi.locator(".nm-row.pickable").count() === 3, "all three rows can be tapped by Isi");
ok(await benji.locator(".nm-row.pickable").count() === 0, "Benji cannot pick a row");
ok((await status(benji)).includes("Isi sucht sich eine Reihe aus"), "Benji waits for Isi");
ok(await benji.locator("#nmSpotOpp .nm-card-num").textContent() === "3" && await benji.locator("#nmSpotOwn .nm-card-num").textContent() === "90", "both revealed cards are shown face-up to Benji");
ok(await handCard(benji, 98).evaluate(el => el.disabled), "Benji cannot play while Isi picks");

await isi.locator(".nm-row").nth(2).click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(600);
game = await latest();
ok(JSON.stringify(game.state.penalties.Isi) === "[70,75]", "Isi took the row she tapped");
ok((await isi.locator("#nmOwnPile").textContent()).includes(String(E.sumBulls([70, 75]))), "Isi's bull counter shows the new total");
ok((await benji.locator("#nmOppPile").textContent()).includes(String(E.sumBulls([70, 75]))), "Benji sees Isi's bulls too");
ok((await benji.locator("#nmEvent").textContent()).includes("Isi hat mit der 3 eine Reihe genommen"), "Benji is told what happened");
ok(JSON.stringify(await rowsOnScreen(benji)) === JSON.stringify(game.state.rows), "Benji's table shows the 3 starting the row and the 90 placed");

/* ================= rule 3: sixth card takes the row ================= */
await setup(s => {
  s.rows = [[10, 11, 12, 13, 14], [60], [70]];
  s.hands = { Isi: [99, 1], Benji: [15, 2] };
  s.chosen = { Isi: null, Benji: null };
  s.penalties = { Isi: [], Benji: [] };
});
await handCard(isi, 99).click();
await isi.waitForTimeout(300);
await handCard(benji, 15).click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(600);
game = await latest();
ok(JSON.stringify(game.state.penalties.Benji) === "[10,11,12,13,14]", "the sixth card made Benji take the full row");
ok((await isi.locator("#nmEvent").textContent()).includes("Benji hat mit der 15 die volle Reihe genommen"), "Isi is told Benji took the full row");

/* ================= last trick -> result, rematch ================= */
await handCard(isi, 1).click();
await isi.waitForTimeout(300);
await handCard(benji, 2).click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(600);
game = await latest();
if (game.state.phase === "pick-row") {
  const picker = game.state.pickPerson === "Isi" ? isi : benji;
  await picker.locator(".nm-row").nth(0).click();
  await isi.waitForTimeout(700);
  await benji.waitForTimeout(300);
  game = await latest();
}
ok(game.state.phase === "finished", "after the last card the game is over");
const { bulls, winner } = game.state.result;
const expectedText = winner === "Isi" ? "Du hast gewonnen" : winner ? `${winner} hat gewonnen` : "Unentschieden";
ok((await status(isi)).includes(expectedText), `Isi sees the right result ("${await status(isi)}", bulls ${JSON.stringify(bulls)})`);
ok(await isi.locator(".nm-result").count() === 1 && await benji.locator(".nm-result").count() === 1, "both see the result table inline");
ok(await benji.locator(".nm-actions button", { hasText: "Revanche" }).count() === 1, "a rematch is offered");
ok((await isi.locator("#nmLeaveBtn").textContent()).includes("Zurück zur Übersicht"), "leaving after the game needs no confirmation");

const winsBefore = game.state.wins;
await benji.locator(".nm-actions button", { hasText: "Revanche" }).click();
await benji.waitForTimeout(500);
await isi.waitForTimeout(600);
game = await latest();
ok(game.state.gameNo === 2 && game.state.phase === "choose", "the rematch starts game 2 right away");
ok(await isi.locator(".nm-hand-card").count() === 10 && await benji.locator(".nm-hand-card").count() === 10, "fresh hands for both");
ok(JSON.stringify(game.state.wins) === JSON.stringify(winsBefore), "the win tally is kept");
ok((await isi.locator("#nmScore").textContent()).includes("Partie 2"), "the score line shows game 2");

/* ================= leaving ================= */
await isi.locator("#nmLeaveBtn").click();
await isi.waitForTimeout(150);
ok((await isi.locator("#nmLeaveBtn").textContent()).includes("Nochmal tippen"), "leaving a running game needs a second tap");
await isi.locator("#nmLeaveBtn").click();
await isi.waitForTimeout(500);
await benji.waitForTimeout(700);
ok(await benji.locator("#grStartBtn").count() === 1, "Benji is moved back to the lobby live");
ok((await benji.locator(".gr-lobby-note").textContent()).includes("Isi hat das letzte Spiel beendet"), "and told who ended it");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${assertions} assertions passed (nm-test1: 6 nimmt! two-device flow)`);
