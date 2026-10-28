import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const B = require("../../bot-names.js");

let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }

ok(B.display("Udiou") === "Udiou" && B.display("Isi") === "Isi", "without settings the bots keep their names");
ok(B.clean("  Robo<>ter!!  2000 ") === "Roboter 2000", "names are cleaned like a friend's name");
ok(B.clean("x".repeat(40)).length === B.NAME_MAX, "at most 20 characters");
ok(/vergeben/.test(B.problem("Udiou", "isi")), "a bot cannot be called Isi");
ok(/andere Computer-Spieler/.test(B.problem("Udiou", "Klausi")), "or like the other bot");
ok(/andere Computer-Spieler/.test(B.problem("Klausi", "robo", { Udiou: "Robo" })), "or like the other bot's new name");
ok(B.problem("Udiou", "") === null && B.problem("Udiou", "Robo", { Klausi: "Maxi" }) === null, "an empty name or a free name is fine");
ok(JSON.stringify(B.sanitize({ Udiou: " Robo ", Klausi: "Klausi", Benji: "x", evil: "y" })) === JSON.stringify({ Udiou: "Robo" }), "only known bots with a real new name are kept");
ok(JSON.stringify(B.sanitize({ Udiou: "Maxi", Klausi: "maxi" })) === JSON.stringify({ Udiou: "Maxi" }), "two bots never share a name");
ok(JSON.stringify(B.sanitize(null)) === "{}" && JSON.stringify(B.sanitize("Robo")) === "{}", "broken data means no renames");
B.set({ Udiou: "Robo" });
ok(B.display("Udiou") === "Robo" && B.display("Klausi") === "Klausi", "the chosen name is shown, the other stays");

console.log(`\n${assertions} assertions passed (bot names)`);
