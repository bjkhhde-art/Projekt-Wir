import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Bots = require("../../game-bots.js");
const C = require("../../cabo-engine.js");
const N = require("../../nimmt-engine.js");
const Q = require("../../qwixx-engine.js");
const F = require("../../flip7-engine.js");

/* Udiou plays whole games against simple random players: no rule is ever broken,
   every game comes to an end, and Udiou does clearly better than chance. */
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS:", m); };
const pick = list => list[Math.floor(Math.random() * list.length)];
const avg = list => list.reduce((a, b) => a + b, 0) / list.length;

/* ---------- 6 nimmt! ---------- */
{
  const udiou = [], random = [];
  for (let game = 0; game < 300; game++) {
    let s = N.createInitialState(["Udiou", "Isi", "Benji"]);
    for (let guard = 0; s.phase !== "finished"; guard++) {
      assert.ok(guard < 500, "6 nimmt! game hangs");
      const moved = Bots.nimmt.play(s, "Udiou");
      if (moved) { s = moved; continue; }
      if (s.phase === "pick-row") { s = N.pickRow(s, s.pickPerson, Math.floor(Math.random() * s.rows.length)); continue; }
      const p = s.players.find(x => x !== "Udiou" && s.chosen[x] === null);
      s = N.chooseCard(s, p, pick(s.hands[p]));
    }
    udiou.push(s.result.bulls.Udiou);
    random.push((s.result.bulls.Isi + s.result.bulls.Benji) / 2);
  }
  ok(true, "300 games of 6 nimmt! with Udiou end normally");
  ok(Bots.nimmt.play(N.createInitialState(["Udiou", "Isi"]), "Isi") !== null, "the bot can play any seat");
  console.log(`  6 nimmt!: Udiou ${avg(udiou).toFixed(1)} bulls, random players ${avg(random).toFixed(1)}`);
  ok(avg(udiou) < avg(random) * 0.75, "Udiou takes clearly fewer bulls than random players");
}

/* ---------- Qwixx ---------- */
{
  const udiou = [], random = [];
  for (let game = 0; game < 200; game++) {
    let s = Q.createInitialState(["Isi", "Udiou", "Benji"], pick(["classic", "colors", "numbers", "random"]));
    for (let guard = 0; s.phase !== "finished"; guard++) {
      assert.ok(guard < 5000, "Qwixx game hangs");
      const moved = Bots.qwixx.play(s, "Udiou");
      if (moved) { s = moved; continue; }
      if (s.phase === "roll") { s = Q.roll(s, s.active); continue; }
      if (s.phase === "white") {
        const p = s.players.find(x => x !== "Udiou" && !s.white[x].done);
        const options = Q.whiteOptions(s, p);
        s = options.length && Math.random() < 0.5 ? Q.crossWhite(s, p, ...Object.values(pick(options))) : Q.passWhite(s, p);
        continue;
      }
      const options = Q.colorOptions(s, s.active);
      s = options.length && Math.random() < 0.6 ? Q.crossColor(s, s.active, ...Object.values(pick(options))) : Q.passColor(s, s.active);
    }
    udiou.push(s.result.scores.Udiou.total);
    random.push((s.result.scores.Isi.total + s.result.scores.Benji.total) / 2);
  }
  ok(true, "200 games of Qwixx with Udiou end normally (all four blocks)");
  console.log(`  Qwixx: Udiou ${avg(udiou).toFixed(1)} points, random players ${avg(random).toFixed(1)}`);
  ok(avg(udiou) > avg(random) + 10, "Udiou scores clearly more than random players");
}

/* ---------- Flip 7 ---------- */
{
  let udiouWins = 0, rounds = 0, udiouPoints = 0, otherPoints = 0;
  const games = 200;
  for (let game = 0; game < games; game++) {
    let s = F.createInitialState(["Isi", "Udiou", "Benji"]);
    for (let guard = 0; s.phase !== "finished"; guard++) {
      assert.ok(guard < 3000, "Flip 7 game hangs");
      assert.equal(F.countCards(s), 94, "no card gets lost");
      const moved = Bots.flip7.play(s, "Udiou");
      if (moved) { s = moved; continue; }
      if (s.phase === "round-over") {
        rounds++;
        udiouPoints += s.lastRound.scores.Udiou;
        otherPoints += (s.lastRound.scores.Isi + s.lastRound.scores.Benji) / 2;
        s = F.nextRound(s, "Isi");
        continue;
      }
      if (s.choice) { s = F.chooseTarget(s, s.choice.chooser, pick(s.choice.candidates)); continue; }
      const p = s.turnPerson;
      /* the random players: one more card with a coin flip, always at least two */
      s = s.table[p].numbers.length < 2 || Math.random() < 0.5 ? F.hit(s, p) : F.stay(s, p);
    }
    if (s.result.winner === "Udiou") udiouWins++;
  }
  ok(true, `${games} games of Flip 7 with Udiou end normally, no card lost`);
  console.log(`  Flip 7: Udiou wins ${udiouWins}/${games}, ${(udiouPoints / rounds).toFixed(1)} points a round vs ${(otherPoints / rounds).toFixed(1)}`);
  /* the lead is about 3.5 points a round but varies from game sample to sample (seen 2.4 … 4.5); a coin-flip bot would be at 0 */
  ok(udiouPoints / rounds > otherPoints / rounds + 1.5, "Udiou makes more points per round than coin-flip players");
  ok(udiouWins > games * 0.45, "Udiou wins far more than a third of the games");
}

