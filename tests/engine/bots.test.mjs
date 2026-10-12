import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Bots = require("../../game-bots.js");
const C = require("../../cabo-engine.js");
const N = require("../../nimmt-engine.js");
const Q = require("../../qwixx-engine.js");
const F = require("../../flip7-engine.js");

/* Grog plays whole games against simple random players: no rule is ever broken,
   every game comes to an end, and Grog does clearly better than chance. */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const pick = list => list[Math.floor(Math.random() * list.length)];
const avg = list => list.reduce((a, b) => a + b, 0) / list.length;

/* ---------- 6 nimmt! ---------- */
{
  const grog = [], random = [];
  for (let game = 0; game < 300; game++) {
    let s = N.createInitialState(["Grog", "Isi", "Benji"]);
    for (let guard = 0; s.phase !== "finished"; guard++) {
      assert.ok(guard < 500, "6 nimmt! game hangs");
      const moved = Bots.nimmt.play(s, "Grog");
      if (moved) { s = moved; continue; }
      if (s.phase === "pick-row") { s = N.pickRow(s, s.pickPerson, Math.floor(Math.random() * s.rows.length)); continue; }
      const p = s.players.find(x => x !== "Grog" && s.chosen[x] === null);
      s = N.chooseCard(s, p, pick(s.hands[p]));
    }
    grog.push(s.result.bulls.Grog);
    random.push((s.result.bulls.Isi + s.result.bulls.Benji) / 2);
  }
  ok(true, "300 games of 6 nimmt! with Grog end normally");
  ok(Bots.nimmt.play(N.createInitialState(["Grog", "Isi"]), "Isi") !== null, "the bot can play any seat");
  console.log(`  6 nimmt!: Grog ${avg(grog).toFixed(1)} bulls, random players ${avg(random).toFixed(1)}`);
  ok(avg(grog) < avg(random) * 0.75, "Grog takes clearly fewer bulls than random players");
}

/* ---------- Qwixx ---------- */
{
  const grog = [], random = [];
  for (let game = 0; game < 200; game++) {
    let s = Q.createInitialState(["Isi", "Grog", "Benji"], pick(["classic", "colors", "numbers", "random"]));
    for (let guard = 0; s.phase !== "finished"; guard++) {
      assert.ok(guard < 5000, "Qwixx game hangs");
      const moved = Bots.qwixx.play(s, "Grog");
      if (moved) { s = moved; continue; }
      if (s.phase === "roll") { s = Q.roll(s, s.active); continue; }
      if (s.phase === "white") {
        const p = s.players.find(x => x !== "Grog" && !s.white[x].done);
        const options = Q.whiteOptions(s, p);
        s = options.length && Math.random() < 0.5 ? Q.crossWhite(s, p, ...Object.values(pick(options))) : Q.passWhite(s, p);
        continue;
      }
      const options = Q.colorOptions(s, s.active);
      s = options.length && Math.random() < 0.6 ? Q.crossColor(s, s.active, ...Object.values(pick(options))) : Q.passColor(s, s.active);
    }
    grog.push(s.result.scores.Grog.total);
    random.push((s.result.scores.Isi.total + s.result.scores.Benji.total) / 2);
  }
  ok(true, "200 games of Qwixx with Grog end normally (all four blocks)");
  console.log(`  Qwixx: Grog ${avg(grog).toFixed(1)} points, random players ${avg(random).toFixed(1)}`);
  ok(avg(grog) > avg(random) + 10, "Grog scores clearly more than random players");
}

/* ---------- Flip 7 ---------- */
{
  let grogWins = 0, rounds = 0, grogPoints = 0, otherPoints = 0;
  const games = 200;
  for (let game = 0; game < games; game++) {
    let s = F.createInitialState(["Isi", "Grog", "Benji"]);
    for (let guard = 0; s.phase !== "finished"; guard++) {
      assert.ok(guard < 3000, "Flip 7 game hangs");
      assert.equal(F.countCards(s), 94, "no card gets lost");
      const moved = Bots.flip7.play(s, "Grog");
      if (moved) { s = moved; continue; }
      if (s.phase === "round-over") {
        rounds++;
        grogPoints += s.lastRound.scores.Grog;
        otherPoints += (s.lastRound.scores.Isi + s.lastRound.scores.Benji) / 2;
        s = F.nextRound(s, "Isi");
        continue;
      }
      if (s.choice) { s = F.chooseTarget(s, s.choice.chooser, pick(s.choice.candidates)); continue; }
      const p = s.turnPerson;
      /* the random players: one more card with a coin flip, always at least two */
      s = s.table[p].numbers.length < 2 || Math.random() < 0.5 ? F.hit(s, p) : F.stay(s, p);
    }
    if (s.result.winner === "Grog") grogWins++;
  }
  ok(true, `${games} games of Flip 7 with Grog end normally, no card lost`);
  console.log(`  Flip 7: Grog wins ${grogWins}/${games}, ${(grogPoints / rounds).toFixed(1)} points a round vs ${(otherPoints / rounds).toFixed(1)}`);
  ok(grogPoints / rounds > otherPoints / rounds + 3, "Grog makes more points per round than coin-flip players");
  ok(grogWins > games * 0.45, "Grog wins far more than a third of the games");
}

