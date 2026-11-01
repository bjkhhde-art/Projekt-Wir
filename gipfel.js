/* Gipfelsturm for 2–4 players. Lobby, invites, bots, moves and live sync come from game-room.js,
   the flying cards from game-anim.js – the same animations as in Cabo and Flip 7. */
const G = GipfelEngine;

const boardEl = document.getElementById("gsBoard");
const scoreEl = document.getElementById("gsScore");
const oppsEl = document.getElementById("gsOpps");
const ownEl = document.getElementById("gsOwn");
const deckEl = document.getElementById("gsDeck");
const deckCount = document.getElementById("gsDeckCount");
const discardEl = document.getElementById("gsDiscard");
const eventEl = document.getElementById("gsEvent");
const statusEl = document.getElementById("gsStatus");
const actionsEl = document.getElementById("gsActions");

const STEP_MS = 280;
const DEAL_STEP_MS = 70;
const FLY_MS = 460;
const COLOUR_MARKS = { r: "♥", v: "◆", m: "●", g: "▲" };
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

document.getElementById("gsRulesList").innerHTML = G.ETAPPEN.map(e =>
  `<li><strong>${escapeHtml(e.name)}</strong> <span>${e.groups.map(g => escapeHtml(G.groupLabel(g))).join(" + ")}</span></li>`).join("");

