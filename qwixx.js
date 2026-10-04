const boardEl = document.getElementById("qxBoard");
const scoreEl = document.getElementById("qxScore");
const oppNameEl = document.getElementById("qxOppName");
const oppPenaltiesEl = document.getElementById("qxOppPenalties");
const oppTotalEl = document.getElementById("qxOppTotal");
const oppSheetEl = document.getElementById("qxOppSheet");
const diceEl = document.getElementById("qxDice");
const eventEl = document.getElementById("qxEvent");
const statusEl = document.getElementById("qxStatus");
const actionsEl = document.getElementById("qxActions");
const sheetEl = document.getElementById("qxSheet");
const penaltiesEl = document.getElementById("qxPenalties");
const pointsEl = document.getElementById("qxPoints");

const Q = QwixxEngine;
const COLOR_NAME = { red: "Rot", yellow: "Gelb", green: "Grün", blue: "Blau" };
const COLOR_ADJ = { red: "rote", yellow: "gelbe", green: "grüne", blue: "blaue" };
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const ROLL_FLICKER_MS = 520;

let lastAnimatedMove = { gameId: null, seq: null };

const room = GameRoom.create({
  table: "qwixx_games",
  title: "Qwixx",
  icon: "🎲",
  url: "qwixx.html",
  lobbyEl: document.getElementById("qxLobby"),
  boardEl,
  leaveBtn: document.getElementById("qxLeaveBtn"),
  createState: (host, guest, option) => Q.createInitialState(host, guest, option),
  isFinished: state => state.phase === "finished",
  renderBoard,
  startOptions: [
    { value: "classic", label: "Klassisch", hint: "Rot & Gelb 2–12, Grün & Blau 12–2" },
    { value: "colors", label: "Farben gemixxt", hint: "Zahlen in Folge, Farben wechseln" },
    { value: "numbers", label: "Zahlen gemixxt", hint: "Einfarbig, Zahlen durcheinander" },
    { value: "random", label: "Zufallsblock", hint: "Jede Partie ein neuer Block" }
  ]
});

/* Each move is animated once per device; after a reload nothing old is replayed. */
function takeUnseenMove(game) {
  const state = game.state;
  const sameGame = lastAnimatedMove.gameId === game.id;
  const unseen = sameGame && (state.moveSeq || 0) > (lastAnimatedMove.seq || 0);
  lastAnimatedMove = { gameId: game.id, seq: state.moveSeq };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return unseen && !reducedMotion ? state.lastMove : null;
}

function renderBoard(game) {
  const state = game.state;
  const opp = room.opponentOf(game);
  const move = takeUnseenMove(game);

  renderScore(state, opp);
  renderOpponent(state, opp, move);
  renderDice(state, move);
  renderEvent(state);
  renderStatus(state, opp);
  renderSheet(state, move);
}

/* ---------- score + opponent ---------- */

function renderScore(state, opp) {
  const me = room.person;
  const wins = state.wins || {};
  scoreEl.innerHTML = `
    <span>Partie <strong>${state.gameNo}</strong> · ${escapeHtml(Q.BLOCKS[state.blockType])}</span>
    <span>Siege: Du <strong>${wins[me] || 0}</strong> : <strong>${wins[opp] || 0}</strong> ${escapeHtml(opp || "")}</span>
  `;
}

