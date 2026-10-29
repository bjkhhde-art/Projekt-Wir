import { chromium } from "playwright";
import assert from "node:assert/strict";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const base = "http://localhost:9091/chat.html";
const BACKEND = "http://localhost:8991";
for (const t of ["chat_exports", "chat_chunks"]) await fetch(`${BACKEND}/t/${t}/reset`, { method: "POST" });
const dump = async t => (await fetch(`${BACKEND}/t/${t}/dump`)).json();

async function phone(person) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  page.on("dialog", d => d.accept());
  return page;
}

const pad = v => String(v).padStart(2, "0");
/* the same day and slot always gives the same message, so exports of different ranges overlap exactly */
function chatOf(from, to, { names = ["Isi", "Benji"], extras = [] } = {}) {
  const lines = [];
  const add = (d, hour, minute, who, text) => {
    const day = new Date(2026, 0, 1 + d);
    lines.push(`${pad(day.getDate())}.${pad(day.getMonth() + 1)}.26, ${pad(hour)}:${pad(minute)} - ${names[who]}: ${text}`);
  };
  for (let d = from; d <= to; d++) {
    for (let k = 0; k < 6; k++) add(d, 9 + k, (d * 7 + k) % 60, (d + k) % 2, `Nachricht ${k} von Tag ${d}, ich liebe dich`);
    for (const e of extras) if (e.day === d) add(d, 20, 30, 0, e.text);
  }
  return { name: "WhatsApp Chat.txt", mimeType: "text/plain", buffer: Buffer.from(lines.join("\n"), "utf8") };
}
const summary = page => page.locator("#chatSummary").innerText();
const cloud = page => page.locator("#chatCloud").innerText();
const waitCloud = (page, text) => page.waitForFunction(t => document.getElementById("chatCloud").textContent.includes(t), text);

/* Benji uploads the first export: 30 days = 180 messages */
const benji = await phone("Benji");
await benji.goto(base); await benji.waitForTimeout(400);
await benji.setInputFiles("#chatFileInput", chatOf(0, 29));
await benji.waitForSelector("#chatPassModal:not(.hidden)");
await benji.fill("#passInput", "Geheim 2026"); await benji.fill("#passConfirm", "Geheim 2026"); await benji.click("#passSave");
await waitCloud(benji, "Für euch beide gespeichert");
ok((await summary(benji)).includes("180 Nachrichten"), "the first export gives 180 messages");

/* Isi opens it, then uploads her own export: days 20–44, and her phone calls the two differently */
const isi = await phone("Isi");
await isi.goto(base); await isi.waitForSelector("#chatUnlock:not(.hidden)");
await isi.fill("#chatUnlockInput", "Geheim 2026"); await isi.press("#chatUnlockInput", "Enter");
await isi.waitForSelector("#chatApp:not(.hidden)");
await isi.click("#chatReplaceBtn");
ok(await isi.locator("#chatReplaceWrap").isVisible() && !(await isi.locator("#chatReplaceMode").isChecked()), "„Neuer Export“ offers to compare, replacing is an opt-in");
await isi.setInputFiles("#chatFileInput", chatOf(20, 44, { names: ["Benji 💗", "Isi ❤️"].reverse() }));
await waitCloud(isi, "Abgeglichen");
ok((await summary(isi)).includes("270 Nachrichten"), "30 + 25 days with 10 days in common give 270 messages, not 330");
const note = await cloud(isi);
ok(note.includes("90 neue Nachrichten") && note.includes("90 neuer") && note.includes("60 waren schon da"), `the summary says what happened (${note.replace(/\n/g, " ")})`);
ok((await isi.locator("#chatSummary strong").innerText()).includes("Isi") && !(await isi.locator("#chatSummary strong").innerText()).includes("❤️"), "the names of the first chat stay (Isi & Benji, not the other phone's names)");

/* Benji gets it by himself */
await benji.reload(); await benji.waitForFunction(() => document.getElementById("chatSummary").textContent.includes("270 Nachrichten"));
ok(true, "Benji's phone has the combined chat (270) at the next visit");

/* the same export again: nothing new */
await isi.click("#chatReplaceBtn");
await isi.setInputFiles("#chatFileInput", chatOf(0, 29));
await waitCloud(isi, "Nichts Neues");
ok((await summary(isi)).includes("270 Nachrichten") && (await dump("chat_exports")).length === 1, "an export that is already in the chat changes nothing");

/* differences in the middle: three messages that only this export has, in days 5–7 */
const versionBefore = (await dump("chat_exports"))[0].version;
await isi.click("#chatReplaceBtn");
await isi.setInputFiles("#chatFileInput", chatOf(0, 44, { extras: [{ day: 5, text: "Extra A mitten drin" }, { day: 6, text: "Extra B mitten drin" }, { day: 7, text: "Extra C mitten drin" }] }));
await waitCloud(isi, "Abgeglichen");
const noteMiddle = await cloud(isi);
ok((await summary(isi)).includes("273 Nachrichten") && noteMiddle.includes("3 neue Nachrichten") && noteMiddle.includes("3 mitten im Verlauf"), `three messages in the middle are inserted (${noteMiddle.replace(/\n/g, " ")})`);
ok((await dump("chat_exports"))[0].version !== versionBefore, "and a new version went to the cloud");
await isi.click('.hub-tab[data-tab="quotes"]');
await isi.click('.cq-chip[data-filter="all"]');
ok(true, "the combined chat works in the other views");

/* somebody else's export is refused and nothing changes */
await isi.click("#chatReplaceBtn");
await isi.setInputFiles("#chatFileInput", { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from(Array.from({ length: 20 }, (_, i) => `05.03.26, 10:${pad(i)} - ${i % 2 ? "Anna" : "Tom"}: ganz andere Leute schreiben ganz anderes ${i}`).join("\n")) });
await isi.waitForFunction(() => document.getElementById("chatUploadStatus").textContent.includes("Namen"));
ok((await isi.locator("#chatUploadStatus").innerText()).includes("zu wenige gleiche Nachrichten"), "an export of other people is refused with a reason");
ok((await dump("chat_exports")).length === 1 && (await dump("chat_exports"))[0].message_count === 273, "and the shared chat stays as it was (273)");

/* replacing instead of comparing */
await isi.check("#chatReplaceMode");
await isi.setInputFiles("#chatFileInput", chatOf(0, 9));
await isi.waitForFunction(() => document.getElementById("chatSummary").textContent.includes("60 Nachrichten"));
await waitCloud(isi, "Für euch beide gespeichert");
ok((await dump("chat_exports"))[0].message_count === 60, "with „replace“ ticked the new export is the chat (60 messages)");

ok(errors.length === 0, "no script errors: " + errors.join("; "));
await browser.close();
console.log(`\n${n} assertions passed`);
