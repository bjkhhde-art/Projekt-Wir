/* Monopoly for 2–4 players. Lobby, invites, moves and live sync come from game-room.js,
   the rules from monopoly-engine.js. This file only draws the board and the buttons. */
const M = MonopolyEngine;

const boardEl = document.getElementById("moBoard");
const playersEl = document.getElementById("moPlayers");
const gridEl = document.getElementById("moGrid");
const infoEl = document.getElementById("moInfo");
const statusEl = document.getElementById("moStatus");
const actionsEl = document.getElementById("moActions");
const mineEl = document.getElementById("moMine");
const tradeEl = document.getElementById("moTrade");

const TOKEN_COLORS = ["#e0489c", "#2d7be0", "#f39a2c", "#2faa5e"];
const SQUARE_ICONS = { go: "➡️", jail: "⛓️", parking: "🅿️", gotojail: "👮", chance: "❓", chest: "📦", tax: "💸", station: "🚂" };
const WALK_MS = 130;

let selectedSquare = null;
let tradeDraft = null; /* { to, give: [], get: [], pay: 0, ask: 0 } while the offer form is open */
let lastSeenSeq = { gameId: null, seq: null };
let tokenLayer = null;
const tokenEls = new Map();
const shownPos = {};
let walkTimer = null;

const room = GameRoom.create({
  table: "monopoly_games",
  bot: GameBots.monopoly,
  title: "Monopoly",
  icon: "🎩",
  url: "monopoly.html",
  lobbyEl: document.getElementById("moLobby"),
  boardEl,
  leaveBtn: document.getElementById("moLeaveBtn"),
  startOptions: [
    { value: "short", label: "Kurzes Spiel", hint: "20 Züge pro Person – wer dann am meisten besitzt, gewinnt" },
    { value: "full", label: "Bis zum Bankrott", hint: "Wer als Letzte:r übrig bleibt, gewinnt – das kann dauern" }
  ],
  createState: (players, option) => M.createInitialState(players, option),
  isFinished: state => state.phase === "finished",
  renderBoard
});

const me = () => room.person;
const nameFor = person => (person === me() ? "Du" : person);
const money = n => `${n.toLocaleString("de-DE")} €`;
const colorOf = (state, person) => TOKEN_COLORS[Math.max(0, state.players.indexOf(person))];

/* ---------- board geometry: 11 × 11 cells, the squares run around the edge ---------- */

function cellOf(index) {
  if (index <= 10) return { row: 11, col: 11 - index };
  if (index <= 20) return { row: 11 - (index - 10), col: 1 };
  if (index <= 30) return { row: 1, col: 1 + (index - 20) };
  return { row: 1 + (index - 30), col: 11 };
}

function squareIcon(square, index) {
  if (square.type === "utility") return index === 12 ? "⚡" : "💧";
  return SQUARE_ICONS[square.type] || "";
}

/* ---------- board ---------- */

function renderBoard(game) {
  const state = game.state;
  const fresh = takeUnseenMove(game);
  boardEl.classList.toggle("mo-debt", state.phase === "debt" && state.debt && state.debt.person === me());
  renderPlayers(state);
  renderGrid(state, fresh);
  renderInfo(state);
  renderStatus(state);
  renderControls(state);
  renderMine(state);
  renderTrade(state);
}

function takeUnseenMove(game) {
  const state = game.state;
  const sameGame = lastSeenSeq.gameId === game.id;
  const unseen = !sameGame || (state.moveSeq || 0) > (lastSeenSeq.seq || 0);
  lastSeenSeq = { gameId: game.id, seq: state.moveSeq };
  return sameGame && unseen;
}

