/* Murphys Gesetz for 2–4 players. Lobby, invites, bots, moves and live sync come from game-room.js.
   The Murphy and action cards come from murphy-karten.json, their pictures from murphy-karten/. */
const M = MurphyEngine;

const boardEl = document.getElementById("mgBoard");
const scoreEl = document.getElementById("mgScore");
const oppsEl = document.getElementById("mgOpps");
const ownEl = document.getElementById("mgOwn");
const deckEl = document.getElementById("mgDeck");
const deckCount = document.getElementById("mgDeckCount");
const pileEls = [document.getElementById("mgPile0"), document.getElementById("mgPile1")];
const pileCounts = [document.getElementById("mgPile0Count"), document.getElementById("mgPile1Count")];
const actionPileEl = document.getElementById("mgActionPile");
const basarEl = document.getElementById("mgBasar");
const basarCount = document.getElementById("mgBasarCount");
const eventEl = document.getElementById("mgEvent");
const statusEl = document.getElementById("mgStatus");
const actionsEl = document.getElementById("mgActions");

const CARD_DIR = "murphy-karten";
const COLOUR_FILES = { b: "blau", y: "gelb", g: "gruen" };
/* the sign of each colour's frame on the real cards: triangles, squares, circles */
const COLOUR_SHAPES = { b: "▲", g: "■", y: "●" };
const SORT_KEY = "mg_sort";

let currentState = null;
let cheeredGame = null;
let lastSeq = null;
/* what is chosen to take: the open piles (per pile 0–2 of its top cards) or Mac (state.basar).
   The hidden deck is not chosen: a tap draws a card straight away. */
let pileSel = [0, 0];
let target = null;
const selected = new Set();
const basarSel = new Set();
let sortBy = readSort();
const seatEls = new Map();

function readSort() {
  try {
    return localStorage.getItem(SORT_KEY) === "colour" ? "colour" : "value";
  } catch (error) {
    return "value";
  }
}

function storeSort(value) {
  try {
    localStorage.setItem(SORT_KEY, value);
  } catch (error) {
    /* then only for this visit */
  }
}

const room = GameRoom.create({
  table: "murphy_games",
  bot: GameBots.murphy,
  title: "Murphys Gesetz",
  icon: "🍞",
  url: "murphy.html",
  lobbyEl: document.getElementById("mgLobby"),
  boardEl,
  leaveBtn: document.getElementById("mgLeaveBtn"),
  createState: (players, option) => M.createInitialState(players, Math.random, null, option),
  /* when is the game over: who first has this many fulfilled Murphy cards */
  startOptions: [1, 2, 3, 4, 5].map(n => ({
    value: String(n),
    label: n === 1 ? "1 Murphy-Karte" : `${n} Murphy-Karten`,
    hint: n === 1 ? "Wer die erste erfüllt, gewinnt" : n === 3 ? `Wer zuerst ${n} erfüllt, gewinnt – wie in der Anleitung` : `Wer zuerst ${n} erfüllt, gewinnt`
  })),
  initialOption: "3",
  isFinished: state => state.phase === "finished",
  renderBoard
});

const me = () => room.person;
const nameFor = person => (person === me() ? "Du" : person);
const seated = state => state.players.includes(me());

/* the rules list: every Murphy card that is in the game */
function showRulesList(rules) {
  document.getElementById("mgRulesWin").textContent = String(rules.winCards);
  document.getElementById("mgRulesList").innerHTML = rules.murphy.map(m => `<li>${escapeHtml(m.text)}</li>`).join("");
}

/* the cards for new games come from murphy-karten.json (editable on GitHub); the game starts once they are there */
fetch("murphy-karten.json", { cache: "no-cache" })
  .then(response => (response.ok ? response.json() : Promise.reject(new Error(`murphy-karten.json: ${response.status}`))))
  .then(json => {
    const rules = M.parseCards(json);
    M.useRules(rules);
    if (!currentState) showRulesList(rules);
  })
  .catch(error => {
    console.warn("murphy-karten.json wird nicht benutzt:", error.message);
    showToast(`murphy-karten.json: ${error.message}`, "error");
  })
  .finally(() => room.start());

/* ---------- cards ---------- */

function imageEl(src) {
  const img = document.createElement("img");
  img.src = `${CARD_DIR}/${src}`;
  img.alt = "";
  img.draggable = false;
  /* a picture that is not uploaded yet: the drawn card underneath stays visible */
  img.addEventListener("error", () => {
    if (img.parentElement) img.parentElement.classList.remove("has-img");
    img.remove();
  });
  return img;
}

