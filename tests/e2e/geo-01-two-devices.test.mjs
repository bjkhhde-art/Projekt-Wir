import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Geo-Guesser on two phones: the same trip photo for both, each picks a trip, the answer shows when both have */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const latest = async () => (await (await fetch(`${API}/t/geo_games/latest`)).json());

async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function open(person) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/geo.html");
  await page.waitForTimeout(600);
  return page;
}

/* only one trip with photos: the game explains what is missing */
await post("/t/geo_games/reset", {});
await post("/t/trips/seed", { rows: [{ id: 1, title: "Alicante", location: "Spanien", start_date: "2026-08-29", end_date: "2026-09-02" }] });
await post("/t/trip_images/seed", { rows: [{ id: 1, trip_id: 1, image_url: "/icons/icon-512.png?a" }] });
const lonely = await open("Isi");
ok(await lonely.locator("#geoHint").isVisible() && (await lonely.locator("#geoHint").textContent()).includes("mindestens zwei Reisen"), "with fewer than two trips a hint says what is missing");
await lonely.context().close();

/* a real pool: two trips, photos named after their trip */
const picture = "/icons/icon-512.png";
await post("/t/trips/seed", { rows: [
  { id: 1, title: "Alicante", location: "Spanien", start_date: "2026-08-29", end_date: "2026-09-02" },
  { id: 2, title: "Berlin", location: "Berlin", start_date: "2026-05-01", end_date: "2026-05-03" },
  { id: 3, title: "Ostsee", location: "", start_date: "2026-10-01", end_date: "2026-10-03" }
] });
await post("/t/trip_images/seed", { rows: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, trip_id: i % 2 ? 2 : 1, image_url: `${picture}?p${i}` })) });
await post("/t/geo_games/reset", {});

const isi = await open("Isi");
const benji = await open("Benji");
ok(!(await isi.locator("#geoHint").isVisible()), "with two trips there is no hint");
ok(await isi.locator(".gr-bot, .gr-invite").count() === 0, "no computer players or invites are offered");

await isi.click("#grStartBtn");
await until(async () => await benji.locator("#grJoinBtn").count() > 0, 4000, "Benji sees the invite");
await benji.click("#grJoinBtn");
await until(async () => (await isi.locator(".geo-photo img").count()) === 1 && (await benji.locator(".geo-photo img").count()) === 1, 4000, "photo on both phones");

const srcOf = page => page.locator(".geo-photo img").getAttribute("src");
ok(await srcOf(isi) === await srcOf(benji), "both see the same photo");
const listed = await isi.locator("#geoTrip option:not([disabled])").allTextContents();
ok(listed.length === 3 && listed[0].includes("Ostsee") && listed[1].includes("Alicante · Spanien · 2026"), `the dropdown lists all trips, newest first (${listed.join(" | ")})`);
ok(await isi.locator("#geoSubmit").isDisabled(), "submitting needs a chosen trip");
ok(await isi.locator("#geoTrip").evaluate(el => el.value === ""), "the dropdown starts on its placeholder");

/* work out which trip is right from the state */
const rightTrip = async () => {
  const s = (await latest()).state;
  return { right: s.photos[s.index].trip, index: s.index };
};
let { right } = await rightTrip();
const wrongOf = r => (r === "1" ? "2" : "1");

await isi.selectOption("#geoTrip", right);
await isi.click("#geoSubmit");
await until(async () => (await latest()).state.picks.Isi === right, 4000, "Isi's pick saved");
ok((await isi.locator(".geo-wait").textContent()).includes("Warte auf Benji"), "Isi waits for Benji");
ok((await latest()).state.phase === "play", "no reveal after one pick");

await benji.selectOption("#geoTrip", wrongOf(right));
await benji.click("#geoSubmit");
await until(async () => (await isi.locator(".geo-answer h2").count()) === 1 && (await benji.locator(".geo-answer h2").count()) === 1, 4000, "reveal");
const title = right === "1" ? "Alicante" : "Berlin";
ok((await isi.locator(".geo-answer h2").textContent()).includes(title), "the reveal names the right trip");
ok((await isi.locator(".geo-pick.hit").count()) === 1 && (await isi.locator(".geo-pick.miss").count()) === 1, "one right, one wrong pick are shown");
ok((await isi.locator(".geo-chip.me").textContent()).includes("1") && (await benji.locator(".geo-chip.me").textContent()).includes("0"), "only the right pick scored");

/* both tap "ready" → next photo */
await isi.click(".gr-ready-btn");
ok((await latest()).state.phase === "reveal", "one ready tap does not move on");
await benji.click(".gr-ready-btn");
await until(async () => (await latest()).state.index === 1, 4000, "second photo");
ok(true, "when both are ready the next photo comes");

/* the remaining four photos, both always right */
for (let i = 1; i < 5; i++) {
  const { right: r } = await rightTrip();
  await until(async () => (await isi.locator("#geoTrip:not([disabled])").count()) === 1 && (await benji.locator("#geoTrip:not([disabled])").count()) === 1, 4000, `photo ${i + 1} on both`);
  for (const page of [isi, benji]) {
    await page.selectOption("#geoTrip", r);
    await page.click("#geoSubmit");
  }
  await until(async () => (await latest()).state.phase === "reveal", 4000, `reveal ${i + 1}`);
  await until(async () => (await isi.locator(".gr-ready-btn").count()) === 1 && (await benji.locator(".gr-ready-btn").count()) === 1, 4000, "ready buttons");
  await isi.click(".gr-ready-btn");
  await benji.click(".gr-ready-btn");
  await until(async () => (await latest()).state.phase !== "reveal", 4000, `after ${i + 1}`);
}
await until(async () => (await isi.locator(".geo-summary-score").count()) === 1, 4000, "summary");
ok((await isi.locator(".geo-summary-score").textContent()).includes("Du 5 : 4 Benji"), "the result shows 5 : 4");
ok((await isi.locator(".geo-result").count()) === 5, "all five photos are listed with their trip");

/* next round */
await isi.click(".gr-ready-btn");
await benji.click(".gr-ready-btn");
await until(async () => (await latest()).state.round === 2, 4000, "round 2");
ok((await latest()).state.scores.Isi === 5, "the score carries over to the next round");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (geo: two-device round)`);