function renderOpponent(state, opp, move) {
  oppNameEl.textContent = opp || "Gegner";
  const oppActs = (state.phase === "white" && !state.white[opp].done) ||
    (state.phase !== "white" && state.phase !== "finished" && state.active === opp);
  oppNameEl.classList.toggle("active", oppActs);

  const sheet = state.sheets[opp];
  oppPenaltiesEl.textContent = "✕".repeat(sheet.penalties);
  oppPenaltiesEl.title = `${sheet.penalties} Fehlwürfe`;
  oppTotalEl.textContent = `${Q.scoreOf(state, opp).total} Pkt.`;

  oppSheetEl.innerHTML = "";
  state.layout.forEach((cells, r) => {
    const rowEl = document.createElement("div");
    rowEl.className = "qx-mini-row";
    rowEl.classList.toggle("locked", state.lockedRows.includes(r));
    const marks = sheet.marks[r];
    const last = marks.length ? marks[marks.length - 1] : -1;

    cells.forEach((cell, i) => {
      const el = document.createElement("div");
      el.className = `qx-mini-cell qx-${cell.c}`;
      el.textContent = cell.n;
      const crossed = marks.includes(i);
      el.classList.toggle("crossed", crossed);
      el.classList.toggle("skipped", !crossed && i < last);
      if (crossed && move && move.type === "cross" && move.person === opp && move.row === r && move.index === i) {
        el.classList.add("just-crossed");
      }
      rowEl.appendChild(el);
    });

    const lock = document.createElement("div");
    lock.className = `qx-mini-cell qx-${Q.lockColorOf(cells)}`;
    lock.textContent = "🔒";
    lock.classList.toggle("crossed", sheet.locked.includes(r));
    rowEl.appendChild(lock);
    oppSheetEl.appendChild(rowEl);
  });
}

/* ---------- dice ---------- */

function dieEl(value, colorKey, extraClass) {
  const die = document.createElement("span");
  die.className = `qx-die${colorKey ? ` qx-${colorKey}` : ""}${extraClass ? ` ${extraClass}` : ""}`;
  setPips(die, value);
  return die;
}

function setPips(die, value) {
  die.innerHTML = "";
  const on = PIPS[value] || [];
  for (let i = 1; i <= 9; i++) {
    const pip = document.createElement("span");
    pip.className = "qx-pip";
    pip.style.visibility = on.includes(i) ? "visible" : "hidden";
    die.appendChild(pip);
  }
  die.dataset.value = value || "";
  die.setAttribute("aria-label", value ? `Würfel ${value}` : "Würfel");
}

function renderDice(state, move) {
  const me = room.person;
  const removed = Q.removedColors(state);
  const dice = state.dice;
  const canRoll = state.phase === "roll" && state.active === me;

  diceEl.innerHTML = "";
  diceEl.classList.toggle("can-roll", canRoll);
  diceEl.disabled = !canRoll;
  diceEl.onclick = canRoll ? () => room.dispatch(Q.roll) : null;
  diceEl.setAttribute("aria-label", canRoll ? "Würfeln" : "Würfel");

  const whiteUsed = state.phase === "white";
  const colorUsed = state.phase === "color";
  const blank = !dice;

  ["w1", "w2"].forEach(key => {
    diceEl.appendChild(dieEl(blank ? 6 : dice[key], null, [blank ? "blank" : "", whiteUsed ? "used" : ""].join(" ").trim()));
  });
  const gap = document.createElement("span");
  gap.className = "qx-die-gap";
  diceEl.appendChild(gap);
  Q.COLORS.forEach(color => {
    const out = removed.includes(color);
    const classes = [out ? "removed" : "", blank && !out ? "blank" : "", colorUsed && !out ? "used" : ""].join(" ").trim();
    diceEl.appendChild(dieEl(out || blank ? 6 : dice[color], color, classes));
  });

  if (move && move.type === "roll") flickerDice();
}

/* the dice show random faces while tumbling, then settle on the real throw */
function flickerDice() {
  const dice = [...diceEl.querySelectorAll(".qx-die:not(.removed)")];
  const finals = dice.map(d => Number(d.dataset.value));
  diceEl.classList.remove("rolling");
  void diceEl.offsetWidth;
  diceEl.classList.add("rolling");
  const started = performance.now();
  const timer = setInterval(() => {
    const done = performance.now() - started > ROLL_FLICKER_MS;
    dice.forEach((die, i) => setPips(die, done ? finals[i] : 1 + Math.floor(Math.random() * 6)));
    if (done) clearInterval(timer);
  }, 70);
}

/* ---------- event + status ---------- */

