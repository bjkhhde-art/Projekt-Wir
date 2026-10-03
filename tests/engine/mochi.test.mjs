import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../../mochi-core.js");

let assertions = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  assertions++;
  console.log("PASS:", msg);
}

/* ---------- days ---------- */
ok(M.dayKey(new Date("2026-10-03T21:30:00Z")) === "2026-10-03", "21:30 UTC is still the 3rd in Hamburg/Alicante (summer time)");
ok(M.dayKey(new Date("2026-10-03T22:30:00Z")) === "2026-10-04", "22:30 UTC is already the 4th in Hamburg/Alicante");
ok(M.shiftDay("2026-03-01", -1) === "2026-02-28" && M.shiftDay("2026-12-31", 1) === "2027-01-01", "day arithmetic crosses months and years");
ok(M.hourIn(new Date("2026-01-10T06:15:00Z")) === 7, "hour is local winter time (UTC+1)");

/* ---------- wishes ---------- */
const today = "2026-10-03";
const wishes = M.wishesFor(today);
ok(wishes.length === 3 && new Set(wishes.map(w => w.id)).size === 3, "three different wishes per day");
ok(JSON.stringify(M.wishesFor(today)) === JSON.stringify(wishes), "both phones compute the same wishes for the same day");
let differentDays = 0;
let maxFood = 0;
const seenTypes = new Set();
for (let i = 0; i < 365; i++) {
  const key = M.shiftDay(today, i);
  const list = M.wishesFor(key);
  if (JSON.stringify(list) !== JSON.stringify(M.wishesFor(M.shiftDay(key, 1)))) differentDays++;
  maxFood = Math.max(maxFood, list.filter(w => w.type === "feed").length);
  list.forEach(w => seenTypes.add(w.type));
}
ok(differentDays > 350, `wishes change from day to day (${differentDays}/365)`);
ok(maxFood <= 1, "never more than one food wish per day");
ok(["feed", "dance", "shower", "coffee", "cuddle", "sport", "sleep", "message", "pet"].every(t => seenTypes.has(t)), "every kind of wish shows up over a year");

const strawberry = M.WISH_POOL.find(w => w.id === "feed:Erdbeere");
const dance = M.WISH_POOL.find(w => w.id === "dance");
const shower = M.WISH_POOL.find(w => w.id === "shower");
const sleep = M.WISH_POOL.find(w => w.id === "sleep");
ok(M.wishMatches(strawberry, { type: "feed", food: "Erdbeere" }) && !M.wishMatches(strawberry, { type: "feed", food: "Apfel" }), "food wishes need exactly that food");
ok(M.wishMatches(dance, { type: "dance", hits: 6 }) && !M.wishMatches(dance, { type: "dance", hits: 5 }), "dance wish needs 6 beats in time");
ok(M.wishMatches(shower, { type: "shower", caught: 8 }) && !M.wishMatches(shower, { type: "shower", caught: 7 }), "shower wish needs 8 bubbles");
ok(M.wishMatches(sleep, { type: "sleep", full: true }) && !M.wishMatches(sleep, { type: "sleep", full: false }), "sleep wish needs a full nap");

/* fulfil a whole day: find a day with simple wishes so the test can trigger each */
function eventFor(wish) {
  if (wish.type === "feed") return { type: "feed", food: wish.food };
  if (wish.type === "dance") return { type: "dance", hits: 8 };
  if (wish.type === "shower") return { type: "shower", caught: 10 };
  if (wish.type === "sleep") return { type: "sleep", full: true };
  return { type: wish.type };
}

let state = { coins: 0, daily: {}, wishes_fulfilled: 0, streak_days: 0, best_streak: 0, streak_last_date: null };
const [w1, w2, w3] = wishes;

let out = M.careOutcome(state, "Isi", { type: "nothing-wished" }, today);
ok(out.fulfilled.length === 0 && out.coins === 0, "care that matches no wish gives no wish coins");
state = { ...state, ...out.patch };
ok(state.daily.date === today && state.daily.visitors.includes("Isi"), "a care action records Isi's visit for today");

out = M.careOutcome(state, "Isi", eventFor(w1), today);
ok(out.fulfilled.length === 1 && out.fulfilled[0].id === w1.id && out.coins === M.WISH_REWARD, "fulfilling a wish pays the wish reward");
state = { ...state, ...out.patch };
ok(state.daily.wishes_done[w1.id] === "Isi" && state.wishes_fulfilled === 1, "the wish is stored as fulfilled by Isi");

out = M.careOutcome(state, "Benji", eventFor(w1), today);
ok(out.fulfilled.length === 0 && out.coins === 0, "a wish can only be fulfilled once per day");
state = { ...state, ...out.patch };

out = M.careOutcome(state, "Benji", eventFor(w2), today);
state = { ...state, ...out.patch };
ok(out.fulfilled.length === 1 && !out.allDone, "second wish fulfilled by Benji, not all done yet");
out = M.careOutcome(state, "Benji", eventFor(w3), today);
state = { ...state, ...out.patch };
ok(out.allDone && out.coins === M.WISH_REWARD + M.ALL_WISHES_BONUS, "the last wish also pays the all-wishes bonus");
out = M.careOutcome(state, "Isi", eventFor(w3), today);
ok(!out.allDone && out.coins === 0, "the bonus is only paid once");

