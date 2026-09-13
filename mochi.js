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
const petFoamOverlay = document.getElementById("petFoamOverlay");
const shampooBottle = document.getElementById("shampooBottle");
const petHint = document.getElementById("petHint");
const DEFAULT_PET_HINT = "Wir streicheln Mochi mit einer Wischbewegung oder halten gedrückt zum Kuscheln 🤗";

const growthBadge = document.getElementById("growthBadge");
const coinCount = document.getElementById("coinCount");
const openShopBtn = document.getElementById("openShopBtn");

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
const ACTIVITY_COOLDOWN_MS = 60 * 1000;
const SHOWER_SCRUB_NEEDED = 180;
const SHOWER_TICK_DISTANCE = 18;
const DISCO_PARTY_DURATION_MS = 3200;
const SLEEP_DURATION_MS = 2 * 60 * 1000;
const DEFAULT_STAT = 70;

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
  sport: { label: "Mochi hat Sport gemacht", particleEmoji: "💦", particleCount: 4, falling: false, animationClass: "exercising", vibratePattern: [15, 30, 15, 30] },
  dance: { label: "Mochi hat getanzt", particleEmoji: "🎵", particleCount: 5, falling: false, animationClass: "dancing", vibratePattern: [10, 20, 10, 20, 10] }
};

/* ---------- stats, growth & shop model ---------- */

const DECAY_BASE = { hunger: 4, energy: 2.5, cleanliness: 2, bond: 3 };
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

let petState = null;
let batteryAvg = 50;
let currentPerson = localStorage.getItem("pw_person");
let gestureState = null;
let lastPetTrigger = 0;
let lastCuddleTrigger = 0;
let lastActivityTrigger = 0;
let showerLathering = false;
let showerScrubProgress = 0;
let showerDrag = null;
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
  });
});

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- stats decay + growth ---------- */

function decayRate(base) {
  return clamp(base - (batteryAvg / 100) * (base - base * 0.17), base * 0.17, base);
}

function decayedStats() {
  const lastUpdate = petState && petState.updated_at ? new Date(petState.updated_at).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (Date.now() - lastUpdate) / 3600000);
  const result = {};

  for (const key of Object.keys(DECAY_BASE)) {
    const stored = petState && typeof petState[key] === "number" ? petState[key] : DEFAULT_STAT;
    result[key] = clamp(Math.round(stored - hoursElapsed * decayRate(DECAY_BASE[key])), 0, 100);
  }

  return result;
}

function overallMood(stats) {
  return Math.round((stats.hunger + stats.energy + stats.cleanliness + stats.bond) / 4);
}

function isAsleep() {
  if (!petState || !petState.sleep_started_at) return false;
  return Date.now() - new Date(petState.sleep_started_at).getTime() < SLEEP_DURATION_MS;
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

async function applyCare(statDeltas, coinReward, careReward, extraFields) {
  const stats = decayedStats();

  for (const key in statDeltas) {
    stats[key] = clamp(stats[key] + statDeltas[key], 0, 100);
  }

  const nowIso = new Date().toISOString();
  const resolvedExtra = typeof extraFields === "function" ? extraFields(nowIso) : (extraFields || {});

  const payload = {
    ...stats,
    coins: (petState && petState.coins || 0) + coinReward,
    care_score: (petState && petState.care_score || 0) + careReward,
    last_interacted_by: currentPerson,
    updated_at: nowIso,
    ...resolvedExtra
  };

  petState = { ...(petState || {}), ...payload };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update(payload)
    .eq("id", "shared");

  if (error) console.error("Fehler beim Speichern:", error);
  return !error;
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

  tearLeft.classList.toggle("hidden", mood !== "verysad");
  tearRight.classList.toggle("hidden", mood !== "verysad");
  petSmoke.classList.toggle("hidden", mood !== "verysad");
  eyeClosedLeft.classList.toggle("hidden", !asleep);
  eyeClosedRight.classList.toggle("hidden", !asleep);
  bedPieces.forEach(el => el.classList.toggle("hidden", !asleep));

  sleepIcon.textContent = asleep ? "☀️" : "😴";
  sleepLabel.textContent = asleep ? "Aufwecken" : "Schlafen";
  [feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, openRoomBtn].forEach(btn => btn.classList.toggle("hidden", asleep));
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

  vibrate([15, 15]);

  const sleepStart = petState && petState.sleep_started_at ? new Date(petState.sleep_started_at).getTime() : null;
  const sleptRatio = sleepStart ? clamp((Date.now() - sleepStart) / SLEEP_DURATION_MS, 0, 1) : 0;
  const energyBoost = Math.round(sleptRatio * 50);
  const coinReward = sleptRatio >= 0.8 ? 6 : 0;

  showToast("Mochi ist aufgewacht 💤➡️😊", "success");

  await applyCare({ energy: energyBoost }, coinReward, 3, { sleep_started_at: null });
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

  await applyCare({ bond: 6 }, 1, 1, nowIso => ({ last_petted_at: nowIso }));
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

  const success = await applyCare({ bond: 28 }, 3, 2, nowIso => ({ last_cuddled_at: nowIso }));
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
  if (showerLathering) return false;

  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return false;
  }

  const now = Date.now();
  if (now - lastActivityTrigger < ACTIVITY_COOLDOWN_MS) {
    showToast("Mochi braucht kurz eine Pause, gleich nochmal 💭", "success");
    return false;
  }
  if (!requirePerson()) return false;

  const activity = ACTIVITIES[kind];
  lastActivityTrigger = now;

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
    await applyCare({ hunger: 45, bond: 5 }, 3, 2, extra);
  } else {
    await applyCare({ bond: 12 }, 5, 2, extra);
  }

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

  const nowIso = new Date().toISOString();
  petState = { ...(petState || {}), sleep_started_at: nowIso, last_interacted_by: currentPerson, updated_at: nowIso };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update({ sleep_started_at: nowIso, last_interacted_by: currentPerson, updated_at: nowIso })
    .eq("id", "shared");

  if (error) console.error("Fehler beim Einschlafen:", error);
}

