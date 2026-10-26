import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../../geo-engine.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}
function throwsWith(fn, pattern, msg) {
  assert.throws(fn, pattern);
  assertions++;
  console.log("PASS:", msg);
}
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const trips = [
  { id: 1, title: "Alicante", location: "Spanien", start_date: "2026-08-29" },
  { id: 2, title: "Berlin", location: "Berlin", start_date: "2026-05-01" },
  { id: 3, title: "Noch nicht verreist", location: "", start_date: "2027-01-01" }
];
const images = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, trip_id: i % 2 ? 2 : 1, image_url: `p${i}.jpg` }));
images.push({ id: 200, trip_id: 99, image_url: "waise.jpg" }, { id: 201, trip_id: 1, image_url: null });

/* pool */
{
  const pool = G.buildPool(trips, images);
  ok(pool.trips.length === 3 && pool.trips.every(t => typeof t.id === "string"), "every trip is in the list to pick from, ids are text");
  ok(pool.photos.every(p => p.trip === "1" || p.trip === "2"), "only trips with photos are ever the answer");
  ok(pool.photos.length === 12, "photos of unknown trips and photos without a link are dropped");
  ok(pool.trips.map(t => t.id).join() === "3,1,2" && pool.trips[1].year === "2026", "the list is sorted newest first and carries the year");
  ok(G.poolProblem(pool) === null, "a pool with two trips and enough photos is playable");
  ok(G.poolProblem(G.buildPool(trips, images.filter(i => i.trip_id === 1))) !== null, "one trip alone is not enough");
  ok(G.poolProblem(G.buildPool(trips, images.slice(0, 2))) !== null, "too few photos are not enough");
  throwsWith(() => G.createInitialState("Isi", "Benji", G.buildPool([], [])), /mindestens zwei Reisen/, "a game cannot start without a pool");
}

/* a full round */
{
  const pool = G.buildPool(trips, images);
  let s = G.createInitialState("Isi", "Benji", pool, seeded(1));
  ok(s.photos.length === G.PHOTOS_PER_ROUND && new Set(s.photos.map(p => p.id)).size === G.PHOTOS_PER_ROUND, "a round has five different photos");
  ok(s.phase === "play" && s.index === 0 && s.picks.Isi === null && s.picks.Benji === null, "it starts at the first photo with no picks");
  throwsWith(() => G.pick(s, "Gast", "1"), /nicht mit/, "strangers cannot pick");
  throwsWith(() => G.pick(s, "Isi", "42"), /gibt es nicht/, "only listed trips can be picked");

  const right = G.currentPhoto(s).trip;
  const wrong = pool.trips.find(t => t.id !== right).id;
  s = G.pick(s, "Isi", right);
  ok(s.phase === "play" && s.picks.Isi === right, "one pick does not reveal yet");
  throwsWith(() => G.pick(s, "Isi", wrong), /schon getippt/, "a pick cannot be changed");
  s = G.pick(s, "Benji", wrong);
  ok(s.phase === "reveal" && s.scores.Isi === 1 && s.scores.Benji === 0, "both picked: reveal, right pick scores one point");
  ok(s.answers[0].Isi === right && s.answers[0].Benji === wrong, "the picks are remembered for the result");
  throwsWith(() => G.pick(s, "Isi", right), /nicht getippt/, "no picking during the reveal");

  s = G.advance(s);
  ok(s.phase === "play" && s.index === 1 && s.picks.Isi === null && s.readyNext.length === 0, "advancing shows the next photo with fresh picks");
  ok(G.advance(s) === s, "advancing outside a reveal changes nothing");

  for (let i = 1; i < G.PHOTOS_PER_ROUND; i++) {
    const t = G.currentPhoto(s).trip;
    s = G.pick(G.pick(s, "Isi", t), "Benji", t);
    s = G.advance(s);
  }
  ok(s.phase === "summary", "after the last photo comes the result");
  ok(G.roundScore(s, "Isi") === G.PHOTOS_PER_ROUND && G.roundScore(s, "Benji") === G.PHOTOS_PER_ROUND - 1, "round scores count the right picks");
  ok(G.leader(s) === "Isi", "Isi leads");

  const used = G.memoryOf(s);
  const second = G.nextRound(s, "Isi", pool, seeded(2));
  ok(second.round === 2 && second.phase === "play" && second.scores.Isi === s.scores.Isi, "the next round keeps the score");
  ok(second.photos.every(p => !used.slice(0, 5).includes(p.id)), "the next round shows new photos");
  ok(G.nextRound(second, "Isi", pool) === second, "a next round cannot start while one is running");

  const third = G.nextRound({ ...second, phase: "summary" }, "Isi", pool, seeded(3));
  ok(third.photos.length === G.PHOTOS_PER_ROUND, "when too few fresh photos are left, the pool starts over");
}

/* memory and format */
{
  const pool = G.buildPool(trips, images);
  const first = G.createInitialState("Isi", "Benji", pool, seeded(5));
  const next = G.createInitialState("Isi", "Benji", pool, seeded(6), G.memoryOf(first));
  ok(next.photos.every(p => !first.used.includes(p.id)), "a new game does not repeat the photos of the last one");
  ok(G.isCurrentFormat(first) && !G.isCurrentFormat({ v: 0 }), "old rounds are recognised");
}

console.log(`\n${assertions} assertions passed (geo-engine)`);
