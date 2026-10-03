import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Core = require("../../mochi-core.js");

/* Isi and Benji on two phones: live sync, wishes, streak, double cuddle, messenger, chest, taps */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const API = "http://localhost:8991";
const base = "http://localhost:9091/";
const DAY = "2026-11-09"; // wishes that day: shower, cuddle, feed:Avocado
const TIME = new Date("2026-11-09T14:00:00+01:00");
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const petRow = async () => (await (await fetch(API + "/t/pet_state/dump")).json())[0];
const messages = async () => (await (await fetch(API + "/t/mochi_messages/dump")).json());

async function until(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await wait(150);
  }
  throw new Error("timed out: " + label);
}

await post("/t/mochi_messages/seed", { rows: [] });
await post("/t/pet_state/seed", { rows: [{
  id: "shared", version: 0, hunger: 50, energy: 80, cleanliness: 80, bond: 50, coins: 100, care_score: 30,
  total_care_actions: 40, total_coins_earned: 150, owned_items: [], room_decor: [], daily: {}, streak_days: 3,
  best_streak: 3, streak_last_date: Core.shiftDay(DAY, -1), wishes_fulfilled: 0, messages_sent: 0, double_cuddles: 0,
  updated_at: TIME.toISOString(), created_at: TIME.toISOString(), last_interacted_by: "Isi"
}] });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function open(person) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: TIME });
  await ctx.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  await page.goto(base + "mochi.html");
  await page.clock.resume();
  return page;
}
const isi = await open("Isi");
const benji = await open("Benji");
await wait(1500);

/* wishes are the same on both phones */
const expected = Core.wishesFor(DAY).map(w => w.text);
for (const [name, page] of [["Isi", isi], ["Benji", benji]]) {
  const texts = await page.locator(".wish-text").allTextContents();
  ok(JSON.stringify(texts) === JSON.stringify(expected), `${name} sees today's three wishes (${texts.length})`);
}
ok(await isi.locator("#streakCount").textContent() === "3", "the streak from yesterday is still shown (3)");

/* presence */
await until(async () => !(await isi.locator("#togetherBanner").evaluate(el => el.classList.contains("hidden"))), 5000, "Isi sees Benji");
await until(async () => !(await benji.locator("#togetherBanner").evaluate(el => el.classList.contains("hidden"))), 5000, "Benji sees Isi");
ok((await isi.locator("#togetherBanner").textContent()).includes("Benji"), "Isi sees that Benji is with Mochi right now");
ok((await benji.locator("#togetherBanner").textContent()).includes("Isi"), "Benji sees that Isi is with Mochi right now");

/* Benji fulfils the food wish; Isi's phone updates live */
let before = await petRow();
await benji.click("#feedBtn");
await benji.click('.food-btn[data-food="Avocado"]');
await until(async () => (await petRow()).daily.wishes_done?.["feed:Avocado"] === "Benji", 4000, "wish stored");
let row = await petRow();
ok(row.coins === before.coins + 3 + Core.WISH_REWARD, `feeding the wished avocado pays 3 + ${Core.WISH_REWARD} coins`);
await until(async () => (await isi.locator(".wish-item.done .wish-state").allTextContents()).some(t => t.includes("Benji")), 4000, "Isi sees the wish done");
ok(true, "Isi's phone shows the wish as fulfilled by Benji without reloading");
await until(async () => await isi.locator("#coinCount").textContent() === String(row.coins), 4000, "coins live");
ok(true, "Isi's coin counter updates live");
ok(await isi.locator("#streakCount").textContent() === "3", "only Benji was here today, the streak has not grown yet");

/* Isi strokes Mochi: both were here today → streak 4 */
const box = await isi.locator("#petCreature").boundingBox();
await isi.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
await isi.mouse.down();
for (let i = 0; i < 12; i++) await isi.mouse.move(box.x + box.width * (0.3 + (i % 2) * 0.4), box.y + box.height * 0.6, { steps: 4 });
await isi.mouse.up();
await until(async () => (await petRow()).streak_days === 4, 4000, "streak 4");
row = await petRow();
ok(row.streak_last_date === DAY && row.best_streak === 4, "the streak is now 4 days and the best streak follows");
await until(async () => await benji.locator("#streakCount").textContent() === "4", 4000, "Benji streak 4");
ok(true, "Benji's phone shows the streak 4 live");
ok((await isi.locator("#streakLine").textContent()).includes("Isi ✓ · Benji ✓"), "today's line shows both of us ✓");

/* double cuddle: Benji holds Mochi, then Isi within a few seconds */
async function openEnvelope(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3500); // let toasts fade so they do not cover the bouncing envelope
  await page.click("#mailEnvelope", { force: true });
}

async function longPress(page) {
  const b = await page.locator("#petCreature").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.6);
  await page.mouse.down();
  await wait(1100);
  await page.mouse.up();
}
await wait(3200); // pet cooldown
await longPress(benji);
await wait(1200);
await longPress(isi);
await until(async () => (await petRow()).double_cuddles === 1, 5000, "double cuddle stored");
ok(true, "holding Mochi at the same time counts as a double cuddle");
await until(async () => (await benji.locator(".toast").allTextContents()).some(t => t.includes("Doppelknuddler")), 4000, "Benji toast");
ok((await isi.locator(".toast").allTextContents()).some(t => t.includes("Doppelknuddler")), "both phones celebrate the double cuddle");
row = await petRow();
ok(row.daily.wishes_done.cuddle === "Benji", "the first cuddle also fulfilled Mochi's cuddle wish");
await wait(600);
ok((await petRow()).double_cuddles === 1, "the double cuddle bonus is booked exactly once");