/* everything that happened in the latest roll, so a lock or penalty is never hidden by the next tap */
function describeEntry(state, entry) {
  const mine = entry.person === room.person;
  if (entry.type === "penalty") return mine ? "Fehlwurf für dich (−5)." : `Fehlwurf für ${entry.person} (−5).`;

  const cell = state.layout[entry.row][entry.index];
  let text = `${mine ? "Du hast" : `${entry.person} hat`} die ${COLOR_ADJ[cell.c]} ${cell.n} angekreuzt`;
  if (entry.locks) {
    const color = Q.lockColorOf(state.layout[entry.row]);
    text += ` und abgeschlossen – der ${COLOR_ADJ[color]} Würfel ist raus!`;
  }
  return `${text}.`;
}

function renderEvent(state) {
  eventEl.textContent = state.phase === "finished" ? "" : (state.log || []).map(entry => describeEntry(state, entry)).join(" ");
}

function passButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-secondary btn-sm";
  button.textContent = label;
  button.addEventListener("click", () => room.dispatch(action));
  actionsEl.appendChild(button);
}

function renderStatus(state, opp) {
  const me = room.person;
  actionsEl.innerHTML = "";

  if (state.phase === "finished") {
    renderResult(state, opp);
    return;
  }

  if (state.phase === "roll") {
    statusEl.textContent = state.active === me
      ? "Du bist dran – tippe auf die Würfel!"
      : `${opp} würfelt gleich…`;
    return;
  }

  /* no hints about which fields fit – working that out is the game */
  if (state.phase === "white") {
    if (state.white[me].done) {
      statusEl.textContent = `Warte auf ${opp}…`;
      return;
    }
    statusEl.textContent = "Die beiden weißen Würfel gelten für alle: Kreuz ihre Summe an – oder lass sie aus.";
    passButton("Nichts ankreuzen", Q.passWhite);
    return;
  }

  if (state.active !== me) {
    statusEl.textContent = `${opp} kombiniert noch Farben…`;
    return;
  }
  statusEl.textContent = "Jetzt du: ein weißer + ein farbiger Würfel in der Farbe der Reihe.";
  passButton(state.activeCrossed ? "Fertig" : "Nichts ankreuzen – Fehlwurf (−5)", Q.passColor);
}

function renderResult(state, opp) {
  const me = room.person;
  const { scores, winner } = state.result;
  statusEl.textContent = winner === me ? "🏆 Du hast gewonnen!" : winner ? `🏆 ${winner} hat gewonnen!` : "Unentschieden!";

  const classic = state.blockType === "classic" || state.blockType === "numbers";
  const rowLabel = r => {
    const color = Q.lockColorOf(state.layout[r]);
    return `<span class="qx-dot qx-${color}"></span> ${classic ? COLOR_NAME[color] : `Reihe ${r + 1}`}`;
  };
  const rows = state.layout.map((_, r) =>
    `<tr><td>${rowLabel(r)}</td><td>${scores[me].rows[r]}</td><td>${scores[opp].rows[r]}</td></tr>`).join("");

  const wins = state.wins || {};
  const table = document.createElement("table");
  table.className = "qx-result";
  table.innerHTML = `
    <thead><tr><th></th><th>Du</th><th>${escapeHtml(opp || "Gegner")}</th></tr></thead>
    <tbody>
      ${rows}
      <tr><td>Fehlwürfe</td><td>−${scores[me].penalties}</td><td>−${scores[opp].penalties}</td></tr>
      <tr><td>Gesamt</td><td class="total">${scores[me].total}</td><td class="total">${scores[opp].total}</td></tr>
      <tr><td>Siege</td><td>${wins[me] || 0}</td><td>${wins[opp] || 0}</td></tr>
    </tbody>
  `;
  actionsEl.appendChild(table);

  const again = document.createElement("button");
  again.type = "button";
  again.className = "btn btn-block";
  again.textContent = state.blockType === "random" ? "Revanche mit neuem Zufallsblock 🎲" : "Revanche 🎲";
  again.addEventListener("click", () => room.dispatch(Q.rematch));
  actionsEl.appendChild(again);
}

/* ---------- own sheet ---------- */

function currentOptions(state) {
  if (state.phase === "white") return Q.whiteOptions(state, room.person);
  if (state.phase === "color") return Q.colorOptions(state, room.person);
  return [];
}

