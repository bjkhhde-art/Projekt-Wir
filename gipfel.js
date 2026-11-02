/* Phasenjagd for 2–4 players. Lobby, invites, bots, moves and live sync come from game-room.js,
   the flying cards from game-anim.js – the same animations as in Cabo and Flip 7. */
const G = GipfelEngine;

const boardEl = document.getElementById("gsBoard");
const scoreEl = document.getElementById("gsScore");
const oppsEl = document.getElementById("gsOpps");
const ownEl = document.getElementById("gsOwn");
const deckEl = document.getElementById("gsDeck");
const discardEl = document.getElementById("gsDiscard");
const eventEl = document.getElementById("gsEvent");
const statusEl = document.getElementById("gsStatus");
const actionsEl = document.getElementById("gsActions");

const STEP_MS = 280;
const DEAL_STEP_MS = 70;
const FLY_MS = 460;
const SORT_KEY = "gs_sort";

let lastAnimatedMove = { gameId: null, seq: null };
let currentState = null;
let cheeredGame = null;
const selected = new Set();
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

function showRulesList(etappen, handSize) {
  document.getElementById("gsRulesHand").textContent = String(handSize);
  document.getElementById("gsRulesCount").textContent = String(etappen.length);
  document.getElementById("gsRulesList").innerHTML = etappen.map(e =>
    `<li><strong>${escapeHtml(e.name)}</strong> <span>${e.groups.map(g => escapeHtml(G.groupLabel(g))).join(" + ")}</span></li>`).join("");
}
showRulesList(G.ETAPPEN, G.HAND_SIZE);

/* the Phasen for new games come from phasen.json (editable on GitHub); if it is missing or broken, the defaults stay */
fetch("phasen.json", { cache: "no-cache" })
  .then(response => (response.ok ? response.json() : Promise.reject(new Error(`phasen.json: ${response.status}`))))
  .then(json => {
    const rules = G.parseRules(json);
    G.useRules(rules);
    if (!currentState) showRulesList(rules.etappen, rules.handSize);
  })
  .catch(error => {
    console.warn("phasen.json wird nicht benutzt:", error.message);
    if (error instanceof SyntaxError || !/^phasen\.json: /.test(error.message)) showToast(`phasen.json: ${error.message}`, "error");
  });

const room = GameRoom.create({
  table: "gipfel_games",
  bot: GameBots.gipfel,
  title: "Phase 10",
  icon: "🎯",
  url: "gipfel.html",
  lobbyEl: document.getElementById("gsLobby"),
  boardEl,
  leaveBtn: document.getElementById("gsLeaveBtn"),
  createState: players => G.createInitialState(players),
  isFinished: state => state.phase === "finished",
  renderBoard
});

const me = () => room.person;
const nameFor = person => (person === me() ? "Du" : person);
const seated = state => state.players.includes(me());

/* ---------- cards ---------- */

/* every card is a picture in phase-cards/ – replace a file there (same name) to change how a card looks */
const CARD_DIR = "phase-cards";
const COLOUR_FILES = { r: "rot", v: "blau", m: "gruen", g: "gelb" };

function cardImage(card) {
  if (G.isJoker(card)) return `${CARD_DIR}/joker.png`;
  if (G.isStone(card)) return `${CARD_DIR}/aussetzen.png`;
  return `${CARD_DIR}/${COLOUR_FILES[G.colourOf(card)]}-${G.valueOf(card)}.png`;
}

function pictureCard(className, src, label, width) {
  const el = document.createElement("div");
  el.className = `gs-card gs-img ${className}`;
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.draggable = false;
  el.appendChild(img);
  el.setAttribute("aria-label", label);
  if (width) el.style.setProperty("--w", `${width}px`);
  return el;
}

function cardEl(card, width) {
  const kind = G.isJoker(card) ? "gs-joker" : G.isStone(card) ? "gs-stone" : `gs-c-${G.colourOf(card)}`;
  const el = pictureCard(kind, cardImage(card), G.cardLabel(card), width);
  el.dataset.card = card;
  return el;
}

