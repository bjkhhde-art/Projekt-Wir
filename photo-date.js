/* When was a photo taken? From the camera's EXIF data (JPEG), otherwise from the file name
   (IMG_20260426_092857.jpg, PXL_…, WhatsApp Image 2026-04-26 at 09.28.57.jpeg, IMG-20260426-WA0001.jpg, …).
   No DOM: loaded as <script> in the browser, testable in Node via require. */

const PhotoDate = (() => {

/* "2026:04:26 09:28:57" (+ optional "+02:00") → Date; without an offset it is local time */
function fromExifString(text, offset) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text || "");
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) {
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`);
  }
  return new Date(y, mo - 1, d, h, mi, s);
}

/* the date in a JPEG's EXIF block: DateTimeOriginal, else CreateDate, else DateTime */
function fromExif(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let i = 2;
  while (i + 4 <= view.byteLength) {
    if (view.getUint8(i) !== 0xff) return null;
    const marker = view.getUint8(i + 1);
    const size = view.getUint16(i + 2);
    if (marker === 0xe1 && i + 10 <= view.byteLength && view.getUint32(i + 4) === 0x45786966) {
      return readTiff(view, i + 10, Math.min(view.byteLength, i + 2 + size));
    }
    if (marker === 0xda) return null;
    i += 2 + size;
  }
  return null;
}

function readTiff(view, start, end) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = at => view.getUint16(start + at, little);
  const u32 = at => view.getUint32(start + at, little);
  const text = (at, count) => {
    let out = "";
    for (let k = 0; k < count && start + at + k < end; k++) {
      const c = view.getUint8(start + at + k);
      if (c === 0) break;
      out += String.fromCharCode(c);
    }
    return out;
  };
  const readIfd = offset => {
    const tags = {};
    if (start + offset + 2 > end) return tags;
    const count = u16(offset);
    for (let k = 0; k < count; k++) {
      const p = offset + 2 + 12 * k;
      if (start + p + 12 > end) break;
      const tag = u16(p);
      const type = u16(p + 2);
      const n = u32(p + 4);
      if (type === 2) tags[tag] = text(n <= 4 ? p + 8 : u32(p + 8), n);
      else if (type === 4) tags[tag] = u32(p + 8);
    }
    return tags;
  };
  const ifd0 = readIfd(u32(4));
  const exif = ifd0[0x8769] ? readIfd(ifd0[0x8769]) : {};
  const value = exif[0x9003] || exif[0x9004] || ifd0[0x0132];
  return fromExifString(value, exif[0x9011]);
}

/* 20260426_092857 · 2026-04-26 at 09.28.57 · 2026-04-26 09-28-57 · 20260426 (only the day, at noon) */
function fromFileName(name) {
  const base = String(name || "");
  const full = /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:[ T_-]|\s+at\s+|\s+um\s+)(\d{2})[.:\-_]?(\d{2})[.:\-_]?(\d{2})/i.exec(base);
  const dayOnly = /(?:^|\D)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:\D|$)/.exec(base);
  const m = full || dayOnly;
  if (!m) return null;
  const [y, mo, d] = [m[1], m[2], m[3]].map(Number);
  const [h, mi, s] = full ? [m[4], m[5], m[6]].map(Number) : [12, 0, 0];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  return new Date(y, mo - 1, d, h, mi, s);
}

/* for a File in the browser: { date, source: "exif" | "filename" } or null */
async function fromFile(file) {
  try {
    if (/jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name)) {
      const head = await file.slice(0, 256 * 1024).arrayBuffer();
      const date = fromExif(head);
      if (date && !isNaN(date)) return { date, source: "exif" };
    }
  } catch (error) {
    /* unreadable metadata – try the name */
  }
  const date = fromFileName(file.name);
  return date ? { date, source: "filename" } : null;
}

return { fromExif, fromExifString, fromFileName, fromFile };

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PhotoDate;
}
if (typeof window !== "undefined") {
  window.PhotoDate = PhotoDate;
}
