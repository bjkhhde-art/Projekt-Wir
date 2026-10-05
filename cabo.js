/* Cabo for 2–4 players. Lobby, invites, moves and live sync come from game-room.js;
   this file renders the table: my hand, the others' hands, piles and the round result. */

const caboLobby = document.getElementById("caboLobby");
const caboBoard = document.getElementById("caboBoard");
const caboScoreStrip = document.getElementById("caboScoreStrip");
const caboOpponents = document.getElementById("caboOpponents");
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

const POWER_NAMES = { 7: "Peek", 8: "Peek", 9: "Spy", 10: "Spy", 11: "Swap", 12: "Swap" };

let currentPerson = null;
let currentGame = null;

/* Card picks only live on this device until the move is sent. */
let selectedSwapSlots = new Set();
let selectedPowerOwnSlot = null;

let lastAnimatedMove = { gameId: null, seq: null };
const flipMemory = new Map();
let flipScope = "";
let flipTiming = { base: 0, revealOrder: 0 };

/* one block (name + hand) per other player, kept while the table stays the same */
const opponentEls = new Map();
let opponentKey = "";

function cardImg(value) {
  return `cabo-cards/Karte-${value}.webp`;
}

const room = GameRoom.create({
  table: "cabo_games",
  title: "Cabo",
  icon: "🦄",
  url: "cabo.html",
  lobbyEl: caboLobby,
  boardEl: caboBoard,
  leaveBtn: leaveGameBtn,
  createState: players => CaboEngine.createInitialState(players),
  isFinished: state => Boolean(state.gameOver),
  renderBoard
});

function dispatchAction(actionFn, ...args) {
  return room.dispatch(actionFn, ...args);
}

const others = state => room.others(state);
const totalOf = (state, person) => (state.scores[person] || []).reduce((a, b) => a + b, 0);

function ensureOpponentBlocks(opponents) {
  const key = opponents.join("|");
  if (key === opponentKey) return;
  opponentKey = key;
  opponentEls.clear();
  caboOpponents.innerHTML = "";
  caboOpponents.dataset.count = String(opponents.length);
  opponents.forEach((person, index) => {
    const side = document.createElement("div");
    side.className = "cabo-side cabo-opponent";
    side.dataset.person = person;
    const label = document.createElement("p");
    label.className = "cabo-player-label";
    label.textContent = person;
    const hand = document.createElement("div");
    hand.className = "cabo-hand";
    /* the first other player keeps the ids the two-player table always had */
    if (index === 0) {
      label.id = "opponentLabel";
      hand.id = "opponentHand";
    }
    side.appendChild(label);
    side.appendChild(hand);
    caboOpponents.appendChild(side);
    opponentEls.set(person, { side, label, hand });
  });
}

/* ---------- rendering: board ---------- */

function renderBoard(game) {
  currentPerson = room.person;
  currentGame = game;
  const state = game.state;
  const opponents = others(state);

  const layoutBefore = captureLayout(state.players);
  ensureOpponentBlocks(opponents);
  ownLabel.textContent = "Du";
  ownLabel.classList.toggle("active-turn", state.turnPerson === currentPerson && !state.roundOver);
  opponents.forEach(person => {
    opponentEls.get(person).label.classList.toggle("active-turn", state.turnPerson === person && !state.roundOver);
  });

  const move = takeUnseenMove(game);
  flipScope = `${game.id}-${state.round}`;
  flipTiming = { base: flipDelayFor(move, state), revealOrder: 0 };
  if (move) hideMovingCards(move, state);

  dropStaleSelections(state);
  renderScoreStrip(state, opponents);
  opponents.forEach(person => renderHand(opponentEls.get(person).hand, state, person, false));
  renderHand(ownHand, state, currentPerson, true);
  renderPiles(state);
  renderEvent(state);
  renderStatusAndActions(state, game, opponents);

  if (move) animateMove(move, state, layoutBefore);
}

/* ---------- animations ---------- */

const FLY_MS = 520;
const DEAL_STEP_MS = 90;
const DEAL_FLY_MS = 420;
const REVEAL_STAGGER_MS = 110;
const RESHUFFLE_SHOWN_CARDS = 8;
const RESHUFFLE_STEP_MS = 70;

