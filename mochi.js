const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const petCreature = document.getElementById("petCreature");
const moodLabel = document.getElementById("moodLabel");
const petStatusText = document.getElementById("petStatusText");
const petHearts = document.getElementById("petHearts");
const tearLeft = document.getElementById("petTearLeft");
const tearRight = document.getElementById("petTearRight");
const petMouthPath = document.getElementById("petMouthPath");
const petSmoke = document.getElementById("petSmoke");
const eyeClosedLeft = document.getElementById("petEyeClosedLeft");
const eyeClosedRight = document.getElementById("petEyeClosedRight");
const bedPieces = document.querySelectorAll(".bed-piece");
const sleepSky = document.getElementById("sleepSky");
const petFoamOverlay = document.getElementById("petFoamOverlay");
const shampooBottle = document.getElementById("shampooBottle");
const petHint = document.getElementById("petHint");
const DEFAULT_PET_HINT = "Wir streicheln Mochi mit einer Wischbewegung oder halten gedrückt zum Kuscheln 🤗";

const growthBadge = document.getElementById("growthBadge");
const coinCount = document.getElementById("coinCount");
const openShopBtn = document.getElementById("openShopBtn");
const openAchievementsBtn = document.getElementById("openAchievementsBtn");
const achievementsModal = document.getElementById("achievementsModal");
const closeAchievementsModal = document.getElementById("closeAchievementsModal");
const achievementsList = document.getElementById("achievementsList");

const statHungerFill = document.getElementById("statHungerFill");
const statEnergyFill = document.getElementById("statEnergyFill");
const statCleanFill = document.getElementById("statCleanFill");
const statBondFill = document.getElementById("statBondFill");

const feedBtn = document.getElementById("feedBtn");
const showerBtn = document.getElementById("showerBtn");
const sportBtn = document.getElementById("sportBtn");
const danceBtn = document.getElementById("danceBtn");
const coffeeBtn = document.getElementById("coffeeBtn");
const sleepBtn = document.getElementById("sleepBtn");
const sleepIcon = document.getElementById("sleepIcon");
const sleepLabel = document.getElementById("sleepLabel");
const openRoomBtn = document.getElementById("openRoomBtn");

const petMainView = document.getElementById("petMainView");
const coffeeScene = document.getElementById("coffeeScene");
const leaveCoffeeScene = document.getElementById("leaveCoffeeScene");
const coffeeStepLabel = document.getElementById("coffeeStepLabel");
const coffeeHint = document.getElementById("coffeeHint");
const coffeeSvg = document.querySelector(".coffee-svg");
const mochiCoffeeIcon = document.getElementById("mochiCoffeeIcon");

const beanJarGroup = document.getElementById("beanJarGroup");
const hopperBeans = document.getElementById("hopperBeans");
const grinderCrankGroup = document.getElementById("grinderCrankGroup");
const grinderCrankRotor = document.getElementById("grinderCrankRotor");
const groundPileAtGrinder = document.getElementById("groundPileAtGrinder");
const groundPileAtPortafilter = document.getElementById("groundPileAtPortafilter");
const portafilterGroup = document.getElementById("portafilterGroup");
const tamperGroup = document.getElementById("tamperGroup");
const coffeeLiquid = document.getElementById("coffeeLiquid");
const steamGroup = document.getElementById("steamGroup");

const roomScene = document.getElementById("roomScene");
const leaveRoomScene = document.getElementById("leaveRoomScene");
const openShopFromRoom = document.getElementById("openShopFromRoom");

const shopModal = document.getElementById("shopModal");
const closeShopModal = document.getElementById("closeShopModal");
const shopCoinCount = document.getElementById("shopCoinCount");
const shopTabs = document.querySelectorAll(".shop-tab");
const shopItemsRoom = document.getElementById("shopItemsRoom");
const shopItemsOutfit = document.getElementById("shopItemsOutfit");

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const Core = window.MochiCore;

const petSvg = document.querySelector(".pet-svg");
const petEyes = [
  { el: document.getElementById("petEyeLeft"), cx: 78, cy: 152 },
  { el: document.getElementById("petEyeRight"), cx: 122, cy: 152 }
];
const mochiSpeech = document.getElementById("mochiSpeech");
const togetherBanner = document.getElementById("togetherBanner");
const mailEnvelope = document.getElementById("mailEnvelope");
const mailCount = document.getElementById("mailCount");

const streakPill = document.getElementById("streakPill");
const streakCount = document.getElementById("streakCount");
const chestBtn = document.getElementById("chestBtn");
const chestModal = document.getElementById("chestModal");
const chestText = document.getElementById("chestText");
const chestOpenBtn = document.getElementById("chestOpenBtn");
const chestResult = document.getElementById("chestResult");
const closeChest = document.getElementById("closeChest");

const wishList = document.getElementById("wishList");
const wishProgress = document.getElementById("wishProgress");
const wishBonusHint = document.getElementById("wishBonusHint");
const streakLine = document.getElementById("streakLine");

const messengerBtn = document.getElementById("messengerBtn");
const messengerModal = document.getElementById("messengerModal");
const messengerIntro = document.getElementById("messengerIntro");
const messengerKinds = document.querySelectorAll(".messenger-kind");
const messengerNoteWrap = document.getElementById("messengerNoteWrap");
const messengerNote = document.getElementById("messengerNote");
const messengerNoteCount = document.getElementById("messengerNoteCount");
const cancelMessenger = document.getElementById("cancelMessenger");
const sendMessenger = document.getElementById("sendMessenger");
const messengerHistory = document.getElementById("messengerHistory");

const deliveryModal = document.getElementById("deliveryModal");
const deliveryBurst = document.getElementById("deliveryBurst");
const deliveryEmoji = document.getElementById("deliveryEmoji");
const deliveryTitle = document.getElementById("deliveryTitle");
const deliveryNote = document.getElementById("deliveryNote");
const deliveryTime = document.getElementById("deliveryTime");
const replyDelivery = document.getElementById("replyDelivery");
const closeDelivery = document.getElementById("closeDelivery");

const foodModal = document.getElementById("foodModal");
const foodButtons = document.querySelectorAll(".food-btn");
const closeFoodModal = document.getElementById("closeFoodModal");

const MOOD_LABELS = {
  euphoric: "Überglücklich 🥰",
  happy: "Glücklich 😊",
  neutral: "Ganz okay 😐",
  sad: "Ein bisschen traurig 😢",
  verysad: "Vermisst uns sehr 💔"
};

const MOOD_STATUS = {
  euphoric: "Mochi kuschelt sich glücklich ein.",
  happy: "Mochi freut sich, dass wir uns kümmern.",
  neutral: "Mochi geht es okay, ein bisschen Zuwendung täte gut.",
  sad: "Mochi vermisst unsere Nähe, wir sollten ihn mal streicheln.",
  verysad: "Mochi ist ganz traurig. Zeit für ganz viel Kuscheln!"
};

const MOOD_MOUTH_PATHS = {
  euphoric: "M80,173 Q100,194 120,173",
  happy: "M84,175 Q100,190 116,175",
  neutral: "M90,178 Q100,183 110,178",
  sad: "M88,179 Q100,173 112,179",
  verysad: "M85,181 Q100,170 115,181"
};

const LONG_PRESS_MS = 850;
const MOVE_THRESHOLD = 8;
const STROKE_MIN_DISTANCE = 50;
const STROKE_TICK_DISTANCE = 24;
const PET_COOLDOWN_MS = 3000;
const CUDDLE_COOLDOWN_MS = 5 * 60 * 1000;
const SHOWER_BUBBLE_COUNT = 10;
const SHOWER_BUBBLE_LIFETIME_MS = 1300;
const SHOWER_BUBBLE_SPAWN_GAP_MS = 500;
const DANCE_BEAT_COUNT = 8;
const DANCE_BEAT_INTERVAL_MS = 650;
const DANCE_HIT_WINDOW_MS = 280;
const DANCE_PARTY_TAIL_MS = 500;
const DISCO_RISE_DURATION_MS = 1400;
/* Mochi sleeps until one of us wakes him; after this long he is fully rested */
const FULL_REST_MS = 2 * 60 * 1000;
const SUNRISE_DURATION_MS = 1400;
const DEFAULT_STAT = 70;
const SURPRISE_COIN_CHANCE = 0.06;
const SURPRISE_COINS = 3;

const COFFEE_STEPS = [
  { label: "Schritt 1 von 5: Bohnen einfüllen", hint: "Wir wischen die Bohnen von der Dose in die Mühle" },
  { label: "Schritt 2 von 5: Mahlen", hint: "Wir drehen die Kurbel im Kreis" },
  { label: "Schritt 3 von 5: In den Siebträger geben", hint: "Wir wischen das Kaffeemehl in den Siebträger" },
  { label: "Schritt 4 von 5: Tampen", hint: "Wir drücken den Tamper 3x fest nach unten" },
  { label: "Schritt 5 von 5: Einspannen", hint: "Wir ziehen den Siebträger zur Maschine" }
];

const GRIND_DEGREES_NEEDED = 900;
const TWIST_DEGREES_NEEDED = 140;
const TAMP_REQUIRED = 3;
const DOCK_DISTANCE = 55;

const ACTIVITIES = {
  feed: { label: "Mochi hat genascht", particleEmoji: "🥕", particleCount: 1, falling: false, animationClass: "feeding", vibratePattern: [10, 20, 10] },
  sport: { label: "Mochi hat Sport gemacht", particleEmoji: "💦", particleCount: 4, falling: false, animationClass: "exercising", vibratePattern: [15, 30, 15, 30] }
};

/* ---------- stats, growth & shop model ---------- */

const DECAY_BASE = { hunger: 7, energy: 4.5, cleanliness: 3.5, bond: 5.5 };
const GROWTH_THRESHOLDS = { baby: 0, kid: 20, adult: 60 };
const GROWTH_LABELS = { baby: "🐣 Baby", kid: "🎂 Kind", adult: "✨ Erwachsen" };

const MAX_DECOR = 4;

