const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const dailyDateLabel = document.getElementById("dailyDateLabel");
const dailyForm = document.getElementById("dailyForm");
const dailyWaiting = document.getElementById("dailyWaiting");
const dailyWaitingText = document.getElementById("dailyWaitingText");
const dailyReveal = document.getElementById("dailyReveal");
const editDailyBtn = document.getElementById("editDailyBtn");
const dailyNoteInput = document.getElementById("dailyNoteInput");
const submitDailyBtn = document.getElementById("submitDailyBtn");
const dailyCommunicationContainer = document.getElementById("dailyCommunicationRating");
const dailyClosenessContainer = document.getElementById("dailyClosenessRating");

const weeklyDateLabel = document.getElementById("weeklyDateLabel");
const weeklyForm = document.getElementById("weeklyForm");
const weeklyWaiting = document.getElementById("weeklyWaiting");
const weeklyWaitingText = document.getElementById("weeklyWaitingText");
const weeklyReveal = document.getElementById("weeklyReveal");
const editWeeklyBtn = document.getElementById("editWeeklyBtn");
const conflictNoBtn = document.getElementById("conflictNoBtn");
const conflictYesBtn = document.getElementById("conflictYesBtn");
const conflictNoteWrap = document.getElementById("conflictNoteWrap");
const conflictNoteInput = document.getElementById("conflictNoteInput");
const weeklyNoteInput = document.getElementById("weeklyNoteInput");
const submitWeeklyBtn = document.getElementById("submitWeeklyBtn");
const weeklyCommunicationContainer = document.getElementById("weeklyCommunicationRating");
const weeklyClosenessContainer = document.getElementById("weeklyClosenessRating");
const weeklyTimeContainer = document.getElementById("weeklyTimeRating");

const historyList = document.getElementById("historyList");

let currentPerson = localStorage.getItem("pw_person");
let dailyRatings = { communication: 0, closeness: 0 };
let weeklyRatings = { communication: 0, closeness: 0, time: 0 };
let weeklyHadConflict = false;
let dailyRows = [];
let weeklyRows = [];

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
    loadAll();
  });
});

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- helpers ---------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function heartsDisplay(value) {
  return "💗".repeat(value) + "🤍".repeat(5 - value);
}

function partnerName() {
  return currentPerson === "Isi" ? "Benji" : "Isi";
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekStartString(date) {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekRange(weekStartStr) {
  const start = new Date(weekStartStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: "2-digit", month: "2-digit" };
  return `${start.toLocaleDateString("de-DE", opts)} – ${end.toLocaleDateString("de-DE", opts)}`;
}

function maybeCelebrate(key, bothDone) {
  if (!bothDone) return;
  const flagKey = "pw_reflection_celebrated_" + key;
  if (localStorage.getItem(flagKey)) return;
  localStorage.setItem(flagKey, "true");
  celebrate(14);
}

/* ---------- rating hearts ---------- */

function buildRatingHearts(container, state, field) {
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rating-heart";
    btn.textContent = "💗";
    btn.dataset.value = String(i);
    btn.addEventListener("click", () => {
      state[field] = i;
      updateRatingHearts(container, i);
    });
    container.appendChild(btn);
  }
}

function updateRatingHearts(container, value) {
  container.querySelectorAll(".rating-heart").forEach(btn => {
    btn.classList.toggle("filled", Number(btn.dataset.value) <= value);
  });
}

buildRatingHearts(dailyCommunicationContainer, dailyRatings, "communication");
buildRatingHearts(dailyClosenessContainer, dailyRatings, "closeness");
buildRatingHearts(weeklyCommunicationContainer, weeklyRatings, "communication");
buildRatingHearts(weeklyClosenessContainer, weeklyRatings, "closeness");
buildRatingHearts(weeklyTimeContainer, weeklyRatings, "time");

function setConflict(value) {
  weeklyHadConflict = value;
  conflictNoBtn.classList.toggle("active", !value);
  conflictYesBtn.classList.toggle("active", value);
  conflictNoteWrap.classList.toggle("hidden", !value);
}

conflictNoBtn.addEventListener("click", () => setConflict(false));
conflictYesBtn.addEventListener("click", () => setConflict(true));

/* ---------- reveal rendering ---------- */

function renderRevealHtml(rows) {
  return rows.map(row => `
    <div class="reveal-person">
      <h3>${row.author}</h3>
      <div class="reveal-row"><span>Kommunikation</span><span class="reveal-hearts">${heartsDisplay(row.communication_rating)}</span></div>
      <div class="reveal-row"><span>Nähe</span><span class="reveal-hearts">${heartsDisplay(row.closeness_rating)}</span></div>
      ${row.time_together_rating ? `<div class="reveal-row"><span>Gemeinsame Zeit</span><span class="reveal-hearts">${heartsDisplay(row.time_together_rating)}</span></div>` : ""}
      ${"had_conflict" in row ? `<p class="reveal-conflict">${row.had_conflict ? "⚡ Es gab einen Konflikt" + (row.conflict_note ? `: ${escapeHtml(row.conflict_note)}` : "") : "✅ Keine Konflikte"}</p>` : ""}
      ${row.note ? `<p class="reveal-note">„${escapeHtml(row.note)}“</p>` : ""}
    </div>
  `).join("");
}

/* ---------- daily ---------- */

async function loadDaily() {
  const today = todayString();
  dailyDateLabel.textContent = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });

  const { data, error } = await supabaseClient.from("daily_reflections").select("*").eq("day", today);
  if (error) {
    console.error("Fehler beim Laden der Tagesreflexion:", error);
    return;
  }
  dailyRows = data || [];
  renderDaily();
  maybeCelebrate("daily_" + today, dailyRows.length >= 2);
}