function renderPlayers(state) {
  const best = Math.max(...M.alive(state).map(p => M.netWorth(state, p)));
  playersEl.innerHTML = state.players.map(p => {
    const out = state.out.includes(p);
    const turn = state.phase !== "finished" && state.turnPerson === p && !out;
    const dots = M.ownedBy(state, p).map(i => {
      const sq = M.SQUARES[i];
      const color = sq.group ? M.GROUPS[sq.group].color : sq.type === "station" ? "#6b7280" : "#a3a3b8";
      return `<i class="mo-dot${M.isMortgaged(state, i) ? " pledged" : ""}" style="background:${color}" title="${escapeHtml(sq.name)}"></i>`;
    }).join("");
    const jail = state.jail[p] !== null && !out ? ` <span title="im Gefängnis">⛓️</span>` : "";
    const card = state.jailCards[p].length ? ` <span title="Freikarte">🎫</span>` : "";
    return `
      <div class="mo-player${p === me() ? " me" : ""}${turn ? " turn" : ""}${out ? " out" : ""}${!out && M.netWorth(state, p) === best && state.players.length > 1 && best > M.START_CASH ? " lead" : ""}" style="--tok:${colorOf(state, p)}">
        <div class="mo-player-head"><span class="mo-token-dot"></span><span class="mo-player-name">${escapeHtml(nameFor(p))}</span>${jail}${card}</div>
        <div class="mo-player-cash">${out ? "pleite 💸" : money(state.cash[p])}</div>
        <div class="mo-dots">${dots}</div>
      </div>`;
  }).join("");
}

function squareHtml(state, index) {
  const sq = M.SQUARES[index];
  const { row, col } = cellOf(index);
  const owner = M.ownerOf(state, index);
  const houses = M.housesOn(state, index);
  const corner = index % 10 === 0;
  const pledged = M.isMortgaged(state, index);
  const band = sq.group ? `<span class="mo-band" style="background:${M.GROUPS[sq.group].color}">${houses >= 5 ? "H" : "▪".repeat(houses)}</span>` : "";
  const price = M.isOwnable(sq) ? `<span class="mo-price">${sq.price}</span>` : sq.type === "tax" ? `<span class="mo-price">${sq.amount}</span>` : "";
  const icon = sq.type === "street" ? "" : `<span class="mo-icon">${squareIcon(sq, index)}</span>`;
  const label = corner ? `<span class="mo-corner-name">${escapeHtml(sq.name)}</span>` : "";
  const ownerStyle = owner ? ` style="grid-row:${row};grid-column:${col};--owner:${colorOf(state, owner)}"` : ` style="grid-row:${row};grid-column:${col}"`;
  return `<button type="button" class="mo-sq t-${sq.type}${corner ? " corner" : ""}${owner ? " owned" : ""}${pledged ? " mortgaged" : ""}${selectedSquare === index ? " selected" : ""}" data-sq="${index}" aria-label="${escapeHtml(sq.name)}"${ownerStyle}>${band}${icon}${label}${price}</button>`;
}

function renderGrid(state, animate) {
  const squares = M.SQUARES.map((_, i) => squareHtml(state, i)).join("");
  const dice = state.dice ? state.dice : [0, 0];
  const rolled = animate && state.lastMove && state.lastMove.type === "roll";
  gridEl.innerHTML = `${squares}
    <div class="mo-center">
      <div class="mo-title">MONOPOLY</div>
      <div class="mo-dice${rolled ? " rolling" : ""}" aria-label="Würfel">
        ${state.dice ? dice.map(d => `<span class="mo-die">${dieFace(d)}</span>`).join("") : `<span class="mo-die">·</span><span class="mo-die">·</span>`}
      </div>
      <div class="mo-event" id="moEvent"></div>
    </div>`;
  tokenLayer = document.createElement("div");
  tokenLayer.className = "mo-tokens";
  gridEl.appendChild(tokenLayer);
  tokenEls.clear();
  state.players.forEach(p => {
    if (state.out.includes(p)) return;
    const el = document.createElement("span");
    el.className = "mo-tok";
    el.style.background = colorOf(state, p);
    el.textContent = GameRoom.botLabel(p).slice(0, 1).toUpperCase();
    el.title = p;
    tokenLayer.appendChild(el);
    tokenEls.set(p, el);
  });
  placeTokens(state, animate);
  gridEl.querySelectorAll(".mo-sq").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.sq);
      selectedSquare = selectedSquare === index ? null : index;
      const game = room.game;
      if (game) {
        gridEl.querySelectorAll(".mo-sq").forEach(b => b.classList.toggle("selected", Number(b.dataset.sq) === selectedSquare));
        renderInfo(game.state);
      }
    });
  });
  renderEvents(state);
}

function dieFace(value) {
  return ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value] || "·";
}