function backEl(width) {
  return pictureCard("gs-back", `${CARD_DIR}/rueckseite.png`, "Verdeckte Karte", width);
}

/* every visible card has a key, so a flying copy can land exactly on it */
const cardKey = card => `gs-${card}`;
const backKey = (person, index) => `gs-back-${person}-${index}`;

function sortedHand(hand) {
  const rank = card => (G.isJoker(card) ? 100 : G.isStone(card) ? 200 : 0);
  const colourIndex = card => G.COLOURS.indexOf(G.colourOf(card));
  return hand.slice().sort((a, b) => rank(a) - rank(b)
    || (sortBy === "colour" ? colourIndex(a) - colourIndex(b) || G.valueOf(a) - G.valueOf(b) : G.valueOf(a) - G.valueOf(b) || colourIndex(a) - colourIndex(b))
    || a.localeCompare(b));
}

function groupTitle(group) {
  const end = group.start + group.cards.length - 1;
  if (group.kind === "set") return `${group.cards.length}× ${group.value}`;
  if (group.kind === "color") return `${group.cards.length}× ${G.COLOUR_NAMES[group.colour]}`;
  if (group.kind === "run") return `Reihe ${group.start}–${end}`;
  return `${G.COLOUR_NAMES[group.colour]} ${group.start}–${end}`;
}

/* ---------- what I may do right now ---------- */

function myTurn(state) {
  return state.phase === "play" && state.turnPerson === me();
}

function canAct(state) {
  return myTurn(state) && state.step === "act";
}

/* cards can be picked at any time of the round – also while others play, to plan ahead */
function canPick(state) {
  return state.phase === "play" && seated(state);
}

function pruneSelection(state) {
  if (!canPick(state)) {
    selected.clear();
    return;
  }
  const hand = state.hands[me()];
  [...selected].forEach(card => { if (!hand.includes(card)) selected.delete(card); });
}

function toggleCard(card) {
  if (!currentState || !canPick(currentState)) return;
  if (selected.has(card)) selected.delete(card);
  else selected.add(card);
  renderLocal();
}

/* a tap that only changes the selection: redraw without any animation */
function renderLocal() {
  if (!currentState) return;
  renderPiles(currentState);
  renderSeats(currentState);
  renderControls(currentState);
}

/* the card I just drew is marked in my hand until my turn is over */
function freshCard(state) {
  if (!canAct(state) || !state.lastMove) return null;
  const draw = (state.lastMove.events || []).find(e => e.type === "draw" && e.person === me());
  return draw ? draw.card : null;
}

/* ---------- board ---------- */

function renderBoard(game) {
  const state = game.state;
  const move = takeUnseenMove(game);
  const before = move ? snapshot() : null;
  if (move) hideLandingCards(move, state);

  currentState = state;
  showRulesList(G.etappenOf(state), G.handSizeOf(state));
  pruneSelection(state);
  boardEl.classList.toggle("gs-crowd", state.players.length >= 3);
  boardEl.classList.toggle("gs-over", state.phase !== "play");
  renderScore(state);
  renderPiles(state);
  renderSeats(state);
  renderEvents(state);
  renderControls(state);

  if (move) animateMove(move, state, before);
}

function renderScore(state) {
  /* Phase and points of each player stand in their own row – up here only the round and the wins */
  const wins = state.players.some(p => state.wins[p] > 0)
    ? `<span class="gs-chip">Siege: ${state.players.map(p => `${escapeHtml(nameFor(p))} ${state.wins[p] || 0}`).join(" · ")}</span>`
    : "";
  scoreEl.innerHTML = `<span class="gs-chip">Runde <strong>${state.round}</strong></span>${wins}`;
}

