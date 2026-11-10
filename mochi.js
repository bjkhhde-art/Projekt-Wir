/* Mochi, part 1 of 6: page elements, the stats/growth/shop model, achievements, rendering, loading and particles.
   The page loads mochi-core.js, then mochi.js, mochi-care.js, mochi-games.js, mochi-shop.js, mochi-social.js and
   mochi-start.js in this order. They share one global scope: later files use what earlier ones define,
   and only mochi-start.js runs anything at load time. */

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

const gardenBtn = document.getElementById("gardenBtn");
const starsBtn = document.getElementById("starsBtn");
const gardenScene = document.getElementById("gardenScene");
const gardenPlots = document.getElementById("gardenPlots");
const gardenPantry = document.getElementById("gardenPantry");
const leaveGardenScene = document.getElementById("leaveGardenScene");
const seedModal = document.getElementById("seedModal");
const seedList = document.getElementById("seedList");
const closeSeedModal = document.getElementById("closeSeedModal");
const gardenFoodSection = document.getElementById("gardenFoodSection");
const gardenFoodGrid = document.getElementById("gardenFoodGrid");
const starsScene = document.getElementById("starsScene");
const starsField = document.getElementById("starsField");
const starsStart = document.getElementById("starsStart");
const starsRoundsInfo = document.getElementById("starsRoundsInfo");
const starsPlayBtn = document.getElementById("starsPlayBtn");
const starsScore = document.getElementById("starsScore");
const starsTime = document.getElementById("starsTime");
const starsBest = document.getElementById("starsBest");
const starsMochi = document.getElementById("starsMochi");
const leaveStarsScene = document.getElementById("leaveStarsScene");

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
    { id: "cushion", slot: "deco", name: "Kissen", icon: "🛋️", price: 15 },
    { id: "rainbow", slot: "wall", name: "Regenbogen", icon: "🌈", price: 35 },
    { id: "grass", slot: "floor", name: "Blumenwiese", icon: "🌼", price: 30 },
    { id: "aquarium", slot: "deco", name: "Aquarium", icon: "🐠", price: 40 },
    { id: "frame", slot: "deco", name: "Herz-Bild", icon: "🖼️", price: 20 },
    { id: "lights", slot: "deco", name: "Lichterkette", icon: "✨", price: 30 }
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
    { id: "necklace", slot: "accessory", name: "Kette", icon: "📿", price: 18 },
    { id: "wizard", slot: "hat", name: "Zauberhut", icon: "🧙", price: 40 },
    { id: "halo", slot: "hat", name: "Heiligenschein", icon: "😇", price: 45 },
    { id: "bunny", slot: "hat", name: "Hasenohren", icon: "🐰", price: 30 },
    { id: "heartglasses", slot: "accessory", name: "Herzbrille", icon: "💕", price: 30 },
    { id: "monocle", slot: "accessory", name: "Monokel", icon: "🧐", price: 35 }
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
  { id: "double_10", icon: "🫂", name: "Kuschelsandwich", desc: "10x gleichzeitig geknuddelt", check: s => (s.double_cuddles || 0) >= 10 },
  { id: "collector_20", icon: "💎", name: "Schatzkammer", desc: "20 Gegenstände besessen", check: s => ((s.owned_items) || []).length >= 20 },
  { id: "harvest_1", icon: "🌱", name: "Grüner Daumen", desc: "Das erste Obst im Garten geerntet", check: s => extrasOf(s).harvests >= 1 },
  { id: "harvest_10", icon: "🧺", name: "Erntezeit", desc: "10x im Garten geerntet", check: s => extrasOf(s).harvests >= 10 },
  { id: "harvest_30", icon: "🚜", name: "Bauernhof Wir", desc: "30x im Garten geerntet", check: s => extrasOf(s).harvests >= 30 },
  { id: "harvest_all", icon: "🥗", name: "Obstsalat", desc: "Jede Obstsorte aus dem Garten einmal geerntet", check: s => Core.SEEDS.every(seed => extrasOf(s).harvested_kinds.includes(seed.fruit)) },
  { id: "stars_1", icon: "⭐", name: "Sternschnuppe", desc: "Zum ersten Mal Sternenregen gespielt", check: s => extrasOf(s).star_games >= 1 },
  { id: "stars_25", icon: "🌟", name: "Sternenfänger", desc: "25 Punkte in einer Runde Sternenregen", check: s => extrasOf(s).star_best >= 25 },
  { id: "stars_40", icon: "🌌", name: "Milchstraße", desc: "40 Punkte in einer Runde Sternenregen", check: s => extrasOf(s).star_best >= 40 },
  { id: "stars_games_20", icon: "🎮", name: "Sternen-Profi", desc: "20 Runden Sternenregen gespielt", check: s => extrasOf(s).star_games >= 20 }
];

function extrasOf(state) {
  return Core.currentExtras(state);
}

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
  if (!gardenScene.classList.contains("hidden")) renderGarden();
  if (!foodModal.classList.contains("hidden")) renderGardenFood();

  tearLeft.classList.toggle("hidden", mood !== "verysad");
  tearRight.classList.toggle("hidden", mood !== "verysad");
  petSmoke.classList.toggle("hidden", mood !== "verysad");
  eyeClosedLeft.classList.toggle("hidden", !asleep);
  eyeClosedRight.classList.toggle("hidden", !asleep);
  bedPieces.forEach(el => el.classList.toggle("hidden", !asleep));

  sleepIcon.textContent = asleep ? "☀️" : "😴";
  sleepLabel.textContent = asleep ? "Aufwecken" : "Schlafen";
  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, openRoomBtn, gardenBtn, starsBtn].forEach(btn => btn.classList.toggle("hidden", asleep));
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
  if (!document.hidden && isAsleep()) spawnParticle("💤", { size: 20 });
}, 2500);
