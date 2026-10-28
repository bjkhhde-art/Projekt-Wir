import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
const require = createRequire(import.meta.url);
const E = require("../../chat-engine.js");
const Z = require("../../chat-zip.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

/* ---------- reading both export styles ---------- */
const android = [
  "27.11.25, 21:34 - Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt. Tippe für mehr Infos.",
  "27.11.25, 21:35 - Isi: Hallo Benji 😂",
  "27.11.25, 21:36 - Benji: Hey! Schön dass du schreibst",
  "und das ist die zweite Zeile",
  "27.11.25, 21:40 - Isi: <Medien ausgeschlossen>",
  "27.11.25, 21:41 - Benji: Diese Nachricht wurde gelöscht",
  "27.11.25, 21:42 - Benji hat den Gruppennamen geändert",
  "28.11.25, 07:05 - Isi: Guten Morgen, ich liebe dich"
].join("\n");
const a = E.parseChat(android);
ok(a.length === 5, "Android export: system lines are skipped, five messages remain");
ok(a[1].x === "Hey! Schön dass du schreibst\nund das ist die zweite Zeile", "a message over two lines stays one message");
ok(a[2].k === "media" && a[3].k === "deleted", "omitted media and deleted messages get their own kind");
ok(new Date(a[0].t).getFullYear() === 2025 && new Date(a[0].t).getMonth() === 10 && new Date(a[0].t).getHours() === 21, "date and time are read (27.11.25, 21:35)");

const ios = [
  "‎[27.11.25, 21:35:10] Isi: Hallo",
  "[27.11.25, 21:36:11] Benji: ‎Bild weggelassen",
  "[27.11.25, 21:37:11] Benji: ‎Audio weggelassen",
  "‎[27.11.25, 21:38:11] Benji: Sticker weggelassen"
].join("\n");
const i = E.parseChat(ios);
ok(i.length === 4 && i[0].a === "Isi" && i[0].x === "Hallo", "iPhone export with direction marks is read");
ok(i[1].k === "image" && i[2].k === "audio" && i[3].k === "sticker", "iPhone media lines are told apart (Bild, Audio, Sticker)");

/* iPhone writes the encryption notice and calls with the chat name as author – they are not messages */
const notices = E.parseChat([
  "[27.11.25, 21:34:00] Benji: \u200eNachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt. Nur Personen in diesem Chat können sie lesen.",
  "[27.11.25, 21:35:00] Isi: \u200eVerpasster Sprachanruf",
  "[27.11.25, 21:36:00] Isi: \u200eVideoanruf, 5 Min.",
  "[27.11.25, 21:37:00] Isi: Anruf mich später, ja?",
  "[27.11.25, 21:38:00] Benji: Mach ich"
].join("\n"));
ok(notices.length === 2 && notices[0].x === "Anruf mich später, ja?", "encryption notice and call lines are dropped, a real message starting with „Anruf“ stays");

const attached = E.parseChat([
  "[27.11.25, 21:35:00] Isi: \u200e<Anhang: 00000012-PHOTO-2025-11-27-21-35-00.jpg>",
  "[27.11.25, 21:36:00] Isi: \u200e<Anhang: 00000013-AUDIO-2025-11-27-21-36-00.opus>",
  "[27.11.25, 21:37:00] Benji: \u200e<attached: 00000014-VIDEO-2025-11-27-21-37-00.mp4>"
].join("\n"));
ok(attached.map(m => m.k).join() === "image,audio,video", "iPhone attachments („Anhang“, „attached“) are told apart by file name");

const us = E.parseChat("1/5/26, 9:34 PM - Isi: Hi\n1/5/26, 12:05 AM - Benji: Nacht");
ok(us.length === 2 && new Date(us[0].t).getMonth() === 0 && new Date(us[0].t).getDate() === 5 && new Date(us[0].t).getHours() === 21, "US dates with PM are read (1/5/26 9:34 PM = 5 January, 21:34)");
ok(new Date(us[1].t).getHours() === 0, "12:05 AM is five past midnight");
ok(E.parseChat("angehängt: Foto\nirgendwas").length === 0 && E.prepare([]) === null, "text without a chat header gives nothing");
ok(E.parseChat("27.11.25, 21:35 - Isi: <angehängt: 00000012-PHOTO-2025-11-27.jpg>")[0].k === "image", "an attached photo file name counts as a photo");

/* ---------- a bigger, made-up chat ---------- */
const lines = [];
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pad = n => String(n).padStart(2, "0");
const sayings = [
  ["Isi", "haha das war so lustig gestern Abend 😂"], ["Benji", "Ich liebe dich und vermisse dich total ❤️"],
  ["Isi", "Hast du Hunger? Wir könnten Pizza bestellen!"], ["Benji", "Bin gleich da, schatz, nur noch kurz tanken"],
  ["Isi", "Gute Nacht, schlaf gut und träum was Schönes"], ["Benji", "Danke für den schönen Tag heute, wirklich"],
  ["Benji", "Sorry, ich hab den Bus verpasst, kann dauern"], ["Isi", "Kaffee oder Tee heute Morgen, was meinst du?"],
  ["Benji", "https://example.com/ein-langer-link-der-nicht-zitiert-wird"], ["Isi", "ok"]
];
for (let d = 0; d < 400; d++) {
  const date = new Date(2025, 0, 1 + d);
  if (d >= 100 && d < 130) continue; /* a month of silence */
  const count = 2 + Math.floor(rnd() * 8);
  let minute = 8 * 60;
  for (let n = 0; n < count; n++) {
    minute += 3 + Math.floor(rnd() * 90);
    const [who, text] = sayings[Math.floor(rnd() * sayings.length)];
    const hh = Math.floor(minute / 60) % 24;
    lines.push(`${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(2)}, ${pad(hh)}:${pad(minute % 60)} - ${who}: ${text}`);
  }
}
const parsed = E.parseChat(lines.join("\n"));
const data = E.prepare(parsed);
ok(data.names.length === 2 && data.names.includes("Isi") && data.names.includes("Benji"), "the two writers are found");
ok(data.msgs.every((m, n) => n === 0 || data.msgs[n - 1].t <= m.t), "messages are in time order");
const stats = E.computeStats(data);
ok(stats.total === data.msgs.length && stats.people[0].messages + stats.people[1].messages === stats.total, "per-person counts add up to the total");
ok(stats.longestSilence.gap > 29 * 24 * 3600 * 1000, "the month without messages is the longest silence");
ok(stats.months.length >= 13 && stats.months.every((m, n) => n === 0 || m.key > stats.months[n - 1].key), "every month is listed, in order, also silent ones");
ok(stats.dayStreak.length === 270, "the longest run of days in a row is found (days 131–400)");
ok(stats.busiestDay.count >= 2 && stats.perHour[0].length === 24, "busiest day and hour-by-hour counts exist");
ok(stats.people.every(p => p.replyMedian > 0 && p.replyMedian < 360), "median reply time is measured within conversations");
const love = stats.phrases.find(p => p.key === "love");
const hunger = stats.phrases.find(p => p.key === "hunger");
ok(love && love.counts[0] === 0 && love.counts[1] > 0, "„Ich liebe dich“ is only counted for Benji");
ok(hunger && hunger.counts[1] === 0 && hunger.counts[0] > 0, "„Hunger“ is only counted for Isi");
ok(stats.emojis.total.some(([e]) => e === "😂") && stats.emojis.total.some(([e]) => e === "❤️"), "emojis are counted, also ones with a variation selector");
ok(!stats.phrases.some(p => p.counts[0] + p.counts[1] === 0), "phrases that never occur are not listed");

const words = E.computeWords(data);
ok(!words.cloud.some(w => ["und", "das", "ich", "nicht"].includes(w.word)), "filler words stay out of the word cloud");
ok(!words.cloud.some(w => w.word.includes("example") || w.word.includes("https")), "links stay out of the word cloud");
ok(words.cloud.length > 10 && words.cloud.every((w, n) => n === 0 || words.cloud[n - 1].count >= w.count), "the cloud is sorted by use");
ok(words.typical[1].some(w => w.word === "tanken" || w.word === "bus" || w.word === "schatz"), "typical words show what only one of them says");

const prizes = E.awards(stats, data);
const prize = title => prizes.find(p => p.title.startsWith(title));
ok(prize("Romantiker") && prize("Romantiker").winner === "Benji", "Benji wins the romantic award");
ok(prize("Hunger") && prize("Hunger").winner === "Isi", "Isi wins the hunger award");
ok(!prize("Sprachnachrichten"), "no voice-message award when there are no voice messages");
ok(prizes.every(p => p.detail && p.winner), "every award names a winner and a reason");

/* ---------- quotes ---------- */
const pools = E.quotePools(data);
ok(pools.all.every(idx => !/https?:/.test(data.msgs[idx].x)), "links are never quoted");
ok(pools.pearls.length > 0 && pools.pearls.every(idx => pools.all.includes(idx)), "pearls are a subset of quotable messages");
const q1 = E.quoteOfDay(pools.pearls, "2026-03-01");
ok(q1 === E.quoteOfDay(pools.pearls, "2026-03-01") && q1 >= 0, "the quote of the day stays the same all day");
ok(new Set(Array.from({ length: 30 }, (_, n) => E.quoteOfDay(pools.pearls, "2026-04-" + pad(n + 1)))).size > 1, "it changes from day to day");
ok(E.quoteOfDay([], "2026-03-01") === -1, "no quotes, no quote of the day");
const ctx = E.context(data, pools.all[10]);
ok(ctx.filter(c => c.main).length === 1 && ctx.length >= 1 && ctx.length <= 4, "a quote comes with at most three lines of surrounding chat");

/* ---------- quiz ---------- */
const quiz = E.quizPool(data);
ok(quiz[0].length > 0 && quiz[1].length > 0, "both of them have messages to guess");
const used = new Set();
let r = 3;
const rng = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
const authors = [0, 0];
for (let n = 0; n < 40; n++) {
  const round = E.quizRound(quiz, rng, used);
  assert.ok(round && data.msgs[round.index].a === round.author && !used.has(round.index));
  used.add(round.index);
  authors[round.author]++;
}
ok(authors[0] > 10 && authors[1] > 10, `rounds are balanced between both writers (${authors.join(" : ")})`);
ok(E.quizRound([[], []], rng, new Set()) === null, "no round when there is nothing to guess");

/* ---------- zip exports ---------- */
function zipOf(name, content, deflate) {
  const body = Buffer.from(content, "utf8");
  const packed = deflate ? deflateRawSync(body) : body;
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8);
  local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(deflate ? 8 : 0, 10);
  central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  const centralOffset = local.length + nameBytes.length + packed.length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12); end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBytes, packed, central, nameBytes, end]);
}
const sample = "27.11.25, 21:35 - Isi: Hallo äöü 😂\n27.11.25, 21:36 - Benji: Hi";
ok(await Z.readChatText(zipOf("_chat.txt", sample, true)) === sample, "a compressed .zip export gives its chat text back (with umlauts and emoji)");
ok(await Z.readChatText(zipOf("_chat.txt", sample, false)) === sample, "a stored .zip export works too");
ok(await Z.readChatText(Buffer.from(sample)) === sample, "a plain .txt is passed through");
ok(await Z.readChatText(new Blob([zipOf("WhatsApp Chat mit Benji/_chat.txt", sample, true)])) === sample, "a zip given as a Blob (a chosen file) is read without loading it whole");
ok(await Z.readChatText(new Blob([sample])) === sample, "a plain .txt given as a Blob is read");
await assert.rejects(Z.readChatText(Buffer.from("PK\u0003\u0004 kaputt, nur Müll hier drin, nichts weiter")), /ZIP/);
assertions++; console.log("PASS: a broken zip gives a readable error");

console.log(`\n${assertions} assertions passed`);