/* messenger: Isi sends a kiss, Benji opens it */
await isi.click("#messengerBtn");
await isi.click('.messenger-kind[data-kind="kiss"]');
await isi.click("#sendMessenger");
await until(async () => (await messages()).length === 1, 3000, "message stored");
let msgs = await messages();
ok(msgs[0].from_person === "Isi" && msgs[0].to_person === "Benji" && msgs[0].kind === "kiss" && !msgs[0].delivered_at, "Isi's kiss is on its way to Benji");
await until(async () => (await isi.evaluate(() => (window.__mockInvocations || []).some(i => i.body.title.includes("Post")))), 3000, "push sent");
const pushes = await isi.evaluate(() => window.__mockInvocations || []);
ok(pushes.some(p => p.body.category === "mochi" && p.body.url === "mochi.html" && p.body.excludePerson === "Isi" && p.body.body.includes("Küsschen")), "Benji gets a push about the kiss");
await until(async () => !(await benji.locator("#mailEnvelope").evaluate(el => el.classList.contains("hidden"))), 4000, "envelope");
ok(true, "Mochi shows Benji an envelope");
await openEnvelope(benji);
await benji.waitForTimeout(300);
const deliveryTitleText = await benji.locator("#deliveryTitle").textContent();
ok(deliveryTitleText === "Isi schickt dir ein Küsschen 💋", `opening it shows Isi's kiss (${deliveryTitleText})`);
await benji.click("#closeDelivery");
await until(async () => !!(await messages())[0].delivered_at, 3000, "delivered");
ok(true, "the kiss is marked as delivered");
ok(await benji.locator("#mailEnvelope").evaluate(el => el.classList.contains("hidden")), "the envelope disappears");
row = await petRow();
ok(row.messages_sent === 1, "the message counts for the Liebesbote achievement");

/* a long letter is capped at 140 characters */
await benji.click("#messengerBtn");
await benji.click('.messenger-kind[data-kind="note"]');
ok(await benji.locator("#sendMessenger").isDisabled(), "an empty letter cannot be sent");
await benji.fill("#messengerNote", "Ich hab dich lieb ".repeat(20));
await benji.click("#sendMessenger");
await until(async () => (await messages()).length === 2, 3000, "letter stored");
msgs = await messages();
ok(msgs[1].note.length <= 140 && msgs[1].kind === "note", `letters are capped (${msgs[1].note.length} characters)`);
await until(async () => !(await isi.locator("#mailEnvelope").evaluate(el => el.classList.contains("hidden"))), 4000, "Isi envelope");
await openEnvelope(isi);
await isi.waitForTimeout(300);
ok((await isi.locator("#deliveryNote").textContent()).includes("Ich hab dich lieb"), "Isi reads Benji's letter");
await isi.click("#replyDelivery");
await until(async () => (await messages()).length === 3, 3000, "reply stored");
ok((await messages())[2].kind === "kiss" && (await messages())[2].to_person === "Benji", "'Küsschen zurück' sends a kiss straight back");

/* chest */
before = await petRow();
ok(await isi.locator("#chestBtn").evaluate(el => el.classList.contains("has-gift")), "the chest waits for Isi");
await isi.click("#chestBtn");
await isi.click("#chestOpenBtn");
await until(async () => (await petRow()).daily.chest?.Isi !== undefined, 4000, "chest");
row = await petRow();
ok(row.coins === before.coins + row.daily.chest.Isi && row.daily.chest.Isi >= 5, `Isi found ${row.daily.chest.Isi} coins in the chest`);
await isi.click("#closeChest");
await isi.click("#chestBtn");
ok((await isi.locator("#chestText").textContent()).includes("schon geöffnet") && await isi.locator("#chestOpenBtn").isDisabled(), "the chest opens only once a day");
await isi.click("#closeChest");
await wait(600);
ok(await benji.locator("#chestBtn").evaluate(el => el.classList.contains("has-gift")), "Benji still has his own chest");

/* both act at the very same moment: nothing gets lost */
before = await petRow();
await Promise.all([isi, benji].map(async page => {
  await page.click("#feedBtn");
  await page.click('.food-btn[data-food="Apfel"]');
}));
await until(async () => (await petRow()).total_care_actions === before.total_care_actions + 2, 6000, "both writes");
row = await petRow();
ok(row.coins === before.coins + 6, `simultaneous feeding by both keeps both rewards (${before.coins} → ${row.coins})`);

/* personality */
await wait(1600);
await isi.evaluate(() => window.scrollTo(0, 0));
await isi.evaluate(() => {
  window.__speech = [];
  new MutationObserver(() => window.__speech.push(document.getElementById("mochiSpeech").textContent))
    .observe(document.getElementById("mochiSpeech"), { childList: true, characterData: true, subtree: true });
});
const c = await isi.locator("#petCreature").boundingBox();
for (let i = 0; i < 5; i++) {
  await isi.mouse.click(c.x + c.width / 2, c.y + c.height * 0.7);
  await wait(120);
}
await wait(150);
const spoken = await isi.evaluate(() => window.__speech);
ok(spoken.some(t => t.includes("Hatschi")), `five quick taps make Mochi sneeze (${spoken.join(" / ")})`);
await isi.mouse.move(5, c.y + c.height * 0.6, { steps: 8 });
await wait(250);
const eye = await isi.locator("#petEyeLeft").evaluate(el => el.style.transform);
ok(eye.startsWith("translate(-"), `Mochi's eyes follow the finger to the left (${eye})`);

ok(errors.length === 0, "no page errors: " + errors.join(" | "));
await browser.close();
console.log(`\n${n} assertions passed (mochi: together, wishes, messenger, chest)`);