const SHOP_ITEMS = {
  room: [
    { id: "sky", slot: "wall", name: "Sternenhimmel", icon: "🌌", price: 20 },
    { id: "clouds", slot: "wall", name: "Wolken", icon: "☁️", price: 20 },
    { id: "hearts", slot: "wall", name: "Herzen-Tapete", icon: "💕", price: 30 },
    { id: "mint", slot: "wall", name: "Minze-Streifen", icon: "🌿", price: 20 },
    { id: "dots", slot: "wall", name: "Punkte-Tapete", icon: "⚪", price: 25 },
    { id: "wood", slot: "floor", name: "Holzboden", icon: "🪵", price: 15 },
    { id: "rug_pink", slot: "floor", name: "Rosa Teppich", icon: "🩷", price: 20 },
    { id: "rug_stars", slot: "floor", name: "Sternenteppich", icon: "⭐", price: 30 },
    { id: "tiles", slot: "floor", name: "Fliesenboden", icon: "🔲", price: 20 },
    { id: "rug_mint", slot: "floor", name: "Minze-Teppich", icon: "🟢", price: 25 },
    { id: "plant", slot: "deco", name: "Pflanze", icon: "🪴", price: 15 },
    { id: "lamp", slot: "deco", name: "Lampe", icon: "💡", price: 20 },
    { id: "window", slot: "deco", name: "Fenster", icon: "🪟", price: 25 },
    { id: "shelf", slot: "deco", name: "Bücherregal", icon: "📚", price: 25 },
    { id: "toybox", slot: "deco", name: "Spielzeugkiste", icon: "🧸", price: 20 },
    { id: "balloons", slot: "deco", name: "Luftballons", icon: "🎈", price: 15 },
    { id: "cushion", slot: "deco", name: "Kissen", icon: "🛋️", price: 15 }
  ],
  outfit: [
    { id: "party", slot: "hat", name: "Partyhut", icon: "🎉", price: 15 },
    { id: "crown", slot: "hat", name: "Krone", icon: "👑", price: 35 },
    { id: "beanie", slot: "hat", name: "Wintermütze", icon: "🧶", price: 20 },
    { id: "flowercrown", slot: "hat", name: "Blumenkranz", icon: "🌸", price: 30 },
    { id: "cap", slot: "hat", name: "Käppi", icon: "🧢", price: 15 },
    { id: "scarf", slot: "accessory", name: "Schal", icon: "🧣", price: 15 },
    { id: "sunglasses", slot: "accessory", name: "Sonnenbrille", icon: "🕶️", price: 20 },
    { id: "bowtie", slot: "accessory", name: "Fliege", icon: "🎀", price: 12 },
    { id: "necklace", slot: "accessory", name: "Kette", icon: "📿", price: 18 }
  ]
};

const SLOT_TO_FIELD = { wall: "room_wall", floor: "room_floor", deco: "room_deco", hat: "equipped_hat", accessory: "equipped_accessory" };
const SLOT_ELEMENT_PREFIX = { wall: "wall", floor: "floor", deco: "deco", hat: "hat", accessory: "accessory" };

function itemElementId(slot, id) {
  const camel = id.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return SLOT_ELEMENT_PREFIX[slot] + camel;
}

function findShopItem(id) {
  return [...SHOP_ITEMS.room, ...SHOP_ITEMS.outfit].find(item => item.id === id);
}

/* ---------- achievements ---------- */

const ACHIEVEMENTS = [
  { id: "first_care", icon: "🌱", name: "Erste Schritte", desc: "1x um Mochi gekümmert", check: s => (s.total_care_actions || 0) >= 1 },
  { id: "care_10", icon: "💗", name: "Gute Freunde", desc: "10x um Mochi gekümmert", check: s => (s.total_care_actions || 0) >= 10 },
  { id: "care_50", icon: "💞", name: "Unzertrennlich", desc: "50x um Mochi gekümmert", check: s => (s.total_care_actions || 0) >= 50 },
  { id: "care_150", icon: "💖", name: "Seelenverwandt", desc: "150x um Mochi gekümmert", check: s => (s.total_care_actions || 0) >= 150 },
  { id: "grown_kid", icon: "🎂", name: "Kindheit", desc: "Mochi ist zum Kind herangewachsen", check: s => (s.care_score || 0) >= GROWTH_THRESHOLDS.kid },
  { id: "grown_adult", icon: "✨", name: "Erwachsen", desc: "Mochi ist erwachsen geworden", check: s => (s.care_score || 0) >= GROWTH_THRESHOLDS.adult },
  { id: "coins_50", icon: "🪙", name: "Sparschwein", desc: "50 Münzen insgesamt verdient", check: s => (s.total_coins_earned || 0) >= 50 },
  { id: "coins_200", icon: "💰", name: "Kleiner Schatz", desc: "200 Münzen insgesamt verdient", check: s => (s.total_coins_earned || 0) >= 200 },
  { id: "coins_500", icon: "👑", name: "Großer Schatz", desc: "500 Münzen insgesamt verdient", check: s => (s.total_coins_earned || 0) >= 500 },
  { id: "collector_5", icon: "🛍️", name: "Sammler", desc: "5 Gegenstände besessen", check: s => ((s.owned_items) || []).length >= 5 },
  { id: "collector_12", icon: "🏆", name: "Großsammler", desc: "12 Gegenstände besessen", check: s => ((s.owned_items) || []).length >= 12 },
  { id: "room_full", icon: "🏠", name: "Eingerichtet", desc: "Zimmer komplett möbliert (4 Deko-Objekte)", check: s => ((s.room_decor) || []).length >= 4 },
  { id: "message_1", icon: "💌", name: "Liebesbote", desc: "Die erste Botschaft über Mochi geschickt", check: s => (s.messages_sent || 0) >= 1 },
  { id: "message_25", icon: "📮", name: "Postkutsche", desc: "25 Botschaften über Mochi geschickt", check: s => (s.messages_sent || 0) >= 25 },
  { id: "wishes_10", icon: "🌠", name: "Wunscherfüller", desc: "10 Wünsche von Mochi erfüllt", check: s => (s.wishes_fulfilled || 0) >= 10 },
  { id: "wishes_50", icon: "🧚", name: "Glücksfee", desc: "50 Wünsche von Mochi erfüllt", check: s => (s.wishes_fulfilled || 0) >= 50 },
  { id: "streak_3", icon: "🔥", name: "Dreamteam", desc: "3 Tage in Folge waren beide bei Mochi", check: s => (s.best_streak || 0) >= 3 },
  { id: "streak_7", icon: "🗓️", name: "Eine Woche Wir", desc: "7 Tage in Folge waren beide bei Mochi", check: s => (s.best_streak || 0) >= 7 },
  { id: "streak_30", icon: "🌙", name: "Ein Monat Wir", desc: "30 Tage in Folge waren beide bei Mochi", check: s => (s.best_streak || 0) >= 30 },
  { id: "double_1", icon: "💞", name: "Doppelknuddler", desc: "Mochi gleichzeitig geknuddelt", check: s => (s.double_cuddles || 0) >= 1 },
  { id: "double_10", icon: "🫂", name: "Kuschelsandwich", desc: "10x gleichzeitig geknuddelt", check: s => (s.double_cuddles || 0) >= 10 }
];

function announceNewAchievements(oldState, newState) {
  if (!oldState) return;
  ACHIEVEMENTS.forEach(achievement => {
    const wasUnlocked = achievement.check(oldState);
    const isUnlocked = achievement.check(newState);
    if (!wasUnlocked && isUnlocked) {
      showToast(`Erfolg freigeschaltet: ${achievement.icon} ${achievement.name}!`, "success");
      celebrate(10);
    }
  });
}

let petState = null;
let batteryAvg = 50;
let currentPerson = localStorage.getItem("pw_person");
let gestureState = null;
let lastPetTrigger = 0;
let lastCuddleTrigger = 0;
let activityLocked = false;
let showerLathering = false;
let wakingInProgress = false;
let showerBubblesSpawned = 0;
let showerBubblesCaught = 0;
let showerBubblesResolved = 0;
let showerBubbleTimer = null;
let danceRhythmActive = false;
let danceBeatTimestamps = [];
let danceBeatConsumed = [];
let danceHits = 0;
let danceBeatIntervalId = null;
let coffeeStep = 0;
let lockPhase = "dock";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
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
    showToast(`Hey ${currentPerson}! Mochi freut sich auf dich 💗`, "success");
    render();
    loadInbox();
    joinTogether();
  });
});

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- stats decay + growth ---------- */

function decayRate(base) {
  return clamp(base - (batteryAvg / 100) * (base - base * 0.17), base * 0.17, base);
}

function decayedStats(state = petState) {
  const lastUpdate = state && state.updated_at ? new Date(state.updated_at).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (Date.now() - lastUpdate) / 3600000);
  const result = {};

  const sleeping = !!(state && state.sleep_started_at);

  for (const key of Object.keys(DECAY_BASE)) {
    const stored = state && typeof state[key] === "number" ? state[key] : DEFAULT_STAT;
    /* a sleeping Mochi does not get more tired */
    const decay = sleeping && key === "energy" ? 0 : hoursElapsed * decayRate(DECAY_BASE[key]);
    result[key] = clamp(Math.round(stored - decay), 0, 100);
  }

  return result;
}

function overallMood(stats) {
  return Math.round((stats.hunger + stats.energy + stats.cleanliness + stats.bond) / 4);
}

function isAsleep() {
  return !!(petState && petState.sleep_started_at);
}

function moodTier(happiness) {
  if (happiness >= 80) return "euphoric";
  if (happiness >= 60) return "happy";
  if (happiness >= 40) return "neutral";
  if (happiness >= 20) return "sad";
  return "verysad";
}

function growthStage(careScore) {
  if (careScore >= GROWTH_THRESHOLDS.adult) return "adult";
  if (careScore >= GROWTH_THRESHOLDS.kid) return "kid";
  return "baby";
}

/* ---------- applying care actions (stats + coins + growth) ---------- */

/* Every write goes through here. The patch is built from the freshest state and written only if
   nobody else wrote in between ("version"); otherwise we reload and build it again. Stats are
   always stored decayed, so a write never resets how hungry or tired Mochi is. */