const room = GameRoom.create({
  table: "gipfel_games",
  bot: GameBots.gipfel,
  title: "Gipfelsturm",
  icon: "⛰️",
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

function cardEl(card, width) {
  const el = document.createElement("div");
  if (G.isJoker(card)) {
    el.className = "gs-card gs-joker";
    el.innerHTML = `<span class="gs-v">⭐</span>`;
  } else if (G.isStone(card)) {
    el.className = "gs-card gs-stone";
    el.innerHTML = `<span class="gs-v">🪨</span>`;
  } else {
    const colour = G.colourOf(card);
    const value = G.valueOf(card);
    el.className = `gs-card gs-c-${colour}`;
    el.innerHTML = `<span class="gs-v">${value}</span><span class="gs-mark" aria-hidden="true">${COLOUR_MARKS[colour]}</span>`;
  }
  el.setAttribute("aria-label", G.cardLabel(card));
  el.dataset.card = card;
  if (width) el.style.setProperty("--w", `${width}px`);
  return el;
}

function backEl(width) {
  const el = document.createElement("div");
  el.className = "gs-card gs-back";
  el.innerHTML = `<span class="gs-v">⛰️</span>`;
  el.setAttribute("aria-label", "Verdeckte Karte");
  if (width) el.style.setProperty("--w", `${width}px`);
  return el;
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

function pruneSelection(state) {
  if (!seated(state) || !canAct(state)) {
    selected.clear();
    return;
  }
  const hand = state.hands[me()];
  [...selected].forEach(card => { if (!hand.includes(card)) selected.delete(card); });
}

function toggleCard(card) {
  if (!currentState || !canAct(currentState)) return;
  if (selected.has(card)) selected.delete(card);
  else selected.add(card);
  renderLocal();
}

/* a tap that only changes the selection: redraw without any animation */
function renderLocal() {
  if (!currentState) return;
  renderSeats(currentState);
  renderControls(currentState);
}

/* ---------- board ---------- */

function renderBoard(game) {
  const state = game.state;
  const move = takeUnseenMove(game);
  const before = move ? snapshot() : null;
  if (move) hideLandingCards(move, state);

  currentState = state;
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
  const top = Math.max(...state.players.map(p => state.etappe[p]));
  const chips = [me(), ...room.others(state)].filter(p => state.players.includes(p)).map(p => `
    <span class="gs-chip${p === me() ? " me" : ""}${top > 0 && state.etappe[p] === top ? " lead" : ""}">
      ${escapeHtml(nameFor(p))} <strong>${Math.min(state.etappe[p] + 1, G.ETAPPEN.length)}/${G.ETAPPEN.length}</strong> <small>${state.scores[p]} Pkt.</small>
    </span>`).join("");
  const wins = state.players.some(p => state.wins[p] > 0)
    ? `<span class="gs-chip">Gipfel: ${state.players.map(p => `${escapeHtml(nameFor(p))} ${state.wins[p] || 0}`).join(" · ")}</span>`
    : "";
  scoreEl.innerHTML = `${chips}<span class="gs-chip">Runde <strong>${state.round}</strong></span>${wins}`;
}

function renderPiles(state) {
  const drawing = myTurn(state) && state.step === "draw";
  deckEl.innerHTML = "";
  deckEl.classList.toggle("has-cards", state.deck.length > 1);
  if (state.deck.length > 0 || state.discard.length > 1) deckEl.appendChild(backEl());
  deckCount.textContent = `${state.deck.length} Karten`;
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
  const dropping = canAct(state) && selected.size === 1;
  discardEl.classList.toggle("can-draw", Boolean(takeable));
  discardEl.classList.toggle("can-drop", dropping);
  discardEl.disabled = !(takeable || dropping);
}

deckEl.addEventListener("click", () => {
  if (currentState && myTurn(currentState) && currentState.step === "draw") room.dispatch(G.drawDeck);
});

discardEl.addEventListener("click", () => {
  if (!currentState) return;
  if (myTurn(currentState) && currentState.step === "draw") room.dispatch(G.drawDiscard);
  else if (canAct(currentState) && selected.size === 1) dropSelected();
});

function dropSelected() {
  const [card] = selected;
  selected.clear();
  room.dispatch(G.discard, card);
}

function etappeText(state, person) {
  const index = Math.min(state.etappe[person], G.ETAPPEN.length - 1);
  return `Etappe ${index + 1}: ${G.ETAPPEN[index].name}`;
}

function badgeFor(state, person) {
  if (state.phase !== "play") {
    if (state.lastRound && state.lastRound.out === person) return ["out", "Karten los 🏁"];
    return state.lastRound && state.lastRound.climbed[person] ? ["laid", "geschafft ✓"] : ["", "bleibt"];
  }
  if (state.turnPerson === person) return ["turn", "am Zug"];
  if (state.skip[person]) return ["skip", "setzt aus 🪨"];
  if (state.laid[person]) return ["laid", "liegt aus ✓"];
  return ["", ""];
}

function groupsEl(state, person, small) {
  const row = document.createElement("div");
  row.className = "gs-groups";
  const pick = canAct(state) && state.laid[me()] && selected.size === 1 ? [...selected][0] : null;
  state.groups.filter(group => group.owner === person).forEach(group => {
    const box = document.createElement("div");
    box.className = "gs-group";
    box.dataset.group = group.id;
    const fits = pick && G.extendGroup(group, pick);
    if (fits) {
      box.classList.add("fits");
      box.setAttribute("role", "button");
      box.tabIndex = 0;
      box.setAttribute("aria-label", `${G.cardLabel(pick)} an ${groupTitle(group)} anlegen`);
      const add = () => {
        selected.clear();
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
      const el = cardEl(card, small ? 24 : 30);
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
  el.className = `gs-seat${badgeClass === "turn" ? " turn" : ""}`;
  const hand = state.hands[person];
  el.innerHTML = `
    <div class="gs-seat-head">
      <span class="gs-seat-name">${escapeHtml(person)}</span>
      ${badgeText ? `<span class="gs-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
      <span class="gs-seat-etappe">${escapeHtml(etappeText(state, person))}</span>
    </div>
    <div class="gs-opp-hand" data-zone="hand-${escapeHtml(person)}"></div>`;
  const handEl = el.querySelector(".gs-opp-hand");
  if (state.phase === "play") {
    hand.forEach((_, i) => {
      const back = backEl(22);
      GameAnim.tag(back, backKey(person, i));
      handEl.appendChild(back);
    });
    const count = document.createElement("span");
    count.className = "gs-hand-count";
    count.textContent = `${hand.length} ${hand.length === 1 ? "Karte" : "Karten"}`;
    handEl.appendChild(count);
  } else {
    /* after the round everybody shows what is left */
    sortedHand(hand).forEach(card => {
      const face = cardEl(card, 22);
      GameAnim.tag(face, cardKey(card));
      handEl.appendChild(face);
    });
    const count = document.createElement("span");
    count.className = "gs-hand-count";
    count.textContent = hand.length ? `${state.lastRound ? state.lastRound.points[person] : 0} Pkt.` : "keine Karten 🏁";
    handEl.appendChild(count);
  }
  const groups = groupsEl(state, person, true);
  if (groups.children.length) el.appendChild(groups);
}

function fillOwn(state) {
  const person = me();
  const [badgeClass, badgeText] = badgeFor(state, person);
  ownEl.className = `gs-seat gs-own${badgeClass === "turn" ? " turn" : ""}`;
  const index = Math.min(state.etappe[person], G.ETAPPEN.length - 1);
  const etappe = G.ETAPPEN[index];
  const laid = state.laid[person];
  const goal = laid && state.phase === "play"
    ? `<p class="gs-goal done">✓ Etappe ${index + 1} liegt aus – jetzt anlegen und Karten loswerden</p>`
    : `<p class="gs-goal">Deine ${escapeHtml(etappeText(state, person))} <span>${etappe.groups.map(g => `<em>${escapeHtml(G.groupLabel(g))}</em>`).join(" + ")}</span></p>`;
  ownEl.innerHTML = `
    <div class="gs-seat-head">
      <span class="gs-seat-name">Du</span>
      ${badgeText ? `<span class="gs-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
      <button type="button" class="gs-sort" id="gsSort">${sortBy === "colour" ? "nach Farbe" : "nach Zahl"} ⇅</button>
    </div>
    ${goal}`;
  ownEl.querySelector("#gsSort").addEventListener("click", () => {
    sortBy = sortBy === "colour" ? "value" : "colour";
    storeSort(sortBy);
    renderLocal();
  });
  const groups = groupsEl(state, person, false);
  if (groups.children.length) ownEl.appendChild(groups);

  const handEl = document.createElement("div");
  handEl.className = "gs-hand";
  handEl.dataset.zone = `hand-${person}`;
  const active = canAct(state);
  sortedHand(state.hands[person]).forEach(card => {
    const el = cardEl(card);
    GameAnim.tag(el, cardKey(card));
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
      return { big: true, text: mine ? `⛰️ Du legst Etappe ${e.etappe + 1} aus!` : `⛰️ ${who} legt Etappe ${e.etappe + 1} aus!` };
    case "add": {
      const where = e.owner === e.person ? (mine ? "bei dir" : "bei sich") : e.owner === me() ? "bei dir" : `bei ${e.owner}`;
      return `${mine ? "Du legst" : `${who} legt`} ${label(e.card)} ${where} an.`;
    }
    case "discard":
      return `${mine ? "Du wirfst" : `${who} wirft`} ${label(e.card)} ab.`;
    case "stone":
      return `🪨 Steinschlag! ${e.target === me() ? "Du setzt" : `${e.target} setzt`} einmal aus.`;
    case "skip":
      return mine ? "🪨 Du setzt diese Runde aus." : `🪨 ${who} setzt aus.`;
    case "reshuffle":
      return "Der Ablagestapel wird neu gemischt.";
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

function button(id, text, onClick, { secondary = false, disabled = false } = {}) {
  const el = document.createElement("button");
  el.type = "button";
  el.id = id;
  el.className = `btn gs-btn${secondary ? " btn-secondary" : ""}`;
  el.textContent = text;
  el.disabled = disabled;
  el.addEventListener("click", onClick);
  return el;
}

function renderControls(state) {
  actionsEl.innerHTML = "";
  if (state.phase !== "play") {
    renderSummary(state);
    return;
  }
  const turn = state.turnPerson;
  if (turn !== me()) {
    statusEl.textContent = seated(state) && state.skip[me()] ? `${turn} ist dran – du setzt danach einmal aus 🪨` : `${turn} ist dran …`;
    return;
  }

  if (state.step === "draw") {
    const top = state.discard[state.discard.length - 1];
    statusEl.textContent = "Du bist dran: Zieh vom Stapel oder nimm die offene Karte.";
    actionsEl.append(
      button("gsDrawDeck", "Vom Stapel ⛰️", () => room.dispatch(G.drawDeck)),
      button("gsDrawDiscard", top && !G.isStone(top) ? `${G.cardLabel(top)} nehmen` : "Offene nehmen", () => room.dispatch(G.drawDiscard), { secondary: true, disabled: !top || G.isStone(top) })
    );
    return;
  }

  const laid = state.laid[me()];
  const count = selected.size;
  if (!laid) {
    statusEl.textContent = count ? `${count} ${count === 1 ? "Karte" : "Karten"} gewählt` : "Wähle Karten für deine Etappe – oder wirf eine ab.";
    actionsEl.append(
      button("gsLay", "Etappe auslegen ⛰️", () => {
        const cards = [...selected];
        selected.clear();
        room.dispatch(G.layDown, cards);
      }, { disabled: count === 0 }),
      button("gsHint", "💡 Vorschlag", () => {
        const found = G.findLaydown(state.etappe[me()], state.hands[me()]);
        if (!found) {
          showToast("Die Etappe ist noch nicht auf deiner Hand.", "error");
          return;
        }
        selected.clear();
        found.forEach(card => selected.add(card));
        renderLocal();
      }, { secondary: true })
    );
  } else {
    const pick = count === 1 ? [...selected][0] : null;
    const fits = pick ? G.fittingGroups(state, pick).length : 0;
    statusEl.textContent = !pick
      ? "Tippe eine Karte an: anlegen oder abwerfen."
      : fits ? "Tippe auf eine leuchtende Gruppe zum Anlegen – oder wirf sie ab." : `${G.cardLabel(pick)} passt nirgends – abwerfen?`;
  }
  actionsEl.append(button("gsDrop", "Abwerfen ✋", dropSelected, { secondary: !laid, disabled: count !== 1 }));
}

function renderSummary(state) {
  const finished = state.phase === "finished";
  const last = state.lastRound || { points: {}, climbed: {} };
  statusEl.textContent = finished ? describeWinners(state.result, me()) : `Runde ${last.round} ist vorbei`;
  const order = state.players.slice().sort((a, b) => state.etappe[b] - state.etappe[a] || state.scores[a] - state.scores[b]);
  const rows = order.map(p => {
    const climbed = last.climbed[p];
    const level = state.etappe[p] >= G.ETAPPEN.length ? "Gipfel 🏔️" : `Etappe ${state.etappe[p] + 1}`;
    return `<tr><td>${escapeHtml(nameFor(p))}</td><td class="${climbed ? "plus" : "zero"}">${climbed ? "▲" : "–"} ${level}</td><td>+${last.points[p] || 0}</td><td>${state.scores[p]}</td></tr>`;
  }).join("");
  const box = document.createElement("div");
  box.className = "gs-summary";
  box.innerHTML = `
    <h3>${finished ? "Endstand 🏔️" : `Nach Runde ${last.round}`}</h3>
    <table><thead><tr><th></th><th>Weiter mit</th><th>Runde</th><th>Pkt.</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="gs-next"></div>`;
  actionsEl.appendChild(box);
  room.renderReady(box.querySelector(".gs-next"), state, finished
    ? { label: "Neue Partie ⛰️", nextFn: G.newGame }
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