function renderPiles(state) {
  const drawing = myTurn(state) && state.step === "draw";
  deckEl.innerHTML = "";
  deckEl.classList.toggle("has-cards", state.deck.length > 1);
  if (state.deck.length > 0 || state.discard.length > 1) deckEl.appendChild(backEl());
  /* no text under the piles – the number of cards is only told to screen readers */
  deckEl.setAttribute("aria-label", `Nachziehstapel, ${state.deck.length} Karten`);
  deckEl.classList.toggle("can-draw", drawing);
  deckEl.disabled = !drawing;

  discardEl.innerHTML = "";
  const top = state.discard[state.discard.length - 1];
  discardEl.classList.toggle("has-cards", state.discard.length > 1);
  if (top) {
    const card = cardEl(top);
    GameAnim.tag(card, cardKey(top));
    discardEl.appendChild(card);
  }
  const takeable = drawing && top && !G.isStone(top);
  const dropping = canAct(state) && selected.size > 0;
  discardEl.classList.toggle("can-draw", Boolean(takeable));
  discardEl.classList.toggle("can-drop", dropping);
  discardEl.disabled = !(takeable || dropping);
}

/* drawing: a tap on the deck or on the open card */
deckEl.addEventListener("click", () => {
  if (currentState && myTurn(currentState) && currentState.step === "draw") room.dispatch(G.drawDeck);
});

/* the open card: take it (drawing) – or throw the chosen card onto it (end of the turn) */
discardEl.addEventListener("click", () => {
  if (!currentState) return;
  if (myTurn(currentState) && currentState.step === "draw") {
    room.dispatch(G.drawDiscard);
    return;
  }
  if (!canAct(currentState) || !selected.size) return;
  if (selected.size > 1) {
    showToast("Zum Abwerfen genau eine Karte wählen.", "error");
    GameAnim.shake(discardEl);
    return;
  }
  const [card] = selected;
  selected.clear();
  room.dispatch(G.discard, card);
});

function etappeText(state, person) {
  const list = G.etappenOf(state);
  const index = Math.min(state.etappe[person], list.length - 1);
  return `Phase ${index + 1}: ${list[index].name}`;
}

function badgeFor(state, person) {
  if (state.phase !== "play") {
    if (state.lastRound && state.lastRound.out === person) return ["out", "Karten los 🏁"];
    return state.lastRound && state.lastRound.climbed[person] ? ["laid", "geschafft ✓"] : ["", "bleibt"];
  }
  if (state.turnPerson === person) return ["turn", "am Zug"];
  if (state.skip[person]) return ["skip", "setzt aus ⛔"];
  if (state.laid[person]) return ["laid", "liegt aus ✓"];
  return ["", ""];
}

function groupsEl(state, person, small) {
  const row = document.createElement("div");
  row.className = "gs-groups";
  const pick = canAct(state) && selected.size === 1 ? [...selected][0] : null;
  state.groups.filter(group => group.owner === person).forEach(group => {
    const box = document.createElement("div");
    box.className = "gs-group";
    box.dataset.group = group.id;
    /* every group can be tapped – whether the card fits is only checked then, the game gives no hints */
    if (pick) {
      box.classList.add("target");
      box.setAttribute("role", "button");
      box.tabIndex = 0;
      box.setAttribute("aria-label", `${G.cardLabel(pick)} an ${groupTitle(group)} anlegen`);
      const add = () => {
        if (!state.laid[me()]) {
          showToast("Anlegen geht erst, wenn deine eigene Phase ausliegt.", "error");
          GameAnim.shake(box);
          return;
        }
        if (!G.extendGroup(group, pick)) {
          showToast(`${G.cardLabel(pick)} passt nicht an ${groupTitle(group)}.`, "error");
          GameAnim.shake(box);
          return;
        }
        room.dispatch(G.addToGroup, pick, group.id);
      };
      box.addEventListener("click", add);
      box.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(); } });
    }
    const title = document.createElement("span");
    title.className = "gs-group-title";
    title.textContent = groupTitle(group);
    const cards = document.createElement("div");
    cards.className = "gs-group-cards";
    group.cards.forEach(card => {
      const el = cardEl(card, small ? 21 : 28);
      GameAnim.tag(el, cardKey(card));
      cards.appendChild(el);
    });
    box.append(title, cards);
    row.appendChild(box);
  });
  return row;
}