async function mutatePet(buildPatch) {
  if (!petState) await loadPetState();
  if (!petState) return null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const base = petState;
    const nowIso = new Date().toISOString();
    const patch = buildPatch(base, nowIso);
    if (!patch) return null;

    const version = base.version || 0;
    const payload = {
      ...decayedStats(base),
      last_interacted_by: currentPerson,
      updated_at: nowIso,
      ...patch,
      version: version + 1
    };

    petState = { ...base, ...payload };
    render();

    const { data, error } = await supabaseClient
      .from("pet_state")
      .update(payload)
      .eq("id", "shared")
      .eq("version", version)
      .select();

    if (error) {
      console.error("Fehler beim Speichern:", error);
      petState = base;
      render();
      showToast("Mochi konnte das gerade nicht speichern.", "error");
      return null;
    }

    if (data && data.length) {
      petState = { ...petState, ...data[0] };
      render();
      return { previous: base, next: petState };
    }

    await loadPetState();
  }

  showToast("Mochi war gerade ganz durcheinander, bitte nochmal versuchen 🙈", "error");
  return null;
}

/* a care action: stat changes, coins, growth, plus whatever wish it fulfils today.
   extraFields(nowIso, state) may add fields and { extraCoins }. */
async function applyCare(statDeltas, coinReward, careReward, extraFields, event) {
  let outcome = null;
  const careEvent = event || { type: "none" };

  const result = await mutatePet((base, nowIso) => {
    const stats = decayedStats(base);
    for (const key in statDeltas) {
      stats[key] = clamp(stats[key] + statDeltas[key], 0, 100);
    }

    outcome = Core.careOutcome(base, normalizePerson(currentPerson), careEvent, Core.dayKey());
    const afterWishes = { ...base, ...outcome.patch };
    const extra = typeof extraFields === "function" ? extraFields(nowIso, afterWishes) : (extraFields || {});
    const { extraCoins = 0, ...fields } = extra;
    const earned = coinReward + outcome.coins + extraCoins;

    return {
      ...stats,
      coins: (base.coins || 0) + earned,
      care_score: (base.care_score || 0) + careReward,
      total_care_actions: (base.total_care_actions || 0) + 1,
      total_coins_earned: (base.total_coins_earned || 0) + earned,
      ...outcome.patch,
      ...fields
    };
  });

  if (!result) return null;

  announceNewAchievements(result.previous, result.next);
  announceCareOutcome(outcome);
  broadcastTogether("care", { person: normalizePerson(currentPerson), type: careEvent.type, food: careEvent.food || null });
  return result;
}

function announceCareOutcome(outcome) {
  if (!outcome) return;

  outcome.fulfilled.forEach((wish, index) => {
    setTimeout(() => {
      showToast(`Wunsch erfüllt: ${wish.emoji} +${Core.WISH_REWARD} 🪙`, "success");
      say(["Juhu, danke! 🥰", `Du hast mir meinen Wunsch erfüllt, ${currentPerson}! 💗`, "Genau das wollte ich! ✨"][Math.floor(Math.random() * 3)]);
      celebrate(12);
    }, 700 + index * 900);
  });

  if (outcome.allDone) {
    setTimeout(() => {
      showToast(`Alle Wünsche erfüllt! +${Core.ALL_WISHES_BONUS} 🪙 Bonus 🎉`, "success");
      say("Ihr habt mir ALLE Wünsche erfüllt!! 🥹💞", 5200);
      celebrate(36);
    }, 1800);
  }

  if (outcome.streakStarted) {
    setTimeout(() => {
      showToast(`🔥 Wir-Serie: ${outcome.streakDays} ${outcome.streakDays === 1 ? "Tag" : "Tage"}! Ihr wart heute beide bei Mochi`, "success");
      celebrate(20);
    }, 2600);
  }
}

/* ---------- rendering ---------- */

function renderEquippedLook() {
  document.querySelectorAll(".hat-piece").forEach(el => el.classList.add("hidden"));
  if (petState && petState.equipped_hat) {
    const el = document.getElementById(itemElementId("hat", petState.equipped_hat));
    if (el) el.classList.remove("hidden");
  }

  document.querySelectorAll(".accessory-piece").forEach(el => el.classList.add("hidden"));
  if (petState && petState.equipped_accessory) {
    const el = document.getElementById(itemElementId("accessory", petState.equipped_accessory));
    if (el) el.classList.remove("hidden");
  }
}

function renderRoomLook() {
  document.querySelectorAll(".room-wall").forEach(el => el.classList.add("hidden"));
  if (petState && petState.room_wall) {
    const el = document.getElementById(itemElementId("wall", petState.room_wall));
    if (el) el.classList.remove("hidden");
  }

  document.querySelectorAll(".room-floor").forEach(el => el.classList.add("hidden"));
  if (petState && petState.room_floor) {
    const el = document.getElementById(itemElementId("floor", petState.room_floor));
    if (el) el.classList.remove("hidden");
  }

  document.querySelectorAll(".room-deco").forEach(el => el.classList.add("hidden"));
  const placedDeco = (petState && petState.room_decor) || [];
  placedDeco.forEach(id => {
    const el = document.getElementById(itemElementId("deco", id));
    if (el) el.classList.remove("hidden");
  });
}

function render() {
  const stats = decayedStats();
  const mood = moodTier(overallMood(stats));
  const asleep = isAsleep();
  const stage = growthStage((petState && petState.care_score) || 0);

  petCreature.className = "pet-creature mood-" + mood + " growth-" + stage + (asleep ? " sleeping" : "");
  moodLabel.textContent = MOOD_LABELS[mood];
  petMouthPath.setAttribute("d", MOOD_MOUTH_PATHS[mood]);

  let statusText = asleep ? "Mochi schläft gerade 😴" : MOOD_STATUS[mood];
  if (!asleep && petState && (petState.last_petted_at || petState.last_cuddled_at) && petState.last_interacted_by) {
    const lastPetted = petState.last_petted_at ? new Date(petState.last_petted_at).getTime() : 0;
    const lastCuddled = petState.last_cuddled_at ? new Date(petState.last_cuddled_at).getTime() : 0;
    const lastDate = new Date(Math.max(lastPetted, lastCuddled));
    statusText += ` (${petState.last_interacted_by}, ${timeAgo(lastDate.toISOString())})`;
  }
  petStatusText.textContent = statusText;

  statHungerFill.style.width = stats.hunger + "%";
  statEnergyFill.style.width = stats.energy + "%";
  statCleanFill.style.width = stats.cleanliness + "%";
  statBondFill.style.width = stats.bond + "%";

  growthBadge.textContent = GROWTH_LABELS[stage];
  coinCount.textContent = (petState && petState.coins) || 0;

  renderEquippedLook();
  renderRoomLook();
  renderDaily();

  tearLeft.classList.toggle("hidden", mood !== "verysad");
  tearRight.classList.toggle("hidden", mood !== "verysad");
  petSmoke.classList.toggle("hidden", mood !== "verysad");
  eyeClosedLeft.classList.toggle("hidden", !asleep);
  eyeClosedRight.classList.toggle("hidden", !asleep);
  bedPieces.forEach(el => el.classList.toggle("hidden", !asleep));

  sleepIcon.textContent = asleep ? "☀️" : "😴";
  sleepLabel.textContent = asleep ? "Aufwecken" : "Schlafen";
  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, openRoomBtn].forEach(btn => btn.classList.toggle("hidden", asleep));
}

/* ---------- data loading ---------- */

async function loadPetState() {
  const { data, error } = await supabaseClient
    .from("pet_state")
    .select("*")
    .eq("id", "shared")
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden von Mochi:", error);
    showToast("Mochi konnte nicht geladen werden.", "error");
    return;
  }

  petState = data;
  render();
}

async function loadBatteryAvg() {
  const { data, error } = await supabaseClient.from("cuddle_batteries").select("level");

  if (error) {
    console.error("Fehler beim Laden der Kuschelbatterien:", error);
    return;
  }

  if (data && data.length) {
    batteryAvg = data.reduce((sum, row) => sum + row.level, 0) / data.length;
  }

  render();
}

/* ---------- particles ---------- */

function spawnParticle(emoji, { size, falling } = {}) {
  const particle = document.createElement("span");
  particle.className = "pet-heart-particle" + (falling ? " falling" : "");
  particle.textContent = emoji;
  if (size) particle.style.fontSize = size + "px";
  particle.style.setProperty("--drift", Math.round((Math.random() - 0.5) * 60) + "px");
  particle.style.left = 45 + Math.random() * 10 + "%";
  petHearts.appendChild(particle);
  setTimeout(() => particle.remove(), 1200);
}

function spawnHeart(large) {
  spawnParticle(large ? "💖" : ["💗", "💕", "✨"][Math.floor(Math.random() * 3)], { size: large ? 26 : undefined });
}

setInterval(() => {
  if (isAsleep()) spawnParticle("💤", { size: 20 });
}, 2500);

/* ---------- interactions ---------- */

async function wakeMochi() {
  if (!requirePerson()) return;
  if (wakingInProgress) return;
  wakingInProgress = true;

  vibrate([15, 15]);

  const sleepStart = petState && petState.sleep_started_at ? new Date(petState.sleep_started_at).getTime() : null;
  const sleptRatio = sleepStart ? clamp((Date.now() - sleepStart) / FULL_REST_MS, 0, 1) : 0;
  const energyBoost = Math.round(sleptRatio * 50);
  const coinReward = sleptRatio >= 0.8 ? 6 : 0;

  showToast("Die Sonne geht auf ☀️", "success");
  sleepSky.classList.add("waking");

  await new Promise(resolve => setTimeout(resolve, SUNRISE_DURATION_MS));

  sleepSky.classList.remove("waking");
  showToast("Mochi ist aufgewacht 💤➡️😊", "success");

  await applyCare({ energy: energyBoost }, coinReward, 3, { sleep_started_at: null }, { type: "sleep", full: sleptRatio >= 0.8 });
  wakingInProgress = false;
}

async function triggerPet() {
  if (isAsleep()) {
    wakeMochi();
    return;
  }

  const now = Date.now();
  if (now - lastPetTrigger < PET_COOLDOWN_MS) return;
  if (!requirePerson()) return;

  lastPetTrigger = now;
  spawnHeart(false);
  vibrate([10, 20, 10]);

  const foundCoin = Math.random() < SURPRISE_COIN_CHANCE;
  const result = await applyCare({ bond: 6 }, 1, 1, nowIso => ({ last_petted_at: nowIso, extraCoins: foundCoin ? SURPRISE_COINS : 0 }), { type: "pet" });
  if (result && foundCoin) {
    showToast(`Mochi hat beim Streicheln eine Münze gefunden! +${SURPRISE_COINS} 🪙`, "success");
    spawnParticle("🪙", { size: 24 });
    say("Guck mal, was ich gefunden hab! 🪙");
  }
}

