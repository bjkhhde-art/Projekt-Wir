import { chromium } from "playwright";
import assert from "node:assert/strict";

/* 6 nimmt! with animations ON: cards really fly, nothing stays hidden, both screens animate. */
const BROWSER_PATH = process.env.CHROMIUM_PATH || undefined;
const API = "http://localhost:8991/t/nimmt_games";
let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }

await fetch(`${API}/reset`, { method: "POST" });
const browser = await chromium.launch({ executablePath: BROWSER_PATH });
const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 } });
const isi = await (await ctx()).newPage();
const benji = await (await ctx()).newPage();
const errors = [];
isi.on("pageerror", e => errors.push("isi: " + e.message));
benji.on("pageerror", e => errors.push("benji: " + e.message));
await isi.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
await benji.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
await isi.goto("http://localhost:9091/nimmt.html");
await benji.goto("http://localhost:9091/nimmt.html");
await isi.waitForTimeout(300);

const latest = async () => (await fetch(`${API}/latest`)).json();
async function setup(mutate) {
  const game = await latest();
  mutate(game.state);
  await fetch(`${API}/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: game.state }) });
  await isi.waitForTimeout(600);
  await benji.waitForTimeout(200);
}
const handCard = (page, card) => page.locator(`[data-anim-key="hand-${card}"]`);
const hiddenCount = page => page.locator(".anim-hidden").count();
const ghostCount = page => page.locator(".ga-ghost").count();
const peakGhosts = (page, ms = 1500) => page.evaluate(ms => new Promise(resolve => {
  let peak = 0;
  const started = performance.now();
  const tick = () => {
    peak = Math.max(peak, document.querySelectorAll(".ga-ghost").length);
    if (performance.now() - started < ms) requestAnimationFrame(tick); else resolve(peak);
  };
  tick();
}), ms);
const settle = async () => { await isi.waitForTimeout(2600); await benji.waitForTimeout(100); };

/* ================= deal ================= */
await isi.locator("#grStartBtn").click();
await benji.waitForTimeout(700);
await benji.locator("#grJoinBtn").click();
await isi.waitForTimeout(600);
await isi.locator("#grBeginBtn").click();
await benji.waitForSelector("#nmBoard:not(.hidden)");
ok(await benji.locator("#nmBoard").evaluate(el => el.classList.contains("nm-dealing")), "starting the round deals the cards with an animation");
const running = await benji.locator(".nm-hand-card .nm-card").first().evaluate(el => el.getAnimations().length);
ok(running > 0, "hand cards are animating in");
await settle();
ok(await benji.locator("#nmBoard").evaluate(el => !el.classList.contains("nm-dealing")), "the deal animation ends");

/* ================= laying a card ================= */
await setup(s => {
  s.rows = [[10, 11, 12, 13, 14], [20], [40]];
  s.hands = { Isi: [15, 50, 60], Benji: [41, 51, 61] };
  s.chosen = { Isi: null, Benji: null };
  s.penalties = { Isi: [], Benji: [] };
});

await handCard(isi, 15).click();
const layPeak = await peakGhosts(isi, 500);
ok(layPeak === 1, "the chosen card flies from the hand to its spot");
await isi.waitForTimeout(300);
ok(await isi.locator("#nmSpotOwn").evaluate(el => !el.classList.contains("anim-hidden")), "and is shown once it has landed");
await benji.waitForTimeout(600);
ok(await benji.locator("#nmSpotOpp .nm-card-back").count() === 1, "Benji sees Isi's face-down card appear");

/* ================= reveal: 15 takes the full first row, 41 joins row three ================= */
const isiPeakPromise = peakGhosts(isi, 2200);
await handCard(benji, 41).click();
const peak = await peakGhosts(benji, 1800);
ok(peak >= 7, `the five taken cards fly to the pile while both played cards fly to the rows (peak ${peak} flying cards)`);
const isiPeak = await isiPeakPromise;
ok(isiPeak >= 7, `Isi sees the same animation on her screen (peak ${isiPeak})`);
await settle();
ok(await hiddenCount(isi) === 0 && await hiddenCount(benji) === 0, "afterwards every card is visible on both screens");
ok(await ghostCount(isi) === 0 && await ghostCount(benji) === 0, "no flying cards are left behind");
const g = await latest();
ok(JSON.stringify(g.state.rows[0]) === "[15]" && JSON.stringify(g.state.rows[2]) === "[40,41]", "the table ended in the right state");

/* ================= too low: the other card turns over in place ================= */
await setup(s => {
  s.rows = [[50], [60], [70]];
  s.hands = { Isi: [3, 99], Benji: [90, 98] };
  s.chosen = { Isi: null, Benji: null };
});
await handCard(benji, 90).click();
await benji.waitForTimeout(600);
const flipSamples = isi.evaluate(() => new Promise(resolve => {
  const seen = [];
  const started = performance.now();
  const tick = () => {
    const el = document.querySelector("#nmSpotOpp .nm-flip");
    if (el) {
      const m = getComputedStyle(el).transform;
      seen.push(m === "none" ? 1 : Number(m.replace(/^matrix(3d)?\(/, "").split(",")[0]));
    }
    if (performance.now() - started < 1500) requestAnimationFrame(tick); else resolve(seen);
  };
  tick();
}));
await handCard(isi, 3).click();
const samples = await flipSamples;
const midway = samples.filter(v => v > -0.9 && v < 0.9).length;
ok(samples.length > 0 && samples[0] > 0.9 && midway >= 3, `Benji's card on Isi's screen turns over instead of just appearing (${midway} frames mid-turn)`);
await isi.waitForTimeout(900);
ok(await isi.locator("#nmSpotOpp .nm-flip.face-up").count() === 1, "and ends face-up");

await isi.locator(".nm-row").nth(1).click();
const pickPeak = await peakGhosts(isi, 1500);
ok(pickPeak >= 2, `picking a row: the row flies to Isi's pile and both cards fly to the table (peak ${pickPeak})`);
await settle();
ok(await hiddenCount(isi) === 0 && await hiddenCount(benji) === 0 && await ghostCount(isi) === 0, "everything settled and visible");

ok(errors.length === 0, `no JS errors (${JSON.stringify(errors)})`);
await browser.close();
console.log(`\n${assertions} assertions passed (nm-test2: 6 nimmt! animations)`);
