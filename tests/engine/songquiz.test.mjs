import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Q = require("../../songquiz-engine.js");
const real = require("../../playlist.json");

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

const artistsList = [["Kraftklub"], ["Kraftklub", "Nina Chuba"], ["Nina Chuba"], ["CRO"], ["Ski Aggu", "GDA"], ["Provinz"], ["Bosse"], ["Paula Carolina"]];
const playlist = {
  name: "Test",
  tracks: artistsList.map((artists, i) => ({ id: `t${i}`, title: `Song ${i}`, artists, preview: i === 7 ? "" : `p${i}.mp3`, cover: `c${i}.jpg`, released: "2025-01-01" }))
};
playlist.tracks.push({ id: "bad", title: "", artists: ["X"] }, { id: "bad2", title: "Kein Künstler", artists: [] });

/* pool */
{
  const pool = Q.buildPool(playlist);
  ok(pool.songs.length === 8, "songs without title or artist are dropped");
  ok(Q.poolProblem(pool) === null, "eight songs with previews are playable");
  ok(Q.poolProblem(Q.buildPool({ tracks: playlist.tracks.slice(0, 3) })) !== null, "fewer than four songs with a preview are not enough");
  ok(Q.poolProblem(Q.buildPool({ tracks: playlist.tracks.slice(0, 4).map(t => ({ ...t, title: "Gleich" })) })) !== null, "four songs with the same title are not enough");
  throwsWith(() => Q.createInitialState("Isi", "Benji", Q.buildPool({ tracks: [] })), /mindestens vier Songs/, "a game cannot start without songs");
  const fromReal = Q.buildPool(real);
  ok(Q.poolProblem(fromReal) === null && fromReal.songs.length >= 50, `the real playlist.json is playable (${fromReal.songs.length} songs)`);
  ok(fromReal.songs.every(s => !/^[\s⁠]/.test(s.title)), "invisible characters in front of titles are removed");
}

/* questions */
for (let seed = 1; seed <= 40; seed++) {
  const pool = Q.buildPool(playlist);
  const s = Q.createInitialState("Isi", "Benji", pool, "mix", seeded(seed));
  for (const q of s.questions) {
    assert.equal(q.options.length, Q.OPTIONS);
    assert.equal(new Set(q.options.map(o => o.toLowerCase())).size, Q.OPTIONS);
    const right = q.kind === "artist" ? q.song.artists[0] : q.song.title;
    assert.equal(q.options[q.answer], right);
    if (q.kind === "artist") {
      /* a wrong answer is never somebody who is on the song, too */
      q.options.forEach((o, i) => { if (i !== q.answer) assert.ok(!q.song.artists.includes(o)); });
    }
    assert.ok(q.song.preview, "only songs with a preview are asked");
  }
  const kinds = s.questions.map(q => q.kind);
  assert.ok(kinds.every((k, i) => i === 0 || k !== kinds[i - 1]), "mixed alternates");
}
ok(true, "40 seeded rounds: four different options, the right one at answer, no co-artist as a wrong answer, only songs with a preview, mixed alternates");
{
  const pool = Q.buildPool(playlist);
  ok(Q.createInitialState("Isi", "Benji", pool, "title", seeded(3)).questions.every(q => q.kind === "title"), "mode 'title' only asks for titles");
  ok(Q.createInitialState("Isi", "Benji", pool, "artist", seeded(3)).questions.every(q => q.kind === "artist"), "mode 'artist' only asks for artists");
  ok(Q.createInitialState("Isi", "Benji", pool, "quatsch", seeded(3)).option === "mix", "an unknown mode becomes mixed");
}