function cardEl(card, state, width) {
  const el = document.createElement("div");
  if (width) el.style.setProperty("--w", `${width}px`);
  el.dataset.card = card;
  if (M.isNumber(card)) {
    const colour = M.colourOf(card);
    const value = M.valueOf(card);
    el.className = `mg-card mg-c-${colour}`;
    el.innerHTML = `<span class="mg-shape" aria-hidden="true">${COLOUR_SHAPES[colour]}</span><span class="mg-v">${value}</span>`;
    el.setAttribute("aria-label", M.cardLabel(card));
    if (state.rules.numberImages) {
      el.classList.add("has-img");
      el.appendChild(imageEl(`${COLOUR_FILES[colour]}-${value}.webp`));
    }
    return el;
  }
  const action = M.actionOf(state, card);
  el.className = `mg-card mg-act mg-act-${action ? action.colour : "blau"}`;
  el.innerHTML = `<span class="mg-act-icon">${action && action.colour === "gruen" ? "🍀" : "⚡"}</span><span class="mg-act-title">${escapeHtml(action ? action.title : "Aktion")}</span>`;
  el.setAttribute("aria-label", `${action && action.colour === "gruen" ? "Grüne" : "Blaue"} Aktionskarte ${action ? action.title : ""}`);
  if (action && action.text) el.title = action.text;
  if (action && action.image) {
    el.classList.add("has-img");
    el.appendChild(imageEl(action.image));
  }
  return el;
}

function backEl(state, width) {
  const el = document.createElement("div");
  el.className = "mg-card mg-back";
  if (width) el.style.setProperty("--w", `${width}px`);
  el.innerHTML = `<span class="mg-v">🍞</span>`;
  el.setAttribute("aria-label", "Verdeckte Karte");
  if (state.rules.backImage) {
    el.classList.add("has-img");
    el.appendChild(imageEl(state.rules.backImage));
  }
  return el;
}

function murphyEl(state, id, small) {
  const card = M.murphyOf(state, id);
  const el = document.createElement("div");
  el.className = `mg-murphy${small ? " small" : ""}`;
  if (!card) {
    el.classList.add("empty");
    el.textContent = "keine Murphy-Karte";
    return el;
  }
  el.innerHTML = `<span class="mg-murphy-head">Murphy-Karte</span><span class="mg-murphy-text">${escapeHtml(card.text)}</span>`;
  if (card.image) el.appendChild(imageEl(card.image));
  return el;
}

function sortedHand(state, hand) {
  const rank = card => (M.isNumber(card) ? 0 : M.isGreen(state, card) ? 1 : 2);
  const colourIndex = card => M.COLOURS.indexOf(M.colourOf(card));
  return hand.slice().sort((a, b) => rank(a) - rank(b)
    || (sortBy === "colour" ? colourIndex(a) - colourIndex(b) || M.valueOf(a) - M.valueOf(b) : M.valueOf(a) - M.valueOf(b) || colourIndex(a) - colourIndex(b))
    || a.localeCompare(b));
}

/* ---------- what I may do right now ---------- */

const myTurn = state => state.phase === "play" && state.turnPerson === me();
const taking = state => myTurn(state) && state.step === "take";
const giving = state => myTurn(state) && state.step === "give";
const selectedNumbers = () => [...selected].filter(M.isNumber);
const selectedGreen = state => [...selected].filter(c => M.isGreen(state, c));

function pruneSelection(state) {
  if (state.phase !== "play" || !seated(state)) {
    selected.clear();
    basarSel.clear();
    return;
  }
  const hand = state.hands[me()];
  [...selected].forEach(card => { if (!hand.includes(card)) selected.delete(card); });
  [...basarSel].forEach(card => { if (!state.basar.includes(card) || !taking(state)) basarSel.delete(card); });
  if (!taking(state)) clearTakeSel();
  pileSel = pileSel.map((n, i) => Math.min(n, state.piles[i].length));
  if (target && (!state.players.includes(target) || target === me())) target = null;
}

function clearTakeSel() {
  pileSel = [0, 0];
}

/* one card drawn from the deck: a second tap on the deck draws another */
const canDrawMore = state => giving(state) && state.trade.from === "deck" && state.trade.taken === 1;

/* what the chosen cards on the table add up to, as a move for MurphyEngine.trade – or null */
function takeChoice() {
  if (basarSel.size) return { from: "basar", cards: [...basarSel] };
  if (pileSel[0] === 1 && pileSel[1] === 1) return { from: "both" };
  const i = pileSel.findIndex(n => n > 0);
  return i >= 0 ? { from: "pile", pile: i, count: pileSel[i] } : null;
}

