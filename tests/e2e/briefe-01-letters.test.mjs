import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Briefe: envelopes newest first, "Neu" only for the other one's letters, opening by swiping the flap up,
   writing a letter (with a notification) and deleting one */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rows = async () => (await (await fetch(`${API}/t/love_notes/dump`)).json());

await post("/t/love_notes/seed", { rows: [
  { id: 1, author: "Isi", message: "Ich freu mich auf dich", created_at: "2026-02-01T09:00:00Z" },
  { id: 2, author: "Benji", message: "Guten Morgen ☀️\nDu bist <b>toll</b>", created_at: "2026-02-03T08:00:00Z" }
] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
async function until(fn, ms = 3000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); }
  throw new Error("timed out waiting for " + what);
}
const authors = () => page.locator("#notesFeed .envelope-author").allTextContents();
const envelope = author => page.locator("#notesFeed .envelope-card", { has: page.locator(".envelope-author", { hasText: author }) });

async function swipeFlap(fraction) {
  const box = await page.locator("#envelopeFlap").boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 150 * fraction, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

await page.goto("http://localhost:9091/wir.html?tab=briefe");
/* the feed is redrawn when live updates arrive – wait until both letters are there */
await until(async () => (await authors()).length === 2, 4000, "both letters");

/* ---------- the list ---------- */
ok(JSON.stringify(await authors()) === JSON.stringify(["Von Benji", "Von Isi"]), "letters are listed newest first");
ok(await envelope("Von Benji").locator(".envelope-new-badge").count() === 1, "a letter from Benji is marked as new for Isi");
ok(await envelope("Von Isi").locator(".envelope-new-badge").count() === 0, "my own letters are never new for me");

/* ---------- opening ---------- */
await envelope("Von Benji").click();
ok(await page.locator("#letterOverlay").isVisible() && (await page.locator("#letterSignature").textContent()) === "Von Benji", "tapping an envelope opens the big letter");
const html = await page.locator("#letterMessage").innerHTML();
ok(html.includes("Guten Morgen ☀️<br>") && html.includes("&lt;b&gt;toll&lt;/b&gt;"), "line breaks are kept and HTML is shown as text, not run");
await swipeFlap(0.3);
ok(!(await page.locator("#letterPaper").evaluate(el => el.classList.contains("revealed"))), "a short swipe lets the flap fall closed again");
await swipeFlap(1);
ok(await page.locator("#letterPaper").evaluate(el => el.classList.contains("revealed")) && await page.locator("#envelopeFlap").evaluate(el => el.classList.contains("opened")), "swiping the flap far enough up opens the letter");
ok(await envelope("Von Benji").locator(".envelope-new-badge").count() === 0, "once opened it is no longer new");
await page.keyboard.press("Escape");
ok(await page.locator("#letterOverlay").isHidden(), "Escape closes the letter");
await page.reload();
await until(async () => (await authors()).length === 2, 4000, "both letters after reloading");
ok(await envelope("Von Benji").locator(".envelope-new-badge").count() === 0, "the phone remembers which letters were opened");

/* ---------- writing ---------- */
await page.click("#openNoteModal");
ok(await page.locator("#noteModal").isVisible(), "+ opens the form for a new letter");
await page.click("#sendNoteBtn");
ok(await page.locator("#noteModal").isVisible() && (await rows()).length === 2, "an empty letter is not sent");
await page.selectOption("#noteAuthorInput", "Isi");
await page.fill("#noteMessageInput", "Bis heute Abend 💗");
await page.click("#sendNoteBtn");
await until(async () => (await rows()).length === 3, 3000, "the new letter");
ok((await rows()).some(r => r.author === "Isi" && r.message === "Bis heute Abend 💗"), "the letter is saved with author and text");
await until(async () => (await authors()).length === 3, 3000, "the new envelope");
ok((await page.locator("#noteModal").isHidden()) && (await authors())[0] === "Von Isi", "the form closes and the new letter is on top");
await until(async () => (await page.evaluate(() => window.__mockInvocations || [])).length > 0, 3000, "the notification");
const notices = await page.evaluate(() => window.__mockInvocations);
ok(notices.some(i => i.body.category === "letters" && i.body.excludePerson === "Isi" && i.body.url === "wir.html?tab=briefe"), "Benji is notified and the notification opens the letters");

/* ---------- deleting ---------- */
await envelope("Von Benji").click();
await page.click("#deleteLetterBtn");
await page.click(".confirm-no");
ok((await rows()).length === 3 && await page.locator("#letterOverlay").isVisible(), "cancelling keeps the letter");
await page.click("#deleteLetterBtn");
await page.click(".confirm-yes");
await until(async () => (await rows()).length === 2, 3000, "deleting");
ok(!(await rows()).some(r => r.author === "Benji"), "confirming deletes exactly this letter");
await page.waitForSelector("#letterOverlay", { state: "hidden", timeout: 3000 });
ok(true, "and closes it");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/love_notes/reset", {});
console.log(`\n${n} assertions passed (Briefe)`);