function fillOpponent(el, state, person) {
  const [badgeClass, badgeText] = badgeFor(state, person);
  el.className = `gs-seat gs-opp${badgeClass === "turn" ? " turn" : ""}`;
  const hand = state.hands[person];
  el.innerHTML = `
    <div class="gs-seat-head">
      <span class="gs-seat-name">${escapeHtml(person)}</span>
      ${badgeText ? `<span class="gs-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
      <span class="gs-seat-etappe">${escapeHtml(etappeText(state, person))} · ${state.scores[person]} Pkt.</span>
    </div>
    <div class="gs-opp-row"><div class="gs-opp-hand" data-zone="hand-${escapeHtml(person)}"></div></div>`;
  const handEl = el.querySelector(".gs-opp-hand");
  if (state.phase === "play") {
    hand.forEach((_, i) => {
      const back = backEl(18);
      GameAnim.tag(back, backKey(person, i));
      handEl.appendChild(back);
    });
    const count = document.createElement("span");
    count.className = "gs-hand-count";
    count.textContent = String(hand.length);
    handEl.appendChild(count);
  } else {
    /* after the round everybody shows what is left */
    sortedHand(hand).forEach(card => {
      const face = cardEl(card, 18);
      GameAnim.tag(face, cardKey(card));
      handEl.appendChild(face);
    });
    const count = document.createElement("span");
    count.className = "gs-hand-count";
    count.textContent = hand.length ? `${state.lastRound ? state.lastRound.points[person] : 0} Pkt.` : "🏁";
    handEl.appendChild(count);
  }
  const groups = groupsEl(state, person, true);
  if (groups.children.length) el.querySelector(".gs-opp-row").appendChild(groups);
}

function fillOwn(state) {
  const person = me();
  const [badgeClass, badgeText] = badgeFor(state, person);
  ownEl.className = `gs-seat gs-own${badgeClass === "turn" ? " turn" : ""}`;
  const list = G.etappenOf(state);
  const index = Math.min(state.etappe[person], list.length - 1);
  const etappe = list[index];
  const laid = state.laid[person];
  ownEl.innerHTML = `
    <div class="gs-seat-head">
      <span class="gs-seat-name">Du</span>
      ${badgeText ? `<span class="gs-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
      <span class="gs-seat-etappe">Phase ${index + 1}: ${escapeHtml(etappe.name)} · ${state.scores[person]} Pkt.</span>
      <button type="button" class="gs-sort" id="gsSort" aria-label="Hand sortieren">${sortBy === "colour" ? "Farbe" : "Zahl"} ⇅</button>
    </div>`;
  ownEl.querySelector("#gsSort").addEventListener("click", () => {
    sortBy = sortBy === "colour" ? "value" : "colour";
    storeSort(sortBy);
    renderLocal();
  });
  ownEl.appendChild(layZoneEl(state, etappe, laid));

  const handEl = document.createElement("div");
  handEl.className = "gs-hand";
  handEl.dataset.zone = `hand-${person}`;
  const active = canPick(state);
  const fresh = freshCard(state);
  sortedHand(state.hands[person]).forEach(card => {
    const el = cardEl(card);
    GameAnim.tag(el, cardKey(card));
    if (card === fresh) el.classList.add("fresh");
    if (active) {
      el.classList.add("pickable");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.setAttribute("aria-pressed", String(selected.has(card)));
      el.addEventListener("click", () => toggleCard(card));
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCard(card); } });
    }
    if (selected.has(card)) el.classList.add("selected");
    handEl.appendChild(el);
  });
  if (!handEl.children.length) handEl.innerHTML = `<span class="gs-empty">keine Karten mehr 🏁</span>`;
  ownEl.appendChild(handEl);
  fitHand(handEl);
}

/* the whole hand in one row: on a narrow phone the cards get a little smaller */
const HAND_CARD = 42;
const HAND_OVERLAP = 0.16;
function fitHand(handEl) {
  const count = handEl.querySelectorAll(".gs-card").length;
  const space = handEl.clientWidth;
  if (!count || !space) return;
  const width = Math.min(HAND_CARD, Math.floor(space / (count - (count - 1) * HAND_OVERLAP)));
  handEl.style.setProperty("--hand-w", `${width}px`);
}