const takeCountOf = take => (!take ? 0 : take.from === "basar" ? take.cards.length : take.from === "both" ? 2 : take.count);

/* one taken and two of mine chosen, or two and one: the trade happens right away */
function tryTrade() {
  const state = currentState;
  if (!state || !taking(state) || selectedGreen(state).length) {
    renderLocal();
    return;
  }
  const take = takeChoice();
  const count = takeCountOf(take);
  const give = selectedNumbers();
  /* with Mac the cards go back to Mac; at the table the player chooses the pile (buttons in renderTake) */
  if ((count === 1 || count === 2) && give.length === 3 - count && take.from === "basar") {
    renderLocal();
    room.dispatch(M.trade, take, give);
    return;
  }
  renderLocal();
}

/* a tap that only changes the selection: redraw without anything else */
function renderLocal() {
  if (!currentState) return;
  renderTable(currentState);
  renderSeats(currentState);
  renderControls(currentState);
}

/* the cards I just got are marked in my hand until my next move */
function freshCards(state) {
  if (!state.lastMove || !seated(state)) return new Set();
  const mine = (state.lastMove.events || []).filter(e => e.person === me() && (e.type === "take" || e.type === "draw" || e.type === "stolen"));
  const got = new Set(mine.flatMap(e => e.cards || []));
  (state.lastMove.events || []).forEach(e => {
    if ((e.type === "gift" && e.target === me())) e.cards.forEach(c => got.add(c));
  });
  return got;
}

/* ---------- board ---------- */

function renderBoard(game) {
  const state = game.state;
  const fresh = state.lastMove && state.lastMove.seq !== lastSeq;
  lastSeq = state.lastMove ? state.lastMove.seq : null;
  currentState = state;
  if (fresh) {
    basarSel.clear();
    clearTakeSel();
    if (!giving(state)) selected.clear();
  }
  showRulesList(state.rules);
  pruneSelection(state);
  boardEl.classList.toggle("mg-crowd", state.players.length >= 3);
  boardEl.classList.toggle("mg-over", state.phase !== "play");
  renderScore(state);
  renderTable(state);
  renderSeats(state);
  renderEvents(state);
  renderControls(state);
  if (fresh) shakeHit(state);
}

function renderScore(state) {
  const chips = state.players.map(p => {
    const won = state.won[p].length;
    return `<span class="mg-chip${p === me() ? " me" : ""}">${escapeHtml(nameFor(p))} <strong>${"🍞".repeat(won) || "–"}</strong><small>${won}/${state.rules.winCards}</small></span>`;
  }).join("");
  const wins = state.players.some(p => state.wins[p] > 0)
    ? `<span class="mg-chip">Siege: ${state.players.map(p => `${escapeHtml(nameFor(p))} ${state.wins[p] || 0}`).join(" · ")}</span>`
    : "";
  scoreEl.innerHTML = `<span class="mg-chip">Runde <strong>${state.round}</strong></span>${chips}${wins}`;
}

function renderTable(state) {
  const take = taking(state);
  const atStack = giving(state) && state.trade.at === "stapel";
  deckEl.innerHTML = "";
  if (state.deck.length) deckEl.appendChild(backEl(state));
  deckCount.textContent = `${state.deck.length} Karten`;
  deckEl.classList.toggle("has-cards", state.deck.length > 1);
  const more = canDrawMore(state);
  deckEl.classList.toggle("can-take", take || more);
  deckEl.disabled = !(take || more);

  state.piles.forEach((pile, i) => {
    const el = pileEls[i];
    el.innerHTML = "";
    const top = pile[pile.length - 1];
    if (top) {
      const topEl = cardEl(top, state);
      if (pileSel[i] >= 1) topEl.classList.add("selected");
      el.appendChild(topEl);
    }
    if (pile.length > 1) {
      const under = cardEl(pile[pile.length - 2], state, 30);
      under.classList.add("mg-under");
      if (pileSel[i] === 2) under.classList.add("selected");
      el.appendChild(under);
    }
    el.classList.toggle("has-cards", pile.length > 1);
    pileCounts[i].textContent = `${i === 0 ? "links" : "rechts"} · ${pile.length}`;
    const canTake = take && pile.length > 0;
    const canDrop = atStack && selectedNumbers().length === state.trade.give;
    el.classList.toggle("can-take", canTake);
    el.classList.toggle("can-drop", canDrop);
    el.disabled = !(canTake || canDrop);
  });

  actionPileEl.innerHTML = "";
  const lastAction = state.actionPile[state.actionPile.length - 1];
  if (lastAction) actionPileEl.appendChild(cardEl(lastAction, state));

  basarEl.innerHTML = "";
  state.basar.forEach(card => {
    const el = cardEl(card, state);
    if (take) {
      el.classList.add("pickable");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-pressed", String(basarSel.has(card)));
      const green = selectedGreen(state)[0];
      const many = green && M.actionOf(state, green).effect === "nehmen" ? M.actionOf(state, green).amount : 2;
      const pick = () => {
        clearTakeSel();
        if (basarSel.has(card)) basarSel.delete(card);
        else {
          if (basarSel.size >= many) basarSel.delete(basarSel.values().next().value);
          basarSel.add(card);
        }
        tryTrade();
      };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    }
    if (basarSel.has(card)) el.classList.add("selected");
    basarEl.appendChild(el);
  });
  basarCount.textContent = `${state.basar.length} / ${M.BASAR_SIZE}`;
  basarEl.parentElement.classList.toggle("can-drop", giving(state) && state.trade.at === "basar");
}

