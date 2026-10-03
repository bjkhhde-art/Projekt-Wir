import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Engine = require("../../cabo-engine.js");

/* Randomized full-game simulation: plays until gameOver, checking invariants every step. */

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function playRandomRound(state) {
  state = Engine.performInitialPeek(state, "Isi");
  state = Engine.performInitialPeek(state, "Benji");

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
      const target = Engine.otherPerson(state, person);
      state = Engine.chooseSpyTarget(state, person, Math.floor(Math.random() * state.hands[target].length));
    } else if (state.turnPhase === "peek-result") {
      state = Engine.finishPeek(state, person);
    } else if (state.turnPhase === "await-swap-target") {
      const target = Engine.otherPerson(state, person);
      state = Math.random() < 0.2
        ? Engine.skipSwap(state, person)
        : Engine.swapWithOpponent(
          state, person,
          Math.floor(Math.random() * state.hands[person].length),
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

for (let game = 0; game < 25; game++) {
  let state = Engine.createInitialState("Isi", "Benji");

  while (!state.gameOver) {
    const { state: afterRound, steps } = playRandomRound(state);
    totalRounds++;
    totalSteps += steps;
    state = afterRound;

    assert.ok(state.roundScores.Isi >= 0, "round score non-negative (Isi)");
    assert.ok(state.roundScores.Benji >= 0, "round score non-negative (Benji)");

    if (!state.gameOver) {
      state = Engine.startNextRound(state);
    }
  }

  assert.ok(state.winner === "Isi" || state.winner === "Benji", `game ${game} produced a valid winner`);
  const totals = {
    Isi: state.scores.Isi.reduce((a, b) => a + b, 0),
    Benji: state.scores.Benji.reduce((a, b) => a + b, 0)
  };
  assert.ok(totals[state.winner] <= totals[Engine.otherPerson(state, state.winner)], "winner has the lower (or equal) cumulative total");
}

console.log(`25 full randomized games simulated successfully.`);
console.log(`Total rounds: ${totalRounds}, total turn-steps: ${totalSteps}, avg steps/round: ${(totalSteps / totalRounds).toFixed(1)}`);
console.log("All invariants held (card conservation, valid winner, non-negative scores).");