const handKey = (person, index) => `hand-${person}-${index}`;
function handElement(person) {
  if (person === currentPerson) return ownHand;
  const entry = opponentEls.get(person);
  return entry ? entry.hand : null;
}

function handRects(person) {
  const hand = handElement(person);
  return hand ? [...hand.children].map(GameAnim.rectOf) : [];
}

/* Where a player "holds" a drawn card: my drawn card is shown face-up; the other's sits over their hand. */
function holdingRect(person, layout) {
  if (person === currentPerson && layout.drawnCard) return layout.drawnCard;
  const handEl = handElement(person);
  const hand = handEl && GameAnim.rectOf(handEl);
  const card = (layout.hands[person] || []).find(Boolean) || layout.drawPile;
  if (!hand || !card) return null;
  return {
    left: hand.left + (hand.width - card.width) / 2,
    top: hand.top + (hand.height - card.height) / 2,
    width: card.width,
    height: card.height
  };
}

function captureLayout(players) {
  const layout = {
    drawPile: GameAnim.rectOf(drawPile),
    discardPile: GameAnim.rectOf(discardPile),
    drawnCard: GameAnim.rectOf(document.querySelector(".cabo-drawn-preview")),
    hands: {}
  };
  (players || []).forEach(person => { layout.hands[person] = handRects(person); });
  return layout;
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

function flipDelayFor(move, state) {
  if (!move) return 0;
  if (move.type === "deal") return (state.players.length * CaboEngine.HAND_SIZE + 1) * DEAL_STEP_MS + DEAL_FLY_MS;
  return state.revealHands ? FLY_MS + 150 : 0;
}

function hideMovingCards(move, state) {
  switch (move.type) {
    case "deal":
      state.players.forEach(person => state.hands[person].forEach((_, index) => GameAnim.hide(handKey(person, index))));
      GameAnim.hide("discard-top");
      break;
    case "draw":
      if (move.person === currentPerson) GameAnim.hide("drawn");
      if (move.reshuffled) GameAnim.hide("draw-pile");
      break;
    case "discard":
    case "swap-failed":
      GameAnim.hide("discard-top");
      break;
    case "swap":
      GameAnim.hide(handKey(move.person, move.slots[0]));
      GameAnim.hide("discard-top");
      break;
    case "blind-swap":
      GameAnim.hide(handKey(move.person, move.ownIndex));
      GameAnim.hide(handKey(move.targetPerson, move.opponentIndex));
      break;
    default:
      break;
  }
}

function animateMove(move, state, before) {
  const now = captureLayout(state.players);
  const mine = move.person === currentPerson;
  const jobs = [];
  const flyThenReveal = (options, key) => jobs.push(GameAnim.fly(options).then(() => key && GameAnim.reveal(key)));

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
      let drawDelay = 0;

      /* empty deck: the discard pile is gathered face-down onto the deck and shuffled first */
      if (move.reshuffled) {
        const shown = state.deck.slice(0, Math.min(move.reshuffled, RESHUFFLE_SHOWN_CARDS));
        shown.forEach((value, i) => {
          flyThenReveal({
            from: before.discardPile || now.discardPile,
            to: now.drawPile,
            front: cardImg(value),
            startFaceUp: true,
            endFaceUp: false,
            delay: i * RESHUFFLE_STEP_MS,
            duration: DEAL_FLY_MS
          }, i === 0 ? "draw-pile" : null);
        });
        const gathered = (shown.length - 1) * RESHUFFLE_STEP_MS + DEAL_FLY_MS;
        GameAnim.shuffle(drawPile, gathered);
        drawDelay = gathered + 560;
      }

      flyThenReveal({
        from: fromDiscard ? now.discardPile : now.drawPile,
        to: mine ? now.drawnCard : holdingRect(move.person, now),
        front: cardImg(move.card),
        startFaceUp: fromDiscard,
        endFaceUp: mine || fromDiscard,
        fade: !mine,
        delay: drawDelay
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
        [...(handElement(move.person) || { children: [] }).children].forEach((el, newIndex) => {
          if (newIndex !== move.slots[0]) GameAnim.slideFrom(el, oldSlots[survivors[newIndex]]);
        });
      }
      break;
    }

    case "swap-failed":
      move.slots.forEach(index => {
        const handEl = handElement(move.person);
        if (handEl) GameAnim.shake(handEl.children[index]);
      });
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
  const safety = setTimeout(GameAnim.revealAll, 4000);
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
      if (mine) return "Du hast Cabo gerufen.";
      return currentGame && currentGame.state.players.length > 2
        ? `${event.person} hat Cabo gerufen – jetzt hat jeder noch einen letzten Zug!`
        : `${event.person} hat Cabo gerufen – das ist dein letzter Zug!`;
    case "multi-swap":
      return mine
        ? `Du hast ${event.count} gleiche Karten auf einmal abgelegt.`
        : `${event.person} hat ${event.count} gleiche Karten auf einmal abgelegt.`;
    case "multi-swap-failed":
      return mine
        ? "Die Karten waren nicht gleich – die gezogene Karte ist abgelegt, Zug verloren."
        : `${event.person} hat sich vertan: Die Karten waren nicht gleich, Zug verloren.`;
    case "blind-swap":
      if (mine) return `Du hast deine ${event.ownIndex + 1}. Karte mit der ${event.opponentIndex + 1}. von ${event.targetPerson} getauscht.`;
      if (event.targetPerson === currentPerson) return `${event.person} hat deine ${event.opponentIndex + 1}. Karte mit der eigenen ${event.ownIndex + 1}. getauscht.`;
      return `${event.person} hat die eigene ${event.ownIndex + 1}. Karte mit der ${event.opponentIndex + 1}. von ${event.targetPerson} getauscht.`;
    case "reshuffle":
      return `Der Nachziehstapel war leer – der Ablagestapel wurde neu gemischt (${event.count} Karten).`;
    default:
      return "";
  }
}

