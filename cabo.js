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
const caboEvent = document.getElementById("caboEvent");
const caboActions = document.getElementById("caboActions");
const leaveGameBtn = document.getElementById("leaveGameBtn");

const INITIAL_PEEK_SLOTS = [0, 1];
const LEAVE_CONFIRM_MS = 4000;

const POWER_NAMES = { 7: "Peek", 8: "Peek", 9: "Spy", 10: "Spy", 11: "Swap", 12: "Swap" };

let currentPerson = localStorage.getItem("pw_person");
let currentGame = null;
let leaveArmedTimer = null;
let actionInFlight = false;

/* Card picks only live on this device until the move is sent. */
let selectedSwapSlots = new Set();
let selectedPowerOwnSlot = null;

let lastRenderedJson = null;
let syncGeneration = 0;
let lastAnimatedMove = { gameId: null, seq: null };
const flipMemory = new Map();
let flipScope = "";
let flipTiming = { base: 0, revealOrder: 0 };

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
    .from("cabo_games")
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
  if (!requirePerson() || actionInFlight) return;
  actionInFlight = true;

  try {
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
  } finally {
    actionInFlight = false;
  }
}

async function leaveGame() {
  if (!requirePerson()) return;

  const fresh = await fetchCurrentGame();
  if (!fresh || (fresh.status !== "active" && fresh.status !== "finished")) {
    await syncFromServer();
    return;
  }

  const state = { ...fresh.state, closedBy: currentPerson };
  const { error } = await supabaseClient
    .from("cabo_games")
    .update({ status: "closed", state, updated_at: new Date().toISOString() })
    .eq("id", fresh.id);

  if (error) {
    console.error("Fehler beim Beenden:", error);
    showToast("Spiel konnte nicht beendet werden.", "error");
    return;
  }

  await syncFromServer();
}

function disarmLeaveButton() {
  clearTimeout(leaveArmedTimer);
  leaveArmedTimer = null;
  leaveGameBtn.classList.remove("armed");
}

function renderLeaveButton(state) {
  const gameDone = state.gameOver;
  if (leaveArmedTimer && !gameDone) return;
  disarmLeaveButton();
  leaveGameBtn.textContent = gameDone ? "Zurück zur Übersicht" : "Spiel beenden";
}

leaveGameBtn.addEventListener("click", () => {
  const gameDone = currentGame && currentGame.state && currentGame.state.gameOver;
  if (gameDone || leaveArmedTimer) {
    disarmLeaveButton();
    leaveGame();
    return;
  }

  leaveGameBtn.classList.add("armed");
  leaveGameBtn.textContent = "Wirklich beenden? Nochmal tippen";
  leaveArmedTimer = setTimeout(() => {
    disarmLeaveButton();
    leaveGameBtn.textContent = "Spiel beenden";
  }, LEAVE_CONFIRM_MS);
});

/* ---------- rendering: lobby ---------- */

