const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const caboLobby = document.getElementById("caboLobby");
const caboBoard = document.getElementById("caboBoard");
const caboScoreStrip = document.getElementById("caboScoreStrip");
const opponentLabel = document.getElementById("opponentLabel");
const opponentHand = document.getElementById("opponentHand");
const ownLabel = document.getElementById("ownLabel");
const ownHand = document.getElementById("ownHand");
const drawPile = document.getElementById("drawPile");
const drawPileCount = document.getElementById("drawPileCount");
const discardPile = document.getElementById("discardPile");
const caboStatus = document.getElementById("caboStatus");
const caboActions = document.getElementById("caboActions");

const initialPeekOverlay = document.getElementById("initialPeekOverlay");
const initialPeekCards = document.getElementById("initialPeekCards");
const initialPeekDoneBtn = document.getElementById("initialPeekDoneBtn");

const peekResultOverlay = document.getElementById("peekResultOverlay");
const peekResultTitle = document.getElementById("peekResultTitle");
const peekResultCard = document.getElementById("peekResultCard");
const peekResultDoneBtn = document.getElementById("peekResultDoneBtn");

const roundOverOverlay = document.getElementById("roundOverOverlay");
const roundOverTitle = document.getElementById("roundOverTitle");
const roundOverBody = document.getElementById("roundOverBody");
const roundOverActionBtn = document.getElementById("roundOverActionBtn");

let currentPerson = localStorage.getItem("pw_person");
let currentGame = null;
let peekOverlayShownForTurn = null;

function cardImg(value) {
  return `cabo-cards/Karte-${value}.webp`;
}

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
    syncFromServer();
  });
});

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- data access ---------- */

async function fetchCurrentGame() {
  const { data, error } = await supabaseClient
    .from("cabo_games")
    .select("*")
    .neq("status", "finished")
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
    .from("cabo_games")
    .insert({ status: "waiting", host_person: currentPerson, guest_person: null, state: {} });

  if (error) {
    console.error("Fehler beim Erstellen:", error);
    showToast("Runde konnte nicht erstellt werden.", "error");
    return;
  }

  sendAppNotification(supabaseClient, {
    title: "Cabo-Einladung 🦄",
    body: `${currentPerson} lädt dich zu einer Runde Cabo ein.`,
    excludePerson: normalizePerson(currentPerson),
    category: "games",
    url: "cabo.html"
  });

  await syncFromServer();
}

async function cancelWaitingGame(gameId) {
  const { error } = await supabaseClient.from("cabo_games").delete().eq("id", gameId);
  if (error) {
    console.error("Fehler beim Abbrechen:", error);
    showToast("Konnte nicht abgebrochen werden.", "error");
  }
  await syncFromServer();
}

async function joinGame(game) {
  if (!requirePerson()) return;

  const state = CaboEngine.createInitialState(game.host_person, currentPerson);

  const { error } = await supabaseClient
    .from("cabo_games")
    .update({ guest_person: currentPerson, status: "active", state, updated_at: new Date().toISOString() })
    .eq("id", game.id);

  if (error) {
    console.error("Fehler beim Beitreten:", error);
    showToast("Beitreten hat nicht geklappt.", "error");
    return;
  }

  await syncFromServer();
}

async function dispatchAction(actionFn, ...args) {
  if (!requirePerson()) return;

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

  const patch = { state: nextState, updated_at: new Date().toISOString() };
  if (nextState.gameOver) patch.status = "finished";

  const { error } = await supabaseClient.from("cabo_games").update(patch).eq("id", fresh.id);
  if (error) {
    console.error("Fehler beim Speichern des Spielzugs:", error);
    showToast("Zug konnte nicht gespeichert werden.", "error");
    return;
  }

  await syncFromServer();
}

/* ---------- rendering: lobby ---------- */

