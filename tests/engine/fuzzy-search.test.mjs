import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const F = require("../../fuzzy-search.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

const titles = [
  "Heartstopper", "Heartstopper Forever", "Fack ju Göhte 3", "Die Drei !!!", "Bridgerton", "Sex Education",
  "Love Is Blind: Germany", "Love Is Blind: UK", "The Gentlemen", "The Gentleman", "Ich – Einfach unverbesserlich 2",
  "Charlie und die Schokoladenfabrik", "Zurück ins Outback", "H2O: Plötzlich Meerjungfrau", "Barbie", "Madagascar",
  "Eine Million Minuten", "Young Royals", "Kacken an der Havel", "Swapped – Getauscht"
];
const search = q => titles.map(t => ({ t, s: F.score(q, t) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.t);

ok(F.normalize("Fack ju Göhte 3!") === "fack ju gohte 3", "normalising drops accents, case and punctuation");
ok(F.normalize("Straße") === "strasse", "ß counts as ss");
ok(F.distance("hartstoper", "heartstopper", 2) === 2, "edit distance counts two missing letters");
ok(F.distance("bridgreton", "bridgerton", 2) === 1, "a swapped pair of letters is one typo");

ok(search("heart")[0] === "Heartstopper" && search("heart").includes("Heartstopper Forever"), "word beginnings work");
ok(search("hartstoper").includes("Heartstopper"), "typos: hartstoper → Heartstopper");
ok(search("bridgeton")[0] === "Bridgerton", "typos: bridgeton → Bridgerton");
ok(search("gohte")[0] === "Fack ju Göhte 3", "no umlaut needed: gohte → Fack ju Göhte 3");
ok(search("göthe").includes("Fack ju Göhte 3"), "swapped letters: göthe → Göhte");
ok(search("drei")[0] === "Die Drei !!!", "punctuation is ignored");
ok(search("sex edu")[0] === "Sex Education", "several words, each may be a beginning");
ok(JSON.stringify(search("love blind uk")) === JSON.stringify(["Love Is Blind: UK"]), "every typed word must fit");
ok(search("einfach unverbesserlich")[0] === "Ich – Einfach unverbesserlich 2", "dashes in titles don't matter");
ok(search("schokolade")[0] === "Charlie und die Schokoladenfabrik", "words inside the title are found");
ok(search("zuruck").includes("Zurück ins Outback"), "ü can be typed as u");
ok(search("plotzlich meerjungfrau")[0] === "H2O: Plötzlich Meerjungfrau", "ö can be typed as o");
ok(search("gentlemen")[0] === "The Gentlemen", "the exact title ranks first");
ok(search("xyzq").length === 0, "nonsense finds nothing");
ok(search("bar").length >= 1 && search("bar")[0] === "Barbie", "short words need to be exact beginnings");
ok(!search("bar").includes("Madagascar") || search("bar")[0] === "Barbie", "short queries do not match by typos");
ok(F.score("netflix", "Barbie", "Netflix") > 0, "other fields (platform) are searched too");
ok(F.score("", "Barbie") === 1, "an empty search matches everything");

console.log(`\n${assertions} assertions passed (fuzzy search)`);
