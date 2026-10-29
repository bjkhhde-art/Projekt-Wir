import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(page.url() + ": " + e.message));
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const base = "http://localhost:9091/";

/* web app manifest + icons */
const manifestRes = await page.request.get(base + "manifest.webmanifest");
ok(manifestRes.ok(), "the manifest is served");
const manifest = await manifestRes.json();
ok(manifest.display === "standalone" && manifest.start_url && manifest.name === "Projekt Wir", "the manifest opens the app full screen");
ok(manifest.icons.some(i => i.purpose === "maskable") && manifest.icons.some(i => i.sizes === "512x512"), "the manifest has a 512 px and a maskable icon");
for (const icon of [...manifest.icons.map(i => i.src), "icons/apple-touch-icon.png"]) {
  ok((await page.request.get(base + icon)).ok(), `icon ${icon} exists`);
}
const pages = readdirSync(new URL("../../", import.meta.url)).filter(f => f.endsWith(".html"));
for (const file of pages) {
  const html = await (await page.request.get(base + file)).text();
  ok(html.includes('rel="manifest"') && html.includes('href="icons/apple-touch-icon.png"'), `${file} links manifest and home-screen icon`);
}

/* the KPIs carry no photos any more */
await page.goto(base + "kpis.html"); await page.waitForTimeout(400);
ok(await page.locator("main img").count() === 0, "the KPI page loads no pictures");

/* uploads are shrunk before they leave the phone */
const shrunk = await page.evaluate(async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 4000; canvas.height = 3000;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `hsl(${i % 360} 80% 50%)`; ctx.fillRect(Math.random() * 4000, Math.random() * 3000, 60, 60); }
  const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.98));
  const original = new File([blob], "IMG_0001.JPEG", { type: "image/jpeg" });
  const small = await shrinkImageForUpload(original);
  const bmp = await createImageBitmap(small);
  return { before: original.size, after: small.size, w: bmp.width, h: bmp.height, name: small.name };
});
ok(shrunk.w === 1600 && shrunk.h === 1200 && shrunk.after < shrunk.before, `a 4000×3000 photo is scaled to 1600×1200 before upload (${Math.round(shrunk.before / 1024)} KB → ${Math.round(shrunk.after / 1024)} KB)`);

/* game notifications can be switched off */
await page.goto(base + "einstellungen.html"); await page.waitForTimeout(500);
const gamesSwitch = page.locator('.settings-switch[data-field="games_enabled"]');
ok(await gamesSwitch.count() === 1 && await gamesSwitch.getAttribute("aria-checked") === "true", "settings show a Spiele switch, on by default");
const unnamed = await page.locator(".settings-switch:not([aria-label])").count();
ok(unnamed === 0, "every notification switch has an accessible name");
await gamesSwitch.click(); await page.waitForTimeout(300);
const upserts = await page.evaluate(() => window.__mockUpserts || []);
ok(upserts.some(u => u.table === "notification_settings" && u.payload.person === "Isi" && u.payload.games_enabled === false), "turning it off saves games_enabled = false for Isi");
ok(await gamesSwitch.getAttribute("aria-checked") === "false", "the switch shows off");

/* light / dark mode can be picked per device and holds on every page */
const surfaceBg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
await page.emulateMedia({ colorScheme: "light" });
ok(await page.locator('.theme-option[data-theme-option="system"]').getAttribute("aria-checked") === "true", "the appearance setting starts on System");
await page.click('.theme-option[data-theme-option="dark"]');
ok(await surfaceBg() === "#191220" && await page.locator('.theme-option[data-theme-option="dark"]').getAttribute("aria-checked") === "true", "picking Dunkel turns the page dark although the phone is light");
await page.goto(base + "index.html"); await page.waitForTimeout(300);
ok(await surfaceBg() === "#191220" && await page.locator('meta[name="theme-color"]').first().getAttribute("content") === "#191220", "the dark choice holds on other pages, status bar included");
await page.emulateMedia({ colorScheme: "dark" });
await page.goto(base + "einstellungen.html"); await page.waitForTimeout(300);
await page.click('.theme-option[data-theme-option="light"]');
ok(await surfaceBg() === "#fdf5f9", "picking Hell keeps the page light although the phone is dark");
await page.click('.theme-option[data-theme-option="system"]');
ok(await surfaceBg() === "#191220" && await page.evaluate(() => localStorage.getItem("pw_theme")) === null, "System follows the phone again");
await page.emulateMedia({ colorScheme: "light" });
const unthemed = [];
for (const file of pages.filter(f => !["404.html", "offline.html"].includes(f))) {
  const html = await (await page.request.get(base + file)).text();
  if (!html.includes('<script src="theme.js"></script>')) unthemed.push(file);
}
ok(unthemed.length === 0, "every app page loads theme.js: " + unthemed.join(", "));

/* installable app: shortcuts, offline page, an install button in the settings */
ok(["Spiele", "Reise", "Wir", "Mochi"].every(name => manifest.shortcuts.some(s => s.name === name)), "holding the app icon offers Spiele, Reise, Wir and Mochi");
const offlinePage = await page.request.get(base + "offline.html");
ok(offlinePage.ok() && (await offlinePage.text()).includes("Gerade keine Verbindung"), "a friendly offline page exists");
ok(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length)) === 0, "in tests the service worker stays off, the mocked network rules");
ok(await page.locator("#installCard").isVisible() && await page.locator("#installSteps").isVisible() && await page.locator("#installBtn").isHidden(), "without the browser's install dialog the settings explain the menu steps");
await page.evaluate(() => {
  const event = new Event("beforeinstallprompt");
  event.prompt = () => { window.__installPrompted = true; };
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(event);
});
await page.waitForTimeout(100);
ok(await page.locator("#installBtn").isVisible() && await page.locator("#installSteps").isHidden(), "when the browser offers it, an 'App installieren' button appears");
await page.click("#installBtn");
await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__installPrompted === true), "the button opens the browser's install dialog");
ok(await page.locator("#installBtn").isHidden(), "the dialog can be offered once – then the button goes away");

/* game invitations are sent in the switchable category with an in-app link */
await page.goto(base + "qwixx.html"); await page.waitForTimeout(600);
await page.locator("#grStartBtn").click(); await page.waitForTimeout(400);
const invites = await page.evaluate(() => window.__mockInvocations || []);
ok(invites.some(i => i.body.category === "games" && i.body.url === "qwixx.html" && i.body.excludePerson === "Isi"), "a Qwixx invitation goes out as a games notification linking to qwixx.html");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (app shell: manifest, icons, photos, notification settings)`);