function renderLobbyNoGame() {
  caboBoard.classList.add("hidden");
  caboLobby.classList.remove("hidden");
  caboLobby.innerHTML = `
    <div class="cabo-lobby-card card">
      <div class="cabo-lobby-icon">🦄</div>
      <h2>Noch keine Runde</h2>
      <p>Startet eine neue Cabo-Runde &ndash; der andere kann direkt beitreten.</p>
      <button id="startGameBtn" class="btn btn-block">Neue Runde starten</button>
    </div>
  `;
  document.getElementById("startGameBtn").addEventListener("click", createGame);
}

function renderLobbyWaitingAsHost(game) {
  caboBoard.classList.add("hidden");
  caboLobby.classList.remove("hidden");
  caboLobby.innerHTML = `
    <div class="cabo-lobby-card card">
      <div class="cabo-lobby-icon">🦄</div>
      <h2>Warte auf Mitspieler:in</h2>
      <div class="cabo-lobby-waiting"><span class="cabo-spinner"></span> Einladung ist raus...</div>
      <button id="cancelGameBtn" class="btn btn-secondary btn-block">Abbrechen</button>
    </div>
  `;
  document.getElementById("cancelGameBtn").addEventListener("click", () => cancelWaitingGame(game.id));
}

function renderLobbyWaitingAsGuest(game) {
  caboBoard.classList.add("hidden");
  caboLobby.classList.remove("hidden");
  caboLobby.innerHTML = `
    <div class="cabo-lobby-card card">
      <div class="cabo-lobby-icon">🦄</div>
      <h2>${escapeHtml(game.host_person)} lädt dich ein!</h2>
      <p>Bereit für eine Runde Cabo?</p>
      <button id="joinGameBtn" class="btn btn-block">Beitreten</button>
    </div>
  `;
  document.getElementById("joinGameBtn").addEventListener("click", () => joinGame(game));
}

/* ---------- rendering: board ---------- */

function renderBoard(game) {
  caboLobby.classList.add("hidden");
  caboBoard.classList.remove("hidden");

  const state = game.state;
  const opponent = CaboEngine.otherPerson(state, currentPerson) || (currentPerson === game.host_person ? game.guest_person : game.host_person);

  opponentLabel.textContent = opponent || "Gegner";
  ownLabel.textContent = "Du";
  opponentLabel.classList.toggle("active-turn", state.turnPerson === opponent && !state.roundOver);
  ownLabel.classList.toggle("active-turn", state.turnPerson === currentPerson && !state.roundOver);

  renderScoreStrip(state, opponent);
  renderHand(opponentHand, state, opponent, false);
  renderHand(ownHand, state, currentPerson, true);
  renderPiles(state);
  renderStatusAndActions(state, opponent);
  renderInitialPeekOverlay(state);
  renderPeekResultOverlay(state);
  renderRoundOverOverlay(state, game, opponent);
}

function renderScoreStrip(state, opponent) {
  const ownTotal = (state.scores[currentPerson] || []).reduce((a, b) => a + b, 0);
  const oppTotal = (state.scores[opponent] || []).reduce((a, b) => a + b, 0);
  caboScoreStrip.innerHTML = `
    <span>Du: <strong>${ownTotal}</strong></span>
    <span>${escapeHtml(opponent || "Gegner")}: <strong>${oppTotal}</strong></span>
  `;
}

function renderHand(container, state, person, isOwn) {
  container.innerHTML = "";
  if (!person || !state.hands[person]) return;

  const hand = state.hands[person];
  const myTurn = state.turnPerson === currentPerson && !state.roundOver;

  hand.forEach((value, index) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "cabo-card-slot";

    const reveal = state.revealHands || (isOwn && state.knownToOwner[currentPerson][index]);

    const img = document.createElement("img");
    img.src = reveal ? cardImg(value) : "cabo-cards/Cover.webp";
    img.alt = reveal ? `Karte ${value}` : "Verdeckte Karte";
    slot.appendChild(img);

    if (reveal && isOwn && !state.revealHands) {
      slot.classList.add("known");
    }

    let clickable = false;
    if (myTurn) {
      if (isOwn && state.turnPhase === "post-draw-decision") {
        clickable = true;
        slot.addEventListener("click", () => dispatchAction(CaboEngine.swapCard, index));
      } else if (isOwn && state.turnPhase === "await-peek-own-target") {
        clickable = true;
        slot.addEventListener("click", () => dispatchAction(CaboEngine.choosePeekOwnTarget, index));
      } else if (!isOwn && state.turnPhase === "await-spy-target") {
        clickable = true;
        slot.addEventListener("click", () => dispatchAction(CaboEngine.chooseSpyTarget, index));
      }
    }
    slot.classList.toggle("clickable", clickable);
    if (!clickable) slot.disabled = true;

    container.appendChild(slot);
  });
}

