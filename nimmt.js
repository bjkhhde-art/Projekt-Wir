/* 6 nimmt! for 2–4 players. Lobby, invites, moves and live sync come from game-room.js. */
const boardEl = document.getElementById("nmBoard");
const scoreEl = document.getElementById("nmScore");
const oppsEl = document.getElementById("nmOpps");
const ownPileEl = document.getElementById("nmOwnPile");
const spotsEl = document.getElementById("nmSpots");
const rowsEl = document.getElementById("nmRows");
const eventEl = document.getElementById("nmEvent");
const statusEl = document.getElementById("nmStatus");
const actionsEl = document.getElementById("nmActions");
const handEl = document.getElementById("nmHand");

const PLACE_STEP_MS = 950;
const FLY_MS = 520;

let lastAnimatedMove = { gameId: null, seq: null };
let previousState = null;
let previousStateGameId = null;

/* one line (name, cards left, bulls) and one spot for the played card per other player;
   the first other player keeps the ids the two-player table always had */
const oppEls = new Map();
const spotEls = new Map();
let spotOwnEl = null;
let tableKey = "";

function makeSpot(label, id, labelId) {
  const wrap = document.createElement("div");
  wrap.className = "nm-spot";
  const card = document.createElement("div");
  card.className = "nm-spot-card";
  if (id) card.id = id;
  const text = document.createElement("span");
  text.className = "nm-spot-label";
  text.textContent = label;
  if (labelId) text.id = labelId;
  wrap.append(card, text);
  spotsEl.appendChild(wrap);
  return card;
}

function ensureTable(opponents) {
  const key = opponents.join("|");
  if (key === tableKey) return;
  tableKey = key;
  oppEls.clear();
  spotEls.clear();
  oppsEl.innerHTML = "";
  spotsEl.innerHTML = "";
  spotsEl.dataset.count = String(opponents.length + 1);
  opponents.forEach((person, index) => {
    const row = document.createElement("div");
    row.className = "nm-player nm-player-opp";
    row.innerHTML = `<span class="nm-player-name"></span><span class="nm-player-hand"></span><span class="nm-pile"></span>`;
    const [name, hand, pile] = row.children;
    name.textContent = person;
    if (index === 0) {
      name.id = "nmOppName";
      hand.id = "nmOppHand";
      pile.id = "nmOppPile";
    }
    oppsEl.appendChild(row);
    oppEls.set(person, { name, hand, pile });
    spotEls.set(person, makeSpot(person, index === 0 ? "nmSpotOpp" : null, index === 0 ? "nmSpotOppLabel" : null));
  });
  spotOwnEl = makeSpot("Du", "nmSpotOwn", null);
}

const spotKey = person => (person === room.person ? "spot-own" : `spot-${person}`);

const { bullsFor, sumBulls } = NimmtEngine;

const room = GameRoom.create({
  table: "nimmt_games",
  title: "6 nimmt!",
  icon: "🐮",
  url: "nimmt.html",
  lobbyEl: document.getElementById("nmLobby"),
  boardEl,
  leaveBtn: document.getElementById("nmLeaveBtn"),
  createState: players => NimmtEngine.createInitialState(players),
  isFinished: state => state.phase === "finished",
  renderBoard
});

/* ---------- card elements ---------- */

const bullIcon = () => '<svg class="nm-bull" aria-hidden="true"><use href="#nm-bull"></use></svg>';

function cardEl(value) {
  const bulls = bullsFor(value);
  const el = document.createElement("div");
  el.className = `nm-card nm-b${bulls}`;
  el.setAttribute("aria-label", `Karte ${value}, ${bulls} Hornochsen`);
  el.innerHTML = `<span class="nm-card-bulls">${bullIcon().repeat(bulls)}</span><span class="nm-card-num">${value}</span>`;
  return el;
}

function backEl() {
  const el = document.createElement("div");
  el.className = "nm-card nm-card-back";
  el.setAttribute("aria-label", "Verdeckte Karte");
  el.innerHTML = bullIcon();
  return el;
}

