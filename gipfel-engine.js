/* Phasenjagd – our own phase rummy for 2–4 players. Pure rules, no DOM:
   loaded as <script> in the browser, testable in Node via require.

   108 cards: the numbers 1–12 in four colours (Rot, Blau, Grün, Gelb), each twice, plus
   8 Joker and 4 Aussetzen cards. Everybody gets 10 cards and climbs ten Etappen (Phasen on the screen),
   one after the other. On your turn you draw (deck or the open discard), may lay out your
   current Etappe in one go (all its groups at once), may then add single cards to any group
   on the table, and end by discarding one card. An Aussetzen on the discard makes the next
   player sit out one turn. The round ends as soon as somebody has no cards left: whoever laid
   out their Etappe climbs one up, everybody counts the cards still in hand as points (1–9 = 5,
   10–12 = 10, Joker 20, Aussetzen 15). Whoever finishes the tenth Etappe first is on the
   summit – if several make it in the same round, the fewest points win. */

const GipfelEngine = (() => {

const MAX_PLAYERS = 4;
const HAND_SIZE = 10;
const MAX_VALUE = 12;
const COLOURS = ["r", "v", "m", "g"];
const COLOUR_NAMES = { r: "Rot", v: "Blau", m: "Grün", g: "Gelb" };
const JOKERS = 8;
const STONES = 4;
const JOKER_POINTS = 20;
const STONE_POINTS = 15;
const LOW_POINTS = 5;   /* numbers 1 to 9 */
const HIGH_POINTS = 10; /* numbers 10 to 12 */

/* a group: set = same number, run = numbers in a row, color = one colour, crun = a row in one colour */
const g = (kind, size) => ({ kind, size });
const ETAPPEN = [
  { name: "Drei Paare", groups: [g("set", 2), g("set", 2), g("set", 2)] },
  { name: "Drilling + Dreierreihe", groups: [g("set", 3), g("run", 3)] },
  { name: "Zwei Dreierreihen", groups: [g("run", 3), g("run", 3)] },
  { name: "Fünferreihe", groups: [g("run", 5)] },
  { name: "Zwei Paare + Drilling", groups: [g("set", 2), g("set", 2), g("set", 3)] },
  { name: "Fünf in einer Farbe", groups: [g("color", 5)] },
  { name: "Vierling + Paar", groups: [g("set", 4), g("set", 2)] },
  { name: "Farbreihe aus 4 + Paar", groups: [g("crun", 4), g("set", 2)] },
  { name: "Vierling + Dreierreihe", groups: [g("set", 4), g("run", 3)] },
  { name: "Siebenerreihe", groups: [g("run", 7)] }
];

/* ---------- cards: "r7-1" (Rot 7, second copy), "J-3" (Joker), "S-0" (Aussetzen) ---------- */

function createDeck() {
  const deck = [];
  COLOURS.forEach(colour => {
    for (let value = 1; value <= MAX_VALUE; value++) {
      for (let copy = 0; copy < 2; copy++) deck.push(`${colour}${value}-${copy}`);
    }
  });
  for (let i = 0; i < JOKERS; i++) deck.push(`J-${i}`);
  for (let i = 0; i < STONES; i++) deck.push(`S-${i}`);
  return deck;
}

const isJoker = card => card.startsWith("J-");
const isStone = card => card.startsWith("S-");
const isNatural = card => !isJoker(card) && !isStone(card);
const colourOf = card => (isNatural(card) ? card[0] : null);
const valueOf = card => (isNatural(card) ? Number(card.slice(1, card.indexOf("-"))) : null);

function pointsOf(card) {
  if (isJoker(card)) return JOKER_POINTS;
  if (isStone(card)) return STONE_POINTS;
  return valueOf(card) >= 10 ? HIGH_POINTS : LOW_POINTS;
}

function cardLabel(card) {
  if (isJoker(card)) return "Joker";
  if (isStone(card)) return "Aussetzen";
  return `${COLOUR_NAMES[colourOf(card)]} ${valueOf(card)}`;
}

function groupLabel({ kind, size }) {
  if (kind === "set") return size === 2 ? "Paar" : size === 3 ? "Drilling" : size === 4 ? "Vierling" : `${size} Gleiche`;
  if (kind === "run") return `Reihe aus ${size}`;
  if (kind === "color") return `${size} einer Farbe`;
  return `Farbreihe aus ${size}`;
}

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

/* ---------- groups ---------- */

/* the cards as a valid group of this kind (at least `size` cards, at least one real number),
   ordered for rows – or null */
function makeGroup(kind, cards, size = 1) {
  if (cards.length < size || cards.some(isStone)) return null;
  const naturals = cards.filter(isNatural);
  if (naturals.length === 0) return null;
  const jokers = cards.filter(isJoker);

  if (kind === "set") {
    const value = valueOf(naturals[0]);
    if (!naturals.every(c => valueOf(c) === value)) return null;
    return { kind, cards: [...naturals, ...jokers], value };
  }
  if (kind === "color") {
    const colour = colourOf(naturals[0]);
    if (!naturals.every(c => colourOf(c) === colour)) return null;
    return { kind, cards: [...naturals, ...jokers], colour };
  }
  if (kind === "run" || kind === "crun") {
    const colour = colourOf(naturals[0]);
    if (kind === "crun" && !naturals.every(c => colourOf(c) === colour)) return null;
    const values = naturals.map(valueOf);
    if (new Set(values).size !== values.length) return null;
    const n = cards.length;
    if (n > MAX_VALUE) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    /* the row starts at its lowest number if it fits, otherwise the jokers go below */
    const start = lo + n - 1 <= MAX_VALUE ? lo : MAX_VALUE - n + 1;
    if (start < 1 || start > lo || start + n - 1 < hi) return null;
    const spare = jokers.slice();
    const ordered = [];
    for (let v = start; v < start + n; v++) {
      const natural = naturals.find(c => valueOf(c) === v);
      ordered.push(natural || spare.shift());
    }
    const group = { kind, cards: ordered, start };
    if (kind === "crun") group.colour = colour;
    return group;
  }
  return null;
}

/* the group with one more card, or null if it does not fit */
function extendGroup(group, card) {
  if (isStone(card)) return null;
  const joker = isJoker(card);
  if (group.kind === "set") {
    return joker || valueOf(card) === group.value ? { ...group, cards: [...group.cards, card] } : null;
  }
  if (group.kind === "color") {
    return joker || colourOf(card) === group.colour ? { ...group, cards: [...group.cards, card] } : null;
  }
  const end = group.start + group.cards.length - 1;
  if (!joker && group.kind === "crun" && colourOf(card) !== group.colour) return null;
  const v = joker ? null : valueOf(card);
  if ((joker && end < MAX_VALUE) || v === end + 1) return { ...group, cards: [...group.cards, card] };
  if ((joker && group.start > 1) || v === group.start - 1) return { ...group, cards: [card, ...group.cards], start: group.start - 1 };
  return null;
}

/* ---------- the Phasen of a game: the defaults above, or a list from phasen.json ---------- */

const MIN_HAND = 5;
const MAX_HAND = 12;
const MAX_GROUPS = 3;
const KINDS = { gleiche: "set", folge: "run", farbe: "color", farbfolge: "crun" };

/* the Phasen and hand size a game was started with (older games: the defaults) */
const etappenOf = state => (state && state.etappen) || ETAPPEN;
const handSizeOf = state => (state && state.handSize) || HAND_SIZE;

/* reads the content of phasen.json; throws a German message saying what is wrong */
function parseRules(json) {
  if (!json || typeof json !== "object") throw new Error("phasen.json ist kein gültiges Objekt.");
  const handSize = json.handKarten === undefined ? HAND_SIZE : json.handKarten;
  if (!Number.isInteger(handSize) || handSize < MIN_HAND || handSize > MAX_HAND) {
    throw new Error(`„handKarten“ muss eine ganze Zahl von ${MIN_HAND} bis ${MAX_HAND} sein.`);
  }
  if (!Array.isArray(json.phasen) || json.phasen.length === 0) throw new Error("„phasen“ muss eine Liste mit mindestens einer Phase sein.");
  const etappen = json.phasen.map((phase, i) => {
    const where = `Phase ${i + 1}`;
    if (!phase || !Array.isArray(phase.gruppen) || phase.gruppen.length === 0) throw new Error(`${where}: „gruppen“ fehlt.`);
    if (phase.gruppen.length > MAX_GROUPS) throw new Error(`${where}: höchstens ${MAX_GROUPS} Gruppen.`);
    const groups = phase.gruppen.map((gruppe, k) => {
      const kind = gruppe && KINDS[gruppe.art];
      if (!kind) throw new Error(`${where}, Gruppe ${k + 1}: „art“ muss ${Object.keys(KINDS).map(a => `„${a}“`).join(", ")} sein.`);
      const size = gruppe.anzahl;
      const most = kind === "run" || kind === "crun" ? MAX_VALUE : handSize;
      if (!Number.isInteger(size) || size < 1 || size > most) throw new Error(`${where}, Gruppe ${k + 1}: „anzahl“ muss von 1 bis ${most} gehen.`);
      return g(kind, size);
    });
    const total = groups.reduce((sum, group) => sum + group.size, 0);
    /* with the drawn card a hand holds handKarten + 1 cards */
    if (total > handSize + 1) throw new Error(`${where} braucht ${total} Karten, die Hand hat aber nur ${handSize} (+1 gezogene).`);
    const name = typeof phase.name === "string" && phase.name.trim() ? phase.name.trim().slice(0, 40) : groups.map(groupLabel).join(" + ");
    return { name, groups };
  });
  return { etappen, handSize };
}

/* the rules new games start with on this device (set by the page from phasen.json) */
let configuredRules = null;
function useRules(rules) {
  configuredRules = rules || null;
}

/* splits all the chosen cards into the groups of the Etappe (every card used), or null */
function partition(etappe, cards, list = ETAPPEN) {
  const needs = list[etappe].groups;
  const minimum = needs.reduce((sum, need) => sum + need.size, 0);
  if (cards.length < minimum) return null;
  const buckets = needs.map(() => []);
  function place(i) {
    if (i === cards.length) {
      const groups = needs.map((need, k) => makeGroup(need.kind, buckets[k], need.size));
      return groups.every(Boolean) ? groups : null;
    }
    for (let k = 0; k < needs.length; k++) {
      buckets[k].push(cards[i]);
      const found = place(i + 1);
      buckets[k].pop();
      if (found) return found;
    }
    return null;
  }
  return place(0);
}

function combinations(items, size, from = 0, chosen = [], out = []) {
  if (chosen.length === size) { out.push(chosen.slice()); return out; }
  for (let i = from; i <= items.length - (size - chosen.length); i++) {
    chosen.push(items[i]);
    combinations(items, size, i + 1, chosen, out);
    chosen.pop();
  }
  return out;
}

/* the fewest cards of this hand that lay out the Etappe (Joker are spent last), or null */
function findLaydown(etappe, hand, list = ETAPPEN) {
  const needs = list[etappe].groups;
  const usable = hand.filter(c => !isStone(c)).sort((a, b) => isJoker(a) - isJoker(b));
  function solve(k, left) {
    if (k === needs.length) return [];
    for (const combo of combinations(left, needs[k].size)) {
      if (!makeGroup(needs[k].kind, combo, needs[k].size)) continue;
      const rest = solve(k + 1, left.filter(c => !combo.includes(c)));
      if (rest) return [combo, ...rest];
    }
    return null;
  }
  const found = solve(0, usable);
  return found ? found.flat() : null;
}

/* the groups on the table this card could be added to */
function fittingGroups(state, card) {
  return state.groups.filter(group => extendGroup(group, card)).map(group => group.id);
}

/* ---------- moves ---------- */

function event(state, entry) {
  state.events.push(entry);
}

function begin(state) {
  const next = clone(state);
  next.events = [];
  return next;
}

function recordMove(state, move) {
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.lastMove = { ...move, events: state.events, seq: state.moveSeq };
  delete state.events;
  return state;
}

/* the deck is empty: everything below the open card is shuffled into a new deck */
/* when the deck runs empty this often in one round, the round ends without anybody going out –
   otherwise it could go on for ever when nobody can get rid of their last cards */
const MAX_RESHUFFLES = 2;

function refillDeck(state, rand) {
  if (state.deck.length > 0 || state.discard.length <= 1) return;
  state.reshuffles = (state.reshuffles || 0) + 1;
  const top = state.discard.pop();
  state.deck = shuffle(state.discard, rand);
  state.discard = [top];
  event(state, { type: "reshuffle", count: state.deck.length });
}

function startRound(state, rand) {
  state.round += 1;
  state.phase = "play";
  state.step = "draw";
  state.deck = shuffle(createDeck(), rand);
  state.hands = perPlayer(state.players, () => []);
  state.laid = perPlayer(state.players, () => false);
  state.skip = perPlayer(state.players, () => false);
  state.groups = [];
  state.nextGroupId = 1;
  state.openStreak = 0;
  state.reshuffles = 0;
  state.readyNext = [];
  const n = state.players.length;
  for (let i = 0; i < handSizeOf(state); i++) {
    for (let k = 1; k <= n; k++) {
      const person = state.players[(state.dealer + k) % n];
      const card = state.deck.pop();
      state.hands[person].push(card);
      event(state, { type: "deal", person, card });
    }
  }
  state.discard = [state.deck.pop()];
  event(state, { type: "flip", card: state.discard[0] });
  state.turnPerson = state.players[(state.dealer + 1) % n];
}

function newGameState(players, wins, gameNo, dealer, moveSeq, rand, rules) {
  const chosen = rules || configuredRules;
  const state = {
    players: players.slice(),
    etappen: chosen ? chosen.etappen : ETAPPEN,
    handSize: chosen ? chosen.handSize : HAND_SIZE,
    gameNo,
    round: 0,
    dealer,
    etappe: perPlayer(players, () => 0),
    scores: perPlayer(players, () => 0),
    wins: perPlayer(players, p => (wins && wins[p]) || 0),
    lastRound: null,
    result: null,
    moveSeq: moveSeq || 0,
    events: []
  };
  startRound(state, rand);
  return recordMove(state, { type: "deal", round: state.round });
}

/* createInitialState(players, rand?, rules?) – rules from parseRules(), otherwise the device's or the defaults */
function createInitialState(playersOrHost, guestPerson, rand = Math.random, rules = null) {
  if (typeof guestPerson === "function") {
    rules = rand && typeof rand === "object" ? rand : rules;
    rand = guestPerson;
    guestPerson = null;
  }
  if (typeof rand !== "function") rand = Math.random;
  const players = Array.isArray(playersOrHost) ? playersOrHost.slice() : [playersOrHost, guestPerson].filter(Boolean);
  if (players.length < 2 || players.length > MAX_PLAYERS) throw new Error("Das Spiel braucht 2 bis 4 Personen.");
  return newGameState(players, null, 1, Math.floor(rand() * players.length), 0, rand, rules);
}

function assertTurn(state, person, step) {
  if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  if (state.phase !== "play") throw new Error("Die Runde ist vorbei.");
  if (state.turnPerson !== person) throw new Error(`${state.turnPerson} ist am Zug.`);
  if (step === "draw" && state.step !== "draw") throw new Error("Du hast schon eine Karte gezogen.");
  if (step === "act" && state.step !== "act") throw new Error("Zieh zuerst eine Karte.");
}

function takeFromHand(state, person, card) {
  const hand = state.hands[person];
  const index = hand.indexOf(card);
  if (index === -1) throw new Error("Diese Karte hast du nicht auf der Hand.");
  hand.splice(index, 1);
}

function drawDeck(state, person, rand = Math.random) {
  assertTurn(state, person, "draw");
  const next = begin(state);
  if (next.deck.length === 0 && (next.reshuffles || 0) >= MAX_RESHUFFLES) {
    event(next, { type: "deck-end" });
    endRound(next, null);
    return recordMove(next, { type: "deck-end", person });
  }
  refillDeck(next, rand);
  if (next.deck.length === 0) throw new Error("Es gibt keine Karte mehr zum Ziehen.");
  const card = next.deck.pop();
  next.hands[person].push(card);
  next.step = "act";
  next.openStreak = 0;
  event(next, { type: "draw", person, from: "deck", card });
  return recordMove(next, { type: "draw", person });
}

function drawDiscard(state, person) {
  assertTurn(state, person, "draw");
  const top = state.discard[state.discard.length - 1];
  if (!top) throw new Error("Der Ablagestapel ist leer.");
  if (isStone(top)) throw new Error("Eine Aussetzen-Karte kann man nicht aufnehmen.");
  const next = begin(state);
  next.discard.pop();
  next.hands[person].push(top);
  next.step = "act";
  /* how many open cards were taken in a row (the computer players use it not to trade cards forever) */
  next.openStreak = (next.openStreak || 0) + 1;
  event(next, { type: "draw", person, from: "discard", card: top });
  return recordMove(next, { type: "draw", person });
}

/* lay out the current Etappe: the chosen cards must make up all its groups at once */
function layDown(state, person, cards) {
  assertTurn(state, person, "act");
  if (state.laid[person]) throw new Error("Deine Phase liegt schon aus.");
  const chosen = Array.from(new Set(cards || []));
  chosen.forEach(card => { if (!state.hands[person].includes(card)) throw new Error("Diese Karte hast du nicht auf der Hand."); });
  const etappe = state.etappe[person];
  const groups = partition(etappe, chosen, etappenOf(state));
  if (!groups) throw new Error(`Damit klappt „${etappenOf(state)[etappe].name}“ noch nicht.`);
  const next = begin(state);
  chosen.forEach(card => takeFromHand(next, person, card));
  const ids = groups.map(group => {
    const id = next.nextGroupId++;
    next.groups.push({ id, owner: person, ...group });
    return id;
  });
  next.laid[person] = true;
  event(next, { type: "lay", person, cards: chosen, groups: ids, etappe });
  if (next.hands[person].length === 0) endRound(next, person);
  return recordMove(next, { type: "lay", person });
}

/* add one card to any group on the table – only once your own Etappe is out */
function addToGroup(state, person, card, groupId) {
  assertTurn(state, person, "act");
  if (!state.laid[person]) throw new Error("Anlegen geht erst, wenn deine Phase ausliegt.");
  if (!state.hands[person].includes(card)) throw new Error("Diese Karte hast du nicht auf der Hand.");
  const index = state.groups.findIndex(group => group.id === groupId);
  if (index === -1) throw new Error("Diese Gruppe gibt es nicht.");
  const grown = extendGroup(state.groups[index], card);
  if (!grown) throw new Error(`${cardLabel(card)} passt da nicht.`);
  const next = begin(state);
  takeFromHand(next, person, card);
  next.groups[index] = grown;
  event(next, { type: "add", person, card, group: groupId, owner: grown.owner });
  if (next.hands[person].length === 0) endRound(next, person);
  return recordMove(next, { type: "add", person });
}

/* the next one at the table, sitting out whoever was hit by an Aussetzen card */
function advanceTurn(state, from) {
  const n = state.players.length;
  let index = state.players.indexOf(from);
  for (let i = 0; i < n * 2; i++) {
    index = (index + 1) % n;
    const person = state.players[index];
    if (state.skip[person]) {
      state.skip[person] = false;
      event(state, { type: "skip", person });
      continue;
    }
    state.turnPerson = person;
    state.step = "draw";
    return;
  }
}

function discard(state, person, card) {
  assertTurn(state, person, "act");
  if (!state.hands[person].includes(card)) throw new Error("Diese Karte hast du nicht auf der Hand.");
  const next = begin(state);
  takeFromHand(next, person, card);
  next.discard.push(card);
  event(next, { type: "discard", person, card });
  if (isStone(card)) {
    const target = next.players[(next.players.indexOf(person) + 1) % next.players.length];
    next.skip[target] = true;
    event(next, { type: "stone", person, target });
  }
  if (next.hands[person].length === 0) endRound(next, person);
  else advanceTurn(next, person);
  return recordMove(next, { type: "discard", person });
}

function endRound(state, outPerson) {
  const points = perPlayer(state.players, p => state.hands[p].reduce((sum, c) => sum + pointsOf(c), 0));
  const climbed = perPlayer(state.players, p => state.laid[p]);
  state.players.forEach(p => {
    state.scores[p] += points[p];
    if (climbed[p]) state.etappe[p] += 1;
  });
  state.lastRound = { round: state.round, out: outPerson, points, climbed };
  state.turnPerson = null;
  state.step = null;
  if (outPerson) event(state, { type: "out", person: outPerson });

  const summit = state.players.filter(p => state.etappe[p] >= etappenOf(state).length);
  if (summit.length === 0) {
    state.phase = "round-over";
    return;
  }
  const best = Math.min(...summit.map(p => state.scores[p]));
  const winners = summit.filter(p => state.scores[p] === best);
  winners.forEach(p => { state.wins[p] = (state.wins[p] || 0) + 1; });
  state.result = { winners, winner: winners.length === 1 ? winners[0] : null };
  state.phase = "finished";
}

function nextRound(state, person, rand = Math.random) {
  if (state.phase !== "round-over") throw new Error("Die Runde läuft noch.");
  const next = begin(state);
  next.dealer = (next.dealer + 1) % next.players.length;
  startRound(next, rand);
  return recordMove(next, { type: "deal", round: next.round });
}

function newGame(state, person, rand = Math.random) {
  if (state.phase !== "finished") throw new Error("Die Partie läuft noch.");
  /* a new game takes the Phasen as they are now in phasen.json – otherwise those of the last game */
  const rules = configuredRules || { etappen: etappenOf(state), handSize: handSizeOf(state) };
  return newGameState(state.players, state.wins, (state.gameNo || 1) + 1, (state.dealer + 1) % state.players.length, state.moveSeq, rand, rules);
}

/* every card is somewhere: deck, discard, a hand or a group on the table */
function countCards(state) {
  const hands = state.players.reduce((sum, p) => sum + state.hands[p].length, 0);
  const groups = state.groups.reduce((sum, group) => sum + group.cards.length, 0);
  return state.deck.length + state.discard.length + hands + groups;
}

return {
  MAX_PLAYERS,
  HAND_SIZE,
  MAX_VALUE,
  COLOURS,
  COLOUR_NAMES,
  ETAPPEN,
  etappenOf,
  handSizeOf,
  parseRules,
  useRules,
  JOKER_POINTS,
  STONE_POINTS,
  LOW_POINTS,
  HIGH_POINTS,
  createDeck,
  isJoker,
  isStone,
  isNatural,
  colourOf,
  valueOf,
  pointsOf,
  cardLabel,
  groupLabel,
  makeGroup,
  extendGroup,
  partition,
  findLaydown,
  fittingGroups,
  countCards,
  createInitialState,
  drawDeck,
  drawDiscard,
  layDown,
  addToGroup,
  discard,
  nextRound,
  newGame
};

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = GipfelEngine;
}
if (typeof window !== "undefined") {
  window.GipfelEngine = GipfelEngine;
}