/* explains a wrong tap by the rule it breaks – never by naming the fields that would work */
function whyNot(state, row, index) {
  const me = room.person;
  const marks = state.sheets[me].marks[row];
  const cells = state.layout[row];
  const last = marks.length ? marks[marks.length - 1] : -1;
  if (state.lockedRows.includes(row)) return "Diese Reihe ist schon abgeschlossen.";
  if (index <= last) return "Links von deinem letzten Kreuz geht in dieser Reihe nichts mehr.";
  if (index === cells.length - 1 && marks.length < Q.MIN_CROSSES_TO_LOCK) {
    return `Zum Abschließen brauchst du mindestens ${Q.MIN_CROSSES_TO_LOCK} Kreuze in der Reihe.`;
  }
  if (state.phase === "white") return "Diese Zahl ist nicht die Summe der weißen Würfel.";
  return `Diese Zahl ergibt sich nicht aus einem weißen und dem ${COLOR_ADJ[cells[index].c]}n Würfel.`;
}

function rejectTap(button, reason) {
  button.classList.remove("nope");
  void button.offsetWidth;
  button.classList.add("nope");
  setTimeout(() => button.classList.remove("nope"), 450);
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  showToast(reason, "error");
}

function renderSheet(state, move) {
  const me = room.person;
  const sheet = state.sheets[me];
  const options = new Set(currentOptions(state).map(o => `${o.row}-${o.index}`));
  const canAct = (state.phase === "white" && !state.white[me].done) || (state.phase === "color" && state.active === me);
  const crossAction = state.phase === "white" ? Q.crossWhite : Q.crossColor;
  const myMove = move && move.person === me ? move : null;

  sheetEl.innerHTML = "";
  state.layout.forEach((cells, r) => {
    const rowEl = document.createElement("div");
    rowEl.className = "qx-row";
    rowEl.classList.toggle("locked", state.lockedRows.includes(r));
    if (move && move.type === "cross" && move.locks && move.row === r) rowEl.classList.add("just-locked");

    const marks = sheet.marks[r];
    const last = marks.length ? marks[marks.length - 1] : -1;

    cells.forEach((cell, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `qx-cell qx-${cell.c}`;
      button.textContent = cell.n;
      const crossed = marks.includes(i);
      button.classList.toggle("crossed", crossed);
      button.classList.toggle("skipped", !crossed && i < last);
      button.classList.toggle("qx-last", i === cells.length - 1);
      if (crossed && myMove && myMove.type === "cross" && myMove.row === r && myMove.index === i) button.classList.add("just-crossed");

      const label = `${COLOR_NAME[cell.c]} ${cell.n}`;
      if (canAct && !crossed) {
        button.classList.add("pickable");
        button.setAttribute("aria-label", `${label} ankreuzen`);
        button.addEventListener("click", () => {
          if (options.has(`${r}-${i}`)) room.dispatch(crossAction, r, i);
          else rejectTap(button, whyNot(state, r, i));
        });
      } else {
        button.disabled = true;
        button.setAttribute("aria-label", crossed ? `${label}, angekreuzt` : label);
      }
      rowEl.appendChild(button);
    });

    const lock = document.createElement("span");
    lock.className = `qx-lock qx-${Q.lockColorOf(cells)}`;
    lock.textContent = "🔒";
    lock.classList.toggle("crossed", sheet.locked.includes(r));
    lock.title = `Abschließen mit der letzten Zahl (ab ${Q.MIN_CROSSES_TO_LOCK} Kreuzen)`;
    rowEl.appendChild(lock);

    sheetEl.appendChild(rowEl);
  });

  penaltiesEl.innerHTML = "<span>Fehlwürfe</span>";
  for (let i = 0; i < Q.MAX_PENALTIES; i++) {
    const box = document.createElement("span");
    box.className = "qx-penalty";
    box.classList.toggle("crossed", i < sheet.penalties);
    if (myMove && myMove.penalty && i === sheet.penalties - 1) box.classList.add("just-crossed");
    penaltiesEl.appendChild(box);
  }

  pointsEl.innerHTML = `Punkte: <strong>${Q.scoreOf(state, me).total}</strong>`;
}

room.start();
