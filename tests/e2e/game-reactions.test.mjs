import { chromium } from "playwright";
import assert from "node:assert/strict";

/* emoji reactions in the games: live for everybody at the table, never stored */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const GAMES = `${API}/t/nimmt_games`;
const wait = ms => new Promise(r => setTimeout(r, ms));
await fetch(`${GAMES}/reset`, { method: "POST" });
const latest = async () => (await fetch(`${GAMES}/latest`)).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function phone(name, guest) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(([p, g]) => g ? sessionStorage.setItem("__pw_locked", "1") : localStorage.setItem("pw_person", p), [name, guest]);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(name + ": " + e.message));
  page.on("dialog", d => { errors.push(name + ": dialog " + d.message()); d.dismiss(); });
  return page;
}

const isi = await phone("Isi");
const benji = await phone("Benji");
await isi.goto("http://localhost:9091/nimmt.html");
await benji.goto("http://localhost:9091/nimmt.html");
await wait(400);
ok(await isi.locator("#grReactBtn").isHidden(), "no emoji button in the lobby");
await isi.click("#grStartBtn");
await isi.waitForSelector("#grInviteLink");
const lena = await phone("Lena", true);
await lena.goto(await isi.locator("#grInviteLink").inputValue());
await lena.waitForSelector("#grGuestName");
await lena.fill("#grGuestName", "Lena");
await lena.click("#grGuestJoinBtn");
await lena.waitForSelector("text=Du bist dabei");
await benji.waitForTimeout(400);
await benji.click("#grJoinBtn");
await wait(700);
await isi.click("#grBeginBtn");
await wait(1200);

ok(await isi.locator("#grReactBtn").isVisible() && await lena.locator("#grReactBtn").isVisible(), "at the table everybody has the 😊 button, friends too");
await isi.click("#grReactBtn");
ok(await isi.locator(".gr-react-emoji").count() === 10, "it opens ten emojis");
ok((await isi.locator(".gr-react-emoji").allTextContents()).join("").includes("😂😭"), "laughing and crying are there");
await isi.click('.gr-react-emoji[data-emoji="😂"]');
ok(await isi.locator("#grReactTray").isHidden(), "the row closes after sending");
ok((await isi.locator(".gr-reaction").first().textContent()).includes("😂") && (await isi.locator(".gr-reaction-name").first().textContent()) === "Du", "Isi sees her own 😂 marked 'Du'");
await benji.waitForSelector(".gr-reaction", { timeout: 3000 });
ok((await benji.locator(".gr-reaction").first().textContent()).includes("😂Isi"), "Benji sees Isi's 😂 with her name");
await lena.waitForSelector(".gr-reaction", { timeout: 3000 });
ok((await lena.locator(".gr-reaction-name").first().textContent()) === "Isi", "the friend sees it too");

/* friends can answer */
await lena.click("#grReactBtn");
await lena.click('.gr-react-emoji[data-emoji="😭"]');
await isi.waitForFunction(() => [...document.querySelectorAll(".gr-reaction")].some(b => b.textContent.includes("😭Lena")), null, { timeout: 3000 });
ok(true, "Isi sees Lena's 😭");

/* no flooding: a second tap right away is ignored */
await wait(2800);
await benji.click("#grReactBtn");
await benji.click('.gr-react-emoji[data-emoji="🔥"]');
await benji.click("#grReactBtn");
await benji.click('.gr-react-emoji[data-emoji="🔥"]');
ok(await benji.locator(".gr-reaction").count() === 1, "two taps in a row send one emoji");
await wait(2900);
ok(await benji.locator(".gr-reaction").count() === 0, "emojis disappear again after a moment");

/* anything that is not one of our emojis is never shown */
const id = (await latest()).id;
const channel = `nimmt_games-reactions-${id}`;
const sendRaw = payload => fetch(`${API}/rt/broadcast/${channel}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "reaction", payload, sender: "Mallory" }) });
await sendRaw({ from: "x", emoji: "<img src=x onerror=alert(1)>" });
await sendRaw({ from: "<b>Hacker</b>", emoji: "👏" });
await wait(1200);
ok(await isi.locator(".gr-reaction img").count() === 0 && await isi.locator(".gr-reaction b").count() === 0, "foreign HTML in a reaction is never rendered");
ok((await isi.locator(".gr-reaction-name").allTextContents()).includes("<b>Hacker</b>"), "a strange name is shown as plain text");
ok(!(await isi.locator(".gr-reaction-emoji").allTextContents()).some(t => t.includes("img")), "unknown 'emojis' are dropped");

/* nothing about reactions is stored with the game */
ok(!JSON.stringify((await latest()).state).includes("😂"), "reactions are not saved in the game");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (games: emoji reactions)`);
