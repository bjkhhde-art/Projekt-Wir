import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Login, found in the test report: a session the server no longer accepts (password changed, login removed)
   brings the password back instead of empty pages – and a weak connection never signs anybody out */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const SESSION_KEY = "sb-lrzgcqoqcwicpuuuhaoj-auth-token";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];

/* the test site signs every page in; from the second page load on this phone stays signed out,
   like a real phone after supabase-js dropped the session */
async function phone(init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem("__pw_loaded")) sessionStorage.setItem("__pw_locked", "1");
    sessionStorage.setItem("__pw_loaded", "1");
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  return page;
}

/* the server says no → back to the password */
const gone = await phone(() => { window.__mockUserGone = true; });
await gone.goto("http://localhost:9091/reise.html");
await gone.waitForSelector("#pin-gate", { timeout: 5000 });
ok(await gone.locator("#pin-gate").isVisible(), "a login the server refuses shows the password again");
ok(await gone.evaluate(key => localStorage.getItem(key), SESSION_KEY) === null, "and the dead session is removed from the phone");
const lastSignOut = await gone.evaluate(() => JSON.parse(sessionStorage.getItem("__mock_last_signout") || "null"));
ok(lastSignOut && lastSignOut.scope === "local", "only this phone is signed out, never the other one");

/* a valid login stays */
const fine = await phone();
await fine.goto("http://localhost:9091/reise.html");
await fine.waitForTimeout(1200);
ok(await fine.locator("#pin-gate").count() === 0, "a valid login stays signed in");

/* offline: no check at all, nobody is thrown out */
const offline = await phone(() => {
  window.__mockUserGone = true;
  Object.defineProperty(Navigator.prototype, "onLine", { get: () => false });
});
await offline.goto("http://localhost:9091/reise.html");
await offline.waitForTimeout(1200);
ok(await offline.locator("#pin-gate").count() === 0, "offline the login is not questioned (no sign-out on a weak connection)");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (login: ended sessions)`);
