import { chromium } from "playwright";
import assert from "node:assert/strict";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
const base = "http://localhost:9091/chat.html";
const BACKEND = "http://localhost:8991";
for (const t of ["chat_exports", "chat_chunks"]) await fetch(`${BACKEND}/t/${t}/reset`, { method: "POST" });
const dump = async t => (await fetch(`${BACKEND}/t/${t}/dump`)).json();

/* every phone is its own browser context: own storage, own saved passphrase */
async function phone(person) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(p => localStorage.setItem("pw_person", p), person);
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(person + ": " + e.message));
  page.on("dialog", d => d.accept());
  return page;
}

const pad = v => String(v).padStart(2, "0");
function chatOf(days, who) {
  const lines = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(2026, 0, 1 + d);
    for (let k = 0; k < 6; k++) {
      const name = (d + k) % 2 ? "Isi" : "Benji";
      const text = k === 0 ? `Geheimer Satz ${who} Tag ${d} mit Pizza und Hunger` : `Nachricht ${k} von Tag ${d}, ich liebe dich`;
      lines.push(`${pad(day.getDate())}.${pad(day.getMonth() + 1)}.26, ${pad(9 + k)}:${pad((d * 7 + k) % 60)} - ${name}: ${text}`);
    }
  }
  return { name: "WhatsApp Chat.txt", mimeType: "text/plain", buffer: Buffer.from(lines.join("\n"), "utf8") };
}
const cloudText = page => page.locator("#chatCloud").innerText();

/* Benji uploads and picks the passphrase */
const benji = await phone("Benji");
await benji.goto(base); await benji.waitForTimeout(500);
await benji.setInputFiles("#chatFileInput", chatOf(60, "A"));
await benji.waitForSelector("#chatPassModal:not(.hidden)");
ok((await benji.locator("#passTitle").innerText()).includes("festlegen"), "the first upload asks to choose a chat passphrase");
await benji.fill("#passInput", "abc"); await benji.fill("#passConfirm", "abc"); await benji.click("#passSave");
ok((await benji.locator("#passError").innerText()).includes("6 Zeichen"), "a too short passphrase is refused");
await benji.fill("#passInput", "Geheim 2026"); await benji.fill("#passConfirm", "Geheim 2027"); await benji.click("#passSave");
ok((await benji.locator("#passError").innerText()).includes("nicht gleich"), "two different entries are refused (no typo can lock them out)");
await benji.fill("#passConfirm", "Geheim 2026"); await benji.click("#passSave");
await benji.waitForFunction(() => document.getElementById("chatCloud").textContent.includes("Für euch beide gespeichert"));
ok((await cloudText(benji)).includes("von Benji"), "Benji sees that the chat is saved for both of them");

/* what is in the database is unreadable */
const exports1 = await dump("chat_exports");
const chunks1 = await dump("chat_chunks");
ok(exports1.length === 1 && exports1[0].id === "shared" && exports1[0].uploaded_by === "Benji" && exports1[0].message_count === 360, "one shared entry from Benji with 360 messages");
ok(chunks1.length === exports1[0].chunk_count && chunks1.every(c => c.version === exports1[0].version), "the stored pieces belong to that version");
const stored = JSON.stringify(chunks1) + JSON.stringify(exports1);
ok(!/Geheimer Satz|Pizza|Hunger|liebe dich|Isi|Benji.*Tag/.test(stored.replace(/"uploaded_by":"Benji"/, "")) && !stored.includes(Buffer.from("Pizza").toString("base64").slice(0, 6)), "the database holds no readable part of the chat");

