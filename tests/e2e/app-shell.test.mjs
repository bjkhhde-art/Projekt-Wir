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

/* KPI pictures are small WebP files loaded lazily */
await page.goto(base + "kpis.html"); await page.waitForTimeout(400);
const pictures = await page.locator(".flip-back img").evaluateAll(imgs => imgs.map(img => ({ src: img.getAttribute("src"), lazy: img.loading })));
ok(pictures.length === 4 && pictures.every(p => p.src.endsWith(".webp") && p.lazy === "lazy"), "all four KPI pictures are lazy WebP files");
for (const p of pictures) {
  const res = await page.request.get(base + p.src);
  ok(res.ok() && (await res.body()).length < 200 * 1024, `${p.src} loads and is under 200 KB`);
}

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

/* game invitations are sent in the switchable category with an in-app link */
await page.goto(base + "qwixx.html"); await page.waitForTimeout(600);
await page.locator("#grStartBtn").click(); await page.waitForTimeout(400);
const invites = await page.evaluate(() => window.__mockInvocations || []);
ok(invites.some(i => i.body.category === "games" && i.body.url === "qwixx.html" && i.body.excludePerson === "Isi"), "a Qwixx invitation goes out as a games notification linking to qwixx.html");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (app shell: manifest, icons, photos, notification settings)`);
