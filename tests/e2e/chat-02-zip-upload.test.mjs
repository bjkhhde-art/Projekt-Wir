import { chromium } from "playwright";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem("pw_person", "Isi"));

/* an iPhone export: a zip with "_chat.txt" (compressed) next to a photo that must not be read as the chat */
function zipOf(files) {
  const parts = []; const central = []; let offset = 0;
  for (const { name, data, deflate } of files) {
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    const packed = deflate ? deflateRawSync(body) : body;
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(deflate ? 8 : 0, 10);
    entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(body.length, 24); entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    parts.push(local, nameBytes, packed);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

const pad = v => String(v).padStart(2, "0");
const lines = ["‎[27.11.25, 21:34:00] Benji: ‎Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt."];
for (let d = 0; d < 20; d++) {
  lines.push(`[${pad(d + 1)}.12.25, 10:0${d % 10}:00] Isi: Guten Morgen, ich liebe dich 😂 heute ${d}`);
  lines.push(`[${pad(d + 1)}.12.25, 10:1${d % 10}:00] Benji: ‎<Anhang: 0000000${d % 10}-PHOTO-2025.jpg>`);
  lines.push(`[${pad(d + 1)}.12.25, 10:2${d % 10}:00] Benji: Moin Schatz, schön dass du da bist ${d}`);
}
const zip = zipOf([
  { name: "00000001-PHOTO-2025.jpg", data: Buffer.alloc(5000, 7), deflate: false },
  { name: "_chat.txt", data: lines.join("\n"), deflate: true }
]);

await page.goto("http://localhost:9091/chat.html"); await page.waitForTimeout(400);
await page.setInputFiles("#chatFileInput", { name: "WhatsApp Chat - Benji.zip", mimeType: "application/zip", buffer: zip });
await page.waitForSelector("#chatApp:not(.hidden)");
const summary = await page.locator("#chatSummary").innerText();
ok(summary.includes("60 Nachrichten"), `the zip is unpacked in the browser and the 60 real messages are counted, not the encryption notice (${summary.replace(/\n/g, " · ")})`);
ok(summary.includes("Isi") && summary.includes("Benji") && !summary.includes("verschlüsselt"), "both writers are found and no third one appears");
ok((await page.locator(".cw-card").first().innerText()).includes("60"), "the first wrapped card shows 60 messages");
ok(errors.length === 0, "no script errors: " + errors.join("; "));
await browser.close();
console.log(`\n${n} assertions passed`);