/* my laying area: before my Phase is out, chosen cards are laid out by tapping it;
   afterwards my groups lie here (and, like everybody's groups, take single cards) */
function layZoneEl(state, etappe, laid) {
  const zone = document.createElement("div");
  zone.className = "gs-lay-zone";
  zone.id = "gsLayZone";
  if (laid || state.phase !== "play") {
    zone.classList.add("laid");
    const groups = groupsEl(state, me(), false);
    if (groups.children.length) zone.appendChild(groups);
    else zone.innerHTML = `<span class="gs-lay-hint">${escapeHtml(etappe.groups.map(G.groupLabel).join(" + "))}</span>`;
    return zone;
  }
  const ready = canAct(state) && selected.size > 0;
  zone.classList.toggle("open", ready);
  zone.innerHTML = `
    <span class="gs-lay-need">${etappe.groups.map(g => `<em>${escapeHtml(G.groupLabel(g))}</em>`).join(" + ")}</span>
    <span class="gs-lay-hint">${ready ? `Hier tippen: ${selected.size} ${selected.size === 1 ? "Karte" : "Karten"} als Phase auslegen` : "Ablagebereich für deine Phase"}</span>`;
  if (ready) {
    zone.setAttribute("role", "button");
    zone.tabIndex = 0;
    /* the selection stays if the cards do not make the Phase – after a move the played cards drop out of it by themselves */
    const lay = () => room.dispatch(G.layDown, [...selected]);
    zone.addEventListener("click", lay);
    zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lay(); } });
  }
  return zone;
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

function describe(e, state) {
  const who = nameFor(e.person);
  const mine = e.person === me();
  const label = card => G.cardLabel(card);
  switch (e.type) {
    case "draw":
      if (e.from === "discard") return mine ? `Du nimmst die offene ${label(e.card)}.` : `${who} nimmt die offene ${label(e.card)}.`;
      return mine ? `Du ziehst ${label(e.card)}.` : `${who} zieht vom Stapel.`;
    case "lay":
      return { big: true, text: mine ? `🎯 Du legst Phase ${e.etappe + 1} aus!` : `🎯 ${who} legt Phase ${e.etappe + 1} aus!` };
    case "add": {
      const where = e.owner === e.person ? (mine ? "bei dir" : "bei sich") : e.owner === me() ? "bei dir" : `bei ${e.owner}`;
      return `${mine ? "Du legst" : `${who} legt`} ${label(e.card)} ${where} an.`;
    }
    case "discard":
      return `${mine ? "Du wirfst" : `${who} wirft`} ${label(e.card)} ab.`;
    case "stone":
      return `⛔ Aussetzen! ${e.target === me() ? "Du setzt" : `${e.target} setzt`} einmal aus.`;
    case "skip":
      return mine ? "⛔ Du setzt diese Runde aus." : `⛔ ${who} setzt aus.`;
    case "reshuffle":
      return "Der Ablagestapel wird neu gemischt.";
    case "deck-end":
      return { big: true, text: "🃏 Der Stapel ist zum dritten Mal leer – die Runde endet." };
    case "out":
      return { big: true, text: mine ? "🏁 Du hast keine Karten mehr!" : `🏁 ${who} hat keine Karten mehr!` };
    default:
      return null;
  }
}

function renderEvents(state) {
  const events = (state.lastMove && state.lastMove.events) || [];
  const lines = events.map(e => describe(e, state)).filter(Boolean).slice(-3);
  eventEl.innerHTML = lines.map(line => typeof line === "string"
    ? `<span>${escapeHtml(line)}</span>`
    : `<span class="big pop">${escapeHtml(line.text)}</span>`).join("");
}

/* ---------- status line and buttons ---------- */