/* the hidden deck: a tap draws one card, a second tap a second one – then the cards to give are chosen */
deckEl.addEventListener("click", () => {
  const state = currentState;
  if (!state) return;
  if (taking(state)) {
    basarSel.clear();
    pileSel = [0, 0];
    room.dispatch(M.takeDeck, 1);
  } else if (canDrawMore(state)) {
    room.dispatch(M.drawMore);
  }
});

/* an open pile: first tap its top card, second tap the top two, third tap none; with the other pile one each */
pileEls.forEach((el, i) => el.addEventListener("click", () => {
  const state = currentState;
  if (!state) return;
  if (taking(state)) {
    basarSel.clear();
    const other = 1 - i;
    if (pileSel[i] === 0) {
      if (pileSel[other] !== 1) pileSel[other] = 0;
      pileSel[i] = 1;
    } else if (pileSel[i] === 1 && pileSel[other] === 0 && state.piles[i].length >= 2) {
      pileSel[i] = 2;
    } else {
      pileSel[i] = 0;
    }
    tryTrade();
    return;
  }
  /* cards drawn from the deck and the cards to give chosen: a tap on a pile puts them there */
  if (giving(state) && state.trade.at === "stapel" && selectedNumbers().length === state.trade.give) {
    giveSelected(state, selectedNumbers().map(() => i));
  }
}));

function giveSelected(state, piles) {
  const cards = selectedNumbers();
  const need = state.trade.give;
  if (cards.length !== need) {
    showToast(need === 1 ? "Wähle genau eine Zahlenkarte." : "Wähle genau zwei Zahlenkarten.", "error");
    return;
  }
  room.dispatch(M.give, cards, piles);
}

function badgeFor(state, person) {
  if (state.phase !== "play") return state.lastRound && state.lastRound.winner === person ? ["won", "erfüllt 🍞"] : ["", ""];
  if (state.turnPerson === person) return ["turn", "am Zug"];
  if (state.skip[person]) return ["skip", "setzt aus ⛔"];
  return ["", ""];
}

