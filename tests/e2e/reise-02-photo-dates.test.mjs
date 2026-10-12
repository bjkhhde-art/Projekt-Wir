import { chromium } from "playwright";
import assert from "node:assert/strict";

/* trip photos in the order they were taken: the date shows on each photo, can be changed in the
   edit menu, and new uploads read it from the camera data (EXIF) or the file name */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const dump = async table => (await (await fetch(`${API}/t/${table}/dump`)).json());

const picture = "/icons/icon-512.png";
await post("/t/trips/seed", { rows: [
  { id: 1, title: "Alicante", location: "Alicante", start_date: "2026-08-29", end_date: "2026-09-02", cover_url: null, coordinates: null, created_at: "2026-08-01T10:00:00Z" }
] });
/* uploaded in a different order than taken */
await post("/t/trip_images/seed", { rows: [
  { id: 11, trip_id: 1, image_url: picture + "?strand", caption: "Strand", created_at: "2026-09-03T18:00:00Z", taken_at: "2026-08-31T14:07:41Z", taken_at_source: "exif" },
  { id: 12, trip_id: 1, image_url: picture + "?ankunft", caption: "Ankunft", created_at: "2026-09-03T18:01:00Z", taken_at: "2026-08-29T17:04:40Z", taken_at_source: "exif" },
  { id: 13, trip_id: 1, image_url: picture + "?burg", caption: "Burg", created_at: "2026-09-03T18:02:00Z", taken_at: "2026-08-30T10:00:00Z", taken_at_source: "estimate" },
  { id: 14, trip_id: 1, image_url: picture + "?alt", caption: "Ohne Datum", created_at: "2026-09-03T18:03:00Z" }
] });

/* a tiny JPEG with an EXIF date (big endian, DateTimeOriginal + time zone) */
function jpegWithExif(date, offset) {
  const str = s => [...Buffer.from(s + "\0", "latin1")];
  const u16 = v => [v >> 8, v & 255];
  const u32 = v => [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  const ifd0At = 8, exifAt = ifd0At + 2 + 12 + 4, dataAt = exifAt + 2 + 24 + 4;
  const d = str(date), o = str(offset);
  const tiff = [0x4d, 0x4d, ...u16(42), ...u32(ifd0At),
    ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifAt), ...u32(0),
    ...u16(2), ...u16(0x9003), ...u16(2), ...u32(d.length), ...u32(dataAt),
    ...u16(0x9011), ...u16(2), ...u32(o.length), ...u32(dataAt + d.length), ...u32(0),
    ...d, ...o];
  const app1 = [...Buffer.from("Exif\0\0", "latin1"), ...tiff];
  return Buffer.from([0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xda, 0, 2]);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Berlin", locale: "de-DE" });
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
await page.locator(".memory-card", { hasText: "Alicante" }).click();
await page.waitForTimeout(600);

const captions = async () => (await page.locator(".image-card .image-caption").allTextContents()).join(",");
ok(await captions() === "Ankunft,Burg,Strand,Ohne Datum", "photos are sorted by the day they were taken, not by upload");
const dates = await page.locator(".image-card .image-date").allTextContents();
ok(dates[0] === "Sa., 29.08.2026 · 19:04", `the date and time show on the photo (${dates[0]})`);
ok(dates[1] === "≈ So., 30.08.2026" && await page.locator(".image-card").nth(1).locator(".image-date.estimate").count() === 1, `an estimated date is marked with ≈ and no time (${dates[1]})`);

async function holdOn(locator, ms = 700) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.down();
  await wait(ms);
  await page.mouse.up();
  await wait(150);
}

/* change the estimated date in the edit menu */
await holdOn(page.locator(".image-card").nth(1));
await page.click("#sheetEditDate");
ok(await page.locator("#sheetDateInput").inputValue() === "2026-08-30T12:00", "the edit menu shows the current date in local time");
ok((await page.locator("#sheetDateHint").textContent()).includes("geschätzt"), "and says that it is only an estimate");
await page.fill("#sheetDateInput", "2026-09-01T21:15");
await page.click("#sheetSaveDate");
await wait(600);
const burg = (await dump("trip_images")).find(i => i.id === 13);
ok(burg.taken_at_source === "manual" && new Date(burg.taken_at).toISOString() === "2026-09-01T19:15:00.000Z", "the new date is saved as set by hand");
ok(await captions() === "Ankunft,Strand,Burg,Ohne Datum", "the photo moves to its new place");
ok((await page.locator(".image-card").nth(2).locator(".image-date").textContent()) === "Di., 01.09.2026 · 21:15", "and shows the new date");

/* uploads: the date from EXIF and from the file name */
const chooserPromise = page.waitForEvent("filechooser");
await page.click("#openMemoryModal");
const chooser = await chooserPromise;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await chooser.setFiles([
  { name: "kamera.jpg", mimeType: "image/jpeg", buffer: jpegWithExif("2026:08:30 08:15:00", "+02:00") },
  { name: "IMG_20260902_103000.png", mimeType: "image/png", buffer: png },
  { name: "IMG_4711.png", mimeType: "image/png", buffer: png }
]);
await wait(200);
await page.click("#uploadImageBtn");
await wait(1200);
const added = (await dump("trip_images")).filter(i => i.image_url.includes("upload=")).sort((a, b) => a.id - b.id);
ok(added.length === 3, "three photos uploaded");
ok(added[0].taken_at_source === "exif" && new Date(added[0].taken_at).toISOString() === "2026-08-30T06:15:00.000Z", "a camera photo gets its date from EXIF");
ok(added[1].taken_at_source === "filename" && new Date(added[1].taken_at).toISOString() === "2026-09-02T08:30:00.000Z", "IMG_20260902_103000 gets its date from the file name");
ok(added[2].taken_at_source === "estimate" && Math.abs(new Date(added[2].taken_at) - Date.now()) < 120000, "without any date the upload time is used as an estimate");
const order = (await page.locator(".image-card img").evaluateAll(imgs => imgs.map(i => i.getAttribute("src"))));
const camera = order.findIndex(s => s.includes(".jpg"));
ok(order.indexOf(picture + "?ankunft") < camera && camera < order.indexOf(picture + "?strand"), "the new camera photo (30.08.) sorts in between the others");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (reise: photo dates)`);