function flipEl(value, faceUp) {
  const el = document.createElement("div");
  el.className = "nm-flip";
  el.classList.toggle("face-up", faceUp);
  el.appendChild(backEl());
  el.appendChild(cardEl(value));
  return el;
}

/* ---------- board ---------- */

function renderBoard(game) {
  const state = game.state;
  const opponents = room.others(state);
  if (previousStateGameId !== game.id) {
    previousState = null;
    previousStateGameId = game.id;
  }

  const before = captureLayout();
  ensureTable(opponents);
  const move = takeUnseenMove(game);
  if (move) hideMovingCards(move, state);

  renderScore(state, opponents);
  renderPlayers(state, opponents);
  renderSpots(state, opponents, move);
  renderRows(state, move);
  renderHand(state, move);
  renderEvent(state);
  renderStatus(state, opponents);

  if (move) animateMove(move, previousState, state, before);
  previousState = state;
}

function renderScore(state, opponents) {
  const wins = state.wins || {};
  const trickText = state.phase === "finished" ? "vorbei" : `Stich ${state.trick}/10`;
  const tally = opponents.length === 1
    ? `Du <strong>${wins[room.person] || 0}</strong> : <strong>${wins[opponents[0]] || 0}</strong> ${escapeHtml(opponents[0])}`
    : [`Du <strong>${wins[room.person] || 0}</strong>`, ...opponents.map(p => `${escapeHtml(p)} <strong>${wins[p] || 0}</strong>`)].join(" · ");
  scoreEl.innerHTML = `
    <span>Partie <strong>${state.gameNo}</strong> · ${trickText}</span>
    <span>Siege: ${tally}</span>
  `;
}

function pileHtml(person, state) {
  const cards = state.penalties[person] || [];
  return `${bullIcon()}<span>${sumBulls(cards)}</span>`;
}

function renderPlayers(state, opponents) {
  opponents.forEach(opp => {
    const els = oppEls.get(opp);
    const acting = (state.phase === "choose" && state.chosen[opp] === null) ||
      (state.phase === "pick-row" && state.pickPerson === opp);
    els.name.classList.toggle("active", acting);
    const cards = (state.hands[opp] || []).length;
    els.hand.textContent = state.phase === "finished" ? "" : `${cards} ${cards === 1 ? "Karte" : "Karten"}`;
    els.pile.innerHTML = pileHtml(opp, state);
    els.pile.title = `${(state.penalties[opp] || []).length} kassierte Karten`;
  });
  ownPileEl.innerHTML = pileHtml(room.person, state);
  ownPileEl.title = `${(state.penalties[room.person] || []).length} kassierte Karten`;
}

function setSpot(spot, content, { key, clickable = false, pending = false, onClick = null } = {}) {
  spot.innerHTML = "";
  spot.onclick = null;
  spot.className = "nm-spot-card";
  if (typeof content === "string") {
    spot.textContent = content;
  } else {
    spot.appendChild(content);
    spot.classList.add("filled");
  }
  spot.classList.toggle("clickable", clickable);
  spot.classList.toggle("pending", pending);
  if (onClick) spot.onclick = onClick;
  GameAnim.tag(spot, key);
}

