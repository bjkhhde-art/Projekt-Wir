import { chromium } from "playwright";
import assert from "node:assert/strict";

/* "Nur für uns" → 🎲 Zufall: a random link from our list, or something new via random-video */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const links = async () => (await (await fetch(`${API}/t/private_links/dump`)).json());
const link = (id, title, tags, extra = {}) => ({
  id, url: `https://example.com/${id}`, title, tags, added_by: "Benji", preview_status: "none", preview_image: null,
  rating_isi: null, rating_benji: null, created_at: new Date(Date.now() - id * 60000).toISOString(), ...extra
});
await post("/t/private_links/seed", { rows: [
  link(1, "Alpha", ["lustig", "pov"], { rating_isi: 4, preview_status: "ok", preview_image: "/icons/icon-512.png" }),
  link(2, "Bravo", ["lustig"]),
  link(3, "Charlie", [])
] });
await post("/t/private_link_comments/seed", { rows: [] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  localStorage.setItem("pw_person", "Isi");
  /* the random-video function, answered by the test: window.__videoAnswers is a queue */
  window.__mockFunctionResponses = {
    "random-video": body => (window.__videoAnswers && window.__videoAnswers.length ? window.__videoAnswers.shift() : { status: "error" })
  };
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:9091/wir.html?tab=privat");
await page.waitForTimeout(700);

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const video = (id, extra = {}) => ({
  status: "ok",
  video: { url: `https://www.eporner.com/video-${id}/clip/`, title: `Heißer <b>Clip</b> ${id}`, length: "12:34", rating: 4.6, views: 1234567, thumb: PNG, keywords: [], ...extra }
});
const queue = answers => page.evaluate(a => { window.__videoAnswers = a; }, answers);
const invocations = () => page.evaluate(() => (window.__mockInvocations || []).filter(i => i.name === "random-video"));
const resultTitle = async () => (await page.locator("#diceResult .pl-dice-title").textContent()).trim();
const roll = async () => { await page.click("#diceRollBtn"); await wait(150); };
const chip = tag => page.locator(`#diceTagChips .pl-tag[data-tag="${tag}"]`);

await page.click("#openDiceModal");
ok(await page.locator("#diceModal").isVisible(), "🎲 Zufall opens the dice");
ok(await page.locator('.pl-dice-mode[data-mode="ours"]').evaluate(el => el.classList.contains("selected")) && await page.locator("#diceOurs").isVisible(), "it starts with 'Aus unserer Liste'");

/* from our list */
await chip("lustig").click();
const picks = [];
for (let i = 0; i < 4; i++) {
  await roll();
  picks.push(await resultTitle());
}
ok(picks.every(t => t === "Alpha" || t === "Bravo"), `only links with #lustig come up (${picks.join(", ")})`);
ok(picks.every((t, i) => i === 0 || t !== picks[i - 1]), "the same link does not come twice in a row");
ok((await page.locator("#diceRollBtn").textContent()).includes("Nochmal"), "after a roll the button says 'Nochmal'");
await page.check("#diceUnrated");
await roll();
ok(await resultTitle() === "Bravo", "'nur noch nicht bewertet' leaves out what Isi rated");
await chip("pov").click();
await roll();
ok((await page.locator("#diceResult .pl-dice-empty").textContent()).includes("schon alles bewertet"), "if nothing fits, it says so");
await chip("pov").click();
await roll();
const shownPicture = await page.locator("#diceResult .pl-dice-thumb").count();
ok(await resultTitle() === "Bravo" && shownPicture === 0, "links without a stored picture show no picture");

/* 'Zur Karte' finds the card even when the list filter hides it */
await page.click("#closeDiceModal");
await page.locator('.pl-filter-tag[data-tag="pov"]').click();
ok((await page.locator(".pl-card").count()) === 1, "the list is filtered to #pov");
await page.click("#openDiceModal");
await roll();
await page.click("#diceResult .pl-dice-goto");
await wait(300);
ok(await page.locator("#diceModal").isHidden() && await page.locator(".pl-card").count() === 3, "'Zur Karte' closes the dice and lifts the filter");
ok(await page.locator('.pl-card[data-id="2"]').evaluate(el => el.classList.contains("pl-flash")), "the card lights up");

/* something new */
await page.click("#openDiceModal");
await page.uncheck("#diceUnrated");
await page.click('.pl-dice-mode[data-mode="new"]');
ok(await page.locator("#diceNew").isVisible() && await page.locator("#diceOurs").isHidden(), "'Etwas Neues' switches the panel");
ok(await page.locator("#diceQueryChips .pl-tag").count() === 2, "our hashtags are offered as search words");
await queue([video("a"), video("b")]);
await page.fill("#diceQuery", "Massage");
await page.press("#diceQuery", "Enter");
await page.waitForSelector("#diceResult .pl-dice-title");
let calls = await invocations();
ok(calls.length === 1 && calls[0].body.query === "Massage", "the search word goes to the random-video function");
ok(["https://example.com/1", "https://example.com/2", "https://example.com/3"].every(u => calls[0].body.exclude.includes(u)), "links we already have are excluded");
ok(await resultTitle() === "Heißer <b>Clip</b> a", "the title is shown as plain text");
ok((await page.locator("#diceResult .pl-meta").textContent()) === "⏱ 12:34 · ⭐ 4,6 · 1,2 Mio. Aufrufe", "length, rating and views are shown");
ok((await page.locator("#diceResult .pl-dice-thumb").getAttribute("src")).startsWith("data:image/png;base64,"), "the picture comes with the answer, not from the site");
const open = page.locator("#diceResult .pl-open");
ok(await open.getAttribute("href") === "https://www.eporner.com/video-a/clip/" && (await open.getAttribute("rel")).includes("noreferrer") && await open.getAttribute("target") === "_blank", "Öffnen opens the video in a new tab without a trace to us");
await roll();
await page.waitForFunction(() => document.querySelector("#diceResult .pl-dice-title")?.textContent.endsWith("</b> b"));
calls = await invocations();
ok(calls[1].body.exclude.includes("https://www.eporner.com/video-a/clip/"), "'Nochmal' does not suggest the same video again");

/* taking it over into our list */
await page.click("#diceResult .pl-dice-take");
ok(await page.locator("#diceModal").isHidden() && await page.locator("#privateLinkModal").isVisible(), "'In unsere Liste' opens the share sheet");
ok(await page.locator("#privateLinkUrlInput").inputValue() === "https://www.eporner.com/video-b/clip/" && await page.locator("#privateLinkTitleInput").inputValue() === "Heißer <b>Clip</b> b", "link and title are filled in");
ok((await page.locator("#privateLinkTagChips .pl-tag").allTextContents()).map(t => t.replace("×", "").trim()).join() === "#massage", "the search word becomes a hashtag");
await page.click("#savePrivateLinkBtn");
await wait(700);
const stored = (await links()).find(l => l.url === "https://www.eporner.com/video-b/clip/");
ok(stored && stored.added_by === "Isi" && JSON.stringify(stored.tags) === '["massage"]', "it is stored as our link");
ok(await page.evaluate(id => (window.__mockInvocations || []).some(i => i.name === "link-preview" && i.body.linkId === id), stored.id), "and gets its preview picture like any shared link");

/* answers that cannot be used */
await page.click("#openDiceModal");
ok(await page.locator('.pl-dice-mode[data-mode="new"]').evaluate(el => el.classList.contains("selected")), "the dice remembers the last mode");
await queue([{ status: "none" }]);
await roll();
await page.waitForSelector("#diceResult .pl-dice-empty");
ok((await page.locator("#diceResult .pl-dice-empty").textContent()).includes("„Massage“ gibt es nichts Neues"), "no result: try another word");
await queue([video("x", { url: "https://evil.example/x" })]);
await roll();
await wait(300);
ok((await page.locator("#diceResult .pl-dice-empty").textContent()).includes("antwortet gerade nicht") && await page.locator("#diceResult .pl-open").count() === 0, "a suggestion that is not on eporner is never shown");
await queue([video("y", { thumb: "javascript:alert(1)" })]);
await roll();
await page.waitForSelector("#diceResult .pl-dice-title");
ok(await page.locator("#diceResult .pl-dice-thumb").count() === 0, "a picture that is not an image is left out");
await queue([]);
await roll();
await wait(300);
ok((await page.locator("#diceResult .pl-dice-empty").textContent()).includes("antwortet gerade nicht"), "when the function fails, it says so");
ok(await page.locator("#diceRollBtn").isEnabled(), "and you can roll again");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (private links: dice)`);