/* ---------- Cabo ---------- */
{
  let udiouRounds = [], randomRounds = [], cheated = 0;
  for (let game = 0; game < 150; game++) {
    let s = C.createInitialState(["Udiou", "Isi", "Benji"]);
    for (let guard = 0; !s.gameOver; guard++) {
      assert.ok(guard < 20000, "Cabo game hangs");
      if (s.roundOver) {
        udiouRounds.push(s.roundScores.Udiou);
        randomRounds.push((s.roundScores.Isi + s.roundScores.Benji) / 2);
        s = C.startNextRound(s);
        continue;
      }
      const moved = Bots.cabo.play(s, "Udiou");
      if (moved) {
        /* everything the bot remembers is true – and it was really seen */
        const memory = moved.botMemory && moved.botMemory.Udiou;
        if (memory) Object.entries(memory.own).forEach(([slot, v]) => { if (moved.hands.Udiou[slot] !== v && !moved.roundOver) cheated++; });
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
  ok(true, "150 games of Cabo with Udiou end normally");
  ok(cheated === 0, "Udiou's memory only holds cards that are really there");
  console.log(`  Cabo: Udiou ${avg(udiouRounds).toFixed(1)} points a round, random players ${avg(randomRounds).toFixed(1)}`);
  ok(avg(udiouRounds) < avg(randomRounds) * 0.7, "Udiou ends rounds with clearly fewer points");
}

/* Cabo: the memory starts with the two peeked cards and never knows unseen ones */
{
  let s = C.createInitialState(["Isi", "Udiou"]);
  s = Bots.cabo.play(s, "Udiou");
  ok(Object.keys(s.botMemory.Udiou.own).join() === "0,1", "after the start Udiou knows exactly his two peeked cards");
  ok(Bots.cabo.play(s, "Udiou") === null, "and waits for the others to look at theirs");
  s = C.performInitialPeek(s, "Isi");
  ok(Bots.cabo.play(s, "Udiou") === null, "it is Isi's turn first – Udiou waits");
}

/* Flip 7: freeze yourself with a good round, Flip Three for the one with most cards */
{
  const s = F.createInitialState(["Isi", "Udiou"]);
  Object.assign(s, {
    phase: "play", turnPerson: "Udiou",
    table: {
      Isi: { numbers: [3, 8, 11], mods: [], actions: [], status: "active", flip7: false, bust: null },
      Udiou: { numbers: [12, 10, 9], mods: [], actions: [], status: "active", flip7: false, bust: null }
    },
    queue: [{ type: "freeze", card: "freeze", chooser: "Udiou" }],
    choice: { type: "freeze", chooser: "Udiou", candidates: ["Isi", "Udiou"] }
  });
  ok(Bots.flip7.play(s, "Udiou").table.Udiou.status === "frozen", "with 31 points Udiou freezes himself and banks them");
  s.queue = [{ type: "flip3", card: "flip3", chooser: "Udiou" }];
  s.choice = { type: "flip3", chooser: "Udiou", candidates: ["Isi", "Udiou"] };
  const after = Bots.flip7.play(s, "Udiou");
  ok(after.lastMove.type === "target" && after.lastMove.target === "Isi", "a Flip Three goes to Isi");
  ok(Bots.flip7.play(s, "Isi") === null, "nobody else decides for Udiou's card");
}

/* both computer players at one table: each keeps his own Cabo memory, all four games end */
{
  const bots = ["Udiou", "Klausi"];
  let games = 0;
  for (let game = 0; game < 40; game++) {
    let s = C.createInitialState(["Isi", "Udiou", "Klausi"]);
    for (let guard = 0; !s.gameOver; guard++) {
      assert.ok(guard < 20000, "Cabo with two bots hangs");
      if (s.roundOver) { s = C.startNextRound(s); continue; }
      const bot = bots.find(b => Bots.cabo.play(s, b));
      if (bot) {
        s = Bots.cabo.play(s, bot);
        /* right after his move, everything a bot remembers about his own cards is true */
        if (!s.roundOver) Object.entries(s.botMemory[bot].own).forEach(([slot, v]) => assert.equal(s.hands[bot][slot], v, "a memory belongs to its own bot"));
        continue;
      }
      if (s.turnPhase === "initial-peek") { s = C.performInitialPeek(s, "Isi"); continue; }
      s = s.turnPhase === "awaiting-draw" ? C.drawFromDeck(s, "Isi") : s.turnPhase === "post-draw-decision" ? C.discardDrawn(s, "Isi") : s.turnPhase === "peek-result" ? C.finishPeek(s, "Isi") : s.turnPhase === "await-swap-target" ? C.skipSwap(s, "Isi") : s.turnPhase === "await-peek-own-target" ? C.choosePeekOwnTarget(s, "Isi", 0) : C.chooseSpyTarget(s, "Isi", "Udiou", 0);
    }
    games++;
  }
  ok(games === 40, "Cabo: Isi against Udiou and Klausi – both play, each with his own memory");

  let s = F.createInitialState(["Udiou", "Klausi"]);
  for (let guard = 0; s.phase !== "finished"; guard++) {
    assert.ok(guard < 3000, "Flip 7 with two bots hangs");
    if (s.phase === "round-over") { s = F.nextRound(s, "Udiou"); continue; }
    s = bots.map(b => Bots.flip7.play(s, b)).find(Boolean);
  }
  ok(s.result.winner && bots.includes(s.result.winner), "Flip 7: Udiou and Klausi can play a whole game against each other");
}

console.log(`\n${n} assertions passed (Udiou and Klausi: computer players)`);
