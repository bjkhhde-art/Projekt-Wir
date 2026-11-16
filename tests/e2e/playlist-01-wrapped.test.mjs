import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Playlist Wrapped: the numbers from playlist.json, the random song, "who added what" only when known,
   the links from KPIs and Spiele */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };

const song = (id, title, artists, released, durationMs, extra = {}) => ({ id, title, artists, released, durationMs, preview: `/preview/${id}.wav`, cover: "", ...extra });
const tracks = [
  song("a", "Alles nur geklaut", ["Die Prinzen"], "1993-11-12", 191800),
  song("b", "Fallen in Liebe", ["Kraftklub", "Nina Chuba"], "2026-02-06", 140000),
  song("c", "Blau", ["Kraftklub"], "2024-05-01", 300000),
  song("d", "Du", ["CRO"], "2025-01-01", 100000),
  song("e", "Weihnachtslied 2023", ["01099", "Dani", "Gustav", "Paul"], "2023-11-24", 150000)
];
const base = { name: "Hau raus🎧", description: "Kein Genre, keine Regeln", url: "https://open.spotify.com/playlist/test", cover: "", updatedAt: "2026-11-16T04:17:00Z" };
const partial = { ...base, total: 156, tracks };
const people = ["Benji", "Isi", "Benji", "Isi", "Benji"];
const full = { ...base, total: 5, tracks: tracks.map((t, i) => ({ ...t, addedBy: people[i], addedAt: `2026-0${1 + (i % 2)}-1${i}T10:00:00Z` })) };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function open(list, path = "playlist.html") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
  if (list) await ctx.route("**/playlist.json*", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(list) }));
  await ctx.route(/spotifycdn\.com|scdn\.co|open\.spotify\.com/, route => route.abort());
  await ctx.route("**/preview/*", route => route.fulfill({ status: 404, body: "" }));
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://localhost:9091/${path}`);
  return page;
}

/* the first 100 of more songs, nobody known */
{
  const page = await open(partial);
  await page.waitForSelector("#plApp:not(.hidden)");
  const hero = await page.locator("#plHero").textContent();
  ok(hero.includes("Hau raus") && hero.includes("Kein Genre"), "the hero shows name and description");
  ok(hero.includes("156") && hero.includes("Spielzeit (ca.)"), "the full song count, the play time estimated");
  ok((await page.locator(".pl-note").textContent()).includes("ersten 5 der 156"), "a note says only part of the playlist is counted");
  ok((await page.locator(".pl-bar-name").first().textContent()).includes("Kraftklub"), "Kraftklub leads the top artists");
  ok((await page.locator(".pl-bar-value").first().textContent()) === "2", "… with two songs");
  ok(await page.locator(".pl-col").count() === 12 && (await page.locator(".pl-col-label").first().textContent()) === "bis 15", "release years as twelve columns, old ones together");
  await page.locator(".pl-col").last().click();
  ok((await page.locator("#plYearTip").textContent()).includes("2026: 1 Song"), "tapping a column shows its number");
  const records = await page.locator("#plRecords").textContent();
  ok(records.includes("Alles nur geklaut") && records.includes("1993"), "the oldest song");
  ok(records.includes("Blau") && records.includes("5:00"), "the longest song");
  ok(records.includes("Weihnachtslied 2023") && records.includes("4 auf einem Song"), "the song with the most artists");
  ok(await page.locator("#plPeople").isHidden() && await page.locator("#plMonths").isHidden(), "without 'added by' data no who-added card and no months");
  ok(await page.locator(".pl-random-title").count() === 1, "a random song is shown");
  const first = await page.locator(".pl-random-title").textContent();
  await page.click("#plNext");
  ok((await page.locator(".pl-random-title").textContent()) !== first, "“Noch einer” shows another song");
  ok((await page.locator(".pl-foot").textContent()).includes("16. November 2026"), "the date of the last update");
  ok(await page.locator('a.pl-quiz[href="songquiz.html"]').count() === 1, "a link to the song quiz");
  await page.context().close();
}

/* every song, with who added it */
{
  const page = await open(full);
  await page.waitForSelector("#plApp:not(.hidden)");
  ok(await page.locator(".pl-note").count() === 0 && (await page.locator("#plHero").textContent()).includes("Spielzeit"), "complete: no note");
  ok(await page.locator("#plPeople").isVisible(), "the who-added card shows");
  const split = await page.locator(".pl-split").textContent();
  ok(split.includes("Isi 40 %") && split.includes("Benji 60 %"), `the split shows the shares (${split.trim()})`);
  ok((await page.locator(".pl-people").textContent()).includes("Am liebsten: CRO"), "each person's favourite artist");
  ok(await page.locator("#plMonths").isVisible() && await page.locator("#plMonths .pl-col").count() === 2, "songs added per month");
  await page.context().close();
}

/* the real playlist.json renders */
{
  const page = await open(null);
  await page.waitForSelector("#plApp:not(.hidden)");
  ok(await page.locator(".pl-bar-row").count() === 5, "the real playlist.json shows five top artists");
  await page.context().close();
}

/* broken file: a friendly message */
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
  await ctx.route("**/playlist.json*", route => route.fulfill({ status: 500, body: "" }));
  const page = await ctx.newPage();
  await page.goto("http://localhost:9091/playlist.html");
  await page.waitForSelector("#plError:not(.hidden)");
  ok((await page.locator("#plError").textContent()).includes("nicht geladen"), "without playlist.json a message instead of an empty page");
  await ctx.close();
}

/* the entrances */
{
  const kpis = await open(partial, "kpis.html");
  ok(await kpis.locator('#kpiPlaylist[href="playlist.html"]').count() === 1, "KPIs link to Playlist Wrapped");
  await kpis.goto("http://localhost:9091/games.html");
  ok(await kpis.locator('a.game-tile[href="songquiz.html"]').count() === 1, "Spiele has a Song-Quiz tile");
  await kpis.context().close();
}

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (playlist wrapped)`);
