const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const petCreature = document.getElementById("petCreature");
const moodLabel = document.getElementById("moodLabel");
const petStatusText = document.getElementById("petStatusText");
const petHappinessFill = document.getElementById("petHappinessFill");
const petHearts = document.getElementById("petHearts");
const tearLeft = document.getElementById("petTearLeft");
const tearRight = document.getElementById("petTearRight");
const petMouthPath = document.getElementById("petMouthPath");
const petSmoke = document.getElementById("petSmoke");
const eyeClosedLeft = document.getElementById("petEyeClosedLeft");
const eyeClosedRight = document.getElementById("petEyeClosedRight");

const feedBtn = document.getElementById("feedBtn");
const showerBtn = document.getElementById("showerBtn");
const sportBtn = document.getElementById("sportBtn");
const danceBtn = document.getElementById("danceBtn");
const coffeeBtn = document.getElementById("coffeeBtn");
const sleepBtn = document.getElementById("sleepBtn");
const sleepIcon = document.getElementById("sleepIcon");
const sleepLabel = document.getElementById("sleepLabel");

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
const PET_HAPPINESS_BOOST = 6;
const CUDDLE_HAPPINESS_BOOST = 28;
const ACTIVITY_HAPPINESS_BOOST = 10;
const ACTIVITY_COOLDOWN_MS = 60 * 1000;
const SLEEP_DURATION_MS = 2 * 60 * 1000;
const DEFAULT_HAPPINESS = 50;

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
const COFFEE_HAPPINESS_BOOST = 20;

const ACTIVITIES = {
  feed: { label: "Mochi hat genascht", particleEmoji: "🥕", particleCount: 1, falling: false, animationClass: "feeding", vibratePattern: [10, 20, 10] },
  shower: { label: "Mochi ist frisch geduscht", particleEmoji: "💧", particleCount: 5, falling: true, animationClass: "showering", vibratePattern: [10, 10, 10, 10] },
  sport: { label: "Mochi hat Sport gemacht", particleEmoji: "💦", particleCount: 4, falling: false, animationClass: "exercising", vibratePattern: [15, 30, 15, 30] },
  dance: { label: "Mochi hat getanzt", particleEmoji: "🎵", particleCount: 5, falling: false, animationClass: "dancing", vibratePattern: [10, 20, 10, 20, 10] }
};

let petState = null;
let batteryAvg = 50;
let currentPerson = localStorage.getItem("pw_person");
let gestureState = null;
let lastPetTrigger = 0;
let lastCuddleTrigger = 0;
let lastActivityTrigger = 0;
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

/* ---------- mood + rendering ---------- */

function decayedHappiness() {
  const stored = petState && typeof petState.happiness === "number" ? petState.happiness : DEFAULT_HAPPINESS;
  const lastUpdate = petState && petState.updated_at ? new Date(petState.updated_at).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (Date.now() - lastUpdate) / 3600000);

  // Low Kuschelbatterie -> faster decay (up to 3 pts/h); a full battery slows decay to ~0.5 pts/h.
  const decayPerHour = clamp(3 - (batteryAvg / 100) * 2.5, 0.5, 3);

  return clamp(Math.round(stored - hoursElapsed * decayPerHour), 0, 100);
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