/* tokens stand where their player stands; a fresh move walks them square by square */
function tokenSpot(state, person, index) {
  const { row, col } = cellOf(index);
  const sharing = state.players.filter(p => !state.out.includes(p) && (shownPos[p] === undefined ? state.pos[p] : shownPos[p]) === index);
  const k = Math.max(0, sharing.indexOf(person));
  const dx = sharing.length > 1 ? (k % 2 ? 0.2 : -0.2) : 0;
  const dy = sharing.length > 2 ? (k > 1 ? 0.2 : -0.2) : 0;
  return { left: ((col - 0.5 + dx) / 11) * 100, top: ((row - 0.5 + dy) / 11) * 100 };
}

function setTokenAt(state, person, index) {
  const el = tokenEls.get(person);
  if (!el) return;
  shownPos[person] = index;
  const spot = tokenSpot(state, person, index);
  el.style.left = `${spot.left}%`;
  el.style.top = `${spot.top}%`;
}

function placeTokens(state, animate) {
  clearTimeout(walkTimer);
  const walking = [];
  state.players.forEach(p => {
    if (state.out.includes(p)) return;
    const from = shownPos[p];
    const to = state.pos[p];
    if (animate && from !== undefined && from !== to) {
      const forward = (to - from + 40) % 40;
      const jail = state.jail[p] !== null && to === M.JAIL_POS;
      if (forward <= 12 && !jail) {
        walking.push({ person: p, from, steps: forward });
        setTokenAt(state, p, from);
        return;
      }
    }
    setTokenAt(state, p, to);
  });
  /* tokens that did not walk get their final place first, then the others step along */
  state.players.forEach(p => { if (!state.out.includes(p) && !walking.some(w => w.person === p)) setTokenAt(state, p, state.pos[p]); });
  if (!walking.length) return;
  let step = 0;
  const maxSteps = Math.max(...walking.map(w => w.steps));
  const tick = () => {
    step++;
    walking.forEach(w => {
      if (step <= w.steps) setTokenAt(state, w.person, (w.from + step) % 40);
    });
    if (step < maxSteps) walkTimer = setTimeout(tick, WALK_MS);
  };
  walkTimer = setTimeout(tick, WALK_MS);
}

/* ---------- what just happened ---------- */

function squareName(index) {
  return M.SQUARES[index] ? M.SQUARES[index].name : "";
}

