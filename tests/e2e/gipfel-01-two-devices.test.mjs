import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../../gipfel-engine.js");

/* Gipfelsturm on two phones: lobby, the deal with flying cards, drawing, laying out an Etappe with
   the hint, adding to a group, a Steinschlag, going out, the round summary and the next round */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/gipfel_games";
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
async function phone(person) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/gipfel.html");
  await page.waitForTimeout(700);
  return page;
}
const isi = await phone("Isi");
const benji = await phone("Benji");

/* lobby, like Cabo: up to four, friends by link, computer players */
ok(await isi.locator("#grStartBtn").count() === 1, "Gipfelsturm starts with a lobby");
ok(await isi.locator("#gsRulesList li").count() === 8, "the rules list all eight Etappen");
await isi.click("#grStartBtn");
await until(async () => await benji.locator("#grJoinBtn").count() === 1, 4000, "invite");
ok(await isi.locator("#grInviteLink").count() === 1 && await isi.locator(".gr-bot-btn").count() === 2, "friends by link, Udiou and Klausi can join");
await benji.click("#grJoinBtn");
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1, 4000, "begin");
await isi.click("#grBeginBtn");

/* the deal: nine cards each fly from the deck */
await until(async () => await isi.locator("#gsBoard:not(.hidden)").count() === 1 && await benji.locator("#gsBoard:not(.hidden)").count() === 1, 5000, "board");
const dealt = await latest();
ok(dealt.status === "active" && dealt.state.players.join() === "Isi,Benji" && dealt.state.lastMove.type === "deal", "the round starts with a deal");
await until(async () => await isi.locator(".ga-ghost").count() > 0, 3000, "flying cards");
ok(true, "cards fly from the deck while dealing");
await until(async () => await isi.locator(".anim-hidden").count() === 0 && await isi.locator(".ga-ghost").count() === 0, 8000, "deal finished");
ok(await isi.locator("#gsOwn .gs-hand .gs-card").count() === 9 && await isi.locator("#gsOpps .gs-opp-hand .gs-back").count() === 9, "nine own cards face up, Benji's nine face down");

/* a stacked table: Isi has three Paare on her hand, Benji is close to a Drilling */
const game = await latest();
const s = game.state;
Object.assign(s, {
  dealer: 1,
  turnPerson: "Isi",
  step: "draw",
  hands: {
    Isi: ["r1-0", "v1-0", "r4-0", "g4-0", "m9-0", "J-0", "v6-0", "S-0", "m10-0"],
    Benji: ["g2-0", "g2-1", "r3-0", "m3-0", "v8-0", "v8-1", "g5-0", "g6-0", "g7-0"]
  },
  deck: ["r10-0", "r10-1", "m9-1"],
  discard: ["v3-1"],
  groups: [],
  laid: { Isi: false, Benji: false },
  skip: { Isi: false, Benji: false },
  etappe: { Isi: 0, Benji: 0 },
  moveSeq: s.moveSeq + 1,
  lastMove: { type: "setup", events: [], seq: s.moveSeq + 1 }
});
await fetch(`${API}/games/${game.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ state: s, version: (game.version || 0) + 1 })
});
await until(async () => await isi.locator("#gsDrawDeck").count() === 1 && await isi.locator('#gsOwn [data-card="S-0"]').count() === 1, 5000, "stacked state on Isi's phone");
await until(async () => (await benji.locator("#gsStatus").textContent()).includes("Isi ist dran"), 5000, "Benji waits");
ok((await isi.locator("#gsStatus").textContent()).includes("Zieh vom Stapel"), "Isi is asked to draw");
ok((await isi.locator("#gsDrawDiscard").textContent()).includes("Lila 3"), "the open card can be taken too");
ok((await isi.locator(".gs-goal").textContent()).includes("Drei Paare"), "Isi sees her Etappe: Drei Paare");

/* draw from the deck: the card flies over on both phones */
await isi.click("#gsDeck");
await until(async () => (await latest()).state.step === "act", 4000, "drew");
await until(async () => await benji.locator(".ga-ghost").count() > 0, 3000, "Benji sees the card fly");
ok(true, "the drawn card flies to Isi on Benji's phone too");
await until(async () => await isi.locator('#gsOwn [data-card="m9-1"]:not(.anim-hidden)').count() === 1, 4000, "landed");
ok(await benji.locator("#gsOpps .gs-opp-hand .gs-back").count() === 10, "Benji sees Isi with ten cards");

/* the hint picks a valid Etappe; laying it out */
ok(await isi.locator("#gsLay[disabled]").count() === 1, "nothing chosen yet");
await isi.click("#gsHint");
const picked = await isi.locator("#gsOwn .gs-hand .gs-card.selected").count();
ok(picked === 6, `the hint picks six cards for Drei Paare (${picked})`);
ok(await isi.locator('#gsOwn .gs-card.selected[data-card="J-0"]').count() === 0, "without spending the Stern");
await isi.click("#gsLay");
await until(async () => (await latest()).state.laid.Isi, 4000, "laid");
await until(async () => await benji.locator("#gsOpps .gs-group").count() === 3, 4000, "Benji sees the groups");
ok((await benji.locator("#gsEvent").textContent()).includes("Isi legt Etappe 1 aus"), "Benji is told Isi laid out her Etappe");
await until(async () => await isi.locator(".anim-hidden").count() === 0 && await isi.locator(".ga-ghost").count() === 0, 5000, "lay animation done");
ok(await isi.locator("#gsOwn .gs-group").count() === 3 && await isi.locator("#gsOwn .gs-hand .gs-card").count() === 4, "three Paare in front of Isi, four cards left");

/* add the Stern to a Paar: the fitting groups light up */
await isi.locator('#gsOwn .gs-hand [data-card="J-0"]').click();
ok(await isi.locator("#gsOwn .gs-group.fits").count() === 3, "a Stern fits every group");
await isi.locator("#gsOwn .gs-group.fits").first().click();
await until(async () => (await latest()).state.hands.Isi.length === 3, 4000, "added");
await until(async () => (await benji.locator("#gsEvent").textContent()).includes("legt Stern bei sich an"), 4000, "Benji told");
ok(true, "Benji sees the Stern being added");

/* a Steinschlag: Benji sits out, Isi plays again */
await isi.locator('#gsOwn .gs-hand [data-card="S-0"]').click();
ok(await isi.locator("#gsOwn .gs-group.fits").count() === 0, "a Steinschlag fits nowhere");
await isi.click("#gsDrop");
await until(async () => (await latest()).state.lastMove.events.some(e => e.type === "skip"), 4000, "stone");
await until(async () => (await benji.locator("#gsEvent").textContent()).includes("Du setzt einmal aus"), 4000, "Benji told");
ok((await latest()).state.turnPerson === "Isi", "Benji is skipped – Isi again");

/* Isi draws again – and goes out with her last card (the hand is stacked down to one) */
await isi.click("#gsDeck");
await until(async () => (await latest()).state.step === "act", 4000, "drew again");
const now = await latest();
now.state.hands.Isi = ["v9-1"];
now.state.moveSeq += 1;
now.state.lastMove = { type: "setup", events: [], seq: now.state.moveSeq };
await fetch(`${API}/games/${now.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: now.state, version: (now.version || 0) + 1 }) });
await until(async () => await isi.locator('#gsOwn .gs-hand [data-card="v9-1"]').count() === 1 && await isi.locator("#gsOwn .gs-hand .gs-card").count() === 1, 4000, "one card left");
await isi.locator('#gsOwn .gs-hand [data-card="v9-1"]').click();
ok(await isi.locator("#gsOwn .gs-group.fits").count() === 1, "the Lila 9 only fits the 9er Paar");
await isi.locator('#gsOwn .gs-group.fits').click();
await until(async () => (await latest()).state.phase === "round-over", 4000, "round over");
const over = (await latest()).state;
ok(over.etappe.Isi === 1 && over.etappe.Benji === 0 && over.lastRound.points.Benji === 44 && over.scores.Isi === 0, "Isi climbs, Benji counts 44 points");
await until(async () => await isi.locator(".gs-summary").count() === 1 && await benji.locator(".gs-summary").count() === 1, 5000, "summary");
ok((await benji.locator("#gsEvent").textContent()).includes("Isi hat keine Karten mehr"), "Benji is told the round is over");
ok((await isi.locator(".gs-summary").textContent()).includes("+44"), "the summary shows Benji's points");
ok(await isi.locator("#gsOpps .gs-opp-hand .gs-card:not(.gs-back)").count() === 9, "Benji's cards are shown openly after the round");

