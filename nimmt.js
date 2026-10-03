const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
const TABLE = "nimmt_games";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const lobbyEl = document.getElementById("nmLobby");
const boardEl = document.getElementById("nmBoard");
const scoreEl = document.getElementById("nmScore");
const oppNameEl = document.getElementById("nmOppName");
const oppHandEl = document.getElementById("nmOppHand");
const oppPileEl = document.getElementById("nmOppPile");
const ownPileEl = document.getElementById("nmOwnPile");
const spotsEl = document.querySelector(".nm-spots");
const spotOppEl = document.getElementById("nmSpotOpp");
const spotOppLabelEl = document.getElementById("nmSpotOppLabel");
const spotOwnEl = document.getElementById("nmSpotOwn");
const rowsEl = document.getElementById("nmRows");
const eventEl = document.getElementById("nmEvent");
const statusEl = document.getElementById("nmStatus");
const actionsEl = document.getElementById("nmActions");
const handEl = document.getElementById("nmHand");
const leaveBtn = document.getElementById("nmLeaveBtn");

const LEAVE_CONFIRM_MS = 4000;
const MAX_WRITE_ATTEMPTS = 4;
const PLACE_STEP_MS = 950;
const FLY_MS = 520;
const TURN_MS = 380;

let currentPerson = localStorage.getItem("pw_person");
let currentGame = null;
let lastRenderedJson = null;
let syncGeneration = 0;
let actionInFlight = false;
let leaveArmedTimer = null;
let lastAnimatedMove = { gameId: null, seq: null };
let previousState = null;
let previousStateGameId = null;

const { bullsFor, sumBulls } = NimmtEngine;

function requirePerson() {
  if (currentPerson) return true;
  personModal.classList.remove("hidden");
  return false;
}

personButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentPerson = button.dataset.person;
    localStorage.setItem("pw_person", currentPerson);
    personModal.classList.add("hidden");
    lastRenderedJson = null;
    syncFromServer();
  });
});

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- data access ---------- */

async function fetchCurrentGame() {
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des Spiels:", error);
    return null;
  }
  return data;
}

async function createGame() {
  if (!requirePerson()) return;

  const { error } = await supabaseClient
    .from(TABLE)
    .insert({ status: "waiting", host_person: currentPerson, guest_person: null, state: {}, version: 0 });

  if (error) {
    console.error("Fehler beim Erstellen:", error);
    showToast("Runde konnte nicht erstellt werden.", "error");
    return;
  }

  sendAppNotification(supabaseClient, {
    title: "6 nimmt!-Einladung 🐮",
    body: `${currentPerson} lädt dich zu einer Runde 6 nimmt! ein.`,
    excludePerson: normalizePerson(currentPerson),
    category: "games",
    url: "nimmt.html"
  });

  await syncFromServer();
}

async function cancelWaitingGame(gameId) {
  const { error } = await supabaseClient.from(TABLE).delete().eq("id", gameId);
  if (error) {
    console.error("Fehler beim Abbrechen:", error);
    showToast("Konnte nicht abgebrochen werden.", "error");
  }
  await syncFromServer();
}

