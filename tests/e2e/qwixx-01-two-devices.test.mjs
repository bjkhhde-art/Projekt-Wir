import { chromium } from "playwright";
import assert from "node:assert/strict";

const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
const API = "http://localhost:8991/t/qwixx_games";
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
await isi.goto("http://localhost:9091/qwixx.html");
await benji.goto("http://localhost:9091/qwixx.html");
await isi.waitForTimeout(400);

const latest = async () => (await fetch(`${API}/latest`)).json();
async function setup(mutate) {
  const game = await latest();
  mutate(game.state);
  await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state }) });
  await isi.waitForTimeout(500);
  await benji.waitForTimeout(100);
}
const status = page => page.locator("#qxStatus").textContent();
const cell = (page, row, index) => page.locator(".qx-row").nth(row).locator(".qx-cell").nth(index);
const lastToast = async page => (await page.locator(".toast").allTextContents()).pop() || "";
const settle = async () => { await isi.waitForTimeout(500); await benji.waitForTimeout(500); };

/* ================= lobby with block choice ================= */
ok(await isi.locator(".gr-option").count() === 4, "four blocks to choose from");
await isi.locator('.gr-option[data-option="numbers"]').click();
ok(await isi.locator('.gr-option[data-option="numbers"]').evaluate(el => el.classList.contains("selected")), "a block can be selected");
await isi.locator("#grStartBtn").click();
await benji.waitForTimeout(700);
ok((await benji.locator(".gr-lobby-card p").first().textContent()).includes("Zahlen gemixxt"), "Benji's invite names the chosen block");
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await settle();
ok(await isi.locator("#qxBoard").isVisible() && await benji.locator("#qxBoard").isVisible(), "both boards are shown");
ok((await isi.locator("#qxScore").textContent()).includes("Zahlen gemixxt"), "the score line shows the block");
let game = await latest();
ok(game.state.blockType === "numbers" && game.state.layout[0][10].n === 11, "the game uses the Zahlen gemixxt block");
ok(await isi.locator(".qx-row").count() === 4 && await isi.locator(".qx-row").first().locator(".qx-cell").count() === 11, "own block: 4 rows with 11 fields each");
ok(await isi.locator(".qx-mini-row").count() === 4, "Benji's block is shown small");

/* ================= rolling ================= */
ok(await isi.locator("#qxDice").evaluate(el => el.classList.contains("can-roll")), "Isi (host) may roll first");
ok(await benji.locator("#qxDice").evaluate(el => el.disabled), "Benji cannot roll");
ok((await status(benji)).includes("Isi würfelt"), "Benji waits for Isi's roll");
await isi.locator("#qxDice").click();
await settle();
game = await latest();
ok(game.state.phase === "white", "the roll starts the white-sum phase");
const diceOnScreen = await benji.locator("#qxDice .qx-die").evaluateAll(els => els.filter(e => !e.classList.contains("removed")).map(e => Number(e.dataset.value)));
ok(JSON.stringify(diceOnScreen) === JSON.stringify([game.state.dice.w1, game.state.dice.w2, game.state.dice.red, game.state.dice.yellow, game.state.dice.green, game.state.dice.blue]), "Benji sees exactly Isi's throw");