function describe(e) {
  const you = p => p === me();
  const who = p => nameFor(p);
  switch (e.type) {
    case "roll": return `🎲 ${who(e.person)} ${you(e.person) ? "würfelst" : "würfelt"} ${e.dice[0]} + ${e.dice[1]} = ${e.dice[0] + e.dice[1]}${e.dice[0] === e.dice[1] ? " – Pasch!" : ""}`;
    case "go": return `💰 ${who(e.person)} ${you(e.person) ? "bekommst" : "bekommt"} ${money(e.amount)} fürs Überqueren von Los`;
    case "buy": return `🏠 ${who(e.person)} ${you(e.person) ? "kaufst" : "kauft"} ${squareName(e.square)} für ${money(e.amount)}`;
    case "decline": return `${squareName(e.square)} bleibt bei der Bank.`;
    case "cant-afford": return `${who(e.person)} ${you(e.person) ? "kannst" : "kann"} sich ${squareName(e.square)} nicht leisten.`;
    case "rent": return `${you(e.person) ? "Du zahlst" : `${e.person} zahlt`} ${money(e.amount)} Miete an ${you(e.owner) ? "dich" : e.owner}.`;
    case "tax": return `💸 ${you(e.person) ? "Du zahlst" : `${e.person} zahlt`} ${money(e.amount)} (${squareName(e.square)}).`;
    case "card": return `${e.deck === "chance" ? "❓" : "📦"} ${e.text}`;
    case "jail": return `⛓️ ${who(e.person)} ${you(e.person) ? "gehst" : "geht"} ins Gefängnis.`;
    case "jail-stay": return `⛓️ ${who(e.person)} ${you(e.person) ? "bleibst" : "bleibt"} im Gefängnis (${e.turns}. Versuch).`;
    case "jail-free": {
      const how = e.how === "doubles" ? " (Pasch)" : e.how === "card" ? " (Freikarte)" : e.how === "fine" ? " und zahlt 50 € Strafe" : " (50 € gezahlt)";
      return `🔓 ${who(e.person)} ${you(e.person) ? "kommst" : "kommt"} frei${how}.`;
    }
    case "build": return `🏗️ ${who(e.person)} ${you(e.person) ? "baust" : "baut"} auf ${squareName(e.square)} ${e.houses >= 5 ? "ein Hotel" : `Haus Nr. ${e.houses}`}.`;
    case "sell": return `${who(e.person)} ${you(e.person) ? "verkaufst" : "verkauft"} ein Haus auf ${squareName(e.square)} (+${money(e.amount)}).`;
    case "forced-sale": return `Ein Haus auf ${squareName(e.square)} muss weg (+${money(e.amount)}).`;
    case "mortgage": return `🏦 ${who(e.person)} ${you(e.person) ? "nimmst" : "nimmt"} auf ${squareName(e.square)} eine Hypothek auf (+${money(e.amount)}).`;
    case "redeem": return `🏦 ${who(e.person)} löst die Hypothek auf ${squareName(e.square)} ab (−${money(e.amount)}).`;
    case "debt": return `⚠️ ${you(e.person) ? "Du schuldest" : `${e.person} schuldet`} ${money(e.amount)} und muss Geld auftreiben.`;
    case "debt-paid": return `✅ ${you(e.person) ? "Du hast" : `${e.person} hat`} die Schulden bezahlt.`;
    case "bankrupt": return `💥 ${who(e.person)} ${you(e.person) ? "bist" : "ist"} pleite!`;
    case "trade-offer": return `🤝 ${who(e.person)} ${you(e.person) ? "machst" : "macht"} ${you(e.to) ? "dir" : e.to} ein Angebot.`;
    case "trade-done": return `🤝 Tausch zwischen ${you(e.person) ? "dir" : e.person} und ${you(e.to) ? "dir" : e.to} abgemacht.`;
    case "trade-no": return `Das Angebot von ${you(e.from) ? "dir" : e.from} wurde nicht angenommen.`;
    default: return null;
  }
}

function renderEvents(state) {
  const el = document.getElementById("moEvent");
  const events = (state.lastMove && state.lastMove.events) || [];
  const lines = events.map(describe).filter(Boolean).slice(-4);
  el.innerHTML = lines.map(line => `<span>${escapeHtml(line)}</span>`).join("");
}

/* ---------- square details ---------- */

function renderInfo(state) {
  if (selectedSquare === null) {
    infoEl.hidden = true;
    return;
  }
  const index = selectedSquare;
  const sq = M.SQUARES[index];
  infoEl.hidden = false;
  const owner = M.ownerOf(state, index);
  let body = "";
  if (sq.type === "street") {
    const rows = ["Miete", "mit Haus", "mit 2 Häusern", "mit 3 Häusern", "mit 4 Häusern", "mit Hotel"];
    body = `<table>${sq.rent.map((r, i) => `<tr class="${M.housesOn(state, index) === i ? "now" : ""}"><td>${rows[i]}</td><td>${money(r)}</td></tr>`).join("")}</table>
      <p>Besitzt du alle Straßen dieser Farbe, ist die Miete ohne Haus doppelt. Haus: ${money(sq.houseCost)}.</p>`;
  } else if (sq.type === "station") {
    body = `<p>Miete: 25 € mit einem Bahnhof, 50 € mit zwei, 100 € mit drei, 200 € mit allen vier.</p>`;
  } else if (sq.type === "utility") {
    body = `<p>Miete: 4 × Augenzahl – mit beiden Werken 10 × Augenzahl.</p>`;
  } else if (sq.type === "tax") {
    body = `<p>Hier zahlst du ${money(sq.amount)} an die Bank.</p>`;
  } else if (sq.type === "go") {
    body = `<p>Jedes Mal, wenn du über Los kommst, bekommst du ${money(M.GO_BONUS)}.</p>`;
  } else if (sq.type === "jail") {
    body = `<p>Hier sitzen (oder nur zu Besuch sein). Raus kommst du mit Pasch, ${money(M.JAIL_FINE)} oder einer Freikarte.</p>`;
  } else if (sq.type === "gotojail") {
    body = `<p>Direkt ins Gefängnis – ohne über Los zu gehen.</p>`;
  } else if (sq.type === "parking") {
    body = `<p>Ausruhen. Hier passiert nichts.</p>`;
  } else {
    body = `<p>Zieh eine Karte.</p>`;
  }
  const head = sq.group ? `<span class="mo-info-band" style="background:${M.GROUPS[sq.group].color}"></span>` : "";
  infoEl.innerHTML = `
    <div class="mo-info-head">${head}<strong>${escapeHtml(sq.name)}</strong>${M.isOwnable(sq) ? `<span>${money(sq.price)}</span>` : ""}</div>
    ${owner && M.isMortgaged(state, index) ? `<p class="mo-info-owner">Gehört ${you(owner)} – mit Hypothek (keine Miete)</p>` : owner ? `<p class="mo-info-owner">Gehört ${you(owner)} – ${M.housesOn(state, index) >= 5 ? "mit Hotel" : M.housesOn(state, index) > 0 ? `${M.housesOn(state, index)} ${M.housesOn(state, index) === 1 ? "Haus" : "Häuser"}` : "ohne Häuser"}</p>` : M.isOwnable(sq) ? `<p class="mo-info-owner">Noch frei</p>` : ""}
    ${body}
    ${M.isOwnable(sq) ? `<p>Hypothek: ${money(M.mortgageValue(index))} – zurück für ${money(M.redeemCost(index))}.</p>` : ""}`;
  infoEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  function you(p) { return p === me() ? "dir" : p; }
}

