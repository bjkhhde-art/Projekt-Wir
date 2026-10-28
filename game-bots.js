/* Udiou and Klausi 🤖 – the computer players for Cabo, 6 nimmt!, Qwixx, Flip 7 and Monopoly.

   Both play by the same rules; each bot is { play(state, name) → next state or null, delay(state) → ms, reaction?(before, after, name) }.
   play() only uses what a careful human at the table could know: in Cabo the bot keeps its own
   memory of the cards it has seen (state.botMemory), it never looks at hidden cards.
   No DOM: loaded as <script> next to the game's engine, testable in Node via require. */

const GameBots = (() => {

const FILES = { CaboEngine: "./cabo-engine.js", NimmtEngine: "./nimmt-engine.js", QwixxEngine: "./qwixx-engine.js", Flip7Engine: "./flip7-engine.js", MonopolyEngine: "./monopoly-engine.js" };
/* each page only loads its own engine – look it up when needed */
function lib(name) {
  if (typeof window !== "undefined" && window[name]) return window[name];
  return require(FILES[name]);
}

const jitter = (base, spread) => base + Math.floor(Math.random() * spread);

/* ---------- Cabo ---------- */

const CABO_UNKNOWN = 6.5; /* the average card: (0·2 + 4·(1+…+12) + 13·2) / 52 */
/* Cabo is only called with every own card known and a clearly low total – calling on a guess lost too many rounds */
const CABO_CALL_AT = 5;
/* ...but a round must end: from this many own turns on, the bar rises by one per turn and unknown cards count at their average */
const CABO_PATIENCE_TURNS = 20;

/* what the bot remembers this round; a card that changed since (someone swapped it) is forgotten –
   that a swap happened is public, everybody at the table saw it */
function caboMemory(state, bot) {
  const saved = (state.botMemory && state.botMemory[bot]) || { own: {}, opp: {} };
  const memory = { own: {}, opp: {}, turns: saved.turns || 0 };
  Object.entries(saved.own || {}).forEach(([slot, value]) => {
    if (state.hands[bot][slot] === value) memory.own[slot] = value;
  });
  Object.entries(saved.opp || {}).forEach(([person, slots]) => {
    if (!state.hands[person]) return;
    memory.opp[person] = {};
    Object.entries(slots).forEach(([slot, value]) => {
      if (state.hands[person][slot] === value) memory.opp[person][slot] = value;
    });
  });
  return memory;
}

function withMemory(next, bot, memory) {
  next.botMemory = { ...(next.botMemory || {}), [bot]: memory };
  return next;
}

function caboGuess(memory, slot) {
  return Object.prototype.hasOwnProperty.call(memory.own, slot) ? memory.own[slot] : CABO_UNKNOWN;
}

function caboEstimate(state, bot, memory) {
  return state.hands[bot].reduce((sum, _, slot) => sum + caboGuess(memory, slot), 0);
}

/* the own slot where a new card helps most */
function caboWorstSlot(state, bot, memory) {
  let best = 0;
  state.hands[bot].forEach((_, slot) => {
    if (caboGuess(memory, slot) > caboGuess(memory, best)) best = slot;
  });
  return best;
}

/* two or more remembered cards of the same value that can all go for the drawn one */
function caboMultiSwap(state, bot, memory, card) {
  const bySlot = {};
  Object.entries(memory.own).forEach(([slot, value]) => {
    (bySlot[value] = bySlot[value] || []).push(Number(slot));
  });
  let best = null;
  Object.entries(bySlot).forEach(([value, slots]) => {
    if (slots.length < 2 || Number(value) <= card) return;
    const gain = Number(value) * slots.length - card;
    if (!best || gain > best.gain) best = { slots: slots.sort((a, b) => a - b), gain };
  });
  return best;
}

function caboSwap(state, bot, memory, slots) {
  const C = lib("CaboEngine");
  const card = state.drawnCard;
  const next = C.swapCards(state, bot, slots);
  const removed = slots.slice(1);
  const own = {};
  Object.entries(memory.own).forEach(([slot, value]) => {
    const index = Number(slot);
    if (slots.includes(index)) return;
    own[index - removed.filter(r => r < index).length] = value;
  });
  own[slots[0]] = card;
  return withMemory(next, bot, { ...memory, own });
}

function caboPlay(state, bot) {
  const C = lib("CaboEngine");
  if (!state.players.includes(bot) || state.roundOver) return null;
  const memory = caboMemory(state, bot);
  const hand = state.hands[bot];

  if (state.turnPhase === "initial-peek") {
    if (state.initialPeekDone[bot]) return null;
    [0, 1].filter(slot => slot < hand.length).forEach(slot => { memory.own[slot] = hand[slot]; });
    return withMemory(C.performInitialPeek(state, bot), bot, memory);
  }
  if (state.turnPerson !== bot) return null;

  switch (state.turnPhase) {
    case "awaiting-draw": {
      memory.turns += 1;
      const unknown = hand.filter((_, slot) => !(slot in memory.own)).length;
      const overdue = Math.max(0, memory.turns - CABO_PATIENCE_TURNS);
      if (!state.caboCalledBy && (unknown === 0 || overdue > 0) && caboEstimate(state, bot, memory) <= CABO_CALL_AT + overdue) {
        return withMemory(C.callCabo(state, bot), bot, memory);
      }
      const top = state.discard[state.discard.length - 1];
      const worst = caboGuess(memory, caboWorstSlot(state, bot, memory));
      if (top !== undefined && top <= 5 && worst - top >= 3) return withMemory(C.drawFromDiscard(state, bot), bot, memory);
      return withMemory(C.drawFromDeck(state, bot), bot, memory);
    }
    case "post-draw-decision": {
      const card = state.drawnCard;
      const multi = caboMultiSwap(state, bot, memory, card);
      if (multi) return caboSwap(state, bot, memory, multi.slots);
      const slot = caboWorstSlot(state, bot, memory);
      const gain = caboGuess(memory, slot) - card;
      const hasUnknown = hand.some((_, s) => !(s in memory.own));
      /* a 7/8 from the deck is better used to look at an unknown card, unless swapping clearly helps */
      const wantsPower = (card === 7 || card === 8) && hasUnknown;
      if (state.drawSource === "discard" || (gain >= 2 && !(wantsPower && gain < 3))) return caboSwap(state, bot, memory, [slot]);
      return withMemory(C.discardDrawn(state, bot), bot, memory);
    }
    case "await-peek-own-target": {
      const slot = hand.findIndex((_, s) => !(s in memory.own));
      const target = slot === -1 ? 0 : slot;
      memory.own[target] = hand[target];
      return withMemory(C.choosePeekOwnTarget(state, bot, target), bot, memory);
    }
    case "await-spy-target": {
      const others = state.players.filter(p => p !== bot);
      let pick = null;
      others.forEach(person => {
        const known = memory.opp[person] || {};
        const slot = state.hands[person].findIndex((_, s) => !(s in known));
        if (slot !== -1 && (!pick || Object.keys(known).length < pick.known)) pick = { person, slot, known: Object.keys(known).length };
      });
      if (!pick) pick = { person: others[0], slot: 0 };
      memory.opp[pick.person] = { ...(memory.opp[pick.person] || {}), [pick.slot]: state.hands[pick.person][pick.slot] };
      return withMemory(C.chooseSpyTarget(state, bot, pick.person, pick.slot), bot, memory);
    }
    case "await-swap-target": {
      const known = Object.entries(memory.own).map(([slot, value]) => ({ slot: Number(slot), value }));
      const mine = known.sort((a, b) => b.value - a.value)[0];
      if (!mine || mine.value < 7) return withMemory(C.skipSwap(state, bot), bot, memory);
      let theirs = null;
      Object.entries(memory.opp).forEach(([person, slots]) => {
        Object.entries(slots).forEach(([slot, value]) => {
          if (!theirs || value < theirs.value) theirs = { person, slot: Number(slot), value };
        });
      });
      if (!(theirs && mine.value - theirs.value >= 3)) {
        theirs = null;
        if (mine.value >= 10) {
          const unseen = p => state.hands[p].findIndex((_, s) => !(s in (memory.opp[p] || {})));
          const person = state.players.find(p => p !== bot && unseen(p) !== -1);
          if (person) theirs = { person, slot: unseen(person), value: null };
        }
      }
      if (!theirs) return withMemory(C.skipSwap(state, bot), bot, memory);
      const next = C.swapWithOpponent(state, bot, mine.slot, theirs.person, theirs.slot);
      if (theirs.value === null) delete memory.own[mine.slot];
      else memory.own[mine.slot] = theirs.value;
      memory.opp[theirs.person] = { ...(memory.opp[theirs.person] || {}), [theirs.slot]: mine.value };
      return withMemory(next, bot, memory);
    }
    case "peek-result":
      return withMemory(C.finishPeek(state, bot), bot, memory);
    default:
      return null;
  }
}

const cabo = {
  play: caboPlay,
  delay: state => (state.turnPhase === "initial-peek" ? 900 : state.turnPhase === "peek-result" ? 1800 : jitter(1300, 600)),
  reaction(before, after, bot) {
    if (!before.caboCalledBy && after.caboCalledBy === bot) return "😏";
    if (after.gameOver && after.winner === bot) return "😏";
    return null;
  }
};

/* ---------- 6 nimmt! ---------- */

function nimmtCost(state, bot, card) {
  const N = lib("NimmtEngine");
  const others = state.players.length - 1;
  const index = N.rowFor(state.rows, card);
  if (index === -1) {
    /* too low: takes the cheapest row */
    return Math.min(...state.rows.map(row => N.sumBulls(row))) + 0.5;
  }
  const row = state.rows[index];
  const gap = card - row[row.length - 1];
  const bulls = N.sumBulls(row);
  if (row.length >= N.ROW_LIMIT) return bulls;
  /* others may squeeze in before the card and make it the sixth */
  const risk = Math.min(0.9, (others * gap) / 40);
  if (row.length === N.ROW_LIMIT - 1) return risk * (bulls + 1) + gap * 0.001;
  if (row.length === N.ROW_LIMIT - 2) return risk * risk * 0.6 * (bulls + 1) + gap * 0.001;
  return gap * 0.001;
}

function nimmtPlay(state, bot) {
  const N = lib("NimmtEngine");
  if (!state.players.includes(bot)) return null;
  if (state.phase === "choose" && state.chosen[bot] === null && state.hands[bot].length > 0) {
    const best = state.hands[bot]
      .map(card => ({ card, cost: nimmtCost(state, bot, card) }))
      .sort((a, b) => a.cost - b.cost || a.card - b.card)[0];
    return N.chooseCard(state, bot, best.card);
  }
  if (state.phase === "pick-row" && state.pickPerson === bot) {
    const best = state.rows
      .map((row, index) => ({ index, bulls: N.sumBulls(row), length: row.length }))
      .sort((a, b) => a.bulls - b.bulls || a.length - b.length)[0];
    return N.pickRow(state, bot, best.index);
  }
  return null;
}

const nimmt = {
  play: nimmtPlay,
  delay(state) {
    const placed = state.lastMove && state.lastMove.placements ? state.lastMove.placements.length : 0;
    return jitter(1200, 1300) + placed * 650;
  },
  reaction(before, after, bot) {
    const placements = (after.lastMove && after.lastMove.placements) || [];
    if (after.phase === "finished" && after.result && after.result.winner === bot) return "😏";
    if (placements.some(p => p.person === bot && p.took)) return "😡";
    return null;
  }
};

/* ---------- Qwixx ---------- */

function qwixxSkip(state, bot, option) {
  const marks = state.sheets[bot].marks[option.row];
  const last = marks.length ? marks[marks.length - 1] : -1;
  return option.index - last - 1;
}

/* fewest skipped fields first, then the row with more crosses */
function qwixxBest(state, bot, options) {
  return options
    .map(option => ({ ...option, skip: qwixxSkip(state, bot, option), locks: option.index === state.layout[option.row].length - 1, count: state.sheets[bot].marks[option.row].length }))
    .sort((a, b) => a.skip - b.skip || b.count - a.count)[0] || null;
}

function qwixxPlay(state, bot) {
  const Q = lib("QwixxEngine");
  if (!state.players.includes(bot)) return null;
  if (state.phase === "roll") return state.active === bot ? Q.roll(state, bot) : null;
  if (state.phase === "white") {
    if (state.white[bot].done) return null;
    const best = qwixxBest(state, bot, Q.whiteOptions(state, bot));
    if (best && (best.skip <= 1 || (best.locks && best.skip <= 3))) return Q.crossWhite(state, bot, best.row, best.index);
    return Q.passWhite(state, bot);
  }
  if (state.phase === "color" && state.active === bot) {
    const best = qwixxBest(state, bot, Q.colorOptions(state, bot));
    const penalties = state.sheets[bot].penalties;
    const limit = state.activeCrossed ? 1 : penalties >= Q.MAX_PENALTIES - 1 ? 11 : 3;
    if (best && (best.skip <= limit || (best.locks && best.skip <= limit + 2))) return Q.crossColor(state, bot, best.row, best.index);
    return Q.passColor(state, bot);
  }
  return null;
}

const qwixx = {
  play: qwixxPlay,
  delay: state => (state.phase === "white" ? jitter(1700, 1200) : jitter(1200, 500)),
  reaction(before, after, bot) {
    const move = after.lastMove || {};
    if (after.phase === "finished" && after.result && after.result.winner === bot) return "😏";
    if (move.person === bot && move.penalty) return "🙈";
    if (move.person === bot && move.locks) return "🔥";
    return null;
  }
};

/* ---------- Flip 7 ---------- */

/* the chance that the next card busts: the cards not yet seen this round are known to anyone who counts */
function flip7BustChance(state, bot) {
  const seat = state.table[bot];
  const pile = state.deck;
  if (pile.length === 0) return 0;
  const bad = pile.filter(card => /^n\d+$/.test(card) && seat.numbers.includes(Number(card.slice(1)))).length;
  return bad / pile.length;
}

function flip7Target(state, bot) {
  const F = lib("Flip7Engine");
  const { type, candidates } = state.choice;
  const others = candidates.filter(p => p !== bot);
  const round = p => F.scoreOf(state.table[p]);
  if (type === "second") {
    /* a gift: to whoever is behind */
    return candidates.slice().sort((a, b) => state.scores[a] - state.scores[b])[0];
  }
  if (type === "freeze") {
    /* bank my own good round, or stop the one who would gain least */
    if (candidates.includes(bot) && (round(bot) >= 25 || others.length === 0)) return bot;
    return others.slice().sort((a, b) => round(a) - round(b) || state.scores[b] - state.scores[a])[0];
  }
  /* Flip Three: the one with most to lose */
  if (others.length === 0) return bot;
  return others.slice().sort((a, b) => state.table[b].numbers.length - state.table[a].numbers.length || round(b) - round(a))[0];
}

function flip7Play(state, bot) {
  const F = lib("Flip7Engine");
  if (!state.players.includes(bot)) return null;
  if (state.choice) return state.choice.chooser === bot ? F.chooseTarget(state, bot, flip7Target(state, bot)) : null;
  if (state.phase !== "play" || state.turnPerson !== bot) return null;

  const seat = state.table[bot];
  const score = F.scoreOf(seat);
  if (seat.numbers.length === 0) return F.hit(state, bot);
  const total = state.scores[bot] + score;
  const best = Math.max(...state.players.filter(p => p !== bot).map(p => state.scores[p] + F.scoreOf(state.table[p])));
  if (total >= F.TARGET_SCORE && total > best) return F.stay(state, bot);

  const chance = flip7BustChance(state, bot);
  const saved = seat.actions.includes("second");
  const limit = saved ? 0.6 : seat.numbers.length >= 5 ? 0.36 : 0.27;
  if (chance < limit || (score < 10 && chance < 0.45)) return F.hit(state, bot);
  return F.stay(state, bot);
}

const flip7 = {
  play: flip7Play,
  delay(state) {
    const events = state.lastMove && state.lastMove.events ? state.lastMove.events.length : 0;
    return Math.min(5200, jitter(1000, 500) + events * 380);
  },
  reaction(before, after, bot) {
    const events = (after.lastMove && after.lastMove.events) || [];
    if (after.phase === "finished" && after.result && after.result.winner === bot) return "😏";
    if (events.some(e => e.type === "card" && e.person === bot && e.result === "flip7")) return "🔥";
    if (events.some(e => e.type === "card" && e.person === bot && e.result === "bust")) return "😭";
    return null;
  }
};

/* ---------- Monopoly ---------- */

const MONOPOLY_RESERVE = 120; /* cash the bot wants to keep after buying */
const MONOPOLY_BUILD_RESERVE = 250;

/* the street to build on next: a full colour set, evenly, the cheapest house first */
function monopolyBuildSpot(state, bot) {
  const M = lib("MonopolyEngine");
  return M.ownedBy(state, bot)
    .filter(i => M.canBuild(state, bot, i) === null && state.cash[bot] - M.SQUARES[i].houseCost >= MONOPOLY_BUILD_RESERVE)
    .sort((a, b) => M.SQUARES[a].houseCost - M.SQUARES[b].houseCost || M.housesOn(state, a) - M.housesOn(state, b) || a - b)[0];
}

/* what a bundle of streets is worth to `who`: the price, plus a bonus for each street that finishes a colour */
function monopolyTradeValue(state, M, who, streets) {
  return streets.reduce((sum, i) => {
    const sq = M.SQUARES[i];
    const group = sq.group ? M.groupSquares(sq.group) : [];
    const completes = group.length > 0 && group.every(g => M.ownerOf(state, g) === who || streets.includes(g));
    return sum + sq.price + (completes ? 350 : 0);
  }, 0);
}

function monopolyAnswerTrade(state, bot) {
  const M = lib("MonopolyEngine");
  const t = state.trade;
  if (M.tradeProblem(state, t)) return M.declineTrade(state, bot);
  const gets = monopolyTradeValue(state, M, bot, t.give) + t.cash;
  const gives = monopolyTradeValue(state, M, t.from, t.get);
  return gets >= gives * 1.05 ? M.acceptTrade(state, bot) : M.declineTrade(state, bot);
}

/* once per turn: offer a generous price for the one street missing to a full colour */
function monopolyProposeTrade(state, bot) {
  const M = lib("MonopolyEngine");
  if (state.trade || state.lastTradeTurn === state.turnCount) return null;
  const groups = Object.keys(M.GROUPS).filter(g => !M.ownsGroup(state, bot, g));
  for (const g of groups) {
    const squares = M.groupSquares(g);
    const missing = squares.filter(i => M.ownerOf(state, i) !== bot);
    const mine = squares.length - missing.length;
    if (missing.length !== 1 || mine < 1) continue;
    const index = missing[0];
    const owner = M.ownerOf(state, index);
    if (!owner || state.out.includes(owner) || !M.tradable(state, index)) continue;
    const offer = Math.round((M.SQUARES[index].price + 350) * 1.15 / 10) * 10;
    if (state.cash[bot] - offer < 150) continue;
    if (M.tradeProblem(state, { from: bot, to: owner, give: [], get: [index], cash: offer })) continue;
    return M.proposeTrade(state, bot, owner, [], [index], offer);
  }
  return null;
}

/* in debt: houses first, then the street whose mortgage covers the rest most closely, else give up */
function monopolyRaiseMoney(state, bot) {
  const M = lib("MonopolyEngine");
  const missing = M.debtTotal(state.debt) - state.cash[bot];
  const owned = M.ownedBy(state, bot);
  const built = owned.filter(i => M.canSell(state, bot, i) === null);
  if (built.length) return M.sellHouse(state, bot, built.sort((a, b) => M.housesOn(state, b) - M.housesOn(state, a) || b - a)[0]);
  const free = owned.filter(i => M.canMortgage(state, bot, i) === null);
  if (!free.length) return M.declareBankrupt(state, bot);
  const enough = free.filter(i => M.mortgageValue(i) >= missing).sort((a, b) => M.mortgageValue(a) - M.mortgageValue(b));
  return M.mortgage(state, bot, enough.length ? enough[0] : free.sort((a, b) => M.mortgageValue(b) - M.mortgageValue(a))[0]);
}

function monopolyPlay(state, bot) {
  const M = lib("MonopolyEngine");
  if (!state.players.includes(bot) || state.out.includes(bot) || state.phase === "finished") return null;
  if (state.trade && state.trade.to === bot) return monopolyAnswerTrade(state, bot);
  if (state.trade && state.trade.from === bot) return null;
  if (state.turnPerson !== bot) return null;

  if (state.phase === "debt") return monopolyRaiseMoney(state, bot);
  if (state.phase === "buy") {
    const square = M.SQUARES[state.offer];
    /* stations and the second street of a colour are always worth it; otherwise keep some cash */
    const left = state.cash[bot] - square.price;
    const completes = square.group && M.groupSquares(square.group).filter(i => M.ownerOf(state, i) !== bot).length === 1;
    return left >= MONOPOLY_RESERVE || (left >= 30 && (square.type === "station" || completes))
      ? M.buy(state, bot)
      : M.decline(state, bot);
  }
  if (state.phase === "roll") {
    if (state.jail[bot] !== null) {
      if (state.jailCards[bot].length > 0) return M.useJailCard(state, bot);
      if (state.cash[bot] >= 400 && state.turnCount < 40) return M.payJail(state, bot);
    }
    return M.roll(state, bot);
  }
  if (state.phase === "after") {
    const back = M.ownedBy(state, bot).find(i => M.canRedeem(state, bot, i) === null && state.cash[bot] - M.redeemCost(i) >= 400);
    if (back !== undefined) return M.redeem(state, bot, back);
    const spot = monopolyBuildSpot(state, bot);
    if (spot !== undefined) return M.build(state, bot, spot);
    return monopolyProposeTrade(state, bot) || M.endTurn(state, bot);
  }
  return null;
}

const monopoly = {
  play: monopolyPlay,
  delay(state) {
    const events = state.lastMove && state.lastMove.events ? state.lastMove.events.length : 0;
    return Math.min(4200, jitter(1100, 600) + events * 250);
  },
  reaction(before, after, bot) {
    const events = (after.lastMove && after.lastMove.events) || [];
    if (after.phase === "finished" && after.result && after.result.winner === bot) return "😏";
    if (events.some(e => e.type === "bankrupt" && e.person === bot)) return "😭";
    if (events.some(e => e.type === "rent" && e.owner === bot && e.amount >= 200)) return "😏";
    if (events.some(e => e.type === "jail" && e.person === bot)) return "🙈";
    if (events.some(e => e.type === "rent" && e.person === bot && e.amount >= 300)) return "😱";
    return null;
  }
};

return { NAMES: ["Udiou", "Klausi"], cabo, nimmt, qwixx, flip7, monopoly };

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = GameBots;
}
if (typeof window !== "undefined") {
  window.GameBots = GameBots;
}
