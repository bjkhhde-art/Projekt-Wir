import { chromium } from "playwright";
import assert from "node:assert/strict";

/* Briefe, found in the test report: a letter is from whoever uses the phone, and the other one is notified */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rows = async () => (await (await fetch(`${API}/t/love_notes/dump`)).json());

await post("/t/love_notes/seed", { rows: [] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => localStorage.setItem("pw_person", "Benji"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));

await page.goto("http://localhost:9091/wir.html?tab=briefe");
await page.waitForSelector("#openNoteModal");
await page.click("#openNoteModal");
ok(await page.inputValue("#noteAuthorInput") === "Benji", "on Benji's phone a new letter is from Benji");
await page.fill("#noteMessageInput", "Gute Nacht 🌙");
await page.click("#sendNoteBtn");
await page.waitForFunction(() => (window.__mockInvocations || []).some(i => i.body.category === "letters"));
ok((await rows())[0].author === "Benji", "the letter is saved as Benji's");
const notice = (await page.evaluate(() => window.__mockInvocations)).find(i => i.body.category === "letters");
ok(notice.body.excludePerson === "Benji", "the notification goes to Isi, not to Benji's own phone");

/* a phone that does not know its owner yet: the author chosen in the form counts as the sender */
const unknownCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const unknown = await unknownCtx.newPage();
unknown.on("pageerror", e => errors.push(e.message));
await unknown.goto("http://localhost:9091/wir.html?tab=briefe");
await unknown.waitForSelector("#openNoteModal");
await unknown.evaluate(() => { const m = document.getElementById("personModal"); if (m) m.classList.add("hidden"); });
await unknown.click("#openNoteModal");
await unknown.selectOption("#noteAuthorInput", "Isi");
await unknown.fill("#noteMessageInput", "Hallo");
await unknown.click("#sendNoteBtn");
await unknown.waitForFunction(() => (window.__mockInvocations || []).some(i => i.body.category === "letters"));
const second = (await unknown.evaluate(() => window.__mockInvocations)).find(i => i.body.category === "letters");
ok(second.body.excludePerson === "Isi", "without 'Wer bin ich' the chosen author counts as the sender");

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
await post("/t/love_notes/reset", {});
console.log(`\n${n} assertions passed (Briefe: sender)`);