/* ---------- status line and buttons ---------- */

function button(label, className, onClick, id) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  if (id) b.id = id;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function renderStatus(state) {
  const turn = state.turnPerson;
  if (state.phase === "finished") {
    statusEl.textContent = describeWinners(state.result, me());
  } else if (state.out.includes(me())) {
    statusEl.textContent = `Du bist pleite – ${turn} ist dran …`;
  } else if (state.phase === "debt") {
    statusEl.textContent = state.debt.person === me()
      ? "Du musst Geld auftreiben 💸"
      : `${state.debt.person} muss Geld auftreiben …`;
  } else if (state.trade && state.trade.to === me()) {
    statusEl.textContent = `${state.trade.from} macht dir ein Angebot 🤝`;
  } else if (turn === me()) {
    statusEl.textContent = state.phase === "roll" ? (state.jail[me()] !== null ? "Du sitzt im Gefängnis ⛓️" : "Du bist dran: würfeln! 🎲")
      : state.phase === "buy" ? `Möchtest du ${squareName(state.offer)} kaufen?`
        : "Bauen, handeln oder Zug beenden.";
  } else {
    statusEl.textContent = `${turn} ist dran …`;
  }
}

function renderControls(state) {
  actionsEl.innerHTML = "";
  if (state.phase === "finished") {
    renderSummary(state);
    return;
  }
  const mine = state.turnPerson === me() && !state.out.includes(me());

  if (state.trade) renderTradeBanner(state);

  if (!mine) return;

  if (state.phase === "debt") {
    renderDebt(state);
    return;
  }

  if (state.phase === "roll") {
    if (state.jail[me()] !== null) {
      if (state.jailCards[me()].length) actionsEl.appendChild(button("Freikarte benutzen 🎫", "btn btn-secondary btn-block", () => room.dispatch(M.useJailCard), "moJailCard"));
      if (state.cash[me()] >= M.JAIL_FINE) actionsEl.appendChild(button(`${money(M.JAIL_FINE)} zahlen`, "btn btn-secondary btn-block", () => room.dispatch(M.payJail), "moJailPay"));
      actionsEl.appendChild(button("Pasch versuchen 🎲", "btn btn-block", () => room.dispatch(M.roll), "moRoll"));
    } else {
      actionsEl.appendChild(button(state.rolledDoubles ? "Nochmal würfeln 🎲" : "Würfeln 🎲", "btn btn-block", () => room.dispatch(M.roll), "moRoll"));
    }
  } else if (state.phase === "buy") {
    const sq = M.SQUARES[state.offer];
    actionsEl.appendChild(button(`Kaufen für ${money(sq.price)} 🏠`, "btn btn-block", () => room.dispatch(M.buy), "moBuy"));
    actionsEl.appendChild(button("Nicht kaufen", "btn btn-secondary btn-block", () => room.dispatch(M.decline), "moDecline"));
  } else if (state.phase === "after") {
    const again = state.rolledDoubles && state.jail[me()] === null;
    actionsEl.appendChild(button(again ? "Pasch! Nochmal würfeln 🎲" : "Zug beenden ✓", "btn btn-block", () => room.dispatch(M.endTurn), "moEnd"));
  }
}

