import { chromium } from "playwright";
import assert from "node:assert/strict";

/* "Nur für uns": share a link, rate it, comment on it – on two phones */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const links = async () => (await (await fetch(`${API}/t/private_links/dump`)).json());
const comments = async () => (await (await fetch(`${API}/t/private_link_comments/dump`)).json());
await post("/t/private_links/seed", { rows: [] });
await post("/t/private_link_comments/seed", { rows: [] });

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:9091" });
  await ctx.addInitScript(p => {
    localStorage.setItem("pw_person", p);
    if (!localStorage.getItem("pw_private_links_seen")) localStorage.setItem("pw_private_links_seen", "2020-01-01T00:00:00.000Z");
  }, person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/wir.html?tab=privat");
  await page.waitForTimeout(600);
  return page;
}
const isi = await open("Isi");
const benji = await open("Benji");

ok((await isi.locator(".hub-tab").allTextContents()).includes("🔥 Nur für uns"), "Wir has the 'Nur für uns' tab");
ok(await isi.locator("#openPrivateLinkModal").isVisible() && await isi.locator("#openWatchlistModal").isHidden(), "the + button shares a link on this tab");

/* sharing */
await isi.click("#openPrivateLinkModal");
await isi.fill("#privateLinkUrlInput", "javascript:alert(1)");
await isi.click("#savePrivateLinkBtn");
await wait(300);
ok((await links()).length === 0, "anything that is not a web link is refused");
await isi.fill("#privateLinkUrlInput", "example.com/video/123");
await isi.fill("#privateLinkTitleInput", "Für heute Abend <b>😏</b>");
await isi.click("#savePrivateLinkBtn");
await until(async () => (await links()).length === 1, 3000, "stored");
const stored = (await links())[0];
ok(stored.url === "https://example.com/video/123" && stored.added_by === "Isi", "a link without https:// is completed and stored");
await until(async () => (await isi.evaluate(() => (window.__mockInvocations || []).length)) > 0, 3000, "push sent");
const pushes = await isi.evaluate(() => window.__mockInvocations || []);
const push = pushes.find(p => p.body.url === "wir.html?tab=privat");
ok(push && push.body.excludePerson === "Isi" && !push.body.body.includes("example") && !push.body.body.includes("Abend"), "the notification is neutral – no link, no title on the lock screen");

/* Benji sees it live */
await until(async () => await benji.locator(".pl-card").count() === 1, 4000, "Benji sees the link");
ok(await benji.locator(".pl-new").count() === 1, "Benji sees it marked as new");
ok((await benji.locator(".pl-title").textContent()) === "Für heute Abend <b>😏</b>", "titles are shown as plain text");
const anchor = benji.locator(".pl-open");
ok(await anchor.getAttribute("href") === "https://example.com/video/123" && await anchor.getAttribute("target") === "_blank", "Öffnen opens the link in a new tab");
ok((await anchor.getAttribute("rel")).includes("noreferrer") && await anchor.getAttribute("referrerpolicy") === "no-referrer", "the other site does not learn where the visit came from");
await benji.click(".pl-copy");
await wait(300);
ok(await benji.evaluate(() => navigator.clipboard.readText()) === "https://example.com/video/123", "the link can be copied for a private tab");

/* duplicates */
await isi.click("#openPrivateLinkModal");
await isi.fill("#privateLinkUrlInput", "https://example.com/video/123");
await isi.click("#savePrivateLinkBtn");
await wait(300);
ok((await links()).length === 1, "the same link cannot be shared twice");
await isi.click("#closePrivateLinkModal");

/* rating + comments, with a half-written comment surviving live updates */
await benji.fill(".pl-comment-input", "Oh là là");
await isi.locator(".pl-flame[data-rate]").nth(2).click();
await until(async () => (await links())[0].rating_isi === 3, 3000, "Isi rated");
await wait(900);
ok(await benji.locator(".pl-comment-input").inputValue() === "Oh là là", "Benji's half-written comment survives Isi's rating");
ok(await benji.locator(".pl-rating-row").nth(1).locator(".pl-flame.on").count() === 3, "Benji sees Isi's 3 flames live");
await benji.locator(".pl-flame[data-rate]").nth(4).click();
await benji.locator(".pl-comment-send").click();
await until(async () => (await comments()).length === 1, 3000, "comment stored");
ok((await links())[0].rating_benji === 5, "Benji's rating is stored separately");
ok((await comments())[0].author === "Benji" && (await comments())[0].body === "Oh là là", "Benji's comment is stored");
await until(async () => await isi.locator(".pl-comment").count() === 1, 4000, "Isi sees comment");
ok((await isi.locator(".pl-comment-author").textContent()) === "Benji", "Isi sees Benji's comment live");
ok(await benji.locator(".pl-comment-input").inputValue() === "", "the comment field empties after sending");
await isi.locator(".pl-flame[data-rate]").nth(2).click();
await until(async () => (await links())[0].rating_isi === null, 3000, "rating removed");
ok(true, "tapping your own rating again removes it");

/* hold the card → edit / delete */
const box = await isi.locator(".pl-title").boundingBox();
await isi.mouse.move(box.x + 20, box.y + box.height / 2);
await isi.mouse.down();
await wait(650);
await isi.mouse.up();
await wait(200);
ok(await isi.locator("#privateLinkEditExtras").isVisible(), "holding a card opens edit with delete");
await isi.click("#deletePrivateLinkBtn");
await isi.click(".confirm-yes");
await until(async () => (await links()).length === 0, 3000, "deleted");
await until(async () => await benji.locator(".pl-card").count() === 0, 4000, "gone on Benji's phone");
ok(true, "deleting removes the link on both phones");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (private links: share, rate, comment)`);
