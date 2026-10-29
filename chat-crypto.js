/* Chat-Wrapped: seals the chat for the cloud. The database is readable by anyone who knows the (public)
   key of this site, so the chat never goes there as text: it is compressed and encrypted in the browser
   with a passphrase only the two of them know (AES-GCM, key from PBKDF2). Supabase only ever sees the
   encrypted Base64 pieces. Used by chat.js (window.ChatCrypto) and the node tests. */
(function () {
  const SALT = new TextEncoder().encode("projekt-wir/chat-wrapped/v1");
  const ROUNDS = 250000;
  const MAGIC = [0x50, 0x57, 0x43, 0x31]; /* "PWC1" */
  const IV_LENGTH = 12;
  /* a database row stays well below the request limits */
  const CHUNK_CHARS = 600000;
  const KINDS = ["text", "image", "video", "audio", "sticker", "gif", "doc", "media", "deleted"];

  const clean = passphrase => String(passphrase || "").normalize("NFC").trim();

  async function deriveKey(passphrase) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(clean(passphrase)), "PBKDF2", false, ["deriveKey"]);
    /* not extractable: the key can be kept on the phone, but never read out of it */
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ROUNDS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  /* arrays instead of objects: roughly half the size before compression */
  const compact = data => ({ n: data.names, m: data.msgs.map(m => [m.t, m.a, m.x, Math.max(0, KINDS.indexOf(m.k))]) });
  const expand = packed => ({ names: packed.n, msgs: packed.m.map(([t, a, x, k]) => ({ t, a, x, k: KINDS[k] || "text" })) });

  async function pipe(bytes, transform) {
    const stream = new Blob([bytes]).stream().pipeThrough(transform);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function toBase64(bytes) {
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(text);
  }

  function fromBase64(text) {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  /* { names, msgs } → { chunks: [Base64 text…], size } */
  async function seal(data, key) {
    const json = new TextEncoder().encode(JSON.stringify(compact(data)));
    const packed = await pipe(json, new CompressionStream("gzip"));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed));
    const bytes = new Uint8Array(MAGIC.length + IV_LENGTH + encrypted.length);
    bytes.set(MAGIC, 0);
    bytes.set(iv, MAGIC.length);
    bytes.set(encrypted, MAGIC.length + IV_LENGTH);
    const text = toBase64(bytes);
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_CHARS) chunks.push(text.slice(i, i + CHUNK_CHARS));
    return { chunks, size: bytes.length };
  }

  /* the other way round; a wrong passphrase is told apart (error.code === "BAD_KEY") */
  async function open(chunks, key) {
    let bytes;
    try { bytes = fromBase64(chunks.join("")); } catch (error) { bytes = new Uint8Array(0); }
    if (bytes.length < MAGIC.length + IV_LENGTH + 16 || MAGIC.some((value, i) => bytes[i] !== value)) {
      const error = new Error("Das gespeicherte Chat-Paket ist beschädigt.");
      error.code = "BAD_FORMAT";
      throw error;
    }
    let packed;
    try {
      packed = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(MAGIC.length, MAGIC.length + IV_LENGTH) }, key, bytes.subarray(MAGIC.length + IV_LENGTH)));
    } catch (error) {
      const wrong = new Error("Das ist nicht das richtige Chat-Passwort.");
      wrong.code = "BAD_KEY";
      throw wrong;
    }
    const json = await pipe(packed, new DecompressionStream("gzip"));
    return expand(JSON.parse(new TextDecoder().decode(json)));
  }

  const api = { deriveKey, seal, open, CHUNK_CHARS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ChatCrypto = api;
})();
