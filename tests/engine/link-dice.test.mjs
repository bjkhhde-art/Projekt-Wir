import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../../link-dice.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}
const ids = list => list.map(l => l.id).join(",");

const links = [
  { id: 1, tags: ["lustig", "pov"], rating_isi: 4, rating_benji: null },
  { id: 2, tags: ["lustig"], rating_isi: null, rating_benji: 5 },
  { id: 3, tags: [], rating_isi: null, rating_benji: null },
  { id: 4 }
];
ok(ids(D.candidates(links)) === "1,2,3,4", "without choices every link can come up");
ok(ids(D.candidates(links, { tags: ["lustig"] })) === "1,2", "only links with the chosen hashtag");
ok(ids(D.candidates(links, { tags: ["lustig", "pov"] })) === "1", "several hashtags: all of them");
ok(ids(D.candidates(links, { unratedBy: "Isi" })) === "2,3,4", "only what Isi has not rated yet");
ok(ids(D.candidates(links, { unratedBy: "Benji", tags: ["lustig"] })) === "1", "both choices together");
ok(D.candidates(null).length === 0, "no links, no candidates");

ok(D.pick([], []) === null, "nothing to pick from gives nothing");
ok(D.pick(links, [], () => 0.6).id === 3, "a random link");
ok(D.pick(links, [3], () => 0.6).id === 2 && D.pick(links, [3], () => 0.99).id === 4, "the last picks are avoided");
ok(D.pick([links[0]], [1], () => 0.2).id === 1, "with only one link it may come again");
const seen = new Set();
for (let i = 0; i < 200; i++) seen.add(D.pick(links, [], Math.random).id);
ok(seen.size === 4, "over time every link comes up");

ok(D.formatViews(1234567) === "1,2 Mio. Aufrufe" && D.formatViews(2000000) === "2 Mio. Aufrufe", "millions read short");
ok(D.formatViews(12345) === "12.345 Aufrufe" && D.formatViews(null) === "", "smaller numbers with a dot, nothing for no number");

console.log(`\n${assertions} assertions passed (link dice)`);
