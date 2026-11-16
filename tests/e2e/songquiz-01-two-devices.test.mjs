import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Song-Quiz on two phones: the same song for both, each picks an answer, the reveal shows the song,
   both right → the faster one gets the ⚡ bonus; five songs, then the result and the next round */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const latest = async () => (await (await fetch(`${API}/t/songquiz_games/latest`)).json());

async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}

/* one second of silence as the "preview", so nothing goes to Spotify */
function silentWav() {
  const rate = 8000, samples = rate;
  const buf = Buffer.alloc(44 + samples);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write("data", 36); buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}
const WAV = silentWav();

const ARTISTS = ["Kraftklub", "Nina Chuba", "CRO", "Ski Aggu", "Provinz", "Bosse", "Paula Carolina", "Von Wegen Lisbeth"];
const playlist = {
  name: "Hau raus🎧",
  url: "https://open.spotify.com/playlist/test",
  total: 8,
  tracks: ARTISTS.map((artist, i) => ({ id: `song${i}`, title: `Titel ${i}`, artists: [artist], durationMs: 180000, released: `20${15 + i}-01-01`, preview: `/preview/${i}.wav`, cover: "" }))
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function open(person, list = playlist) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  await ctx.route("**/playlist.json*", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(list) }));
  await ctx.route("**/preview/*", route => route.fulfill({ contentType: "audio/wav", body: WAV }));
  await ctx.route("https://open.spotify.com/**", route => route.abort());
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/songquiz.html");
  await page.waitForTimeout(600);
  return page;
}

/* too few songs: the game explains what is missing */
await post("/t/songquiz_games/reset", {});
const lonely = await open("Isi", { ...playlist, tracks: playlist.tracks.slice(0, 2) });
ok(await lonely.locator("#sqHint").isVisible() && (await lonely.locator("#sqHint").textContent()).includes("mindestens vier Songs"), "with too few songs a hint says what is missing");
await lonely.context().close();

const isi = await open("Isi");
const benji = await open("Benji");
ok(!(await isi.locator("#sqHint").isVisible()), "with enough songs there is no hint");
ok(await isi.locator(".gr-bot, .gr-invite").count() === 0, "no computer players or invites are offered");
ok(await isi.locator(".gr-option").count() === 3, "three modes to choose from");

/* mode "Welcher Song?" */
await isi.click('.gr-option[data-option="title"]');
await isi.click("#grStartBtn");
await until(async () => await benji.locator("#grJoinBtn").count() > 0, 4000, "Benji sees the invite");
await benji.click("#grJoinBtn");
await until(async () => (await isi.locator(".sq-option").count()) === 4 && (await benji.locator(".sq-option").count()) === 4, 4000, "answers on both phones");

const state0 = (await latest()).state;
ok(state0.option === "title" && state0.questions.every(q => q.kind === "title"), "the chosen mode only asks for titles");
const labels = page => page.locator(".sq-option").allTextContents();
ok(JSON.stringify(await labels(isi)) === JSON.stringify(await labels(benji)), "both see the same four answers");
ok((await isi.locator(".sq-question").textContent()).includes("Welcher Song"), "the question asks for the song");
ok(await isi.locator(".sq-cover").count() === 0, "the cover stays hidden until the reveal");

/* the song really plays (silent preview) */
await until(async () => isi.evaluate(() => [...document.querySelectorAll("#sqPlay")].some(b => b.textContent === "⏸")), 4000, "song playing");
ok(true, "the song starts by itself and the button shows pause");

const answerIndex = async () => { const s = (await latest()).state; return s.questions[s.index].answer; };
let right = await answerIndex();
const wrongOf = r => (r + 1) % 4;

await isi.click(`.sq-option[data-choice="${right}"]`);
await until(async () => (await latest()).state.picks.Isi !== null, 4000, "Isi's answer saved");
ok((await isi.locator(".sq-wait").textContent()).includes("Warte auf Benji"), "Isi waits for Benji");
ok(await isi.locator(".sq-option:not([disabled])").count() === 0, "after answering the buttons are locked");
ok((await latest()).state.picks.Isi.ms >= 0, "the time until the answer is saved");

