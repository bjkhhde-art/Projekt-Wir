import { chromium } from "playwright";
import assert from "node:assert/strict";

/* "Nur für uns": own hashtags – set while sharing, edit on the card, filter by them */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const links = async () => (await (await fetch(`${API}/t/private_links/dump`)).json());
const byUrl = async url => (await links()).find(l => l.url === url);
const link = (id, url, title, tags, minutesAgo) => ({
  id, url, title, tags, added_by: "Benji", preview_status: "none", preview_image: null,
  created_at: new Date(Date.now() - minutesAgo * 60000).toISOString()
});
await post("/t/private_links/seed", { rows: [
  link(1, "https://example.com/a", "Alpha", ["lustig", "pov"], 30),
  link(2, "https://example.com/b", "Bravo", ["lustig"], 20),
  link(3, "https://example.com/c", "Charlie", [], 10)
] });
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
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto("http://localhost:9091/wir.html?tab=privat");
  await page.waitForTimeout(600);
  return page;
}
const isi = await open("Isi");
const benji = await open("Benji");

const titles = page => page.locator(".pl-title").allTextContents();
const barChip = (page, tag) => page.locator(`.pl-filter-tag[data-tag="${tag}"]`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* tags on the cards and in the filter bar */
const bar = (await isi.locator(".pl-filter-tag").allTextContents()).map(t => t.replace(/\s+/g, " ").trim());
ok(same(bar, ["#lustig 2", "#pov 1"]), `the filter bar lists the tags in use, most used first (${bar.join(", ")})`);
ok(same(await isi.locator('.pl-card[data-id="1"] .pl-tag').allTextContents(), ["#lustig", "#pov"]), "each card shows its hashtags");
ok((await isi.locator('.pl-card[data-id="3"] .pl-tag-add').textContent()).includes("Hashtag"), "a card without tags offers to add one");

/* filtering */
await barChip(isi, "lustig").click();
ok(same(await titles(isi), ["Bravo", "Alpha"]), "#lustig shows only those links");
ok((await isi.locator("#privateTagResult").textContent()) === "2 von 3", "the result count is shown");
await barChip(isi, "pov").click();
ok(same(await titles(isi), ["Alpha"]), "a second tag narrows further (both tags needed)");
await isi.locator('.pl-card[data-id="1"] .pl-tag[data-tag="pov"]').click();
ok(same(await titles(isi), ["Bravo", "Alpha"]) && !(await barChip(isi, "pov").getAttribute("class")).includes("selected"), "tapping a tag on a card toggles that filter too");
await isi.click("#privateTagReset");
ok(same(await titles(isi), ["Charlie", "Bravo", "Alpha"]) && await isi.locator("#privateTagReset").count() === 0, "'Alle zeigen' clears the filter");
await barChip(isi, "pov").click();
await isi.reload();
await isi.waitForTimeout(700);
ok(same(await titles(isi), ["Alpha"]), "the chosen tags are remembered on this phone");
await isi.click("#privateTagReset");

/* sharing with tags: typed ones, a suggestion, and a word left in the field */
await isi.click("#openPrivateLinkModal");
ok(await isi.locator("#privateLinkTagSuggestions .pl-tag-suggestion").count() === 2, "the sheet suggests the tags we already use");
await isi.fill("#privateLinkUrlInput", "https://example.com/d");
await isi.click("#privateLinkTagInput");
await isi.keyboard.type("#Outdoor ");
ok(same(await isi.locator("#privateLinkTagChips .pl-tag").allTextContents().then(t => t.map(x => x.replace("×", "").trim())), ["#outdoor"]), "space turns '#Outdoor' into the tag #outdoor");
await isi.keyboard.type("lus");
ok((await isi.locator("#privateLinkTagSuggestions .pl-tag-suggestion").allTextContents())[0] === "#lustig", "typing filters the suggestions");
await isi.locator('#privateLinkTagSuggestions .pl-tag-suggestion[data-tag="lustig"]').click();
ok(await isi.locator("#privateLinkTagInput").inputValue() === "", "picking a suggestion replaces the half-typed word");
await isi.keyboard.type("wild");
await isi.click("#savePrivateLinkBtn");
await until(async () => !!(await byUrl("https://example.com/d")), 3000, "stored");
ok(same((await byUrl("https://example.com/d")).tags, ["outdoor", "lustig", "wild"]), "tags are stored with the link, including the word still in the field (not 'lus')");

/* Benji sees the new tags live and adds one to an untagged card */
await until(async () => await barChip(benji, "wild").count() === 1, 4000, "Benji sees #wild");
ok(true, "the other phone gets the new tags live");
await benji.locator('.pl-card[data-id="3"] .pl-tag-add').click();
ok(await benji.locator("#privateLinkModal").isVisible() && await benji.evaluate(() => document.activeElement.id) === "privateLinkTagInput", "＃ Hashtag opens the sheet with the tag field ready");
await benji.keyboard.type("neu,");
await benji.keyboard.type("weg");
await benji.keyboard.press("Backspace");
await benji.keyboard.press("Backspace");
await benji.keyboard.press("Backspace");
await benji.keyboard.press("Backspace");
ok(await benji.locator("#privateLinkTagChips .pl-tag").count() === 0, "backspace in the empty field removes the last tag");
await benji.keyboard.type("neu");
await benji.keyboard.press("Enter");
await benji.keyboard.press("Enter");
await until(async () => same((await links()).find(l => l.id === 3).tags, ["neu"]), 3000, "tag saved");
ok(true, "Enter adds the tag, a second Enter saves");

/* removing a tag; a filter on a tag that disappears is dropped */
await barChip(benji, "pov").click();
ok(same(await titles(benji), ["Alpha"]), "Benji filters by #pov");
await isi.locator('.pl-card[data-id="1"] .pl-title').evaluate(el => el.scrollIntoView({ block: "center" }));
await wait(300);
const box = await isi.locator('.pl-card[data-id="1"] .pl-title').boundingBox();
await isi.mouse.move(box.x + 20, box.y + box.height / 2);
await isi.mouse.down();
await wait(650);
await isi.mouse.up();
await isi.locator('#privateLinkTagChips .pl-tag-remove[data-tag="pov"]').click();
await isi.click("#savePrivateLinkBtn");
await until(async () => same((await links()).find(l => l.id === 1).tags, ["lustig"]), 3000, "pov removed");
ok(true, "holding a card lets you remove a tag");
await until(async () => (await titles(benji)).length === 4, 4000, "Benji's filter falls back");
ok(await barChip(benji, "pov").count() === 0, "a tag nobody uses any more leaves the bar and the filter");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (private links: hashtags)`);