async function triggerCuddle() {
  if (isAsleep()) {
    wakeMochi();
    return;
  }

  if (!requirePerson()) return;

  petCreature.classList.add("hugging");
  vibrate([15, 40, 15, 40, 25]);
  setTimeout(() => petCreature.classList.remove("hugging"), 900);

  noteOwnCuddle();

  const now = Date.now();
  if (now - lastCuddleTrigger < CUDDLE_COOLDOWN_MS) {
    showToast("Mochi ist schon ganz warm gekuschelt, gleich nochmal 💭", "success");
    return;
  }
  lastCuddleTrigger = now;

  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnHeart(true), i * 120);
  }

  showToast(`${currentPerson} hat Mochi geknuddelt 🤗`, "success");

  const success = await applyCare({ bond: 28 }, 3, 2, nowIso => ({ last_cuddled_at: nowIso }), { type: "cuddle" });
  if (!success) return;

  sendAppNotification(supabaseClient, {
    title: "Mochi wurde geknuddelt 🎂",
    body: `${currentPerson} hat Mochi gerade richtig doll gedrückt.`,
    excludePerson: normalizePerson(currentPerson),
    category: "mochi",
    url: "mochi.html"
  });
}

async function performActivity(kind, extraLabel, particleEmojiOverride) {
  if (showerLathering || activityLocked) return false;

  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return false;
  }

  if (!requirePerson()) return false;

  const activity = ACTIVITIES[kind];
  activityLocked = true;

  petCreature.classList.add(activity.animationClass);
  vibrate(activity.vibratePattern);
  const particleEmoji = particleEmojiOverride || activity.particleEmoji;
  for (let i = 0; i < activity.particleCount; i++) {
    setTimeout(() => spawnParticle(particleEmoji, { falling: activity.falling }), i * 130);
  }
  setTimeout(() => petCreature.classList.remove(activity.animationClass), 1400);

  const label = extraLabel ? `${activity.label} (${extraLabel})` : activity.label;
  showToast(`${label} 🎉`, "success");

  const activityLog = extraLabel ? `${kind}:${extraLabel}` : kind;
  const extra = nowIso => ({ last_activity: activityLog });

  if (kind === "feed") {
    await applyCare({ hunger: 45, bond: 5 }, 3, 2, extra, { type: "feed", food: extraLabel });
  } else {
    await applyCare({ bond: 12 }, 5, 2, extra, { type: kind });
  }

  activityLocked = false;
  return true;
}

async function toggleSleep() {
  if (showerLathering) return;

  if (isAsleep()) {
    wakeMochi();
    return;
  }

  if (!requirePerson()) return;

  vibrate([10, 10, 10]);
  showToast("Gute Nacht, Mochi schläft jetzt ein 😴", "success");

  await mutatePet((base, nowIso) => ({ sleep_started_at: nowIso }));
}

function spawnShowerBubble() {
  if (!showerLathering) return;

  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "shower-bubble-target";
  bubble.style.left = (28 + Math.random() * 44) + "%";
  bubble.style.top = (30 + Math.random() * 42) + "%";
  const size = 30 + Math.random() * 16;
  bubble.style.width = size + "px";
  bubble.style.height = size + "px";

  let resolved = false;

  const missTimer = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    bubble.classList.add("popped-miss");
    setTimeout(() => bubble.remove(), 200);
    afterBubbleResolved();
  }, SHOWER_BUBBLE_LIFETIME_MS);

  bubble.addEventListener("pointerdown", event => {
    event.stopPropagation();
    if (resolved) return;
    resolved = true;
    clearTimeout(missTimer);
    showerBubblesCaught++;
    vibrate(8);
    spawnParticle("🫧", { size: 14 });
    bubble.classList.add("popped-catch");
    setTimeout(() => bubble.remove(), 200);
    afterBubbleResolved();
  });

  petCreature.appendChild(bubble);
}

function afterBubbleResolved() {
  showerBubblesResolved++;
  petFoamOverlay.setAttribute("opacity", String(Math.min(0.85, (showerBubblesResolved / SHOWER_BUBBLE_COUNT) * 0.85)));
  petHint.textContent = `Tippe die Seifenblasen an, bevor sie zerplatzen! (${showerBubblesResolved}/${SHOWER_BUBBLE_COUNT})`;

  if (showerBubblesResolved >= SHOWER_BUBBLE_COUNT) {
    finishShower();
  }
}

function startShowerBubbleRound() {
  showerBubblesSpawned = 0;
  showerBubblesCaught = 0;
  showerBubblesResolved = 0;

  spawnShowerBubble();
  showerBubblesSpawned++;

  showerBubbleTimer = setInterval(() => {
    if (showerBubblesSpawned >= SHOWER_BUBBLE_COUNT) {
      clearInterval(showerBubbleTimer);
      return;
    }
    spawnShowerBubble();
    showerBubblesSpawned++;
  }, SHOWER_BUBBLE_SPAWN_GAP_MS);
}

function startShowerLathering() {
  showerLathering = true;
  petFoamOverlay.setAttribute("opacity", "0");
  petCreature.classList.add("showering");
  shampooBottle.classList.remove("hidden");
  [messengerBtn, feedBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn].forEach(btn => btn.classList.add("hidden"));
  showerBtn.classList.add("hidden");
  petHint.textContent = `Tippe die Seifenblasen an, bevor sie zerplatzen! (0/${SHOWER_BUBBLE_COUNT})`;
  showToast("Seifenblasen-Zeit! Fang so viele wie möglich 🫧", "success");
  startShowerBubbleRound();
}

async function finishShower() {
  showerLathering = false;
  clearInterval(showerBubbleTimer);
  document.querySelectorAll(".shower-bubble-target").forEach(el => el.remove());
  shampooBottle.classList.add("hidden");
  petHint.textContent = DEFAULT_PET_HINT;
  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn].forEach(btn => btn.classList.remove("hidden"));

  for (let i = 0; i < 6; i++) {
    setTimeout(() => spawnParticle("💧", { falling: true }), i * 100);
  }
  petFoamOverlay.setAttribute("opacity", "0");
  vibrate([10, 10, 10, 10]);
  setTimeout(() => petCreature.classList.remove("showering"), 1300);

  const hitRate = showerBubblesCaught / SHOWER_BUBBLE_COUNT;
  const cleanlinessGain = Math.round(25 + hitRate * 25);
  const coinReward = Math.round(2 + hitRate * 6);

  showToast(`Mochi ist frisch geduscht 🚿✨ (${showerBubblesCaught}/${SHOWER_BUBBLE_COUNT} Blasen gefangen)`, "success");

  await applyCare({ cleanliness: cleanlinessGain, bond: 5 }, coinReward, 2, () => ({ last_activity: "shower" }), { type: "shower", caught: showerBubblesCaught });
}

function danceUpdateHint() {
  petHint.textContent = `Tippe im Takt auf Mochi! (${danceHits}/${DANCE_BEAT_COUNT} getroffen)`;
}

function registerDanceTap() {
  const now = Date.now();
  for (let i = danceBeatTimestamps.length - 1; i >= 0; i--) {
    if (danceBeatConsumed[i]) continue;
    if (Math.abs(now - danceBeatTimestamps[i]) <= DANCE_HIT_WINDOW_MS) {
      danceBeatConsumed[i] = true;
      danceHits++;
      spawnParticle("✨", {});
      danceUpdateHint();
      return;
    }
  }
}

function runDanceRhythm() {
  return new Promise(resolve => {
    danceRhythmActive = true;
    danceHits = 0;
    danceBeatTimestamps = [];
    danceBeatConsumed = [];
    danceUpdateHint();

    let beatIndex = 0;

    function fireBeat() {
      if (beatIndex >= DANCE_BEAT_COUNT) {
        clearInterval(danceBeatIntervalId);
        danceRhythmActive = false;
        resolve(danceHits / DANCE_BEAT_COUNT);
        return;
      }

      danceBeatTimestamps.push(Date.now());
      danceBeatConsumed.push(false);
      beatIndex++;

      petCreature.classList.remove("beat-pulse");
      void petCreature.offsetWidth;
      petCreature.classList.add("beat-pulse");
      vibrate(12);
    }

    fireBeat();
    danceBeatIntervalId = setInterval(fireBeat, DANCE_BEAT_INTERVAL_MS);
  });
}

async function performDance() {
  if (showerLathering || activityLocked) return false;

  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return false;
  }

  if (!requirePerson()) return false;

  activityLocked = true;

  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn].forEach(btn => btn.classList.add("hidden"));

  petCreature.classList.add("disco-rising");
  vibrate([10, 15, 10]);

  await new Promise(resolve => setTimeout(resolve, DISCO_RISE_DURATION_MS));

  petCreature.classList.remove("disco-rising");
  petCreature.classList.add("party");
  vibrate([10, 20, 10, 20, 10]);
  showToast("Tanz mit dem Takt mit! 🎶", "success");

  const hitRate = await runDanceRhythm();

  const coinReward = Math.round(2 + hitRate * 6);
  const bondGain = Math.round(6 + hitRate * 10);
  const finalHits = danceHits;

  for (let i = 0; i < 7; i++) {
    setTimeout(() => spawnParticle(["🎵", "🎶", "✨", "🪩"][Math.floor(Math.random() * 4)]), i * 200);
  }

  petHint.textContent = DEFAULT_PET_HINT;
  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn].forEach(btn => btn.classList.remove("hidden"));

  setTimeout(() => petCreature.classList.remove("party"), DANCE_PARTY_TAIL_MS);

  showToast(`Mochi hat getanzt 🎉 (${finalHits}/${DANCE_BEAT_COUNT} im Takt)`, "success");

  await applyCare({ bond: bondGain }, coinReward, 2, () => ({ last_activity: "dance" }), { type: "dance", hits: finalHits });

  activityLocked = false;
  return true;
}

/* ---------- activity buttons ---------- */

feedBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  foodModal.classList.remove("hidden");
});

closeFoodModal.addEventListener("click", () => foodModal.classList.add("hidden"));

foodButtons.forEach(button => {
  button.addEventListener("click", () => {
    foodModal.classList.add("hidden");
    performActivity("feed", button.dataset.food, button.dataset.emoji);
  });
});

showerBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  startShowerLathering();
});

sportBtn.addEventListener("click", () => performActivity("sport"));

danceBtn.addEventListener("click", () => performDance());

sleepBtn.addEventListener("click", toggleSleep);