await benji.click(`.sq-option[data-choice="${wrongOf(right)}"]`);
await until(async () => (await isi.locator(".sq-answer h2").count()) === 1 && (await benji.locator(".sq-answer h2").count()) === 1, 4000, "reveal");
const song0 = (await latest()).state.questions[0].song;
ok((await isi.locator(".sq-answer h2").textContent()) === song0.title, "the reveal names the song");
ok((await isi.locator(".sq-answer-artists").textContent()).includes(song0.artists[0]), "… and who sings it");
ok((await isi.locator(".sq-spotify").getAttribute("href")).endsWith(`/track/${song0.id}`), "with a link to the song in Spotify");
ok((await isi.locator(".sq-pick.hit").count()) === 1 && (await isi.locator(".sq-pick.miss").count()) === 1, "one right, one wrong answer are shown");
ok((await isi.locator(".sq-chip.me").textContent()).includes("1") && (await benji.locator(".sq-chip.me").textContent()).includes("0"), "only the right answer scored");

await isi.click(".gr-ready-btn");
ok((await latest()).state.phase === "reveal", "one ready tap does not move on");
await benji.click(".gr-ready-btn");
await until(async () => (await latest()).state.index === 1, 4000, "second song");
ok(true, "when both are ready the next song comes");

/* second song: both right, Benji much later → Isi gets the bonus */
right = await answerIndex();
await until(async () => (await isi.locator(".sq-option:not([disabled])").count()) === 4 && (await benji.locator(".sq-option:not([disabled])").count()) === 4, 4000, "song 2 on both");
await isi.click(`.sq-option[data-choice="${right}"]`);
await wait(700);
await benji.click(`.sq-option[data-choice="${right}"]`);
await until(async () => (await latest()).state.phase === "reveal", 4000, "reveal 2");
const r2 = (await latest()).state.answers[1];
ok(r2.fastest === "Isi" && r2.points.Isi === 2 && r2.points.Benji === 1, "both right: the faster one gets a ⚡ bonus point");
await until(async () => (await isi.locator(".sq-bonus").count()) === 1, 4000, "bonus line");
ok((await isi.locator(".sq-bonus").textContent()).includes("Du warst schneller") && (await benji.locator(".sq-bonus").textContent()).includes("Isi war schneller"), "the bonus is explained on both phones");

/* the remaining three songs, both always right at the same time-ish */
for (let i = 2; i < 5; i++) {
  await until(async () => (await isi.locator(".gr-ready-btn").count()) === 1 && (await benji.locator(".gr-ready-btn").count()) === 1, 4000, "ready buttons");
  await isi.click(".gr-ready-btn");
  await benji.click(".gr-ready-btn");
  await until(async () => (await latest()).state.index === i, 4000, `song ${i + 1}`);
  const r = await answerIndex();
  await until(async () => (await isi.locator(".sq-option:not([disabled])").count()) === 4 && (await benji.locator(".sq-option:not([disabled])").count()) === 4, 4000, `song ${i + 1} on both`);
  await isi.click(`.sq-option[data-choice="${r}"]`);
  await benji.click(`.sq-option[data-choice="${wrongOf(r)}"]`);
  await until(async () => (await latest()).state.phase === "reveal", 4000, `reveal ${i + 1}`);
}
await until(async () => (await isi.locator(".gr-ready-btn").count()) === 1 && (await benji.locator(".gr-ready-btn").count()) === 1, 4000, "last ready");
await isi.click(".gr-ready-btn");
await benji.click(".gr-ready-btn");
await until(async () => (await isi.locator(".sq-summary-score").count()) === 1, 4000, "summary");
ok((await isi.locator(".sq-summary-score").textContent()).includes("Du 6 : 1 Benji"), `the result shows 6 : 1 (${await isi.locator(".sq-summary-score").textContent()})`);
ok((await isi.locator(".sq-result").count()) === 5, "all five songs are listed");
ok(await isi.evaluate(() => document.querySelector("#sqPlay") === null), "the player is gone on the result");

await isi.click(".gr-ready-btn");
await benji.click(".gr-ready-btn");
await until(async () => (await latest()).state.round === 2, 4000, "round 2");
const s2 = (await latest()).state;
ok(s2.scores.Isi === 6 && s2.option === "title", "the next round keeps the score and the mode");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (song quiz: two-device round)`);
