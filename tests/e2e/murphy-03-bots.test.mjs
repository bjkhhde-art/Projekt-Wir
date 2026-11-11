import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Murphys Gesetz with Udiou and Klausi: the lobby with the win setting, the computer players trade on their own,
   Isi plays a few turns from the deck, and a whole game to one Murphy card ends without errors */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/murphy_games";
const wait = ms => new Promise(r => setTimeout(r, ms));
const latest = async () => (await fetch(`${API}/latest`)).json();
await fetch(`${API}/reset`, { method: "POST" });
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const isi = await ctx.newPage();
isi.on("pageerror", e => errors.push(e.message));
isi.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
await isi.goto("http://localhost:9091/murphy.html");

/* lobby: win after one Murphy card, two computer players */
await until(async () => await isi.locator('.gr-option[data-option="1"]').count() === 1, 5000, "options");
await isi.locator('.gr-option[data-option="1"]').click();
await isi.click("#grStartBtn");
await isi.waitForSelector(".gr-bot-btn");
await isi.locator('.gr-bot-btn[data-bot="Udiou"]').click();
await until(async () => await isi.locator('.gr-bot-btn[data-bot="Klausi"]').count() === 1, 4000, "klausi button");
await isi.locator('.gr-bot-btn[data-bot="Klausi"]').click();
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1 && ((await latest()).state.lobby || []).length === 3, 5000, "three in the lobby");
await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 5000, "started");
const first = (await latest()).state;
ok(first.players.length === 3 && first.rules.winCards === 1, "a game with Isi, Udiou and Klausi, to one Murphy card");

/* play until the game is over: Isi draws one card from the deck and gives two (or the drawn and one) */
let isiTurns = 0;
let botMoves = 0;
const end = Date.now() + 150000;
let lastSeq = -1;
while (Date.now() < end) {
  const row = await latest();
  const st = row.state;
  if (st.phase === "finished") break;
  if (st.moveSeq !== lastSeq) {
    if (st.lastMove && st.lastMove.person && st.lastMove.person !== "Isi") botMoves++;
    lastSeq = st.moveSeq;
  }
  if (st.phase === "round-over") {
    if (!(st.readyNext || []).includes("Isi")) {
      await isi.locator(".gr-ready-btn").click().catch(() => {});
    }
    await wait(500);
    continue;
  }
  if (st.turnPerson === "Isi" && st.step === "take" && await isi.locator("#mgDeck.can-take").count()) {
    await isi.click("#mgDeck");
    await until(async () => { const s = (await latest()).state; return s.step !== "take" || s.turnPerson !== "Isi"; }, 5000, "Isi drew");
    const s = (await latest()).state;
    if (s.turnPerson === "Isi" && s.step === "give") {
      if (s.trade.taken === 1 && s.hands.Isi.filter(c => /^[byg]\d+-\d+$/.test(c)).length < 3) {
        await isi.click("#mgDeck");
        await until(async () => (await latest()).state.trade?.taken === 2 || (await latest()).state.turnPerson !== "Isi", 5000, "second card");
      }
      const now = (await latest()).state;
      if (now.turnPerson === "Isi" && now.step === "give") {
        const give = now.hands.Isi.filter(c => /^[byg]\d+-\d+$/.test(c)).slice(0, now.trade.give);
        await until(async () => await isi.locator(`#mgOwn [data-card="${give[0]}"]`).count() === 1, 4000, "card visible");
        for (const c of give) await isi.locator(`#mgOwn [data-card="${c}"]`).click();
        await isi.locator(".mg-drop-left").click();
        await until(async () => (await latest()).state.turnPerson !== "Isi" || (await latest()).state.phase !== "play", 5000, "Isi gave");
      }
    } else if (s.turnPerson === "Isi" && s.step === "target") {
      await isi.locator(".mg-target-pick").first().click();
    }
    isiTurns++;
    continue;
  }
  if (st.turnPerson === "Isi" && st.step === "target" && await isi.locator(".mg-target-pick").count()) {
    await isi.locator(".mg-target-pick").first().click();
    await wait(400);
    continue;
  }
  await wait(300);
}
const done = (await latest()).state;
ok(botMoves > 4 && isiTurns > 0, `Udiou and Klausi moved on their own (${botMoves} moves), Isi played ${isiTurns} turns`);
ok(done.phase === "finished" && done.result && done.players.includes(done.result.winner), `the game ended with a winner (${done.result && done.result.winner})`);
ok(errors.length === 0, "no page or console errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (murphy: with computer players)`);
