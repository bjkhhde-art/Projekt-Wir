import { chromium } from "playwright";
import assert from "node:assert/strict";

/* the lock is a real login to the shared Supabase account: only the server knows the password */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const SESSION_KEY = "sb-lrzgcqoqcwicpuuuhaoj-auth-token";
/* the fake backend's password (tests/support/supabase-mock.js) – the real one is in no file */
const TEST_PASSWORD = "test-passwort";

async function lockedPage(init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(init || (() => sessionStorage.setItem("__pw_locked", "1")));
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  return page;
}

const page = await lockedPage();
await page.goto("http://localhost:9091/index.html");
await page.waitForSelector("#pin-gate");
ok(await page.locator("#pinGateInput").getAttribute("type") === "password", "the lock asks for a password (hidden while typing)");
const gateText = await page.locator("#pin-gate").textContent();
ok(gateText.includes("Passwort") && !gateText.includes("PIN"), "it says Passwort");

const lockSource = await (await fetch("http://localhost:9091/pin-lock.js")).text();
ok(!/PASSWORD_HASH|PASSWORD_SALT|PBKDF2/.test(lockSource), "no password hash is shipped with the site any more");

await page.fill("#pinGateInput", "falsch");
await page.click("#pinGateSubmit");
await page.waitForSelector("#pinGateError:not(.hidden)");
ok((await page.locator("#pinGateError").textContent()).includes("Falsches Passwort"), "a wrong password is refused");
ok(await page.locator("#pin-gate").isVisible() && await page.evaluate(key => localStorage.getItem(key), SESSION_KEY) === null, "and the phone stays signed out");
const signIns = await page.evaluate(() => window.__mockSignIns);
ok(signIns.length === 1 && signIns[0].email === "projekt-wir@example.com", "the password is checked by the server for the shared login");

await page.evaluate(() => { window.__mockAuthOffline = true; });
await page.fill("#pinGateInput", TEST_PASSWORD);
await page.click("#pinGateSubmit");
await page.waitForFunction(() => document.querySelector("#pinGateError").textContent.includes("Verbindung"));
ok(await page.locator("#pin-gate").isVisible(), "without internet it says so instead of claiming a wrong password");
await page.evaluate(() => { window.__mockAuthOffline = false; });

await page.click("#pinGateShow");
ok(await page.locator("#pinGateInput").getAttribute("type") === "text", "👁 shows what was typed");
await page.fill("#pinGateInput", TEST_PASSWORD);
await page.press("#pinGateInput", "Enter");
await page.waitForLoadState("load");
await page.waitForTimeout(500);
ok(await page.locator("#pin-gate").count() === 0, "the right password signs the phone in (page reloads with the data)");
ok(await page.evaluate(key => Boolean(localStorage.getItem(key)), SESSION_KEY), "the session is kept on the phone");
await page.goto("http://localhost:9091/wir.html");
await page.waitForTimeout(500);
ok(await page.locator("#pin-gate").count() === 0, "and it stays unlocked on other pages");

/* a phone unlocked by the old, purely local lock has no login – it asks once more */
const old = await lockedPage(() => {
  sessionStorage.setItem("__pw_locked", "1");
  localStorage.setItem("pw_unlocked", "true");
});
await old.goto("http://localhost:9091/index.html");
await old.waitForSelector("#pin-gate");
ok(true, "phones unlocked by the old local lock have to sign in once");

/* the games overview can sign in too */
const games = await lockedPage();
await games.goto("http://localhost:9091/games.html");
await games.waitForSelector("#pin-gate");
await games.fill("#pinGateInput", TEST_PASSWORD);
await games.click("#pinGateSubmit");
await games.waitForLoadState("load");
await games.waitForTimeout(500);
ok(await games.locator("#pin-gate").count() === 0, "signing in works on the games page as well");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (password gate)`);
