/* Flip 7 for 2–4 players. Lobby, invites, moves and live sync come from game-room.js,
   the flying cards from game-anim.js – the same animations as in Cabo. */
const F = Flip7Engine;

const boardEl = document.getElementById("f7Board");
const scoreEl = document.getElementById("f7Score");
const oppsEl = document.getElementById("f7Opps");
const ownEl = document.getElementById("f7Own");
const drawPile = document.getElementById("f7DrawPile");
const drawCount = document.getElementById("f7DrawCount");
const discardPile = document.getElementById("f7Discard");
const discardCount = document.getElementById("f7DiscardCount");
const eventEl = document.getElementById("f7Event");
const statusEl = document.getElementById("f7Status");
const actionsEl = document.getElementById("f7Actions");

const STEP_MS = 360;
const FLY_MS = 480;
const ACTION_ICONS = { freeze: "🧊", second: "❤️", flip3: "⚡" };

let lastAnimatedMove = { gameId: null, seq: null };
const seatEls = new Map();

const room = GameRoom.create({
  table: "flip7_games",
  title: "Flip 7",
  icon: "🃏",
  url: "flip7.html",
  lobbyEl: document.getElementById("f7Lobby"),
  boardEl,
  leaveBtn: document.getElementById("f7LeaveBtn"),
  createState: players => F.createInitialState(players),
  isFinished: state => state.phase === "finished",
  renderBoard
});

const me = () => room.person;
const nameFor = person => (person === me() ? "Du" : person);

/* ---------- cards ---------- */

function cardEl(card, width) {
  const el = document.createElement("div");
  if (F.isNumber(card)) {
    const value = F.numberOf(card);
    el.className = `f7-card f7-num v${value}`;
    el.textContent = String(value);
    el.setAttribute("aria-label", `Zahlenkarte ${value}`);
  } else if (F.isModifier(card)) {
    el.className = "f7-card f7-mod";
    el.textContent = F.MODIFIERS[card];
    el.setAttribute("aria-label", `Bonuskarte ${F.MODIFIERS[card]}`);
  } else {
    el.className = `f7-card f7-act ${card}`;
    el.innerHTML = `<span class="f7-act-icon" aria-hidden="true">${ACTION_ICONS[card] || "?"}</span>${escapeHtml(F.ACTIONS[card] || card)}`;
    el.setAttribute("aria-label", `Aktionskarte ${F.ACTIONS[card] || card}`);
  }
  el.dataset.card = card;
  if (width) el.style.setProperty("--w", `${width}px`);
  return el;
}

function backEl(width) {
  const el = document.createElement("div");
  el.className = "f7-card f7-back";
  el.textContent = "7";
  el.setAttribute("aria-label", "Verdeckte Karte");
  if (width) el.style.setProperty("--w", `${width}px`);
  return el;
}

/* every card on the table has a key, so a flying copy can land exactly on it */
const cardKey = (person, card, occurrence = 0) => `f7-${person}-${card}-${occurrence}`;
const bustKey = person => `f7-${person}-bust`;

/* ---------- board ---------- */

function renderBoard(game) {
  const state = game.state;
  const move = takeUnseenMove(game);
  if (move) hideMovingCards(move, state);

  renderScore(state);
  renderPiles(state);
  renderSeats(state);
  renderEvents(state);
  renderControls(state);

  if (move) animateMove(move, state);
}

function renderScore(state) {
  const best = Math.max(...state.players.map(p => state.scores[p]));
  const chips = [me(), ...room.others(state)].filter(p => state.players.includes(p)).map(p => `
    <span class="f7-chip${p === me() ? " me" : ""}${best > 0 && state.scores[p] === best ? " lead" : ""}">
      ${escapeHtml(nameFor(p))} <strong>${state.scores[p]}</strong>
    </span>`).join("");
  const wins = state.players.some(p => state.wins[p] > 0)
    ? `<span class="f7-chip">Siege: ${state.players.map(p => `${escapeHtml(nameFor(p))} ${state.wins[p] || 0}`).join(" · ")}</span>`
    : "";
  scoreEl.innerHTML = `${chips}<span class="f7-chip">Runde <strong>${state.round}</strong> · Ziel ${F.TARGET_SCORE}</span>${wins}`;
}

function renderPiles(state) {
  drawPile.innerHTML = "";
  drawPile.classList.toggle("has-cards", state.deck.length > 1);
  if (state.deck.length > 0) drawPile.appendChild(backEl());
  drawCount.textContent = `${state.deck.length} Karten`;

  discardPile.innerHTML = "";
  const top = state.discard[state.discard.length - 1];
  if (top) discardPile.appendChild(cardEl(top));
  discardCount.textContent = state.discard.length ? `${state.discard.length} abgelegt` : "Ablage";
}

