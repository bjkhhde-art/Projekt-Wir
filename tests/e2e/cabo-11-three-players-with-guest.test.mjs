import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Cabo with three: Isi, Benji and a friend who comes in through the invite link */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
await fetch(`${API}/reset`, { method: "POST" });
const latest = async () => (await fetch(`${API}/latest`)).json();
const patchGame = (id, patch) => fetch(`${API}/games/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function member(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), name);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:9091" });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  await page.goto("http://localhost:9091/cabo.html");
  await page.waitForTimeout(400);
  return page;
}
/* a friend's phone: never unlocked, no person stored */
async function friend(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => sessionStorage.setItem("__pw_locked", "1"));
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  return page;
}

const isi = await member("Isi");
const benji = await member("Benji");
await isi.click("#grStartBtn");
await isi.waitForSelector("#grInviteLink");
const link = await isi.locator("#grInviteLink").inputValue();
ok(/\/cabo\.html\?invite=[A-Za-z0-9]{12}$/.test(link), `the lobby shows an invite link (${link})`);
await isi.click("#grCopyInvite");
await wait(200);
ok(await isi.evaluate(() => navigator.clipboard.readText()) === link, "'Kopieren' copies the invite link");
ok((await latest()).invite_code === link.split("=")[1], "the code is stored with the round");

/* the friend opens the link */
const lena = await friend("Lena");
await lena.goto(link);
await lena.waitForSelector("#grGuestName");
ok(await lena.locator("#pin-gate").count() === 0, "the friend is not asked for our password");
ok(await lena.locator(".app-nav").isHidden() && await lena.locator(".page-back").isHidden(), "the friend sees no navigation and no back arrow to the rest of the app");
ok(await lena.locator("#personModal").isHidden(), "and is not asked whether they are Isi or Benji");
ok((await lena.locator(".gr-lobby-card h2").textContent()).includes("Isi lädt dich"), "the friend is greeted with who invites");
await lena.fill("#grGuestName", "isi");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector(".gr-lobby-note");
ok((await lena.locator(".gr-lobby-note").textContent()).includes("vergeben"), "'Isi' cannot be taken as a friend's name");
await lena.fill("#grGuestName", "  Lena!! ");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector("text=Du bist dabei");
ok((await lena.locator(".gr-lobby-card h2").textContent()).includes("Lena"), "with a free name the friend is in (symbols removed)");
ok(await lena.locator("#grBeginBtn").count() === 0, "a friend cannot start the round");

await isi.waitForTimeout(700);
ok((await isi.locator(".gr-player-name").allTextContents()).join() === "Isi,Lena", "Isi sees Lena join live");
ok(await isi.locator(".gr-player-tag.guest").count() === 1, "Lena is marked as a guest");

await benji.waitForTimeout(300);
await benji.click("#grJoinBtn");
await isi.waitForTimeout(700);
ok((await isi.locator("#grBeginBtn").textContent()).includes("3 Personen"), "with Benji there are three");
await isi.click("#grBeginBtn");
await wait(900);

for (const [page, name] of [[isi, "Isi"], [benji, "Benji"], [lena, "Lena"]]) {
  ok(await page.locator("#caboBoard").isVisible() && await page.locator(".cabo-opponent").count() === 2, `${name} sees the table with two other hands`);
}
ok((await lena.locator(".cabo-opponent .cabo-player-label").allTextContents()).join() === "Benji,Isi", "the others are shown in turn order after you");
ok(await lena.locator("#leaveGameBtn").isHidden() && await isi.locator("#leaveGameBtn").isVisible(), "only Isi and Benji can end the game");
ok((await isi.locator("#caboScoreStrip span").count()) === 3, "the score strip lists all three");

/* everybody looks at their cards, then turns go Isi → Lena → Benji */
await isi.locator("#ownHand .cabo-card-slot").nth(0).click();
await lena.locator("#ownHand .cabo-card-slot").nth(0).click();
await wait(500);
ok((await isi.locator("#caboStatus").textContent()).includes("Benji"), "Isi waits for whoever has not looked yet");
await benji.locator("#ownHand .cabo-card-slot").nth(0).click();
await wait(800);
ok((await isi.locator("#caboStatus").textContent()).includes("Du bist dran"), "Isi starts");

let game = await latest();
game.state.deck.push(0);
await patchGame(game.id, { state: game.state });
await wait(500);
await isi.click("#drawPile");
await wait(400);
await isi.click("#discardPile");
await wait(800);
ok((await lena.locator("#caboStatus").textContent()).includes("Du bist dran"), "Lena (the guest) is next");

/* Lena spies on Benji's card */
game = await latest();
game.state.deck.push(9);
await patchGame(game.id, { state: game.state });
await wait(500);
await lena.click("#drawPile");
await wait(400);
await lena.click("#discardPile");
await wait(600);
ok((await lena.locator("#caboStatus").textContent()).includes("jemand anderem"), "with several others, spy asks for a card of anyone else");
await lena.locator('.cabo-opponent[data-person="Benji"] .cabo-card-slot').nth(1).click();
await wait(800);
ok((await benji.locator("#caboStatus").textContent()).includes("Lena schaut sich deine markierte Karte an"), "Benji is told his card is looked at");
ok((await isi.locator("#caboStatus").textContent()).includes("Lena schaut sich eine Karte von Benji an"), "Isi is told whose card it is");
ok((await latest()).state.lastPeekResult.targetPerson === "Benji", "the spy targets Benji");
await lena.locator('.cabo-opponent[data-person="Benji"] .cabo-card-slot').nth(1).click();
await wait(800);
ok((await benji.locator("#caboStatus").textContent()).includes("Du bist dran"), "then Benji's turn");

/* Benji swaps with Lena */
game = await latest();
game.state.deck.push(11);
await patchGame(game.id, { state: game.state });
await wait(500);
const before = (await latest()).state.hands;
await benji.click("#drawPile");
await wait(400);
await benji.click("#discardPile");
await wait(600);
await benji.locator("#ownHand .cabo-card-slot").nth(2).click();
await benji.locator('.cabo-opponent[data-person="Lena"] .cabo-card-slot').nth(3).click();
await wait(900);
const after = (await latest()).state.hands;
ok(after.Benji[2] === before.Lena[3] && after.Lena[3] === before.Benji[2] && JSON.stringify(after.Isi) === JSON.stringify(before.Isi), "Benji swapped blindly with Lena, Isi's cards untouched");
ok((await isi.locator("#caboEvent").textContent()).includes("Benji hat die eigene 3. Karte mit der 4. von Lena getauscht"), "Isi reads who swapped with whom");
ok((await lena.locator("#caboEvent").textContent()).includes("Benji hat deine 4. Karte"), "Lena reads that her card was taken");
ok((await isi.locator("#caboStatus").textContent()).includes("Du bist dran"), "and it is Isi's turn again");

/* the friend still cannot get into the app, and a wrong link shows nothing */
await lena.goto("http://localhost:9091/wir.html");
await lena.waitForSelector("#pin-gate");
ok(await lena.locator("#pin-gate").isVisible(), "other pages stay locked for the friend");
await lena.goto("http://localhost:9091/cabo.html?invite=wrongcode123");
await lena.waitForSelector(".gr-lobby-card h2");
ok((await lena.locator(".gr-lobby-card h2").textContent()).includes("gilt nicht mehr") && await lena.locator("#caboBoard").isHidden(), "an unknown invite shows nothing of the game");
await lena.goto(link);
await lena.waitForTimeout(900);
ok(await lena.locator("#caboBoard").isVisible(), "the friend's phone remembers the name and goes back to the table");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (cabo: three players with a guest)`);
