/* 6 nimmt! – reine Spiellogik für 2–4 Personen (Grundspiel, ein Durchgang = eine Partie).
   Ohne DOM-Abhängigkeit: im Browser als <script> geladen, in Node per require testbar. */

const NimmtEngine = (() => {

const CARD_MAX = 104;
const HAND_SIZE = 10;
const MAX_PLAYERS = 4;

/* two at the table play with three rows (tighter), three or four with the four of the box */
function rowCountFor(playerCount) {
  return playerCount === 2 ? 3 : 4;
}
const ROW_LIMIT = 5;

function bullsFor(card) {
  if (card === 55) return 7;
  if (card % 11 === 0) return 5;
  if (card % 10 === 0) return 3;
  if (card % 5 === 0) return 2;
  return 1;
}

function sumBulls(cards) {
  return cards.reduce((sum, card) => sum + bullsFor(card), 0);
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

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function perPlayer(players, valueFn) {
  return players.reduce((acc, p) => { acc[p] = valueFn(p); return acc; }, {});
}

/* Every visible card movement gets a sequence number so each device can animate it exactly once. */
function recordMove(state, move) {
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.lastMove = { ...move, seq: state.moveSeq };
}

function deal(players, wins, gameNo, previousMoveSeq) {
  const deck = shuffle(Array.from({ length: CARD_MAX }, (_, i) => i + 1));
  const hands = perPlayer(players, () => deck.splice(0, HAND_SIZE).sort((a, b) => a - b));
  const rows = deck.splice(0, rowCountFor(players.length)).sort((a, b) => a - b).map(card => [card]);
  const moveSeq = (previousMoveSeq || 0) + 1;

  return {
    moveSeq,
    lastMove: { type: "deal", seq: moveSeq },
    players,
    hands,
    rows,
    penalties: perPlayer(players, () => []),
    chosen: perPlayer(players, () => null),
    revealed: null,
    currentTrick: null,
    lastTrick: null,
    phase: "choose",
    pickPerson: null,
    trick: 1,
    result: null,
    wins: wins || perPlayer(players, () => 0),
    gameNo: gameNo || 1
  };
}

/* createInitialState(["Isi", "Benji", "Lena"]) – or the old two-player form (host, guest) */
function createInitialState(playersOrHost, guestPerson) {
  const players = Array.isArray(playersOrHost) ? playersOrHost.slice() : [playersOrHost, guestPerson];
  if (players.length < 2 || players.length > MAX_PLAYERS) throw new Error("6 nimmt! braucht 2 bis 4 Personen.");
  return deal(players, null, 1, 0);
}

/* lowest wins; several share a win, but if everybody has the same nobody wins */
function winnersOf(players, valueOf, better) {
  const best = players.reduce((acc, p) => (acc === null || better(valueOf(p), acc) ? valueOf(p) : acc), null);
  const winners = players.filter(p => valueOf(p) === best);
  return winners.length === players.length ? [] : winners;
}

/* Rules 1 + 2: ascending order, smallest difference. Returns -1 if the card is lower than every row end. */
function rowFor(rows, card) {
  let best = -1;
  let bestEnd = -1;
  rows.forEach((row, index) => {
    const end = row[row.length - 1];
    if (end < card && end > bestEnd) {
      best = index;
      bestEnd = end;
    }
  });
  return best;
}

/* Rule 3 (sixth card takes the row) and rule 4 (a too-low card takes a chosen row). */
function placeCard(state, play, rowIndex, tooLow) {
  const row = state.rows[rowIndex];
  let took = null;
  let reason = null;

  if (tooLow) {
    took = row;
    reason = "low";
  } else if (row.length >= ROW_LIMIT) {
    took = row;
    reason = "full";
  }

  if (took) {
    state.rows[rowIndex] = [play.card];
    state.penalties[play.person].push(...took);
  } else {
    row.push(play.card);
  }

  return {
    person: play.person,
    card: play.card,
    row: rowIndex,
    col: state.rows[rowIndex].length - 1,
    took,
    reason
  };
}

function finishGame(state) {
  state.phase = "finished";
  const bulls = perPlayer(state.players, p => sumBulls(state.penalties[p]));
  const winners = winnersOf(state.players, p => bulls[p], (a, b) => a < b);
  winners.forEach(p => { state.wins[p] = (state.wins[p] || 0) + 1; });
  state.result = { bulls, winner: winners.length === 1 ? winners[0] : null, winners };
}

/* Places revealed cards lowest first until done or until someone has to pick a row. */
function resolvePlays(state, step) {
  while (state.revealed && state.revealed.length > 0) {
    const play = state.revealed[0];
    const rowIndex = rowFor(state.rows, play.card);
    if (rowIndex === -1) {
      state.phase = "pick-row";
      state.pickPerson = play.person;
      return;
    }
    const placement = placeCard(state, play, rowIndex, false);
    step.push(placement);
    state.currentTrick.placements.push(placement);
    state.revealed.shift();
  }

  state.revealed = null;
  state.pickPerson = null;
  state.lastTrick = state.currentTrick;
  state.currentTrick = null;

  if (state.players.every(p => state.hands[p].length === 0)) {
    finishGame(state);
  } else {
    state.phase = "choose";
    state.trick += 1;
  }
}

/* ---------- player actions (each returns a NEW state) ---------- */

/* Everybody chooses secretly at the same time; tapping your chosen card again takes it back.
   As soon as all have chosen, the cards are revealed and placed. */
function chooseCard(state, person, card) {
  if (state.phase !== "choose") throw new Error("Gerade kann keine Karte gewählt werden.");
  if (!state.players.includes(person)) throw new Error("Unbekannte Person.");
  if (!state.hands[person].includes(card)) throw new Error("Diese Karte hast du nicht auf der Hand.");

  const next = cloneState(state);
  next.chosen[person] = next.chosen[person] === card ? null : card;

  if (!next.players.every(p => next.chosen[p] !== null)) {
    recordMove(next, { type: "choose", person, card, chosen: next.chosen[person] !== null });
    return next;
  }

  const plays = next.players
    .map(p => ({ person: p, card: next.chosen[p] }))
    .sort((x, y) => x.card - y.card);

  next.players.forEach(p => {
    next.hands[p] = next.hands[p].filter(c => c !== next.chosen[p]);
    next.chosen[p] = null;
  });
  next.revealed = plays.map(play => ({ ...play }));
  next.currentTrick = { trick: next.trick, plays, placements: [] };

  const step = [];
  resolvePlays(next, step);
  recordMove(next, { type: "reveal", plays, placements: step });
  return next;
}

function pickRow(state, person, rowIndex) {
  if (state.phase !== "pick-row") throw new Error("Gerade muss niemand eine Reihe nehmen.");
  if (state.pickPerson !== person) throw new Error("Nicht du musst gerade eine Reihe nehmen.");
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= state.rows.length) throw new Error("Ungültige Reihe.");

  const next = cloneState(state);
  const play = next.revealed.shift();
  const placement = placeCard(next, play, rowIndex, true);
  next.currentTrick.placements.push(placement);
  next.phase = "choose";
  next.pickPerson = null;

  const step = [placement];
  resolvePlays(next, step);
  recordMove(next, { type: "resolve", placements: step });
  return next;
}

function rematch(state) {
  if (state.phase !== "finished") throw new Error("Die Partie läuft noch.");
  return deal(state.players, state.wins, state.gameNo + 1, state.moveSeq);
}

return {
  CARD_MAX,
  HAND_SIZE,
  ROW_LIMIT,
  rowCountFor,
  MAX_PLAYERS,
  bullsFor,
  sumBulls,
  rowFor,
  createInitialState,
  chooseCard,
  pickRow,
  rematch,
  otherPerson
};

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = NimmtEngine;
}
if (typeof window !== "undefined") {
  window.NimmtEngine = NimmtEngine;
}