/* ---------- coffee mini-game ---------- */

function svgToScreen(svgX, svgY) {
  const rect = coffeeSvg.getBoundingClientRect();
  return {
    x: rect.left + (svgX / 320) * rect.width,
    y: rect.top + (svgY / 200) * rect.height
  };
}

function attachDragGesture(el, minDistance, isActive, onComplete) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let maxDist = 0;

  el.addEventListener("pointerdown", event => {
    if (!isActive()) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    maxDist = 0;
  });

  el.addEventListener("pointermove", event => {
    if (!dragging || !isActive()) return;
    maxDist = Math.max(maxDist, Math.hypot(event.clientX - startX, event.clientY - startY));
  });

  function end() {
    if (dragging && isActive() && maxDist >= minDistance) onComplete();
    dragging = false;
  }

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => { dragging = false; });
}

function attachRotateGesture(el, pivotSvgX, pivotSvgY, degreesNeeded, isActive, onProgress, onComplete) {
  let dragging = false;
  let lastAngle = 0;
  let accumulated = 0;

  el.addEventListener("pointerdown", event => {
    if (!isActive()) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    accumulated = 0;
    const pivot = svgToScreen(pivotSvgX, pivotSvgY);
    lastAngle = Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x);
  });

  el.addEventListener("pointermove", event => {
    if (!dragging || !isActive()) return;
    const pivot = svgToScreen(pivotSvgX, pivotSvgY);
    const angle = Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x);
    let delta = angle - lastAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    accumulated += Math.abs(delta) * (180 / Math.PI);
    lastAngle = angle;

    onProgress(Math.min(accumulated, degreesNeeded), degreesNeeded);

    if (accumulated >= degreesNeeded) {
      dragging = false;
      onComplete();
    }
  });

  function end() { dragging = false; }
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function attachPressGesture(el, minDownDistance, requiredTaps, isActive, onTap, onComplete) {
  let dragging = false;
  let startY = 0;
  let taps = 0;

  el.addEventListener("pointerdown", event => {
    if (!isActive()) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    startY = event.clientY;
  });

  function end(event) {
    if (dragging && isActive()) {
      const dy = event.clientY - startY;
      if (dy >= minDownDistance) {
        taps++;
        onTap(taps, requiredTaps);
        if (taps >= requiredTaps) {
          taps = 0;
          onComplete();
        }
      }
    }
    dragging = false;
  }

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => { dragging = false; });
}

function updateCoffeeUI() {
  const info = COFFEE_STEPS[Math.min(coffeeStep, COFFEE_STEPS.length - 1)];
  coffeeStepLabel.textContent = info.label;
  coffeeHint.textContent = coffeeStep === 4 && lockPhase === "twist"
    ? "Jetzt drehen, um den Siebträger zu verriegeln"
    : info.hint;

  document.querySelectorAll(".coffee-hotspot").forEach(el => {
    const step = Number(el.dataset.step);
    el.classList.toggle("active-step", step === coffeeStep);
    el.classList.toggle("step-done", step < coffeeStep);
  });
}

function resetCoffeeGame() {
  coffeeStep = 0;
  lockPhase = "dock";
  hopperBeans.classList.add("hidden");
  groundPileAtGrinder.classList.add("hidden");
  groundPileAtPortafilter.classList.add("hidden");
  steamGroup.classList.add("hidden");
  coffeeLiquid.setAttribute("height", "0");
  coffeeLiquid.setAttribute("y", "178");
  portafilterGroup.style.transform = "";
  grinderCrankRotor.style.transform = "";
  mochiCoffeeIcon.classList.remove("cheering");
  updateCoffeeUI();
}

function enterCoffeeScene() {
  resetCoffeeGame();
  petMainView.classList.add("leaving");

  setTimeout(() => {
    petMainView.classList.add("hidden");
    petMainView.classList.remove("leaving");
    coffeeScene.classList.remove("hidden");
    coffeeScene.classList.add("entering");
    void coffeeScene.offsetWidth;
    coffeeScene.classList.remove("entering");
  }, 350);
}

function exitCoffeeScene() {
  coffeeScene.classList.add("entering");

  setTimeout(() => {
    coffeeScene.classList.add("hidden");
    coffeeScene.classList.remove("entering");
    petMainView.classList.add("leaving");
    petMainView.classList.remove("hidden");
    void petMainView.offsetWidth;
    petMainView.classList.remove("leaving");
  }, 350);
}

async function completeCoffee() {
  vibrate([15, 30, 15, 30, 40]);
  steamGroup.classList.remove("hidden");
  coffeeLiquid.setAttribute("y", "160");
  coffeeLiquid.setAttribute("height", "18");
  mochiCoffeeIcon.classList.add("cheering");

  showToast("Kaffee ist fertig ☕ Wohl bekomm's!", "success");

  await applyCare({ bond: 20 }, 8, 3, () => ({ last_activity: "coffee" }), { type: "coffee" });

  setTimeout(() => exitCoffeeScene(), 2400);
}

attachDragGesture(beanJarGroup, 45, () => coffeeStep === 0, () => {
  beanJarGroup.classList.add("pouring");
  setTimeout(() => beanJarGroup.classList.remove("pouring"), 400);
  hopperBeans.classList.remove("hidden");
  vibrate([10, 15, 10]);
  coffeeStep = 1;
  updateCoffeeUI();
});

attachRotateGesture(
  grinderCrankGroup, 132, 140, GRIND_DEGREES_NEEDED,
  () => coffeeStep === 1,
  accumulated => {
    grinderCrankRotor.style.transform = `rotate(${accumulated}deg)`;
    coffeeHint.textContent = `Wir drehen die Kurbel (${Math.round((accumulated / GRIND_DEGREES_NEEDED) * 100)}%)`;
  },
  () => {
    hopperBeans.classList.add("hidden");
    groundPileAtGrinder.classList.remove("hidden");
    vibrate([10, 10, 10, 10, 10]);
    coffeeStep = 2;
    updateCoffeeUI();
  }
);

attachDragGesture(groundPileAtGrinder, 45, () => coffeeStep === 2, () => {
  groundPileAtGrinder.classList.add("pouring");
  setTimeout(() => groundPileAtGrinder.classList.remove("pouring"), 400);
  groundPileAtGrinder.classList.add("hidden");
  groundPileAtPortafilter.classList.remove("hidden");
  vibrate([10, 15, 10]);
  coffeeStep = 3;
  updateCoffeeUI();
});

attachPressGesture(
  tamperGroup, 12, TAMP_REQUIRED,
  () => coffeeStep === 3,
  (taps, required) => {
    tamperGroup.classList.remove("tamping");
    void tamperGroup.offsetWidth;
    tamperGroup.classList.add("tamping");
    vibrate([20]);
    coffeeHint.textContent = `Wir drücken fest an (${taps}/${required})`;
  },
  () => {
    coffeeStep = 4;
    lockPhase = "dock";
    updateCoffeeUI();
  }
);

attachDragGesture(portafilterGroup, DOCK_DISTANCE, () => coffeeStep === 4 && lockPhase === "dock", () => {
  portafilterGroup.style.transform = "translateX(60px)";
  lockPhase = "twist";
  vibrate([10, 20]);
  updateCoffeeUI();
});

attachRotateGesture(
  portafilterGroup, 245, 172, TWIST_DEGREES_NEEDED,
  () => coffeeStep === 4 && lockPhase === "twist",
  accumulated => {
    const visualAngle = Math.min(accumulated / TWIST_DEGREES_NEEDED, 1) * 35;
    portafilterGroup.style.transform = `translateX(60px) rotate(${visualAngle}deg)`;
    coffeeHint.textContent = `Jetzt drehen, um den Siebträger zu verriegeln (${Math.round((accumulated / TWIST_DEGREES_NEEDED) * 100)}%)`;
  },
  () => {
    portafilterGroup.style.transform = "translateX(60px) rotate(35deg)";
    completeCoffee();
  }
);

coffeeBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  enterCoffeeScene();
});

leaveCoffeeScene.addEventListener("click", exitCoffeeScene);

/* ---------- room scene ---------- */

function enterRoomScene() {
  petMainView.classList.add("leaving");

  setTimeout(() => {
    petMainView.classList.add("hidden");
    petMainView.classList.remove("leaving");
    roomScene.classList.remove("hidden");
    roomScene.classList.add("entering");
    void roomScene.offsetWidth;
    roomScene.classList.remove("entering");
  }, 350);
}

function exitRoomScene() {
  roomScene.classList.add("entering");

  setTimeout(() => {
    roomScene.classList.add("hidden");
    roomScene.classList.remove("entering");
    petMainView.classList.add("leaving");
    petMainView.classList.remove("hidden");
    void petMainView.offsetWidth;
    petMainView.classList.remove("leaving");
  }, 350);
}

openRoomBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked || isAsleep()) return;
  enterRoomScene();
});

leaveRoomScene.addEventListener("click", exitRoomScene);

/* ---------- shop ---------- */

function renderShopList(container, items) {
  container.innerHTML = "";
  const owned = (petState && petState.owned_items) || [];
  const coins = (petState && petState.coins) || 0;
  const placedDeco = (petState && petState.room_decor) || [];

  items.forEach(item => {
    const isOwned = owned.includes(item.id);
    const isDeco = item.slot === "deco";
    const isEquipped = isDeco
      ? placedDeco.includes(item.id)
      : petState && petState[SLOT_TO_FIELD[item.slot]] === item.id;

    let btnHtml;
    if (isEquipped) {
      const label = isDeco ? "Abräumen" : "Ausgerüstet";
      btnHtml = `<button class="shop-item-btn equipped" data-action="unequip" data-slot="${item.slot}" data-id="${item.id}">${label}</button>`;
    } else if (isOwned) {
      const label = isDeco ? "Aufstellen" : "Ausrüsten";
      btnHtml = `<button class="shop-item-btn equip" data-action="equip" data-slot="${item.slot}" data-id="${item.id}">${label}</button>`;
    } else if (coins >= item.price) {
      btnHtml = `<button class="shop-item-btn buy" data-action="buy" data-slot="${item.slot}" data-id="${item.id}" data-price="${item.price}">Kaufen</button>`;
    } else {
      btnHtml = `<button class="shop-item-btn locked" disabled>🪙 ${item.price}</button>`;
    }

    const row = document.createElement("div");
    row.className = "shop-item";
    row.innerHTML = `
      <span class="shop-item-icon">${item.icon}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-price">🪙 ${item.price}${isOwned ? " · besitzt du schon" : ""}</div>
      </div>
      ${btnHtml}
    `;
    container.appendChild(row);
  });
}