function badgeFor(state, person) {
  const seat = state.table[person];
  if (seat.flip7) return ["flip7", "Flip 7! 🎉"];
  if (seat.status === "busted") return ["busted", "Verzockt 💥"];
  if (seat.status === "frozen") return ["frozen", "Eingefroren 🧊"];
  if (seat.status === "stayed") return ["stayed", "Stopp ✋"];
  if (state.choice && state.choice.chooser === person) return ["turn", "wählt …"];
  if (state.phase === "play" && state.turnPerson === person && !state.choice) return ["turn", "am Zug"];
  return ["", "im Spiel"];
}

function seatHtml(state, person) {
  const seat = state.table[person];
  const [badgeClass, badgeText] = badgeFor(state, person);
  const points = F.scoreOf(seat);
  const own = person === me();
  const progress = own && seat.status === "active" ? `<span class="f7-progress">${seat.numbers.length}/${F.FLIP7_COUNT} verschiedene</span>` : "";
  return `
    <div class="f7-seat-head">
      <span class="f7-seat-name">${escapeHtml(own ? "Du" : person)}</span>
      <span class="f7-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      ${progress}
      <span class="f7-seat-points">${points}<small> Pkt.</small></span>
    </div>
    <div class="f7-row f7-numbers"></div>
    <div class="f7-row f7-extras"></div>`;
}

function fillSeat(el, state, person) {
  const seat = state.table[person];
  el.className = `f7-seat ${person === me() ? "f7-own" : ""} ${seat.status}${seat.flip7 ? " flip7" : ""}`;
  const [badgeClass] = badgeFor(state, person);
  el.classList.toggle("turn", badgeClass === "turn");
  el.innerHTML = seatHtml(state, person);
  const numbersRow = el.querySelector(".f7-numbers");
  const extrasRow = el.querySelector(".f7-extras");

  seat.numbers.forEach(value => {
    const card = cardEl(`n${value}`);
    GameAnim.tag(card, cardKey(person, `n${value}`));
    numbersRow.appendChild(card);
  });
  if (seat.bust) {
    const card = cardEl(seat.bust);
    card.classList.add("bust-card");
    GameAnim.tag(card, bustKey(person));
    numbersRow.appendChild(card);
  }
  if (!numbersRow.children.length) numbersRow.innerHTML = `<span class="f7-row-empty">noch keine Zahlenkarte</span>`;

  seat.mods.forEach(mod => {
    const card = cardEl(mod);
    GameAnim.tag(card, cardKey(person, mod));
    extrasRow.appendChild(card);
  });
  const seen = {};
  seat.actions.forEach(action => {
    const card = cardEl(action);
    seen[action] = (seen[action] || 0) + 1;
    GameAnim.tag(card, cardKey(person, action, seen[action] - 1));
    extrasRow.appendChild(card);
  });
  if (!extrasRow.children.length) extrasRow.remove();
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
  if (state.players.includes(me())) seatEls.set(me(), ownEl);
  ownEl.hidden = !state.players.includes(me());
  [...seatEls.entries()].forEach(([person, el]) => {
    if (state.table[person]) fillSeat(el, state, person);
  });
}

/* ---------- what just happened ---------- */

