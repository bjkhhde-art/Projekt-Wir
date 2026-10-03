import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Q = require("../../qwixx-engine.js");

let assertions = 0;
function ok(cond, msg) { assert.ok(cond, msg); assertions++; console.log("PASS:", msg); }
function throwsWith(fn, pattern, msg) { assert.throws(fn, pattern); assertions++; console.log("PASS:", msg); }

const nums = row => row.map(c => c.n);
const cols = row => row.map(c => c.c);
const range = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* ---------- blocks ---------- */
const classic = Q.layoutFor("classic");
ok(JSON.stringify(nums(classic[0])) === JSON.stringify(range) && cols(classic[0]).every(c => c === "red"), "classic: red 2-12");
ok(cols(classic[1]).every(c => c === "yellow") && nums(classic[1])[0] === 2, "classic: yellow 2-12");
ok(JSON.stringify(nums(classic[2])) === JSON.stringify(range.slice().reverse()) && cols(classic[2]).every(c => c === "green"), "classic: green 12-2");
ok(cols(classic[3]).every(c => c === "blue") && nums(classic[3])[0] === 12, "classic: blue 12-2");

const mixedColors = Q.layoutFor("colors");
ok(JSON.stringify(nums(mixedColors[0])) === JSON.stringify(range) && JSON.stringify(nums(mixedColors[2])) === JSON.stringify(range.slice().reverse()), "Farben gemixxt: numbers keep their usual order");
ok(mixedColors.every(row => new Set(cols(row)).size === 3), "Farben gemixxt: every row changes colour");
ok(mixedColors.every(row => {
  const lengths = [];
  cols(row).forEach((c, i, all) => { if (i === 0 || c !== all[i - 1]) lengths.push(1); else lengths[lengths.length - 1]++; });
  return lengths.every(l => l === 3 || l === 4);
}), "Farben gemixxt: colour blocks of 3-4 fields");
ok(Q.lockColorOf(mixedColors[0]) === "red" && mixedColors[0][10].n === 12, "Farben gemixxt: the top row is locked with the red 12");
ok(new Set(mixedColors.map(Q.lockColorOf)).size === 4, "Farben gemixxt: every colour locks exactly one row");

const mixedNumbers = Q.layoutFor("numbers");
ok(mixedNumbers.every(row => JSON.stringify(nums(row).slice().sort((a, b) => a - b)) === JSON.stringify(range)), "Zahlen gemixxt: each row has 2-12 once");
ok(mixedNumbers.every(row => new Set(cols(row)).size === 1), "Zahlen gemixxt: one colour per row");
ok(JSON.stringify(mixedNumbers.map(r => r[10].n)) === "[11,10,3,4]", "Zahlen gemixxt: locked with red 11, yellow 10, green 3, blue 4");

for (let i = 0; i < 50; i++) {
  const random = Q.layoutFor("random");
  assert.ok(random.every(row => JSON.stringify(nums(row).slice().sort((a, b) => a - b)) === JSON.stringify(range)));
  assert.equal(new Set(random.map(Q.lockColorOf)).size, 4);
  assert.ok(random.every(row => new Set(cols(row)).size === 3));
}
ok(true, "Zufallsblock: 50 random blocks all valid (2-12 per row, 3 colours per row, each colour locks one row)");
ok(JSON.stringify(Q.layoutFor("random")) !== JSON.stringify(Q.layoutFor("random")), "Zufallsblock: every game gets a new block");

/* ---------- setup ---------- */
let s = Q.createInitialState("Isi", "Benji", "classic");
ok(s.phase === "roll" && s.active === "Isi", "the host rolls first");
throwsWith(() => Q.roll(s, "Benji"), /nicht dran/, "only the active player rolls");
const fixDice = (st, dice) => { st.dice = { ...st.dice, ...dice }; return st; };

s = Q.roll(s, "Isi");
ok(s.phase === "white" && ["w1", "w2", "red", "yellow", "green", "blue"].every(k => s.dice[k] >= 1 && s.dice[k] <= 6), "rolling throws 6 dice");
ok(s.lastMove.type === "roll", "the roll is recorded for the animation");

/* ---------- action 1: white sum for both, at the same time ---------- */
fixDice(s, { w1: 3, w2: 4, red: 1, yellow: 2, green: 5, blue: 6 });
const whiteIsi = Q.whiteOptions(s, "Isi");
ok(whiteIsi.length === 4 && whiteIsi.every(o => s.layout[o.row][o.index].n === 7), "the white 7 can be crossed in any of the four rows");
s = Q.crossWhite(s, "Isi", 0, 5); // red 7
ok(s.phase === "white", "Isi waits for Benji");
throwsWith(() => Q.crossWhite(s, "Isi", 1, 5), /schon entschieden/, "only one white cross per roll");
s = Q.crossWhite(s, "Benji", 2, 5); // green 7
ok(s.phase === "color" && s.active === "Isi", "after both decided, Isi may combine colours");

