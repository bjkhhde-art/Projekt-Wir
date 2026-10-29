/* Reads the chat text out of a WhatsApp export. The iPhone hands out a .zip (with "_chat.txt" inside),
   Android a plain .txt. Only the zip directory and the one text file are read – an export with photos and
   videos can be hundreds of MB and must not be loaded into memory as a whole. No library needed.
   Takes a File/Blob (browser) or a Buffer/ArrayBuffer (tests).
   Used by chat.js (window.ChatZip) and the node tests. */
(function () {
  const decoder = new TextDecoder("utf-8");

  /* one way to read a range, whether it is a Blob or bytes already in memory */
  function sourceOf(input) {
    if (typeof Blob !== "undefined" && input instanceof Blob) {
      return { size: input.size, read: async (start, end) => new Uint8Array(await input.slice(start, end).arrayBuffer()) };
    }
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return { size: bytes.length, read: async (start, end) => bytes.subarray(start, end) };
  }

  const viewOf = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  async function entries(source) {
    /* the end-of-directory record sits at the very end, behind an optional comment */
    const tailStart = Math.max(0, source.size - 22 - 65535);
    const tail = await source.read(tailStart, source.size);
    const tailView = viewOf(tail);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error("Das ist keine gültige ZIP-Datei.");

    const count = tailView.getUint16(end + 10, true);
    const directorySize = tailView.getUint32(end + 12, true);
    const directoryOffset = tailView.getUint32(end + 16, true);
    if (directoryOffset === 0xffffffff || count === 0xffff) throw new Error("Diese ZIP-Datei ist zu groß. Exportiere den Chat bitte „Ohne Medien“.");

    const directory = await source.read(directoryOffset, directoryOffset + directorySize);
    const view = viewOf(directory);
    const list = [];
    let pos = 0;
    for (let n = 0; n < count; n++) {
      if (pos + 46 > directory.length || view.getUint32(pos, true) !== 0x02014b50) throw new Error("Die ZIP-Datei ist beschädigt.");
      const nameLength = view.getUint16(pos + 28, true);
      const extraLength = view.getUint16(pos + 30, true);
      const commentLength = view.getUint16(pos + 32, true);
      list.push({
        method: view.getUint16(pos + 10, true),
        compressedSize: view.getUint32(pos + 20, true),
        offset: view.getUint32(pos + 42, true),
        name: decoder.decode(directory.subarray(pos + 46, pos + 46 + nameLength))
      });
      pos += 46 + nameLength + extraLength + commentLength;
    }
    return list;
  }

  async function extract(source, entry) {
    const header = viewOf(await source.read(entry.offset, entry.offset + 30));
    const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    const packed = await source.read(start, start + entry.compressedSize);
    if (entry.method === 0) return packed;
    if (entry.method !== 8) throw new Error("Diese ZIP-Datei ist anders gepackt, als ich lesen kann.");
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* the chat text of an export: a .txt as it is, or the best-looking .txt inside a .zip */
  async function readChatText(input) {
    const source = sourceOf(input);
    const head = await source.read(0, 4);
    const isZip = head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
    if (!isZip) return decoder.decode(await source.read(0, source.size));

    const texts = (await entries(source)).filter(e => /\.txt$/i.test(e.name) && !e.name.startsWith("__MACOSX"));
    if (!texts.length) throw new Error("In der ZIP-Datei liegt kein Chat-Text (.txt).");
    texts.sort((a, b) => (/chat/i.test(b.name) - /chat/i.test(a.name)) || (b.compressedSize - a.compressedSize));
    return decoder.decode(await extract(source, texts[0]));
  }

  const api = { readChatText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ChatZip = api;
})();