function describe(event, state) {
  const who = event.person;
  const mine = who === me();
  const label = card => F.cardLabel(card);
  switch (event.type) {
    case "card":
      if (event.result === "bust") return mine ? `💥 Die ${label(event.card)} hattest du schon – verzockt!` : `💥 ${who} hat sich mit der ${label(event.card)} verzockt!`;
      if (event.result === "saved") return mine ? `❤️ Second Chance rettet dich vor der doppelten ${label(event.card)}!` : `❤️ Second Chance rettet ${who} vor der doppelten ${label(event.card)}!`;
      if (event.result === "flip7") return { big: true, text: mine ? "🎉 Flip 7! Du bekommst 15 Extrapunkte!" : `🎉 Flip 7 für ${who}! +15 Extrapunkte` };
      return null;
    case "freeze":
      if (event.by === event.target) return event.by === me() ? "🧊 Du frierst dich selbst ein und sicherst deine Punkte." : `🧊 ${event.by} friert sich selbst ein.`;
      return `🧊 ${nameFor(event.by)} ${event.by === me() ? "frierst" : "friert"} ${event.target === me() ? "dich" : event.target} ein.`;
    case "flip3":
      return `⚡ Flip Three: ${event.target === me() ? "Du bekommst" : `${event.target} bekommt`} drei Karten${event.by !== event.target ? ` von ${nameFor(event.by)}` : ""}.`;
    case "second":
      return `❤️ ${nameFor(event.by)} ${event.by === me() ? "gibst" : "gibt"} ${event.target === me() ? "dir" : event.target} eine Second Chance.`;
    case "wasted":
      return `${label(event.card)} verfällt – niemand mehr da, der sie bekommen kann.`;
    case "reshuffle":
      return "🔀 Der Stapel ist leer – der Ablagestapel wird neu gemischt.";
    case "stay":
      return mine ? "✋ Du sagst Stopp." : `✋ ${who} sagt Stopp.`;
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

function choiceLabel(type, target) {
  const self = target === me();
  if (type === "freeze") return self ? "🧊 Mich selbst einfrieren" : `🧊 ${target} einfrieren`;
  if (type === "flip3") return self ? "⚡ Ich nehme drei Karten" : `⚡ ${target} bekommt drei Karten`;
  return `❤️ Second Chance an ${target}`;
}

function renderControls(state) {
  actionsEl.innerHTML = "";

  if (state.phase === "round-over" || state.phase === "finished") {
    renderSummary(state);
    return;
  }

  if (state.choice) {
    const { type, chooser, candidates } = state.choice;
    if (chooser === me()) {
      statusEl.textContent = type === "freeze" ? "Wen frierst du ein? 🧊" : type === "flip3" ? "Wer bekommt drei Karten? ⚡" : "Wem gibst du deine zweite Second Chance? ❤️";
      const box = document.createElement("div");
      box.className = "f7-targets";
      if (type === "freeze") box.innerHTML = "<p>Eingefroren ist man raus – die Punkte zählen trotzdem.</p>";
      if (type === "flip3") box.innerHTML = "<p>Die Person muss drei Karten nacheinander nehmen.</p>";
      candidates.forEach(target => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-block f7-target${target === me() ? " btn-secondary" : ""}`;
        button.dataset.target = target;
        button.textContent = choiceLabel(type, target);
        button.addEventListener("click", () => room.dispatch(F.chooseTarget, target));
        box.appendChild(button);
      });
      actionsEl.appendChild(box);
    } else {
      statusEl.textContent = `${chooser} wählt, wen ${F.ACTIONS[type]} trifft …`;
    }
    return;
  }

  if (state.phase !== "play") {
    statusEl.textContent = "Es wird ausgeteilt …";
    return;
  }

  const turn = state.turnPerson;
  if (turn === me()) {
    statusEl.textContent = "Du bist dran: Noch eine oder Stopp?";
    const hit = document.createElement("button");
    hit.type = "button";
    hit.id = "f7Hit";
    hit.className = "btn f7-btn-hit";
    hit.textContent = "Noch eine 🃏";
    hit.addEventListener("click", () => room.dispatch(F.hit));
    const stay = document.createElement("button");
    stay.type = "button";
    stay.id = "f7Stay";
    stay.className = "btn f7-btn-stay";
    stay.textContent = `Stopp ✋ (${F.scoreOf(state.table[me()])} Pkt.)`;
    stay.addEventListener("click", () => room.dispatch(F.stay));
    actionsEl.append(hit, stay);
  } else if (state.players.includes(me()) && state.table[me()].status !== "active") {
    statusEl.textContent = `Du bist raus – ${turn} ist dran …`;
  } else {
    statusEl.textContent = `${turn} ist dran …`;
  }
}

function renderSummary(state) {
  const finished = state.phase === "finished";
  const last = state.lastRound || { scores: {}, seats: {} };
  statusEl.textContent = finished ? describeWinners(state.result, me()) : `Runde ${last.round} ist vorbei`;
  const order = state.players.slice().sort((a, b) => state.scores[b] - state.scores[a]);
  const rows = order.map(p => {
    const gained = last.scores[p] || 0;
    const seat = (last.seats || {})[p] || {};
    const note = seat.flip7 ? " 🎉" : seat.status === "busted" ? " 💥" : seat.status === "frozen" ? " 🧊" : "";
    return `<tr><td>${escapeHtml(nameFor(p))}${note}</td><td class="${gained ? "plus" : "zero"}">+${gained}</td><td>${state.scores[p]}</td></tr>`;
  }).join("");
  const box = document.createElement("div");
  box.className = "f7-summary";
  box.innerHTML = `
    <h3>${finished ? "Endstand 🏁" : `Nach Runde ${last.round}`}</h3>
    <table><tbody>${rows}</tbody></table>
    ${state.tieBreak ? `<p class="f7-row-empty">Gleichstand an der Spitze – noch eine Runde!</p>` : ""}
    <div class="f7-next"></div>`;
  actionsEl.appendChild(box);
  room.renderReady(box.querySelector(".f7-next"), state, finished
    ? { label: "Neue Partie 🃏", nextFn: F.newGame }
    : { label: "Nächste Runde ▶", nextFn: F.nextRound });
  const cheerKey = `${state.gameNo}`;
  if (finished && state.result && state.result.winner === me() && cheeredGame !== cheerKey) {
    cheeredGame = cheerKey;
    celebrate(30);
  }
}

let cheeredGame = null;

/* ---------- animations (like Cabo): cards fly face down from the deck and turn over ---------- */

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

/* where a flying card lands: its own slot on the table, or – if it does not stay there – the row */
function landingKey(event, state) {
  if (event.type === "card") {
    if (event.result === "bust") return bustKey(event.person);
    if (event.result === "ok" || event.result === "flip7") return cardKey(event.person, event.card);
    if (event.result === "kept") return cardKey(event.person, "second", 0);
    return null;
  }
  if (event.type === "freeze" || event.type === "flip3" || event.type === "second") {
    const actions = (state.table[event.target] || { actions: [] }).actions;
    const card = event.type;
    const count = actions.filter(a => a === card).length;
    return count ? cardKey(event.target, card, count - 1) : null;
  }
  return null;
}

function hideMovingCards(move, state) {
  (move.events || []).forEach(event => {
    const key = landingKey(event, state);
    if (key) GameAnim.hide(key);
  });
}

function seatRow(person) {
  const el = seatEls.get(person);
  return el ? el.querySelector(".f7-numbers") : null;
}

function rowLanding(person, sample) {
  const row = GameAnim.rectOf(seatRow(person));
  if (!row) return null;
  const width = sample ? sample.width : 30;
  const height = sample ? sample.height : 42;
  return { left: row.left + Math.min(row.width - width, 8), top: row.top, width, height };
}

function findKey(key) {
  return key ? document.querySelector(`[data-anim-key="${CSS.escape(key)}"]`) : null;
}

function animateMove(move, state) {
  const deck = GameAnim.rectOf(drawPile);
  const discard = GameAnim.rectOf(discardPile);
  const jobs = [];
  let t = 0;

  (move.events || []).forEach(event => {
    const key = landingKey(event, state);
    const target = findKey(key);
    const targetRect = GameAnim.rectOf(target);

    if (event.type === "reshuffle") {
      GameAnim.shuffle(drawPile, t);
      t += 560;
      return;
    }

    if (event.type === "card") {
      const to = targetRect || rowLanding(event.person, deck && { width: 34, height: 48 });
      const width = to ? to.width : 40;
      jobs.push(GameAnim.fly({
        from: deck,
        to,
        front: cardEl(event.card, width),
        back: backEl(width),
        startFaceUp: false,
        endFaceUp: true,
        fade: !targetRect,
        delay: t,
        duration: FLY_MS
      }).then(() => {
        if (key) GameAnim.reveal(key);
        if (event.result === "bust" || event.result === "saved") GameAnim.shake(seatRow(event.person));
        if (event.result === "saved" && discard) GameAnim.shake(discardPile);
        if (event.result === "flip7") celebrate(40);
      }));
      t += STEP_MS;
      return;
    }

    if (event.type === "freeze" || event.type === "flip3" || event.type === "second") {
      const from = rowLanding(event.by, targetRect) || deck;
      const width = targetRect ? targetRect.width : 34;
      jobs.push(GameAnim.fly({
        from,
        to: targetRect,
        front: cardEl(event.type, width),
        back: backEl(width),
        startFaceUp: true,
        endFaceUp: true,
        delay: t,
        duration: FLY_MS + 120,
        arc: 50
      }).then(() => {
        if (key) GameAnim.reveal(key);
        const landed = findKey(key);
        if (landed) landed.classList.add("just-applied");
      }));
      t += STEP_MS + 200;
    }
  });

  /* safety net: never leave a card invisible if something interrupts an animation */
  const safety = setTimeout(GameAnim.revealAll, t + FLY_MS + 2500);
  Promise.all(jobs).then(() => clearTimeout(safety));
}

room.start();