/* a full round */
{
  const pool = Q.buildPool(playlist);
  let s = Q.createInitialState("Isi", "Benji", pool, "mix", seeded(7));
  ok(s.questions.length === Q.SONGS_PER_ROUND && new Set(s.questions.map(q => q.song.id)).size === Q.SONGS_PER_ROUND, "a round has five different songs");
  throwsWith(() => Q.pick(s, "Gast", 0, 1000), /nicht mit/, "strangers cannot answer");
  throwsWith(() => Q.pick(s, "Isi", 7, 1000), /gibt es nicht/, "only listed answers can be picked");

  const right = Q.currentQuestion(s).answer;
  const wrong = (right + 1) % Q.OPTIONS;
  s = Q.pick(s, "Isi", right, 2400);
  ok(s.phase === "play" && s.picks.Isi.choice === right && s.picks.Isi.ms === 2400, "one answer is kept, no reveal yet");
  throwsWith(() => Q.pick(s, "Isi", wrong, 3000), /schon geantwortet/, "nobody answers twice");
  s = Q.pick(s, "Benji", wrong, 1200);
  ok(s.phase === "reveal" && s.scores.Isi === 1 && s.scores.Benji === 0, "after both answered: only the right answer scores");
  ok(s.answers[0].fastest === null, "no speed bonus when only one is right");
  throwsWith(() => Q.pick(s, "Isi", right, 1), /nicht geraten/, "no answers during the reveal");

  s = Q.advance(s);
  ok(s.phase === "play" && s.index === 1 && s.picks.Isi === null, "next song with fresh answers");
  const r2 = Q.currentQuestion(s).answer;
  s = Q.pick(s, "Isi", r2, 5000);
  s = Q.pick(s, "Benji", r2, 3100);
  ok(s.answers[1].fastest === "Benji" && s.scores.Benji === 2 && s.scores.Isi === 2, "both right: the faster one gets a bonus point");

  s = Q.advance(s);
  const r3 = Q.currentQuestion(s).answer;
  s = Q.pick(s, "Isi", r3, 4000);
  s = Q.pick(s, "Benji", r3, 4000);
  ok(s.answers[2].fastest === null && s.scores.Isi === 3 && s.scores.Benji === 3, "exactly as fast: no bonus");

  s = Q.advance(s);
  s = Q.pick(s, "Isi", Q.currentQuestion(s).answer, -50);
  ok(s.picks.Isi.ms === 0, "a negative time is cleaned to 0");
  s = Q.pick(s, "Benji", Q.currentQuestion(s).answer, 10 ** 9);
  ok(s.answers[3].picks.Benji.ms === Q.MAX_MS && s.answers[3].fastest === "Isi", "a huge time is capped");
  s = Q.advance(s);
  s = Q.pick(s, "Isi", (Q.currentQuestion(s).answer + 1) % 4, 1);
  s = Q.pick(s, "Benji", (Q.currentQuestion(s).answer + 1) % 4, 1);
  s = Q.advance(s);
  ok(s.phase === "summary", "after the fifth song comes the result");
  ok(Q.roundScore(s, "Isi") === 5 && Q.roundScore(s, "Benji") === 4 && Q.leader(s) === "Isi", "round score and leader");
  ok(Q.isRight(s, 0, "Isi") && !Q.isRight(s, 0, "Benji"), "isRight per song and player");

  const firstSongs = s.questions.map(q => q.song.id);
  s = Q.nextRound(s, "Isi", pool, seeded(9));
  ok(s.round === 2 && s.phase === "play" && s.scores.Isi === 5, "next round keeps the total score");
  ok(s.option === "mix", "next round keeps the mode");
  ok(s.questions.every(q => !firstSongs.includes(q.song.id)) || pool.songs.filter(x => x.preview).length < 10, "next round prefers songs not heard yet");
  const memory = Q.memoryOf(s);
  const again = Q.createInitialState("Isi", "Benji", pool, "mix", seeded(11), memory);
  ok(Array.isArray(again.used) && again.used.length >= Q.SONGS_PER_ROUND, "a new game carries the songs already heard");
  ok(Q.isCurrentFormat(s) && !Q.isCurrentFormat({ v: 0 }), "format check");
}

console.log(`\n${assertions} assertions passed (song quiz engine)`);