function renderShop() {
  shopCoinCount.textContent = (petState && petState.coins) || 0;
  renderShopList(shopItemsRoom, SHOP_ITEMS.room);
  renderShopList(shopItemsOutfit, SHOP_ITEMS.outfit);
}

async function handleShopClick(event) {
  const btn = event.target.closest(".shop-item-btn");
  if (!btn || btn.disabled) return;
  if (!requirePerson()) return;

  const action = btn.dataset.action;
  const slot = btn.dataset.slot;
  const id = btn.dataset.id;
  const price = Number(btn.dataset.price);
  const item = findShopItem(id);
  const itemName = item ? item.name : "Artikel";
  const isDeco = slot === "deco";
  const field = SLOT_TO_FIELD[slot];
  let message = null;

  const result = await mutatePet(base => {
    const owned = base.owned_items || [];
    const placed = base.room_decor || [];
    message = null;

    if (action === "buy") {
      if ((base.coins || 0) < price || owned.includes(id)) return null;
      const patch = { coins: base.coins - price, owned_items: [...owned, id] };
      if (isDeco) {
        const roomHasSpace = placed.length < MAX_DECOR;
        patch.room_decor = roomHasSpace ? [...placed, id] : placed;
        message = roomHasSpace ? `${itemName} gekauft und aufgestellt 🎉` : `${itemName} gekauft. Zimmer ist voll, räum zuerst etwas ab 📦`;
      } else {
        patch[field] = id;
        message = `${itemName} gekauft und ausgerüstet 🎉`;
      }
      return patch;
    }

    if (action === "equip") {
      if (!isDeco) return { [field]: id };
      if (placed.includes(id)) return null;
      if (placed.length >= MAX_DECOR) {
        message = "Zimmer ist schon voll, räum zuerst etwas ab 📦";
        return null;
      }
      return { room_decor: [...placed, id] };
    }

    if (action === "unequip") {
      return isDeco ? { room_decor: placed.filter(existing => existing !== id) } : { [field]: null };
    }
    return null;
  });

  renderShop();
  if (message) showToast(message, "success");
  if (result && action === "buy") {
    vibrate([10, 20, 10]);
    announceNewAchievements(result.previous, result.next);
  }
}

shopItemsRoom.addEventListener("click", handleShopClick);
shopItemsOutfit.addEventListener("click", handleShopClick);

shopTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    shopTabs.forEach(t => t.classList.toggle("active", t === tab));
    shopItemsRoom.classList.toggle("hidden", tab.dataset.tab !== "room");
    shopItemsOutfit.classList.toggle("hidden", tab.dataset.tab !== "outfit");
  });
});

function openShop() {
  renderShop();
  shopModal.classList.remove("hidden");
}

openShopBtn.addEventListener("click", openShop);
openShopFromRoom.addEventListener("click", openShop);
closeShopModal.addEventListener("click", () => shopModal.classList.add("hidden"));

/* ---------- achievements modal ---------- */

function renderAchievements() {
  achievementsList.innerHTML = "";
  const state = petState || {};

  ACHIEVEMENTS.forEach(achievement => {
    const unlocked = achievement.check(state);
    const card = document.createElement("div");
    card.className = "achievement-card " + (unlocked ? "unlocked" : "locked");
    card.innerHTML = `
      <span class="achievement-icon">${unlocked ? achievement.icon : "🔒"}</span>
      <div class="achievement-info">
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.desc}</div>
      </div>
    `;
    achievementsList.appendChild(card);
  });
}

openAchievementsBtn.addEventListener("click", () => {
  renderAchievements();
  achievementsModal.classList.remove("hidden");
});

closeAchievementsModal.addEventListener("click", () => achievementsModal.classList.add("hidden"));

/* ---------- pointer gestures ---------- */

petCreature.addEventListener("pointerdown", event => {
  try {
    petCreature.setPointerCapture(event.pointerId);
  } catch (error) {
    // some browsers reject capture for an id not yet tracked as active; harmless to skip
  }

  if (danceRhythmActive) {
    registerDanceTap();
    return;
  }

  if (showerLathering) {
    return;
  }

  gestureState = {
    startX: event.clientX,
    startY: event.clientY,
    startedAt: Date.now(),
    mode: "pending",
    tickDistance: 0,
    totalMoved: 0,
    longPressTimer: setTimeout(() => {
      if (gestureState && gestureState.mode === "pending") {
        gestureState.mode = "cuddled";
        triggerCuddle();
      }
    }, LONG_PRESS_MS)
  };
});

petCreature.addEventListener("pointermove", event => {
  if (danceRhythmActive || showerLathering) return;

  if (!gestureState) return;

  const dx = event.clientX - gestureState.startX;
  const dy = event.clientY - gestureState.startY;
  const dist = Math.hypot(dx, dy);

  if (gestureState.mode === "pending" && dist > MOVE_THRESHOLD) {
    clearTimeout(gestureState.longPressTimer);
    gestureState.mode = "stroking";
    petCreature.classList.add("stroking");
  }

  if (gestureState.mode === "stroking") {
    gestureState.tickDistance += dist;
    gestureState.totalMoved += dist;
    gestureState.startX = event.clientX;
    gestureState.startY = event.clientY;

    if (gestureState.tickDistance >= STROKE_TICK_DISTANCE) {
      gestureState.tickDistance = 0;
      vibrate(8);
      spawnHeart(false);
    }
  }
});

function endGesture() {
  if (danceRhythmActive || showerLathering) return;

  if (!gestureState) return;

  clearTimeout(gestureState.longPressTimer);

  if (gestureState.mode === "stroking" && gestureState.totalMoved >= STROKE_MIN_DISTANCE) {
    triggerPet();
  } else if (gestureState.mode === "pending" && Date.now() - gestureState.startedAt < TAP_MAX_MS) {
    handleTap();
  }

  petCreature.classList.remove("stroking");
  gestureState = null;
}

petCreature.addEventListener("pointerup", endGesture);
petCreature.addEventListener("pointercancel", endGesture);

/* ---------- personality: speech, eyes, taps, idle moods ---------- */

const SPEECH_MS = 4200;
const TAP_MAX_MS = 320;
const TAP_SERIES_MS = 1500;
const EYE_RANGE = 3.6;
let speechTimer = null;
let lookResetTimer = null;
let tapTimes = [];

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sceneBusy() {
  return showerLathering || activityLocked || danceRhythmActive || wakingInProgress || petMainView.classList.contains("hidden");
}

function say(text, ms = SPEECH_MS) {
  mochiSpeech.textContent = text;
  mochiSpeech.classList.remove("hidden", "pop");
  void mochiSpeech.offsetWidth;
  mochiSpeech.classList.add("pop");
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => mochiSpeech.classList.add("hidden"), ms);
}

function chatter() {
  if (document.hidden || sceneBusy()) return;
  if (isAsleep()) {
    say(randomOf(["Zzz… Karotten… 💤", "*schnarch* 😴", "Mmmh… Kuchen… 🎂"]));
    return;
  }
  const stats = decayedStats();
  say(Core.speechLine({
    stats,
    mood: moodTier(overallMood(stats)),
    hour: Core.hourIn(),
    person: currentPerson ? normalizePerson(currentPerson) : null
  }));
}

function scheduleChatter() {
  setTimeout(() => {
    chatter();
    scheduleChatter();
  }, 15000 + Math.random() * 12000);
}

function greet() {
  if (!currentPerson || isAsleep()) return;
  const me = normalizePerson(currentPerson);
  const partner = Core.partnerOf(me);
  const daily = Core.currentDaily(petState, Core.dayKey());
  if (inbox.length) {
    say(`Ich hab Post für dich, ${me}! 💌`, 5200);
  } else if (daily.visitors.includes(partner) && !daily.visitors.includes(me)) {
    say(`${partner} war heute schon bei mir 💗 Jetzt du!`, 5200);
  } else {
    chatter();
  }
}

