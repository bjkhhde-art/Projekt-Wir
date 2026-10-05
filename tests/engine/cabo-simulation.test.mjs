import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Engine = require("../../cabo-engine.js");

/* Randomized full-game simulation: plays until gameOver, checking invariants every step. */

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function playRandomRound(state) {
  for (const p of state.players) state = Engine.performInitialPeek(state, p);

  let steps = 0;
  const MAX_STEPS = 500;

  while (!state.roundOver) {
    steps++;
    if (steps > MAX_STEPS) throw new Error("Round did not terminate within step budget");

    const person = state.turnPerson;

    /* invariant: total cards (hands + deck + discard) always 52 */
    const handTotal = state.players.reduce((sum, p) => sum + state.hands[p].length, 0);
    const total = handTotal + state.deck.length + state.discard.length + (state.drawnCard != null ? 1 : 0);
    assert.equal(total, 52, `card conservation invariant violated at step ${steps} (got ${total})`);

    if (state.turnPhase === "awaiting-draw") {
      // occasionally call cabo, mostly draw
      if (!state.caboCalledBy && Math.random() < 0.04) {
        state = Engine.callCabo(state, person);
        continue;
      }
      state = Math.random() < 0.7 || state.discard.length === 0
        ? Engine.drawFromDeck(state, person)
        : Engine.drawFromDiscard(state, person);
    } else if (state.turnPhase === "post-draw-decision") {
      const canDiscard = state.drawSource === "deck";
      const handLen = state.hands[person].length;
      if (canDiscard && Math.random() < 0.5) {
        state = Engine.discardDrawn(state, person);
      } else {
        // pick 1..handLen distinct slots; multi-picks exercise both matched and mismatched swaps
        const count = Math.random() < 0.7 ? 1 : 1 + Math.floor(Math.random() * handLen);
        const slots = [...Array(handLen).keys()].sort(() => Math.random() - 0.5).slice(0, count);
        state = Engine.swapCards(state, person, slots);
      }
      assert.ok(state.players.every(p => state.hands[p].length >= 1), "every hand keeps at least one card");
    } else if (state.turnPhase === "await-peek-own-target") {
      state = Engine.choosePeekOwnTarget(state, person, Math.floor(Math.random() * state.hands[person].length));
    } else if (state.turnPhase === "await-spy-target") {
      const target = randomChoice(state.players.filter(p => p !== person));
      state = Engine.chooseSpyTarget(state, person, target, Math.floor(Math.random() * state.hands[target].length));
    } else if (state.turnPhase === "peek-result") {
      state = Engine.finishPeek(state, person);
    } else if (state.turnPhase === "await-swap-target") {
      const target = randomChoice(state.players.filter(p => p !== person));
      state = Math.random() < 0.2
        ? Engine.skipSwap(state, person)
        : Engine.swapWithOpponent(
          state, person,
          Math.floor(Math.random() * state.hands[person].length),
          target,
          Math.floor(Math.random() * state.hands[target].length)
        );
    } else {
      throw new Error("Unexpected phase: " + state.turnPhase);
    }
  }

  return { state, steps };
}

let totalRounds = 0;
let totalSteps = 0;

const TABLES = [["Isi", "Benji"], ["Isi", "Benji", "Lena"], ["Isi", "Benji", "Lena", "Tom"]];
for (let game = 0; game < 45; game++) {
  const players = TABLES[game % TABLES.length];
  let state = Engine.createInitialState(players);

  while (!state.gameOver) {
    const { state: afterRound, steps } = playRandomRound(state);
    totalRounds++;
    totalSteps += steps;
    state = afterRound;

    players.forEach(p => assert.ok(state.roundScores[p] >= 0, `round score non-negative (${p})`));

    if (!state.gameOver) {
      state = Engine.startNextRound(state);
    }
  }

  assert.ok(players.includes(state.winner), `game ${game} produced a valid winner`);
  const total = p => state.scores[p].reduce((a, b) => a + b, 0);
  assert.ok(players.every(p => total(state.winner) <= total(p)), "winner has the lowest (or equal) cumulative total");
}

console.log(`45 full randomized games with 2, 3 and 4 players simulated successfully.`);
console.log(`Total rounds: ${totalRounds}, total turn-steps: ${totalSteps}, avg steps/round: ${(totalSteps / totalRounds).toFixed(1)}`);
console.log("All invariants held (card conservation, valid winner, non-negative scores).");