/* ---------- action 2: white + colour, active player only ---------- */
const colorIsi = Q.colorOptions(s, "Isi");
// red 1 + white 3/4 = 4/5 -> red 4/5 are LEFT of the red 7 -> not allowed
ok(!colorIsi.some(o => o.row === 0), "fields left of an existing cross are lost");
// yellow 2 + 3/4 = 5/6 ; green 5 + 3/4 = 8/9 ; blue 6 + 3/4 = 9/10
ok(colorIsi.some(o => o.row === 1 && s.layout[1][o.index].n === 6), "yellow 2 + white 4 = yellow 6 is allowed");
ok(colorIsi.some(o => o.row === 3 && s.layout[3][o.index].n === 10), "blue 6 + white 4 = blue 10 is allowed");
ok(Q.colorOptions(s, "Benji").length === 0, "the other player cannot use colours");
s = Q.crossColor(s, "Isi", 1, 4); // yellow 6
ok(s.phase === "roll" && s.active === "Benji", "then it is Benji's turn to roll");
ok(s.sheets.Isi.penalties === 0, "no penalty when something was crossed");

/* ---------- penalty: the active player crosses nothing ---------- */
s = Q.roll(s, "Benji");
s = Q.passWhite(s, "Isi");
s = Q.passWhite(s, "Benji");
s = Q.passColor(s, "Benji");
ok(s.sheets.Benji.penalties === 1 && s.lastMove.penalty === true, "the active player who crosses nothing takes a penalty");
ok(s.log.length === 1 && s.log[0].type === "penalty" && s.log[0].person === "Benji", "the roll's log records the penalty");
s = Q.roll(s, "Isi");
s = Q.passWhite(s, "Isi");
s = Q.passWhite(s, "Benji");
s = Q.passColor(s, "Isi");
ok(s.sheets.Isi.penalties === 1, "penalties hit the active player only");

/* ---------- locking a row ---------- */
let L = Q.createInitialState("Isi", "Benji", "classic");
L.sheets.Isi.marks[0] = [0, 1, 2, 3]; // red 2-5: only 4 crosses
L = Q.roll(L, "Isi");
fixDice(L, { w1: 6, w2: 6 });
ok(!Q.whiteOptions(L, "Isi").some(o => o.row === 0 && o.index === 10), "red 12 cannot be crossed with only 4 crosses");
L.sheets.Isi.marks[0] = [0, 1, 2, 3, 4]; // 5 crosses
ok(Q.whiteOptions(L, "Isi").some(o => o.row === 0 && o.index === 10), "with 5 crosses the red 12 locks the row");
L = Q.crossWhite(L, "Isi", 0, 10);
ok(L.lockedRows.length === 0 && L.pendingLocks.includes(0), "the lock waits until both decided");
ok(Q.whiteOptions(L, "Benji").some(o => o.row === 0 && o.index === 10) === false, "Benji (no crosses in red) cannot lock it too");
throwsWith(() => Q.crossWhite(L, "Benji", 1, 10), /geht gerade nicht/, "a 12 without 5 crosses is rejected");
L.sheets.Benji.marks[0] = [0, 1, 2, 3, 4];
L = Q.crossWhite(L, "Benji", 0, 10);
ok(L.lockedRows.length === 1 && L.lockedRows[0] === 0, "both locked red at the same moment: the row is locked");
ok(L.log.filter(e => e.locks).length === 2, "the roll's log keeps both locks even after later actions");
ok(L.sheets.Isi.locked.includes(0) && L.sheets.Benji.locked.includes(0), "both get the lock bonus for the simultaneous lock");
ok(Q.removedColors(L).includes("red"), "the red die leaves the game");
ok(Q.whiteOptions(L, "Isi").length === 0 && L.phase === "color", "the row is closed for everyone");

L = Q.passColor(L, "Isi");
L = Q.roll(L, "Benji");
ok(L.dice.red === null && L.dice.yellow !== null, "a removed die is no longer rolled");

/* ---------- Farben gemixxt: colours decide, not rows ---------- */
let C = Q.createInitialState("Isi", "Benji", "colors");
C = Q.roll(C, "Isi");
C = Q.passWhite(C, "Isi");
C = Q.passWhite(C, "Benji");
fixDice(C, { w1: 1, w2: 1, red: 6, yellow: 1, green: 1, blue: 1 });
const colorOpts = Q.colorOptions(C, "Isi");
ok(colorOpts.length > 0 && colorOpts.every(o => C.layout[o.row][o.index].c === "red" || C.layout[o.row][o.index].n === 2), "a coloured die only crosses fields of its own colour");
ok(colorOpts.some(o => o.row === 1 && C.layout[1][o.index].n === 7 && C.layout[1][o.index].c === "red"), "red 6 + white 1 = the red 7 in row 2 (rows mix colours)");