function renderDaily() {
  const mine = dailyRows.find(r => r.author === currentPerson);
  const bothDone = dailyRows.length >= 2;

  dailyForm.classList.add("hidden");
  dailyWaiting.classList.add("hidden");
  dailyReveal.classList.add("hidden");

  if (bothDone) {
    dailyReveal.classList.remove("hidden");
    dailyReveal.innerHTML = renderRevealHtml(dailyRows);
  } else if (mine) {
    dailyWaiting.classList.remove("hidden");
    dailyWaitingText.textContent = `Danke! Warten auf ${partnerName()}`;
  } else {
    dailyForm.classList.remove("hidden");
    dailyRatings.communication = 0;
    dailyRatings.closeness = 0;
    updateRatingHearts(dailyCommunicationContainer, 0);
    updateRatingHearts(dailyClosenessContainer, 0);
    dailyNoteInput.value = "";
  }
}

submitDailyBtn.addEventListener("click", async () => {
  if (!requirePerson()) return;
  if (dailyRatings.communication === 0 || dailyRatings.closeness === 0) {
    showToast("Bitte beide Bewertungen auswählen.", "error");
    return;
  }

  const payload = {
    day: todayString(),
    author: currentPerson,
    communication_rating: dailyRatings.communication,
    closeness_rating: dailyRatings.closeness,
    note: dailyNoteInput.value.trim() || null
  };

  const { error } = await supabaseClient.from("daily_reflections").upsert(payload, { onConflict: "day,author" });
  if (error) {
    console.error("Fehler beim Speichern der Tagesreflexion:", error);
    showToast("Konnte nicht gespeichert werden.", "error");
    return;
  }

  showToast("Danke für deine Reflexion 💗", "success");
  await loadDaily();
  await loadHistory();
});

editDailyBtn.addEventListener("click", () => {
  const mine = dailyRows.find(r => r.author === currentPerson);
  dailyWaiting.classList.add("hidden");
  dailyForm.classList.remove("hidden");
  if (mine) {
    dailyRatings.communication = mine.communication_rating;
    dailyRatings.closeness = mine.closeness_rating;
    updateRatingHearts(dailyCommunicationContainer, mine.communication_rating);
    updateRatingHearts(dailyClosenessContainer, mine.closeness_rating);
    dailyNoteInput.value = mine.note || "";
  }
});

/* ---------- weekly ---------- */

async function loadWeekly() {
  const weekStart = weekStartString();
  weeklyDateLabel.textContent = formatWeekRange(weekStart);

  const { data, error } = await supabaseClient.from("weekly_reflections").select("*").eq("week_start", weekStart);
  if (error) {
    console.error("Fehler beim Laden der Wochenreflexion:", error);
    return;
  }
  weeklyRows = data || [];
  renderWeekly();
  maybeCelebrate("weekly_" + weekStart, weeklyRows.length >= 2);
}

