import { chromium } from "playwright";
import assert from "node:assert/strict";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));
const base = "http://localhost:9091/";

/* both tests start from an empty cloud; every chat is sealed with a passphrase the first time */
const BACKEND = "http://localhost:8991";
for (const t of ["chat_exports", "chat_chunks"]) await fetch(`${BACKEND}/t/${t}/reset`, { method: "POST" });
async function setPassphrase(page, phrase) {
  await page.waitForSelector("#chatPassModal:not(.hidden)");
  await page.fill("#passInput", phrase);
  await page.fill("#passConfirm", phrase);
  await page.click("#passSave");
  await page.waitForFunction(() => document.getElementById("chatCloud").textContent.includes("Für euch beide gespeichert"));
}

/* a small made-up chat in the Android export style */
const pad = v => String(v).padStart(2, "0");
const lines = ["27.11.25, 21:34 - Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt."];
const sayings = [
  ["Isi", "haha das war so lustig gestern Abend 😂"], ["Benji", "Ich liebe dich und vermisse dich total ❤️"],
  ["Isi", "Hast du Hunger? Wir könnten Pizza bestellen!"], ["Benji", "Bin gleich da, schatz, nur noch kurz tanken"],
  ["Isi", "Gute Nacht, schlaf gut und träum was Schönes"], ["Benji", "Danke für den schönen Tag heute, wirklich"]
];
for (let d = 0; d < 60; d++) {
  const day = new Date(2026, 0, 1 + d);
  for (let k = 0; k < 6; k++) {
    const [who, text] = sayings[(d + k) % sayings.length];
    lines.push(`${pad(day.getDate())}.${pad(day.getMonth() + 1)}.26, ${pad(9 + k)}:${pad((d * 7 + k * 3) % 60)} - ${who}: ${text}`);
  }
}
const file = { name: "WhatsApp Chat.txt", mimeType: "text/plain", buffer: Buffer.from(lines.join("\n"), "utf8") };

await page.goto(base + "games.html"); await page.waitForTimeout(300);
ok(await page.locator('a[href="chat.html"]').count() === 1, "the Games page links to Chat-Wrapped");

await page.goto(base + "chat.html"); await page.waitForTimeout(400);
ok(await page.locator("#chatUpload").isVisible() && await page.locator("#chatApp").isHidden(), "without an export the upload card is shown");
ok((await page.locator("#chatUpload .cu-privacy").innerText()).includes("verschlüsselt"), "it says the chat is stored encrypted");

/* nonsense is refused with a readable message */
await page.setInputFiles("#chatFileInput", { name: "foto.txt", mimeType: "text/plain", buffer: Buffer.from("das ist kein chat") });
await page.waitForTimeout(300);
ok((await page.locator("#chatUploadStatus").innerText()).includes("WhatsApp-Export"), "a file that is no chat gives an error message");

await page.setInputFiles("#chatFileInput", file);
await page.waitForSelector("#chatApp:not(.hidden)");
await setPassphrase(page, "Unser Geheimnis");
ok(await page.locator("#chatUpload").isHidden(), "after the upload the card gives way to the results");
ok((await page.locator("#chatSummary").innerText()).includes("360 Nachrichten"), "the summary counts 360 messages");

/* wrapped */
const cards = await page.locator(".cw-card").count();
ok(cards >= 6, `wrapped has ${cards} cards`);
const firstCard = await page.locator(".cw-card").first().innerText();
ok(firstCard.includes("360") && firstCard.includes("Nachrichten"), "the first card shows the message count");
await page.click("#wrappedNext"); await page.waitForTimeout(600);
ok(await page.locator(".cw-dot.active").getAttribute("data-index") === "1", "the next arrow moves to the second card");
const secondCard = await page.locator(".cw-card").nth(1).innerText();
ok(secondCard.includes("Isi") && secondCard.includes("Benji") && secondCard.includes("50 %"), "the second card splits the messages 50/50 between both");
const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
ok(widths[0] <= widths[1], "no sideways scrolling on a phone");
await page.screenshot({ path: "/tmp/chat-wrapped.png" });

/* quiz */
await page.click('.hub-tab[data-tab="quiz"]'); await page.waitForTimeout(200);
ok((await page.locator("#quizStage").innerText()).includes("Frage 1/10"), "the quiz starts with question 1 of 10");
let right = 0;
for (let round = 1; round <= 10; round++) {
  const bubble = await page.locator(".cq-quiz .cq-bubble").innerText();
  const guess = round % 2;
  await page.locator(".cq-answer").nth(guess).click();
  const feedback = await page.locator("#quizFeedback").innerText();
  ok(/Richtig|Leider/.test(feedback) && feedback.includes("Das war"), `round ${round}: the answer is explained (${bubble.slice(0, 20)}…)`);
  if (feedback.includes("Richtig")) right++;
  await page.click("#quizNext"); await page.waitForTimeout(80);
}
const result = await page.locator("#quizStage").innerText();
ok(result.includes(`${right}/10`), `the result shows the score ${right}/10`);
await page.click("#quizAgain");
ok((await page.locator("#quizStage").innerText()).includes("Frage 1/10"), "play again starts over");

/* quotes */
await page.click('.hub-tab[data-tab="quotes"]'); await page.waitForTimeout(200);
ok((await page.locator("#quoteStage").innerText()).toLowerCase().includes("zitat des tages"), "the quote of the day is shown");
const today1 = await page.locator(".cq-bubble").first().innerText();
await page.click("#quoteRandom");
ok((await page.locator("#quoteStage").innerText()).toLowerCase().includes("zufälliges zitat") && await page.locator("#quoteToday").count() === 1, "a random quote can be drawn, and the day's quote is one tap away");
await page.click("#quoteToday");
ok((await page.locator(".cq-bubble").first().innerText()) === today1, "back to the quote of the day shows the same quote");
await page.click('.cq-chip[data-filter="sweet"]');
ok((await page.locator(".cq-card .cq-bubble.main, .cq-line.main .cq-bubble").first().innerText()).match(/liebe|schatz|vermiss|❤/i) !== null, "the sweet filter only shows sweet messages");

/* awards and words */
await page.click('.hub-tab[data-tab="awards"]'); await page.waitForTimeout(200);
const awards = await page.locator(".ca-award").allInnerTexts();
ok(awards.length >= 3, `${awards.length} awards are handed out`);
ok(awards.some(a => a.toLowerCase().includes("romantiker") && a.includes("Benji")), "Benji is the romantic one");
ok(await page.locator(".ca-word").count() >= 5, "the word cloud shows words");
ok(await page.locator(".ca-typical-card").count() === 2, "each of them gets a „typical words“ list");
await page.screenshot({ path: "/tmp/chat-awards.png", fullPage: true });

/* stays on this device across a reload, and can be deleted */
await page.reload(); await page.waitForTimeout(600);
ok(await page.locator("#chatApp").isVisible() && (await page.locator("#chatSummary").innerText()).includes("360 Nachrichten"), "after a reload the saved chat is still there");
page.once("dialog", d => d.accept());
await page.click("#chatDeleteBtn"); await page.waitForTimeout(300);
ok(await page.locator("#chatUpload").isVisible() && await page.locator("#chatApp").isHidden(), "deleting returns to the upload card");
await page.reload(); await page.waitForTimeout(500);
ok(await page.locator("#chatUpload").isVisible(), "and the chat is really gone after a reload");

ok(errors.length === 0, "no script errors on the page: " + errors.join("; "));
await browser.close();
console.log(`\n${n} assertions passed`);