async function joinGame(game) {
  if (!requirePerson()) return;

  const state = NimmtEngine.createInitialState(game.host_person, currentPerson);
  const { error } = await supabaseClient
    .from(TABLE)
    .update({ guest_person: currentPerson, status: "active", state, version: (game.version || 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", game.id);

  if (error) {
    console.error("Fehler beim Beitreten:", error);
    showToast("Beitreten hat nicht geklappt.", "error");
    return;
  }
  await syncFromServer();
}

/* Both players act at the same time here, so every write is guarded by the row's version:
   if the other device saved in between, the move is recomputed on the fresh state. */
async function dispatchAction(actionFn, ...args) {
  if (!requirePerson() || actionInFlight) return;
  actionInFlight = true;

  try {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const fresh = await fetchCurrentGame();
      if (!fresh || fresh.status !== "active") {
        await syncFromServer();
        return;
      }

      let nextState;
      try {
        nextState = actionFn(fresh.state, currentPerson, ...args);
      } catch (error) {
        showToast(error.message, "error");
        return;
      }

      const { data, error } = await supabaseClient
        .from(TABLE)
        .update({ state: nextState, version: fresh.version + 1, updated_at: new Date().toISOString() })
        .eq("id", fresh.id)
        .eq("version", fresh.version)
        .select();

      if (error) {
        console.error("Fehler beim Speichern des Spielzugs:", error);
        showToast("Zug konnte nicht gespeichert werden.", "error");
        return;
      }
      if (data && data.length > 0) {
        await syncFromServer();
        return;
      }
    }
    showToast("Gleichzeitiger Zug – bitte nochmal tippen.", "error");
    await syncFromServer();
  } finally {
    actionInFlight = false;
  }
}

async function leaveGame() {
  if (!requirePerson()) return;

  const fresh = await fetchCurrentGame();
  if (!fresh || fresh.status !== "active") {
    await syncFromServer();
    return;
  }

  const { error } = await supabaseClient
    .from(TABLE)
    .update({ status: "closed", state: { ...fresh.state, closedBy: currentPerson }, version: fresh.version + 1, updated_at: new Date().toISOString() })
    .eq("id", fresh.id);

  if (error) {
    console.error("Fehler beim Beenden:", error);
    showToast("Spiel konnte nicht beendet werden.", "error");
    return;
  }
  await syncFromServer();
}

/* ---------- leave button (tap twice while a game is running) ---------- */

function disarmLeaveButton() {
  clearTimeout(leaveArmedTimer);
  leaveArmedTimer = null;
  leaveBtn.classList.remove("armed");
}

function renderLeaveButton(state) {
  const done = state.phase === "finished";
  if (leaveArmedTimer && !done) return;
  disarmLeaveButton();
  leaveBtn.textContent = done ? "Zurück zur Übersicht" : "Spiel beenden";
}

leaveBtn.addEventListener("click", () => {
  const done = currentGame && currentGame.state && currentGame.state.phase === "finished";
  if (done || leaveArmedTimer) {
    disarmLeaveButton();
    leaveGame();
    return;
  }
  leaveBtn.classList.add("armed");
  leaveBtn.textContent = "Wirklich beenden? Nochmal tippen";
  leaveArmedTimer = setTimeout(() => {
    disarmLeaveButton();
    leaveBtn.textContent = "Spiel beenden";
  }, LEAVE_CONFIRM_MS);
});

/* ---------- lobby ---------- */

function showLobby(html) {
  disarmLeaveButton();
  GameAnim.revealAll();
  boardEl.classList.add("hidden");
  lobbyEl.classList.remove("hidden");
  lobbyEl.innerHTML = html;
}

function renderLobbyNoGame(note) {
  showLobby(`
    <div class="nm-lobby-card card">
      <div class="nm-lobby-icon">🐮</div>
      ${note ? `<p class="nm-lobby-note">${escapeHtml(note)}</p>` : ""}
      <h2>Noch keine Runde</h2>
      <p>Startet eine Runde 6 nimmt! &ndash; der andere kann direkt beitreten.</p>
      <button id="nmStartBtn" class="btn btn-block">Neue Runde starten</button>
    </div>
  `);
  document.getElementById("nmStartBtn").addEventListener("click", createGame);
}

function renderLobbyWaitingAsHost(game) {
  showLobby(`
    <div class="nm-lobby-card card">
      <div class="nm-lobby-icon">🐮</div>
      <h2>Warte auf Mitspieler:in</h2>
      <div class="nm-lobby-waiting"><span class="nm-spinner"></span> Einladung ist raus...</div>
      <button id="nmCancelBtn" class="btn btn-secondary btn-block">Abbrechen</button>
    </div>
  `);
  document.getElementById("nmCancelBtn").addEventListener("click", () => cancelWaitingGame(game.id));
}

function renderLobbyWaitingAsGuest(game) {
  showLobby(`
    <div class="nm-lobby-card card">
      <div class="nm-lobby-icon">🐮</div>
      <h2>${escapeHtml(game.host_person)} lädt dich ein!</h2>
      <p>Bereit für eine Runde 6 nimmt!?</p>
      <button id="nmJoinBtn" class="btn btn-block">Beitreten</button>
    </div>
  `);
  document.getElementById("nmJoinBtn").addEventListener("click", () => joinGame(game));
}

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

function opponentOf(game) {
  return NimmtEngine.otherPerson(game.state, currentPerson) ||
    (currentPerson === game.host_person ? game.guest_person : game.host_person);
}

function renderBoard(game) {
  lobbyEl.classList.add("hidden");
  boardEl.classList.remove("hidden");

  const state = game.state;
  const opp = opponentOf(game);
  if (previousStateGameId !== game.id) {
    previousState = null;
    previousStateGameId = game.id;
  }

  const before = captureLayout();
  const move = takeUnseenMove(game);
  if (move) hideMovingCards(move, state);

  renderScore(state, opp);
  renderPlayers(state, opp);
  renderSpots(state, opp, move);
  renderRows(state, move);
  renderHand(state, move);
  renderEvent(state);
  renderStatus(state, opp);
  renderLeaveButton(state);

  if (move) animateMove(move, previousState, state, before, opp);
  previousState = state;
}

function renderScore(state, opp) {
  const wins = state.wins || {};
  const trickText = state.phase === "finished" ? "vorbei" : `Stich ${state.trick}/10`;
  scoreEl.innerHTML = `
    <span>Partie <strong>${state.gameNo}</strong> · ${trickText}</span>
    <span>Siege: Du <strong>${wins[currentPerson] || 0}</strong> : <strong>${wins[opp] || 0}</strong> ${escapeHtml(opp || "")}</span>
  `;
}

function pileHtml(person, state) {
  const cards = state.penalties[person] || [];
  return `${bullIcon()}<span>${sumBulls(cards)}</span>`;
}

function renderPlayers(state, opp) {
  oppNameEl.textContent = opp || "Gegner";
  const oppIsActing = (state.phase === "choose" && state.chosen[opp] === null) ||
    (state.phase === "pick-row" && state.pickPerson === opp);
  oppNameEl.classList.toggle("active", oppIsActing);

  const oppCards = (state.hands[opp] || []).length;
  oppHandEl.textContent = state.phase === "finished" ? "" : `${oppCards} ${oppCards === 1 ? "Karte" : "Karten"}`;

  oppPileEl.innerHTML = pileHtml(opp, state);
  oppPileEl.title = `${(state.penalties[opp] || []).length} kassierte Karten`;
  ownPileEl.innerHTML = pileHtml(currentPerson, state);
  ownPileEl.title = `${(state.penalties[currentPerson] || []).length} kassierte Karten`;
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

function renderSpots(state, opp, move) {
  spotsEl.classList.toggle("hidden", state.phase === "finished");
  spotOppLabelEl.textContent = opp || "Gegner";

  if (state.phase === "pick-row") {
    const revealed = state.revealed || [];
    const playOf = person => revealed.find(play => play.person === person);
    const oppPlay = playOf(opp);
    const ownPlay = playOf(currentPerson);

    if (oppPlay) {
      const justRevealed = move && move.type === "reveal" && GameAnim.enabled();
      const flip = flipEl(oppPlay.card, !justRevealed);
      setSpot(spotOppEl, flip, { key: "spot-opp", pending: state.pickPerson === opp });
      if (justRevealed) setTimeout(() => flip.classList.add("face-up"), 60);
    } else {
      setSpot(spotOppEl, "", { key: "spot-opp" });
    }

    if (ownPlay) {
      setSpot(spotOwnEl, cardEl(ownPlay.card), { key: "spot-own", pending: state.pickPerson === currentPerson });
    } else {
      setSpot(spotOwnEl, "", { key: "spot-own" });
    }
    return;
  }

  const oppChosen = state.chosen[opp] !== null && state.chosen[opp] !== undefined;
  if (oppChosen) {
    const back = backEl();
    if (move && move.type === "choose" && move.person === opp && move.chosen) back.classList.add("nm-drop-in");
    setSpot(spotOppEl, back, { key: "spot-opp" });
  } else {
    setSpot(spotOppEl, state.phase === "choose" ? "wählt…" : "", { key: "spot-opp" });
  }

  const ownChosen = state.chosen[currentPerson];
  if (ownChosen !== null && ownChosen !== undefined) {
    setSpot(spotOwnEl, cardEl(ownChosen), {
      key: "spot-own",
      clickable: true,
      onClick: () => dispatchAction(NimmtEngine.chooseCard, ownChosen)
    });
  } else {
    setSpot(spotOwnEl, state.phase === "choose" ? "Karte antippen" : "", { key: "spot-own" });
  }
}

const cellKey = (row, col) => `cell-${row}-${col}`;

function renderRows(state, move) {
  rowsEl.innerHTML = "";
  const myPick = state.phase === "pick-row" && state.pickPerson === currentPerson;
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
      rowEl.addEventListener("click", () => dispatchAction(NimmtEngine.pickRow, r));
      rowEl.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") dispatchAction(NimmtEngine.pickRow, r);
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
  const chosen = state.chosen[currentPerson];
  const canChoose = state.phase === "choose";
  const dealing = move && move.type === "deal";

  (state.hands[currentPerson] || [])
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
        button.addEventListener("click", () => dispatchAction(NimmtEngine.chooseCard, card));
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
      const who = p.person === currentPerson ? "Du hast" : `${p.person} hat`;
      const what = p.reason === "full" ? "die volle Reihe" : "eine Reihe";
      return `${who} mit der ${p.card} ${what} genommen (+${sumBulls(p.took)} 🐮).`;
    })
    .join(" ");
}

function renderEvent(state) {
  eventEl.textContent = describeTakes(state);
}

function renderStatus(state, opp) {
  actionsEl.innerHTML = "";
  statusEl.classList.remove("nudge");

  if (state.phase === "finished") {
    renderResult(state, opp);
    return;
  }

  if (state.phase === "pick-row") {
    const card = state.revealed[0].card;
    statusEl.textContent = state.pickPerson === currentPerson
      ? `Deine ${card} passt in keine Reihe – tippe die Reihe an, die du nehmen musst.`
      : `Die ${card} von ${opp} passt in keine Reihe – ${opp} sucht sich eine Reihe aus…`;
    return;
  }

  const mine = state.chosen[currentPerson];
  const theirs = state.chosen[opp];
  if (mine === null || mine === undefined) {
    statusEl.textContent = theirs !== null && theirs !== undefined
      ? `${opp} hat schon gewählt – tippe eine Karte aus deiner Hand an.`
      : "Tippe eine Karte aus deiner Hand an, um sie verdeckt zu legen.";
  } else {
    statusEl.textContent = `Warte auf ${opp}… Tippe deine Karte an, um sie zurückzunehmen, oder eine andere zum Wechseln.`;
  }
}

function renderResult(state, opp) {
  const { bulls, winner } = state.result;
  statusEl.textContent = winner === currentPerson
    ? "🏆 Du hast gewonnen!"
    : winner ? `🏆 ${winner} hat gewonnen!` : "Unentschieden!";

  const wins = state.wins || {};
  const table = document.createElement("table");
  table.className = "nm-result";
  table.innerHTML = `
    <thead><tr><th></th><th>Du</th><th>${escapeHtml(opp || "Gegner")}</th></tr></thead>
    <tbody>
      <tr><td>Hornochsen</td><td class="total">${bulls[currentPerson]}</td><td class="total">${bulls[opp]}</td></tr>
      <tr><td>Siege gesamt</td><td>${wins[currentPerson] || 0}</td><td>${wins[opp] || 0}</td></tr>
    </tbody>
  `;
  actionsEl.appendChild(table);

  const again = document.createElement("button");
  again.type = "button";
  again.className = "btn btn-block";
  again.textContent = "Revanche 🐮";
  again.addEventListener("click", () => dispatchAction(NimmtEngine.rematch));
  actionsEl.appendChild(again);
}

/* ---------- animations ---------- */

function captureLayout() {
  const rectByKey = selector => {
    const map = {};
    document.querySelectorAll(selector).forEach(el => { map[el.dataset.animKey] = GameAnim.rectOf(el); });
    return map;
  };
  return {
    spotOpp: GameAnim.rectOf(spotOppEl),
    spotOwn: GameAnim.rectOf(spotOwnEl),
    hand: rectByKey(".nm-hand-card")
  };
}

function cellRect(row, col) {
  return GameAnim.rectOf(rowsEl.children[row] && rowsEl.children[row].children[col]);
}

function pileRect(person) {
  return GameAnim.rectOf(person === currentPerson ? ownPileEl : oppPileEl);
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
  if (move.type === "choose" && move.person === currentPerson) {
    GameAnim.hide(move.chosen ? "spot-own" : `hand-${move.card}`);
  }
  if (move.type === "reveal" || move.type === "resolve") {
    move.placements.forEach(p => {
      if (state.rows[p.row][p.col] === p.card) GameAnim.hide(cellKey(p.row, p.col));
    });
    if (move.type === "reveal" && state.phase === "pick-row") GameAnim.hide("spot-own");
  }
}

function animateMove(move, prev, state, before, opp) {
  const jobs = [];
  const flyThenReveal = (options, key) => jobs.push(GameAnim.fly(options).then(() => key && GameAnim.reveal(key)));

  if (move.type === "choose" && move.person === currentPerson) {
    if (move.chosen) {
      flyThenReveal({ from: before.hand[`hand-${move.card}`], to: GameAnim.rectOf(spotOwnEl), front: cardEl(move.card), back: backEl(), startFaceUp: true, endFaceUp: true, duration: 380 }, "spot-own");
    } else {
      const to = GameAnim.rectOf(document.querySelector(`[data-anim-key="hand-${move.card}"]`));
      flyThenReveal({ from: before.spotOwn, to, front: cardEl(move.card), back: backEl(), startFaceUp: true, endFaceUp: true, duration: 380 }, `hand-${move.card}`);
    }
  }

  if (move.type === "reveal" || move.type === "resolve") {
    const ownCameFromSpot = prev && prev.chosen && prev.chosen[currentPerson] !== null;
    const sourceOf = play => {
      if (move.type === "resolve") return play.person === currentPerson ? before.spotOwn : before.spotOpp;
      if (play.person !== currentPerson) return before.spotOpp;
      return ownCameFromSpot ? before.spotOwn : (before.hand[`hand-${play.card}`] || before.spotOwn);
    };

    /* my own card that only now leaves the hand for the table (I chose last, then someone must pick a row) */
    if (move.type === "reveal" && state.phase === "pick-row") {
      const ownPlay = move.plays.find(p => p.person === currentPerson);
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
      const faceUp = p.person === currentPerson || move.type === "resolve";

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

/* ---------- sync ---------- */

async function syncFromServer() {
  const generation = ++syncGeneration;
  const game = await fetchCurrentGame();
  if (generation !== syncGeneration) return;

  /* re-rendering an unchanged game would restart running card animations */
  const json = JSON.stringify(game);
  if (json === lastRenderedJson) return;
  lastRenderedJson = json;
  currentGame = game;

  if (!game) {
    renderLobbyNoGame();
    return;
  }

  if (game.status === "closed") {
    const closedBy = game.state && game.state.closedBy;
    const endedEarly = !(game.state && game.state.phase === "finished");
    renderLobbyNoGame(closedBy && closedBy !== currentPerson && endedEarly ? `${closedBy} hat das letzte Spiel beendet.` : "");
    return;
  }

  if (game.status === "waiting") {
    if (game.host_person === currentPerson) {
      renderLobbyWaitingAsHost(game);
    } else {
      renderLobbyWaitingAsGuest(game);
    }
    return;
  }

  renderBoard(game);
}

supabaseClient
  .channel("nimmt_games_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => {
    syncFromServer();
  })
  .subscribe();

syncFromServer();
