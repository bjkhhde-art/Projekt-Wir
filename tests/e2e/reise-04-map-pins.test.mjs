import { chromium } from "playwright";
import assert from "node:assert/strict";

/* world map: trips still ahead get a grey pin, past trips keep their coloured pin and sit on top */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function isoDay(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

await post("/t/trips/seed", { rows: [
  { id: 1, title: "Alicante", location: "Alicante", start_date: "2026-08-29", end_date: "2026-09-02", cover_url: null, coordinates: [{ lat: 38.34, lng: -0.48 }], created_at: "2026-08-01T10:00:00Z" },
  { id: 2, title: "Hamburg", location: "Hamburg", start_date: isoDay(12), end_date: isoDay(16), cover_url: null, coordinates: [{ lat: 53.55, lng: 9.99 }], created_at: "2026-09-01T10:00:00Z" }
] });
await post("/t/trip_images/seed", { rows: [] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
/* stand-in for the map library that records every pin it is asked to draw */
await ctx.route(/leaflet.*\.js/, route => route.fulfill({
  contentType: "text/javascript",
  body: `(function () {
    const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? undefined : chain(), apply: () => chain() });
    window.__pins = [];
    const L = chain();
    window.L = new Proxy(L, { get(t, k) {
      if (k === "divIcon") return options => ({ html: options.html });
      if (k === "marker") return (latLng, options) => {
        window.__pins.push({ latLng, html: options.icon.html, zIndexOffset: options.zIndexOffset });
        return chain();
      };
      return L[k];
    } });
  })();`
}));
await ctx.route(/leaflet.*\.css/, route => route.fulfill({ contentType: "text/css", body: "" }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/reise.html");
await page.waitForTimeout(800);

const pins = await page.evaluate(() => window.__pins.slice(-2));
const past = pins.find(pin => pin.html.includes("Alicante"));
const ahead = pins.find(pin => pin.html.includes("Hamburg"));
ok(past && ahead, "both trips get a pin on the map");
ok(!past.html.includes("trip-pin--upcoming"), "a past trip keeps its coloured pin");
ok(ahead.html.includes("trip-pin--upcoming") && ahead.html.includes("(geplant)"), "an upcoming trip gets a grey pin marked as planned");
ok(past.zIndexOffset > ahead.zIndexOffset, "past trips sit above upcoming ones");

const grey = await page.evaluate(() => {
  const el = document.createElement("div");
  el.className = "trip-pin trip-pin--upcoming";
  document.body.appendChild(el);
  return getComputedStyle(el).backgroundColor;
});
ok(grey === "rgb(156, 163, 175)", `the upcoming pin is grey (${grey})`);
ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));

await browser.close();
console.log(`${n} assertions passed (reise: map pins)`);
