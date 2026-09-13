const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById("heroDays").textContent =
  daysBetween(MILESTONES.anniversary.date) + " 🎉";

const pushModal = document.getElementById("pushModal");
const dismissPushModal = document.getElementById("dismissPushModal");
const pushPersonButtons = document.querySelectorAll(".push-person-btn");

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const dashMochiMood = document.getElementById("dashMochiMood");
const dashMochiFill = document.getElementById("dashMochiFill");

const dashBatteryTile = document.getElementById("dashBatteryTile");
const dashBatteryLabel = document.getElementById("dashBatteryLabel");
const dashBatteryValue = document.getElementById("dashBatteryValue");
const dashBatteryFill = document.getElementById("dashBatteryFill");

const dashTripTile = document.getElementById("dashTripTile");
const dashTripImg = document.getElementById("dashTripImg");
const dashTripTitle = document.getElementById("dashTripTitle");
const dashTripMeta = document.getElementById("dashTripMeta");

const dashQuestionText = document.getElementById("dashQuestionText");
const dashNewQuestionBtn = document.getElementById("dashNewQuestionBtn");

let currentPerson = localStorage.getItem("pw_person");
let dashQuestionPool = [];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* ---------- push modal ---------- */

function maybeShowPushModal() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (localStorage.getItem("pw_push_enabled") === "true") return;

  pushModal.classList.remove("hidden");
}

pushPersonButtons.forEach(button => {
  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      await subscribeToPush(supabaseClient, button.dataset.person);
      showToast("Push-Benachrichtigungen aktiviert 🔔", "success");
      pushModal.classList.add("hidden");
      currentPerson = button.dataset.person;
      loadDashBattery();
    } catch (error) {
      console.error("Fehler beim Aktivieren von Push:", error);
      showToast("Push-Benachrichtigungen konnten nicht aktiviert werden.", "error");
    } finally {
      button.disabled = false;
    }
  });
});

dismissPushModal.addEventListener("click", () => {
  pushModal.classList.add("hidden");
});

maybeShowPushModal();

/* ---------- person modal (for the partner battery tile) ---------- */

personButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentPerson = button.dataset.person;
    localStorage.setItem("pw_person", currentPerson);
    personModal.classList.add("hidden");
    loadDashBattery();
  });
});

dashBatteryTile.addEventListener("click", event => {
  if (!currentPerson) {
    event.preventDefault();
    personModal.classList.remove("hidden");
  }
});

/* ---------- dashboard: Mochi mood ---------- */

function computeDecayedHappiness(petState, batteryAvg) {
  const stored = petState && typeof petState.happiness === "number" ? petState.happiness : 50;
  const lastUpdate = petState && petState.updated_at ? new Date(petState.updated_at).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (Date.now() - lastUpdate) / 3600000);
  const decayPerHour = clamp(3 - (batteryAvg / 100) * 2.5, 0.5, 3);
  return clamp(Math.round(stored - hoursElapsed * decayPerHour), 0, 100);
}

const MOOD_LABELS = {
  euphoric: "Überglücklich 🥰",
  happy: "Glücklich 😊",
  neutral: "Ganz okay 😐",
  sad: "Etwas traurig 😢",
  verysad: "Vermisst uns sehr 💔"
};

function moodTier(happiness) {
  if (happiness >= 80) return "euphoric";
  if (happiness >= 60) return "happy";
  if (happiness >= 40) return "neutral";
  if (happiness >= 20) return "sad";
  return "verysad";
}

async function loadDashMochi() {
  const [petRes, batteryRes] = await Promise.all([
    supabaseClient.from("pet_state").select("*").eq("id", "shared").maybeSingle(),
    supabaseClient.from("cuddle_batteries").select("level")
  ]);

  if (petRes.error) {
    console.error("Fehler beim Laden von Mochi:", petRes.error);
    return;
  }

  let batteryAvg = 50;
  if (!batteryRes.error && batteryRes.data && batteryRes.data.length) {
    batteryAvg = batteryRes.data.reduce((sum, row) => sum + row.level, 0) / batteryRes.data.length;
  }

  const happiness = computeDecayedHappiness(petRes.data, batteryAvg);
  const mood = moodTier(happiness);

  dashMochiMood.textContent = MOOD_LABELS[mood];
  dashMochiFill.style.width = happiness + "%";
  dashMochiFill.style.background =
    happiness >= 60 ? "var(--gradient-brand)" :
    happiness >= 40 ? "var(--gradient-warm)" :
    "linear-gradient(135deg, #f87171, var(--danger))";
}

