/* Monopoly – pure rules for 2–4 players (classic board with 40 squares).
   No DOM: loaded as <script> in the browser, testable in Node via require.

   Simplified: no auctions (whoever does not buy leaves the street unowned).
   Debts: whoever has to pay more than they hold goes into the "debt" phase and raises the money
   themselves – sell houses (half price) and mortgage streets (half the price, no rent while
   mortgaged, redeem for the mortgage + 10 %) – or gives up. Trading is kept simple: streets and cash for streets, one offer at a time, made on your own
   turn. Everything else follows the classic rules: doubles, jail, rent doubled on a full
   colour set, building evenly, houses and hotels, "Ereignis" and "Gemeinschaft" cards.

   Two ways to play (option): "full" – until only one player is left; "short" – after 20 turns
   each, the richest wins (cash + streets + houses). */

const MonopolyEngine = (() => {

const MAX_PLAYERS = 4;
const START_CASH = 1500;
const GO_BONUS = 200;
const JAIL_POS = 10;
const JAIL_FINE = 50;
const MAX_JAIL_TURNS = 3;
const MAX_HOUSES = 5; /* 5 = hotel */
const SHORT_TURNS_EACH = 20;

const GROUPS = {
  brown: { name: "Braun", color: "#8b5a3c" },
  lightblue: { name: "Hellblau", color: "#7ed0f0" },
  pink: { name: "Pink", color: "#e0489c" },
  orange: { name: "Orange", color: "#f39a2c" },
  red: { name: "Rot", color: "#e03a3a" },
  yellow: { name: "Gelb", color: "#f4d330" },
  green: { name: "Grün", color: "#2faa5e" },
  darkblue: { name: "Dunkelblau", color: "#2d4fc4" }
};

const street = (name, group, price, houseCost, rent) => ({ type: "street", name, group, price, houseCost, rent });
const station = name => ({ type: "station", name, price: 200 });
const utility = name => ({ type: "utility", name, price: 150 });

const SQUARES = [
  { type: "go", name: "Los" },
  street("Badstraße", "brown", 60, 50, [2, 10, 30, 90, 160, 250]),
  { type: "chest", name: "Gemeinschaft" },
  street("Turmstraße", "brown", 60, 50, [4, 20, 60, 180, 320, 450]),
  { type: "tax", name: "Einkommensteuer", amount: 200 },
  station("Südbahnhof"),
  street("Chausseestraße", "lightblue", 100, 50, [6, 30, 90, 270, 400, 550]),
  { type: "chance", name: "Ereignis" },
  street("Elisenstraße", "lightblue", 100, 50, [6, 30, 90, 270, 400, 550]),
  street("Poststraße", "lightblue", 120, 50, [8, 40, 100, 300, 450, 600]),
  { type: "jail", name: "Gefängnis" },
  street("Seestraße", "pink", 140, 100, [10, 50, 150, 450, 625, 750]),
  utility("Elektrizitätswerk"),
  street("Hafenstraße", "pink", 140, 100, [10, 50, 150, 450, 625, 750]),
  street("Neue Straße", "pink", 160, 100, [12, 60, 180, 500, 700, 900]),
  station("Westbahnhof"),
  street("Münchener Straße", "orange", 180, 100, [14, 70, 200, 550, 750, 950]),
  { type: "chest", name: "Gemeinschaft" },
  street("Wiener Straße", "orange", 180, 100, [14, 70, 200, 550, 750, 950]),
  street("Berliner Straße", "orange", 200, 100, [16, 80, 220, 600, 800, 1000]),
  { type: "parking", name: "Frei Parken" },
  street("Theaterstraße", "red", 220, 150, [18, 90, 250, 700, 875, 1050]),
  { type: "chance", name: "Ereignis" },
  street("Museumsstraße", "red", 220, 150, [18, 90, 250, 700, 875, 1050]),
  street("Opernplatz", "red", 240, 150, [20, 100, 300, 750, 925, 1100]),
  station("Nordbahnhof"),
  street("Lessingstraße", "yellow", 260, 150, [22, 110, 330, 800, 975, 1150]),
  street("Schillerstraße", "yellow", 260, 150, [22, 110, 330, 800, 975, 1150]),
  utility("Wasserwerk"),
  street("Goethestraße", "yellow", 280, 150, [24, 120, 360, 850, 1025, 1200]),
  { type: "gotojail", name: "Gehe ins Gefängnis" },
  street("Rathausplatz", "green", 300, 200, [26, 130, 390, 900, 1100, 1275]),
  street("Hauptstraße", "green", 300, 200, [26, 130, 390, 900, 1100, 1275]),
  { type: "chest", name: "Gemeinschaft" },
  street("Bahnhofstraße", "green", 320, 200, [28, 150, 450, 1000, 1200, 1400]),
  station("Hauptbahnhof"),
  { type: "chance", name: "Ereignis" },
  street("Parkstraße", "darkblue", 350, 200, [35, 175, 500, 1100, 1300, 1500]),
  { type: "tax", name: "Zusatzsteuer", amount: 100 },
  street("Schlossallee", "darkblue", 400, 200, [50, 200, 600, 1400, 1700, 2000])
];

const isOwnable = square => square.type === "street" || square.type === "station" || square.type === "utility";
const groupSquares = group => SQUARES.map((s, i) => ({ s, i })).filter(({ s }) => s.group === group).map(({ i }) => i);

/* ---------- cards ---------- */

/* kinds: money (±amount), moveTo (square, collects at Los), back (steps), jail, free (get-out card),
   repair (per house / per hotel), payEach / collectEach (amount per other player) */
const CHANCE = [
  { id: "ch1", text: "Rücke vor bis auf Los und ziehe 200 ein.", kind: "moveTo", to: 0 },
  { id: "ch2", text: "Rücke vor bis zur Schlossallee.", kind: "moveTo", to: 39 },
  { id: "ch3", text: "Rücke vor bis zum Opernplatz.", kind: "moveTo", to: 24 },
  { id: "ch4", text: "Rücke vor bis zum Südbahnhof.", kind: "moveTo", to: 5 },
  { id: "ch5", text: "Die Bank zahlt dir 50 Dividende.", kind: "money", amount: 50 },
  { id: "ch6", text: "Gehe 3 Felder zurück.", kind: "back", steps: 3 },
  { id: "ch7", text: "Gehe in das Gefängnis. Gehe nicht über Los.", kind: "jail" },
  { id: "ch8", text: "Lass deine Häuser reparieren: 25 je Haus, 100 je Hotel.", kind: "repair", house: 25, hotel: 100 },
  { id: "ch9", text: "Strafzettel für zu schnelles Fahren: zahle 15.", kind: "money", amount: -15 },
  { id: "ch10", text: "Du kommst aus dem Gefängnis frei. Behalte diese Karte.", kind: "free" },
  { id: "ch11", text: "Du wirst Vorstand: zahle jedem Mitspieler 50.", kind: "payEach", amount: 50 },
  { id: "ch12", text: "Rücke vor bis zur Seestraße.", kind: "moveTo", to: 11 }
];

const CHEST = [
  { id: "cc1", text: "Bankirrtum zu deinen Gunsten: ziehe 200 ein.", kind: "money", amount: 200 },
  { id: "cc2", text: "Du erbst 100.", kind: "money", amount: 100 },
  { id: "cc3", text: "Arztkosten: zahle 50.", kind: "money", amount: -50 },
  { id: "cc4", text: "Krankenhausgebühren: zahle 100.", kind: "money", amount: -100 },
  { id: "cc5", text: "Du hast Geburtstag: jeder Mitspieler schenkt dir 10.", kind: "collectEach", amount: 10 },
  { id: "cc6", text: "Rücke vor bis auf Los und ziehe 200 ein.", kind: "moveTo", to: 0 },
  { id: "cc7", text: "Gehe in das Gefängnis. Gehe nicht über Los.", kind: "jail" },
  { id: "cc8", text: "Du kommst aus dem Gefängnis frei. Behalte diese Karte.", kind: "free" },
  { id: "cc9", text: "Straßenreparatur: 40 je Haus, 115 je Hotel.", kind: "repair", house: 40, hotel: 115 },
  { id: "cc10", text: "Du gewinnst den zweiten Preis im Schönheitswettbewerb: ziehe 25 ein.", kind: "money", amount: 25 },
  { id: "cc11", text: "Steuerrückzahlung: ziehe 20 ein.", kind: "money", amount: 20 },
  { id: "cc12", text: "Schulgeld: zahle 50.", kind: "money", amount: -50 }
];

const cardById = id => CHANCE.concat(CHEST).find(c => c.id === id);

/* ---------- helpers ---------- */

function shuffle(cards, rand = Math.random) {
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const clone = state => JSON.parse(JSON.stringify(state));

function perPlayer(players, valueFn) {
  return players.reduce((acc, p) => { acc[p] = valueFn(p); return acc; }, {});
}

const alive = state => state.players.filter(p => !state.out.includes(p));
const ownerOf = (state, index) => (state.props[index] ? state.props[index].owner : null);
const housesOn = (state, index) => (state.props[index] ? state.props[index].houses : 0);
const ownedBy = (state, person) => Object.keys(state.props).map(Number).filter(i => state.props[i].owner === person).sort((a, b) => a - b);

function ownsGroup(state, person, group) {
  return groupSquares(group).every(i => ownerOf(state, i) === person);
}

function stationsOwned(state, person) {
  return SQUARES.reduce((n, s, i) => n + (s.type === "station" && ownerOf(state, i) === person ? 1 : 0), 0);
}

function utilitiesOwned(state, person) {
  return SQUARES.reduce((n, s, i) => n + (s.type === "utility" && ownerOf(state, i) === person ? 1 : 0), 0);
}

const isMortgaged = (state, index) => Boolean(state.props[index] && state.props[index].mortgaged);
const mortgageValue = index => Math.floor(SQUARES[index].price / 2);
const redeemCost = index => Math.ceil((mortgageValue(index) * 11) / 10);

function rentFor(state, index, diceTotal) {
  const square = SQUARES[index];
  const owner = ownerOf(state, index);
  if (!owner || isMortgaged(state, index)) return 0;
  if (square.type === "street") {
    const houses = housesOn(state, index);
    if (houses > 0) return square.rent[houses];
    return ownsGroup(state, owner, square.group) ? square.rent[0] * 2 : square.rent[0];
  }
  if (square.type === "station") return 25 * 2 ** (stationsOwned(state, owner) - 1);
  if (square.type === "utility") return (diceTotal || 7) * (utilitiesOwned(state, owner) >= 2 ? 10 : 4);
  return 0;
}

function netWorth(state, person) {
  return ownedBy(state, person).reduce((sum, i) => {
    const sq = SQUARES[i];
    return sum + (isMortgaged(state, i) ? mortgageValue(i) : sq.price) + housesOn(state, i) * (sq.houseCost || 0);
  }, state.cash[person]);
}

function event(state, entry) {
  state.events.push(entry);
}

/* ---------- money ---------- */

/* what a player could still raise: cash, houses at half price, mortgages on the streets */
function assets(state, person) {
  return ownedBy(state, person).reduce((sum, i) => {
    const sq = SQUARES[i];
    return sum + housesOn(state, i) * Math.floor((sq.houseCost || 0) / 2) + (isMortgaged(state, i) ? 0 : mortgageValue(i));
  }, state.cash[person]);
}

/* houses go first (most built street first), then mortgages – only for payers who cannot choose */
function liquidate(state, person, needed) {
  while (state.cash[person] < needed) {
    const built = ownedBy(state, person).filter(i => housesOn(state, i) > 0);
    if (built.length > 0) {
      built.sort((a, b) => housesOn(state, b) - housesOn(state, a) || b - a);
      const index = built[0];
      state.props[index].houses -= 1;
      const refund = Math.floor(SQUARES[index].houseCost / 2);
      state.cash[person] += refund;
      event(state, { type: "forced-sale", person, square: index, amount: refund });
      continue;
    }
    const free = ownedBy(state, person).filter(i => !isMortgaged(state, i)).sort((a, b) => SQUARES[a].price - SQUARES[b].price);
    if (free.length === 0) return;
    state.props[free[0]].mortgaged = true;
    state.cash[person] += mortgageValue(free[0]);
    event(state, { type: "mortgage", person, square: free[0], amount: mortgageValue(free[0]), forced: true });
  }
}

function bankrupt(state, person, creditor) {
  event(state, { type: "bankrupt", person, creditor: creditor || null });
  const rest = state.cash[person];
  state.cash[person] = 0;
  if (creditor) state.cash[creditor] += rest;
  ownedBy(state, person).forEach(i => {
    if (creditor) state.props[i] = { owner: creditor, houses: 0, ...(isMortgaged(state, i) ? { mortgaged: true } : {}) };
    else delete state.props[i];
  });
  /* a held get-out card goes back into its deck */
  state.jailCards[person].forEach(id => state[id.startsWith("ch") ? "chance" : "chest"].push(id));
  state.jailCards[person] = [];
  state.out.push(person);
  state.trade = null;
  state.debt = null;
}

/* a payment nobody can choose how to raise (a card taking money from the others, the jail fine):
   houses and streets are sold automatically; bankrupt when that is not enough */
function forcedPay(state, from, to, amount) {
  if (amount <= 0) return true;
  liquidate(state, from, amount);
  if (state.cash[from] >= amount) {
    state.cash[from] -= amount;
    if (to) state.cash[to] += amount;
    return true;
  }
  bankrupt(state, from, to);
  return false;
}

const debtTotal = debt => debt.owed.reduce((sum, o) => sum + o.amount, 0);

function payDebt(state) {
  const { person, owed } = state.debt;
  owed.forEach(o => {
    state.cash[person] -= o.amount;
    if (o.to) state.cash[o.to] += o.amount;
  });
  state.debt = null;
  state.phase = "after";
  event(state, { type: "debt-paid", person });
}

/* the player on turn owes money: pay at once, go bankrupt if nothing can raise it, or let them raise it */
function owe(state, person, owed, reason) {
  const list = owed.filter(o => o.amount > 0);
  const total = list.reduce((sum, o) => sum + o.amount, 0);
  if (total <= 0) return;
  if (state.cash[person] >= total) {
    list.forEach(o => {
      state.cash[person] -= o.amount;
      if (o.to) state.cash[o.to] += o.amount;
    });
    return;
  }
  if (assets(state, person) < total) {
    const creditors = [...new Set(list.map(o => o.to))];
    bankrupt(state, person, creditors.length === 1 ? creditors[0] : null);
    return;
  }
  state.debt = { person, owed: list, reason };
  state.phase = "debt";
  event(state, { type: "debt", person, amount: total });
}

/* ---------- movement ---------- */

function goToJail(state, person) {
  state.pos[person] = JAIL_POS;
  state.jail[person] = 0;
  event(state, { type: "jail", person });
}

/* returns "moved" or "stopped" (bankrupt, jailed or waiting for a decision is handled by land) */
function moveTo(state, person, target, collectGo = true) {
  const from = state.pos[person];
  const passed = collectGo && target < from;
  state.pos[person] = target;
  if (passed) {
    state.cash[person] += GO_BONUS;
    event(state, { type: "go", person, amount: GO_BONUS });
  }
}

function drawCard(state, deckName) {
  const deck = state[deckName];
  const id = deck.shift();
  const card = cardById(id);
  if (card.kind === "free") {
    /* the card is kept until used – it is not in the deck meanwhile */
    state.jailCards[state.turnPerson].push(id);
  } else {
    deck.push(id);
  }
  return card;
}

function applyCard(state, person, card, depth) {
  switch (card.kind) {
    case "money":
      if (card.amount >= 0) state.cash[person] += card.amount;
      else owe(state, person, [{ to: null, amount: -card.amount }]);
      break;
    case "moveTo":
      moveTo(state, person, card.to);
      land(state, person, depth + 1);
      break;
    case "back":
      state.pos[person] = (state.pos[person] - card.steps + SQUARES.length) % SQUARES.length;
      land(state, person, depth + 1);
      break;
    case "jail":
      goToJail(state, person);
      break;
    case "repair": {
      let total = 0;
      ownedBy(state, person).forEach(i => {
        const h = housesOn(state, i);
        total += h >= MAX_HOUSES ? card.hotel : h * card.house;
      });
      owe(state, person, [{ to: null, amount: total }]);
      break;
    }
    case "payEach":
      owe(state, person, alive(state).filter(p => p !== person).map(other => ({ to: other, amount: card.amount })));
      break;
    case "collectEach":
      alive(state).filter(p => p !== person).forEach(other => forcedPay(state, other, person, card.amount));
      break;
    default:
      break;
  }
}

/* what happens on the square the player is standing on */
function land(state, person, depth = 0) {
  if (state.out.includes(person) || depth > 3) return;
  const index = state.pos[person];
  const square = SQUARES[index];

  if (isOwnable(square)) {
    const owner = ownerOf(state, index);
    if (!owner) {
      if (state.cash[person] >= square.price) {
        state.phase = "buy";
        state.offer = index;
      } else {
        event(state, { type: "cant-afford", person, square: index });
      }
    } else if (owner !== person) {
      const amount = rentFor(state, index, state.dice ? state.dice[0] + state.dice[1] : 7);
      if (amount > 0) event(state, { type: "rent", person, owner, square: index, amount });
      if (amount > 0) owe(state, person, [{ to: owner, amount }]);
    }
    return;
  }
  if (square.type === "tax") {
    event(state, { type: "tax", person, square: index, amount: square.amount });
    owe(state, person, [{ to: null, amount: square.amount }]);
    return;
  }
  if (square.type === "chance" || square.type === "chest") {
    const card = drawCard(state, square.type);
    event(state, { type: "card", person, deck: square.type, id: card.id, text: card.text });
    applyCard(state, person, card, depth);
    return;
  }
  if (square.type === "gotojail") goToJail(state, person);
}

/* ---------- turn flow ---------- */

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

function finishGame(state) {
  const standing = alive(state);
  const worth = perPlayer(state.players, p => netWorth(state, p));
  const best = Math.max(...standing.map(p => worth[p]));
  const winners = standing.filter(p => worth[p] === best);
  state.phase = "finished";
  state.offer = null;
  state.result = { winner: winners[0], winners, worth, reason: standing.length === 1 ? "last" : "time" };
  winners.forEach(p => { state.wins[p] = (state.wins[p] || 0) + 1; });
  event(state, { type: "game-over", winners });
}

function checkEnd(state) {
  if (state.phase === "finished") return true;
  if (alive(state).length <= 1) {
    finishGame(state);
    return true;
  }
  return false;
}

function nextPlayerAfter(state, person) {
  const n = state.players.length;
  let index = state.players.indexOf(person);
  for (let i = 0; i < n; i++) {
    index = (index + 1) % n;
    if (!state.out.includes(state.players[index])) return state.players[index];
  }
  return person;
}

/* the turn is over: next player, or the same one again after doubles */
function advance(state) {
  if (checkEnd(state)) return;
  const person = state.turnPerson;
  const again = state.rolledDoubles && !state.out.includes(person) && state.jail[person] === null;
  state.offer = null;
  state.trade = null;
  state.rolledDoubles = false;
  if (again) {
    state.phase = "roll";
    return;
  }
  state.doublesCount = 0;
  state.turnCount += 1;
  if (state.mode === "short" && state.turnCount >= SHORT_TURNS_EACH * state.players.length) {
    finishGame(state);
    return;
  }
  state.turnPerson = nextPlayerAfter(state, person);
  state.phase = "roll";
}

/* after landing: either a decision is pending (buy) or the player may build and end the turn */
function settle(state) {
  if (checkEnd(state)) return;
  const person = state.turnPerson;
  if (state.out.includes(person)) {
    state.rolledDoubles = false;
    advance(state);
    return;
  }
  if (state.phase !== "buy" && state.phase !== "debt") state.phase = "after";
}

function assertTurn(state, person, phases) {
  if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  if (state.phase === "finished") throw new Error("Die Partie ist vorbei.");
  if (state.turnPerson !== person) throw new Error(`${state.turnPerson} ist am Zug.`);
  if (!phases.includes(state.phase)) throw new Error("Das geht gerade nicht.");
}

/* ---------- start ---------- */

function newGameState(players, mode, wins, gameNo, first, moveSeq, rand) {
  const state = {
    players: players.slice(),
    mode,
    gameNo,
    phase: "roll",
    turnPerson: players[first],
    turnCount: 0,
    doublesCount: 0,
    rolledDoubles: false,
    dice: null,
    offer: null,
    trade: null,
    debt: null,
    lastTradeTurn: -1,
    pos: perPlayer(players, () => 0),
    cash: perPlayer(players, () => START_CASH),
    jail: perPlayer(players, () => null),
    jailCards: perPlayer(players, () => []),
    props: {},
    out: [],
    chance: shuffle(CHANCE.map(c => c.id), rand),
    chest: shuffle(CHEST.map(c => c.id), rand),
    wins: perPlayer(players, p => (wins && wins[p]) || 0),
    readyNext: [],
    result: null,
    moveSeq: moveSeq || 0,
    events: []
  };
  return recordMove(state, { type: "start" });
}

function createInitialState(players, option, rand = Math.random) {
  if (typeof option === "function") { rand = option; option = null; }
  if (!Array.isArray(players) || players.length < 2 || players.length > MAX_PLAYERS) {
    throw new Error("Monopoly braucht 2 bis 4 Personen.");
  }
  return newGameState(players, option === "short" ? "short" : "full", null, 1, Math.floor(rand() * players.length), 0, rand);
}

function newGame(state, person, rand = Math.random) {
  if (state.phase !== "finished") throw new Error("Die Partie läuft noch.");
  const first = (state.players.indexOf(state.turnPerson) + 1) % state.players.length;
  return newGameState(state.players, state.mode, state.wins, (state.gameNo || 1) + 1, first, state.moveSeq, rand);
}

/* ---------- moves ---------- */

/* roll the dice (also from jail: doubles set you free) */
function roll(state, person, rand = Math.random) {
  assertTurn(state, person, ["roll"]);
  const next = begin(state);
  const d1 = 1 + Math.floor(rand() * 6);
  const d2 = 1 + Math.floor(rand() * 6);
  const doubles = d1 === d2;
  next.dice = [d1, d2];
  event(next, { type: "roll", person, dice: [d1, d2], from: next.pos[person] });

  if (next.jail[person] !== null) {
    if (doubles) {
      next.jail[person] = null;
      event(next, { type: "jail-free", person, how: "doubles" });
    } else {
      next.jail[person] += 1;
      if (next.jail[person] < MAX_JAIL_TURNS) {
        event(next, { type: "jail-stay", person, turns: next.jail[person] });
        next.rolledDoubles = false;
        next.phase = "after";
        return recordMove(next, { type: "roll", person });
      }
      next.jail[person] = null;
      event(next, { type: "jail-free", person, how: "fine" });
      forcedPay(next, person, null, JAIL_FINE);
      if (next.out.includes(person)) {
        settle(next);
        return recordMove(next, { type: "roll", person });
      }
    }
    next.rolledDoubles = false; /* no extra roll after leaving jail */
  } else {
    next.doublesCount = doubles ? next.doublesCount + 1 : 0;
    if (doubles && next.doublesCount >= 3) {
      goToJail(next, person);
      next.rolledDoubles = false;
      next.phase = "after";
      return recordMove(next, { type: "roll", person });
    }
    next.rolledDoubles = doubles;
  }

  moveTo(next, person, (next.pos[person] + d1 + d2) % SQUARES.length, false);
  if (next.pos[person] < next.events[0].from) {
    next.cash[person] += GO_BONUS;
    event(next, { type: "go", person, amount: GO_BONUS });
  }
  event(next, { type: "move", person, to: next.pos[person] });
  land(next, person);
  settle(next);
  return recordMove(next, { type: "roll", person });
}

function buy(state, person) {
  assertTurn(state, person, ["buy"]);
  const next = begin(state);
  const index = next.offer;
  const square = SQUARES[index];
  next.cash[person] -= square.price;
  next.props[index] = { owner: person, houses: 0 };
  event(next, { type: "buy", person, square: index, amount: square.price });
  next.offer = null;
  next.phase = "after";
  return recordMove(next, { type: "buy", person });
}

/* without auctions the street simply stays with the bank */
function decline(state, person) {
  assertTurn(state, person, ["buy"]);
  const next = begin(state);
  event(next, { type: "decline", person, square: next.offer });
  next.offer = null;
  next.phase = "after";
  return recordMove(next, { type: "decline", person });
}

function canBuild(state, person, index) {
  const square = SQUARES[index];
  if (!square || square.type !== "street" || ownerOf(state, index) !== person) return "Diese Straße gehört dir nicht.";
  if (!ownsGroup(state, person, square.group)) return "Dafür brauchst du alle Straßen dieser Farbe.";
  if (groupSquares(square.group).some(i => isMortgaged(state, i))) return "Löse erst die Hypothek auf dieser Farbe ab.";
  const h = housesOn(state, index);
  if (h >= MAX_HOUSES) return "Hier steht schon ein Hotel.";
  const lowest = Math.min(...groupSquares(square.group).map(i => housesOn(state, i)));
  if (h > lowest) return "Baue gleichmäßig: erst auf den anderen Straßen dieser Farbe.";
  if (state.cash[person] < square.houseCost) return "Dafür reicht dein Geld nicht.";
  return null;
}

function canSell(state, person, index) {
  const square = SQUARES[index];
  if (!square || square.type !== "street" || ownerOf(state, index) !== person) return "Diese Straße gehört dir nicht.";
  const h = housesOn(state, index);
  if (h <= 0) return "Hier steht nichts zum Verkaufen.";
  const highest = Math.max(...groupSquares(square.group).map(i => housesOn(state, i)));
  if (h < highest) return "Verkaufe gleichmäßig: erst auf den anderen Straßen dieser Farbe.";
  return null;
}

function build(state, person, index) {
  assertTurn(state, person, ["roll", "after"]);
  const problem = canBuild(state, person, index);
  if (problem) throw new Error(problem);
  const next = begin(state);
  next.cash[person] -= SQUARES[index].houseCost;
  next.props[index].houses += 1;
  event(next, { type: "build", person, square: index, houses: next.props[index].houses });
  return recordMove(next, { type: "build", person });
}

function sellHouse(state, person, index) {
  assertTurn(state, person, ["roll", "after", "debt"]);
  const problem = canSell(state, person, index);
  if (problem) throw new Error(problem);
  const next = begin(state);
  const refund = Math.floor(SQUARES[index].houseCost / 2);
  next.cash[person] += refund;
  next.props[index].houses -= 1;
  event(next, { type: "sell", person, square: index, amount: refund });
  if (next.debt && next.cash[person] >= debtTotal(next.debt)) payDebt(next);
  return recordMove(next, { type: "sell", person });
}

/* debts: a street without houses (and without houses on its colour) can be mortgaged */
function canMortgage(state, person, index) {
  const square = SQUARES[index];
  if (!square || !isOwnable(square) || ownerOf(state, index) !== person) return "Diese Straße gehört dir nicht.";
  if (isMortgaged(state, index)) return "Hier liegt schon eine Hypothek.";
  if (square.group && groupSquares(square.group).some(i => housesOn(state, i) > 0)) return "Verkaufe erst alle Häuser dieser Farbe.";
  return null;
}

function canRedeem(state, person, index) {
  if (ownerOf(state, index) !== person || !isMortgaged(state, index)) return "Auf dieser Straße liegt keine Hypothek.";
  if (state.cash[person] < redeemCost(index)) return "Dafür reicht dein Geld nicht.";
  return null;
}

function mortgage(state, person, index) {
  assertTurn(state, person, ["roll", "after", "debt"]);
  const problem = canMortgage(state, person, index);
  if (problem) throw new Error(problem);
  const next = begin(state);
  next.props[index].mortgaged = true;
  next.cash[person] += mortgageValue(index);
  event(next, { type: "mortgage", person, square: index, amount: mortgageValue(index) });
  if (next.debt && next.cash[person] >= debtTotal(next.debt)) payDebt(next);
  return recordMove(next, { type: "mortgage", person });
}

function redeem(state, person, index) {
  assertTurn(state, person, ["roll", "after"]);
  const problem = canRedeem(state, person, index);
  if (problem) throw new Error(problem);
  const next = begin(state);
  delete next.props[index].mortgaged;
  next.cash[person] -= redeemCost(index);
  event(next, { type: "redeem", person, square: index, amount: redeemCost(index) });
  return recordMove(next, { type: "redeem", person });
}

/* in debt and no way out (or no wish to): everything goes to the creditor, or back to the bank */
function declareBankrupt(state, person) {
  assertTurn(state, person, ["debt"]);
  const next = begin(state);
  const creditors = [...new Set(next.debt.owed.map(o => o.to))];
  bankrupt(next, person, creditors.length === 1 ? creditors[0] : null);
  next.rolledDoubles = false;
  settle(next);
  return recordMove(next, { type: "bankrupt", person });
}

/* from jail before rolling: pay the fine or use the get-out card */
function leaveJail(state, person, how) {
  assertTurn(state, person, ["roll"]);
  if (state.jail[person] === null) throw new Error("Du sitzt nicht im Gefängnis.");
  const next = begin(state);
  if (how === "card") {
    if (next.jailCards[person].length < 1) throw new Error("Du hast keine Freikarte.");
    const id = next.jailCards[person].shift();
    next[id.startsWith("ch") ? "chance" : "chest"].push(id);
  } else {
    if (next.cash[person] < JAIL_FINE) throw new Error("Dafür reicht dein Geld nicht.");
    next.cash[person] -= JAIL_FINE;
  }
  next.jail[person] = null;
  event(next, { type: "jail-free", person, how: how === "card" ? "card" : "paid" });
  return recordMove(next, { type: "leave-jail", person });
}

const payJail = (state, person) => leaveJail(state, person, "pay");
const useJailCard = (state, person) => leaveJail(state, person, "card");

function endTurn(state, person) {
  assertTurn(state, person, ["after"]);
  const next = begin(state);
  advance(next);
  return recordMove(next, { type: "end", person });
}

/* ---------- trading ---------- */

/* a street can only change hands while nothing is built on its colour */
const tradable = (state, index) => isOwnable(SQUARES[index]) && (SQUARES[index].type !== "street" || groupSquares(SQUARES[index].group).every(i => housesOn(state, i) === 0));

/* cash > 0: the proposer pays that on top; cash < 0: the proposer receives it */
function tradeProblem(state, trade) {
  const { from, to, give, get, cash } = trade;
  if (!state.players.includes(to) || state.out.includes(to) || to === from) return "Mit dieser Person kannst du nicht tauschen.";
  if (!Number.isInteger(cash) || Math.abs(cash) > 100000) return "Das Geld stimmt nicht.";
  if (give.length + get.length === 0 && cash === 0) return "Es wird nichts getauscht.";
  if (!give.every(i => ownerOf(state, i) === from) || !get.every(i => ownerOf(state, i) === to)) return "Die Straßen gehören nicht mehr den beiden.";
  if (![...give, ...get].every(i => tradable(state, i))) return "Auf diesen Straßen stehen Häuser – erst verkaufen.";
  if (cash > 0 && state.cash[from] < cash) return `${from} hat nicht genug Geld.`;
  if (cash < 0 && state.cash[to] < -cash) return `${to} hat nicht genug Geld.`;
  return null;
}

function proposeTrade(state, person, to, give, get, cash = 0) {
  assertTurn(state, person, ["roll", "after"]);
  if (state.trade) throw new Error("Es liegt schon ein Angebot auf dem Tisch.");
  const trade = { from: person, to, give: [...give].sort((a, b) => a - b), get: [...get].sort((a, b) => a - b), cash };
  const problem = tradeProblem(state, trade);
  if (problem) throw new Error(problem);
  const next = begin(state);
  next.trade = trade;
  next.lastTradeTurn = next.turnCount;
  event(next, { type: "trade-offer", person, to });
  return recordMove(next, { type: "trade-offer", person });
}

function acceptTrade(state, person) {
  const trade = state.trade;
  if (!trade || trade.to !== person) throw new Error("Für dich liegt kein Angebot vor.");
  const problem = tradeProblem(state, trade);
  if (problem) throw new Error(problem);
  const next = begin(state);
  const moved = (i, owner) => { next.props[i] = { owner, houses: 0, ...(isMortgaged(next, i) ? { mortgaged: true } : {}) }; };
  trade.give.forEach(i => moved(i, trade.to));
  trade.get.forEach(i => moved(i, trade.from));
  next.cash[trade.from] -= trade.cash;
  next.cash[trade.to] += trade.cash;
  next.trade = null;
  event(next, { type: "trade-done", person: trade.from, to: trade.to, give: trade.give, get: trade.get, cash: trade.cash });
  return recordMove(next, { type: "trade-done", person });
}

/* the other side says no, or the proposer takes the offer back */
function declineTrade(state, person) {
  const trade = state.trade;
  if (!trade || (trade.to !== person && trade.from !== person)) throw new Error("Für dich liegt kein Angebot vor.");
  const next = begin(state);
  next.trade = null;
  event(next, { type: "trade-no", person, from: trade.from, to: trade.to });
  return recordMove(next, { type: "trade-no", person });
}

/* the cards of both decks plus the ones held by players must stay 12 + 12 */
function countCards(state) {
  const held = state.players.reduce((n, p) => n + state.jailCards[p].length, 0);
  return state.chance.length + state.chest.length + held;
}

return {
  MAX_PLAYERS,
  START_CASH,
  GO_BONUS,
  JAIL_POS,
  JAIL_FINE,
  MAX_HOUSES,
  SHORT_TURNS_EACH,
  GROUPS,
  SQUARES,
  CHANCE,
  CHEST,
  isOwnable,
  groupSquares,
  alive,
  ownerOf,
  housesOn,
  ownedBy,
  ownsGroup,
  rentFor,
  netWorth,
  canBuild,
  canSell,
  canMortgage,
  canRedeem,
  isMortgaged,
  mortgageValue,
  redeemCost,
  assets,
  debtTotal,
  countCards,
  tradable,
  tradeProblem,
  proposeTrade,
  acceptTrade,
  declineTrade,
  createInitialState,
  roll,
  buy,
  decline,
  build,
  sellHouse,
  mortgage,
  redeem,
  declareBankrupt,
  payJail,
  useJailCard,
  endTurn,
  newGame
};

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MonopolyEngine;
}
if (typeof window !== "undefined") {
  window.MonopolyEngine = MonopolyEngine;
}