/* ================= both cross the white sum at the same moment ================= */
await setup(s => {
  s.blockType = "classic";
  s.layout = [
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ n, c: "red" })),
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ n, c: "yellow" })),
    [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(n => ({ n, c: "green" })),
    [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(n => ({ n, c: "blue" }))
  ];
  s.dice = { w1: 2, w2: 3, red: 1, yellow: 6, green: 4, blue: 2 };
});
ok(await isi.locator(".qx-cell.option").count() === 0 && await benji.locator(".qx-cell.option").count() === 0, "no field lights up – each player works out the fitting fields alone");
ok(await isi.locator(".qx-cell.pickable").count() === 44, "every open field can be tapped");
ok(!(await status(isi)).match(/\d/), "the status line does not give away the white sum");
await cell(isi, 0, 4).click();
await isi.waitForTimeout(300);
ok((await lastToast(isi)).includes("nicht die Summe der weißen Würfel"), "a wrong tap (red 6 on white 5) is explained by the rule");
ok(await cell(isi, 0, 4).evaluate(el => !el.classList.contains("crossed")), "and nothing gets crossed");
await Promise.all([cell(isi, 0, 3).click(), cell(benji, 1, 3).click()]);
await isi.waitForTimeout(1200);
await benji.waitForTimeout(400);
game = await latest();
ok(JSON.stringify(game.state.sheets.Isi.marks[0]) === "[3]" && JSON.stringify(game.state.sheets.Benji.marks[1]) === "[3]", "both simultaneous crosses were kept");
ok(game.state.phase === "color", "then Isi may combine colours");
ok(await isi.locator(".qx-row").nth(0).locator(".qx-cell.crossed").count() === 1, "Isi sees her cross");
ok(await isi.locator(".qx-mini-row").nth(1).locator(".qx-mini-cell.crossed").count() === 1, "Isi sees Benji's cross in his small block");

/* ================= colour combination, active player only ================= */
ok(await benji.locator(".qx-cell.pickable").count() === 0, "Benji cannot use the colour dice");
ok((await status(benji)).includes("kombiniert"), "Benji is told Isi is combining colours");
await cell(isi, 0, 1).click();
await isi.waitForTimeout(300);
ok((await lastToast(isi)).includes("Links von deinem letzten Kreuz"), "fields left of a cross are lost – the tap says why");
await cell(isi, 1, 2).click();
await isi.waitForTimeout(300);
ok((await lastToast(isi)).includes("weißen und dem gelben Würfel"), "yellow 4 does not fit white 2/3 + yellow 6 – the tap says so");
game = await latest();
ok(game.state.phase === "color" && game.state.active === "Isi" && game.state.sheets.Isi.marks[1].length === 0, "wrong taps change nothing");
await isi.locator(".qx-row").nth(1).locator(".qx-cell", { hasText: /^9$/ }).click();
await settle();
game = await latest();
ok(game.state.active === "Benji" && game.state.phase === "roll", "after the colour cross it is Benji's turn");
ok((await isi.locator("#qxEvent").textContent()).includes("Du hast die gelbe 9 angekreuzt"), "Isi's event line confirms her cross");
ok((await benji.locator("#qxEvent").textContent()).includes("Isi hat die gelbe 9 angekreuzt"), "Benji is told what Isi crossed");

/* ================= penalty ================= */
await benji.locator("#qxDice").click();
await settle();
await isi.locator(".qx-actions button", { hasText: /Nichts ankreuzen|Weiter/ }).click();
await benji.locator(".qx-actions button", { hasText: /Nichts ankreuzen|Weiter/ }).click();
await settle();
const penaltyButton = benji.locator(".qx-actions button", { hasText: "Fehlwurf" });
ok(await penaltyButton.count() === 1, "if Benji crossed nothing, the button warns about the penalty");
await penaltyButton.click();
await settle();
ok(await benji.locator(".qx-penalty.crossed").count() === 1, "Benji's first penalty box is crossed");
ok((await isi.locator("#qxOppPenalties").textContent()) === "✕", "Isi sees Benji's penalty");
ok((await isi.locator("#qxEvent").textContent()).includes("Fehlwurf für Benji"), "and is told about it");

/* ================= locking a row: the die leaves the game ================= */
await setup(s => {
  s.active = "Isi"; s.phase = "white";
  s.dice = { w1: 6, w2: 6, red: 1, yellow: 1, green: 1, blue: 1 };
  s.white = { Isi: { done: false, cross: null }, Benji: { done: false, cross: null } };
  s.sheets.Isi.marks[0] = [0, 1, 2, 3, 4];
});
await cell(benji, 0, 10).click();
await benji.waitForTimeout(300);
ok((await lastToast(benji)).includes("mindestens 5 Kreuze"), "Benji (without 5 red crosses) cannot lock red – and is told why");
await cell(isi, 0, 10).click();
await benji.waitForTimeout(500);
await benji.locator(".qx-actions button", { hasText: /Nichts ankreuzen|Weiter/ }).click();
await settle();
game = await latest();
ok(game.state.lockedRows.includes(0), "the red row is locked");
ok(await isi.locator(".qx-row").nth(0).evaluate(el => el.classList.contains("locked")) && await benji.locator(".qx-row").nth(0).evaluate(el => el.classList.contains("locked")), "both see the red row locked");
ok(await isi.locator(".qx-row").nth(0).locator(".qx-lock.crossed").count() === 1, "Isi gets the lock bonus cross");
ok(await benji.locator("#qxDice .qx-die.qx-red").evaluate(el => el.classList.contains("removed")), "the red die is out on Benji's screen");
ok((await benji.locator("#qxEvent").textContent()).includes("rote Würfel ist raus"), "Benji is told the red die is out");