/* Isi: nothing yet on this phone → locked card; wrong passphrase, then the right one */
const isi = await phone("Isi");
await isi.goto(base); await isi.waitForSelector("#chatUnlock:not(.hidden)");
ok((await isi.locator("#chatUnlockText").innerText()).includes("Benji") && await isi.locator("#chatUpload").isHidden(), "Isi is told Benji put a chat in the cloud and asked for the passphrase");
await isi.fill("#chatUnlockInput", "falsch");
await isi.press("#chatUnlockInput", "Enter");
await isi.waitForFunction(() => document.getElementById("chatUnlockStatus").textContent.includes("nicht das richtige"));
ok(await isi.locator("#chatApp").isHidden(), "a wrong passphrase shows nothing");
await isi.fill("#chatUnlockInput", "Geheim 2026");
await isi.press("#chatUnlockInput", "Enter");
await isi.waitForSelector("#chatApp:not(.hidden)");
ok((await isi.locator("#chatSummary").innerText()).includes("360 Nachrichten"), "with the right passphrase Isi sees the chat (360 messages)");
ok((await cloudText(isi)).includes("von Benji"), "and that it came from Benji");
await isi.reload(); await isi.waitForSelector("#chatApp:not(.hidden)");
ok(await isi.locator("#chatUnlock").isHidden() && (await isi.locator("#chatSummary").innerText()).includes("360 Nachrichten"), "after a reload no passphrase is asked again");
await isi.click('.hub-tab[data-tab="quotes"]');
ok((await isi.locator("#quoteStage").innerText()).length > 20, "the quotes work on Isi's phone too");

/* Benji uploads a newer, smaller chat: Isi gets it by itself at the next visit */
await benji.setInputFiles("#chatFileInput", chatOf(20, "B"));
await benji.waitForFunction(() => document.getElementById("chatSummary").textContent.includes("120 Nachrichten"));
for (let tries = 0; tries < 100; tries++) {
  const [row] = await dump("chat_exports");
  if (row && row.version !== exports1[0].version) break;
  await new Promise(r => setTimeout(r, 100));
}
await benji.waitForFunction(() => document.getElementById("chatCloud").textContent.includes("Für euch beide gespeichert"));
ok((await dump("chat_exports")).length === 1 && (await dump("chat_chunks")).every(c => c.version === exports1[0].version ? false : true), "the new version replaced the old one, old pieces are gone");
await isi.reload(); await isi.waitForFunction(() => document.getElementById("chatSummary").textContent.includes("120 Nachrichten"));
ok(true, "Isi's phone picked up the new chat by itself (120 messages), without asking for the passphrase");

/* Isi deletes it for both */
await isi.click("#chatDeleteBtn");
await isi.waitForSelector("#chatUpload:not(.hidden)");
ok((await dump("chat_exports")).length === 0 && (await dump("chat_chunks")).length === 0, "deleting removes the chat from the cloud completely");
await benji.reload(); await benji.waitForSelector("#chatUpload:not(.hidden)");
ok(await benji.locator("#chatApp").isHidden(), "Benji's phone drops its copy, since the shared chat is gone");

/* a chat that was only on one phone before the cloud existed can be shared afterwards */
const old = await phone("Benji");
await old.goto(base); await old.waitForTimeout(400);
await old.setInputFiles("#chatFileInput", chatOf(10, "C"));
await old.waitForSelector("#chatPassModal:not(.hidden)");
await old.click("#passCancel");
await old.waitForFunction(() => document.getElementById("chatCloud").textContent.includes("Nur auf diesem Gerät"));
ok((await cloudText(old)).includes("Für Isi speichern") && (await dump("chat_exports")).length === 0, "cancelling keeps the chat on this phone only and offers to share it with Isi");
await old.click("#chatCloudAction");
await old.waitForSelector("#chatPassModal:not(.hidden)");
await old.fill("#passInput", "Neues Wort 99"); await old.fill("#passConfirm", "Neues Wort 99"); await old.click("#passSave");
await old.waitForFunction(() => document.getElementById("chatCloud").textContent.includes("Für euch beide gespeichert"));
ok((await dump("chat_exports")).length === 1, "afterwards it is saved for both");

ok(errors.length === 0, "no script errors: " + errors.join("; "));
await browser.close();
console.log(`\n${n} assertions passed`);
