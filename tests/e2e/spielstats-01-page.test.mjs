import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Spiele-Statistik: total time, games by play time, wins Isi vs Benji, weeks, weekdays, records, the KPI link */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const at = (day, h, m = 0) => new Date(Date.UTC(2026, 10, day, h, m)).toISOString();
const row = (id, created, updated, state, status = "closed") => ({ id, status, created_at: created, updated_at: updated, state, version: 1, host_person: "Isi" });

await post("/t/nimmt_games/seed", { rows: [
  /* Mon 2 Nov: 30 minutes, Isi wins 2 of 3 */
  row(1, at(2, 18), at(2, 18, 30), { moveSeq: 300, wins: { Isi: 2, Benji: 1 }, players: ["Isi", "Benji"] }),
  /* still in the lobby: does not count */
  row(2, at(3, 18), at(3, 18), { lobby: ["Isi"] }, "waiting")
] });
await post("/t/cabo_games/seed", { rows: [
  /* Sat 7 Nov: 1 hour with Udiou, Benji wins the game */
  row(1, at(7, 15), at(7, 16), { moveSeq: 600, round: 3, gameOver: true, winner: "Benji", scores: { Isi: [5, 9, 30], Benji: [2, 3, 4], Udiou: [9, 9, 9] }, players: ["Isi", "Benji", "Udiou"] })
] });
for (const t of ["qwixx_games", "flip7_games", "gipfel_games", "murphy_games", "geo_games"]) await post(`/t/${t}/reset`, {});
await post("/t/songquiz_games/seed", { rows: [row(3, at(9, 20), at(11, 9), { moveSeq: 30, round: 2, phase: "play", scores: { Isi: 7, Benji: 2 }, players: ["Isi", "Benji"] })] });
/* the song quiz table was measured: 10 minutes of active play */
await post("/t/game_plays/seed", { rows: [{ id: 1, game: "songquiz_games", game_id: 3, started_at: at(9, 20), last_move_at: at(9, 20, 12), active_seconds: 600, moves: 30, players: ["Isi", "Benji"], summary: { moveSeq: 30, round: 2, phase: "play", scores: { Isi: 7, Benji: 2 } } }] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", timezoneId: "UTC" });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));

await page.goto("http://localhost:9091/kpis.html");
ok(await page.locator('#kpiGames[href="spielstats.html"]').count() === 1, "KPIs link to the Spiele-Statistik");

await page.goto("http://localhost:9091/spielstats.html");
await page.waitForSelector("#gsApp:not(.hidden)");

const hero = await page.locator("#gsHero").textContent();
ok(hero.includes("1 Std. 40 Min."), `30 min + 60 min + 10 measured min = 1 Std. 40 Min. (${hero.replace(/\s+/g, " ").trim()})`);
ok(hero.includes("seit dem 2. November"), "since the first game");
ok(/\b3\s*Spieltische/.test(hero.replace(/\s+/g, " ")), "three tables, the lobby one does not count");

const names = await page.locator(".gs-game-name").allTextContents();
ok(names[0].includes("Cabo") && names[1].includes("6 nimmt!") && names[2].includes("Song-Quiz"), `games sorted by play time (${names.join(" | ")})`);
ok(names[0].includes("👑"), "the favourite game wears the crown");
ok((await page.locator(".gs-game-meta").first().textContent()).includes("3 Runden"), "Cabo counts rounds");
ok((await page.locator("#gsGames .gs-sub").textContent()).includes("Qwixx"), "games never played are named");

const wins = await page.locator("#gsWins .gs-split.big").textContent();
ok(wins.includes("Isi 3") && wins.includes("Benji 2"), `wins over all games: Isi 3 (2 nimmt + quiz), Benji 2 (1 nimmt + Cabo) (${wins.replace(/\s+/g, " ").trim()})`);
ok((await page.locator("#gsWins .gs-title-note").textContent()).includes("Isi liegt vorn"), "who is ahead");
ok(await page.locator(".gs-win-row").count() === 3, "one row per game with wins");

ok(await page.locator("#gsWeeks .gs-col").count() === 2, "two weeks with games");
await page.locator("#gsWeeks .gs-col").first().click();
ok((await page.locator("#gsWeekTip").textContent()).includes("Woche ab 2. November: 1 Std. 30 Min."), "tapping a week shows its time");
ok(await page.locator("#gsDays .gs-col").count() === 7, "seven weekday columns");
ok((await page.locator("#gsDayTip").textContent()).includes("Samstag"), "the busiest weekday is named (Cabo on Saturday)");

const records = await page.locator("#gsRecords").textContent();
ok(records.includes("Längster Spieltisch") && records.includes("1 Std.") && records.includes("Cabo"), "the longest table");
ok(records.includes("Am liebsten mit anderen") && records.includes("1 von 1 Tischen"), "the game most played with others");
ok((await page.locator("#gsFoot").textContent()).includes("1 Spieltisch genau gemessen"), "the footnote says what is measured and what estimated");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
for (const t of ["nimmt_games", "cabo_games", "songquiz_games", "game_plays"]) await post(`/t/${t}/reset`, {});
console.log(`\n${n} assertions passed (Spiele-Statistik)`);