/* ---------- Cabo ---------- */
{
  let grogRounds = [], randomRounds = [], cheated = 0;
  for (let game = 0; game < 150; game++) {
    let s = C.createInitialState(["Grog", "Isi", "Benji"]);
    for (let guard = 0; !s.gameOver; guard++) {
      assert.ok(guard < 20000, "Cabo game hangs");
      if (s.roundOver) {
        grogRounds.push(s.roundScores.Grog);
        randomRounds.push((s.roundScores.Isi + s.roundScores.Benji) / 2);
        s = C.startNextRound(s);
        continue;
      }
      const moved = Bots.cabo.play(s, "Grog");
      if (moved) {
        /* everything the bot remembers is true – and it was really seen */
        const memory = moved.botMemory && moved.botMemory.Grog;
        if (memory) Object.entries(memory.own).forEach(([slot, v]) => { if (moved.hands.Grog[slot] !== v && !moved.roundOver) cheated++; });
        s = moved;
        continue;
      }
      if (s.turnPhase === "initial-peek") {
        s = C.performInitialPeek(s, s.players.find(p => !s.initialPeekDone[p]));
        continue;
      }
      const p = s.turnPerson;
      switch (s.turnPhase) {
        case "awaiting-draw": s = C.drawFromDeck(s, p); break;
        case "post-draw-decision": s = Math.random() < 0.5 ? C.swapCards(s, p, [Math.floor(Math.random() * s.hands[p].length)]) : C.discardDrawn(s, p); break;
        case "await-peek-own-target": s = C.choosePeekOwnTarget(s, p, 0); break;
        case "await-spy-target": { const t = s.players.find(x => x !== p); s = C.chooseSpyTarget(s, p, t, 0); break; }
        case "await-swap-target": s = C.skipSwap(s, p); break;
        case "peek-result": s = C.finishPeek(s, p); break;
        default: throw new Error("unexpected phase " + s.turnPhase);
      }
    }
  }
  ok(true, "150 games of Cabo with Grog end normally");
  ok(cheated === 0, "Grog's memory only holds cards that are really there");
  console.log(`  Cabo: Grog ${avg(grogRounds).toFixed(1)} points a round, random players ${avg(randomRounds).toFixed(1)}`);
  ok(avg(grogRounds) < avg(randomRounds) * 0.7, "Grog ends rounds with clearly fewer points");
}

/* Cabo: the memory starts with the two peeked cards and never knows unseen ones */
{
  let s = C.createInitialState(["Isi", "Grog"]);
  s = Bots.cabo.play(s, "Grog");
  ok(Object.keys(s.botMemory.Grog.own).join() === "0,1", "after the start Grog knows exactly his two peeked cards");
  ok(Bots.cabo.play(s, "Grog") === null, "and waits for the others to look at theirs");
  s = C.performInitialPeek(s, "Isi");
  ok(Bots.cabo.play(s, "Grog") === null, "it is Isi's turn first – Grog waits");
}

/* Flip 7: freeze yourself with a good round, Flip Three for the one with most cards */
{
  const s = F.createInitialState(["Isi", "Grog"]);
  Object.assign(s, {
    phase: "play", turnPerson: "Grog",
    table: {
      Isi: { numbers: [3, 8, 11], mods: [], actions: [], status: "active", flip7: false, bust: null },
      Grog: { numbers: [12, 10, 9], mods: [], actions: [], status: "active", flip7: false, bust: null }
    },
    queue: [{ type: "freeze", card: "freeze", chooser: "Grog" }],
    choice: { type: "freeze", chooser: "Grog", candidates: ["Isi", "Grog"] }
  });
  ok(Bots.flip7.play(s, "Grog").table.Grog.status === "frozen", "with 31 points Grog freezes himself and banks them");
  s.queue = [{ type: "flip3", card: "flip3", chooser: "Grog" }];
  s.choice = { type: "flip3", chooser: "Grog", candidates: ["Isi", "Grog"] };
  const after = Bots.flip7.play(s, "Grog");
  ok(after.lastMove.type === "target" && after.lastMove.target === "Isi", "a Flip Three goes to Isi");
  ok(Bots.flip7.play(s, "Isi") === null, "nobody else decides for Grog's card");
}

console.log(`\n${n} assertions passed (Grog: computer player)`);