function startShowerLathering() {
  showerLathering = true;
  showerScrubProgress = 0;
  petFoamOverlay.setAttribute("opacity", "0");
  petCreature.classList.add("showering");
  shampooBottle.classList.remove("hidden");
  [feedBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn].forEach(btn => btn.classList.add("hidden"));
  showerBtn.classList.add("hidden");
  petHint.textContent = "Wir schäumen Mochi mit einer Wischbewegung ein (0%)";
  showToast("Wir schäumen Mochi mit Shampoo ein 🧴", "success");
}

async function finishShower() {
  showerLathering = false;
  showerDrag = null;
  lastActivityTrigger = Date.now();
  shampooBottle.classList.add("hidden");
  petHint.textContent = DEFAULT_PET_HINT;
  [feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn].forEach(btn => btn.classList.remove("hidden"));

  for (let i = 0; i < 6; i++) {
    setTimeout(() => spawnParticle("💧", { falling: true }), i * 100);
  }
  petFoamOverlay.setAttribute("opacity", "0");
  vibrate([10, 10, 10, 10]);
  setTimeout(() => petCreature.classList.remove("showering"), 1300);

  showToast("Mochi ist frisch geduscht 🚿✨", "success");

  await applyCare({ cleanliness: 45, bond: 5 }, 4, 2, () => ({ last_activity: "shower" }));
}

function startDiscoParty() {
  petCreature.classList.add("party");
  for (let i = 0; i < 7; i++) {
    setTimeout(() => spawnParticle(["🎵", "🎶", "✨", "🪩"][Math.floor(Math.random() * 4)]), i * 260);
  }
  setTimeout(() => petCreature.classList.remove("party"), DISCO_PARTY_DURATION_MS);
}

/* ---------- activity buttons ---------- */

feedBtn.addEventListener("click", () => {
  if (showerLathering) return;
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
  if (showerLathering) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  const now = Date.now();
  if (now - lastActivityTrigger < ACTIVITY_COOLDOWN_MS) {
    showToast("Mochi braucht kurz eine Pause, gleich nochmal 💭", "success");
    return;
  }
  if (!requirePerson()) return;
  startShowerLathering();
});

sportBtn.addEventListener("click", () => performActivity("sport"));