function renderControls(state) {
  actionsEl.innerHTML = "";
  if (state.phase !== "play") {
    renderSummary(state);
    return;
  }
  const turn = state.turnPerson;
  if (turn !== me()) {
    const n = state.players.length;
    const nextUp = state.players[(state.players.indexOf(turn) + 1) % n] === me();
    statusEl.textContent = seated(state) && state.skip[me()]
      ? `${turn} ist dran – du setzt danach aus ⛔`
      : nextUp ? `${turn} ist dran – danach du.` : `${turn} ist dran …`;
    return;
  }
  if (state.step === "draw") {
    statusEl.textContent = "Du bist dran: Tippe auf den Stapel oder die offene Karte.";
    return;
  }
  const count = selected.size;
  if (!state.laid[me()]) {
    statusEl.textContent = count
      ? "Auf deinen Ablagebereich tippen – oder mit einer Karte auf die Ablage."
      : "Karten wählen: Phase auslegen oder eine Karte abwerfen.";
  } else {
    statusEl.textContent = count
      ? "Tippe auf eine Gruppe zum Anlegen – oder auf die Ablage zum Abwerfen."
      : "Karte wählen: anlegen oder abwerfen.";
  }
}

function renderSummary(state) {
  const finished = state.phase === "finished";
  const last = state.lastRound || { points: {}, climbed: {} };
  statusEl.textContent = finished ? describeWinners(state.result, me()) : `Runde ${last.round} ist vorbei`;
  const order = state.players.slice().sort((a, b) => state.etappe[b] - state.etappe[a] || state.scores[a] - state.scores[b]);
  const rows = order.map(p => {
    const climbed = last.climbed[p];
    const level = state.etappe[p] >= G.etappenOf(state).length ? "alle geschafft 🏆" : `Phase ${state.etappe[p] + 1}`;
    return `<tr><td>${escapeHtml(nameFor(p))}</td><td class="${climbed ? "plus" : "zero"}">${climbed ? "▲" : "–"} ${level}</td><td>+${last.points[p] || 0}</td><td>${state.scores[p]}</td></tr>`;
  }).join("");
  const box = document.createElement("div");
  box.className = "gs-summary";
  box.innerHTML = `
    <h3>${finished ? "Endstand 🏆" : `Nach Runde ${last.round}`}</h3>
    <table><thead><tr><th></th><th>Weiter mit</th><th>Runde</th><th>Pkt.</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="gs-next"></div>`;
  actionsEl.appendChild(box);
  room.renderReady(box.querySelector(".gs-next"), state, finished
    ? { label: "Neue Partie 🎯", nextFn: G.newGame }
    : { label: "Nächste Runde ▶", nextFn: G.nextRound });
  const cheerKey = `${state.gameNo}`;
  if (finished && state.result && state.result.winners.includes(me()) && cheeredGame !== cheerKey) {
    cheeredGame = cheerKey;
    celebrate(30);
  }
}

/* ---------- animations (like Cabo): cards fly between deck, hands, groups and the discard ---------- */

/* each move is animated once per device; after a reload only a fresh deal is replayed */
function takeUnseenMove(game) {
  const state = game.state;
  const sameGame = lastAnimatedMove.gameId === game.id;
  const unseen = !sameGame || (state.moveSeq || 0) > (lastAnimatedMove.seq || 0);
  if (unseen) lastAnimatedMove = { gameId: game.id, seq: state.moveSeq };
  const move = state.lastMove;
  if (!move || !unseen || !GameAnim.enabled()) return null;
  if (!sameGame && move.type !== "deal") return null;
  return move;
}

/* where every card was before this render – the start of its flight */
function snapshot() {
  const rects = {};
  document.querySelectorAll("#gsBoard [data-anim-key]").forEach(el => {
    const rect = GameAnim.rectOf(el);
    if (rect) rects[el.dataset.animKey] = rect;
  });
  const backs = {};
  seatEls.forEach((el, person) => {
    const all = el.querySelectorAll(".gs-opp-hand .gs-card");
    backs[person] = GameAnim.rectOf(all[all.length - 1]) || GameAnim.rectOf(el.querySelector(".gs-opp-hand"));
  });
  return { rects, backs };
}

