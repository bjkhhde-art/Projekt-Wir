const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

animateCountUp(document.getElementById("heroDays"), daysBetween(MILESTONES.anniversary.date), { suffix: " 🎉" });

const DEFAULT_ALICANTE_START = "2026-09-01";
const DEFAULT_ALICANTE_END = "2027-01-24";

const alicantePercent = document.getElementById("alicantePercent");
const alicanteProgressFill = document.getElementById("alicanteProgressFill");
const alicanteDaysLeft = document.getElementById("alicanteDaysLeft");

function renderAlicanteProgress(startDate, endDate) {
  const start = new Date((startDate || DEFAULT_ALICANTE_START) + "T00:00:00");
  const end = new Date((endDate || DEFAULT_ALICANTE_END) + "T00:00:00");
  const now = new Date();

  const totalMs = end - start;
  const elapsedMs = clamp(now - start, 0, totalMs);
  const percent = Math.round((elapsedMs / totalMs) * 100);

  animateCountUp(alicantePercent, percent, { suffix: "%" });
  animateFillOnReveal(alicanteProgressFill, percent);

  if (now < start) {
    const daysUntilStart = Math.ceil((start - now) / 86400000);
    alicanteDaysLeft.textContent = `Isi fliegt in ${daysUntilStart} Tag${daysUntilStart === 1 ? "" : "en"} nach Alicante`;
  } else if (now > end) {
    alicanteDaysLeft.textContent = "Isi ist wieder in Deutschland 🎉";
  } else {
    const daysLeft = Math.ceil((end - now) / 86400000);
    alicanteDaysLeft.textContent = `Noch ${daysLeft} Tag${daysLeft === 1 ? "" : "e"}, bis Isi wieder in Deutschland ist`;
  }
}

async function loadAlicanteProgress() {
  const { data, error } = await supabaseClient
    .from("app_settings")
    .select("alicante_start, alicante_end")
    .eq("id", "shared")
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der Alicante-Daten:", error);
    renderAlicanteProgress();
    return;
  }

  renderAlicanteProgress(data && data.alicante_start, data && data.alicante_end);
}

loadAlicanteProgress();

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

const MOCHI_DECAY_BASE = { hunger: 7, energy: 4.5, cleanliness: 3.5, bond: 5.5 };
const MOCHI_DEFAULT_STAT = 70;

function computeDecayedHappiness(petState, batteryAvg) {
  const lastUpdate = petState && petState.updated_at ? new Date(petState.updated_at).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (Date.now() - lastUpdate) / 3600000);

  const statTotal = Object.keys(MOCHI_DECAY_BASE).reduce((sum, key) => {
    const stored = petState && typeof petState[key] === "number" ? petState[key] : MOCHI_DEFAULT_STAT;
    const base = MOCHI_DECAY_BASE[key];
    const decayRate = clamp(base - (batteryAvg / 100) * (base - base * 0.17), base * 0.17, base);
    return sum + clamp(Math.round(stored - hoursElapsed * decayRate), 0, 100);
  }, 0);

  return Math.round(statTotal / Object.keys(MOCHI_DECAY_BASE).length);
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
  animateFillOnReveal(dashMochiFill, happiness);
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
  animateCountUp(dashBatteryValue, level, { suffix: "%" });
  animateFillOnReveal(dashBatteryFill, level);
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

/* ---------- hero parallax ---------- */

(function initHeroParallax() {
  const heart = document.querySelector(".hero .heart-parallax");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!heart || reduceMotion) return;

  let ticking = false;

  function update() {
    const y = window.scrollY || 0;
    heart.style.transform = `translateY(${y * 0.25}px) scale(${Math.max(0.85, 1 - y / 900)})`;
    heart.style.opacity = String(Math.max(0, 1 - y / 300));
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
})();

/* ---------- Frage des Tages (answered on duo.html) ---------- */

const dashDailyQuestion = document.getElementById("dashDailyQuestion");
const dashDailyStatus = document.getElementById("dashDailyStatus");
const dashDailyStreak = document.getElementById("dashDailyStreak");
const dashDailyCta = document.getElementById("dashDailyCta");
let dashDailyRows = [];

async function loadDashDaily() {
  const { data, error } = await supabaseClient.from("daily_answers").select("day, person").order("day", { ascending: true });
  if (error) {
    console.error("Frage des Tages konnte nicht geladen werden:", error);
    dashDailyStatus.textContent = "";
    return;
  }
  dashDailyRows = data || [];
  renderDashDaily();
}

function renderDashDaily() {
  const today = DuoDaily.dayKey();
  const info = DuoDaily.streakInfo(dashDailyRows, today);
  const me = localStorage.getItem("pw_person");
  const partner = me === "Isi" ? "Benji" : "Isi";
  dashDailyQuestion.textContent = DuoDaily.questionFor(today, DuoContent.DAILY).text;
  dashDailyStreak.textContent = info.current ? `🔥 ${info.current}` : "";
  dashDailyStreak.title = info.record ? `Rekord: ${info.record} Tage` : "";

  const mine = me && info.answeredToday.includes(me);
  const theirs = me && info.answeredToday.includes(partner);
  const [h, m] = DuoDaily.formatCountdown(DuoDaily.secondsLeftToday());
  if (info.doneToday) {
    dashDailyStatus.textContent = "Ihr habt beide geantwortet – schaut euch an, wer richtig lag ✓";
    dashDailyCta.textContent = "Ergebnis ansehen →";
  } else if (mine) {
    dashDailyStatus.textContent = `Du bist fertig – warte auf ${partner}. Noch ${h}:${m} Std.`;
    dashDailyCta.textContent = "Ansehen →";
  } else {
    dashDailyStatus.textContent = theirs
      ? `💌 ${partner} hat schon geantwortet – du bist dran! Noch ${h}:${m} Std.`
      : `Beantwortet sie beide, damit eure Flamme weiterbrennt. Noch ${h}:${m} Std.`;
    dashDailyCta.textContent = "Spiel starten →";
  }
}

setInterval(renderDashDaily, 30000);
supabaseClient
  .channel("dash_daily_answers")
  .on("postgres_changes", { event: "*", schema: "public", table: "daily_answers" }, () => loadDashDaily())
  .subscribe();
loadDashDaily();