function renderPiles(state) {
  drawPileCount.textContent = String(state.deck.length);

  const myTurn = state.turnPerson === currentPerson && !state.roundOver;
  const canDraw = myTurn && state.turnPhase === "awaiting-draw";

  drawPile.classList.toggle("clickable", canDraw);
  drawPile.disabled = !canDraw;
  drawPile.onclick = canDraw ? () => dispatchAction(CaboEngine.drawFromDeck) : null;

  discardPile.innerHTML = "";
  const topDiscard = state.discard[state.discard.length - 1];
  if (topDiscard !== undefined) {
    const img = document.createElement("img");
    img.src = cardImg(topDiscard);
    img.alt = `Ablagestapel: ${topDiscard}`;
    discardPile.appendChild(img);
  } else {
    discardPile.innerHTML = `<span class="cabo-pile-empty">leer</span>`;
  }

  const canTakeDiscard = canDraw && state.discard.length > 0;
  discardPile.classList.toggle("clickable", canTakeDiscard);
  discardPile.disabled = !canTakeDiscard;
  discardPile.onclick = canTakeDiscard ? () => dispatchAction(CaboEngine.drawFromDiscard) : null;
}

function renderStatusAndActions(state, opponent) {
  caboActions.innerHTML = "";

  if (state.roundOver) {
    caboStatus.textContent = "Die Runde ist vorbei.";
    return;
  }

  if (state.turnPhase === "initial-peek") {
    caboStatus.textContent = state.initialPeekDone[currentPerson]
      ? `Warte, bis ${opponent || "der andere"} auch bereit ist...`
      : "Schau dir deine Karten an.";
    return;
  }

  const myTurn = state.turnPerson === currentPerson;

  if (!myTurn) {
    caboStatus.textContent = `${opponent || "Der andere"} ist am Zug...`;
    return;
  }

  if (state.turnPhase === "awaiting-draw") {
    caboStatus.textContent = "Du bist dran! Zieh eine Karte vom Stapel oder nimm die oberste vom Ablagestapel.";
    const caboBtn = document.createElement("button");
    caboBtn.type = "button";
    caboBtn.className = "btn btn-secondary btn-sm";
    caboBtn.textContent = "🛑 Cabo rufen!";
    caboBtn.addEventListener("click", () => dispatchAction(CaboEngine.callCabo));
    caboActions.appendChild(caboBtn);
  } else if (state.turnPhase === "post-draw-decision") {
    caboStatus.textContent = "Tippe auf eine deiner Karten zum Tauschen" +
      (state.drawSource === "deck" ? ", oder lege die gezogene Karte ab." : ".");

    const drawnPreview = document.createElement("div");
    drawnPreview.className = "cabo-card-slot";
    drawnPreview.style.width = "70px";
    drawnPreview.style.margin = "0 auto 10px";
    drawnPreview.innerHTML = `<img src="${cardImg(state.drawnCard)}" alt="Gezogene Karte">`;
    caboActions.appendChild(drawnPreview);

    if (state.drawSource === "deck") {
      const discardBtn = document.createElement("button");
      discardBtn.type = "button";
      discardBtn.className = "btn btn-sm";
      discardBtn.textContent = "🗑️ Ablegen";
      discardBtn.addEventListener("click", () => dispatchAction(CaboEngine.discardDrawn));
      caboActions.appendChild(discardBtn);
    }
  } else if (state.turnPhase === "await-peek-own-target") {
    caboStatus.textContent = "Wähle eine deiner eigenen Karten, um sie anzusehen.";
  } else if (state.turnPhase === "await-spy-target") {
    caboStatus.textContent = `Wähle eine Karte von ${opponent || "dem anderen"}, um sie zu spähen.`;
  }
}