function renderDebt(state) {
  const total = M.debtTotal(state.debt);
  const missing = total - state.cash[me()];
  const creditors = [...new Set(state.debt.owed.map(o => o.to))];
  const to = creditors.length === 1 && creditors[0] ? ` an ${creditors[0]}` : "";
  const box = document.createElement("div");
  box.className = "mo-debt-box card";
  box.innerHTML = `
    <h3>⚠️ Du schuldest ${money(total)}${escapeHtml(to)}</h3>
    <p>Dir fehlen noch <strong>${money(missing)}</strong>. Verkaufe Häuser oder nimm Hypotheken auf Straßen auf (unten bei „Meine Straßen“) – sobald das Geld reicht, wird automatisch bezahlt.</p>
    <p>Mit allem, was du verkaufen und beleihen kannst, kommst du auf ${money(M.assets(state, me()))}.</p>`;
  const row = document.createElement("div");
  row.className = "mo-offer-actions";
  row.appendChild(button("Aufgeben (pleite) 💥", "btn btn-secondary", async () => {
    if (await confirmDialog("Du verlierst alles und scheidest aus. Wirklich aufgeben?")) room.dispatch(M.declareBankrupt);
  }, "moGiveUp"));
  box.appendChild(row);
  actionsEl.appendChild(box);
}

function tradeText(state, trade) {
  const names = list => list.length ? list.map(squareName).join(", ") : "nichts";
  const cash = trade.cash > 0 ? ` + ${money(trade.cash)} von ${trade.from === me() ? "dir" : trade.from}` : trade.cash < 0 ? ` + ${money(-trade.cash)} von ${trade.to === me() ? "dir" : trade.to}` : "";
  return `${nameFor(trade.from)} gibt: ${names(trade.give)} – ${nameFor(trade.to)} gibt: ${names(trade.get)}${cash}`;
}

function renderTradeBanner(state) {
  const trade = state.trade;
  const box = document.createElement("div");
  box.className = "mo-offer card";
  box.innerHTML = `<h3>🤝 Angebot</h3><p>${escapeHtml(tradeText(state, trade))}</p>`;
  const row = document.createElement("div");
  row.className = "mo-offer-actions";
  if (trade.to === me()) {
    const problem = M.tradeProblem(state, trade);
    if (problem) box.querySelector("p").insertAdjacentHTML("afterend", `<p class="mo-warn">${escapeHtml(problem)}</p>`);
    row.append(
      button("Annehmen ✓", "btn", () => room.dispatch(M.acceptTrade), "moTradeYes"),
      button("Ablehnen", "btn btn-secondary", () => room.dispatch(M.declineTrade), "moTradeNo")
    );
  } else if (trade.from === me()) {
    box.insertAdjacentHTML("beforeend", `<p class="mo-wait">Warte auf ${escapeHtml(trade.to)} …</p>`);
    row.append(button("Zurückziehen", "btn btn-secondary", () => room.dispatch(M.declineTrade), "moTradeBack"));
  } else {
    box.insertAdjacentHTML("beforeend", `<p class="mo-wait">${escapeHtml(trade.to)} überlegt …</p>`);
  }
  box.appendChild(row);
  actionsEl.appendChild(box);
}