function renderSpots(state, opponents, move) {
  spotsEl.classList.toggle("hidden", state.phase === "finished");

  if (state.phase === "pick-row") {
    const revealed = state.revealed || [];
    const playOf = person => revealed.find(play => play.person === person);
    const ownPlay = playOf(room.person);

    opponents.forEach(opp => {
      const spot = spotEls.get(opp);
      const oppPlay = playOf(opp);
      if (oppPlay) {
        const justRevealed = move && move.type === "reveal" && GameAnim.enabled();
        const flip = flipEl(oppPlay.card, !justRevealed);
        setSpot(spot, flip, { key: spotKey(opp), pending: state.pickPerson === opp });
        if (justRevealed) setTimeout(() => flip.classList.add("face-up"), 60);
      } else {
        setSpot(spot, "", { key: spotKey(opp) });
      }
    });

    if (ownPlay) {
      setSpot(spotOwnEl, cardEl(ownPlay.card), { key: "spot-own", pending: state.pickPerson === room.person });
    } else {
      setSpot(spotOwnEl, "", { key: "spot-own" });
    }
    return;
  }

  opponents.forEach(opp => {
    const spot = spotEls.get(opp);
    const oppChosen = state.chosen[opp] !== null && state.chosen[opp] !== undefined;
    if (oppChosen) {
      const back = backEl();
      if (move && move.type === "choose" && move.person === opp && move.chosen) back.classList.add("nm-drop-in");
      setSpot(spot, back, { key: spotKey(opp) });
    } else {
      setSpot(spot, state.phase === "choose" ? "wählt…" : "", { key: spotKey(opp) });
    }
  });

  const ownChosen = state.chosen[room.person];
  if (ownChosen !== null && ownChosen !== undefined) {
    setSpot(spotOwnEl, cardEl(ownChosen), {
      key: "spot-own",
      clickable: true,
      onClick: () => room.dispatch(NimmtEngine.chooseCard, ownChosen)
    });
  } else {
    setSpot(spotOwnEl, state.phase === "choose" ? "Karte antippen" : "", { key: "spot-own" });
  }
}

const cellKey = (row, col) => `cell-${row}-${col}`;

function renderRows(state, move) {
  rowsEl.innerHTML = "";
  const myPick = state.phase === "pick-row" && state.pickPerson === room.person;
  const dealing = move && move.type === "deal";

  state.rows.forEach((row, r) => {
    const rowEl = document.createElement("div");
    rowEl.className = "nm-row";
    rowEl.classList.toggle("full", row.length >= NimmtEngine.ROW_LIMIT);

    for (let c = 0; c < NimmtEngine.ROW_LIMIT; c++) {
      const cell = document.createElement("div");
      cell.className = "nm-cell";
      if (row[c] !== undefined) {
        const card = cardEl(row[c]);
        if (dealing) card.style.setProperty("--deal-delay", `${r * 90}ms`);
        cell.appendChild(card);
        cell.classList.add("filled");
      }
      GameAnim.tag(cell, cellKey(r, c));
      rowEl.appendChild(cell);
    }

    const info = document.createElement("div");
    info.className = "nm-row-info";
    info.innerHTML = `${bullIcon()}<span>${sumBulls(row)}</span>${row.length >= NimmtEngine.ROW_LIMIT ? "<span>voll</span>" : ""}`;
    rowEl.appendChild(info);

    if (myPick) {
      rowEl.classList.add("pickable");
      rowEl.setAttribute("role", "button");
      rowEl.tabIndex = 0;
      rowEl.setAttribute("aria-label", `Reihe ${r + 1} nehmen (${sumBulls(row)} Hornochsen)`);
      rowEl.addEventListener("click", () => room.dispatch(NimmtEngine.pickRow, r));
      rowEl.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") room.dispatch(NimmtEngine.pickRow, r);
      });
    }
    rowsEl.appendChild(rowEl);
  });

  if (dealing && GameAnim.enabled()) {
    boardEl.classList.add("nm-dealing");
    setTimeout(() => boardEl.classList.remove("nm-dealing"), 1800);
  }
}

function renderHand(state, move) {
  handEl.innerHTML = "";
  const chosen = state.chosen[room.person];
  const canChoose = state.phase === "choose";
  const dealing = move && move.type === "deal";

  (state.hands[room.person] || [])
    .filter(card => card !== chosen)
    .forEach((card, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nm-hand-card";
      const face = cardEl(card);
      if (dealing) face.style.setProperty("--deal-delay", `${400 + i * 60}ms`);
      button.appendChild(face);
      GameAnim.tag(button, `hand-${card}`);

      if (canChoose) {
        button.classList.add("clickable");
        button.addEventListener("click", () => room.dispatch(NimmtEngine.chooseCard, card));
      } else {
        button.disabled = true;
      }
      handEl.appendChild(button);
    });
}

