import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Reisen, found in the test report: photos that fail to upload stay in the queue for another try,
   the others are saved; a HEIC photo the browser cannot convert is refused with a clear message */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const dump = async table => (await (await fetch(`${API}/t/${table}/dump`)).json());

await post("/t/trips/seed", { rows: [
  { id: 1, title: "Testreise", location: "Testort", start_date: "2026-08-29", end_date: "2026-09-02", cover_url: null, coordinates: null, created_at: "2026-08-01T10:00:00Z" }
] });
await post("/t/trip_images/seed", { rows: [] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  localStorage.setItem("pw_person", "Isi");
  localStorage.setItem("pw_hub_tab_reise", "erinnerungen");
});
await ctx.route(/leaflet.*\.js/, route => route.fulfill({
  contentType: "text/javascript",
  body: `(function () {
    const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? undefined : chain(), apply: () => chain() });
    window.L = chain();
  })();`
}));
await ctx.route(/leaflet.*\.css/, route => route.fulfill({ contentType: "text/css", body: "" }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/reise.html?tab=erinnerungen");
await page.waitForTimeout(800);
await page.locator(".memory-card", { hasText: "Testreise" }).click();
await page.waitForTimeout(500);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
async function choose(files) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.click("#openMemoryModal");
  await (await chooserPromise).setFiles(files);
  await wait(200);
}

/* three photos, one upload fails */
await choose([
  { name: "eins.png", mimeType: "image/png", buffer: png },
  { name: "zwei.png", mimeType: "image/png", buffer: png },
  { name: "drei.png", mimeType: "image/png", buffer: png }
]);
ok(await page.locator("#captionInput").isVisible() && await page.locator("#captionInput").evaluate(el => {
  const box = el.getBoundingClientRect();
  return document.activeElement === el && box.top >= 0 && box.bottom <= innerHeight;
}), "the chosen photos open a popup with the caption field ready – no scrolling up");
await page.screenshot({ path: process.env.SHOT_PATH || "/dev/null" }).catch(() => {});
await page.evaluate(() => { window.__mockUploadFailures = 1; });
await page.click("#uploadImageBtn");
await wait(1200);
ok((await dump("trip_images")).length === 2, "the two photos that went up are saved");
ok(await page.locator("#uploadPreviewList .upload-thumb").count() === 1 && await page.locator("#uploadQueue").isVisible(), "the failed photo stays in the queue");
ok((await page.locator(".toast").last().textContent()).includes("1 von 3"), "and the message says how many did not make it");

/* one more tap tries exactly that one again */
await page.click("#uploadImageBtn");
await wait(1000);
ok((await dump("trip_images")).length === 3 && await page.locator("#uploadQueue").isHidden(), "trying again uploads the missing photo and empties the queue");

/* a HEIC photo the browser cannot read is refused instead of saved unreadable for the other phone */
await choose([{ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("not really a picture") }]);
await page.click("#uploadImageBtn");
await wait(1000);
ok((await dump("trip_images")).length === 3, "an unreadable HEIC photo is not saved");
ok((await page.locator(".toast").last().textContent()).includes("JPG"), "and the message asks for a JPG");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
for (const table of ["trips", "trip_images"]) await post(`/t/${table}/reset`, {});
console.log(`\n${n} assertions passed (Reisen: upload retry)`);
