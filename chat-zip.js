/* Reads the chat text out of a WhatsApp export. The iPhone hands out a .zip (with "_chat.txt" inside),
   Android a plain .txt. Only the zip directory is read here, so no library is needed.
   Used by chat.js (window.ChatZip) and the node tests. */
(function () {
  const decoder = new TextDecoder("utf-8");

  function entries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    /* the end-of-directory record sits at the very end, behind an optional comment */
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error("Das ist keine gültige ZIP-Datei.");

    const count = view.getUint16(end + 10, true);
    let pos = view.getUint32(end + 16, true);
    const list = [];
    for (let n = 0; n < count; n++) {
      if (view.getUint32(pos, true) !== 0x02014b50) throw new Error("Die ZIP-Datei ist beschädigt.");
      const nameLength = view.getUint16(pos + 28, true);
      const extraLength = view.getUint16(pos + 30, true);
      const commentLength = view.getUint16(pos + 32, true);
      list.push({
        method: view.getUint16(pos + 10, true),
        compressedSize: view.getUint32(pos + 20, true),
        offset: view.getUint32(pos + 42, true),
        name: decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength))
      });
      pos += 46 + nameLength + extraLength + commentLength;
    }
    return list;
  }

  async function extract(bytes, entry) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
    const packed = bytes.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return packed;
    if (entry.method !== 8) throw new Error("Diese ZIP-Datei ist anders gepackt, als ich lesen kann.");
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* the chat text of an export: a .txt as it is, or the best-looking .txt inside a .zip */
  async function readChatText(buffer) {
    const bytes = new Uint8Array(buffer);
    const isZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!isZip) return decoder.decode(bytes);

    const texts = entries(bytes).filter(e => /\.txt$/i.test(e.name) && !e.name.startsWith("__MACOSX"));
    if (!texts.length) throw new Error("In der ZIP-Datei liegt kein Chat-Text (.txt).");
    texts.sort((a, b) => (/chat/i.test(b.name) - /chat/i.test(a.name)) || (b.compressedSize - a.compressedSize));
    return decoder.decode(await extract(bytes, texts[0]));
  }

  const api = { readChatText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ChatZip = api;
})();
