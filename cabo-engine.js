/* Cabo – reine Spiellogik, ohne DOM-Abhängigkeit (im Browser als <script> geladen, in Node per require testbar). */

const CARD_COUNTS = { 0: 2, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4, 13: 2 };
const CABO_TARGET_SCORE = 100;
const HAND_SIZE = 4;

function buildDeck() {
  const deck = [];
  Object.keys(CARD_COUNTS).forEach(valueStr => {
    const value = Number(valueStr);
    for (let i = 0; i < CARD_COUNTS[value]; i++) deck.push(value);
  });
  return deck;
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function otherPerson(state, person) {
  return state.players.find(p => p !== person);
}

/* Every visible card movement gets a sequence number so each device can animate it exactly once. */
function recordMove(state, move) {
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.lastMove = { ...move, seq: state.moveSeq };
}

function dealRound(players, startingPerson, scores, round, previousMoveSeq) {
  let deck = shuffle(buildDeck());

  const hands = {};
  players.forEach(person => {
    hands[person] = deck.splice(0, HAND_SIZE);
  });

  const discard = [deck.shift()];
  const moveSeq = (previousMoveSeq || 0) + 1;

  return {
    moveSeq,
    lastMove: { type: "deal", seq: moveSeq },
    players,
    hands,
    deck,
    discard,
    turnPerson: startingPerson,
    turnPhase: "initial-peek",
    drawnCard: null,
    drawSource: null,
    lastPeekResult: null,
    lastEvent: null,
    caboCalledBy: null,
    finalTurnsRemaining: [],
    roundOver: false,
    roundScores: null,
    revealHands: false,
    initialPeekDone: players.reduce((acc, p) => { acc[p] = false; return acc; }, {}),
    scores: scores || players.reduce((acc, p) => { acc[p] = []; return acc; }, {}),
    round: round || 1,
    gameOver: false,
    winner: null
  };
}

function createInitialState(hostPerson, guestPerson) {
  return dealRound([hostPerson, guestPerson], hostPerson, null, 1);
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function assertTurn(state, person) {
  if (state.roundOver) throw new Error("Die Runde ist bereits vorbei.");
  if (state.turnPhase === "initial-peek") throw new Error("Erst müssen beide ihre Startkarten ansehen.");
  if (state.turnPerson !== person) throw new Error("Du bist gerade nicht am Zug.");
}

function assertSlot(hand, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= hand.length) {
    throw new Error("Ungültiger Platz.");
  }
}

function ensureDeck(state) {
  if (state.deck.length > 0) return;
  const top = state.discard[state.discard.length - 1];
  const rest = state.discard.slice(0, -1);
  state.deck = shuffle(rest);
  state.discard = [top];
}

function advanceTurn(state, finishedPerson) {
  if (state.caboCalledBy) {
    state.finalTurnsRemaining = state.finalTurnsRemaining.filter(p => p !== finishedPerson);
    if (state.finalTurnsRemaining.length === 0) {
      finishRound(state);
      return;
    }
  }

  state.turnPerson = otherPerson(state, finishedPerson);
  state.turnPhase = "awaiting-draw";
  state.drawnCard = null;
  state.drawSource = null;
  state.lastPeekResult = null;
}

function finishRound(state) {
  state.roundOver = true;
  state.revealHands = true;
  state.turnPhase = "finished";
  state.drawnCard = null;
  state.drawSource = null;
  state.lastPeekResult = null;

  const roundScores = {};
  state.players.forEach(person => {
    roundScores[person] = state.hands[person].reduce((sum, v) => sum + v, 0);
  });
  state.roundScores = roundScores;

  state.players.forEach(person => {
    state.scores[person] = [...(state.scores[person] || []), roundScores[person]];
  });

  const totals = state.players.map(person => ({
    person,
    total: state.scores[person].reduce((sum, v) => sum + v, 0)
  }));

  const anyOver = totals.some(t => t.total >= CABO_TARGET_SCORE);
  if (anyOver) {
    state.gameOver = true;
    const lowest = totals.reduce((best, t) => (t.total < best.total ? t : best), totals[0]);
    state.winner = lowest.person;
  }
}

/* ---------- player actions (each returns a NEW state) ---------- */

function performInitialPeek(state, person) {
  if (state.turnPhase !== "initial-peek") throw new Error("Die Startkarten wurden schon angesehen.");
  if (!state.players.includes(person)) throw new Error("Unbekannte Person.");

  const next = cloneState(state);
  next.initialPeekDone[person] = true;

  if (next.players.every(p => next.initialPeekDone[p])) {
    next.turnPhase = "awaiting-draw";
  }

  return next;
}

function drawFromDeck(state, person) {
  assertTurn(state, person);
  if (state.turnPhase !== "awaiting-draw") throw new Error("Du kannst gerade nicht ziehen.");

  const next = cloneState(state);
  const reshuffled = next.deck.length === 0 ? next.discard.length - 1 : 0;
  ensureDeck(next);
  next.drawnCard = next.deck.pop();
  next.drawSource = "deck";
  next.turnPhase = "post-draw-decision";
  next.lastEvent = reshuffled ? { type: "reshuffle", person, count: reshuffled } : null;
  recordMove(next, { type: "draw", from: "deck", person, card: next.drawnCard, reshuffled });
  return next;
}

function drawFromDiscard(state, person) {
  assertTurn(state, person);
  if (state.turnPhase !== "awaiting-draw") throw new Error("Du kannst gerade nicht ziehen.");
  if (state.discard.length === 0) throw new Error("Der Ablagestapel ist leer.");

  const next = cloneState(state);
  next.drawnCard = next.discard.pop();
  next.drawSource = "discard";
  next.turnPhase = "post-draw-decision";
  next.lastEvent = null;
  recordMove(next, { type: "draw", from: "discard", person, card: next.drawnCard });
  return next;
}

function callCabo(state, person) {
  assertTurn(state, person);
  if (state.turnPhase !== "awaiting-draw") throw new Error("Cabo kann nur zu Beginn deines Zuges gerufen werden.");
  if (state.caboCalledBy) throw new Error("Cabo wurde schon gerufen.");

  const next = cloneState(state);
  next.caboCalledBy = person;
  next.finalTurnsRemaining = next.players.filter(p => p !== person);
  next.lastEvent = { type: "cabo", person };
  advanceTurn(next, person);
  return next;
}

/* Swap the drawn card for one or more own cards. Several cards only work if they all
   have the same value; otherwise they stay and the drawn card is discarded (turn lost). */
function swapCards(state, person, slotIndices) {
  assertTurn(state, person);
  if (state.turnPhase !== "post-draw-decision") throw new Error("Gerade ist kein Tausch möglich.");
  if (!Array.isArray(slotIndices) || slotIndices.length === 0) throw new Error("Wähle mindestens eine Karte zum Tauschen.");

  const slots = [...new Set(slotIndices)].sort((a, b) => a - b);
  if (slots.length !== slotIndices.length) throw new Error("Jede Karte darf nur einmal gewählt werden.");
  slots.forEach(index => assertSlot(state.hands[person], index));

  const next = cloneState(state);
  const hand = next.hands[person];
  const chosen = slots.map(index => hand[index]);
  const allEqual = chosen.every(value => value === chosen[0]);
  const move = { person, slots, card: next.drawnCard, drawSource: next.drawSource };

  if (allEqual) {
    next.discard.push(...chosen);
    hand[slots[0]] = next.drawnCard;
    for (let k = slots.length - 1; k >= 1; k--) hand.splice(slots[k], 1);
    next.lastEvent = slots.length > 1 ? { type: "multi-swap", person, count: slots.length } : null;
    recordMove(next, { ...move, type: "swap", discarded: chosen });
  } else {
    next.discard.push(next.drawnCard);
    next.lastEvent = { type: "multi-swap-failed", person, count: slots.length };
    recordMove(next, { ...move, type: "swap-failed" });
  }

  advanceTurn(next, person);
  return next;
}

function discardDrawn(state, person) {
  assertTurn(state, person);
  if (state.turnPhase !== "post-draw-decision") throw new Error("Gerade gibt es nichts zum Ablegen.");
  if (state.drawSource !== "deck") throw new Error("Eine vom Ablagestapel gezogene Karte muss getauscht werden.");

  const next = cloneState(state);
  const card = next.drawnCard;
  next.discard.push(card);
  next.drawnCard = null;
  next.drawSource = null;
  recordMove(next, { type: "discard", person, card });

  if (card === 7 || card === 8) {
    next.turnPhase = "await-peek-own-target";
    return next;
  }

  if (card === 9 || card === 10) {
    next.turnPhase = "await-spy-target";
    return next;
  }

  if (card === 11 || card === 12) {
    next.turnPhase = "await-swap-target";
    return next;
  }

  advanceTurn(next, person);
  return next;
}

function choosePeekOwnTarget(state, person, slotIndex) {
  assertTurn(state, person);
  if (state.turnPhase !== "await-peek-own-target") throw new Error("Gerade ist kein Blick auf eigene Karten möglich.");
  assertSlot(state.hands[person], slotIndex);

  const next = cloneState(state);
  next.lastPeekResult = { person, type: "own", slot: slotIndex };
  next.turnPhase = "peek-result";
  return next;
}

function chooseSpyTarget(state, person, slotIndex) {
  assertTurn(state, person);
  if (state.turnPhase !== "await-spy-target") throw new Error("Gerade ist kein Blick auf gegnerische Karten möglich.");
  const target = otherPerson(state, person);
  assertSlot(state.hands[target], slotIndex);

  const next = cloneState(state);
  next.lastPeekResult = { person, type: "spy", targetPerson: target, slot: slotIndex };
  next.turnPhase = "peek-result";
  return next;
}

/* The looked-at card stays visible until its owner turns it back; that ends the turn. */
function finishPeek(state, person) {
  assertTurn(state, person);
  if (state.turnPhase !== "peek-result") throw new Error("Gerade gibt es keine aufgedeckte Karte.");

  const next = cloneState(state);
  advanceTurn(next, person);
  return next;
}

/* Swap power (11/12): blindly exchange one own card with one of the opponent's. */
function swapWithOpponent(state, person, ownIndex, opponentIndex) {
  assertTurn(state, person);
  if (state.turnPhase !== "await-swap-target") throw new Error("Gerade ist kein Kartentausch mit dem anderen möglich.");
  const target = otherPerson(state, person);
  assertSlot(state.hands[person], ownIndex);
  assertSlot(state.hands[target], opponentIndex);

  const next = cloneState(state);
  const ownCard = next.hands[person][ownIndex];
  next.hands[person][ownIndex] = next.hands[target][opponentIndex];
  next.hands[target][opponentIndex] = ownCard;
  next.lastEvent = { type: "blind-swap", person, targetPerson: target, ownIndex, opponentIndex };
  recordMove(next, { type: "blind-swap", person, targetPerson: target, ownIndex, opponentIndex });
  advanceTurn(next, person);
  return next;
}

function skipSwap(state, person) {
  assertTurn(state, person);
  if (state.turnPhase !== "await-swap-target") throw new Error("Gerade gibt es nichts zu überspringen.");

  const next = cloneState(state);
  advanceTurn(next, person);
  return next;
}

function startNextRound(state) {
  if (!state.roundOver) throw new Error("Die laufende Runde ist noch nicht vorbei.");
  if (state.gameOver) throw new Error("Das Spiel ist bereits vorbei.");

  const previousStarter = state.round % 2 === 1 ? state.players[0] : state.players[1];
  const nextStarter = otherPerson(state, previousStarter) || state.players[0];

  return dealRound(state.players, nextStarter, state.scores, state.round + 1, state.moveSeq);
}

const CaboEngine = {
  CARD_COUNTS,
  CABO_TARGET_SCORE,
  HAND_SIZE,
  buildDeck,
  shuffle,
  createInitialState,
  performInitialPeek,
  drawFromDeck,
  drawFromDiscard,
  callCabo,
  swapCards,
  discardDrawn,
  choosePeekOwnTarget,
  chooseSpyTarget,
  finishPeek,
  swapWithOpponent,
  skipSwap,
  startNextRound,
  otherPerson
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CaboEngine;
}
if (typeof window !== "undefined") {
  window.CaboEngine = CaboEngine;
}