danceBtn.addEventListener("click", async () => {
  const started = await performActivity("dance");
  if (started) startDiscoParty();
});

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

  await applyCare({ bond: 20 }, 8, 3, () => ({ last_activity: "coffee" }));

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
  if (showerLathering) return;
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
  if (showerLathering || isAsleep()) return;
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

  const action = btn.dataset.action;
  const slot = btn.dataset.slot;
  const id = btn.dataset.id;
  const nowIso = new Date().toISOString();

  if (slot === "deco") {
    if (action === "buy") {
      if (!requirePerson()) return;
      const price = Number(btn.dataset.price);
      if (((petState && petState.coins) || 0) < price) return;

      const owned = [...((petState && petState.owned_items) || []), id];
      const placed = [...((petState && petState.room_decor) || [])];
      const roomHasSpace = placed.length < MAX_DECOR;
      if (roomHasSpace) placed.push(id);

      const payload = {
        coins: petState.coins - price,
        owned_items: owned,
        room_decor: placed,
        last_interacted_by: currentPerson,
        updated_at: nowIso
      };

      petState = { ...petState, ...payload };
      render();
      renderShop();
      vibrate([10, 20, 10]);
      const item = findShopItem(id);
      const itemName = item ? item.name : "Artikel";
      showToast(
        roomHasSpace
          ? `${itemName} gekauft und aufgestellt 🎉`
          : `${itemName} gekauft. Zimmer ist voll, räum zuerst etwas ab 📦`,
        "success"
      );

      const { error } = await supabaseClient.from("pet_state").update(payload).eq("id", "shared");
      if (error) console.error("Fehler beim Kauf:", error);
    } else if (action === "equip") {
      if (!requirePerson()) return;
      const placed = [...((petState && petState.room_decor) || [])];
      if (placed.includes(id)) return;
      if (placed.length >= MAX_DECOR) {
        showToast("Zimmer ist schon voll, räum zuerst etwas ab 📦", "success");
        return;
      }
      placed.push(id);
      const payload = { room_decor: placed, last_interacted_by: currentPerson, updated_at: nowIso };
      petState = { ...petState, ...payload };
      render();
      renderShop();

      const { error } = await supabaseClient.from("pet_state").update(payload).eq("id", "shared");
      if (error) console.error("Fehler beim Aufstellen:", error);
    } else if (action === "unequip") {
      const placed = ((petState && petState.room_decor) || []).filter(existing => existing !== id);
      const payload = { room_decor: placed, last_interacted_by: currentPerson, updated_at: nowIso };
      petState = { ...petState, ...payload };
      render();
      renderShop();

      const { error } = await supabaseClient.from("pet_state").update(payload).eq("id", "shared");
      if (error) console.error("Fehler beim Abräumen:", error);
    }
    return;
  }

  const field = SLOT_TO_FIELD[slot];

  if (action === "buy") {
    if (!requirePerson()) return;
    const price = Number(btn.dataset.price);
    if (((petState && petState.coins) || 0) < price) return;

    const owned = [...((petState && petState.owned_items) || []), id];
    const payload = {
      coins: petState.coins - price,
      owned_items: owned,
      [field]: id,
      last_interacted_by: currentPerson,
      updated_at: nowIso
    };

    petState = { ...petState, ...payload };
    render();
    renderShop();
    vibrate([10, 20, 10]);
    const item = findShopItem(id);
    showToast(`${item ? item.name : "Artikel"} gekauft und ausgerüstet 🎉`, "success");

    const { error } = await supabaseClient.from("pet_state").update(payload).eq("id", "shared");
    if (error) console.error("Fehler beim Kauf:", error);
  } else if (action === "equip") {
    if (!requirePerson()) return;
    const payload = { [field]: id, last_interacted_by: currentPerson, updated_at: nowIso };
    petState = { ...petState, ...payload };
    render();
    renderShop();

    const { error } = await supabaseClient.from("pet_state").update(payload).eq("id", "shared");
    if (error) console.error("Fehler beim Ausrüsten:", error);
  } else if (action === "unequip") {
    const payload = { [field]: null, last_interacted_by: currentPerson, updated_at: nowIso };
    petState = { ...petState, ...payload };
    render();
    renderShop();

    const { error } = await supabaseClient.from("pet_state").update(payload).eq("id", "shared");
    if (error) console.error("Fehler beim Ablegen:", error);
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

/* ---------- pointer gestures ---------- */

petCreature.addEventListener("pointerdown", event => {
  petCreature.setPointerCapture(event.pointerId);

  if (showerLathering) {
    showerDrag = { startX: event.clientX, startY: event.clientY, tickDistance: 0 };
    return;
  }

  gestureState = {
    startX: event.clientX,
    startY: event.clientY,
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
  if (showerLathering && showerDrag) {
    const dist = Math.hypot(event.clientX - showerDrag.startX, event.clientY - showerDrag.startY);
    showerDrag.tickDistance += dist;
    showerDrag.startX = event.clientX;
    showerDrag.startY = event.clientY;

    if (showerDrag.tickDistance >= SHOWER_TICK_DISTANCE) {
      showerDrag.tickDistance = 0;
      showerScrubProgress = Math.min(showerScrubProgress + SHOWER_TICK_DISTANCE, SHOWER_SCRUB_NEEDED);
      petFoamOverlay.setAttribute("opacity", String(Math.min(0.85, (showerScrubProgress / SHOWER_SCRUB_NEEDED) * 0.85)));
      spawnParticle("🫧", { size: 14 });
      vibrate(6);

      if (showerScrubProgress >= SHOWER_SCRUB_NEEDED) {
        finishShower();
      } else {
        petHint.textContent = `Wir schäumen Mochi mit einer Wischbewegung ein (${Math.round((showerScrubProgress / SHOWER_SCRUB_NEEDED) * 100)}%)`;
      }
    }
    return;
  }

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
  if (showerLathering) {
    showerDrag = null;
    return;
  }

  if (!gestureState) return;

  clearTimeout(gestureState.longPressTimer);

  if (gestureState.mode === "stroking" && gestureState.totalMoved >= STROKE_MIN_DISTANCE) {
    triggerPet();
  }

  petCreature.classList.remove("stroking");
  gestureState = null;
}

petCreature.addEventListener("pointerup", endGesture);
petCreature.addEventListener("pointercancel", endGesture);

/* ---------- realtime + init ---------- */

supabaseClient
  .channel("pet_state_changes")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pet_state" }, payload => {
    petState = payload.new;
    render();
  })
  .subscribe();

supabaseClient
  .channel("battery_changes_for_mochi")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cuddle_batteries" }, () => {
    loadBatteryAvg();
  })
  .subscribe();

render();
loadPetState();
loadBatteryAvg();
setInterval(render, 60000);