function renderWeekly() {
  const mine = weeklyRows.find(r => r.author === currentPerson);
  const bothDone = weeklyRows.length >= 2;

  weeklyForm.classList.add("hidden");
  weeklyWaiting.classList.add("hidden");
  weeklyReveal.classList.add("hidden");

  if (bothDone) {
    weeklyReveal.classList.remove("hidden");
    weeklyReveal.innerHTML = renderRevealHtml(weeklyRows);
  } else if (mine) {
    weeklyWaiting.classList.remove("hidden");
    weeklyWaitingText.textContent = `Danke! Warten auf ${partnerName()}`;
  } else {
    weeklyForm.classList.remove("hidden");
    weeklyRatings.communication = 0;
    weeklyRatings.closeness = 0;
    weeklyRatings.time = 0;
    updateRatingHearts(weeklyCommunicationContainer, 0);
    updateRatingHearts(weeklyClosenessContainer, 0);
    updateRatingHearts(weeklyTimeContainer, 0);
    setConflict(false);
    conflictNoteInput.value = "";
    weeklyNoteInput.value = "";
  }
}

submitWeeklyBtn.addEventListener("click", async () => {
  if (!requirePerson()) return;
  if (weeklyRatings.communication === 0 || weeklyRatings.closeness === 0 || weeklyRatings.time === 0) {
    showToast("Bitte alle drei Bewertungen auswählen.", "error");
    return;
  }

  const payload = {
    week_start: weekStartString(),
    author: currentPerson,
    communication_rating: weeklyRatings.communication,
    closeness_rating: weeklyRatings.closeness,
    time_together_rating: weeklyRatings.time,
    had_conflict: weeklyHadConflict,
    conflict_note: weeklyHadConflict ? (conflictNoteInput.value.trim() || null) : null,
    note: weeklyNoteInput.value.trim() || null
  };

  const { error } = await supabaseClient.from("weekly_reflections").upsert(payload, { onConflict: "week_start,author" });
  if (error) {
    console.error("Fehler beim Speichern der Wochenreflexion:", error);
    showToast("Konnte nicht gespeichert werden.", "error");
    return;
  }

  showToast("Danke für eure Wochenreflexion 💗", "success");
  await loadWeekly();
  await loadHistory();
});

editWeeklyBtn.addEventListener("click", () => {
  const mine = weeklyRows.find(r => r.author === currentPerson);
  weeklyWaiting.classList.add("hidden");
  weeklyForm.classList.remove("hidden");
  if (mine) {
    weeklyRatings.communication = mine.communication_rating;
    weeklyRatings.closeness = mine.closeness_rating;
    weeklyRatings.time = mine.time_together_rating;
    updateRatingHearts(weeklyCommunicationContainer, mine.communication_rating);
    updateRatingHearts(weeklyClosenessContainer, mine.closeness_rating);
    updateRatingHearts(weeklyTimeContainer, mine.time_together_rating);
    setConflict(mine.had_conflict);
    conflictNoteInput.value = mine.conflict_note || "";
    weeklyNoteInput.value = mine.note || "";
  }
});

/* ---------- history ---------- */

async function loadHistory() {
  const [dailyHistRes, weeklyHistRes] = await Promise.all([
    supabaseClient.from("daily_reflections").select("*").order("day", { ascending: false }).limit(10),
    supabaseClient.from("weekly_reflections").select("*").order("week_start", { ascending: false }).limit(8)
  ]);

  const dailyHist = dailyHistRes.data || [];
  const weeklyHist = weeklyHistRes.data || [];

  if (dailyHist.length === 0 && weeklyHist.length === 0) {
    historyList.innerHTML = `<p class="history-empty">Noch keine Einträge.</p>`;
    return;
  }

  const items = [];

  dailyHist.forEach(row => {
    items.push({
      date: row.day,
      html: `<div class="history-item">
        <span class="history-item-label">${formatDate(row.day)} · ${row.author}</span>
        <span class="history-item-hearts">${heartsDisplay(row.communication_rating)}</span>
      </div>`
    });
  });

  weeklyHist.forEach(row => {
    items.push({
      date: row.week_start,
      html: `<div class="history-item">
        <span class="history-item-label">Woche ${formatDate(row.week_start)} · ${row.author} 🪞</span>
        <span class="history-item-hearts">${heartsDisplay(row.communication_rating)}</span>
      </div>`
    });
  });

  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  historyList.innerHTML = items.slice(0, 12).map(i => i.html).join("");
}

/* ---------- realtime + init ---------- */

supabaseClient
  .channel("daily_reflections_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "daily_reflections" }, () => {
    loadDaily();
    loadHistory();
  })
  .subscribe();

supabaseClient
  .channel("weekly_reflections_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "weekly_reflections" }, () => {
    loadWeekly();
    loadHistory();
  })
  .subscribe();

async function loadAll() {
  await Promise.all([loadDaily(), loadWeekly(), loadHistory()]);
}

loadAll();