/* ---------- Zahlen gemixxt: lock numbers ---------- */
let N = Q.createInitialState("Isi", "Benji", "numbers");
N.sheets.Isi.marks[0] = [0, 1, 2, 3, 4];
N = Q.roll(N, "Isi");
fixDice(N, { w1: 5, w2: 6 });
ok(Q.whiteOptions(N, "Isi").some(o => o.row === 0 && o.index === 10), "Zahlen gemixxt: the red row is locked with the 11");

/* ---------- scoring ---------- */
let P = Q.createInitialState("Isi", "Benji", "classic");
P.sheets.Isi.marks = [[0, 1, 2, 3, 4, 10], [0, 1], [], [5]];
P.sheets.Isi.locked = [0];
P.sheets.Isi.penalties = 2;
const score = Q.scoreOf(P, "Isi");
ok(JSON.stringify(score.rows) === "[28,3,0,1]", `6 crosses + lock = 7 -> 28, 2 -> 3, 0 -> 0, 1 -> 1 (${JSON.stringify(score.rows)})`);
ok(score.total === 32 - 10, "penalties cost 5 each");

/* ---------- end of game ---------- */
let E = Q.createInitialState("Isi", "Benji", "classic");
E.sheets.Benji.penalties = 3;
E = Q.roll(E, "Isi");
E = Q.passWhite(E, "Isi");
E = Q.passWhite(E, "Benji");
E = Q.passColor(E, "Isi");
ok(E.phase === "roll", "3 penalties: game goes on");
E = Q.roll(E, "Benji");
E = Q.passWhite(E, "Isi");
E = Q.passWhite(E, "Benji");
E = Q.passColor(E, "Benji");
ok(E.phase === "finished" && E.sheets.Benji.penalties === 4, "the 4th penalty ends the game");
ok(E.result.winner === "Isi" && E.wins.Isi === 1, "the higher score wins");
throwsWith(() => Q.roll(E, "Isi"), /nicht gewürfelt/, "no rolling after the end");
const R = Q.rematch(E);
ok(R.phase === "roll" && R.active === "Benji" && R.gameNo === 2 && R.wins.Isi === 1, "rematch: new game, the other one starts, wins kept");
ok(R.moveSeq === E.moveSeq + 1, "the move sequence continues");

let T = Q.createInitialState("Isi", "Benji", "classic");
T.lockedRows = [3];
T.sheets.Isi.marks[0] = [0, 1, 2, 3, 4];
T = Q.roll(T, "Isi");
fixDice(T, { w1: 6, w2: 6 });
T = Q.crossWhite(T, "Isi", 0, 10);
T = Q.passWhite(T, "Benji");
ok(T.phase === "finished", "the second locked row ends the game right after the white action");

/* ---------- random full games: invariants ---------- */
function playRandom(blockType) {
  let st = Q.createInitialState("Isi", "Benji", blockType);
  let steps = 0;
  while (st.phase !== "finished") {
    if (++steps > 3000) throw new Error("game did not end");
    if (st.phase === "roll") st = Q.roll(st, st.active);
    else if (st.phase === "white") {
      for (const p of st.players) {
        if (st.phase !== "white" || st.white[p].done) continue;
        const opts = Q.whiteOptions(st, p);
        st = opts.length && Math.random() < 0.6 ? Q.crossWhite(st, p, opts[0].row, opts[0].index) : Q.passWhite(st, p);
      }
    } else if (st.phase === "color") {
      const opts = Q.colorOptions(st, st.active);
      st = opts.length && Math.random() < 0.7 ? Q.crossColor(st, st.active, opts[0].row, opts[0].index) : Q.passColor(st, st.active);
    }
    for (const p of st.players) {
      st.sheets[p].marks.forEach(m => assert.ok(m.every((v, i) => i === 0 || v > m[i - 1]), "crosses always go left to right"));
      assert.ok(st.sheets[p].penalties <= 4);
    }
    assert.ok(st.lockedRows.length <= 4);
  }
  assert.ok(st.lockedRows.length >= 2 || st.players.some(p => st.sheets[p].penalties >= 4), "a game only ends by 2 locks or 4 penalties");
  return st;
}
for (const type of ["classic", "colors", "numbers", "random"]) {
  for (let i = 0; i < 100; i++) playRandom(type);
}
ok(true, "400 random games (100 per block) finished with all invariants holding");

console.log(`\n${assertions} assertions passed (qwixx-engine)`);