function describeTakes(state) {
  if (!state.lastTrick || state.phase === "pick-row") return "";
  return state.lastTrick.placements
    .filter(p => p.took)
    .map(p => {
      const who = p.person === room.person ? "Du hast" : `${p.person} hat`;
      const what = p.reason === "full" ? "die volle Reihe" : "eine Reihe";
      return `${who} mit der ${p.card} ${what} genommen (+${sumBulls(p.took)} 🐮).`;
    })
    .join(" ");
}

function renderEvent(state) {
  eventEl.textContent = describeTakes(state);
}

function renderStatus(state, opponents) {
  actionsEl.innerHTML = "";
  statusEl.classList.remove("nudge");

  if (state.phase === "finished") {
    renderResult(state, opponents);
    return;
  }

  if (state.phase === "pick-row") {
    const card = state.revealed[0].card;
    const picker = state.pickPerson;
    statusEl.textContent = picker === room.person
      ? `Deine ${card} passt in keine Reihe – tippe die Reihe an, die du nehmen musst.`
      : `Die ${card} von ${picker} passt in keine Reihe – ${picker} sucht sich eine Reihe aus…`;
    return;
  }

  const chose = person => state.chosen[person] !== null && state.chosen[person] !== undefined;
  const done = opponents.filter(chose);
  const waiting = opponents.filter(p => !chose(p));
  if (!chose(room.person)) {
    if (done.length === 0) statusEl.textContent = "Tippe eine Karte aus deiner Hand an, um sie verdeckt zu legen.";
    else if (waiting.length === 0 && opponents.length > 1) statusEl.textContent = "Alle anderen haben schon gewählt – tippe eine Karte aus deiner Hand an.";
    else statusEl.textContent = `${listNames(done)} ${done.length > 1 ? "haben" : "hat"} schon gewählt – tippe eine Karte aus deiner Hand an.`;
  } else {
    statusEl.textContent = `Warte auf ${listNames(waiting)}… Tippe deine Karte an, um sie zurückzunehmen, oder eine andere zum Wechseln.`;
  }
}

