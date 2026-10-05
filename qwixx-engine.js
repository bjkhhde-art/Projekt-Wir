/* Qwixx – reine Spiellogik für 2–4 Personen, inkl. „Qwixx gemixxt“-Blöcke und Zufallsblock.
   Ohne DOM-Abhängigkeit: im Browser als <script> geladen, in Node per require testbar. */

const QwixxEngine = (() => {

const COLORS = ["red", "yellow", "green", "blue"];
const ASCENDING = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DESCENDING = ASCENDING.slice().reverse();
const POINTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];
const MIN_CROSSES_TO_LOCK = 5;
const MAX_PENALTIES = 4;
const LOCKS_TO_END = 2;
const PENALTY_POINTS = 5;
const MAX_PLAYERS = 4;

const BLOCKS = {
  classic: "Klassisch",
  colors: "Farben gemixxt",
  numbers: "Zahlen gemixxt",
  random: "Zufallsblock"
};

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function perPlayer(players, valueFn) {
  return players.reduce((acc, p) => { acc[p] = valueFn(p); return acc; }, {});
}

function otherPerson(state, person) {
  return state.players.find(p => p !== person);
}

/* turns go round in the order of the players list */
function nextPerson(state, person) {
  const index = state.players.indexOf(person);
  return state.players[(index + 1) % state.players.length];
}

/* highest wins; several share a win, but if everybody has the same nobody wins */
function winnersOf(players, valueOf) {
  const best = Math.max(...players.map(valueOf));
  const winners = players.filter(p => valueOf(p) === best);
  return winners.length === players.length ? [] : winners;
}

function recordMove(state, move) {
  state.moveSeq = (state.moveSeq || 0) + 1;
  state.lastMove = { ...move, seq: state.moveSeq };
}

/* ---------- score sheets ---------- */

/* A row is a list of {n, c} cells crossed left to right; its last cell locks it. */
function makeRow(numbers, colors) {
  return numbers.map((n, i) => ({ n, c: colors[i] }));
}

/* segments like [["yellow", 4], ["green", 3], ["red", 4]] -> 11 cell colors */
function segmentColors(segments) {
  return segments.flatMap(([color, length]) => Array(length).fill(color));
}

const mono = color => Array(11).fill(color);

function classicLayout() {
  return [
    makeRow(ASCENDING, mono("red")),
    makeRow(ASCENDING, mono("yellow")),
    makeRow(DESCENDING, mono("green")),
    makeRow(DESCENDING, mono("blue"))
  ];
}

/* „Farben gemixxt“: numbers in their usual order, colours change in blocks of 3-4 fields.
   The last field keeps the row's classic colour (e.g. the top row is locked with the red 12). */
function mixedColorsLayout() {
  return [
    makeRow(ASCENDING, segmentColors([["yellow", 4], ["green", 3], ["red", 4]])),
    makeRow(ASCENDING, segmentColors([["blue", 3], ["red", 4], ["yellow", 4]])),
    makeRow(DESCENDING, segmentColors([["red", 4], ["blue", 3], ["green", 4]])),
    makeRow(DESCENDING, segmentColors([["green", 3], ["yellow", 4], ["blue", 4]]))
  ];
}

/* „Zahlen gemixxt“: one colour per row, numbers shuffled; locked with red 11, yellow 10, green 3, blue 4. */
function mixedNumbersLayout() {
  return [
    makeRow([10, 6, 2, 8, 3, 4, 12, 5, 9, 7, 11], mono("red")),
    makeRow([9, 12, 4, 6, 7, 2, 5, 8, 11, 3, 10], mono("yellow")),
    makeRow([4, 7, 11, 8, 2, 10, 6, 12, 5, 9, 3], mono("green")),
    makeRow([8, 3, 10, 12, 6, 9, 7, 2, 11, 5, 4], mono("blue"))
  ];
}

/* Zufallsblock: shuffled numbers and colour blocks; every colour locks exactly one row. */
function randomLayout() {
  const lockColors = shuffle(COLORS);
  return lockColors.map(lockColor => {
    const [first, second] = shuffle(COLORS.filter(c => c !== lockColor));
    const [a, b, c] = shuffle([[4, 4, 3], [4, 3, 4], [3, 4, 4]])[0];
    return makeRow(shuffle(ASCENDING), segmentColors([[first, a], [second, b], [lockColor, c]]));
  });
}

function layoutFor(blockType) {
  switch (blockType) {
    case "colors": return mixedColorsLayout();
    case "numbers": return mixedNumbersLayout();
    case "random": return randomLayout();
    default: return classicLayout();
  }
}

const lockColorOf = row => row[row.length - 1].c;

function removedColors(state) {
  return state.lockedRows.map(r => lockColorOf(state.layout[r]));
}

/* ---------- setup ---------- */

function newGame(players, blockType, starter, wins, gameNo, previousMoveSeq) {
  const layout = layoutFor(blockType);
  const moveSeq = (previousMoveSeq || 0) + 1;
  return {
    moveSeq,
    lastMove: { type: "new-game", seq: moveSeq },
    players,
    blockType,
    layout,
    sheets: perPlayer(players, () => ({ marks: layout.map(() => []), locked: [], penalties: 0 })),
    lockedRows: [],
    pendingLocks: [],
    starter,
    active: starter,
    phase: "roll",
    dice: null,
    rollNo: 0,
    white: perPlayer(players, () => ({ done: false, cross: null })),
    activeCrossed: false,
    log: [],
    result: null,
    wins: wins || perPlayer(players, () => 0),
    gameNo: gameNo || 1
  };
}

/* createInitialState(["Isi", "Benji", "Lena"], "classic") – or the old form (host, guest, blockType) */
function createInitialState(playersOrHost, second, third) {
  const players = Array.isArray(playersOrHost) ? playersOrHost.slice() : [playersOrHost, second];
  const blockType = Array.isArray(playersOrHost) ? second : third;
  if (players.length < 2 || players.length > MAX_PLAYERS) throw new Error("Qwixx braucht hier 2 bis 4 Personen.");
  const type = BLOCKS[blockType] ? blockType : "classic";
  return newGame(players, type, players[0], null, 1, 0);
}

/* ---------- rules ---------- */

/* Crosses go left to right, skipped fields are lost; the last field needs 5 crosses first. */
function canCross(state, person, row, index) {
  const cells = state.layout[row];
  if (!cells || index < 0 || index >= cells.length) return false;
  if (state.lockedRows.includes(row)) return false;
  const marks = state.sheets[person].marks[row];
  if (marks.length > 0 && index <= marks[marks.length - 1]) return false;
  if (index === cells.length - 1 && marks.length < MIN_CROSSES_TO_LOCK) return false;
  return true;
}

function whiteOptions(state, person) {
  if (state.phase !== "white" || state.white[person].done) return [];
  const sum = state.dice.w1 + state.dice.w2;
  const options = [];
  state.layout.forEach((cells, row) => {
    cells.forEach((cell, index) => {
      if (cell.n === sum && canCross(state, person, row, index)) options.push({ row, index });
    });
  });
  return options;
}

/* the active player combines one white die with one coloured die and crosses a field of that colour */
function colorOptions(state, person) {
  if (state.phase !== "color" || state.active !== person) return [];
  const options = [];
  state.layout.forEach((cells, row) => {
    cells.forEach((cell, index) => {
      const die = state.dice[cell.c];
      if (die === null || die === undefined) return;
      if ((state.dice.w1 + die === cell.n || state.dice.w2 + die === cell.n) && canCross(state, person, row, index)) {
        options.push({ row, index });
      }
    });
  });
  return options;
}

function isOption(options, row, index) {
  return options.some(o => o.row === row && o.index === index);
}

/* crossing the last field locks the row and earns its lock symbol as an extra cross */
function markCross(state, person, row, index) {
  const sheet = state.sheets[person];
  sheet.marks[row].push(index);
  const locks = index === state.layout[row].length - 1;
  if (locks) sheet.locked.push(row);
  return locks;
}

function rowCount(sheet, row) {
  return sheet.marks[row].length + (sheet.locked.includes(row) ? 1 : 0);
}

function scoreOf(state, person) {
  const sheet = state.sheets[person];
  const rows = state.layout.map((_, row) => POINTS[Math.min(rowCount(sheet, row), POINTS.length - 1)]);
  const penalties = sheet.penalties * PENALTY_POINTS;
  return { rows, penalties, total: rows.reduce((a, b) => a + b, 0) - penalties };
}

function gameShouldEnd(state) {
  return state.lockedRows.length >= LOCKS_TO_END ||
    state.players.some(p => state.sheets[p].penalties >= MAX_PENALTIES);
}

function finishGame(state) {
  state.phase = "finished";
  const scores = perPlayer(state.players, p => scoreOf(state, p));
  const winners = winnersOf(state.players, p => scores[p].total);
  winners.forEach(p => { state.wins[p] = (state.wins[p] || 0) + 1; });
  state.result = { scores, winner: winners.length === 1 ? winners[0] : null, winners };
}

function endTurn(state) {
  const penalty = !state.activeCrossed;
  if (penalty) state.sheets[state.active].penalties += 1;

  if (gameShouldEnd(state)) {
    finishGame(state);
  } else {
    state.active = nextPerson(state, state.active);
    state.phase = "roll";
    state.dice = null;
  }
  return penalty;
}

/* locks made while everybody chooses at once only take effect when all are done */
function resolveWhite(state) {
  state.pendingLocks.forEach(row => {
    if (!state.lockedRows.includes(row)) state.lockedRows.push(row);
  });
  state.pendingLocks = [];

  if (gameShouldEnd(state)) {
    finishGame(state);
  } else {
    state.phase = "color";
  }
}

/* ---------- player actions (each returns a NEW state) ---------- */

function assertPlayer(state, person) {
  if (!state.players.includes(person)) throw new Error("Unbekannte Person.");
}

function roll(state, person) {
  assertPlayer(state, person);
  if (state.phase !== "roll") throw new Error("Gerade wird nicht gewürfelt.");
  if (state.active !== person) throw new Error("Du bist gerade nicht dran mit Würfeln.");

  const next = cloneState(state);
  const removed = removedColors(next);
  const d6 = () => 1 + Math.floor(Math.random() * 6);
  next.dice = { w1: d6(), w2: d6() };
  COLORS.forEach(color => { next.dice[color] = removed.includes(color) ? null : d6(); });
  next.phase = "white";
  next.white = perPlayer(next.players, () => ({ done: false, cross: null }));
  next.activeCrossed = false;
  next.log = [];
  next.rollNo += 1;
  recordMove(next, { type: "roll", person, dice: next.dice });
  return next;
}

function crossWhite(state, person, row, index) {
  assertPlayer(state, person);
  if (state.phase !== "white") throw new Error("Gerade kann die weiße Summe nicht angekreuzt werden.");
  if (state.white[person].done) throw new Error("Du hast für diesen Wurf schon entschieden.");
  if (!isOption(whiteOptions(state, person), row, index)) throw new Error("Dieses Feld geht gerade nicht.");

  const next = cloneState(state);
  const locks = markCross(next, person, row, index);
  if (locks) next.pendingLocks.push(row);
  next.log.push({ type: "cross", person, row, index, locks });
  next.white[person] = { done: true, cross: { row, index } };
  if (person === next.active) next.activeCrossed = true;

  const bothDone = next.players.every(p => next.white[p].done);
  if (bothDone) resolveWhite(next);
  recordMove(next, { type: "cross", person, row, index, locks, phase: "white" });
  return next;
}

function passWhite(state, person) {
  assertPlayer(state, person);
  if (state.phase !== "white") throw new Error("Gerade gibt es nichts zu überspringen.");
  if (state.white[person].done) throw new Error("Du hast für diesen Wurf schon entschieden.");

  const next = cloneState(state);
  next.white[person] = { done: true, cross: null };
  if (next.players.every(p => next.white[p].done)) resolveWhite(next);
  recordMove(next, { type: "pass", person, phase: "white" });
  return next;
}

function crossColor(state, person, row, index) {
  assertPlayer(state, person);
  if (!isOption(colorOptions(state, person), row, index)) throw new Error("Dieses Feld geht gerade nicht.");

  const next = cloneState(state);
  const locks = markCross(next, person, row, index);
  if (locks && !next.lockedRows.includes(row)) next.lockedRows.push(row);
  next.log.push({ type: "cross", person, row, index, locks });
  next.activeCrossed = true;
  endTurn(next);
  recordMove(next, { type: "cross", person, row, index, locks, phase: "color" });
  return next;
}

function passColor(state, person) {
  assertPlayer(state, person);
  if (state.phase !== "color" || state.active !== person) throw new Error("Gerade gibt es nichts zu überspringen.");

  const next = cloneState(state);
  const penalty = endTurn(next);
  if (penalty) next.log.push({ type: "penalty", person });
  recordMove(next, { type: "pass", person, phase: "color", penalty });
  return next;
}

function rematch(state) {
  if (state.phase !== "finished") throw new Error("Die Partie läuft noch.");
  return newGame(state.players, state.blockType, nextPerson(state, state.starter), state.wins, state.gameNo + 1, state.moveSeq);
}

return {
  COLORS,
  POINTS,
  BLOCKS,
  MIN_CROSSES_TO_LOCK,
  MAX_PENALTIES,
  PENALTY_POINTS,
  MAX_PLAYERS,
  layoutFor,
  lockColorOf,
  removedColors,
  createInitialState,
  canCross,
  whiteOptions,
  colorOptions,
  scoreOf,
  roll,
  crossWhite,
  passWhite,
  crossColor,
  passColor,
  rematch,
  otherPerson,
  nextPerson
};

})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = QwixxEngine;
}
if (typeof window !== "undefined") {
  window.QwixxEngine = QwixxEngine;
}