function fillOpponent(el, state, person) {
  const [badgeClass, badgeText] = badgeFor(state, person);
  el.className = `mg-seat mg-opp${badgeClass === "turn" ? " turn" : ""}`;
  el.dataset.person = person;
  const hand = state.hands[person];
  el.innerHTML = `
    <div class="mg-seat-head">
      <span class="mg-seat-name">${escapeHtml(person)}</span>
      ${badgeText ? `<span class="mg-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
    </div>
    <div class="mg-opp-row"><div class="mg-opp-hand"></div></div>`;
  if (state.phase === "play" && state.murphyOpen && state.murphyOpen[person] && state.murphy[person]) {
    /* laid open with "Murphy offen" – everybody can read it */
    el.appendChild(murphyEl(state, state.murphy[person], true));
  }
  const handEl = el.querySelector(".mg-opp-hand");
  const reveal = state.phase !== "play" && state.lastRound && state.lastRound.winner === person;
  if (reveal) {
    sortedHand(state, hand).forEach(card => handEl.appendChild(cardEl(card, state, 22)));
  } else {
    const small = state.players.length >= 3;
    hand.forEach(() => handEl.appendChild(backEl(state, small ? 13 : 18)));
  }
}

function fillOwn(state) {
  const person = me();
  const [badgeClass, badgeText] = badgeFor(state, person);
  ownEl.className = `mg-seat mg-own${badgeClass === "turn" ? " turn" : ""}`;
  ownEl.innerHTML = `
    <div class="mg-seat-head">
      <span class="mg-seat-name">Du</span>
      ${badgeText ? `<span class="mg-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
      <button type="button" class="mg-sort" id="mgSort" aria-label="Hand sortieren">${sortBy === "colour" ? "Farbe" : "Zahl"} ⇅</button>
    </div>`;
  ownEl.querySelector("#mgSort").addEventListener("click", () => {
    sortBy = sortBy === "colour" ? "value" : "colour";
    storeSort(sortBy);
    renderLocal();
  });
  if (state.phase === "play") {
    const task = document.createElement("div");
    task.className = "mg-task";
    task.appendChild(murphyEl(state, state.murphy[person]));
    ownEl.appendChild(task);
  }

  const handEl = document.createElement("div");
  handEl.className = "mg-hand";
  const active = state.phase === "play";
  const fresh = freshCards(state);
  sortedHand(state, state.hands[person]).forEach(card => {
    const el = cardEl(card, state);
    if (fresh.has(card)) el.classList.add("fresh");
    /* cards just taken in this trade stay (house rule): they can't be picked for giving */
    const locked = giving(state) && (state.trade.cards || []).includes(card);
    if (locked) {
      el.classList.add("locked");
      el.title = "Gerade genommen – bleibt bei dir";
    }
    /* red action cards never stay in a hand; numbers and green ones can be picked */
    if (active && !locked) {
      el.classList.add("pickable");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-pressed", String(selected.has(card)));
      const pick = () => {
        if (M.isGreen(state, card)) selectedGreen(state).filter(c => c !== card).forEach(c => selected.delete(c));
        if (selected.has(card)) selected.delete(card);
        else selected.add(card);
        tryTrade();
      };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    }
    if (selected.has(card)) el.classList.add("selected");
    handEl.appendChild(el);
  });
  ownEl.appendChild(handEl);
}

function renderSeats(state) {
  const others = room.others(state);
  const key = others.join("|");
  if (oppsEl.dataset.key !== key) {
    oppsEl.dataset.key = key;
    oppsEl.innerHTML = "";
    seatEls.clear();
    others.forEach(person => {
      const el = document.createElement("section");
      el.setAttribute("aria-label", `Karten von ${person}`);
      oppsEl.appendChild(el);
      seatEls.set(person, el);
    });
  }
  others.forEach(person => fillOpponent(seatEls.get(person), state, person));
  ownEl.hidden = !seated(state);
  if (seated(state)) fillOwn(state);
}

/* ---------- what just happened ---------- */

function cardsText(cards, state) {
  return cards.map(c => M.cardLabel(c, state)).join(", ");
}

function describe(e, state) {
  const who = nameFor(e.person);
  const mine = e.person === me();
  switch (e.type) {
    case "deal":
      return "Die Karten sind verteilt – jeder hat eine Murphy-Karte.";
    case "take": {
      if (e.from === "deck") return mine ? `Du ziehst ${e.count} vom Stapel${e.cards.length ? `: ${cardsText(e.cards, state)}` : ""}.` : `${who} zieht ${e.count} vom Stapel.`;
      const where = e.from === "basar" ? "von Mac" : e.from === "both" ? "von beiden offenen Stapeln" : `vom ${e.pile === 0 ? "linken" : "rechten"} Stapel`;
      return `${mine ? "Du nimmst" : `${who} nimmt`} ${cardsText(e.cards, state)} ${where}.`;
    }
    case "give":
      return `${mine ? "Du gibst" : `${who} gibt`} ${cardsText(e.cards, state)} ${e.at === "basar" ? "an Mac" : "ab"}.`;
    case "action": {
      const action = M.actionOf(state, e.card);
      const aim = e.target ? ` → ${nameFor(e.target)}` : "";
      return { big: true, text: `${e.red ? "⚡" : "🍀"} ${mine ? "Du" : who}: ${action ? action.title : "Aktion"}${aim}` };
    }
    case "choose-target":
      return mine ? `⚡ ${M.cardLabel(e.card, state)}: Wähle, wen sie trifft.` : `${who} wählt, wen ${M.cardLabel(e.card, state)} trifft …`;
    case "to-basar":
      return `${mine ? "Du legst" : `${who} legt`} ${cardsText(e.cards, state)} zu Mac.`;
    case "wish": {
      const [, colour, value] = /^([byg])(\d+)$/.exec(e.wish) || [];
      const wish = `${M.COLOUR_NAMES[colour] || ""} ${value || ""}`.trim();
      const from = e.target === me() ? "dir" : nameFor(e.target);
      return e.got
        ? `${mine ? "Du forderst" : `${who} fordert`} ${wish} von ${from} – ${e.target === me() ? "du hast" : "hat"} sie!`
        : { big: true, text: `${mine ? "Du forderst" : `${who} fordert`} ${wish} von ${from} – nicht da. Dumm gelaufen!` };
    }
    case "aside":
      return `${mine ? "Du ziehst" : `${who} zieht`} ${M.cardLabel(e.card, state)} – sie wirkt hier nicht und kommt weg.`;
    case "swap-green":
      return `${mine ? "Deine" : `${who}s`} ${M.cardLabel(e.card, state)} wird gegen eine neue Karte getauscht.`;
    case "draw":
      if (e.why === "refill") return `${mine ? "Du ziehst" : `${who} zieht`} nach, bis wieder eine Zahl auf der Hand ist.`;
      return mine ? `Du bekommst ${cardsText(e.cards, state)}.` : `${who} zieht ${e.cards.length === 1 ? "eine Karte" : `${e.cards.length} Karten`}.`;
    case "passed":
      return "Alle geben weiter.";
    case "stolen":
      return e.target === me() ? `${who} nimmt dir ${e.cards.length === 1 ? "eine Karte" : `${e.cards.length} Karten`} weg!` : mine ? `Du bekommst ${cardsText(e.cards, state)}.` : `${who} nimmt ${nameFor(e.target)} etwas weg.`;
    case "gift": {
      /* which cards changed hands is only seen by the two people involved */
      const seen = mine || e.target === me();
      const what = seen ? cardsText(e.cards, state) : e.cards.length === 1 ? "eine Karte" : `${e.cards.length} Karten`;
      return `${mine ? "Du gibst" : `${who} gibt`} ${e.target === me() ? "dir" : nameFor(e.target)} ${what}.`;
    }
    case "dropped":
      return `${mine ? "Du legst" : `${who} legt`} ${cardsText(e.cards, state)} ab.`;
    case "skip":
      return mine ? "⛔ Du setzt diesmal aus." : `⛔ ${who} setzt aus.`;
    case "reshuffle":
      return "Der Stapel wird neu gemischt.";
    case "murphy":
      return { big: true, text: mine ? "🍞 Du hast deine Murphy-Karte erfüllt!" : `🍞 ${who} hat die Murphy-Karte erfüllt – dumm gelaufen!` };
    case "new-murphy":
      return "Neue Runde – alle haben eine neue Murphy-Karte.";
    default:
      return null;
  }
}

function renderEvents(state) {
  const events = (state.lastMove && state.lastMove.events) || [];
  /* with three or four players only the last two lines, so the table fits on one screen */
  const lines = events.map(e => describe(e, state)).filter(Boolean).slice(state.players.length >= 3 ? -2 : -3);
  eventEl.innerHTML = lines.map(line => typeof line === "string"
    ? `<span>${escapeHtml(line)}</span>`
    : `<span class="big pop">${escapeHtml(line.text)}</span>`).join("");
}

function shakeHit(state) {
  const events = (state.lastMove && state.lastMove.events) || [];
  events.forEach(e => {
    const hit = e.type === "skip" ? e.person : e.type === "stolen" || (e.type === "action" && e.target) ? e.target : null;
    if (!hit) return;
    const seat = hit === me() ? ownEl : seatEls.get(hit);
    if (seat) {
      seat.classList.remove("mg-shake");
      void seat.offsetWidth;
      seat.classList.add("mg-shake");
    }
  });
  if (events.some(e => e.type === "murphy" && e.person === me())) celebrate(24);
}

/* ---------- status line and buttons ---------- */

function button(label, onClick, className = "") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `btn mg-btn ${className}`;
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

function renderControls(state) {
  actionsEl.innerHTML = "";
  if (state.phase !== "play") {
    renderSummary(state);
    return;
  }
  if (seated(state) && !M.murphyCheck(state, me()) && state.murphy[me()]) {
    /* a Murphy card the game cannot check: whoever fulfils it says so */
    actionsEl.appendChild(button("Murphy erfüllt! 🍞", () => room.dispatch(M.claimMurphy), "btn-secondary mg-claim"));
  }
  const turn = state.turnPerson;
  if (turn !== me()) {
    statusEl.textContent = seated(state) && state.skip[me()]
      ? `${turn} ist dran – du setzt danach aus ⛔`
      : M.nextOf(state, turn) === me() ? `${turn} ist dran – danach du.` : `${turn} ist dran …`;
    return;
  }
  if (state.step === "give") {
    renderGive(state);
    return;
  }
  if (state.step === "target") {
    renderTarget(state);
    return;
  }
  renderTake(state);
}

function renderTake(state) {
  const green = selectedGreen(state)[0];
  if (green) {
    renderGreen(state, green);
    return;
  }
  while (basarSel.size > 2) basarSel.delete(basarSel.values().next().value);
  const choice = takeChoice();
  const count = takeCountOf(choice);
  const mine = selectedNumbers().length;
  if (count && mine === 3 - count && choice.from !== "basar") {
    /* everything chosen at the table: where do my cards go? */
    statusEl.textContent = mine === 1 ? "Auf welchen offenen Stapel legst du deine Karte?" : "Wohin legst du deine zwei Karten?";
    const cards = selectedNumbers();
    const go = piles => room.dispatch(M.trade, choice, cards, piles);
    actionsEl.appendChild(button("⬅ Linker Stapel", () => go(cards.map(() => 0)), "mg-drop-left"));
    actionsEl.appendChild(button("Rechter Stapel ➡", () => go(cards.map(() => 1)), "mg-drop-right"));
    if (mine === 2) actionsEl.appendChild(button("Je eine auf beide", () => go([0, 1]), "btn-secondary mg-drop-both"));
    return;
  }
  statusEl.textContent = state.tradesLeft > 1 ? "Doppelt tauschen – der erste Tausch:" : "Du bist dran: Tausche 1 gegen 2 oder 2 gegen 1.";
}

/* a blue card drawn from the deck hits somebody – the one who drew it chooses who */
function renderTarget(state) {
  const card = state.pending && state.pending.card;
  const action = card ? M.actionOf(state, card) : null;
  statusEl.textContent = action ? `⚡ ${action.title}: ${action.text} Wen trifft es?` : "Wen trifft es?";
  const row = document.createElement("div");
  row.className = "mg-targets";
  state.players.filter(p => p !== me()).forEach(p => row.appendChild(button(p, () => room.dispatch(M.chooseTarget, p), "mg-target-pick")));
  actionsEl.appendChild(row);
}

const COLOUR_CHOICES = [["b", "Blau"], ["g", "Grün"], ["y", "Gelb"]];
let wishColour = "b";
let wishValue = 5;

function renderGreen(state, card) {
  const action = M.actionOf(state, card);
  const spec = M.EFFECTS[action.effect];
  statusEl.textContent = `🍀 ${action.title}: ${action.text}`;
  const box = document.createElement("div");
  box.className = "mg-green";
  const others = state.players.filter(p => p !== me());
  const play = opts => {
    if (spec.target && !target) {
      showToast("Wähle zuerst eine Person.", "error");
      return;
    }
    room.dispatch(M.playAction, card, { target, cards: selectedNumbers(), ...opts });
  };
  if (spec.target) {
    if (others.length === 1) target = others[0];
    const row = document.createElement("div");
    row.className = "mg-targets";
    others.forEach(p => {
      const el = button(p, () => { target = p; renderLocal(); }, `btn-secondary mg-target${target === p ? " on" : ""}`);
      el.setAttribute("aria-pressed", String(target === p));
      row.appendChild(el);
    });
    box.appendChild(row);
  }
  if (spec.choose) {
    const hint = document.createElement("p");
    hint.className = "mg-hint";
    hint.textContent = `${M.chooseRule(state, me(), action).text} Karten auf der Hand antippen (gewählt: ${selectedNumbers().length}).`;
    box.appendChild(hint);
  }
  if (spec.wish) {
    /* which card to ask for: colour and number */
    const row = document.createElement("div");
    row.className = "mg-wish";
    const colour = document.createElement("select");
    colour.className = "mg-wish-colour";
    colour.setAttribute("aria-label", "Farbe");
    colour.innerHTML = COLOUR_CHOICES.map(([v, l]) => `<option value="${v}"${v === wishColour ? " selected" : ""}>${l}</option>`).join("");
    colour.addEventListener("change", () => { wishColour = colour.value; });
    const value = document.createElement("select");
    value.className = "mg-wish-value";
    value.setAttribute("aria-label", "Zahl");
    value.innerHTML = Array.from({ length: M.MAX_VALUE }, (_, i) => `<option value="${i + 1}"${i + 1 === wishValue ? " selected" : ""}>${i + 1}</option>`).join("");
    value.addEventListener("change", () => { wishValue = Number(value.value); });
    row.append(colour, value);
    box.appendChild(row);
  }
  if (spec.source) {
    const hint = document.createElement("p");
    hint.className = "mg-hint";
    const need = Math.min(action.amount, state.basar.length);
    hint.textContent = `Für Mac ${need} Karten bei Mac antippen (gewählt: ${basarSel.size}).`;
    box.appendChild(hint);
    box.appendChild(button(`${action.amount} vom Stapel 🍀`, () => play({ source: "deck" }), "mg-play mg-play-deck"));
    box.appendChild(button("Von Mac 🍀", () => play({ source: "basar", cards: [...basarSel] }), "mg-play mg-play-basar"));
  } else if (spec.pile) {
    box.appendChild(button("Auf den linken Stapel 🍀", () => play({ pile: 0 }), "mg-play mg-play-left"));
    box.appendChild(button("Auf den rechten Stapel 🍀", () => play({ pile: 1 }), "mg-play mg-play-right"));
  } else {
    box.appendChild(button("Ausspielen 🍀", () => play(spec.wish ? { wish: `${wishColour}${wishValue}` } : {}), "mg-play"));
  }
  box.appendChild(button("Doch nicht", () => { selected.delete(card); basarSel.clear(); renderLocal(); }, "btn-secondary"));
  actionsEl.appendChild(box);
}

function renderGive(state) {
  const need = state.trade.give;
  const count = selectedNumbers().length;
  const where = state.trade.at === "basar" ? "an Mac" : "auf einen offenen Stapel";
  statusEl.textContent = `Jetzt ${need === 1 ? "eine Zahlenkarte" : "zwei Zahlenkarten"} ${where} abgeben (gewählt: ${count}).`;
  if (state.trade.at === "basar") {
    const el = button("An Mac geben", () => giveSelected(state, null), "mg-give");
    el.disabled = count !== need;
    actionsEl.appendChild(el);
    return;
  }
  if (count === need) {
    /* the cards to give are chosen: which open pile? */
    statusEl.textContent = need === 1 ? "Auf welchen offenen Stapel legst du die Karte?" : "Wohin legst du die zwei Karten?";
    const cards = selectedNumbers();
    actionsEl.appendChild(button("⬅ Linker Stapel", () => giveSelected(state, cards.map(() => 0)), "mg-drop-left"));
    actionsEl.appendChild(button("Rechter Stapel ➡", () => giveSelected(state, cards.map(() => 1)), "mg-drop-right"));
    if (need === 2) actionsEl.appendChild(button("Je eine auf beide", () => giveSelected(state, [0, 1]), "btn-secondary mg-drop-both"));
    return;
  }
}

function renderSummary(state) {
  const finished = state.phase === "finished";
  const last = state.lastRound;
  if (!last) return;
  const winnerName = nameFor(last.winner);
  statusEl.textContent = finished ? describeWinners(state.result, me()) : `${winnerName === "Du" ? "Du hast" : `${winnerName} hat`} die Murphy-Karte erfüllt!`;
  const box = document.createElement("div");
  box.className = "mg-summary";
  const card = M.murphyOf(state, last.card);
  const missed = Object.entries(last.missed || {}).filter(([, id]) => id).map(([p, id]) => {
    const m = M.murphyOf(state, id);
    return `<li><strong>${escapeHtml(nameFor(p))}</strong>: ${escapeHtml(m ? m.text : "")}</li>`;
  }).join("");
  box.innerHTML = `
    <h3>${finished ? "Endstand 🏆" : `Runde ${last.round}: Dumm gelaufen!`}</h3>
    <div class="mg-proof"></div>
    ${missed ? `<p class="mg-missed-title">Diese Aufgaben gehen zurück:</p><ul class="mg-missed">${missed}</ul>` : ""}
    <div class="mg-next"></div>`;
  const proof = box.querySelector(".mg-proof");
  proof.appendChild(murphyEl(state, last.card, true));
  const cards = document.createElement("div");
  cards.className = "mg-proof-cards";
  sortedHand(state, last.cards).filter(M.isNumber).forEach(c => cards.appendChild(cardEl(c, state, 30)));
  proof.appendChild(cards);
  if (!card) proof.hidden = true;
  actionsEl.appendChild(box);
  room.renderReady(box.querySelector(".mg-next"), state, finished
    ? { label: "Neue Partie 🍞", nextFn: M.newGame }
    : { label: "Nächste Runde ▶", nextFn: M.nextRound });
  const cheerKey = `${state.gameNo}`;
  if (finished && state.result && state.result.winner === me() && cheeredGame !== cheerKey) {
    cheeredGame = cheerKey;
    celebrate(30);
  }
}