const showsHand = (state, person) => person === me() && seated(state);

/* the key a card lands on: its own face, or for a hidden hand the back at that position */
function landings(move, state) {
  const dealt = {};
  return (move.events || []).map(e => {
    if (e.type === "deal") {
      dealt[e.person] = (dealt[e.person] || 0) + 1;
      return showsHand(state, e.person) || state.phase !== "play" ? cardKey(e.card) : backKey(e.person, dealt[e.person] - 1);
    }
    if (e.type === "draw") {
      return showsHand(state, e.person) || state.phase !== "play" ? cardKey(e.card) : backKey(e.person, state.hands[e.person].length - 1);
    }
    if (e.type === "flip" || e.type === "add" || e.type === "discard") return cardKey(e.card);
    if (e.type === "lay") return e.cards.map(cardKey);
    return null;
  });
}

function hideLandingCards(move, state) {
  landings(move, state).flat().filter(Boolean).forEach(key => GameAnim.hide(key));
}

function find(key) {
  return key ? document.querySelector(`[data-anim-key="${CSS.escape(key)}"]`) : null;
}

function animateMove(move, state, before) {
  const deck = GameAnim.rectOf(deckEl);
  const keys = landings(move, state);
  const jobs = [];
  let t = 0;

  if (move.type === "deal") {
    GameAnim.shuffle(deckEl, 0);
    t = 520;
  }

  const handRect = person => before.backs[person] || GameAnim.rectOf(seatEls.get(person));
  /* one card from `from` to the key, face up or down at either end */
  const flyCard = (card, key, from, startFaceUp, endFaceUp, delay, duration = FLY_MS) => {
    const target = find(key);
    const to = GameAnim.rectOf(target);
    const width = from ? from.width : 40;
    jobs.push(GameAnim.fly({
      from,
      to,
      front: cardEl(card, width),
      back: backEl(width),
      startFaceUp,
      endFaceUp,
      delay,
      duration
    }).then(() => GameAnim.reveal(key)));
  };

  (move.events || []).forEach((e, i) => {
    const key = keys[i];
    const open = showsHand(state, e.person);
    if (e.type === "deal") {
      flyCard(e.card, key, deck, false, open || state.phase !== "play", t, 420);
      t += DEAL_STEP_MS;
      return;
    }
    if (e.type === "flip") {
      flyCard(e.card, key, deck, false, true, t + 120);
      t += STEP_MS;
      return;
    }
    if (e.type === "reshuffle") {
      GameAnim.shuffle(deckEl, t);
      t += 560;
      return;
    }
    if (e.type === "draw") {
      const fromDiscard = e.from === "discard";
      const from = fromDiscard ? before.rects[cardKey(e.card)] || GameAnim.rectOf(discardEl) : deck;
      flyCard(e.card, key, from, fromDiscard, open || state.phase !== "play", t);
      t += STEP_MS;
      return;
    }
    if (e.type === "lay" || e.type === "add" || e.type === "discard") {
      const cards = e.type === "lay" ? e.cards : [e.card];
      const lift = e.type === "lay" ? 110 : 0;
      cards.forEach((card, k) => {
        const from = before.rects[cardKey(card)] || handRect(e.person);
        const wasOpen = Boolean(before.rects[cardKey(card)]);
        flyCard(card, Array.isArray(key) ? key[k] : key, from, wasOpen, true, t + k * lift);
      });
      t += STEP_MS + cards.length * lift;
      return;
    }
    if (e.type === "skip" || e.type === "stone") {
      const person = e.type === "stone" ? e.target : e.person;
      const seat = person === me() ? ownEl : seatEls.get(person);
      setTimeout(() => GameAnim.shake(seat), t);
      return;
    }
    if (e.type === "out" && e.person === me()) {
      setTimeout(() => celebrate(20), t + FLY_MS);
    }
  });

  /* safety net: never leave a card invisible if something interrupts an animation */
  const safety = setTimeout(GameAnim.revealAll, t + FLY_MS + 2500);
  Promise.all(jobs).then(() => clearTimeout(safety));
}

room.start();
