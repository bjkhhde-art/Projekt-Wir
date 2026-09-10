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

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const MOOD_LABELS = {
  euphoric: "Überglücklich 🥰",
  happy: "Glücklich 😊",
  neutral: "Ganz okay 😐",
  sad: "Ein bisschen traurig 😢",
  verysad: "Vermisst dich sehr 💔"
};

const MOOD_STATUS = {
  euphoric: "Mochi kuschelt sich glücklich ein.",
  happy: "Mochi freut sich, dass ihr euch kümmert.",
  neutral: "Mochi geht es okay, ein bisschen Zuwendung täte gut.",
  sad: "Mochi vermisst eure Nähe – streichel ihn mal.",
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
const DEFAULT_HAPPINESS = 50;

let petState = null;
let batteryAvg = 50;
let currentPerson = localStorage.getItem("pw_person");
let gestureState = null;
let lastPetTrigger = 0;
let lastCuddleTrigger = 0;

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

  petCreature.className = "pet-creature mood-" + mood;
  moodLabel.textContent = MOOD_LABELS[mood];
  petMouthPath.setAttribute("d", MOOD_MOUTH_PATHS[mood]);

  let statusText = MOOD_STATUS[mood];
  if (petState && (petState.last_petted_at || petState.last_cuddled_at) && petState.last_interacted_by) {
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

/* ---------- heart particles ---------- */

function spawnHeart(large) {
  const heart = document.createElement("span");
  heart.className = "pet-heart-particle";
  heart.textContent = large ? "💖" : ["💗", "💕", "✨"][Math.floor(Math.random() * 3)];
  if (large) heart.style.fontSize = "26px";
  heart.style.setProperty("--drift", Math.round((Math.random() - 0.5) * 60) + "px");
  heart.style.left = 45 + Math.random() * 10 + "%";
  petHearts.appendChild(heart);
  setTimeout(() => heart.remove(), 1200);
}

/* ---------- interactions ---------- */

async function triggerPet() {
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
  if (!requirePerson()) return;

  petCreature.classList.add("hugging");
  vibrate([15, 40, 15, 40, 25]);
  setTimeout(() => petCreature.classList.remove("hugging"), 900);

  const now = Date.now();
  if (now - lastCuddleTrigger < CUDDLE_COOLDOWN_MS) {
    showToast("Mochi ist schon ganz warm gekuschelt – gleich nochmal 💭", "success");
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
    title: "Mochi wurde geknuddelt 🧸",
    body: `${currentPerson} hat Mochi gerade richtig doll gedrückt.`,
    excludePerson: normalizePerson(currentPerson),
    url: "mochi.html"
  });
}

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
