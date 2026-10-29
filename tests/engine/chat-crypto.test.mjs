import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../../chat-crypto.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

const data = {
  names: ["Isi", "Benji"],
  msgs: [
    { t: 1764275700000, a: 0, x: "Hallo Benji 😂 äöü ß", k: "text" },
    { t: 1764275760000, a: 1, x: "", k: "image" },
    { t: 1764275820000, a: 1, x: "Zweite\nZeile mit \"Anführungszeichen\"", k: "text" },
    { t: 1764275880000, a: 0, x: "", k: "deleted" }
  ]
};

const key = await C.deriveKey("Unser Geheimnis 2026");
const sealed = await C.seal(data, key);
ok(sealed.chunks.length === 1 && sealed.size > 30, "a small chat fits in one piece");
ok(!sealed.chunks.join("").includes("Hallo") && !sealed.chunks.join("").includes("SGFsbG8"), "the stored text contains none of the chat (not even Base64 of it)");
ok(JSON.stringify(await C.open(sealed.chunks, key)) === JSON.stringify(data), "it opens again exactly as it was (umlauts, emoji, line breaks, media kinds)");

const again = await C.seal(data, key);
ok(again.chunks[0] !== sealed.chunks[0], "sealing the same chat twice gives different bytes (fresh random start value each time)");
ok(JSON.stringify(await C.open(again.chunks, await C.deriveKey("  Unser Geheimnis 2026 "))) === JSON.stringify(data), "spaces around the passphrase do not matter");

await assert.rejects(C.open(sealed.chunks, await C.deriveKey("falsches Passwort")), e => e.code === "BAD_KEY");
assertions++; console.log("PASS: a wrong passphrase is refused and recognised as that");

const tampered = sealed.chunks[0].slice(0, 80) + (sealed.chunks[0][80] === "A" ? "B" : "A") + sealed.chunks[0].slice(81);
await assert.rejects(C.open([tampered], key), e => e.code === "BAD_KEY");
assertions++; console.log("PASS: a changed byte is detected (no silently wrong chat)");

await assert.rejects(C.open(["das ist kein paket"], key), e => e.code === "BAD_FORMAT");
await assert.rejects(C.open([""], key), e => e.code === "BAD_FORMAT");
assertions++; console.log("PASS: garbage is reported as a damaged package");

/* a big chat is split into pieces that stay below the row limit and still round-trips */
const big = { names: ["Isi", "Benji"], msgs: [] };
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < 60000; i++) big.msgs.push({ t: 1700000000000 + i * 60000, a: i % 2, x: Array.from({ length: 6 }, () => Math.floor(rnd() * 1e9).toString(36)).join(" "), k: "text" });
const bigSealed = await C.seal(big, key);
ok(bigSealed.chunks.length > 1 && bigSealed.chunks.every(c => c.length <= C.CHUNK_CHARS), `a big chat (60,000 messages) is split into ${bigSealed.chunks.length} pieces of at most ${C.CHUNK_CHARS} characters`);
const back = await C.open(bigSealed.chunks, key);
ok(back.msgs.length === 60000 && back.msgs[59999].x === big.msgs[59999].x && back.names[1] === "Benji", "and comes back complete");

console.log(`\n${assertions} assertions passed`);
