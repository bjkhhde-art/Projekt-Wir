import { chromium } from "playwright";
import assert from "node:assert/strict";

/* 6 nimmt! with four: Isi, Benji and two friends from the invite link */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991/t/nimmt_games";
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

const isi = await phone("Isi");
const benji = await phone("Benji");
await isi.goto("http://localhost:9091/nimmt.html");
await benji.goto("http://localhost:9091/nimmt.html");
await wait(400);
ok((await isi.locator(".gr-lobby-card p").first().textContent()).includes("bis zu 4"), "the lobby says up to four can play");
await isi.click("#grStartBtn");
await isi.waitForSelector("#grInviteLink");
const link = await isi.locator("#grInviteLink").inputValue();

const guests = {};
for (const name of ["Lena", "Tom"]) {
  const page = await phone(name, true);
  await page.goto(link);
  await page.waitForSelector("#grGuestName");
  await page.fill("#grGuestName", name);
  await page.press("#grGuestName", "Enter");
  await page.waitForSelector("text=Du bist dabei");
  guests[name] = page;
}
const { Lena: lena, Tom: tom } = guests;
await benji.waitForTimeout(500);
await benji.click("#grJoinBtn");
await wait(800);
ok((await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Lena,Tom,Benji", "four in the lobby: Isi, two friends, Benji");
ok(await isi.locator(".gr-player.empty").count() === 0, "no free seat left");

/* a fifth one gets a polite no */
const fifth = await phone("Max", true);
await fifth.goto(link);
await fifth.waitForSelector(".gr-lobby-card h2");
ok((await fifth.locator(".gr-lobby-card h2").textContent()).includes("schon voll"), "a fifth person is told the round is full");

await benji.click("#grBeginBtn");
await wait(1000);
for (const [page, name] of [[isi, "Isi"], [benji, "Benji"], [lena, "Lena"], [tom, "Tom"]]) {
  ok(await page.locator("#nmBoard").isVisible() && await page.locator(".nm-player-opp").count() === 3 && await page.locator(".nm-spot").count() === 4, `${name} sees three others and four spots`);
}
ok(await isi.locator(".nm-row").count() === 4, "four rows on the table");
ok((await tom.locator(".nm-player-opp .nm-player-name").allTextContents()).join() === "Benji,Isi,Lena", "the others are listed in seat order after you");
ok(await tom.locator(".nm-hand-card").count() === 10, "everyone holds ten cards");

/* fixed cards: everything fits, so the trick resolves at once */
await setup(s => {
  s.rows = [[10], [30], [50], [70]];
  s.hands = { Isi: [11, 99], Benji: [31, 98], Lena: [51, 97], Tom: [71, 96] };
});
await isi.locator('[data-anim-key="hand-11"]').click();
await wait(500);
await lena.locator('[data-anim-key="hand-51"]').click();
await wait(700);
ok((await tom.locator("#nmStatus").textContent()).includes("Isi und Lena haben schon gewählt"), "Tom sees who has chosen already");
await benji.locator('[data-anim-key="hand-31"]').click();
await wait(700);
ok((await tom.locator("#nmStatus").textContent()).includes("Alle anderen haben schon gewählt"), "the last one is told everybody else is done");
ok((await isi.locator("#nmStatus").textContent()).includes("Warte auf Tom"), "and the others wait for Tom");
await tom.locator('[data-anim-key="hand-71"]').click();
await wait(1000);
const after = (await latest()).state;
ok(JSON.stringify(after.rows) === "[[10,11],[30,31],[50,51],[70,71]]" && after.trick === 2, "the four cards were placed together");

/* last trick: Tom has to pick a row, then the game ends with four columns */
await setup(s => {
  s.rows = [[10, 11], [30, 31], [50, 51], [70, 71]];
  s.hands = { Isi: [12], Benji: [32], Lena: [52], Tom: [5] };
  s.trick = 10;
});
for (const [page, card] of [[isi, 12], [benji, 32], [lena, 52], [tom, 5]]) {
  await page.locator(`[data-anim-key="hand-${card}"]`).click();
  await wait(500);
}
await wait(700);
ok((await isi.locator("#nmStatus").textContent()).includes("Die 5 von Tom passt in keine Reihe – Tom sucht"), "everyone sees that Tom has to pick a row");
await tom.locator(".nm-row").nth(0).click();
await wait(1200);
const end = (await latest()).state;
ok(end.phase === "finished" && end.result.bulls.Tom === 8 && end.result.winners.join() === "Isi,Lena,Benji", "Tom took the row, the other three share the win");
ok((await isi.locator("#nmStatus").textContent()).includes("Du, Lena und Benji teilen sich den Sieg"), "Isi reads that three share the win");
ok((await tom.locator("#nmStatus").textContent()).includes("Isi, Lena und Benji teilen sich den Sieg"), "Tom reads who won");
ok(await isi.locator(".nm-result thead th").count() === 5, "the result table has a column for each of the four");
ok(await lena.locator("#nmLeaveBtn").isHidden(), "friends cannot end the game for everybody");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (6 nimmt: four players with two guests)`);