function renderSummary(state) {
  const order = state.players.slice().sort((a, b) => (state.out.includes(a) ? -1 : 0) - (state.out.includes(b) ? -1 : 0) || M.netWorth(state, b) - M.netWorth(state, a));
  const rows = order.map(p => `<tr><td>${escapeHtml(nameFor(p))}${state.out.includes(p) ? " 💥" : state.result.winners.includes(p) ? " 👑" : ""}</td><td>${state.out.includes(p) ? "pleite" : money(M.netWorth(state, p))}</td></tr>`).join("");
  const box = document.createElement("div");
  box.className = "mo-summary card";
  box.innerHTML = `
    <h3>Endstand 🏁</h3>
    <p class="mo-sub">Vermögen = Geld + Straßen + Häuser</p>
    <table><tbody>${rows}</tbody></table>
    <div class="mo-next"></div>`;
  actionsEl.appendChild(box);
  room.renderReady(box.querySelector(".mo-next"), state, { label: "Neue Partie 🎩", nextFn: M.newGame });
  if (state.result.winner === me() && cheeredGame !== state.gameNo) {
    cheeredGame = state.gameNo;
    celebrate(30);
  }
}

let cheeredGame = null;

/* ---------- my streets: build and sell ---------- */

function renderMine(state) {
  const person = me();
  if (!state.players.includes(person) || state.out.includes(person)) {
    mineEl.innerHTML = "";
    return;
  }
  const owned = M.ownedBy(state, person);
  if (!owned.length) {
    mineEl.innerHTML = `<h3>Meine Straßen</h3><p class="mo-empty">Du besitzt noch nichts. Lande auf einer freien Straße und kaufe sie!</p>`;
    return;
  }
  const mineTurn = state.turnPerson === person;
  const canAct = mineTurn && (state.phase === "roll" || state.phase === "after");
  const inDebt = mineTurn && state.phase === "debt";
  const rows = owned.map(i => {
    const sq = M.SQUARES[i];
    const houses = M.housesOn(state, i);
    const pledged = M.isMortgaged(state, i);
    const color = sq.group ? M.GROUPS[sq.group].color : sq.type === "station" ? "#6b7280" : "#a3a3b8";
    const full = sq.group && M.ownsGroup(state, person, sq.group);
    const label = pledged ? "Hypothek 🏦" : houses >= 5 ? "Hotel 🏨" : houses > 0 ? "🏠".repeat(houses) : full ? "Farbset ✓" : "";
    const buttons = [];
    if ((canAct || inDebt) && houses > 0) {
      buttons.push(`<button type="button" class="mo-mini sell" data-sell="${i}" ${M.canSell(state, person, i) ? "disabled" : ""}>Haus verkaufen +${money(Math.floor(sq.houseCost / 2))}</button>`);
    }
    if (canAct && sq.type === "street" && full && !pledged) {
      buttons.push(`<button type="button" class="mo-mini" data-build="${i}" ${M.canBuild(state, person, i) ? "disabled" : ""}>Haus bauen −${money(sq.houseCost)}</button>`);
    }
    if ((canAct || inDebt) && !pledged && houses === 0) {
      buttons.push(`<button type="button" class="mo-mini sell" data-mortgage="${i}" ${M.canMortgage(state, person, i) ? "disabled" : ""}>Hypothek +${money(M.mortgageValue(i))}</button>`);
    }
    if (canAct && pledged) {
      buttons.push(`<button type="button" class="mo-mini" data-redeem="${i}" ${M.canRedeem(state, person, i) ? "disabled" : ""}>Auslösen −${money(M.redeemCost(i))}</button>`);
    }
    return `<li class="${pledged ? "mortgaged" : ""}"><i class="mo-dot big" style="background:${color}"></i><span class="mo-own-name">${escapeHtml(sq.name)}</span><span class="mo-own-state">${label}</span>${buttons.length ? `<span class="mo-build">${buttons.join("")}</span>` : ""}</li>`;
  }).join("");
  mineEl.innerHTML = `<h3>Meine Straßen</h3><ul class="mo-own">${rows}</ul>`;
  const wire = (attr, fn) => mineEl.querySelectorAll(`[${attr}]`).forEach(b => b.addEventListener("click", () => room.dispatch(fn, Number(b.getAttribute(attr)))));
  wire("data-build", M.build);
  wire("data-sell", M.sellHouse);
  wire("data-mortgage", M.mortgage);
  wire("data-redeem", M.redeem);
}

/* ---------- trading ---------- */