function render() {
  const happiness = decayedHappiness();
  const mood = moodTier(happiness);
  const asleep = isAsleep();

  petCreature.className = "pet-creature mood-" + mood + (asleep ? " sleeping" : "");
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

  petHappinessFill.style.width = happiness + "%";
  petHappinessFill.style.background =
    happiness >= 60 ? "var(--gradient-brand)" :
    happiness >= 40 ? "var(--gradient-warm)" :
    "linear-gradient(135deg, #f87171, var(--danger))";

  tearLeft.classList.toggle("hidden", mood !== "verysad");
  tearRight.classList.toggle("hidden", mood !== "verysad");
  petSmoke.classList.toggle("hidden", mood !== "verysad");
  eyeClosedLeft.classList.toggle("hidden", !asleep);
  eyeClosedRight.classList.toggle("hidden", !asleep);

  sleepIcon.textContent = asleep ? "☀️" : "😴";
  sleepLabel.textContent = asleep ? "Aufwecken" : "Schlafen";
  [feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn].forEach(btn => btn.classList.toggle("hidden", asleep));
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
  showToast("Mochi ist aufgewacht 💤➡️😊", "success");

  const nowIso = new Date().toISOString();
  petState = { ...(petState || {}), sleep_started_at: null, last_interacted_by: currentPerson, updated_at: nowIso };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update({ sleep_started_at: null, last_interacted_by: currentPerson, updated_at: nowIso })
    .eq("id", "shared");

  if (error) console.error("Fehler beim Aufwecken:", error);
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

  const newHappiness = clamp(decayedHappiness() + PET_HAPPINESS_BOOST, 0, 100);
  const nowIso = new Date().toISOString();
  petState = { ...(petState || {}), happiness: newHappiness, last_petted_at: nowIso, last_interacted_by: currentPerson, updated_at: nowIso };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update({ happiness: newHappiness, last_petted_at: nowIso, last_interacted_by: currentPerson, updated_at: nowIso })
    .eq("id", "shared");

  if (error) console.error("Fehler beim Streicheln:", error);
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

  const newHappiness = clamp(decayedHappiness() + CUDDLE_HAPPINESS_BOOST, 0, 100);
  const nowIso = new Date().toISOString();
  petState = { ...(petState || {}), happiness: newHappiness, last_cuddled_at: nowIso, last_interacted_by: currentPerson, updated_at: nowIso };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update({ happiness: newHappiness, last_cuddled_at: nowIso, last_interacted_by: currentPerson, updated_at: nowIso })
    .eq("id", "shared");

  if (error) {
    console.error("Fehler beim Kuscheln:", error);
    return;
  }

  sendAppNotification(supabaseClient, {
    title: "Mochi wurde geknuddelt 🎂",
    body: `${currentPerson} hat Mochi gerade richtig doll gedrückt.`,
    excludePerson: normalizePerson(currentPerson),
    url: "mochi.html"
  });
}

async function performActivity(kind, extraLabel, particleEmojiOverride) {
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

  const newHappiness = clamp(decayedHappiness() + ACTIVITY_HAPPINESS_BOOST, 0, 100);
  const nowIso = new Date().toISOString();
  const activityLog = extraLabel ? `${kind}:${extraLabel}` : kind;
  petState = { ...(petState || {}), happiness: newHappiness, last_activity: activityLog, last_interacted_by: currentPerson, updated_at: nowIso };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update({ happiness: newHappiness, last_activity: activityLog, last_interacted_by: currentPerson, updated_at: nowIso })
    .eq("id", "shared");

  if (error) console.error(`Fehler bei Aktivität (${kind}):`, error);
}

async function toggleSleep() {
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

/* ---------- activity buttons ---------- */

feedBtn.addEventListener("click", () => {
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

showerBtn.addEventListener("click", () => performActivity("shower"));
sportBtn.addEventListener("click", () => performActivity("sport"));
danceBtn.addEventListener("click", () => performActivity("dance"));
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

  const newHappiness = clamp(decayedHappiness() + COFFEE_HAPPINESS_BOOST, 0, 100);
  const nowIso = new Date().toISOString();
  petState = { ...(petState || {}), happiness: newHappiness, last_activity: "coffee", last_interacted_by: currentPerson, updated_at: nowIso };
  render();

  const { error } = await supabaseClient
    .from("pet_state")
    .update({ happiness: newHappiness, last_activity: "coffee", last_interacted_by: currentPerson, updated_at: nowIso })
    .eq("id", "shared");

  if (error) console.error("Fehler beim Kaffeekochen:", error);

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
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  enterCoffeeScene();
});

leaveCoffeeScene.addEventListener("click", exitCoffeeScene);

/* ---------- pointer gestures ---------- */

petCreature.addEventListener("pointerdown", event => {
  petCreature.setPointerCapture(event.pointerId);

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
