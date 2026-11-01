import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../../gipfel-engine.js");

/* Phasenjagd on two phones: lobby, the deal with flying cards, drawing, laying out a Phase field by
   field, adding to a group, a Steinschlag, going out, the round summary and the next round */
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
ok(await isi.locator("#grStartBtn").count() === 1, "Phasenjagd starts with a lobby");
ok(await isi.locator("#gsRulesList li").count() === 10, "the rules list all ten Phasen");
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
/* the open Blau 3 only exists in the stacked state – the real deal may also have given Isi the S-0 */
await until(async () => (await isi.locator("#gsDeck").getAttribute("class")).includes("can-draw") && await isi.locator('#gsOwn [data-card="S-0"]').count() === 1 && await isi.locator('#gsDiscard [data-card="v3-1"]').count() === 1, 5000, "stacked state on Isi's phone");
await until(async () => (await benji.locator("#gsStatus").textContent()).includes("Isi ist dran"), 5000, "Benji waits");
ok((await isi.locator("#gsStatus").textContent()).includes("Du bist dran"), "Isi is asked to draw");
ok((await isi.locator("#gsDiscard").getAttribute("class")).includes("can-draw") && await isi.locator("#gsActions button").count() === 0, "drawing is a tap on the deck or the open card – no buttons");
ok((await isi.locator("#gsOwn .gs-seat-etappe").textContent()).includes("Drei Paare"), "Isi sees her Phase: Drei Paare");

/* draw from the deck: the card flies over on both phones */
await isi.click("#gsDeck");
await until(async () => (await latest()).state.step === "act", 4000, "drew");
await until(async () => await benji.locator(".ga-ghost").count() > 0, 3000, "Benji sees the card fly");
ok(true, "the drawn card flies to Isi on Benji's phone too");
await until(async () => await isi.locator('#gsOwn [data-card="m9-1"]:not(.anim-hidden)').count() === 1, 4000, "landed");
ok(await benji.locator("#gsOpps .gs-opp-hand .gs-back").count() === 10, "Benji sees Isi with ten cards");

/* no hints: Isi chooses the cards herself and taps her laying area */
ok(await isi.locator("#gsHint").count() === 0, "the game gives no hints");
ok(await isi.locator('#gsOwn .gs-card.fresh[data-card="m9-1"]').count() === 1, "the card Isi just drew is marked as new");
const zone = isi.locator("#gsLayZone");
ok((await zone.textContent()).includes("Paar + Paar + Paar") && !(await zone.getAttribute("class")).includes("open"), "the laying area shows what the Phase needs");
for (const c of ["r1-0", "v1-0", "r4-0", "m10-0", "m9-0", "m9-1"]) await isi.locator(`#gsOwn .gs-hand [data-card="${c}"]`).click();
ok((await zone.getAttribute("class")).includes("open") && (await zone.textContent()).includes("6 Karten"), "with cards chosen, the laying area can be tapped");
await zone.click();
await wait(800);
ok(!(await latest()).state.laid.Isi && await isi.locator(".toast").filter({ hasText: "klappt" }).count() >= 1, "4 and 10 are no Paar: the Phase is not laid out, Isi is told so");
await isi.locator("#gsDiscard").click();
await wait(500);
ok((await latest()).state.hands.Isi.length === 10 && await isi.locator(".toast").filter({ hasText: "genau eine Karte" }).count() >= 1, "nothing is thrown away with several cards chosen");
/* the choice stays after the failed try: Isi only swaps the 10 for the second 4 */
ok(await isi.locator("#gsOwn .gs-hand .gs-card.selected").count() === 6, "the chosen cards stay chosen after a failed try");
await isi.locator('#gsOwn .gs-hand [data-card="m10-0"]').click();
await isi.locator('#gsOwn .gs-hand [data-card="g4-0"]').click();
await zone.click();
await until(async () => (await latest()).state.laid.Isi, 4000, "laid");
await until(async () => await benji.locator("#gsOpps .gs-group").count() === 3, 4000, "Benji sees the groups");
ok((await benji.locator("#gsEvent").textContent()).includes("Isi legt Phase 1 aus"), "Benji is told Isi laid out her Phase");
await until(async () => await isi.locator(".anim-hidden").count() === 0 && await isi.locator(".ga-ghost").count() === 0, 5000, "lay animation done");
ok(await isi.locator("#gsOwn .gs-group").count() === 3 && await isi.locator("#gsOwn .gs-hand .gs-card").count() === 4, "three Paare in front of Isi, four cards left");

/* adding: choose a card, tap a group – only the tap checks whether the card fits */
await isi.locator('#gsOwn .gs-hand [data-card="J-0"]').click();
ok(await isi.locator("#gsOwn .gs-group.target").count() === 3, "with a card chosen, all groups can be tapped");
await isi.locator("#gsOwn .gs-group.target").first().click();
await until(async () => (await latest()).state.hands.Isi.length === 3, 4000, "added");
await until(async () => (await benji.locator("#gsEvent").textContent()).includes("legt Stern bei sich an"), 4000, "Benji told");
ok(true, "Benji sees the Stern being added");

/* a Steinschlag fits nowhere: the tap is refused, then Isi throws it on the discard – Benji sits out, Isi plays again */
await isi.locator('#gsOwn .gs-hand [data-card="S-0"]').click();
await isi.locator("#gsOwn .gs-group.target").first().click();
await wait(600);
ok((await latest()).state.hands.Isi.length === 3 && await isi.locator(".toast").filter({ hasText: "passt nicht" }).count() >= 1, "the Steinschlag does not fit – Isi is told so");
ok((await isi.locator("#gsDiscard").getAttribute("class")).includes("can-drop"), "the discard pile waits for the chosen card");
await isi.locator("#gsDiscard").click();
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
await isi.locator("#gsOwn .gs-group.target").filter({ hasText: "× 9" }).click();
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
ok(r2.dealer === 0 && G.countCards(r2) === 90 && r2.groups.length === 0 && r2.etappe.Isi === 1, "round 2: the deal moves on, all cards anew, Isi on Phase 2");
await until(async () => await isi.locator(".gs-summary").count() === 0 && (await isi.locator("#gsOwn .gs-seat-etappe").textContent()).includes("Drilling + Dreierreihe"), 5000, "summary gone");
ok(true, "Isi now climbs Phase 2: Drilling + Dreierreihe");

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
  await until(async () => (await isi.locator("#gsDeck").getAttribute("class")).includes("can-draw"), 8000, "Isi's turn");
  await isi.click("#gsDeck");
  await until(async () => await isi.locator("#gsOwn .gs-hand .gs-card.pickable").count() === 10, 4000, "Isi may act");
  /* a number card – a Steinschlag would make Udiou sit out */
  const card = await isi.locator("#gsOwn .gs-hand .gs-card:not(.gs-stone):not(.gs-joker)").first().getAttribute("data-card");
  await isi.locator(`#gsOwn .gs-hand [data-card="${card}"]`).click();
  await isi.click("#gsDiscard");
}
await until(async () => {
  const st = (await latest()).state;
  return st.turnPerson === "Isi" && st.step === "draw" && st.lastMove.person === "Udiou";
}, 15000, "Udiou plays");
const afterBot = (await latest()).state;
ok(afterBot.lastMove.person === "Udiou" && afterBot.hands.Udiou.length <= 9, "Udiou drew and discarded on his own – Isi's turn again");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (gipfel: two devices)`);
