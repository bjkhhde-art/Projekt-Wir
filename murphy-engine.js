/* Murphys Gesetz – a card-trading game for 2–4 players. Pure rules, no DOM:
   loaded as <script> in the browser, testable in Node via require.

   72 number cards: 1–11 in Rot, Gelb and Grün (1–3 once, 4–6 twice, 7–11 three times per colour),
   plus the action cards and the Murphy cards from murphy-karten.json.
   Everybody holds a secret Murphy card – a task the number cards in hand must fulfil EXACTLY.
   On your turn you trade one for two or two for one: either at the table (the hidden deck or the
   two open piles) or with the Basar, a row of open cards that never holds more than seven.
   Red action cards act at once when drawn and end the turn; green ones are collected and can be
   played instead of a trade. Whoever fulfils their Murphy card keeps it, everybody else hands
   theirs back, all get a new one – the cards in hand stay. Three kept Murphy cards win. */

const MurphyEngine = (() => {

const MAX_PLAYERS = 4;
const MAX_VALUE = 11;
const COLOURS = ["r", "y", "g"];
const COLOUR_NAMES = { r: "Rot", y: "Gelb", g: "Grün" };
const COLOUR_KEYS = { rot: "r", gelb: "y", gruen: "g", "grün": "g" };
const BASAR_SIZE = 7;
const FIRST_HAND = 8;
const WIN_CARDS = 3;
const PILES = 2;
/* 1–3 once, 4–6 twice, 7–11 three times in each colour */
const copiesOf = value => (value <= 3 ? 1 : value <= 6 ? 2 : 3);

/* ---------- cards: "r7-2" (Rot 7, third copy), "A.klauen.1" (second copy of the action card "klauen") ---------- */

function numberCards() {
  const cards = [];
  COLOURS.forEach(colour => {
    for (let value = 1; value <= MAX_VALUE; value++) {
      for (let copy = 0; copy < copiesOf(value); copy++) cards.push(`${colour}${value}-${copy}`);
    }
  });
  return cards;
}

function actionCards(rules) {
  const cards = [];
  rules.actions.forEach(action => {
    for (let copy = 0; copy < action.copies; copy++) cards.push(`A.${action.id}.${copy}`);
  });
  return cards;
}

const isAction = card => typeof card === "string" && card.startsWith("A.");
const isNumber = card => typeof card === "string" && !isAction(card) && /^[ryg]\d+-\d+$/.test(card);
const colourOf = card => (isNumber(card) ? card[0] : null);
const valueOf = card => (isNumber(card) ? Number(card.slice(1, card.indexOf("-"))) : null);
const actionIdOf = card => (isAction(card) ? card.split(".")[1] : null);

function actionOf(state, card) {
  const id = actionIdOf(card);
  return id ? state.rules.actions.find(a => a.id === id) || null : null;
}

const isRed = (state, card) => Boolean(actionOf(state, card) && actionOf(state, card).colour === "rot");
const isGreen = (state, card) => Boolean(actionOf(state, card) && actionOf(state, card).colour === "gruen");

function murphyOf(state, id) {
  return id ? state.rules.murphy.find(m => m.id === id) || null : null;
}

function cardLabel(card, state) {
  if (isNumber(card)) return `${COLOUR_NAMES[colourOf(card)]} ${valueOf(card)}`;
  const action = state ? actionOf(state, card) : null;
  return action ? action.title : "Aktionskarte";
}

function shuffle(cards, rand = Math.random) {
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const clone = state => JSON.parse(JSON.stringify(state));
const perPlayer = (players, fn) => players.reduce((acc, p) => { acc[p] = fn(p); return acc; }, {});

/* ---------- Murphy tasks: what the number cards in hand must fulfil ---------- */

const RANGE_KEYS = ["anzahl", "summe", "farben", "jedeFarbe", "kleinste", "groesste"];
const BOOL_KEYS = ["verschieden", "gleicheZahl", "reihe", "gerade", "ungerade"];
const LIST_KEYS = ["werte", "gruppen", "farbGruppen"];
const CHECK_KEYS = [...RANGE_KEYS, ...BOOL_KEYS, ...LIST_KEYS, "farbe", "oder"];

const rangeGap = (x, spec) => (typeof spec === "number" ? Math.abs(x - spec)
  : Math.max(0, (spec.min === undefined ? x : spec.min) - x, x - (spec.max === undefined ? x : spec.max)));

function tally(items) {
  const counts = new Map();
  items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
  return counts;
}

/* sorted, highest first, padded with zeros to the same length */
function shapeGap(counts, wanted) {
  const have = [...counts].sort((a, b) => b - a);
  const want = wanted.slice().sort((a, b) => b - a);
  const n = Math.max(have.length, want.length);
  let gap = 0;
  for (let i = 0; i < n; i++) gap += Math.abs((have[i] || 0) - (want[i] || 0));
  return gap;
}

/* how far the number cards are from the task: 0 = fulfilled. Also guides the computer players. */
function taskDistance(check, cards) {
  if (!check) return null;
  const nums = cards.filter(isNumber);
  if (nums.length === 0) return 100;
  const values = nums.map(valueOf);
  const colours = nums.map(colourOf);
  const valueCounts = tally(values);
  const colourCounts = tally(colours);
  let gap = 0;

  if (check.anzahl !== undefined) gap += 3 * rangeGap(nums.length, check.anzahl);
  if (check.summe !== undefined) gap += rangeGap(values.reduce((a, b) => a + b, 0), check.summe) / 2;
  if (check.farben !== undefined) {
    const distinct = colourCounts.size;
    const spec = check.farben;
    const max = typeof spec === "number" ? spec : spec.max;
    if (max !== undefined && distinct > max) {
      const kept = [...colourCounts.values()].sort((a, b) => b - a).slice(0, max).reduce((a, b) => a + b, 0);
      gap += 2 * (nums.length - kept);
    } else {
      gap += 2 * rangeGap(distinct, spec);
    }
  }
  if (check.farbe !== undefined) gap += 2 * colours.filter(c => c !== COLOUR_KEYS[check.farbe]).length;
  if (check.jedeFarbe !== undefined) COLOURS.forEach(c => { gap += 2 * rangeGap(colourCounts.get(c) || 0, check.jedeFarbe); });
  if (check.werte !== undefined) gap += 2 * values.filter(v => !check.werte.includes(v)).length;
  if (check.verschieden) gap += 2 * (nums.length - valueCounts.size);
  if (check.gleicheZahl) gap += 2 * (nums.length - Math.max(...valueCounts.values()));
  if (check.reihe) {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    gap += 2 * (nums.length - valueCounts.size) + (hi - lo + 1 - valueCounts.size);
  }
  if (check.gerade) gap += 2 * values.filter(v => v % 2 !== 0).length;
  if (check.ungerade) gap += 2 * values.filter(v => v % 2 === 0).length;
  if (check.gruppen !== undefined) gap += 2 * shapeGap(valueCounts.values(), check.gruppen);
  if (check.farbGruppen !== undefined) gap += 2 * shapeGap(colourCounts.values(), check.farbGruppen);
  if (check.kleinste !== undefined) gap += rangeGap(Math.min(...values), check.kleinste);
  if (check.groesste !== undefined) gap += rangeGap(Math.max(...values), check.groesste);
  if (check.oder !== undefined) gap += Math.min(...check.oder.map(alt => taskDistance(alt, nums)));
  return gap;
}

/* exactly fulfilled? (null: the card has no condition – the player says so herself) */
function fulfils(check, cards) {
  if (!check) return null;
  return taskDistance(check, cards) === 0;
}

/* ---------- murphy-karten.json ---------- */

const EFFECTS = {
  ziehen: { amount: 2 },
  alleZiehen: { amount: 1 },
  aussetzen: {},
  richtung: {},
  weitergeben: { amount: 1 },
  handtausch: { target: true },
  murphyNeu: {},
  murphyWeiter: {},
  klauen: { amount: 1, target: true },
  abgeben: { amount: 2, target: true, choose: true },
  ablegen: { amount: 2, choose: true },
  doppelzug: { greenOnly: true }
};
const ID_PATTERN = /^[a-z0-9-]{1,30}$/;
const MIN_MURPHY = 4;

function parseRange(value, where) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out = {};
    ["min", "max"].forEach(k => {
      if (value[k] === undefined) return;
      if (!Number.isInteger(value[k]) || value[k] < 0) throw new Error(`${where}: „${k}“ muss eine ganze Zahl sein.`);
      out[k] = value[k];
    });
    if (out.min === undefined && out.max === undefined) throw new Error(`${where}: „min“ oder „max“ fehlt.`);
    if (out.min !== undefined && out.max !== undefined && out.min > out.max) throw new Error(`${where}: „min“ ist größer als „max“.`);
    return out;
  }
  throw new Error(`${where}: eine Zahl oder {"min": …, "max": …} erwartet.`);
}

function parseCheck(check, where) {
  if (!check || typeof check !== "object" || Array.isArray(check)) throw new Error(`${where}: „bedingung“ muss ein Objekt sein.`);
  const out = {};
  Object.keys(check).forEach(key => {
    const value = check[key];
    const at = `${where}, ${key}`;
    if (!CHECK_KEYS.includes(key)) throw new Error(`${where}: „${key}“ kenne ich nicht. Möglich: ${CHECK_KEYS.join(", ")}.`);
    if (RANGE_KEYS.includes(key)) out[key] = parseRange(value, at);
    else if (BOOL_KEYS.includes(key)) {
      if (typeof value !== "boolean") throw new Error(`${at}: true oder false erwartet.`);
      if (value) out[key] = true;
    } else if (key === "farbe") {
      if (!COLOUR_KEYS[value]) throw new Error(`${at}: „rot“, „gelb“ oder „gruen“ erwartet.`);
      out.farbe = value === "grün" ? "gruen" : value;
    } else if (key === "werte") {
      if (!Array.isArray(value) || value.length === 0 || !value.every(v => Number.isInteger(v) && v >= 1 && v <= MAX_VALUE)) {
        throw new Error(`${at}: eine Liste von Zahlen 1–${MAX_VALUE} erwartet.`);
      }
      out.werte = value.slice();
    } else if (key === "gruppen" || key === "farbGruppen") {
      if (!Array.isArray(value) || value.length === 0 || !value.every(v => Number.isInteger(v) && v >= 1)) throw new Error(`${at}: eine Liste von Anzahlen erwartet, z. B. [3, 2].`);
      if (key === "farbGruppen" && value.length > COLOURS.length) throw new Error(`${at}: höchstens ${COLOURS.length} Farben.`);
      out[key] = value.slice();
    } else if (key === "oder") {
      if (!Array.isArray(value) || value.length < 2) throw new Error(`${at}: eine Liste mit mindestens zwei Möglichkeiten erwartet.`);
      out.oder = value.map((alt, i) => parseCheck(alt, `${at} ${i + 1}`));
    }
  });
  if (Object.keys(out).length === 0) throw new Error(`${where}: die Bedingung ist leer.`);
  return out;
}

function parseId(raw, where, seen) {
  if (typeof raw !== "string" || !ID_PATTERN.test(raw)) throw new Error(`${where}: „id“ darf nur a–z, 0–9 und - enthalten.`);
  if (seen.has(raw)) throw new Error(`${where}: die id „${raw}“ gibt es zweimal.`);
  seen.add(raw);
  return raw;
}

const cleanText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const cleanImage = value => (typeof value === "string" && /^[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(value) ? value : null);

/* reads murphy-karten.json; throws a German message saying what is wrong */
function parseCards(json) {
  if (!json || typeof json !== "object") throw new Error("murphy-karten.json ist kein gültiges Objekt.");
  const winCards = json.siegKarten === undefined ? WIN_CARDS : json.siegKarten;
  if (!Number.isInteger(winCards) || winCards < 1 || winCards > 10) throw new Error("„siegKarten“ muss eine ganze Zahl von 1 bis 10 sein.");
  if (!Array.isArray(json.murphy)) throw new Error("„murphy“ muss eine Liste sein.");
  if (!Array.isArray(json.aktionen)) throw new Error("„aktionen“ muss eine Liste sein.");

  const seen = new Set();
  const murphy = json.murphy.filter(m => m && m.aktiv !== false).map((m, i) => {
    const where = `Murphy-Karte ${m.id || i + 1}`;
    const id = parseId(m.id, where, seen);
    const text = cleanText(m.text, 200);
    if (!text) throw new Error(`${where}: „text“ fehlt.`);
    const card = { id, text, check: m.bedingung === undefined ? null : parseCheck(m.bedingung, where) };
    const image = cleanImage(m.bild);
    if (image) card.image = image;
    return card;
  });
  if (murphy.length < MIN_MURPHY) throw new Error(`Es braucht mindestens ${MIN_MURPHY} aktive Murphy-Karten.`);

  const actionIds = new Set();
  const actions = json.aktionen.filter(a => a && a.aktiv !== false).map((a, i) => {
    const where = `Aktionskarte ${a.id || i + 1}`;
    const id = parseId(a.id, where, actionIds);
    const effect = EFFECTS[a.wirkung];
    if (!effect) throw new Error(`${where}: „wirkung“ muss eins davon sein: ${Object.keys(EFFECTS).join(", ")}.`);
    const colour = a.farbe === "grün" ? "gruen" : a.farbe;
    if (colour !== "rot" && colour !== "gruen") throw new Error(`${where}: „farbe“ muss „rot“ oder „gruen“ sein.`);
    if (effect.greenOnly && colour !== "gruen") throw new Error(`${where}: „${a.wirkung}“ geht nur als grüne Karte.`);
    const copies = a.stueck === undefined ? 1 : a.stueck;
    if (!Number.isInteger(copies) || copies < 1 || copies > 10) throw new Error(`${where}: „stueck“ muss von 1 bis 10 gehen.`);
    const card = {
      id,
      title: cleanText(a.titel, 30) || id,
      text: cleanText(a.text, 200),
      colour,
      effect: a.wirkung,
      copies
    };
    if (effect.amount !== undefined) {
      const amount = a.anzahl === undefined ? effect.amount : a.anzahl;
      if (!Number.isInteger(amount) || amount < 1 || amount > 5) throw new Error(`${where}: „anzahl“ muss von 1 bis 5 gehen.`);
      card.amount = amount;
    }
    const image = cleanImage(a.bild);
    if (image) card.image = image;
    return card;
  });

  return { murphy, actions, winCards, numberImages: json.zahlenBilder === true };
}

/* the cards new games start with on this device (set by the page from murphy-karten.json) */
let configuredRules = null;
function useRules(rules) {
  configuredRules = rules || null;
}

/* ---------- the table ---------- */

const numbersIn = cards => cards.filter(isNumber);
const numberCount = (state, person) => numbersIn(state.hands[person]).length;
const nextOf = (state, person, step = 1) => {
  const n = state.players.length;
  return state.players[(((state.players.indexOf(person) + step * state.direction) % n) + n) % n];
};

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

/* the deck is empty: played action cards and the open piles (all but their top cards) become the new deck */
function refillDeck(state, rand) {
  if (state.deck.length > 0) return;
  const back = [...state.actionPile];
  state.actionPile = [];
  state.piles = state.piles.map(pile => {
    back.push(...pile.slice(0, -1));
    return pile.slice(-1);
  });
  if (back.length === 0) return;
  state.deck = shuffle(back, rand);
  event(state, { type: "reshuffle", count: state.deck.length });
}

function drawCard(state, rand) {
  refillDeck(state, rand);
  return state.deck.length ? state.deck.pop() : null;
}

/* a number card for the table (Basar, open piles); action cards turning up are put aside */
function drawNumber(state, rand) {
  for (let guard = 0; guard < 200; guard++) {
    const card = drawCard(state, rand);
    if (!card) return null;
    if (isNumber(card)) return card;
    state.actionPile.push(card);
  }
  return null;
}

function dealMurphy(state, rand) {
  if (state.murphyDeck.length === 0) {
    state.murphyDeck = shuffle(state.murphyBack, rand);
    state.murphyBack = [];
  }
  return state.murphyDeck.pop() || null;
}

/* cards drawn outside a trade (effects, refills): red ones are put aside without acting – no chains */
function drawInto(state, person, count, rand, why) {
  const got = [];
  for (let tries = 0; got.length < count && tries < 200; tries++) {
    const card = drawCard(state, rand);
    if (!card) break;
    if (isRed(state, card)) {
      state.actionPile.push(card);
      event(state, { type: "aside", person, card });
      continue;
    }
    state.hands[person].push(card);
    got.push(card);
  }
  if (got.length) event(state, { type: "draw", person, cards: got, why });
  return got;
}

/* nobody may be left without a number card: draw until there is one again */
function refillNumbers(state, rand) {
  state.players.forEach(person => {
    let guard = 0;
    while (numberCount(state, person) === 0 && guard++ < 100) {
      if (drawInto(state, person, 1, rand, "refill").length === 0) break;
    }
  });
}

function takeRandomNumbers(state, person, count, rand) {
  const taken = [];
  for (let i = 0; i < count; i++) {
    const nums = numbersIn(state.hands[person]);
    if (!nums.length) break;
    const card = nums[Math.floor(rand() * nums.length)];
    state.hands[person].splice(state.hands[person].indexOf(card), 1);
    taken.push(card);
  }
  return taken;
}

function newGameState(players, wins, gameNo, dealer, moveSeq, rand, rules) {
  const chosen = rules || configuredRules;
  if (!chosen) throw new Error("Die Karten (murphy-karten.json) sind noch nicht geladen.");
  if (chosen.murphy.length < players.length * chosen.winCards) {
    throw new Error(`Für ${players.length} Personen braucht es mindestens ${players.length * chosen.winCards} aktive Murphy-Karten.`);
  }
  const state = {
    players: players.slice(),
    rules: chosen,
    gameNo,
    round: 1,
    dealer,
    direction: 1,
    wins: perPlayer(players, p => (wins && wins[p]) || 0),
    won: perPlayer(players, () => []),
    murphyDeck: shuffle(chosen.murphy.map(m => m.id), rand),
    murphyBack: [],
    deck: shuffle([...numberCards(), ...actionCards(chosen)], rand),
    actionPile: [],
    hands: perPlayer(players, () => []),
    skip: perPlayer(players, () => false),
    phase: "play",
    readyNext: [],
    lastRound: null,
    result: null,
    moveSeq: moveSeq || 0,
    events: []
  };
  state.murphy = perPlayer(players, () => dealMurphy(state, rand));

  /* the one after the dealer gets 8 cards, the next 9, and so on; red action cards are put aside and replaced */
  const n = players.length;
  for (let k = 1; k <= n; k++) {
    const person = players[(dealer + k) % n];
    const size = FIRST_HAND + k - 1;
    while (state.hands[person].length < size) {
      const card = drawCard(state, rand);
      if (isRed(state, card)) state.actionPile.push(card);
      else state.hands[person].push(card);
    }
  }
  state.basar = [];
  for (let i = 0; i < BASAR_SIZE; i++) state.basar.push(drawNumber(state, rand));
  state.piles = [];
  for (let i = 0; i < PILES; i++) state.piles.push([drawNumber(state, rand)]);
  refillNumbers(state, rand);
  event(state, { type: "deal" });
  startTurn(state, players[(dealer + 1) % n]);
  return recordMove(state, { type: "deal", round: state.round });
}

/* createInitialState(players, rand?, rules?) – rules from parseCards(), otherwise the device's */
function createInitialState(players, rand = Math.random, rules = null) {
  if (!Array.isArray(players) || players.length < 2 || players.length > MAX_PLAYERS) throw new Error("Das Spiel braucht 2 bis 4 Personen.");
  return newGameState(players, null, 1, Math.floor(rand() * players.length), 0, rand, rules);
}

function startTurn(state, person) {
  state.turnPerson = person;
  state.step = "take";
  state.trade = null;
  state.tradesLeft = 1;
  state.actionPlayed = false;
}

/* ---------- moves ---------- */

function assertTurn(state, person, step) {
  if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  if (state.phase !== "play") throw new Error("Die Runde ist vorbei.");
  if (state.turnPerson !== person) throw new Error(`${state.turnPerson} ist am Zug.`);
  if (step === "take" && state.step !== "take") throw new Error("Gib zuerst deine Karten ab.");
  if (step === "give" && state.step !== "give") throw new Error("Nimm zuerst Karten.");
}

/* taking one card means giving two: afterwards at least one number card must be left */
function assertCanGiveTwo(state, person, gainNumbers) {
  if (numberCount(state, person) + gainNumbers - 2 < 1) throw new Error("Für „1 nehmen, 2 abgeben“ hast du zu wenige Zahlenkarten.");
}

function startGive(state, person, at, taken) {
  state.step = "give";
  state.trade = { at, taken: taken.length, give: taken.length === 1 ? 2 : 1, cards: taken };
}

/* from the hidden deck: one or two cards. A red action card acts at once and ends the turn. */
function takeDeck(state, person, count, rand = Math.random) {
  assertTurn(state, person, "take");
  if (count !== 1 && count !== 2) throw new Error("Vom Stapel nimmt man eine oder zwei Karten.");
  if (count === 1) assertCanGiveTwo(state, person, 0);
  const next = begin(state);
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const card = drawCard(next, rand);
    if (!card) break;
    drawn.push(card);
  }
  if (drawn.length < count) throw new Error("Im Stapel sind nicht mehr genug Karten.");
  const reds = drawn.filter(c => isRed(next, c));
  const kept = drawn.filter(c => !isRed(next, c));
  next.hands[person].push(...kept);
  event(next, { type: "take", person, from: "deck", cards: kept, count });

  if (reds.length) {
    reds.forEach(card => playEffect(next, person, card, {}, rand));
    finishTurn(next, person, rand);
    return recordMove(next, { type: "take", person });
  }
  /* only green action cards came and the hand would run out of numbers: swap them for new cards */
  const give = count === 1 ? 2 : 1;
  let guard = 0;
  while (numberCount(next, person) - give < 1 && guard++ < 50) {
    const green = kept.find(c => isAction(c) && next.hands[person].includes(c));
    if (!green) break;
    next.hands[person].splice(next.hands[person].indexOf(green), 1);
    next.actionPile.push(green);
    kept.splice(kept.indexOf(green), 1);
    const card = drawCard(next, rand);
    if (!card) break;
    event(next, { type: "swap-green", person, card: green });
    if (isRed(next, card)) {
      playEffect(next, person, card, {}, rand);
      finishTurn(next, person, rand);
      return recordMove(next, { type: "take", person });
    }
    next.hands[person].push(card);
    kept.push(card);
  }
  startGive(next, person, "stapel", kept);
  return recordMove(next, { type: "take", person });
}

/* from one open pile: its top card, or its top two */
function takeOpen(state, person, pile, count) {
  assertTurn(state, person, "take");
  if (pile !== 0 && pile !== 1) throw new Error("Diesen Stapel gibt es nicht.");
  if (count !== 1 && count !== 2) throw new Error("Man nimmt eine oder zwei Karten.");
  if (state.piles[pile].length < count) throw new Error(count === 1 ? "Der Stapel ist leer." : "Auf dem Stapel liegen keine zwei Karten.");
  if (count === 1) assertCanGiveTwo(state, person, 1);
  const next = begin(state);
  const cards = next.piles[pile].splice(next.piles[pile].length - count, count).reverse();
  next.hands[person].push(...cards);
  event(next, { type: "take", person, from: "pile", pile, cards });
  startGive(next, person, "stapel", cards);
  return recordMove(next, { type: "take", person });
}

/* the top card of both open piles */
function takeBothOpen(state, person) {
  assertTurn(state, person, "take");
  if (state.piles.some(pile => pile.length === 0)) throw new Error("Ein offener Stapel ist leer.");
  const next = begin(state);
  const cards = next.piles.map(pile => pile.pop());
  next.hands[person].push(...cards);
  event(next, { type: "take", person, from: "both", cards });
  startGive(next, person, "stapel", cards);
  return recordMove(next, { type: "take", person });
}

/* one or two cards from the Basar – it never holds more than seven afterwards */
function takeBasar(state, person, cards) {
  assertTurn(state, person, "take");
  const chosen = Array.from(new Set(cards || []));
  if (chosen.length !== 1 && chosen.length !== 2) throw new Error("Vom Basar nimmt man eine oder zwei Karten.");
  chosen.forEach(card => { if (!state.basar.includes(card)) throw new Error("Diese Karte liegt nicht im Basar."); });
  const give = chosen.length === 1 ? 2 : 1;
  if (state.basar.length - chosen.length + give > BASAR_SIZE) throw new Error(`Der Basar hätte danach mehr als ${BASAR_SIZE} Karten – nimm zwei.`);
  if (chosen.length === 1) assertCanGiveTwo(state, person, 1);
  const next = begin(state);
  next.basar = next.basar.filter(c => !chosen.includes(c));
  next.hands[person].push(...chosen);
  event(next, { type: "take", person, from: "basar", cards: chosen });
  startGive(next, person, "basar", chosen);
  return recordMove(next, { type: "take", person });
}

/* give back number cards where you took: onto the open piles (piles[i] for card i) or into the Basar */
function give(state, person, cards, piles, rand = Math.random) {
  assertTurn(state, person, "give");
  const chosen = Array.from(new Set(cards || []));
  const need = state.trade.give;
  if (chosen.length !== need) throw new Error(need === 1 ? "Gib genau eine Zahlenkarte ab." : "Gib genau zwei Zahlenkarten ab.");
  chosen.forEach(card => {
    if (!state.hands[person].includes(card)) throw new Error("Diese Karte hast du nicht auf der Hand.");
    if (!isNumber(card)) throw new Error("Abgeben kann man nur Zahlenkarten.");
  });
  if (numberCount(state, person) - need < 1) throw new Error("Eine Zahlenkarte muss dir bleiben.");
  const targets = state.trade.at === "stapel" ? chosen.map((_, i) => (piles && piles[i] !== undefined ? piles[i] : (piles && piles[0]) || 0)) : null;
  if (targets && targets.some(p => p !== 0 && p !== 1)) throw new Error("Diesen Stapel gibt es nicht.");
  const next = begin(state);
  chosen.forEach((card, i) => {
    next.hands[person].splice(next.hands[person].indexOf(card), 1);
    if (targets) next.piles[targets[i]].push(card);
    else next.basar.push(card);
  });
  event(next, { type: "give", person, at: state.trade.at, cards: chosen, piles: targets });
  next.tradesLeft -= 1;
  next.trade = null;
  if (next.tradesLeft > 0) {
    next.step = "take";
    return recordMove(next, { type: "give", person });
  }
  finishTurn(next, person, rand);
  return recordMove(next, { type: "give", person });
}

/* a green action card instead of a trade. opts: { target, cards } where the card asks for them */
function playAction(state, person, card, opts = {}, rand = Math.random) {
  assertTurn(state, person, "take");
  if (!state.hands[person].includes(card)) throw new Error("Diese Karte hast du nicht auf der Hand.");
  if (!isGreen(state, card)) throw new Error("Ausspielen kann man nur grüne Aktionskarten.");
  if (state.actionPlayed || state.tradesLeft > 1) throw new Error("In diesem Zug wurde schon eine Aktionskarte gespielt.");
  const action = actionOf(state, card);
  const spec = EFFECTS[action.effect];
  if (spec.target) {
    if (!opts.target && state.players.length === 2) opts = { ...opts, target: state.players.find(p => p !== person) };
    if (!state.players.includes(opts.target) || opts.target === person) throw new Error("Wähle eine andere Person.");
  }
  if (spec.choose) {
    const chosen = Array.from(new Set(opts.cards || []));
    if (chosen.length < 1 || chosen.length > action.amount) throw new Error(`Wähle 1 bis ${action.amount} Zahlenkarten.`);
    chosen.forEach(c => { if (!state.hands[person].includes(c) || !isNumber(c)) throw new Error("Wähle Zahlenkarten von deiner Hand."); });
    if (numberCount(state, person) - chosen.length < 1) throw new Error("Eine Zahlenkarte muss dir bleiben.");
  }
  const next = begin(state);
  next.hands[person].splice(next.hands[person].indexOf(card), 1);
  next.actionPlayed = true;
  playEffect(next, person, card, opts, rand);
  if (action.effect === "doppelzug") {
    next.tradesLeft = 2;
    return recordMove(next, { type: "action", person });
  }
  finishTurn(next, person, rand);
  return recordMove(next, { type: "action", person });
}

/* what an action card does. Red cards hit the next person and random cards, green ones the choice in opts. */
function playEffect(state, person, card, opts, rand) {
  const action = actionOf(state, card);
  const red = action.colour === "rot";
  const target = red ? nextOf(state, person) : opts.target;
  state.actionPile.push(card);
  event(state, { type: "action", person, card, red, target: EFFECTS[action.effect].target ? target : null });
  switch (action.effect) {
    case "ziehen":
      drawInto(state, person, action.amount, rand, "action");
      break;
    case "alleZiehen":
      state.players.forEach(p => drawInto(state, p, action.amount, rand, "action"));
      break;
    case "aussetzen":
      state.skip[nextOf(state, person)] = true;
      break;
    case "richtung":
      state.direction *= -1;
      break;
    case "weitergeben": {
      const gifts = perPlayer(state.players, p => takeRandomNumbers(state, p, action.amount, rand));
      state.players.forEach(p => state.hands[nextOf(state, p)].push(...gifts[p]));
      event(state, { type: "passed", count: action.amount });
      break;
    }
    case "handtausch": {
      const mine = numbersIn(state.hands[person]);
      const theirs = numbersIn(state.hands[target]);
      state.hands[person] = [...state.hands[person].filter(c => !isNumber(c)), ...theirs];
      state.hands[target] = [...state.hands[target].filter(c => !isNumber(c)), ...mine];
      break;
    }
    case "murphyNeu": {
      const old = state.murphy[person];
      if (old) state.murphyBack.push(old);
      state.murphy[person] = dealMurphy(state, rand);
      break;
    }
    case "murphyWeiter": {
      const before = { ...state.murphy };
      state.players.forEach(p => { state.murphy[nextOf(state, p)] = before[p]; });
      break;
    }
    case "klauen": {
      const got = takeRandomNumbers(state, target, action.amount, rand);
      state.hands[person].push(...got);
      event(state, { type: "stolen", person, target, cards: got });
      break;
    }
    case "abgeben": {
      const cards = red ? takeRandomNumbers(state, person, action.amount, rand) : opts.cards.slice();
      if (!red) cards.forEach(c => state.hands[person].splice(state.hands[person].indexOf(c), 1));
      state.hands[target].push(...cards);
      event(state, { type: "gift", person, target, cards });
      break;
    }
    case "ablegen": {
      const cards = red ? takeRandomNumbers(state, person, action.amount, rand) : opts.cards.slice();
      if (!red) cards.forEach(c => state.hands[person].splice(state.hands[person].indexOf(c), 1));
      const pile = opts.pile === 1 ? 1 : 0;
      state.piles[pile].push(...cards);
      event(state, { type: "dropped", person, cards, pile });
      break;
    }
    default:
      break;
  }
}

/* the turn is over: refill empty hands, check the Murphy cards (the one who moved first), then the next one */
function finishTurn(state, person, rand) {
  refillNumbers(state, rand);
  state.step = null;
  state.trade = null;
  const order = [person, ...state.players.filter(p => p !== person)];
  const winner = order.find(p => fulfils(murphyCheck(state, p), state.hands[p]) === true);
  if (winner) {
    winRound(state, winner);
    return;
  }
  advanceTurn(state, person);
}

function murphyCheck(state, person) {
  const card = murphyOf(state, state.murphy[person]);
  return card ? card.check : null;
}

function advanceTurn(state, from) {
  let person = from;
  for (let i = 0; i < state.players.length * 2; i++) {
    person = nextOf(state, person);
    if (state.skip[person]) {
      state.skip[person] = false;
      event(state, { type: "skip", person });
      continue;
    }
    startTurn(state, person);
    return;
  }
  startTurn(state, nextOf(state, from));
}

/* "Erfüllt!" for a Murphy card without a condition the game could check – the table trusts you */
function claimMurphy(state, person) {
  if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  if (state.phase !== "play") throw new Error("Die Runde ist vorbei.");
  const check = murphyCheck(state, person);
  if (check) {
    if (!fulfils(check, state.hands[person])) throw new Error("Deine Murphy-Karte ist noch nicht erfüllt.");
  }
  const next = begin(state);
  winRound(next, person);
  return recordMove(next, { type: "claim", person });
}

function winRound(state, winner) {
  const card = state.murphy[winner];
  state.won[winner].push(card);
  state.players.forEach(p => {
    if (p !== winner && state.murphy[p]) state.murphyBack.push(state.murphy[p]);
  });
  state.lastRound = { round: state.round, winner, card, cards: state.hands[winner].slice(), missed: { ...state.murphy } };
  delete state.lastRound.missed[winner];
  state.murphy = perPlayer(state.players, () => null);
  state.turnPerson = null;
  state.step = null;
  state.trade = null;
  state.readyNext = [];
  event(state, { type: "murphy", person: winner, card });
  if (state.won[winner].length >= state.rules.winCards) {
    state.wins[winner] = (state.wins[winner] || 0) + 1;
    state.result = { winner };
    state.phase = "finished";
    return;
  }
  state.phase = "round-over";
}

/* everybody gets a new Murphy card, the hands stay; the one after the winner begins */
function nextRound(state, person, rand = Math.random) {
  if (state.phase !== "round-over") throw new Error("Die Runde läuft noch.");
  const next = begin(state);
  next.round += 1;
  next.phase = "play";
  next.readyNext = [];
  next.direction = 1;
  next.skip = perPlayer(next.players, () => false);
  next.players.forEach(p => { next.murphy[p] = dealMurphy(next, rand); });
  event(next, { type: "new-murphy" });
  startTurn(next, nextOf(next, next.lastRound.winner));
  return recordMove(next, { type: "round", round: next.round });
}

function newGame(state, person, rand = Math.random) {
  if (state.phase !== "finished") throw new Error("Die Partie läuft noch.");
  /* a new game takes the cards as they are now in murphy-karten.json – otherwise those of the last game */
  const rules = configuredRules || state.rules;
  return newGameState(state.players, state.wins, (state.gameNo || 1) + 1, (state.dealer + 1) % state.players.length, state.moveSeq, rand, rules);
}

/* every card is somewhere: deck, open piles, played actions, Basar or a hand */
function countCards(state) {
  const hands = state.players.reduce((sum, p) => sum + state.hands[p].length, 0);
  const piles = state.piles.reduce((sum, pile) => sum + pile.length, 0);
  return state.deck.length + piles + state.actionPile.length + state.basar.length + hands;
}

function totalCards(rules) {
  return numberCards().length + actionCards(rules).length;
}

return {
  MAX_PLAYERS,
  MAX_VALUE,
  COLOURS,
  COLOUR_NAMES,
  BASAR_SIZE,
  EFFECTS,
  copiesOf,
  numberCards,
  actionCards,
  totalCards,
  parseCards,
  useRules,
  isAction,
  isNumber,
  isRed,
  isGreen,
  colourOf,
  valueOf,
  actionOf,
  murphyOf,
  murphyCheck,
  cardLabel,
  taskDistance,
  fulfils,
  nextOf,
  countCards,
  createInitialState,
  takeDeck,
  takeOpen,
  takeBothOpen,
  takeBasar,
  give,
  playAction,
  claimMurphy,
  nextRound,
  newGame
};

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MurphyEngine;
}
if (typeof window !== "undefined") {
  window.MurphyEngine = MurphyEngine;
}
