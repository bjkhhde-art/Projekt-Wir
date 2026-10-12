import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../../photo-date.js");

/* the date a photo was taken: from EXIF (both byte orders) or from typical file names */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };

/* a tiny JPEG: SOI + APP1 "Exif" with IFD0 → Exif IFD (DateTimeOriginal, OffsetTimeOriginal) */
function jpegWithExif({ little, date, offset, inIfd0 }) {
  const entries0 = inIfd0 ? [[0x0132, 2, date]] : [[0x8769, 4, null]];
  const exifEntries = inIfd0 ? [] : [[0x9003, 2, date], ...(offset ? [[0x9011, 2, offset]] : [])];
  const bytes = [];
  const u16 = v => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = v => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const ifdSize = count => 2 + count * 12 + 4;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(entries0.length);
  let dataAt = exifAt + (exifEntries.length ? ifdSize(exifEntries.length) : 0);
  const data = [];
  const entry = ([tag, type, value]) => {
    if (type === 4) return [...u16(tag), ...u16(4), ...u32(1), ...u32(exifAt)];
    const str = [...Buffer.from(value + "\0", "latin1")];
    const out = [...u16(tag), ...u16(2), ...u32(str.length), ...u32(dataAt)];
    data.push(...str);
    dataAt += str.length;
    return out;
  };
  bytes.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  bytes.push(...u16(entries0.length), ...entries0.flatMap(entry), ...u32(0));
  if (exifEntries.length) bytes.push(...u16(exifEntries.length), ...exifEntries.flatMap(entry), ...u32(0));
  bytes.push(...data);
  const app1 = [...Buffer.from("Exif\0\0", "latin1"), ...bytes];
  const all = [0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(all).buffer;
}

const big = P.fromExif(jpegWithExif({ little: false, date: "2026:04:26 09:28:57", offset: "+02:00" }));
ok(big && big.toISOString() === "2026-04-26T07:28:57.000Z", "EXIF (big endian) with time zone: 26.04.2026 09:28:57 +02:00");
const little = P.fromExif(jpegWithExif({ little: true, date: "2025:12:14 17:35:19" }));
ok(little && little.getFullYear() === 2025 && little.getMonth() === 11 && little.getDate() === 14 && little.getHours() === 17, "EXIF (little endian) without time zone counts as local time");
const plain = P.fromExif(jpegWithExif({ little: false, date: "2026:02:15 10:51:04", inIfd0: true }));
ok(plain && plain.getDate() === 15 && plain.getMinutes() === 51, "falls back to the plain DateTime tag");
ok(P.fromExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer) === null, "not a JPEG: no date");
ok(P.fromExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer) === null, "a JPEG without EXIF: no date");
ok(P.fromExifString("0000:00:00 00:00:00") === null, "an empty camera date is ignored");

const name = (file, expected) => {
  const d = P.fromFileName(file);
  const got = d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  ok(got === expected, `file name ${file} → ${expected}`);
};
name("IMG_20260426_092857.jpg", "2026-04-26 09:28");
name("PXL_20260830_190440123.jpg", "2026-08-30 19:04");
name("20260917_192950.heic", "2026-09-17 19:29");
name("WhatsApp Image 2026-08-27 at 18.30.24.jpeg", "2026-08-27 18:30");
name("Screenshot 2026-05-23 at 08.44.11.png", "2026-05-23 08:44");
name("IMG-20260528-WA0007.jpg", "2026-05-28 12:00");
ok(P.fromFileName("IMG_4711.JPG") === null, "IMG_4711.JPG has no date");
ok(P.fromFileName("1779831592232-hji4y5o9z4c.jpg") === null, "a random upload name has no date");

console.log(`\n${n} assertions passed (photo dates)`);
