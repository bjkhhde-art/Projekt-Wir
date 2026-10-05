import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Qwixx with three: Isi, a friend from the invite link and Benji */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/qwixx_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
await fetch(`${API}/reset`, { method: "POST" });
const latest = async () => (await fetch(`${API}/latest`)).json();
async function setup(mutate) {
  const game = await latest();
  mutate(game.state);
  await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state }) });
  await wait(900);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function phone(name, guest) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(([p, g]) => g ? sessionStorage.setItem("__pw_locked", "1") : localStorage.setItem("pw_person", p), [name, guest]);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  return page;
}
const status = page => page.locator("#qxStatus").textContent();

const isi = await phone("Isi");
const benji = await phone("Benji");
await isi.goto("http://localhost:9091/qwixx.html");
await benji.goto("http://localhost:9091/qwixx.html");
await wait(400);
await isi.click("#grStartBtn");
await isi.waitForSelector("#grInviteLink");
const lena = await phone("Lena", true);
await lena.goto(await isi.locator("#grInviteLink").inputValue());
await lena.waitForSelector("#grGuestName");
ok(await lena.locator(".gr-option").count() === 0, "the friend does not choose the block");
await lena.fill("#grGuestName", "Lena");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector("text=Du bist dabei");
await benji.waitForTimeout(400);
await benji.click("#grJoinBtn");
await wait(700);
await isi.click("#grBeginBtn");
await wait(1000);

for (const [page, name] of [[isi, "Isi"], [benji, "Benji"], [lena, "Lena"]]) {
  ok(await page.locator("#qxBoard").isVisible() && await page.locator(".qx-opp-tab").count() === 2, `${name} sees two tabs for the other blocks`);
}
ok((await lena.locator(".qx-opp-tab-name").allTextContents()).join() === "Benji,Isi", "tabs follow the seat order after you");
ok((await lena.locator("#qxOppName").textContent()) === "Isi" && (await status(lena)).includes("Isi würfelt gleich"), "the block of whoever rolls is shown first");

/* everybody decides on the white sum */
await isi.click("#qxDice");
await wait(800);
await isi.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
await wait(600);
ok((await status(isi)).includes("Warte auf Lena und Benji"), "Isi waits for both others");
await lena.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
await wait(600);
ok((await status(isi)).includes("Warte auf Benji"), "then only for Benji");
await benji.locator(".qx-actions button", { hasText: "Nichts ankreuzen" }).click();
await wait(800);
ok((await status(benji)).includes("Isi kombiniert"), "then Isi may combine colours");
await isi.locator(".qx-actions button", { hasText: "Fehlwurf" }).click();
await wait(800);
ok((await status(lena)).includes("Du bist dran"), "next it is the friend's turn to roll");
ok((await benji.locator("#qxOppName").textContent()) === "Lena", "Benji's view follows to Lena's block");

/* looking at another block sticks until the turn moves on */
await benji.locator('.qx-opp-tab[data-person="Isi"]').click();
ok((await benji.locator("#qxOppName").textContent()) === "Isi" && (await benji.locator("#qxOppPenalties").textContent()) === "✕", "tapping Isi's tab shows her block with the penalty");
await lena.click("#qxDice");
await wait(900);
ok((await benji.locator("#qxOppName").textContent()) === "Isi", "it stays on Isi while Lena's turn goes on");

/* the game ends when someone has four penalties */
await setup(s => {
  s.phase = "color";
  s.white = { Isi: { done: true, cross: null }, Lena: { done: true, cross: null }, Benji: { done: true, cross: null } };
  s.sheets.Lena.penalties = 3;
  s.sheets.Isi.penalties = 0;
  s.sheets.Isi.marks[0] = [0, 1, 2];
  s.sheets.Benji.marks[0] = [0, 1, 2];
});
await lena.locator(".qx-actions button", { hasText: "Fehlwurf" }).click();
await wait(1000);
const end = (await latest()).state;
ok(end.phase === "finished" && end.result.winners.join() === "Isi,Benji", "a fourth penalty ends the game, Isi and Benji are level ahead");
ok((await isi.locator("#qxStatus").textContent()).includes("Du und Benji teilen sich den Sieg"), "Isi reads the shared win");
ok((await lena.locator("#qxStatus").textContent()).includes("Isi und Benji teilen sich den Sieg"), "Lena reads who won");
ok(await isi.locator(".qx-result thead th").count() === 4, "the result has a column per player");
ok(await lena.locator(".qx-actions button", { hasText: "Revanche" }).count() === 1, "everyone can ask for a rematch");
await lena.locator(".qx-actions button", { hasText: "Revanche" }).click();
await wait(1000);
const again = (await latest()).state;
ok(again.phase === "roll" && again.active === "Lena" && again.gameNo === 2, "the rematch is started by the next one in the round");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (qwixx: three players with a guest)`);
