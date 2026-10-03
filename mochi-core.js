/* Mochi – pure rules without DOM: daily wishes, treasure chest, our streak, love messages and
   what Mochi says. Shared by mochi.js (window.MochiCore) and the node tests (module.exports). */
(function () {
  const PERSONS = ["Isi", "Benji"];
  const TIME_ZONE = "Europe/Berlin";

  const WISH_REWARD = 10;
  const ALL_WISHES_BONUS = 20;
  const WISHES_PER_DAY = 3;
  const MESSAGE_REWARD = 4;
  const REWARDED_MESSAGES_PER_DAY = 3;
  const NOTE_MAX_LENGTH = 140;
  const CHEST_JACKPOT = 40;
  const CHEST_JACKPOT_CHANCE = 0.05;

  const MESSAGE_KINDS = {
    kiss: { emoji: "💋", label: "Küsschen", phrase: "ein Küsschen" },
    hug: { emoji: "🤗", label: "Umarmung", phrase: "eine feste Umarmung" },
    heart: { emoji: "💗", label: "Herzchen", phrase: "ein Herzchen" },
    note: { emoji: "✉️", label: "Brief", phrase: "einen kleinen Brief" }
  };

  const FOODS = [
    { food: "Karotte", emoji: "🥕" },
    { food: "Apfel", emoji: "🍎" },
    { food: "Brokkoli", emoji: "🥦" },
    { food: "Banane", emoji: "🍌" },
    { food: "Avocado", emoji: "🥑" },
    { food: "Erdbeere", emoji: "🍓" }
  ];

  const WISH_POOL = [
    ...FOODS.map(f => ({ id: "feed:" + f.food, type: "feed", food: f.food, emoji: f.emoji, text: `Ich hätte sooo gern eine ${f.food}!` })),
    { id: "dance", type: "dance", minHits: 6, emoji: "💃", text: "Lass uns tanzen – mindestens 6 im Takt!" },
    { id: "shower", type: "shower", minCaught: 8, emoji: "🫧", text: "Ich will baden – fang 8 Seifenblasen!" },
    { id: "coffee", type: "coffee", emoji: "☕", text: "Machst du mir einen Kaffee?" },
    { id: "cuddle", type: "cuddle", emoji: "🤗", text: "Ich brauche eine ganz feste Umarmung!" },
    { id: "sport", type: "sport", emoji: "🏃", text: "Ich will mich bewegen!" },
    { id: "sleep", type: "sleep", emoji: "😴", text: "Ich will ein Nickerchen machen – bis zum Ende!" },
    { id: "message", type: "message", emoji: "💌", text: "Darf ich eine Liebesbotschaft überbringen?" },
    { id: "pet", type: "pet", emoji: "🫶", text: "Streichel mich mal ganz lieb!" }
  ];

  /* ---------- days ---------- */

  function dayKey(date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date || new Date());
    const get = type => parts.find(p => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function shiftDay(key, days) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
  }

  function hourIn(date) {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date || new Date()));
  }

  /* ---------- seeded randomness (both phones must see the same wishes) ---------- */

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function partnerOf(person) {
    return person === "Isi" ? "Benji" : "Isi";
  }

  /* ---------- wishes ---------- */

  function wishesFor(key) {
    const rand = seededRandom(hashString("mochi-wishes-" + key));
    const pool = WISH_POOL.slice();
    const chosen = [];
    while (chosen.length < WISHES_PER_DAY && pool.length) {
      const wish = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      if (wish.type === "feed" && chosen.some(w => w.type === "feed")) continue;
      chosen.push(wish);
    }
    return chosen;
  }

  function wishMatches(wish, event) {
    if (!event || wish.type !== event.type) return false;
    if (wish.type === "feed") return wish.food === event.food;
    if (wish.type === "dance") return (event.hits || 0) >= wish.minHits;
    if (wish.type === "shower") return (event.caught || 0) >= wish.minCaught;
    if (wish.type === "sleep") return !!event.full;
    return true;
  }

  function freshDaily(key) {
    return { date: key, wishes_done: {}, chest: {}, visitors: [], messages_rewarded: {}, bonus_claimed: false };
  }

  function currentDaily(state, key) {
    const daily = state && state.daily;
    if (!daily || daily.date !== key) return freshDaily(key);
    return {
      ...freshDaily(key),
      ...daily,
      wishes_done: { ...(daily.wishes_done || {}) },
      chest: { ...(daily.chest || {}) },
      visitors: [...(daily.visitors || [])],
      messages_rewarded: { ...(daily.messages_rewarded || {}) }
    };
  }

  /* Returns what changes when `person` does `event` today: fulfilled wishes, coins, and the
     patch for pet_state. A visit (any care) also counts towards our streak. */
  function careOutcome(state, person, event, key) {
    const daily = currentDaily(state, key);
    const wishes = wishesFor(key);
    const fulfilled = [];
    let coins = 0;

    wishes.forEach(wish => {
      if (daily.wishes_done[wish.id]) return;
      if (!wishMatches(wish, event)) return;
      daily.wishes_done[wish.id] = person;
      fulfilled.push(wish);
      coins += WISH_REWARD;
    });

    let allDone = false;
    if (!daily.bonus_claimed && wishes.every(w => daily.wishes_done[w.id])) {
      daily.bonus_claimed = true;
      coins += ALL_WISHES_BONUS;
      allDone = true;
    }

    const patch = {
      daily,
      wishes_fulfilled: ((state && state.wishes_fulfilled) || 0) + fulfilled.length
    };

    const streak = visitOutcome(state, person, key, daily);
    Object.assign(patch, streak.patch);

    return { fulfilled, coins, allDone, streakStarted: streak.completedToday, streakDays: streak.days, patch };
  }

  /* our streak: a day counts when both of us looked after Mochi */
  function visitOutcome(state, person, key, daily) {
    const day = daily || currentDaily(state, key);
    if (!day.visitors.includes(person)) day.visitors.push(person);

    const bothToday = PERSONS.every(p => day.visitors.includes(p));
    const alreadyCounted = state && state.streak_last_date === key;
    if (!bothToday || alreadyCounted) {
      return { completedToday: false, days: currentStreak(state, key), patch: { daily: day } };
    }

    const continues = state && state.streak_last_date === shiftDay(key, -1);
    const days = continues ? (state.streak_days || 0) + 1 : 1;
    return {
      completedToday: true,
      days,
      patch: {
        daily: day,
        streak_days: days,
        best_streak: Math.max(days, (state && state.best_streak) || 0),
        streak_last_date: key
      }
    };
  }

  /* the streak shown right now: still alive if it was completed today or yesterday */
  function currentStreak(state, key) {
    if (!state || !state.streak_last_date) return 0;
    if (state.streak_last_date === key || state.streak_last_date === shiftDay(key, -1)) return state.streak_days || 0;
    return 0;
  }

  /* ---------- treasure chest ---------- */

  function chestOpened(state, person, key) {
    const daily = currentDaily(state, key);
    return daily.chest[person] !== undefined;
  }

  function rollChest(rand) {
    const r = rand();
    if (r < CHEST_JACKPOT_CHANCE) return { coins: CHEST_JACKPOT, jackpot: true };
    return { coins: 5 + Math.floor(rand() * 11), jackpot: false };
  }

  function openChest(state, person, key, rand) {
    const daily = currentDaily(state, key);
    if (daily.chest[person] !== undefined) return null;
    const roll = rollChest(rand || Math.random);
    daily.chest[person] = roll.coins;
    return { ...roll, patch: { daily } };
  }

  /* ---------- love messages ---------- */

  function cleanNote(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return value.slice(0, NOTE_MAX_LENGTH);
  }

  function messageReward(state, person, key) {
    const daily = currentDaily(state, key);
    const sent = daily.messages_rewarded[person] || 0;
    if (sent >= REWARDED_MESSAGES_PER_DAY) return { coins: 0, patch: { daily } };
    daily.messages_rewarded[person] = sent + 1;
    return { coins: MESSAGE_REWARD, patch: { daily } };
  }

  function deliveryText(message) {
    const kind = MESSAGE_KINDS[message.kind] || MESSAGE_KINDS.heart;
    return `${message.from_person} schickt dir ${kind.phrase} ${kind.emoji}`;
  }

  /* ---------- what Mochi says ---------- */

  const LINES = {
    hungry: ["Mein Bauch grummelt… 🥕", "Hast du was zu knabbern für mich?", "Ich könnte eine ganze Karotte essen!"],
    tired: ["Ich bin sooo müde 🥱", "Ein kleines Nickerchen wär schön…", "Meine Kerze flackert schon ganz müde"],
    dirty: ["Ich glaub, ich brauch eine Dusche 🫧", "Ich fühl mich ganz krümelig…", "Seifenblasen-Zeit?"],
    lonely: ["Kuschelst du mit mir? 🥺", "Ich vermisse eure Nähe…", "Drück mich mal ganz fest!"],
    morning: ["Guten Morgen, {me}! ☀️", "Na, gut geschlafen, {me}?", "Ein neuer Tag mit euch! 🌷"],
    evening: ["Schönen Abend, {me} 🌆", "War dein Tag schön, {me}?"],
    night: ["Psst… es ist schon spät 🌙", "Du solltest auch bald schlafen, {me} 💤"],
    partner: ["Ich vermisse {partner} 💭", "Grüß {partner} ganz lieb von mir! 💗", "{partner} hat mich heute schon lieb gehabt", "Schick {partner} doch ein Küsschen über mich 💋"],
    happy: ["Ich hab euch sooo lieb! 💗", "Heute ist ein schöner Tag ✨", "Hihi, du bist toll, {me}!", "Ich bin der glücklichste Kuchen der Welt 🎂", "Hamburg und Alicante – ihr seid trotzdem ganz nah 💞"],
    okay: ["Mir ist ein bisschen langweilig…", "Spielen wir was?", "Was machen wir heute, {me}?"],
    sad: ["Mir geht's nicht so gut… 🥺", "Bleibst du ein bisschen bei mir?"],
    facts: ["Wusstest du, dass ich aus Karottenkuchen bin? 🥕🎂", "Meine Kerze geht nie aus, solange ihr euch liebt 🕯️", "Ich hab gehört, Liebe wächst mit Entfernung ✈️"]
  };

  function pick(list, rand) {
    return list[Math.floor(rand() * list.length)];
  }

  function fill(line, me, partner) {
    return line.replace(/\{me\}/g, me || "du").replace(/\{partner\}/g, partner || "dein Schatz");
  }

  function speechLine({ stats, mood, hour, person, rand }) {
    const random = rand || Math.random;
    const partner = person ? partnerOf(person) : null;
    const needs = [];
    if (stats) {
      if (stats.hunger < 30) needs.push("hungry");
      if (stats.energy < 30) needs.push("tired");
      if (stats.cleanliness < 30) needs.push("dirty");
      if (stats.bond < 30) needs.push("lonely");
    }
    if (needs.length && random() < 0.7) return fill(pick(LINES[pick(needs, random)], random), person, partner);

    const pools = [];
    if (hour >= 5 && hour < 10) pools.push("morning");
    else if (hour >= 18 && hour < 22) pools.push("evening");
    else if (hour >= 22 || hour < 5) pools.push("night");
    if (partner) pools.push("partner");
    if (mood === "sad" || mood === "verysad") pools.push("sad", "sad");
    else if (mood === "neutral") pools.push("okay");
    else pools.push("happy", "happy");
    pools.push("facts");
    return fill(pick(LINES[pick(pools, random)], random), person, partner);
  }

  /* quick taps in a row: giggle, then a sneeze, then Mochi gets dizzy */
  function tapReaction(tapsInRow) {
    if (tapsInRow >= 8) return "dizzy";
    if (tapsInRow === 5) return "sneeze";
    return "giggle";
  }

  const api = {
    PERSONS,
    WISH_REWARD,
    ALL_WISHES_BONUS,
    MESSAGE_REWARD,
    REWARDED_MESSAGES_PER_DAY,
    NOTE_MAX_LENGTH,
    CHEST_JACKPOT,
    MESSAGE_KINDS,
    WISH_POOL,
    LINES,
    dayKey,
    shiftDay,
    hourIn,
    seededRandom,
    hashString,
    partnerOf,
    wishesFor,
    wishMatches,
    currentDaily,
    careOutcome,
    visitOutcome,
    currentStreak,
    chestOpened,
    rollChest,
    openChest,
    cleanNote,
    messageReward,
    deliveryText,
    speechLine,
    tapReaction
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MochiCore = api;
})();