/* ---------- dashboard: partner's Kuschelbatterie ---------- */

function partnerBatteryPersonName() {
  return currentPerson === "Isi" ? "Benji" : "Isi G";
}

async function loadDashBattery() {
  if (!currentPerson) {
    dashBatteryLabel.textContent = "Kuschelbatterie";
    dashBatteryValue.textContent = "Wer bist du?";
    dashBatteryFill.style.width = "0%";
    return;
  }

  const { data, error } = await supabaseClient
    .from("cuddle_batteries")
    .select("level")
    .eq("person", partnerBatteryPersonName())
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der Kuschelbatterie:", error);
    return;
  }

  const level = data ? Math.round(data.level) : 50;
  const partnerShort = currentPerson === "Isi" ? "Benji" : "Isi";

  dashBatteryLabel.textContent = `Akku von ${partnerShort}`;
  dashBatteryValue.textContent = level + "%";
  dashBatteryFill.style.width = level + "%";
  dashBatteryFill.style.background =
    level <= 20 ? "linear-gradient(180deg, #f87171, var(--danger))" :
    level <= 45 ? "linear-gradient(180deg, #fbbf24, var(--warning))" :
    level <= 75 ? "var(--gradient-warm)" : "var(--gradient-brand)";
}

/* ---------- dashboard: letzte Reise ---------- */

function formatDateRangeShort(start, end) {
  if (!start && !end) return "";
  if (start && !end) return formatDate(start);
  if (!start && end) return formatDate(end);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

async function loadDashTrip() {
  const { data, error } = await supabaseClient
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der letzten Reise:", error);
    return;
  }

  const rows = data || [];
  const pastTrips = rows.filter(trip => !trip.start_date || daysBetween(new Date(), trip.start_date) <= 0);
  const lastTrip = pastTrips[0] || rows[0];

  if (!lastTrip) {
    dashTripTile.classList.add("dash-trip-empty");
    dashTripTitle.textContent = "Noch keine Reise";
    dashTripMeta.textContent = "Wir tragen unsere erste Reise ein";
    dashTripImg.style.display = "none";
    return;
  }

  dashTripTitle.textContent = lastTrip.title;
  const metaParts = [lastTrip.location, formatDateRangeShort(lastTrip.start_date, lastTrip.end_date)].filter(Boolean);
  dashTripMeta.textContent = metaParts.join(" · ");

  if (lastTrip.cover_url) {
    dashTripImg.src = lastTrip.cover_url;
    dashTripImg.style.display = "";
  } else {
    dashTripImg.style.display = "none";
  }
}

/* ---------- dashboard: zufällige Frage ---------- */

async function loadDashQuestion() {
  const { data, error } = await supabaseClient
    .from("questions")
    .select("id, question, category, active");

  if (error) {
    console.error("Fehler beim Laden der Frage:", error);
    dashQuestionText.textContent = "Frage konnte nicht geladen werden.";
    return;
  }

  dashQuestionPool = (data || []).filter(question => question.active !== false);
  showRandomDashQuestion();
}

function showRandomDashQuestion() {
  if (!dashQuestionPool.length) {
    dashQuestionText.textContent = "Noch keine Fragen vorhanden.";
    return;
  }

  const question = dashQuestionPool[Math.floor(Math.random() * dashQuestionPool.length)];
  dashQuestionText.textContent = question.question;
}

dashNewQuestionBtn.addEventListener("click", showRandomDashQuestion);

/* ---------- init ---------- */

loadDashMochi();
loadDashBattery();
loadDashTrip();
loadDashQuestion();
