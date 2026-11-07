import { chromium } from "playwright";
import assert from "node:assert/strict";

/* story mode: a trip's photos full screen one after another – tap right/left, hold to pause,
   bars at the top, the phone's back button closes it */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const picture = "/icons/icon-512.png";
await post("/t/trips/seed", { rows: [
  { id: 1, title: "Alicante", location: "Alicante", start_date: "2026-08-29", end_date: "2026-09-02", cover_url: picture + "?cover", coordinates: null, created_at: "2026-08-01T10:00:00Z" },
  { id: 3, title: "Leer", location: "Nirgendwo", start_date: "2026-05-01", end_date: "2026-05-02", cover_url: null, coordinates: null, created_at: "2026-04-01T10:00:00Z" }
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

const storyOpen = () => page.locator("#storyViewer").evaluate(el => !el.classList.contains("hidden"));
const storySrc = () => page.locator("#storyImage").getAttribute("src");
const barValues = () => page.locator(".story-bar-fill").evaluateAll(fills => fills.map(f => {
  const m = /scaleX\(([\d.]+)\)/.exec(f.style.transform);
  return m ? Number(m[1]) : 0;
}));
async function tapAt(fraction) {
  const box = await page.locator("#storyStage").boundingBox();
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
  await wait(150);
}

/* an empty trip offers no story */
await page.locator(".memory-card", { hasText: "Leer" }).click();
await wait(400);
ok(await page.locator("#storyBtn").evaluate(el => el.classList.contains("hidden")), "a trip without photos shows no story button");
await page.click("#backToMemories");
await wait(300);

/* open the trip and start the story */
await page.locator(".memory-card", { hasText: "Alicante" }).click();
await wait(500);
ok(await page.locator("#storyBtn").isVisible(), "a trip with photos offers 'Als Story ansehen'");
await page.click("#storyBtn");
await wait(300);
ok(await storyOpen(), "the story opens full screen");
ok(await page.locator(".story-bar").count() === 3, "one bar per photo");
ok((await storySrc()) === picture + "?a", "it starts with the first photo");
ok((await page.locator("#storyTitle").textContent()) === "Alicante", "the trip name sits at the top");
ok((await page.locator("#storyCaption").textContent()) === "Castello Santa Barbara", "the caption is shown");

/* the bar fills by itself */
await wait(1200);
const progress = (await barValues())[0];
ok(progress > 0.1 && progress < 1, `the first bar fills over time (${progress.toFixed(2)})`);

/* tap right → next, tap left → back */
await tapAt(0.8);
ok((await storySrc()) === picture + "?b", "tapping the right side shows the next photo");
const bars = await barValues();
ok(bars[0] === 1 && bars[1] < 0.2 && bars[2] === 0, `finished photos have full bars (${bars.map(b => b.toFixed(2)).join(", ")})`);
await tapAt(0.15);
ok((await storySrc()) === picture + "?a", "tapping the left side goes back");
await tapAt(0.8);
await tapAt(0.8);
ok((await storySrc()) === picture + "?c", "on to the third photo");
ok(await page.locator("#storyCaption").evaluate(el => el.classList.contains("hidden")), "a photo without caption shows no caption bar");

/* holding pauses */
const box = await page.locator("#storyStage").boundingBox();
const before = (await barValues())[2];
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
await page.mouse.down();
await wait(1500);
const during = (await barValues())[2];
ok(await page.locator("#storyViewer").evaluate(el => el.classList.contains("holding")), "holding hides the bars and text");
await page.mouse.up();
await wait(100);
ok(during - before < 0.08, `holding pauses the story (${before.toFixed(2)} → ${during.toFixed(2)})`);
ok((await storySrc()) === picture + "?c", "letting go after holding does not skip the photo");

/* pause button */
await page.click("#storyPause");
const p1 = (await barValues())[2];
await wait(1000);
const p2 = (await barValues())[2];
ok(Math.abs(p2 - p1) < 0.02, "the pause button stops the story");
await page.click("#storyPause");

/* tap on the last photo ends the story */
await tapAt(0.8);
await wait(200);
ok(!(await storyOpen()), "after the last photo the story closes");
ok(await page.locator("#galleryView").isVisible(), "and we are back in the trip");

/* keys and the phone's back button */
await page.click("#storyBtn");
await wait(200);
await page.keyboard.press("ArrowRight");
await wait(100);
ok((await storySrc()) === picture + "?b", "arrow right shows the next photo");
await page.goBack();
await wait(300);
ok(!(await storyOpen()), "the phone's back button closes the story");
ok(await page.locator("#galleryView").isVisible(), "and leaves us in the trip");

/* it plays on by itself */
await page.click("#storyBtn");
await wait(5600);
ok((await storySrc()) === picture + "?b", "after a few seconds the next photo comes by itself");
await page.click("#storyClose");
await wait(300);
ok(!(await storyOpen()), "× closes the story");
ok(await page.locator("#galleryView").isVisible(), "× leaves us in the trip");

/* straight from the overview */
await page.click("#backToMemories");
await wait(300);
await page.locator(".memory-card", { hasText: "Alicante" }).locator(".story-memory-btn").click();
await wait(700);
ok(await storyOpen(), "▶ on a trip card starts the story directly");
await page.goBack();
await wait(300);
ok(!(await storyOpen()) && await page.locator("#galleryView").isVisible(), "back from there lands in the trip");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed`);