/* ---------- overlays ---------- */

function renderInitialPeekOverlay(state) {
  if (state.turnPhase !== "initial-peek" || state.initialPeekDone[currentPerson]) {
    initialPeekOverlay.classList.add("hidden");
    return;
  }

  initialPeekOverlay.classList.remove("hidden");
  const hand = state.hands[currentPerson];
  initialPeekCards.innerHTML = [2, 3].map(index => `<img src="${cardImg(hand[index])}" alt="Karte ${hand[index]}">`).join("");
}

initialPeekDoneBtn.addEventListener("click", () => {
  dispatchAction(CaboEngine.performInitialPeek);
});

function renderPeekResultOverlay(state) {
  const result = state.lastPeekResult;
  if (!result || result.person !== currentPerson) {
    peekResultOverlay.classList.add("hidden");
    return;
  }

  peekResultOverlay.classList.remove("hidden");
  peekResultTitle.textContent = result.type === "own" ? "Deine Karte" : "Gegnerische Karte";
  peekResultCard.innerHTML = `<img src="${cardImg(result.value)}" alt="Karte ${result.value}">`;
}

peekResultDoneBtn.addEventListener("click", async () => {
  if (!currentGame) return;
  const fresh = await fetchCurrentGame();
  if (!fresh || fresh.status !== "active") return;
  const nextState = CaboEngine.clearPeekResult(fresh.state);
  await supabaseClient.from("cabo_games").update({ state: nextState, updated_at: new Date().toISOString() }).eq("id", fresh.id);
  await syncFromServer();
});

function renderRoundOverOverlay(state, game, opponent) {
  if (!state.roundOver) {
    roundOverOverlay.classList.add("hidden");
    return;
  }

  roundOverOverlay.classList.remove("hidden");

  const ownTotal = (state.scores[currentPerson] || []).reduce((a, b) => a + b, 0);
  const oppTotal = (state.scores[opponent] || []).reduce((a, b) => a + b, 0);

  let winnerBanner = "";
  if (state.gameOver) {
    const iWon = state.winner === currentPerson;
    winnerBanner = `<p class="cabo-winner-banner">${iWon ? "🏆 Du hast gewonnen!" : `🏆 ${escapeHtml(state.winner)} hat gewonnen!`}</p>`;
  }

  roundOverTitle.textContent = state.gameOver ? "Spiel vorbei!" : `Runde ${state.round} vorbei!`;

  roundOverBody.innerHTML = `
    ${winnerBanner}
    <table class="cabo-scoreboard">
      <thead><tr><th></th><th>Du</th><th>${escapeHtml(opponent || "Gegner")}</th></tr></thead>
      <tbody>
        <tr><td>Diese Runde</td><td>${state.roundScores[currentPerson]}</td><td>${state.roundScores[opponent]}</td></tr>
        <tr><td class="total-row">Gesamt</td><td class="total-row">${ownTotal}</td><td class="total-row">${oppTotal}</td></tr>
      </tbody>
    </table>
  `;

  roundOverActionBtn.textContent = state.gameOver ? "Neues Spiel" : "Nächste Runde";
  roundOverActionBtn.onclick = state.gameOver
    ? () => { roundOverOverlay.classList.add("hidden"); createGame(); }
    : () => dispatchAction(CaboEngine.startNextRound);
}

/* ---------- sync loop ---------- */

async function syncFromServer() {
  const game = await fetchCurrentGame();
  currentGame = game;

  if (!game) {
    renderLobbyNoGame();
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

  if (game.status === "active") {
    renderBoard(game);
  }
}

supabaseClient
  .channel("cabo_games_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "cabo_games" }, () => {
    syncFromServer();
  })
  .subscribe();

syncFromServer();