/* ================= second lock ends the game ================= */
await isi.locator(".qx-actions button", { hasText: /Fertig/ }).click();
await settle();
await setup(s => {
  s.active = "Benji"; s.phase = "white";
  s.dice = { w1: 1, w2: 1, red: null, yellow: 1, green: 1, blue: 1 };
  s.white = { Isi: { done: false, cross: null }, Benji: { done: false, cross: null } };
  s.sheets.Benji.marks[3] = [0, 1, 2, 3, 4];
});
await cell(benji, 3, 10).click();
await isi.locator(".qx-actions button", { hasText: /Nichts ankreuzen|Weiter/ }).click();
await settle();
game = await latest();
ok(game.state.phase === "finished", "a second locked row ends the game");
const { scores, winner } = game.state.result;
const expected = winner === "Isi" ? "Du hast gewonnen" : winner ? `${winner} hat gewonnen` : "Unentschieden";
ok((await status(isi)).includes(expected), `Isi sees the right result (${scores.Isi.total} : ${scores.Benji.total})`);
ok(await benji.locator(".qx-result").count() === 1, "Benji sees the result table");
ok((await isi.locator(".qx-result").textContent()).includes(String(scores.Isi.total)), "the table shows Isi's total");

/* ================= rematch keeps the block ================= */
await isi.locator(".qx-actions button", { hasText: "Revanche" }).click();
await settle();
game = await latest();
ok(game.state.gameNo === 2 && game.state.phase === "roll" && game.state.active === "Benji", "rematch: game 2, Benji starts");
ok(game.state.blockType === "classic", "the block type is kept");
ok(await benji.locator("#qxDice").evaluate(el => el.classList.contains("can-roll")), "Benji may roll");

/* ================= leaving ================= */
await isi.locator("#qxLeaveBtn").click();
await isi.locator("#qxLeaveBtn").click();
await settle();
ok(await benji.locator("#grStartBtn").count() === 1 && (await benji.locator(".gr-lobby-note").textContent()).includes("Isi hat das letzte Spiel beendet"), "leaving brings both back to the lobby");

/* ================= random block: new block every game ================= */
await benji.locator('.gr-option[data-option="random"]').click();
await benji.locator("#grStartBtn").click();
await isi.waitForTimeout(700);
await isi.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await settle();
game = await latest();
const firstRandom = JSON.stringify(game.state.layout);
ok(game.state.blockType === "random", "a random block game starts");
const isiCells = await isi.locator(".qx-row").first().locator(".qx-cell").allTextContents();
ok(JSON.stringify(isiCells.map(Number)) === JSON.stringify(game.state.layout[0].map(c => c.n)), "the random block is drawn exactly as generated");
const benjiCells = await benji.locator(".qx-row").first().locator(".qx-cell").allTextContents();
ok(JSON.stringify(isiCells) === JSON.stringify(benjiCells), "both play the same random block");
await setup(s => { s.phase = "finished"; s.result = { scores: { Isi: { rows: [0, 0, 0, 0], penalties: 0, total: 0 }, Benji: { rows: [0, 0, 0, 0], penalties: 0, total: 0 } }, winner: null }; });
await benji.locator(".qx-actions button", { hasText: "neuem Zufallsblock" }).click();
await settle();
game = await latest();
ok(JSON.stringify(game.state.layout) !== firstRandom, "a rematch with the random block draws a new block");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${assertions} assertions passed (qx-test1: Qwixx two-device flow)`);
