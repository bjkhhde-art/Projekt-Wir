import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const base = "http://localhost:9091/";

/* every page opens without script errors, console errors or missing files of our own,
   and does not scroll sideways on a phone */
const pages = readdirSync(new URL("../../", import.meta.url)).filter(f => f.endsWith(".html")).sort();
for (const file of pages) {
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", e => problems.push("script error: " + e.message));
  /* "Fehler beim Laden …" is the app logging a failed outside service (weather, news) that it handles itself */
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|^Fehler beim Laden/.test(m.text())) problems.push("console: " + m.text()); });
  page.on("response", r => { if (r.status() >= 400 && r.url().startsWith(base)) problems.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + file); await page.waitForTimeout(700);
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  /* 404.html and offline.html are plain fallback pages and may answer 404 on purpose */
  const expected = file === "404.html" ? problems.filter(p => !p.startsWith("404 ")) : problems;
  ok(expected.length === 0, `${file} opens cleanly${expected.length ? ": " + expected.join("; ") : ""}`);
  ok(scrollWidth <= innerWidth, `${file} does not scroll sideways on a phone (${scrollWidth} ≤ ${innerWidth})`);
  await page.close();
}
await browser.close();
console.log(`\n${n} assertions passed`);
