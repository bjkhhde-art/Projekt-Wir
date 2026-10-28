import { chromium } from "playwright";
import assert from "node:assert/strict";
import { API_BASE, SITE } from "../support/ports.mjs";

/* Udiou and Klausi 🤖, the computer players: Isi brings them to the table in the lobby, they play
   Flip 7 on their own and are always ready for the next round */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = `${API_BASE}/t/flip7_games`;
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
await isi.goto(`${SITE}/flip7.html`);
await isi.click("#grStartBtn");
const botButton = name => isi.locator(`.gr-bot-btn[data-bot="${name}"]`);
await isi.waitForSelector(".gr-bot-btn");
ok((await isi.locator(".gr-bot-btn").allTextContents()).join("|") === "🤖 Udiou dazuholen|🤖 Klausi dazuholen", "the lobby offers two computer players: Udiou and Klausi");
ok(await isi.locator("#grBeginBtn[disabled]").count() === 1, "alone Isi cannot start yet");

await botButton("Udiou").click();
await until(async () => (await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Udiou", 4000, "Udiou joins");
ok((await isi.locator(".gr-player-tag.bot").textContent()).includes("Computer"), "Udiou is marked as the computer");
ok((await isi.locator("#grBeginBtn").textContent()).includes("2 Personen"), "Isi and Udiou can start");
ok((await botButton("Udiou").textContent()).includes("Udiou rausschicken"), "Udiou can be sent away again");
await botButton("Udiou").click();
await until(async () => (await isi.locator(".gr-player-name").allTextContents()).join() === "Isi", 4000, "Udiou leaves");
ok(true, "… and he is gone");
await botButton("Udiou").click();
await until(async () => (await latest()).state.lobby.join() === "Isi,Udiou", 4000, "Udiou back");
await botButton("Klausi").click();
await until(async () => (await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Udiou,Klausi", 4000, "Klausi joins");
ok(await isi.locator(".gr-player-tag.bot").count() === 2 && (await isi.locator("#grBeginBtn").textContent()).includes("3 Personen"), "both computer players at the table – Isi against two");

/* a friend cannot call themselves Udiou */
const lena = await phone("Lena", true);
await lena.goto(await isi.locator("#grInviteLink").inputValue());
await lena.waitForSelector("#grGuestName");
await lena.fill("#grGuestName", "udiou");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector(".gr-lobby-note");
ok((await lena.locator(".gr-lobby-note").textContent()).includes("schon vergeben"), "the name Udiou is taken for friends");
await lena.fill("#grGuestName", "Klausi");
await lena.click("#grGuestJoinBtn");
await until(async () => (await lena.locator(".gr-lobby-note").textContent()).includes("„Klausi“"), 4000, "Klausi refused");
ok(true, "… and so is Klausi");
await lena.close();

await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 4000, "started");
ok((await latest()).state.players.join() === "Isi,Udiou,Klausi", "Isi plays Flip 7 against Udiou and Klausi");

/* Udiou's turn: he decides by himself */
await patch(s => Object.assign(s, {
  phase: "play",
  dealer: 0,
  turnPerson: "Udiou",
  table: {
    Isi: { numbers: [9], mods: [], actions: [], status: "active", flip7: false, bust: null },
    Udiou: { numbers: [2], mods: [], actions: [], status: "active", flip7: false, bust: null },
    Klausi: { numbers: [4], mods: [], actions: [], status: "stayed", flip7: false, bust: null }
  },
  deck: ["n12", "n11", "n10", "n9", "n8", "n6", "n5"],
  discard: [],
  queue: [],
  flip3: null,
  choice: null,
  moveSeq: s.moveSeq + 1,
  lastMove: { type: "setup", events: [], seq: s.moveSeq + 1 }
}));
await until(async () => (await isi.locator("#f7Status").textContent()).includes("Udiou ist dran"), 4000, "Udiou's turn");
ok(await isi.locator("#f7Hit").count() === 0, "while Udiou thinks, Isi waits");
await until(async () => (await latest()).state.table.Udiou.numbers.join() === "2,5", 8000, "Udiou draws");
ok(true, "with only 2 points Udiou takes another card by himself");
await until(async () => await isi.locator("#f7Hit").count() === 1, 5000, "Isi's turn again");
ok(await isi.locator(`#f7Opps [data-card="n5"]`).count() === 1, "his new card lies in his row on Isi's phone");

/* Isi stops; Udiou plays on alone until the round is over */
await isi.click("#f7Stay");
await until(async () => (await latest()).state.phase === "round-over", 20000, "round over");
const over = (await latest()).state;
ok(over.table.Udiou.status !== "active" || over.flip7By === "Udiou", "Udiou finished his round by himself");
await until(async () => await isi.locator(".f7-summary .gr-ready-btn").count() === 1, 4000, "summary");
const readyChips = (await isi.locator(".gr-ready-chip.ready").allTextContents()).join();
ok(readyChips.includes("Udiou") && readyChips.includes("Klausi"), "Udiou and Klausi are ready for the next round right away");
await isi.locator(".f7-summary .gr-ready-btn").click();
await until(async () => (await latest()).state.round === 2, 4000, "round 2");
ok(true, "one tap of Isi starts the next round");

/* round 2: Klausi plays as well (Isi always stops when it is her turn) */
await until(async () => {
  const s = (await latest()).state;
  if (s.lastMove && s.lastMove.person === "Klausi") return true;
  if (await isi.locator("#f7Stay").count() === 1) await isi.click("#f7Stay").catch(() => {});
  else if (await isi.locator(".f7-target").count() > 0) await isi.locator(".f7-target").first().click().catch(() => {});
  return false;
}, 30000, "Klausi moves");
ok(true, "Klausi makes his own moves too");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (Udiou: lobby and Flip 7)`);
