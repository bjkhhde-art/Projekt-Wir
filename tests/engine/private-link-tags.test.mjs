import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const T = require("../../private-link-tags.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(T.cleanTag("#POV") === "pov", "a leading # is dropped and tags are lowercase");
ok(T.cleanTag("  Süße Überraschung! ") === "süßeüberraschung", "umlauts stay, spaces and symbols go");
ok(T.cleanTag("hand-held_cam") === "hand-held_cam", "dashes and underscores are kept inside a tag");
ok(T.cleanTag("--x--") === "x", "dashes at the edges are trimmed");
ok(T.cleanTag("<b>x</b>") === "bxb", "no markup survives");
ok(T.cleanTag("a".repeat(50)).length === T.MAX_LENGTH, "tags are capped in length");
ok(T.cleanTag("🔥") === "", "a tag of only emoji is empty and gets ignored");
ok(same(T.parseTags("#pov, outdoor #Lustig;pov"), ["pov", "outdoor", "lustig"]), "several tags at once, separated by space, comma or #, without repeats");
ok(same(T.parseTags(""), []), "nothing typed, no tags");
ok(same(T.addTags(["pov"], "#POV #neu"), ["pov", "neu"]), "adding keeps existing tags and skips repeats");
ok(T.addTags([], Array.from({ length: 20 }, (_, i) => "t" + i).join(" ")).length === T.MAX_TAGS, "at most 12 tags per link");
ok(same(T.removeTag(["a", "b", "c"], "b"), ["a", "c"]), "a tag can be removed");

const links = [
  { id: 1, tags: ["pov", "lustig"] },
  { id: 2, tags: ["lustig"] },
  { id: 3, tags: ["outdoor", "lustig", "pov"] },
  { id: 4, tags: [] },
  { id: 5 }
];
ok(same(T.tagCounts(links), [{ tag: "lustig", count: 3 }, { tag: "pov", count: 2 }, { tag: "outdoor", count: 1 }]), "tags in use are counted, most used first");
const pick = sel => links.filter(l => T.matches(l, sel)).map(l => l.id);
ok(same(pick([]), [1, 2, 3, 4, 5]), "no tag chosen shows everything");
ok(same(pick(["lustig"]), [1, 2, 3]), "one tag");
ok(same(pick(["lustig", "pov"]), [1, 3]), "two tags: links that have both");
ok(same(pick(["lustig", "pov", "outdoor"]), [3]), "each further tag narrows the list");
ok(same(T.sanitizeSelection(["pov", "weg", 3, "pov"], links), ["pov"]), "remembered choices drop tags that no longer exist");
ok(same(T.sanitizeSelection("pov", links), []), "broken remembered choices mean no filter");

console.log(`\n${assertions} assertions passed (private link tags)`);
