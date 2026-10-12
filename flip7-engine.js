/* Flip 7 – pure rules for 2–4 players, following the rule sheet.
   No DOM: loaded as <script> in the browser, testable in Node via require.

   A round: the dealer gives everybody one open card (the dealer last). Then, one after the other,
   everybody still in the round says "Stopp" (bank the points) or "Noch eine" (one more card).
   A number you already have busts you (0 points) – unless you hold a Second Chance. Seven
   different numbers are a Flip 7: the round ends at once and you get 15 extra points.
   Action cards: Freeze (somebody is out and banks), Flip Three (somebody gets three cards),
   Second Chance (saves you once). The game ends when somebody has 200 points at the end of a round. */

const Flip7Engine = (() => {

const MAX_PLAYERS = 4;
const TARGET_SCORE = 200;
const FLIP7_BONUS = 15;
const FLIP7_COUNT = 7;
const FLIP_THREE_CARDS = 3;
const MODIFIERS = { x2: "×2", p2: "+2", p4: "+4", p6: "+6", p8: "+8", p10: "+10" };
const ACTIONS = { freeze: "Freeze", second: "Second Chance", flip3: "Flip Three" };

/* 79 number cards (twelve 12s … one 1, one 0), 6 bonus cards, 3 × 3 action cards */
function createDeck() {
  const deck = [];
  for (let value = 0; value <= 12; value++) {
    for (let i = 0; i < Math.max(value, 1); i++) deck.push(`n${value}`);
  }
  Object.keys(MODIFIERS).forEach(card => deck.push(card));
  Object.keys(ACTIONS).forEach(card => { for (let i = 0; i < 3; i++) deck.push(card); });
  return deck;
}

const isNumber = card => /^n\d+$/.test(card);
const numberOf = card => Number(card.slice(1));
const isModifier = card => Object.prototype.hasOwnProperty.call(MODIFIERS, card);
const isAction = card => Object.prototype.hasOwnProperty.call(ACTIONS, card);

function shuffle(cards, rand = Math.random) {
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function perPlayer(players, valueFn) {
  return players.reduce((acc, p) => { acc[p] = valueFn(p); return acc; }, {});
}

function freshSeat() {
  return { numbers: [], mods: [], actions: [], status: "active", flip7: false, bust: null };
}

/* ---------- scoring ---------- */

function scoreOf(seat) {
  if (!seat || seat.status === "busted") return 0;
  const numbers = seat.numbers.reduce((sum, v) => sum + v, 0);
  const doubled = seat.mods.includes("x2") ? numbers * 2 : numbers;
  const plus = seat.mods.filter(m => m !== "x2").reduce((sum, m) => sum + Number(m.slice(1)), 0);
  return doubled + plus + (seat.flip7 ? FLIP7_BONUS : 0);
}

/* ---------- seating order ---------- */

function orderFrom(state, startIndex) {
  const n = state.players.length;
  return Array.from({ length: n }, (_, i) => state.players[(startIndex + i) % n]);
}

const isActive = (state, person) => state.table[person] && state.table[person].status === "active";
const activePlayers = state => state.players.filter(p => isActive(state, p));

/* the next player still in the round after `person` (possibly `person` again) */
function nextActiveAfter(state, person) {
  const index = state.players.indexOf(person);
  return orderFrom(state, index + 1).find(p => isActive(state, p)) || null;
}

/* ---------- cards ---------- */

function event(state, entry) {
  state.events.push(entry);
}

/* the next card from the deck; an empty deck is refilled from the discard pile */
function draw(state, rand) {
  if (state.deck.length === 0) {
    if (state.discard.length === 0) return null;
    state.deck = shuffle(state.discard, rand);
    event(state, { type: "reshuffle", count: state.discard.length });
    state.discard = [];
  }
  return state.deck.pop();
}

/* a card lands in front of somebody */
function give(state, person, card) {
  const seat = state.table[person];
  const entry = { type: "card", person, card, result: "ok" };

  if (isNumber(card)) {
    const value = numberOf(card);
    if (seat.numbers.includes(value)) {
      if (seat.actions.includes("second")) {
        seat.actions.splice(seat.actions.indexOf("second"), 1);
        state.discard.push(card, "second");
        entry.result = "saved";
      } else {
        seat.status = "busted";
        seat.bust = card;
        entry.result = "bust";
      }
    } else {
      seat.numbers.push(value);
      if (seat.numbers.length >= FLIP7_COUNT) {
        seat.flip7 = true;
        state.flip7By = person;
        entry.result = "flip7";
      }
    }
  } else if (isModifier(card)) {
    seat.mods.push(card);
  } else if (card === "second") {
    if (!seat.actions.includes("second")) {
      seat.actions.push("second");
      entry.result = "kept";
    } else {
      /* only one Second Chance each – a second one goes to somebody else */
      state.queue.push({ type: "second", card, chooser: person });
      entry.result = "pass-on";
    }
  } else if (state.flip3 && state.flip3.target === person) {
    /* during Flip Three, Freeze and Flip Three only take effect once the three cards are dealt */
    state.flip3.deferred.push(card);
    entry.result = "later";
  } else {
    state.queue.push({ type: card, card, chooser: person });
    entry.result = "choose";
  }
  event(state, entry);
}

/* who may be picked for an action card */
function candidatesFor(state, entry) {
  if (entry.type === "second") {
    return activePlayers(state).filter(p => p !== entry.chooser && !state.table[p].actions.includes("second"));
  }
  return activePlayers(state).filter(p => !(entry.excludeChooser && p === entry.chooser));
}

function applyAction(state, entry, target) {
  const seat = state.table[target];
  seat.actions.push(entry.card);
  event(state, { type: entry.type, by: entry.chooser, target });
  if (entry.type === "freeze") {
    seat.status = "frozen";
  } else if (entry.type === "flip3") {
    state.flip3 = { target, left: FLIP_THREE_CARDS, deferred: [] };
  }
}

/* ---------- the automatic part: dealing, Flip Three, action cards ---------- */

function run(state, rand) {
  for (let guard = 0; guard < 500; guard++) {
    if (state.flip7By) return endRound(state);
    if (state.choice) return state;

    if (state.queue.length > 0) {
      const entry = state.queue[0];
      const candidates = candidatesFor(state, entry);
      if (candidates.length === 0) {
        state.queue.shift();
        state.discard.push(entry.card);
        event(state, { type: "wasted", card: entry.card, by: entry.chooser });
      } else if (candidates.length === 1) {
        state.queue.shift();
        applyAction(state, entry, candidates[0]);
      } else {
        state.choice = { type: entry.type, chooser: entry.chooser, candidates };
        return state;
      }
      continue;
    }

    if (state.flip3) {
      const run3 = state.flip3;
      if (run3.left > 0 && isActive(state, run3.target)) {
        const card = draw(state, rand);
        if (card) {
          run3.left--;
          give(state, run3.target, card);
          continue;
        }
      }
      /* the three cards are out (or the person busted): now the saved-up action cards */
      const busted = state.table[run3.target].status === "busted";
      run3.deferred.forEach(card => state.queue.push({ type: card, card, chooser: run3.target, excludeChooser: busted }));
      state.flip3 = null;
      continue;
    }

    if (state.phase === "deal") {
      if (state.dealQueue.length > 0) {
        const person = state.dealQueue.shift();
        if (!isActive(state, person)) continue;
        const card = draw(state, rand);
        if (card) give(state, person, card);
        else state.dealQueue = [];
        continue;
      }
      state.phase = "play";
      state.turnPerson = orderFrom(state, state.dealer + 1).find(p => isActive(state, p)) || null;
      continue;
    }

    if (state.phase === "play") {
      if (activePlayers(state).length === 0) return endRound(state);
      if (state.advanceFrom) {
        state.turnPerson = nextActiveAfter(state, state.advanceFrom);
        state.advanceFrom = null;
      }
      if (!isActive(state, state.turnPerson)) state.turnPerson = nextActiveAfter(state, state.turnPerson);
      return state;
    }
    return state;
  }
  throw new Error("Flip 7: Runde hängt fest.");
}

/* ---------- round and game end ---------- */

function endRound(state) {
  const roundScores = perPlayer(state.players, p => scoreOf(state.table[p]));
  state.players.forEach(p => { state.scores[p] += roundScores[p]; });

  /* everything on the table goes to the discard pile – not back into the deck */
  state.players.forEach(p => {
    const seat = state.table[p];
    state.discard.push(...seat.numbers.map(v => `n${v}`), ...seat.mods, ...seat.actions);
    if (seat.bust) state.discard.push(seat.bust);
  });
  state.queue.forEach(entry => state.discard.push(entry.card));
  if (state.flip3) state.discard.push(...state.flip3.deferred);
  state.queue = [];
  state.flip3 = null;
  state.choice = null;
  state.turnPerson = null;
  state.advanceFrom = null;

  state.lastRound = {
    round: state.round,
    scores: roundScores,
    seats: clone(state.table),
    flip7By: state.flip7By || null
  };
  event(state, { type: "round-end", flip7By: state.flip7By || null });

  const best = Math.max(...state.players.map(p => state.scores[p]));
  const leaders = state.players.filter(p => state.scores[p] === best);
  if (best >= TARGET_SCORE && leaders.length === 1) {
    state.phase = "finished";
    state.wins[leaders[0]] = (state.wins[leaders[0]] || 0) + 1;
    state.result = { winner: leaders[0], winners: leaders, scores: { ...state.scores } };
  } else {
    state.phase = "round-over";
    /* a tie at the top over 200: one more round with everybody */
    state.tieBreak = best >= TARGET_SCORE;
  }
  return state;
}

function startRound(state, rand) {
  state.round += 1;
  state.table = perPlayer(state.players, freshSeat);
  state.dealQueue = orderFrom(state, state.dealer + 1);
  state.phase = "deal";
  state.queue = [];
  state.flip3 = null;
  state.choice = null;
  state.turnPerson = null;
  state.advanceFrom = null;
  state.flip7By = null;
  state.readyNext = [];
  return run(state, rand);
}

function recordMove(state, move) {
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.lastMove = { ...move, events: state.events, seq: state.moveSeq };
  delete state.events;
  return state;
}

function begin(state) {
  const next = clone(state);
  next.events = [];
  return next;
}

/* ---------- start ---------- */

function newGameState(players, wins, gameNo, dealer, moveSeq, rand) {
  const state = {
    players: players.slice(),
    gameNo,
    round: 0,
    dealer,
    deck: shuffle(createDeck(), rand),
    discard: [],
    scores: perPlayer(players, () => 0),
    wins: perPlayer(players, p => (wins && wins[p]) || 0),
    lastRound: null,
    result: null,
    tieBreak: false,
    moveSeq: moveSeq || 0,
    events: []
  };
  startRound(state, rand);
  return recordMove(state, { type: "deal", round: state.round });
}

function createInitialState(playersOrHost, guestPerson, rand = Math.random) {
  const players = Array.isArray(playersOrHost) ? playersOrHost.slice() : [playersOrHost, guestPerson].filter(Boolean);
  if (players.length < 2 || players.length > MAX_PLAYERS) throw new Error("Flip 7 braucht 2 bis 4 Personen.");
  if (typeof guestPerson === "function") rand = guestPerson;
  return newGameState(players, null, 1, Math.floor(rand() * players.length), 0, rand);
}

/* ---------- moves ---------- */

function assertTurn(state, person) {
  if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  if (state.phase !== "play") throw new Error("Gerade ist niemand am Zug.");
  if (state.choice) throw new Error(`${state.choice.chooser} wählt gerade, wen die Aktionskarte trifft.`);
  if (state.turnPerson !== person) throw new Error(`${state.turnPerson} ist am Zug.`);
}

/* "Noch eine": one more open card */
function hit(state, person, rand = Math.random) {
  assertTurn(state, person);
  const next = begin(state);
  const card = draw(next, rand);
  if (card) give(next, person, card);
  else next.table[person].status = "stayed";
  next.advanceFrom = person;
  run(next, rand);
  return recordMove(next, { type: "hit", person });
}

/* "Stopp": out of the round, the points count at the end */
function stay(state, person, rand = Math.random) {
  assertTurn(state, person);
  const next = begin(state);
  next.table[person].status = "stayed";
  event(next, { type: "stay", person });
  next.advanceFrom = person;
  run(next, rand);
  return recordMove(next, { type: "stay", person });
}

/* whoever received an action card picks who it hits */
function chooseTarget(state, person, target, rand = Math.random) {
  if (!state.choice) throw new Error("Gerade gibt es nichts zu wählen.");
  if (state.choice.chooser !== person) throw new Error(`${state.choice.chooser} wählt gerade.`);
  if (!state.choice.candidates.includes(target)) throw new Error("Diese Person kannst du nicht wählen.");
  const next = begin(state);
  const entry = next.queue.shift();
  next.choice = null;
  applyAction(next, entry, target);
  run(next, rand);
  return recordMove(next, { type: "target", person, target, card: entry.card });
}

function nextRound(state, person, rand = Math.random) {
  if (state.phase !== "round-over") throw new Error("Die Runde läuft noch.");
  const next = begin(state);
  next.dealer = (next.dealer + 1) % next.players.length;
  next.tieBreak = false;
  startRound(next, rand);
  return recordMove(next, { type: "deal", round: next.round });
}

function newGame(state, person, rand = Math.random) {
  if (state.phase !== "finished") throw new Error("Die Partie läuft noch.");
  return newGameState(state.players, state.wins, (state.gameNo || 1) + 1, (state.dealer + 1) % state.players.length, state.moveSeq, rand);
}

/* ---------- helpers for the page ---------- */

function cardLabel(card) {
  if (isNumber(card)) return String(numberOf(card));
  if (isModifier(card)) return MODIFIERS[card];
  return ACTIONS[card] || card;
}

/* every card is somewhere: deck, discard pile, on the table or waiting for a target
   (after a round the table only shows what was played – those cards are already discarded) */
function countCards(state) {
  const roundDone = state.phase === "round-over" || state.phase === "finished";
  const onTable = roundDone ? 0 : state.players.reduce((sum, p) => {
    const seat = state.table[p];
    return sum + seat.numbers.length + seat.mods.length + seat.actions.length + (seat.bust ? 1 : 0);
  }, 0);
  const pending = state.queue.length + (state.flip3 ? state.flip3.deferred.length : 0);
  return state.deck.length + state.discard.length + onTable + pending;
}

return {
  MAX_PLAYERS,
  TARGET_SCORE,
  FLIP7_BONUS,
  FLIP7_COUNT,
  MODIFIERS,
  ACTIONS,
  createDeck,
  isNumber,
  numberOf,
  isModifier,
  isAction,
  scoreOf,
  cardLabel,
  countCards,
  createInitialState,
  hit,
  stay,
  chooseTarget,
  nextRound,
  newGame
};

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Flip7Engine;
}
if (typeof window !== "undefined") {
  window.Flip7Engine = Flip7Engine;
}