function renderResult(state, opponents) {
  const { bulls } = state.result;
  statusEl.textContent = describeWinners(state.result, room.person);

  const wins = state.wins || {};
  const columns = [room.person, ...opponents];
  const table = document.createElement("table");
  table.className = "nm-result";
  table.innerHTML = `
    <thead><tr><th></th>${columns.map(p => `<th>${p === room.person ? "Du" : escapeHtml(p)}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><td>Hornochsen</td>${columns.map(p => `<td class="total">${bulls[p]}</td>`).join("")}</tr>
      <tr><td>Siege gesamt</td>${columns.map(p => `<td>${wins[p] || 0}</td>`).join("")}</tr>
    </tbody>
  `;
  actionsEl.appendChild(table);

  const again = document.createElement("button");
  again.type = "button";
  again.className = "btn btn-block";
  again.textContent = "Revanche 🐮";
  again.addEventListener("click", () => room.dispatch(NimmtEngine.rematch));
  actionsEl.appendChild(again);
}

/* ---------- animations ---------- */

function captureLayout() {
  const rectByKey = selector => {
    const map = {};
    document.querySelectorAll(selector).forEach(el => { map[el.dataset.animKey] = GameAnim.rectOf(el); });
    return map;
  };
  const spots = {};
  spotEls.forEach((el, person) => { spots[person] = GameAnim.rectOf(el); });
  return {
    spots,
    spotOwn: spotOwnEl ? GameAnim.rectOf(spotOwnEl) : null,
    hand: rectByKey(".nm-hand-card")
  };
}

function cellRect(row, col) {
  return GameAnim.rectOf(rowsEl.children[row] && rowsEl.children[row].children[col]);
}

function pileRect(person) {
  const els = oppEls.get(person);
  return GameAnim.rectOf(person === room.person ? ownPileEl : els && els.pile);
}

/* Each move is animated once per device; after a reload only a fresh deal is replayed. */
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

function hideMovingCards(move, state) {
  if (move.type === "choose" && move.person === room.person) {
    GameAnim.hide(move.chosen ? "spot-own" : `hand-${move.card}`);
  }
  if (move.type === "reveal" || move.type === "resolve") {
    move.placements.forEach(p => {
      if (state.rows[p.row][p.col] === p.card) GameAnim.hide(cellKey(p.row, p.col));
    });
    if (move.type === "reveal" && state.phase === "pick-row") GameAnim.hide("spot-own");
  }
}

function animateMove(move, prev, state, before) {
  const jobs = [];
  const flyThenReveal = (options, key) => jobs.push(GameAnim.fly(options).then(() => key && GameAnim.reveal(key)));

  if (move.type === "choose" && move.person === room.person) {
    if (move.chosen) {
      flyThenReveal({ from: before.hand[`hand-${move.card}`], to: GameAnim.rectOf(spotOwnEl), front: cardEl(move.card), back: backEl(), startFaceUp: true, endFaceUp: true, duration: 380 }, "spot-own");
    } else {
      const to = GameAnim.rectOf(document.querySelector(`[data-anim-key="hand-${move.card}"]`));
      flyThenReveal({ from: before.spotOwn, to, front: cardEl(move.card), back: backEl(), startFaceUp: true, endFaceUp: true, duration: 380 }, `hand-${move.card}`);
    }
  }

  if (move.type === "reveal" || move.type === "resolve") {
    const ownCameFromSpot = prev && prev.chosen && prev.chosen[room.person] !== null;
    const sourceOf = play => {
      if (move.type === "resolve") return play.person === room.person ? before.spotOwn : before.spots[play.person];
      if (play.person !== room.person) return before.spots[play.person];
      return ownCameFromSpot ? before.spotOwn : (before.hand[`hand-${play.card}`] || before.spotOwn);
    };

    /* my own card that only now leaves the hand for the table (I chose last, then someone must pick a row) */
    if (move.type === "reveal" && state.phase === "pick-row") {
      const ownPlay = move.plays.find(p => p.person === room.person);
      if (ownPlay) {
        flyThenReveal({ from: sourceOf(ownPlay), to: GameAnim.rectOf(spotOwnEl), front: cardEl(ownPlay.card), back: backEl(), startFaceUp: true, endFaceUp: true, duration: 380 }, "spot-own");
      }
    }

    const simRows = (prev ? prev.rows : state.rows).map(row => row.slice());
    let t = move.type === "reveal" ? 200 : 0;

    const lyingBefore = new Set((prev ? prev.rows : []).flat());

    move.placements.forEach(p => {
      if (p.took) {
        p.took.forEach((card, k) => {
          /* cards that lay there before the trick stay visible until they fly off;
             one placed earlier in this same trick only appears once it has landed */
          flyThenReveal({
            from: cellRect(p.row, k),
            to: pileRect(p.person),
            front: cardEl(card),
            back: backEl(),
            startFaceUp: true,
            endFaceUp: false,
            delay: t + k * 70,
            duration: FLY_MS,
            fade: true,
            hold: lyingBefore.has(card)
          });
        });
        simRows[p.row] = [];
      }

      const col = simRows[p.row].length;
      simRows[p.row].push(p.card);
      const finalKey = state.rows[p.row][p.col] === p.card ? cellKey(p.row, p.col) : null;
      const play = { person: p.person, card: p.card };
      const faceUp = p.person === room.person || move.type === "resolve";

      flyThenReveal({
        from: sourceOf(play),
        to: cellRect(p.row, col),
        front: cardEl(p.card),
        back: backEl(),
        startFaceUp: faceUp,
        endFaceUp: true,
        turnFirst: true,
        delay: t + (p.took ? 260 : 0),
        duration: FLY_MS,
        hold: true
      }, finalKey);

      t += PLACE_STEP_MS;
    });
  }

  /* safety net: never leave a card invisible if something interrupts an animation */
  const safety = setTimeout(GameAnim.revealAll, 5000);
  Promise.all(jobs).then(() => clearTimeout(safety));
}

room.start();
