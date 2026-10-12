import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Grog 🤖, the computer player: Isi brings him to the table in the lobby, he plays Flip 7 on his own
   and is always ready for the next round */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/flip7_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
await fetch(`${API}/reset`, { method: "POST" });
const latest = async () => (await fetch(`${API}/latest`)).json();
async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}
async function patch(change) {
  const game = await latest();
  const state = change(game.state);
  await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, version: (game.version || 0) + 1 }) });
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

const isi = await phone("Isi");
await isi.goto("http://localhost:9091/flip7.html");
await isi.click("#grStartBtn");
await isi.waitForSelector("#grBotBtn");
ok((await isi.locator("#grBotBtn").textContent()).includes("Grog als Mitspieler dazuholen"), "the lobby offers Grog as a player");
ok(await isi.locator("#grBeginBtn[disabled]").count() === 1, "alone Isi cannot start yet");

await isi.click("#grBotBtn");
await until(async () => (await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Grog", 4000, "Grog joins");
ok((await isi.locator(".gr-player-tag.bot").textContent()).includes("Computer"), "Grog is marked as the computer");
ok((await isi.locator("#grBeginBtn").textContent()).includes("2 Personen"), "Isi and Grog can start");
ok((await isi.locator("#grBotBtn").textContent()).includes("rausschicken"), "Grog can be sent away again");
await isi.click("#grBotBtn");
await until(async () => (await isi.locator(".gr-player-name").allTextContents()).join() === "Isi", 4000, "Grog leaves");
ok(true, "… and he is gone");
await isi.click("#grBotBtn");
await until(async () => (await latest()).state.lobby.join() === "Isi,Grog", 4000, "Grog back");

/* a friend cannot call themselves Grog */
const lena = await phone("Lena", true);
await lena.goto(await isi.locator("#grInviteLink").inputValue());
await lena.waitForSelector("#grGuestName");
await lena.fill("#grGuestName", "grog");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector(".gr-lobby-note");
ok((await lena.locator(".gr-lobby-note").textContent()).includes("schon vergeben"), "the name Grog is taken for friends");
await lena.close();

await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 4000, "started");
ok((await latest()).state.players.join() === "Isi,Grog", "Isi plays Flip 7 against Grog");

/* Grog's turn: he decides by himself */
await patch(s => Object.assign(s, {
  phase: "play",
  dealer: 0,
  turnPerson: "Grog",
  table: {
    Isi: { numbers: [9], mods: [], actions: [], status: "active", flip7: false, bust: null },
    Grog: { numbers: [2], mods: [], actions: [], status: "active", flip7: false, bust: null }
  },
  deck: ["n12", "n11", "n10", "n9", "n8", "n6", "n5"],
  discard: [],
  queue: [],
  flip3: null,
  choice: null,
  moveSeq: s.moveSeq + 1,
  lastMove: { type: "setup", events: [], seq: s.moveSeq + 1 }
}));
await until(async () => (await isi.locator("#f7Status").textContent()).includes("Grog ist dran"), 4000, "Grog's turn");
ok(await isi.locator("#f7Hit").count() === 0, "while Grog thinks, Isi waits");
await until(async () => (await latest()).state.table.Grog.numbers.join() === "2,5", 8000, "Grog draws");
ok(true, "with only 2 points Grog takes another card by himself");
await until(async () => await isi.locator("#f7Hit").count() === 1, 5000, "Isi's turn again");
ok(await isi.locator(`#f7Opps [data-card="n5"]`).count() === 1, "his new card lies in his row on Isi's phone");

/* Isi stops; Grog plays on alone until the round is over */
await isi.click("#f7Stay");
await until(async () => (await latest()).state.phase === "round-over", 20000, "round over");
const over = (await latest()).state;
ok(over.table.Grog.status !== "active" || over.flip7By === "Grog", "Grog finished his round by himself");
await until(async () => await isi.locator(".f7-summary .gr-ready-btn").count() === 1, 4000, "summary");
ok((await isi.locator(".gr-ready-chip.ready").allTextContents()).join().includes("Grog"), "Grog is ready for the next round right away");
await isi.locator(".f7-summary .gr-ready-btn").click();
await until(async () => (await latest()).state.round === 2, 4000, "round 2");
ok(true, "one tap of Isi starts the next round");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Grog: lobby and Flip 7)`);
