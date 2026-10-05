import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Engine = require("../../cabo-engine.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

/* ---------- deck composition ---------- */
const deck = Engine.buildDeck();
ok(deck.length === 52, `deck has 52 cards (got ${deck.length})`);
const sum0 = deck.filter(v => v === 0).length;
const sum13 = deck.filter(v => v === 13).length;
const sum7 = deck.filter(v => v === 7).length;
ok(sum0 === 2, `two 0-cards (got ${sum0})`);
ok(sum13 === 2, `two 13-cards (got ${sum13})`);
ok(sum7 === 4, `four 7-cards (got ${sum7})`);

/* ---------- setup ---------- */
let state = Engine.createInitialState("Isi", "Benji");
ok(state.turnPhase === "initial-peek", "new game starts in initial-peek phase");
ok(state.hands.Isi.length === 4 && state.hands.Benji.length === 4, "both hands have 4 cards");
ok(state.deck.length === 52 - 8 - 1, `deck has 43 cards after dealing + 1 discard flip (got ${state.deck.length})`);
ok(state.discard.length === 1, "discard pile starts with 1 card");

state = Engine.performInitialPeek(state, "Isi");
ok(state.turnPhase === "initial-peek", "still waiting after only one player peeked");
state = Engine.performInitialPeek(state, "Benji");
ok(state.turnPhase === "awaiting-draw", "both peeked -> game begins");
ok(state.turnPerson === "Isi", "host starts first");
ok(!("knownToOwner" in state), "no persistent card knowledge is tracked, players remember on their own");

/* ---------- reject acting out of turn ---------- */
assert.throws(() => Engine.drawFromDeck(state, "Benji"), /nicht am Zug/);
assertions++;
console.log("PASS: acting out of turn throws");

/* ---------- draw from deck + swap ---------- */
state = Engine.drawFromDeck(state, "Isi");
ok(state.turnPhase === "post-draw-decision", "after draw, decision phase");
ok(typeof state.drawnCard === "number", "drawn card is a number");

const deckLenBeforeSwap = state.deck.length;
const drawnForSwap = state.drawnCard;
const replacedCard = state.hands.Isi[0];
state = Engine.swapCards(state, "Isi", [0]);
ok(state.turnPhase === "awaiting-draw", "after swap, turn passes");
ok(state.turnPerson === "Benji", "turn is now Benji's");
ok(state.hands.Isi[0] === drawnForSwap, "drawn card now sits in the swapped slot");
ok(state.discard[state.discard.length - 1] === replacedCard, "replaced card lands on top of the discard pile");
ok(state.deck.length === deckLenBeforeSwap, "deck size unchanged by swap (card moved hand<->discard only)");

/* ---------- draw from discard must swap, no power ---------- */
state = Engine.drawFromDiscard(state, "Benji");
ok(state.drawSource === "discard", "drew from discard pile");
assert.throws(() => Engine.discardDrawn(state, "Benji"), /muss getauscht werden/);
assertions++;
console.log("PASS: cannot directly discard a card drawn from the discard pile");
state = Engine.swapCards(state, "Benji", [1]);
ok(state.turnPerson === "Isi", "turn passed back to Isi after Benji's forced swap");

/* ---------- force a 7 (peek own) scenario deterministically ---------- */
function forceDrawnCard(s, value) {
  const copy = JSON.parse(JSON.stringify(s));
  copy.deck.push(value);
  return copy;
}

state = forceDrawnCard(state, 7);
state = Engine.drawFromDeck(state, "Isi");
ok(state.drawnCard === 7, "forced draw of a 7");
state = Engine.discardDrawn(state, "Isi");
ok(state.turnPhase === "await-peek-own-target", "discarding a 7 triggers peek-own phase");
state = Engine.choosePeekOwnTarget(state, "Isi", 2);
ok(state.lastPeekResult.type === "own" && state.lastPeekResult.person === "Isi", "peek-own result recorded");
ok(state.turnPhase === "peek-result" && state.turnPerson === "Isi", "peek result belongs to Isi's turn, turn does not pass yet");
assert.throws(() => Engine.drawFromDeck(state, "Benji"), /nicht am Zug/);
assertions++;
console.log("PASS: opponent cannot act while the peeked card is shown");
state = Engine.finishPeek(state, "Isi");
ok(state.turnPerson === "Benji" && state.turnPhase === "awaiting-draw", "turning the card back ends Isi's turn");
ok(state.lastPeekResult === null, "peek result is cleared once the turn ends");

/* ---------- force a 9 (spy) scenario ---------- */
state = forceDrawnCard(state, 9);
state = Engine.drawFromDeck(state, "Benji");
state = Engine.discardDrawn(state, "Benji");
ok(state.turnPhase === "await-spy-target", "discarding a 9 triggers spy phase");
state = Engine.chooseSpyTarget(state, "Benji", 3);
ok(state.lastPeekResult.type === "spy" && state.lastPeekResult.targetPerson === "Isi", "spy result targets the opponent");
ok(state.turnPhase === "peek-result" && state.turnPerson === "Benji", "spy result belongs to Benji's turn");
state = Engine.finishPeek(state, "Benji");
ok(state.turnPerson === "Isi" && state.lastPeekResult === null, "turn passes once the spied card is turned back");

/* ---------- force an 11 (swap power): blind swap with the opponent ---------- */
state = forceDrawnCard(state, 11);
state = Engine.drawFromDeck(state, "Isi");
state = Engine.discardDrawn(state, "Isi");
ok(state.turnPhase === "await-swap-target", "discarding an 11 triggers the swap power");
const isiCardBefore = state.hands.Isi[1];
const benjiCardBefore = state.hands.Benji[2];
state = Engine.swapWithOpponent(state, "Isi", 1, 2);
ok(state.hands.Isi[1] === benjiCardBefore && state.hands.Benji[2] === isiCardBefore, "swap power exchanges exactly the two chosen cards");
ok(state.lastEvent.type === "blind-swap" && state.lastEvent.ownIndex === 1 && state.lastEvent.opponentIndex === 2, "blind swap is recorded so the opponent can be told");
ok(state.turnPerson === "Benji", "turn passes after the swap power");

/* ---------- a 12 also grants the swap power, which may be skipped ---------- */
state = forceDrawnCard(state, 12);
state = Engine.drawFromDeck(state, "Benji");
state = Engine.discardDrawn(state, "Benji");
ok(state.turnPhase === "await-swap-target", "discarding a 12 triggers the swap power too");
const handsBeforeSkip = JSON.stringify(state.hands);
state = Engine.skipSwap(state, "Benji");
ok(JSON.stringify(state.hands) === handsBeforeSkip && state.turnPerson === "Isi", "skipping the swap power changes nothing and passes the turn");

/* ---------- swapping several equal cards at once ---------- */
state.hands.Isi = [5, 2, 5, 5];
state = forceDrawnCard(state, 1);
state = Engine.drawFromDeck(state, "Isi");
const discardLenBefore = state.discard.length;
state = Engine.swapCards(state, "Isi", [3, 0, 2]);
ok(JSON.stringify(state.hands.Isi) === JSON.stringify([1, 2]), `three equal 5s replaced by the drawn 1, hand shrinks (got ${JSON.stringify(state.hands.Isi)})`);
ok(state.discard.length === discardLenBefore + 3 && state.discard.slice(-3).every(v => v === 5), "all three 5s land on the discard pile");
ok(state.lastEvent.type === "multi-swap" && state.lastEvent.count === 3, "multi-swap is recorded for the opponent");
ok(state.turnPerson === "Benji", "turn passes after a multi-swap");

/* ---------- mismatched multi-swap: cards stay, drawn card discarded, turn lost ---------- */
state.hands.Benji = [4, 6, 4, 9];
state = forceDrawnCard(state, 0);
state = Engine.drawFromDeck(state, "Benji");
state = Engine.swapCards(state, "Benji", [0, 1]);
ok(JSON.stringify(state.hands.Benji) === JSON.stringify([4, 6, 4, 9]), "mismatched cards stay in place");
ok(state.discard[state.discard.length - 1] === 0, "the drawn card goes onto the discard pile instead");
ok(state.lastEvent.type === "multi-swap-failed", "failed multi-swap is recorded");
ok(state.turnPerson === "Isi", "turn is lost and passes on");

function forceDrawnCardThenDraw(s, person) {
  return Engine.drawFromDeck(forceDrawnCard(s, 3), person);
}

assert.throws(() => Engine.swapCards(forceDrawnCardThenDraw(state, "Isi"), "Isi", [0, 0]), /nur einmal/);
assertions++;
console.log("PASS: picking the same card twice is rejected");

/* ---------- a 2-card hand: spy/swap targets beyond the hand are rejected ---------- */
assert.throws(() => Engine.swapCards(forceDrawnCardThenDraw(state, "Isi"), "Isi", [3]), /Ungültiger Platz/);
assertions++;
console.log("PASS: swapping a slot that no longer exists is rejected");

/* ---------- force a plain card (no power) ---------- */
state = forceDrawnCard(state, 3);
state = Engine.drawFromDeck(state, "Isi");
state = Engine.discardDrawn(state, "Isi");
ok(state.turnPhase === "awaiting-draw" && state.turnPerson === "Benji", "plain card discard just passes turn, no power phase");

/* ---------- calling cabo ends the round after final turns ---------- */
state = Engine.callCabo(state, "Benji");
ok(state.lastEvent.type === "cabo" && state.lastEvent.person === "Benji", "cabo call is recorded for the opponent");
assert.throws(() => Engine.callCabo(state, "Isi"), /schon gerufen/);
assertions++;
console.log("PASS: cabo cannot be called a second time during the final turn");
ok(state.caboCalledBy === "Benji", "cabo recorded as called by Benji");
ok(state.finalTurnsRemaining.length === 1 && state.finalTurnsRemaining[0] === "Isi", "Isi owes exactly one final turn");
ok(state.turnPerson === "Isi", "turn passed to Isi for the final round");
ok(!state.roundOver, "round not over yet, Isi still needs their final turn");

state = Engine.drawFromDeck(state, "Isi");
state = Engine.swapCards(state, "Isi", [1]);
ok(state.roundOver === true, "round ends after the final turn is taken");
ok(state.revealHands === true, "hands are revealed at round end");
ok(state.roundScores.Isi != null && state.roundScores.Benji != null, "round scores computed for both players");

const expectedIsi = state.hands.Isi.reduce((a, b) => a + b, 0);
const expectedBenji = state.hands.Benji.reduce((a, b) => a + b, 0);
ok(state.roundScores.Isi === expectedIsi, `Isi's round score matches hand sum (${state.roundScores.Isi} === ${expectedIsi})`);
ok(state.roundScores.Benji === expectedBenji, `Benji's round score matches hand sum (${state.roundScores.Benji} === ${expectedBenji})`);
ok(state.scores.Isi.length === 1 && state.scores.Benji.length === 1, "cumulative score history recorded one round");

/* ---------- next round deals fresh hands, keeps cumulative scores ---------- */
const scoresBefore = JSON.parse(JSON.stringify(state.scores));
const nextRound = Engine.startNextRound(state);
ok(nextRound.round === 2, "round counter incremented");
ok(nextRound.roundOver === false, "new round is not over");
ok(JSON.stringify(nextRound.scores) === JSON.stringify(scoresBefore), "cumulative scores carried over to next round");
ok(nextRound.turnPerson === "Benji", "starting player alternates for round 2");

/* ---------- deck exhaustion reshuffles discard pile ---------- */
let s2 = Engine.createInitialState("Isi", "Benji");
s2 = Engine.performInitialPeek(s2, "Isi");
s2 = Engine.performInitialPeek(s2, "Benji");
s2.deck = []; // force exhaustion
s2.discard = [5, 9, 2]; // top is 2
const before = s2.discard.length;
const afterDraw = Engine.drawFromDeck(s2, "Isi");
ok(afterDraw.drawnCard !== undefined, "drawing with empty deck still returns a card (reshuffled from discard)");
ok(afterDraw.discard.length === 1, "discard pile reset to just the last top card after reshuffle");
ok(afterDraw.lastMove.reshuffled === 2 && afterDraw.lastEvent.type === "reshuffle" && afterDraw.lastEvent.count === 2, "the reshuffle is recorded so both players can see it");
const normalDraw = Engine.drawFromDeck(Engine.performInitialPeek(Engine.performInitialPeek(Engine.createInitialState("Isi", "Benji"), "Isi"), "Benji"), "Isi");
ok(normalDraw.lastMove.reshuffled === 0 && normalDraw.lastEvent === null, "a normal draw does not claim a reshuffle");

/* ---------- game-over threshold ---------- */
let s3 = Engine.createInitialState("Isi", "Benji");
s3.scores = { Isi: [40, 35, 30], Benji: [10, 5, 8] };
s3 = Engine.performInitialPeek(s3, "Isi");
s3 = Engine.performInitialPeek(s3, "Benji");
s3 = Engine.callCabo(s3, "Isi");
s3 = Engine.drawFromDeck(s3, "Benji");
s3 = Engine.swapCards(s3, "Benji", [0]);
const isiTotal = s3.scores.Isi.reduce((a, b) => a + b, 0);
ok(isiTotal >= 100, `Isi's cumulative total crosses 100 (${isiTotal})`);
ok(s3.gameOver === true, "game marked over once a player crosses the target score");
ok(s3.winner === "Benji", `lowest cumulative total wins overall (got "${s3.winner}")`);

/* ---------- every card movement is recorded once, with a rising sequence number ---------- */
let m = Engine.createInitialState("Isi", "Benji");
ok(m.lastMove.type === "deal" && m.moveSeq === 1, "a new game starts with a recorded deal");
m = Engine.performInitialPeek(m, "Isi");
m = Engine.performInitialPeek(m, "Benji");
ok(m.moveSeq === 1, "the initial peek moves no cards and records nothing");
m.deck.push(4);
m = Engine.drawFromDeck(m, "Isi");
ok(m.lastMove.type === "draw" && m.lastMove.from === "deck" && m.lastMove.card === 4 && m.moveSeq === 2, "drawing from the deck is recorded with the card");
m.hands.Isi = [9, 9, 3, 1];
m = Engine.swapCards(m, "Isi", [0, 1]);
ok(m.lastMove.type === "swap" && JSON.stringify(m.lastMove.discarded) === "[9,9]" && m.lastMove.drawSource === "deck", "a multi-swap records the discarded cards and where the drawn card came from");
m = Engine.drawFromDiscard(m, "Benji");
ok(m.lastMove.type === "draw" && m.lastMove.from === "discard" && m.lastMove.card === 9, "taking from the discard pile is recorded");
m.hands.Benji = [2, 5, 7, 8];
m = Engine.swapCards(m, "Benji", [0, 1]);
ok(m.lastMove.type === "swap-failed" && m.lastMove.card === 9, "a failed multi-swap is recorded");
m.deck.push(12);
m = Engine.drawFromDeck(m, "Isi");
m = Engine.discardDrawn(m, "Isi");
ok(m.lastMove.type === "discard" && m.lastMove.card === 12, "putting a card down is recorded");
m = Engine.swapWithOpponent(m, "Isi", 0, 3);
ok(m.lastMove.type === "blind-swap" && m.lastMove.ownIndex === 0 && m.lastMove.opponentIndex === 3, "the blind swap is recorded");
const seqBeforeCabo = m.moveSeq;
m = Engine.callCabo(m, "Benji");
m.deck.push(3);
m = Engine.drawFromDeck(m, "Isi");
m = Engine.discardDrawn(m, "Isi");
ok(m.roundOver, "round over after Isi's final turn");
const next = Engine.startNextRound(m);
ok(next.lastMove.type === "deal" && next.moveSeq === m.moveSeq + 1 && next.moveSeq > seqBeforeCabo, "the next round's deal continues the sequence");


/* ---------- three and four players ---------- */
let q = Engine.createInitialState(["Isi", "Benji", "Lena", "Tom"]);
ok(q.players.length === 4 && q.players.every(p => q.hands[p].length === 4) && q.deck.length === 52 - 16 - 1, "four players get four cards each");
ok(q.turnPerson === "Isi", "the first player starts");
for (const p of ["Isi", "Benji", "Lena"]) q = Engine.performInitialPeek(q, p);
ok(q.turnPhase === "initial-peek", "the game waits until all four have looked at their cards");
q = Engine.performInitialPeek(q, "Tom");
ok(q.turnPhase === "awaiting-draw", "then the first turn begins");
function plainTurn(st, p) {
  st = Engine.drawFromDeck(st, p);
  st.drawnCard = 0;
  return Engine.discardDrawn(st, p);
}
q = plainTurn(q, "Isi");
ok(q.turnPerson === "Benji", "Benji follows Isi");
q = plainTurn(q, "Benji");
q = plainTurn(q, "Lena");
ok(q.turnPerson === "Tom", "Tom follows Lena");
q = plainTurn(q, "Tom");
ok(q.turnPerson === "Isi", "after Tom it is Isi's turn again");

/* spy and swap pick any other player */
let sp = Engine.drawFromDeck(q, "Isi");
sp.drawnCard = 9;
sp = Engine.discardDrawn(sp, "Isi");
assert.throws(() => Engine.chooseSpyTarget(sp, "Isi", "Isi", 0), /jemand anderem/);
assert.throws(() => Engine.chooseSpyTarget(sp, "Isi", "Nobody", 0), /jemand anderem/);
sp = Engine.chooseSpyTarget(sp, "Isi", "Lena", 2);
ok(sp.lastPeekResult.targetPerson === "Lena" && sp.lastPeekResult.slot === 2, "spy looks at a card of the chosen player");
let sw = Engine.drawFromDeck(q, "Isi");
sw.drawnCard = 12;
sw = Engine.discardDrawn(sw, "Isi");
const isiCard = sw.hands.Isi[1];
const tomCard = sw.hands.Tom[3];
sw = Engine.swapWithOpponent(sw, "Isi", 1, "Tom", 3);
ok(sw.hands.Isi[1] === tomCard && sw.hands.Tom[3] === isiCard && sw.lastEvent.targetPerson === "Tom", "swap exchanges with the chosen player");
ok(sw.turnPerson === "Benji", "and the turn passes on");

/* cabo: everybody else gets exactly one more turn */
let cb = Engine.callCabo(q, "Isi");
ok(cb.turnPerson === "Benji" && cb.finalTurnsRemaining.length === 3, "after Cabo the other three get one last turn each");
cb = plainTurn(cb, "Benji");
cb = plainTurn(cb, "Lena");
ok(!cb.roundOver && cb.turnPerson === "Tom", "the round goes on until the last of them");
cb = plainTurn(cb, "Tom");
ok(cb.roundOver && Object.keys(cb.roundScores).length === 4, "then the round ends and all four are scored");

/* starters rotate through all players */
let rot = cb;
const starters = [];
for (let round = 0; round < 4; round++) {
  rot = Engine.startNextRound(rot);
  starters.push(rot.turnPerson);
  rot.roundOver = true;
}
ok(starters.join() === "Benji,Lena,Tom,Isi", `each round the next player starts (${starters.join()})`);

/* a finished game can start over with the same people */
const over = { ...cb, gameOver: true, winner: "Lena" };
const again = Engine.newGame(over);
ok(again.round === 1 && again.players.join() === "Isi,Benji,Lena,Tom" && again.players.every(p => again.scores[p].length === 0), "a new game keeps the players and resets the scores");
ok(again.moveSeq === over.moveSeq + 1 && again.lastMove.type === "deal", "its deal continues the move sequence");
assert.throws(() => Engine.newGame(q), /läuft noch/);
assert.throws(() => Engine.createInitialState(["A", "B", "C", "D", "E"]), /2 bis 4/);
ok(true, "no new game while one is running, at most four players");

console.log(`\n${assertions} assertions passed (cabo-engine unit tests)`);