function renderEvent(state) {
  caboEvent.textContent = state.roundOver ? "" : describeEvent(state.lastEvent);
}

function renderScoreStrip(state, opponents) {
  caboScoreStrip.innerHTML = [
    `<span>Du: <strong>${totalOf(state, currentPerson)}</strong></span>`,
    ...opponents.map(person => `<span>${escapeHtml(person)}: <strong>${totalOf(state, person)}</strong></span>`)
  ].join("");
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

function slotClickHandler(state, owner, isOwn, index, peekState, previewingInitial) {
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
      return isOwn ? null : () => dispatchAction(CaboEngine.chooseSpyTarget, owner, index);
    case "await-swap-target":
      if (isOwn) return () => selectPowerOwnSlot(index);
      return () => {
        if (selectedPowerOwnSlot === null) {
          nudgeStatus();
          return;
        }
        dispatchAction(CaboEngine.swapWithOpponent, selectedPowerOwnSlot, owner, index);
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

  if (wasFlipped === flipped || !GameAnim.enabled()) {
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

    GameAnim.tag(slot, handKey(person, index));
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

    const onClick = slotClickHandler(state, person, isOwn, index, peekState, previewingInitial);
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
  const deckEmpty = state.deck.length === 0;
  drawPileCount.textContent = deckEmpty ? "leer" : String(state.deck.length);
  drawPile.dataset.stack = stackDepth(state.deck.length);
  drawPile.classList.toggle("is-empty", deckEmpty);
  GameAnim.tag(drawPile, "draw-pile");

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
    GameAnim.tag(top, "discard-top");
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
  GameAnim.tag(drawnCard, "drawn");
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

function renderStatusAndActions(state, game, opponents) {
  caboActions.innerHTML = "";
  caboStatus.classList.remove("nudge");
  /* with one other player the texts name them; with more they say "jemand anderem" */
  const single = opponents.length === 1 ? opponents[0] : null;

  if (state.roundOver) {
    renderRoundOverInline(state, game, opponents);
    return;
  }

  if (state.turnPhase === "initial-peek") {
    const waitingFor = opponents.filter(p => !state.initialPeekDone[p]);
    caboStatus.textContent = state.initialPeekDone[currentPerson]
      ? `Warte, bis ${listNames(waitingFor) || "alle"} auch bereit ${waitingFor.length > 1 ? "sind" : "ist"}...`
      : "Schau dir deine beiden linken Karten an und tippe eine davon an, wenn du bereit bist.";
    return;
  }

  const myTurn = state.turnPerson === currentPerson;
  const peek = state.lastPeekResult;
  const turner = state.turnPerson;

  if (!myTurn) {
    if (state.turnPhase === "peek-result" && peek) {
      if (peek.type === "own") caboStatus.textContent = `${turner} schaut sich eine eigene Karte an...`;
      else if (peek.targetPerson === currentPerson) caboStatus.textContent = `${turner} schaut sich deine markierte Karte an...`;
      else caboStatus.textContent = `${turner} schaut sich eine Karte von ${peek.targetPerson} an...`;
    } else if (state.turnPhase.startsWith("await-")) {
      caboStatus.textContent = `${turner} setzt eine Fähigkeit ein...`;
    } else {
      caboStatus.textContent = `${turner} ist am Zug...`;
    }
    return;
  }

  switch (state.turnPhase) {
    case "awaiting-draw": {
      const lastTurn = Boolean(state.caboCalledBy);
      caboStatus.textContent = (lastTurn ? "Dein letzter Zug! " : "Du bist dran! ") + (state.deck.length === 0
        ? "Der Nachziehstapel ist leer – tippe ihn an, dann wird der Ablagestapel neu gemischt. Oder nimm die oberste Ablagekarte."
        : "Zieh eine Karte vom Stapel oder nimm die oberste vom Ablagestapel.");
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
      caboStatus.textContent = single
        ? `Spy: Tippe eine Karte von ${single} an, um sie dir anzusehen.`
        : "Spy: Tippe eine Karte von jemand anderem an, um sie dir anzusehen.";
      break;
    case "await-swap-target": {
      const whose = single ? `von ${single}` : "von jemand anderem";
      caboStatus.textContent = selectedPowerOwnSlot === null
        ? `Swap: Tippe eine deiner Karten an und dann eine ${whose} – sie werden blind getauscht. Ablagestapel antippen = verzichten.`
        : `Jetzt eine Karte ${whose} antippen, um sie blind zu tauschen.`;
      break;
    }
    case "peek-result":
      caboStatus.textContent = "Merk sie dir – tippe sie nochmal an, um sie umzudrehen und den Zug zu beenden.";
      break;
    default:
      caboStatus.textContent = "";
  }
}

function renderRoundOverInline(state, game, opponents) {

  let winnerBanner = "";
  if (state.gameOver) {
    const iWon = state.winner === currentPerson;
    winnerBanner = iWon ? "🏆 Du hast gewonnen! " : `🏆 ${state.winner} hat gewonnen! `;
  }

  caboStatus.textContent = winnerBanner + (state.gameOver ? "" : `Runde ${state.round} vorbei.`);

  const columns = [currentPerson, ...opponents];
  const table = document.createElement("table");
  table.className = "cabo-scoreboard";
  table.dataset.players = String(columns.length);
  table.innerHTML = `
    <thead><tr><th></th>${columns.map(p => `<th>${p === currentPerson ? "Du" : escapeHtml(p)}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><td>Diese Runde</td>${columns.map(p => `<td>${state.roundScores[p]}</td>`).join("")}</tr>
      <tr><td class="total-row">Gesamt</td>${columns.map(p => `<td class="total-row">${totalOf(state, p)}</td>`).join("")}</tr>
    </tbody>
  `;
  caboActions.appendChild(table);

  const actionBtn = document.createElement("button");
  actionBtn.type = "button";
  actionBtn.className = "btn btn-block";
  actionBtn.textContent = state.gameOver ? "Neues Spiel" : "Nächste Runde";
  actionBtn.addEventListener("click", () => dispatchAction(state.gameOver ? CaboEngine.newGame : CaboEngine.startNextRound));
  caboActions.appendChild(actionBtn);
}

room.start();