function setEyeOffset(dx, dy) {
  petEyes.forEach(eye => {
    if (eye.el) eye.el.style.transform = dx || dy ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` : "";
  });
}

function lookAt(clientX, clientY) {
  if (!petSvg || isAsleep()) return;
  const rect = petSvg.getBoundingClientRect();
  if (!rect.width) return;
  const sx = rect.width / 200;
  const sy = rect.height / 215;
  const cx = rect.left + 100 * sx;
  const cy = rect.top + 152 * sy;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const reach = Math.min(1, dist / 90) * EYE_RANGE;
  setEyeOffset((dx / dist) * reach, (dy / dist) * reach);

  clearTimeout(lookResetTimer);
  lookResetTimer = setTimeout(() => setEyeOffset(0, 0), 2200);
}

document.addEventListener("pointermove", event => lookAt(event.clientX, event.clientY), { passive: true });
document.addEventListener("pointerdown", event => lookAt(event.clientX, event.clientY), { passive: true });

function playOnce(className, ms) {
  petCreature.classList.remove(className);
  void petCreature.offsetWidth;
  petCreature.classList.add(className);
  setTimeout(() => petCreature.classList.remove(className), ms);
}

function handleTap() {
  if (isAsleep()) {
    say("Zzz… 😴 (Halt mich gedrückt, dann wach ich auf)");
    return;
  }
  if (sceneBusy()) return;

  const now = Date.now();
  tapTimes = tapTimes.filter(t => now - t < TAP_SERIES_MS);
  tapTimes.push(now);
  const reaction = Core.tapReaction(tapTimes.length);

  if (reaction === "dizzy") {
    tapTimes = [];
    playOnce("dizzy", 1400);
    say("Uiii, mir ist ganz schwindelig 😵‍💫");
    vibrate([20, 30, 20, 30, 20]);
    return;
  }
  if (reaction === "sneeze") {
    playOnce("sneeze", 900);
    say("Hatschi! 🤧");
    ["💨", "✨", "💨"].forEach((emoji, i) => setTimeout(() => spawnParticle(emoji, { size: 16 }), i * 90));
    vibrate([40]);
    return;
  }
  playOnce("giggle", 500);
  vibrate(6);
  if (tapTimes.length === 1 || Math.random() < 0.5) say(randomOf(["Hihi! 😆", "Das kitzelt!", "Hehe 🤭", "Nochmal!", "Pieks! 😄"]), 1800);
}

function idleMoment() {
  if (document.hidden || sceneBusy() || isAsleep() || Math.random() > 0.45) return;
  const stats = decayedStats();

  if (stats.energy < 45 && Math.random() < 0.5) {
    petMouthPath.setAttribute("d", "M90,174 Q100,194 110,174 Q100,168 90,174 Z");
    petCreature.classList.add("yawning");
    say("*gähn* 🥱", 1800);
    setTimeout(() => {
      petCreature.classList.remove("yawning");
      render();
    }, 1600);
    return;
  }

  if (Math.random() < 0.5) {
    setEyeOffset(-EYE_RANGE, 0);
    setTimeout(() => setEyeOffset(EYE_RANGE, 0), 700);
    setTimeout(() => setEyeOffset(0, 0), 1400);
  } else {
    playOnce("hop", 700);
  }
}

setInterval(idleMoment, 9000);

/* ---------- wishes, streak, chest ---------- */

let renderedWishDone = null;

function renderDaily() {
  const key = Core.dayKey();
  const daily = Core.currentDaily(petState, key);
  const wishes = Core.wishesFor(key);
  const doneIds = wishes.filter(w => daily.wishes_done[w.id]).map(w => w.id);
  const doneKey = key + ":" + doneIds.join(",");

  if (doneKey !== renderedWishDone) {
    const previouslyDone = renderedWishDone && renderedWishDone.startsWith(key) ? renderedWishDone.split(":")[1].split(",") : doneIds;
    wishList.innerHTML = wishes.map(wish => {
      const by = daily.wishes_done[wish.id];
      const fresh = by && !previouslyDone.includes(wish.id);
      return `
        <li class="wish-item${by ? " done" : ""}${fresh ? " just-done" : ""}" data-wish="${escapeHtml(wish.id)}">
          <span class="wish-emoji">${wish.emoji}</span>
          <span class="wish-text">${escapeHtml(wish.text)}</span>
          <span class="wish-state">${by ? "✓ " + escapeHtml(by) : "+" + Core.WISH_REWARD + " 🪙"}</span>
        </li>`;
    }).join("");
    renderedWishDone = doneKey;
  }

  wishProgress.textContent = `${doneIds.length}/${wishes.length}`;
  wishBonusHint.textContent = daily.bonus_claimed
    ? "Alle Wünsche erfüllt – Mochi ist überglücklich 🎉"
    : `Alle erfüllt: +${Core.ALL_WISHES_BONUS} 🪙 Bonus obendrauf`;

  const streak = Core.currentStreak(petState, key);
  streakCount.textContent = streak;
  streakPill.classList.toggle("cold", streak === 0);
  const visitorLine = Core.PERSONS.map(p => `${p} ${daily.visitors.includes(p) ? "✓" : "⏳"}`).join(" · ");
  const best = (petState && petState.best_streak) || 0;
  streakLine.textContent = `🔥 Wir-Serie: ${streak} ${streak === 1 ? "Tag" : "Tage"} · heute: ${visitorLine}${best > streak ? ` · Rekord ${best}` : ""}`;

  const me = currentPerson ? normalizePerson(currentPerson) : null;
  chestBtn.classList.toggle("has-gift", !!me && !Core.chestOpened(petState, me, key));
}

streakPill.addEventListener("click", () => {
  const streak = Core.currentStreak(petState, Core.dayKey());
  showToast(streak
    ? `🔥 ${streak} ${streak === 1 ? "Tag" : "Tage"} in Folge wart ihr beide bei Mochi. Weiter so!`
    : "🔥 Kümmert euch heute beide um Mochi, dann startet eure Wir-Serie!", "success");
});

function renderChestModal() {
  const me = normalizePerson(currentPerson);
  const daily = Core.currentDaily(petState, Core.dayKey());
  const mine = daily.chest[me];
  const partner = Core.partnerOf(me);
  const partnerNote = daily.chest[partner] !== undefined ? ` ${partner} hat heute ${daily.chest[partner]} 🪙 gefunden.` : "";

  chestOpenBtn.classList.remove("shaking", "opened");
  if (mine !== undefined) {
    chestOpenBtn.textContent = "📭";
    chestOpenBtn.disabled = true;
    chestText.textContent = `Heute schon geöffnet – morgen wartet eine neue Truhe!${partnerNote}`;
    chestResult.textContent = `Deine Beute heute: ${mine} 🪙`;
  } else {
    chestOpenBtn.textContent = "🎁";
    chestOpenBtn.disabled = false;
    chestText.textContent = `Tippe auf die Truhe! Jeden Tag darf jede:r von euch einmal öffnen.${partnerNote}`;
    chestResult.textContent = "";
  }
}

async function openChest() {
  if (!requirePerson()) return;
  const me = normalizePerson(currentPerson);
  const key = Core.dayKey();
  if (Core.chestOpened(petState, me, key)) return;

  chestOpenBtn.disabled = true;
  chestOpenBtn.classList.add("shaking");
  vibrate([10, 40, 10, 40, 10]);
  await new Promise(resolve => setTimeout(resolve, 900));

  let roll = null;
  const result = await mutatePet(base => {
    roll = Core.openChest(base, me, key);
    if (!roll) return null;
    return {
      ...roll.patch,
      coins: (base.coins || 0) + roll.coins,
      total_coins_earned: (base.total_coins_earned || 0) + roll.coins
    };
  });

  chestOpenBtn.classList.remove("shaking");
  if (!result || !roll) {
    renderChestModal();
    return;
  }

  chestOpenBtn.textContent = roll.jackpot ? "💎" : "🪙";
  chestOpenBtn.classList.add("opened");
  chestResult.textContent = roll.jackpot ? `JACKPOT! +${roll.coins} 🪙` : `+${roll.coins} 🪙`;
  chestText.textContent = roll.jackpot ? "Wahnsinn, die ganz große Truhe! 🤩" : "Mochi freut sich mit dir!";
  celebrate(roll.jackpot ? 40 : 14);
  vibrate(roll.jackpot ? [30, 40, 30, 40, 60] : [20, 30, 20]);
  announceNewAchievements(result.previous, result.next);
}

chestBtn.addEventListener("click", () => {
  if (!requirePerson()) return;
  renderChestModal();
  chestModal.classList.remove("hidden");
});
chestOpenBtn.addEventListener("click", openChest);
closeChest.addEventListener("click", () => chestModal.classList.add("hidden"));

/* ---------- Mochi as messenger ---------- */

let inbox = [];
let selectedKind = null;
let openDeliveryMessage = null;

function updateSendButton() {
  const needsNote = selectedKind === "note";
  sendMessenger.disabled = !selectedKind || (needsNote && !Core.cleanNote(messengerNote.value));
}

function selectKind(kind) {
  selectedKind = kind;
  messengerKinds.forEach(btn => btn.classList.toggle("selected", btn.dataset.kind === kind));
  messengerNoteWrap.classList.toggle("hidden", kind !== "note");
  if (kind === "note") setTimeout(() => messengerNote.focus(), 50);
  updateSendButton();
}

async function renderMessengerHistory() {
  const { data, error } = await supabaseClient
    .from("mochi_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Fehler beim Laden der Botschaften:", error);
    return;
  }

  const rows = data || [];
  messengerHistory.innerHTML = rows.length
    ? rows.map(msg => {
      const kind = Core.MESSAGE_KINDS[msg.kind] || Core.MESSAGE_KINDS.heart;
      const status = msg.delivered_at ? "✓✓ angekommen" : "✈️ unterwegs";
      return `
        <li class="messenger-history-item">
          <span class="messenger-history-emoji">${kind.emoji}</span>
          <div>
            <div class="messenger-history-head">${escapeHtml(msg.from_person)} → ${escapeHtml(msg.to_person)} · ${timeAgo(msg.created_at)} · ${status}</div>
            ${msg.note ? `<div class="messenger-history-note">„${escapeHtml(msg.note)}“</div>` : ""}
          </div>
        </li>`;
    }).join("")
    : `<li class="messenger-history-empty">Noch keine Post – schick die erste! 💌</li>`;
}

function openMessenger() {
  if (sceneBusy()) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  const partner = Core.partnerOf(normalizePerson(currentPerson));
  messengerIntro.textContent = `Mochi macht sich auf den Weg zu ${partner} und überbringt deine Botschaft.`;
  messengerNote.value = "";
  messengerNoteCount.textContent = `0/${Core.NOTE_MAX_LENGTH}`;
  selectKind(null);
  messengerModal.classList.remove("hidden");
  renderMessengerHistory();
}

async function sendLoveMessage(kind, rawNote) {
  if (!requirePerson()) return false;
  const me = normalizePerson(currentPerson);
  const partner = Core.partnerOf(me);
  const note = kind === "note" ? Core.cleanNote(rawNote) : null;
  if (kind === "note" && !note) return false;

  const { error } = await supabaseClient
    .from("mochi_messages")
    .insert({ from_person: me, to_person: partner, kind, note });

  if (error) {
    console.error("Fehler beim Verschicken:", error);
    showToast("Mochi konnte nicht losfliegen, bitte nochmal versuchen.", "error");
    return false;
  }

  const kindInfo = Core.MESSAGE_KINDS[kind];
  playOnce("messenger-flight", 1500);
  const envelope = document.createElement("span");
  envelope.className = "flying-envelope";
  envelope.textContent = kind === "note" ? "✉️" : kindInfo.emoji;
  petHearts.appendChild(envelope);
  setTimeout(() => envelope.remove(), 1500);
  vibrate([10, 30, 10]);
  showToast(`Mochi bringt ${partner} ${kindInfo.phrase} ✈️`, "success");
  say(`Bin gleich bei ${partner}! ✈️`);

  sendAppNotification(supabaseClient, {
    title: "Mochi bringt dir Post 💌",
    body: note ? `${me}: „${note}“` : Core.deliveryText({ from_person: me, kind }),
    excludePerson: me,
    category: "mochi",
    url: "mochi.html"
  });
  broadcastTogether("mail", { person: me });

  const key = Core.dayKey();
  await applyCare({ bond: 8 }, 0, 1, (nowIso, state) => {
    const reward = Core.messageReward(state, me, key);
    return { ...reward.patch, messages_sent: (state.messages_sent || 0) + 1, extraCoins: reward.coins };
  }, { type: "message" });
  return true;
}

messengerBtn.addEventListener("click", openMessenger);
messengerKinds.forEach(btn => btn.addEventListener("click", () => selectKind(btn.dataset.kind)));
messengerNote.addEventListener("input", () => {
  messengerNoteCount.textContent = `${messengerNote.value.length}/${Core.NOTE_MAX_LENGTH}`;
  updateSendButton();
});
cancelMessenger.addEventListener("click", () => messengerModal.classList.add("hidden"));
sendMessenger.addEventListener("click", async () => {
  if (!selectedKind) return;
  sendMessenger.disabled = true;
  const sent = await sendLoveMessage(selectedKind, messengerNote.value);
  if (sent) messengerModal.classList.add("hidden");
  else updateSendButton();
});

async function loadInbox() {
  if (!currentPerson) return;
  const { data, error } = await supabaseClient
    .from("mochi_messages")
    .select("*")
    .eq("to_person", normalizePerson(currentPerson))
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Fehler beim Laden der Post:", error);
    return;
  }

  const hadMail = inbox.length;
  inbox = (data || []).filter(msg => !openDeliveryMessage || msg.id !== openDeliveryMessage.id);
  renderMailEnvelope();
  if (inbox.length > hadMail && !sceneBusy()) {
    playOnce("hop", 700);
    say(`Ich hab Post für dich, ${normalizePerson(currentPerson)}! 💌`, 5200);
  }
}

function renderMailEnvelope() {
  mailEnvelope.classList.toggle("hidden", inbox.length === 0 || !!openDeliveryMessage);
  mailCount.classList.toggle("hidden", inbox.length < 2);
  mailCount.textContent = inbox.length;
}

function burst(emoji, count) {
  deliveryBurst.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "delivery-piece";
    piece.textContent = emoji;
    piece.style.setProperty("--x", Math.round((Math.random() - 0.5) * 260) + "px");
    piece.style.setProperty("--y", Math.round(-40 - Math.random() * 160) + "px");
    piece.style.setProperty("--r", Math.round((Math.random() - 0.5) * 120) + "deg");
    piece.style.animationDelay = (i * 45) + "ms";
    deliveryBurst.appendChild(piece);
  }
}

function openDelivery() {
  const msg = inbox.shift();
  if (!msg) return;
  openDeliveryMessage = msg;
  renderMailEnvelope();

  const kind = Core.MESSAGE_KINDS[msg.kind] || Core.MESSAGE_KINDS.heart;
  deliveryModal.querySelector(".delivery-box").dataset.kind = msg.kind;
  deliveryEmoji.textContent = kind.emoji;
  deliveryTitle.textContent = Core.deliveryText(msg);
  deliveryNote.textContent = msg.note ? `„${msg.note}“` : "";
  deliveryNote.classList.toggle("hidden", !msg.note);
  deliveryTime.textContent = `abgeschickt ${timeAgo(msg.created_at)}`;
  replyDelivery.textContent = `💋 Küsschen zurück an ${msg.from_person}`;
  deliveryModal.classList.remove("hidden");

  burst(msg.kind === "kiss" ? "💋" : msg.kind === "hug" ? "🤗" : msg.kind === "note" ? "💌" : "💗", 14);
  if (msg.kind === "hug") playOnce("hugging", 900);
  vibrate(msg.kind === "hug" ? [30, 60, 30, 60, 60] : [15, 30, 15]);
  celebrate(10);
}

async function finishDelivery() {
  const msg = openDeliveryMessage;
  deliveryModal.classList.add("hidden");
  openDeliveryMessage = null;
  renderMailEnvelope();
  if (!msg) return;

  const { error } = await supabaseClient
    .from("mochi_messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", msg.id);
  if (error) console.error("Fehler beim Zustellen:", error);

  if (inbox.length) say("Da ist noch mehr Post! 💌");
}

mailEnvelope.addEventListener("pointerdown", event => event.stopPropagation());
mailEnvelope.addEventListener("click", event => {
  event.stopPropagation();
  openDelivery();
});
closeDelivery.addEventListener("click", finishDelivery);
replyDelivery.addEventListener("click", async () => {
  await finishDelivery();
  await sendLoveMessage("kiss");
});

/* ---------- together: who is here right now, double cuddles ---------- */

const DOUBLE_CUDDLE_WINDOW_MS = 15000;
const DOUBLE_CUDDLE_COINS = 12;
let togetherChannel = null;
let partnerHere = false;
let partnerCuddleAt = 0;
let ownCuddleAt = 0;

function broadcastTogether(event, payload) {
  if (!togetherChannel) return;
  togetherChannel.send({ type: "broadcast", event, payload }).catch(() => {});
}

function joinTogether() {
  if (!currentPerson || togetherChannel) return;
  const me = normalizePerson(currentPerson);

  togetherChannel = supabaseClient.channel("mochi-together", { config: { presence: { key: me } } });
  togetherChannel
    .on("presence", { event: "sync" }, updateTogether)
    .on("broadcast", { event: "care" }, ({ payload }) => onPartnerCare(payload))
    .on("broadcast", { event: "cuddle" }, ({ payload }) => onPartnerCuddle(payload))
    .on("broadcast", { event: "double" }, () => celebrateDoubleCuddle(false))
    .on("broadcast", { event: "mail" }, () => loadInbox())
    .subscribe(status => {
      if (status === "SUBSCRIBED") togetherChannel.track({ person: me, since: new Date().toISOString() });
    });
}

function updateTogether() {
  if (!togetherChannel || !currentPerson) return;
  const partner = Core.partnerOf(normalizePerson(currentPerson));
  const here = Object.keys(togetherChannel.presenceState() || {}).includes(partner);
  if (here === partnerHere) return;
  partnerHere = here;

  togetherBanner.textContent = `💞 ${partner} ist auch gerade bei Mochi`;
  togetherBanner.classList.toggle("hidden", !here);
  petCreature.classList.toggle("together", here);
  if (here && !sceneBusy()) {
    say(`Juhu, ${partner} ist auch da! 💞`);
    playOnce("hop", 700);
  }
}

function spawnPartnerParticle(emoji) {
  const particle = document.createElement("span");
  particle.className = "pet-heart-particle from-partner";
  particle.textContent = emoji;
  particle.style.setProperty("--drift", Math.round(-40 - Math.random() * 40) + "px");
  particle.style.left = 78 + Math.random() * 12 + "%";
  petHearts.appendChild(particle);
  setTimeout(() => particle.remove(), 1200);
}

const PARTNER_CARE_LINES = {
  pet: "{p} streichelt mich gerade! 🥰",
  cuddle: "{p} knuddelt mich! 🤗",
  feed: "{p} hat mir {food} gegeben 😋",
  shower: "{p} hat mich gebadet 🫧",
  dance: "Ich hab mit {p} getanzt! 💃",
  sport: "{p} macht Sport mit mir 🏃",
  coffee: "{p} hat mir Kaffee gemacht ☕",
  message: "Ich soll dir was von {p} bringen 💌",
  sleep: "{p} hat mich geweckt ☀️"
};

function onPartnerCare(payload) {
  if (!payload || !payload.person || payload.type === "cuddle") return;
  for (let i = 0; i < 3; i++) setTimeout(() => spawnPartnerParticle(randomOf(["💗", "💕", "✨"])), i * 140);
  const line = PARTNER_CARE_LINES[payload.type];
  if (line && !sceneBusy()) say(line.replace("{p}", payload.person).replace("{food}", payload.food || "etwas Leckeres"));
}

function onPartnerCuddle(payload) {
  partnerCuddleAt = Date.now();
  for (let i = 0; i < 4; i++) setTimeout(() => spawnPartnerParticle("💞"), i * 120);
  if (!sceneBusy()) say(`${(payload && payload.person) || "Dein Schatz"} knuddelt mich! Drück mich auch! 🤗`, 5200);
}

/* called on every long-press: whoever completes the pair within the window books the bonus */
function noteOwnCuddle() {
  const me = normalizePerson(currentPerson);
  ownCuddleAt = Date.now();
  broadcastTogether("cuddle", { person: me });
  if (partnerHere && ownCuddleAt - partnerCuddleAt < DOUBLE_CUDDLE_WINDOW_MS) {
    partnerCuddleAt = 0;
    completeDoubleCuddle();
  }
}

async function completeDoubleCuddle() {
  const result = await mutatePet(base => ({
    bond: 100,
    coins: (base.coins || 0) + DOUBLE_CUDDLE_COINS,
    total_coins_earned: (base.total_coins_earned || 0) + DOUBLE_CUDDLE_COINS,
    double_cuddles: (base.double_cuddles || 0) + 1
  }));
  if (!result) return;
  broadcastTogether("double", { person: normalizePerson(currentPerson) });
  celebrateDoubleCuddle(true);
  announceNewAchievements(result.previous, result.next);
}

function celebrateDoubleCuddle() {
  playOnce("double-hug", 1600);
  for (let i = 0; i < 10; i++) setTimeout(() => spawnHeart(true), i * 90);
  for (let i = 0; i < 4; i++) setTimeout(() => spawnPartnerParticle("💞"), i * 150);
  showToast(`Doppelknuddler! Ihr habt Mochi gleichzeitig gedrückt 💞 +${DOUBLE_CUDDLE_COINS} 🪙`, "success");
  say("Ich werde von euch BEIDEN geknuddelt!! 🥹💞", 5200);
  celebrate(30);
  vibrate([30, 50, 30, 50, 80]);
}

/* ---------- realtime + init ---------- */

supabaseClient
  .channel("pet_state_changes")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pet_state" }, payload => {
    const row = payload && payload.new;
    if (!row || !row.id) {
      loadPetState();
      return;
    }
    if (petState && (row.version || 0) < (petState.version || 0)) return;
    petState = row;
    render();
    if (!shopModal.classList.contains("hidden")) renderShop();
  })
  .subscribe();

supabaseClient
  .channel("mochi_messages_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "mochi_messages" }, () => {
    loadInbox();
  })
  .subscribe();

supabaseClient
  .channel("battery_changes_for_mochi")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cuddle_batteries" }, () => {
    loadBatteryAvg();
  })
  .subscribe();

render();
loadPetState().then(() => loadInbox()).then(() => setTimeout(greet, 900));
loadBatteryAvg();
joinTogether();
scheduleChatter();
setInterval(render, 60000);
