import { chromium } from "playwright";
import assert from "node:assert/strict";

/* trip gallery: tap opens a photo, holding it opens the edit menu, one "+" button adds photos,
   upcoming trips count down */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const dump = async table => (await (await fetch(`${API}/t/${table}/dump`)).json());

function isoDay(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const picture = "/icons/icon-512.png";
await post("/t/trips/seed", { rows: [
  { id: 1, title: "Alicante", location: "Alicante", start_date: "2026-08-29", end_date: "2026-09-02", cover_url: picture + "?cover", coordinates: null, created_at: "2026-08-01T10:00:00Z" },
  { id: 2, title: "Hamburg", location: "Hamburg", start_date: isoDay(12), end_date: isoDay(16), cover_url: null, coordinates: null, created_at: "2026-09-01T10:00:00Z" }
] });
await post("/t/trip_images/seed", { rows: [
  { id: 11, trip_id: 1, image_url: picture + "?a", caption: "Castello Santa Barbara", created_at: "2026-08-30T10:00:00Z" },
  { id: 12, trip_id: 1, image_url: picture + "?b", caption: "Blick aufs Wasser", created_at: "2026-08-30T11:00:00Z" },
  { id: 13, trip_id: 1, image_url: picture + "?c", caption: "", created_at: "2026-08-30T12:00:00Z" }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false });
await ctx.addInitScript(() => {
  localStorage.setItem("pw_person", "Isi");
  localStorage.setItem("pw_hub_tab_reise", "erinnerungen");
});
/* the map library comes from a CDN; a tiny stand-in keeps the page working offline */
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

/* countdown chip in the overview */
const chip = await page.locator(".memory-card", { hasText: "Hamburg" }).locator(".future-badge").textContent();
ok(chip === "⏳ in 12 Tagen", `upcoming trips show a countdown chip (${chip})`);
ok(await page.locator(".memory-card", { hasText: "Alicante" }).locator(".future-badge").count() === 0, "past trips have no countdown");
ok(await page.locator("#openMemoryModal").getAttribute("aria-label") === "Neue Erinnerung", "in the overview + creates a new trip");

/* open the past trip */
await page.locator(".memory-card", { hasText: "Alicante" }).click();
await page.waitForTimeout(500);
ok(await page.locator(".image-card").count() === 3, "the trip shows its three photos");
ok(await page.locator("#imageGrid .icon-action, #imageGrid button").count() === 0, "no delete or edit buttons sit on the photos any more");
ok(await page.locator("#dropzone").count() === 0, "the big upload field is gone");
ok(await page.locator("#openMemoryModal").isVisible() && await page.locator("#openMemoryModal").getAttribute("aria-label") === "Bilder hinzufügen", "inside a trip the + button adds photos");
ok(await page.locator("#tripCountdown").evaluate(el => el.classList.contains("hidden")), "a past trip has no countdown");
ok(await page.locator(".image-card").nth(2).locator(".image-caption").count() === 0, "photos without caption show no placeholder text");

/* tap opens the photo */
await page.locator(".image-card").first().click();
await page.waitForTimeout(200);
ok(!(await page.locator("#imageLightbox").evaluate(el => el.classList.contains("hidden"))), "a tap opens the photo big");
ok(await page.locator("#imageSheet").evaluate(el => el.classList.contains("hidden")), "a tap does not open the edit menu");
await page.click("#closeLightbox");

async function holdOn(locator, ms = 700) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.down();
  await wait(ms);
  await page.mouse.up();
  await wait(150);
}

/* a short press that turns into scrolling does nothing */
const firstBox = await page.locator(".image-card").first().boundingBox();
await page.mouse.move(firstBox.x + 40, firstBox.y + 40);
await page.mouse.down();
await page.mouse.move(firstBox.x + 40, firstBox.y + 90, { steps: 5 });
await wait(700);
await page.mouse.up();
await wait(150);
ok(await page.locator("#imageSheet").evaluate(el => el.classList.contains("hidden")), "moving the finger (scrolling) cancels the long press");
if (!(await page.locator("#imageLightbox").evaluate(el => el.classList.contains("hidden")))) await page.click("#closeLightbox");

/* hold → edit caption */
await holdOn(page.locator(".image-card").nth(2));
ok(!(await page.locator("#imageSheet").evaluate(el => el.classList.contains("hidden"))), "holding a photo opens the edit menu");
ok(await page.locator("#imageLightbox").evaluate(el => el.classList.contains("hidden")), "holding does not also open the photo");
await page.click("#sheetEditCaption");
await page.fill("#sheetCaptionInput", "Wassserrrr 💧");
await page.click("#sheetSaveCaption");
await wait(500);
ok((await dump("trip_images")).find(i => i.id === 13).caption === "Wassserrrr 💧", "the new caption is saved");
ok((await page.locator(".image-card").nth(2).locator(".image-caption").textContent()) === "Wassserrrr 💧", "and shown under the photo");

/* hold → set as cover */
await holdOn(page.locator(".image-card").nth(1));
ok(await page.locator("#sheetSetCover").isVisible(), "the menu offers to use the photo as cover");
await page.click("#sheetSetCover");
await wait(400);
ok((await dump("trips")).find(t => t.id === 1).cover_url === picture + "?b", "the trip cover is updated");
ok((await page.locator("#galleryCoverImg").getAttribute("src")) === picture + "?b", "the header shows the new cover");
await holdOn(page.locator(".image-card").nth(1));
ok(!(await page.locator("#sheetSetCover").isVisible()), "the current cover does not offer itself again");
await page.click("#sheetCancel");

/* right click (computer) → delete */
await page.locator(".image-card").first().click({ button: "right" });
await wait(150);
ok(!(await page.locator("#imageSheet").evaluate(el => el.classList.contains("hidden"))), "right-click opens the menu on a computer");
await page.click("#sheetDelete");
await page.click(".confirm-yes");
await wait(500);
ok(!(await dump("trip_images")).some(i => i.id === 11), "deleting asks once and removes the photo");
ok(await page.locator(".image-card").count() === 2, "the gallery shows two photos");

/* + adds photos */
const chooserPromise = page.waitForEvent("filechooser");
await page.click("#openMemoryModal");
const chooser = await chooserPromise;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await chooser.setFiles({ name: "strand.png", mimeType: "image/png", buffer: png });
await wait(200);
ok(!(await page.locator("#uploadQueue").evaluate(el => el.classList.contains("hidden"))), "the chosen photo waits in the upload preview");
await page.click("#uploadImageBtn");
await wait(800);
ok((await dump("trip_images")).filter(i => i.trip_id === 1).length === 3, "uploading adds the photo to the trip");
ok((await page.evaluate(() => window.__mockUploads || [])).length === 1, "the file went to storage");

/* back, open the upcoming trip */
await page.click("#backToMemories");
await wait(300);
ok(await page.locator("#openMemoryModal").getAttribute("aria-label") === "Neue Erinnerung", "back in the overview + creates trips again");
await page.locator(".memory-card", { hasText: "Hamburg" }).click();
await wait(400);
ok(!(await page.locator("#tripCountdown").evaluate(el => el.classList.contains("hidden"))), "an upcoming trip shows a live countdown");
const boxes = await page.locator(".trip-countdown-value").allTextContents();
ok(boxes.length === 4 && ["11", "12"].includes(boxes[0]), `countdown shows days, hours, minutes, seconds (${boxes.join(":")})`);
const seconds = boxes[3];
await wait(1300);
ok((await page.locator(".trip-countdown-value").nth(3).textContent()) !== seconds, "the countdown ticks every second");
await page.click("#backToMemories");
await wait(200);
ok(await page.locator("#tripCountdown").evaluate(el => el.classList.contains("hidden")), "leaving the trip stops the countdown");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (reise: long-press menu, + button, countdown)`);
