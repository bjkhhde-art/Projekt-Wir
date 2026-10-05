import { chromium } from "playwright";
import assert from "node:assert/strict";

/* the long password replaces the PIN; unlocked phones stay unlocked */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];

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
ok(gateText.includes("Passwort") && !gateText.includes("Jahrestag") && !gateText.includes("PIN"), "it says Passwort and no longer hints at the PIN");
ok(!(await page.evaluate(() => document.documentElement.innerHTML)).includes("Benji!0501"), "the password itself is nowhere in the page");

await page.fill("#pinGateInput", "1234");
await page.click("#pinGateSubmit");
await page.waitForSelector("#pinGateError:not(.hidden)");
ok(await page.locator("#pin-gate").isVisible() && await page.evaluate(() => localStorage.getItem("pw_unlocked")) === null, "the old PIN no longer opens the app");
await page.fill("#pinGateInput", "#isi+benji!05012026");
await page.click("#pinGateSubmit");
await page.waitForTimeout(700);
ok(await page.locator("#pin-gate").count() === 1, "upper and lower case matter");

await page.click("#pinGateShow");
ok(await page.locator("#pinGateInput").getAttribute("type") === "text", "👁 shows what was typed");
await page.fill("#pinGateInput", "#Isi+Benji!05012026");
await page.press("#pinGateInput", "Enter");
await page.waitForSelector("#pin-gate", { state: "detached", timeout: 5000 });
ok(await page.evaluate(() => localStorage.getItem("pw_unlocked")) === "true", "the right password unlocks the phone");
await page.goto("http://localhost:9091/wir.html");
await page.waitForTimeout(500);
ok(await page.locator("#pin-gate").count() === 0, "and it stays unlocked on other pages");

/* a phone that was unlocked with the old PIN stays in */
const old = await lockedPage(() => {
  sessionStorage.setItem("__pw_locked", "1");
  localStorage.setItem("pw_unlocked", "true");
});
await old.goto("http://localhost:9091/index.html");
await old.waitForTimeout(600);
ok(await old.locator("#pin-gate").count() === 0 && await old.evaluate(() => document.documentElement.style.visibility) !== "hidden", "phones that are already unlocked stay unlocked");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (password gate)`);