/* next round: both ready */
await isi.locator(".gs-summary .gr-ready-btn").click();
await wait(600);
ok((await latest()).state.phase === "round-over", "the next round waits for both");
await benji.locator(".gs-summary .gr-ready-btn").click();
await until(async () => (await latest()).state.round === 2, 4000, "round 2");
const r2 = (await latest()).state;
ok(r2.dealer === 0 && G.countCards(r2) === 90 && r2.groups.length === 0 && r2.etappe.Isi === 1, "round 2: the deal moves on, all cards anew, Isi on Etappe 2");
await until(async () => await isi.locator(".gs-summary").count() === 0 && (await isi.locator(".gs-goal").textContent()).includes("Drilling + Dreierreihe"), 5000, "summary gone");
ok(true, "Isi now climbs Etappe 2: Drilling + Dreierreihe");

/* leaving ends it for both */
await isi.click("#gsLeaveBtn");
await isi.click("#gsLeaveBtn");
await until(async () => (await benji.locator(".gr-lobby-note").count()) === 1, 4000, "Benji sees Isi left");
ok(true, "leaving ends the game on both phones");

/* against the computer: Udiou plays his turns by himself */
await fetch(`${API}/reset`, { method: "POST" });
await isi.reload();
await isi.waitForSelector("#grStartBtn");
await isi.click("#grStartBtn");
await isi.waitForSelector('.gr-bot-btn[data-bot="Udiou"]');
await isi.click('.gr-bot-btn[data-bot="Udiou"]');
await until(async () => await isi.locator("#grBeginBtn:not([disabled])").count() === 1, 4000, "Udiou joins");
await isi.click("#grBeginBtn");
await until(async () => (await latest()).status === "active", 4000, "started with Udiou");
const start = (await latest()).state;
if (start.turnPerson === "Isi") {
  await until(async () => await isi.locator("#gsDrawDeck").count() === 1, 8000, "Isi's turn");
  await isi.click("#gsDrawDeck");
  await until(async () => await isi.locator("#gsOwn .gs-hand .gs-card.pickable").count() === 10, 4000, "Isi may act");
  const card = await isi.locator("#gsOwn .gs-hand .gs-card").last().getAttribute("data-card");
  await isi.locator(`#gsOwn .gs-hand [data-card="${card}"]`).click();
  await isi.click("#gsDrop");
}
await until(async () => {
  const st = (await latest()).state;
  return st.turnPerson === "Isi" && st.step === "draw" && st.moveSeq >= start.moveSeq + 2;
}, 15000, "Udiou plays");
const afterBot = (await latest()).state;
ok(afterBot.lastMove.person === "Udiou" && afterBot.hands.Udiou.length <= 9, "Udiou drew and discarded on his own – Isi's turn again");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (gipfel: two devices)`);