const tomorrow = M.shiftDay(today, 1);
const nextDaily = M.currentDaily(state, tomorrow);
ok(Object.keys(nextDaily.wishes_done).length === 0 && nextDaily.visitors.length === 0 && nextDaily.date === tomorrow, "a new day starts with fresh wishes and no visitors");
ok(M.currentDaily(state, today) !== state.daily && M.currentDaily(state, today).wishes_done !== state.daily.wishes_done, "currentDaily never mutates the stored state");

/* ---------- streak ---------- */
let s = { daily: {}, streak_days: 0, best_streak: 0, streak_last_date: null };
let v = M.visitOutcome(s, "Isi", "2026-10-01");
ok(!v.completedToday && !v.patch.streak_days, "one of us alone does not count as a streak day");
s = { ...s, ...v.patch };
v = M.visitOutcome(s, "Benji", "2026-10-01");
ok(v.completedToday && v.patch.streak_days === 1 && v.patch.streak_last_date === "2026-10-01", "both of us on one day starts the streak");
s = { ...s, ...v.patch };
v = M.visitOutcome(s, "Isi", "2026-10-01");
ok(!v.completedToday && v.days === 1, "visiting again the same day does not add another day");

s = { ...s, ...M.visitOutcome(s, "Benji", "2026-10-02").patch };
v = M.visitOutcome(s, "Isi", "2026-10-02");
ok(v.patch.streak_days === 2 && v.patch.best_streak === 2, "the next day continues the streak");
s = { ...s, ...v.patch };
ok(M.currentStreak(s, "2026-10-03") === 2, "the streak is still shown the following day");
ok(M.currentStreak(s, "2026-10-04") === 0, "a missed day shows the streak as broken");
s = { ...s, ...M.visitOutcome(s, "Isi", "2026-10-04").patch };
v = M.visitOutcome(s, "Benji", "2026-10-04");
ok(v.patch.streak_days === 1 && v.patch.best_streak === 2, "after a gap the streak restarts at 1 but the best streak stays");

/* ---------- chest ---------- */
let chestState = { daily: {} };
const opened = M.openChest(chestState, "Isi", today, M.seededRandom(1));
ok(opened && opened.coins >= 5 && opened.coins <= M.CHEST_JACKPOT, `Isi's chest gives coins (${opened.coins})`);
chestState = { ...chestState, ...opened.patch };
ok(M.chestOpened(chestState, "Isi", today) && !M.chestOpened(chestState, "Benji", today), "the chest is per person");
ok(M.openChest(chestState, "Isi", today) === null, "a chest opens only once per day");
ok(!M.chestOpened(chestState, "Isi", tomorrow), "tomorrow there is a new chest");
let jackpots = 0;
const rand = M.seededRandom(42);
for (let i = 0; i < 4000; i++) {
  const r = M.rollChest(rand);
  if (r.jackpot) { jackpots++; assert.equal(r.coins, M.CHEST_JACKPOT); } else assert.ok(r.coins >= 5 && r.coins <= 15);
}
ok(jackpots > 100 && jackpots < 320, `jackpot is rare (${jackpots}/4000)`);

/* ---------- messages ---------- */
let msgState = { daily: {} };
const rewards = [];
for (let i = 0; i < 5; i++) {
  const r = M.messageReward(msgState, "Benji", today);
  rewards.push(r.coins);
  msgState = { ...msgState, ...r.patch };
}
ok(JSON.stringify(rewards) === JSON.stringify([4, 4, 4, 0, 0]), "only the first 3 messages a day earn coins");
ok(M.messageReward(msgState, "Isi", today).coins === M.MESSAGE_REWARD, "the limit is per person");
ok(M.cleanNote("  hallo \n\n  du  ") === "hallo du", "notes are trimmed and whitespace collapsed");
ok(M.cleanNote("x".repeat(500)).length === M.NOTE_MAX_LENGTH, "notes are capped at 140 characters");
ok(M.deliveryText({ from_person: "Isi", kind: "kiss" }) === "Isi schickt dir ein Küsschen 💋", "delivery text names sender and kind");

/* ---------- speech ---------- */
const lowStats = { hunger: 10, energy: 90, cleanliness: 90, bond: 90 };
let hungry = 0;
for (let i = 0; i < 200; i++) {
  const line = M.speechLine({ stats: lowStats, mood: "neutral", hour: 14, person: "Isi", rand: M.seededRandom(i) });
  if (M.LINES.hungry.includes(line)) hungry++;
}
ok(hungry > 100, `a hungry Mochi mostly talks about food (${hungry}/200)`);
const allLines = new Set();
for (let i = 0; i < 400; i++) {
  allLines.add(M.speechLine({ stats: { hunger: 90, energy: 90, cleanliness: 90, bond: 90 }, mood: "happy", hour: 8, person: "Benji", rand: M.seededRandom(i) }));
}
ok([...allLines].every(line => !line.includes("{")), "all placeholders are filled");
ok([...allLines].some(line => line.includes("Isi")) && [...allLines].some(line => line.includes("Benji")), "Mochi talks about the partner and greets the current person");
ok([...allLines].some(line => line.startsWith("Guten Morgen")), "in the morning Mochi says good morning");
ok(M.tapReaction(1) === "giggle" && M.tapReaction(5) === "sneeze" && M.tapReaction(9) === "dizzy", "taps: giggle, sneeze on the 5th, dizzy from the 8th");
ok(M.partnerOf("Isi") === "Benji" && M.partnerOf("Benji") === "Isi", "partnerOf");

console.log(`\n${assertions} assertions passed (mochi-core)`);