function renderLobbyNoGame(note) {
  disarmLeaveButton();
  CaboAnim.revealAll();
  caboBoard.classList.add("hidden");
  caboLobby.classList.remove("hidden");
  caboLobby.innerHTML = `
    <div class="cabo-lobby-card card">
      <div class="cabo-lobby-icon">🦄</div>
      ${note ? `<p class="cabo-lobby-note">${escapeHtml(note)}</p>` : ""}
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

  const layoutBefore = captureLayout(opponent);
  const move = takeUnseenMove(game);
  flipScope = `${game.id}-${state.round}`;
  flipTiming = { base: flipDelayFor(move, state), revealOrder: 0 };
  if (move) hideMovingCards(move, state);

  dropStaleSelections(state);
  renderScoreStrip(state, opponent);
  renderHand(opponentHand, state, opponent, false);
  renderHand(ownHand, state, currentPerson, true);
  renderPiles(state);
  renderEvent(state);
  renderStatusAndActions(state, game, opponent);
  renderLeaveButton(state);

  if (move) animateMove(move, state, layoutBefore, opponent);
}

/* ---------- animations ---------- */

const FLY_MS = 520;
const DEAL_STEP_MS = 90;
const DEAL_FLY_MS = 420;
const REVEAL_STAGGER_MS = 110;

const handKey = (person, index) => `hand-${person}-${index}`;
const handElement = person => (person === currentPerson ? ownHand : opponentHand);

function handRects(person) {
  return [...handElement(person).children].map(CaboAnim.rectOf);
}

/* Where a player "holds" a drawn card: my drawn card is shown face-up; the other's sits over their hand. */
function holdingRect(person, layout) {
  if (person === currentPerson && layout.drawnCard) return layout.drawnCard;
  const hand = CaboAnim.rectOf(handElement(person));
  const card = (layout.hands[person] || []).find(Boolean) || layout.drawPile;
  if (!hand || !card) return null;
  return {
    left: hand.left + (hand.width - card.width) / 2,
    top: hand.top + (hand.height - card.height) / 2,
    width: card.width,
    height: card.height
  };
}

function captureLayout(opponent) {
  const layout = {
    drawPile: CaboAnim.rectOf(drawPile),
    discardPile: CaboAnim.rectOf(discardPile),
    drawnCard: CaboAnim.rectOf(document.querySelector(".cabo-drawn-preview")),
    hands: {}
  };
  if (currentPerson) layout.hands[currentPerson] = handRects(currentPerson);
  if (opponent) layout.hands[opponent] = handRects(opponent);
  return layout;
}

/* Each move is animated once per device; after a reload only a fresh deal is replayed. */
function takeUnseenMove(game) {
  const state = game.state;
  const sameGame = lastAnimatedMove.gameId === game.id;
  const unseen = !sameGame || (state.moveSeq || 0) > (lastAnimatedMove.seq || 0);
  if (unseen) lastAnimatedMove = { gameId: game.id, seq: state.moveSeq };

  const move = state.lastMove;
  if (!move || !unseen || !CaboAnim.enabled()) return null;
  if (!sameGame && move.type !== "deal") return null;
  return move;
}

function flipDelayFor(move, state) {
  if (!move) return 0;
  if (move.type === "deal") return (state.players.length * CaboEngine.HAND_SIZE + 1) * DEAL_STEP_MS + DEAL_FLY_MS;
  return state.revealHands ? FLY_MS + 150 : 0;
}

function hideMovingCards(move, state) {
  switch (move.type) {
    case "deal":
      state.players.forEach(person => state.hands[person].forEach((_, index) => CaboAnim.hide(handKey(person, index))));
      CaboAnim.hide("discard-top");
      break;
    case "draw":
      if (move.person === currentPerson) CaboAnim.hide("drawn");
      break;
    case "discard":
    case "swap-failed":
      CaboAnim.hide("discard-top");
      break;
    case "swap":
      CaboAnim.hide(handKey(move.person, move.slots[0]));
      CaboAnim.hide("discard-top");
      break;
    case "blind-swap":
      CaboAnim.hide(handKey(move.person, move.ownIndex));
      CaboAnim.hide(handKey(move.targetPerson, move.opponentIndex));
      break;
    default:
      break;
  }
}

function animateMove(move, state, before, opponent) {
  const now = captureLayout(opponent);
  const mine = move.person === currentPerson;
  const jobs = [];
  const flyThenReveal = (options, key) => jobs.push(CaboAnim.fly(options).then(() => key && CaboAnim.reveal(key)));

  switch (move.type) {
    case "deal": {
      let step = 0;
      for (let index = 0; index < CaboEngine.HAND_SIZE; index++) {
        state.players.forEach(person => {
          flyThenReveal({
            from: now.drawPile,
            to: (now.hands[person] || [])[index],
            delay: step++ * DEAL_STEP_MS,
            duration: DEAL_FLY_MS
          }, handKey(person, index));
        });
      }
      flyThenReveal({
        from: now.drawPile,
        to: now.discardPile,
        front: cardImg(state.discard[state.discard.length - 1]),
        endFaceUp: true,
        delay: step * DEAL_STEP_MS,
        duration: DEAL_FLY_MS
      }, "discard-top");
      break;
    }

    case "draw": {
      const fromDiscard = move.from === "discard";
      flyThenReveal({
        from: fromDiscard ? now.discardPile : now.drawPile,
        to: mine ? now.drawnCard : holdingRect(move.person, now),
        front: cardImg(move.card),
        startFaceUp: fromDiscard,
        endFaceUp: mine || fromDiscard,
        fade: !mine
      }, mine ? "drawn" : null);
      break;
    }

    case "discard":
      flyThenReveal({
        from: holdingRect(move.person, before),
        to: now.discardPile,
        front: cardImg(move.card),
        startFaceUp: mine,
        endFaceUp: true
      }, "discard-top");
      break;

    case "swap": {
      const oldSlots = before.hands[move.person] || [];
      move.slots.forEach((slotIndex, k) => {
        const isLast = k === move.slots.length - 1;
        flyThenReveal({
          from: oldSlots[slotIndex],
          to: now.discardPile,
          front: cardImg(move.discarded[k]),
          endFaceUp: true,
          delay: k * 120
        }, isLast ? "discard-top" : null);
      });

      flyThenReveal({
        from: holdingRect(move.person, before),
        to: (now.hands[move.person] || [])[move.slots[0]],
        front: cardImg(move.card),
        startFaceUp: mine || move.drawSource === "discard",
        endFaceUp: false,
        delay: 160
      }, handKey(move.person, move.slots[0]));

      /* after a multi-swap the remaining cards close the gaps */
      if (move.slots.length > 1) {
        const removed = new Set(move.slots.slice(1));
        const survivors = oldSlots.map((_, index) => index).filter(index => !removed.has(index));
        [...handElement(move.person).children].forEach((el, newIndex) => {
          if (newIndex !== move.slots[0]) CaboAnim.slideFrom(el, oldSlots[survivors[newIndex]]);
        });
      }
      break;
    }

    case "swap-failed":
      move.slots.forEach(index => CaboAnim.shake(handElement(move.person).children[index]));
      flyThenReveal({
        from: holdingRect(move.person, before),
        to: now.discardPile,
        front: cardImg(move.card),
        startFaceUp: mine || move.drawSource === "discard",
        endFaceUp: true,
        delay: 300
      }, "discard-top");
      break;

    case "blind-swap": {
      const ownSlot = (now.hands[move.person] || [])[move.ownIndex];
      const targetSlot = (now.hands[move.targetPerson] || [])[move.opponentIndex];
      flyThenReveal({ from: ownSlot, to: targetSlot, arc: 40 }, handKey(move.targetPerson, move.opponentIndex));
      flyThenReveal({ from: targetSlot, to: ownSlot, arc: -40 }, handKey(move.person, move.ownIndex));
      break;
    }

    default:
      break;
  }

  /* safety net: never leave a card invisible if something interrupts an animation */
  const safety = setTimeout(CaboAnim.revealAll, 4000);
  Promise.all(jobs).then(() => clearTimeout(safety));
}

function rerenderCurrent() {
  if (currentGame && currentGame.state) renderBoard(currentGame);
}

function dropStaleSelections(state) {
  const myTurn = state.turnPerson === currentPerson && !state.roundOver;
  const handLength = (state.hands[currentPerson] || []).length;

  if (!myTurn || state.turnPhase !== "post-draw-decision") {
    selectedSwapSlots = new Set();
  } else {
    selectedSwapSlots = new Set([...selectedSwapSlots].filter(index => index < handLength));
  }

  if (!myTurn || state.turnPhase !== "await-swap-target" || selectedPowerOwnSlot >= handLength) {
    selectedPowerOwnSlot = null;
  }
}

function nudgeStatus() {
  caboStatus.classList.remove("nudge");
  void caboStatus.offsetWidth;
  caboStatus.classList.add("nudge");
}

function toggleSwapSlot(index) {
  if (selectedSwapSlots.has(index)) {
    selectedSwapSlots.delete(index);
  } else {
    selectedSwapSlots.add(index);
  }
  rerenderCurrent();
}

function selectPowerOwnSlot(index) {
  selectedPowerOwnSlot = selectedPowerOwnSlot === index ? null : index;
  rerenderCurrent();
}

function describeEvent(event) {
  if (!event) return "";
  const mine = event.person === currentPerson;

  switch (event.type) {
    case "cabo":
      return mine ? "Du hast Cabo gerufen." : `${event.person} hat Cabo gerufen – das ist dein letzter Zug!`;
    case "multi-swap":
      return mine
        ? `Du hast ${event.count} gleiche Karten auf einmal abgelegt.`
        : `${event.person} hat ${event.count} gleiche Karten auf einmal abgelegt.`;
    case "multi-swap-failed":
      return mine
        ? "Die Karten waren nicht gleich – die gezogene Karte ist abgelegt, Zug verloren."
        : `${event.person} hat sich vertan: Die Karten waren nicht gleich, Zug verloren.`;
    case "blind-swap":
      return mine
        ? `Du hast deine ${event.ownIndex + 1}. Karte mit der ${event.opponentIndex + 1}. von ${event.targetPerson} getauscht.`
        : `${event.person} hat deine ${event.opponentIndex + 1}. Karte mit der eigenen ${event.ownIndex + 1}. getauscht.`;
    default:
      return "";
  }
}

function renderEvent(state) {
  caboEvent.textContent = state.roundOver ? "" : describeEvent(state.lastEvent);
}

function renderScoreStrip(state, opponent) {
  const ownTotal = (state.scores[currentPerson] || []).reduce((a, b) => a + b, 0);
  const oppTotal = (state.scores[opponent] || []).reduce((a, b) => a + b, 0);
  caboScoreStrip.innerHTML = `
    <span>Du: <strong>${ownTotal}</strong></span>
    <span>${escapeHtml(opponent || "Gegner")}: <strong>${oppTotal}</strong></span>
  `;
}

/* During a peek/spy, the looked-at card is face-up only for the looker; the other player sees it highlighted. */
function peekStateForSlot(state, person, index) {
  const result = state.turnPhase === "peek-result" ? state.lastPeekResult : null;
  if (!result || result.slot !== index) return null;

  const cardOwner = result.type === "own" ? result.person : result.targetPerson;
  if (cardOwner !== person) return null;
  return result.person === currentPerson ? "looking" : "watched";
}

function isJustSwappedSlot(state, person, index) {
  const event = state.lastEvent;
  if (!event || event.type !== "blind-swap" || state.roundOver) return false;
  return (person === event.person && index === event.ownIndex) ||
    (person === event.targetPerson && index === event.opponentIndex);
}

function slotClickHandler(state, isOwn, index, peekState, previewingInitial) {
  if (peekState === "looking") return () => dispatchAction(CaboEngine.finishPeek);
  if (previewingInitial) return () => dispatchAction(CaboEngine.performInitialPeek);

  const myTurn = state.turnPerson === currentPerson && !state.roundOver;
  if (!myTurn) return null;

  switch (state.turnPhase) {
    case "post-draw-decision":
      return isOwn ? () => toggleSwapSlot(index) : null;
    case "await-peek-own-target":
      return isOwn ? () => dispatchAction(CaboEngine.choosePeekOwnTarget, index) : null;
    case "await-spy-target":
      return isOwn ? null : () => dispatchAction(CaboEngine.chooseSpyTarget, index);
    case "await-swap-target":
      if (isOwn) return () => selectPowerOwnSlot(index);
      return () => {
        if (selectedPowerOwnSlot === null) {
          nudgeStatus();
          return;
        }
        dispatchAction(CaboEngine.swapWithOpponent, selectedPowerOwnSlot, index);
      };
    default:
      return null;
  }
}

/* The hand is rebuilt on every update, so a card that changes sides is created in its old
   position and turned over afterwards - otherwise the CSS flip would never be visible. */
function applyFlip(slot, memoryKey, flipped, roundReveal) {
  const wasFlipped = flipMemory.get(memoryKey) === true;
  flipMemory.set(memoryKey, flipped);

  if (wasFlipped === flipped || !CaboAnim.enabled()) {
    slot.classList.toggle("flipped", flipped);
    return;
  }

  slot.classList.toggle("flipped", wasFlipped);
  const stagger = roundReveal && flipped ? flipTiming.revealOrder++ * REVEAL_STAGGER_MS : 0;
  setTimeout(() => {
    void slot.offsetWidth;
    slot.classList.toggle("flipped", flipped);
  }, flipTiming.base + stagger + 20);
}

function renderHand(container, state, person, isOwn) {
  container.innerHTML = "";
  if (!person || !state.hands[person]) return;

  const hand = state.hands[person];
  const showingInitialPeek = isOwn && state.turnPhase === "initial-peek" && !state.initialPeekDone[currentPerson];

  hand.forEach((value, index) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "cabo-card-slot";

    const peekState = peekStateForSlot(state, person, index);
    const peeking = peekState === "looking";
    const previewingInitial = showingInitialPeek && INITIAL_PEEK_SLOTS.includes(index);
    const flipped = state.revealHands || previewingInitial || peeking;

    const inner = document.createElement("div");
    inner.className = "cabo-flip-inner";

    const back = document.createElement("div");
    back.className = "cabo-flip-face cabo-flip-face-back";
    back.innerHTML = `<img src="cabo-cards/Cover.webp" alt="Verdeckte Karte">`;

    const front = document.createElement("div");
    front.className = "cabo-flip-face cabo-flip-face-front";
    front.innerHTML = `<img src="${cardImg(value)}" alt="Karte ${value}">`;

    inner.appendChild(back);
    inner.appendChild(front);
    slot.appendChild(inner);

    CaboAnim.tag(slot, handKey(person, index));
    applyFlip(slot, `${flipScope}:${person}:${index}`, flipped, state.revealHands);
    if (previewingInitial && !state.revealHands) {
      slot.classList.add("known");
    }
    if (peeking && !state.revealHands) {
      slot.classList.add("peeking");
    }
    slot.classList.toggle("watched", peekState === "watched" && !state.revealHands);
    slot.classList.toggle("just-swapped", isJustSwappedSlot(state, person, index));

    const selected = isOwn && (
      (state.turnPhase === "post-draw-decision" && selectedSwapSlots.has(index)) ||
      (state.turnPhase === "await-swap-target" && selectedPowerOwnSlot === index)
    );
    slot.classList.toggle("selected", selected);

    const onClick = slotClickHandler(state, isOwn, index, peekState, previewingInitial);
    if (onClick) slot.addEventListener("click", onClick);
    slot.classList.toggle("clickable", Boolean(onClick));
    if (!onClick) slot.disabled = true;

    container.appendChild(slot);
  });
}

function stackDepth(count) {
  if (count <= 1) return "none";
  if (count <= 3) return "thin";
  return "full";
}

function renderPiles(state) {
  drawPileCount.textContent = String(state.deck.length);
  drawPile.dataset.stack = stackDepth(state.deck.length);

  const myTurn = state.turnPerson === currentPerson && !state.roundOver;
  const canDraw = myTurn && state.turnPhase === "awaiting-draw";

  drawPile.classList.toggle("clickable", canDraw);
  drawPile.disabled = !canDraw;
  drawPile.onclick = canDraw ? () => dispatchAction(CaboEngine.drawFromDeck) : null;

  discardPile.dataset.stack = stackDepth(state.discard.length);
  discardPile.innerHTML = "";
  const topDiscard = state.discard[state.discard.length - 1];
  if (topDiscard !== undefined) {
    const top = document.createElement("div");
    top.className = "cabo-pile-top";
    top.innerHTML = `<img src="${cardImg(topDiscard)}" alt="Ablagestapel: ${topDiscard}">`;
    CaboAnim.tag(top, "discard-top");
    discardPile.appendChild(top);
  } else {
    discardPile.innerHTML = `<span class="cabo-pile-empty">leer</span>`;
  }

  /* The discard pile is where a drawn card is put down, and where the swap power is waived. */
  let discardAction = null;
  if (canDraw && state.discard.length > 0) {
    discardAction = CaboEngine.drawFromDiscard;
  } else if (myTurn && state.turnPhase === "post-draw-decision" && state.drawSource === "deck") {
    discardAction = CaboEngine.discardDrawn;
  } else if (myTurn && state.turnPhase === "await-swap-target") {
    discardAction = CaboEngine.skipSwap;
  }

  discardPile.classList.toggle("clickable", Boolean(discardAction));
  const pickingCards = discardAction === CaboEngine.discardDrawn && selectedSwapSlots.size > 0;
  discardPile.classList.toggle("drop-target", Boolean(discardAction) && discardAction !== CaboEngine.drawFromDiscard && !pickingCards);
  discardPile.disabled = !discardAction;
  discardPile.onclick = discardAction ? () => dispatchAction(discardAction) : null;
}

function renderDrawnCard(state) {
  const count = selectedSwapSlots.size;
  const drawnCard = document.createElement("button");
  drawnCard.type = "button";
  drawnCard.className = "cabo-drawn-preview";
  drawnCard.classList.toggle("clickable", count > 0);
  drawnCard.innerHTML = `<img src="${cardImg(state.drawnCard)}" alt="Gezogene Karte">`;
  CaboAnim.tag(drawnCard, "drawn");
  drawnCard.addEventListener("click", () => {
    if (selectedSwapSlots.size === 0) {
      nudgeStatus();
      return;
    }
    dispatchAction(CaboEngine.swapCards, [...selectedSwapSlots]);
  });
  caboActions.appendChild(drawnCard);
}

function postDrawStatus(state) {
  const count = selectedSwapSlots.size;
  if (count === 1) return "Tippe jetzt die gezogene Karte an, um sie einzutauschen.";
  if (count > 1) return `${count} Karten gewählt – tippe die gezogene Karte an. Sind sie nicht alle gleich, ist der Zug verloren.`;

  const pick = "Tippe eine oder mehrere gleiche Karten von dir an und dann die gezogene Karte";
  if (state.drawSource !== "deck") return `${pick} – vom Ablagestapel genommene Karten müssen getauscht werden.`;

  const power = POWER_NAMES[state.drawnCard];
  return power
    ? `${pick} – oder tippe auf den Ablagestapel, um sie abzulegen und ${power} zu nutzen.`
    : `${pick} – oder tippe auf den Ablagestapel, um sie abzulegen.`;
}

function renderStatusAndActions(state, game, opponent) {
  caboActions.innerHTML = "";
  caboStatus.classList.remove("nudge");
  const other = opponent || "der andere";

  if (state.roundOver) {
    renderRoundOverInline(state, game, opponent);
    return;
  }

  if (state.turnPhase === "initial-peek") {
    caboStatus.textContent = state.initialPeekDone[currentPerson]
      ? `Warte, bis ${opponent || "der andere"} auch bereit ist...`
      : "Schau dir deine beiden linken Karten an und tippe eine davon an, wenn du bereit bist.";
    return;
  }

  const myTurn = state.turnPerson === currentPerson;
  const peek = state.lastPeekResult;

  if (!myTurn) {
    if (state.turnPhase === "peek-result" && peek) {
      caboStatus.textContent = peek.type === "own"
        ? `${opponent} schaut sich eine eigene Karte an...`
        : `${opponent} schaut sich deine markierte Karte an...`;
    } else if (state.turnPhase.startsWith("await-")) {
      caboStatus.textContent = `${opponent} setzt eine Fähigkeit ein...`;
    } else {
      caboStatus.textContent = `${opponent || "Der andere"} ist am Zug...`;
    }
    return;
  }

  switch (state.turnPhase) {
    case "awaiting-draw": {
      const lastTurn = Boolean(state.caboCalledBy);
      caboStatus.textContent = (lastTurn ? "Dein letzter Zug! " : "Du bist dran! ") +
        "Zieh eine Karte vom Stapel oder nimm die oberste vom Ablagestapel.";
      if (!lastTurn) {
        const caboBtn = document.createElement("button");
        caboBtn.type = "button";
        caboBtn.className = "btn btn-secondary btn-sm";
        caboBtn.textContent = "🛑 Cabo rufen!";
        caboBtn.addEventListener("click", () => dispatchAction(CaboEngine.callCabo));
        caboActions.appendChild(caboBtn);
      }
      break;
    }
    case "post-draw-decision":
      caboStatus.textContent = postDrawStatus(state);
      renderDrawnCard(state);
      break;
    case "await-peek-own-target":
      caboStatus.textContent = "Peek: Tippe eine deiner Karten an, um sie dir anzusehen.";
      break;
    case "await-spy-target":
      caboStatus.textContent = `Spy: Tippe eine Karte von ${other} an, um sie dir anzusehen.`;
      break;
    case "await-swap-target":
      caboStatus.textContent = selectedPowerOwnSlot === null
        ? `Swap: Tippe eine deiner Karten an und dann eine von ${other} – sie werden blind getauscht. Ablagestapel antippen = verzichten.`
        : `Jetzt eine Karte von ${other} antippen, um sie blind zu tauschen.`;
      break;
    case "peek-result":
      caboStatus.textContent = "Merk sie dir – tippe sie nochmal an, um sie umzudrehen und den Zug zu beenden.";
      break;
    default:
      caboStatus.textContent = "";
  }
}

function renderRoundOverInline(state, game, opponent) {
  const ownTotal = (state.scores[currentPerson] || []).reduce((a, b) => a + b, 0);
  const oppTotal = (state.scores[opponent] || []).reduce((a, b) => a + b, 0);

  let winnerBanner = "";
  if (state.gameOver) {
    const iWon = state.winner === currentPerson;
    winnerBanner = iWon ? "🏆 Du hast gewonnen! " : `🏆 ${state.winner} hat gewonnen! `;
  }

  caboStatus.textContent = winnerBanner + (state.gameOver ? "" : `Runde ${state.round} vorbei.`);

  const table = document.createElement("table");
  table.className = "cabo-scoreboard";
  table.innerHTML = `
    <thead><tr><th></th><th>Du</th><th>${escapeHtml(opponent || "Gegner")}</th></tr></thead>
    <tbody>
      <tr><td>Diese Runde</td><td>${state.roundScores[currentPerson]}</td><td>${state.roundScores[opponent]}</td></tr>
      <tr><td class="total-row">Gesamt</td><td class="total-row">${ownTotal}</td><td class="total-row">${oppTotal}</td></tr>
    </tbody>
  `;
  caboActions.appendChild(table);

  const actionBtn = document.createElement("button");
  actionBtn.type = "button";
  actionBtn.className = "btn btn-block";
  actionBtn.textContent = state.gameOver ? "Neues Spiel" : "Nächste Runde";
  actionBtn.addEventListener("click", state.gameOver
    ? () => createGame()
    : () => dispatchAction(CaboEngine.startNextRound));
  caboActions.appendChild(actionBtn);
}

/* ---------- sync loop ---------- */

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
    const endedEarly = !(game.state && game.state.gameOver);
    const note = closedBy && closedBy !== currentPerson && endedEarly
      ? `${closedBy} hat das letzte Spiel beendet.`
      : "";
    renderLobbyNoGame(note);
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

  if (game.status === "active" || game.status === "finished") {
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