function renderTrade(state) {
  const person = me();
  const canPropose = state.phase !== "finished" && state.players.includes(person) && !state.out.includes(person)
    && state.turnPerson === person && (state.phase === "roll" || state.phase === "after") && !state.trade;
  if (!canPropose) {
    tradeDraft = null;
    tradeEl.innerHTML = "";
    return;
  }
  const others = M.alive(state).filter(p => p !== person);
  if (!tradeDraft) {
    tradeEl.innerHTML = `<button type="button" class="btn btn-secondary btn-block" id="moTradeOpen">🤝 Handeln</button>`;
    document.getElementById("moTradeOpen").addEventListener("click", () => {
      tradeDraft = { to: others[0], give: [], get: [], pay: 0, ask: 0 };
      renderTrade(room.game.state);
    });
    return;
  }
  if (!others.includes(tradeDraft.to)) tradeDraft.to = others[0];
  const mine = M.ownedBy(state, person).filter(i => M.tradable(state, i));
  const theirs = M.ownedBy(state, tradeDraft.to).filter(i => M.tradable(state, i));
  const chips = (list, key) => list.length
    ? list.map(i => `<button type="button" class="mo-pick${tradeDraft[key].includes(i) ? " on" : ""}" data-key="${key}" data-sq="${i}"><i class="mo-dot" style="background:${M.SQUARES[i].group ? M.GROUPS[M.SQUARES[i].group].color : "#6b7280"}"></i>${escapeHtml(M.SQUARES[i].name)}</button>`).join("")
    : `<span class="mo-empty">nichts zum Tauschen</span>`;
  tradeEl.innerHTML = `
    <h3>🤝 Angebot machen</h3>
    ${others.length > 1 ? `<div class="mo-who">${others.map(p => `<button type="button" class="mo-pick${p === tradeDraft.to ? " on" : ""}" data-to="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}</div>` : `<p class="mo-sub">Mit ${escapeHtml(tradeDraft.to)}</p>`}
    <p class="mo-label">Du gibst</p>
    <div class="mo-picks">${chips(mine, "give")}</div>
    <p class="mo-label">Du bekommst</p>
    <div class="mo-picks">${chips(theirs, "get")}</div>
    <div class="mo-cash">
      <label>Du zahlst dazu <input type="number" inputmode="numeric" min="0" step="10" id="moPay" value="${tradeDraft.pay || ""}" placeholder="0"></label>
      <label>Du bekommst dazu <input type="number" inputmode="numeric" min="0" step="10" id="moAsk" value="${tradeDraft.ask || ""}" placeholder="0"></label>
    </div>
    <div class="mo-offer-actions">
      <button type="button" class="btn" id="moTradeSend">Angebot senden</button>
      <button type="button" class="btn btn-secondary" id="moTradeCancel">Abbrechen</button>
    </div>`;
  tradeEl.querySelectorAll("[data-to]").forEach(b => b.addEventListener("click", () => {
    tradeDraft.to = b.dataset.to;
    tradeDraft.get = [];
    renderTrade(room.game.state);
  }));
  tradeEl.querySelectorAll("[data-sq]").forEach(b => b.addEventListener("click", () => {
    const list = tradeDraft[b.dataset.key];
    const index = Number(b.dataset.sq);
    if (list.includes(index)) list.splice(list.indexOf(index), 1);
    else list.push(index);
    renderTrade(room.game.state);
  }));
  const readMoney = id => Math.max(0, Math.floor(Number(document.getElementById(id).value) || 0));
  document.getElementById("moPay").addEventListener("input", () => { tradeDraft.pay = readMoney("moPay"); });
  document.getElementById("moAsk").addEventListener("input", () => { tradeDraft.ask = readMoney("moAsk"); });
  document.getElementById("moTradeCancel").addEventListener("click", () => {
    tradeDraft = null;
    renderTrade(room.game.state);
  });
  document.getElementById("moTradeSend").addEventListener("click", () => {
    const draft = tradeDraft;
    const cash = (draft.pay || 0) - (draft.ask || 0);
    if (draft.pay && draft.ask) {
      showToast("Entweder du zahlst dazu – oder du bekommst dazu.", "error");
      return;
    }
    tradeDraft = null;
    room.dispatch(M.proposeTrade, draft.to, draft.give, draft.get, cash);
  });
}

room.start();
