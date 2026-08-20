const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const nextDateCard = document.getElementById("nextDateCard");
const plannedList = document.getElementById("plannedList");
const ideaList = document.getElementById("ideaList");
const historyList = document.getElementById("historyList");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");

const openIdeaModal = document.getElementById("openIdeaModal");
const ideaModal = document.getElementById("ideaModal");
const closeIdeaModal = document.getElementById("closeIdeaModal");
const saveIdeaBtn = document.getElementById("saveIdeaBtn");
const ideaTitleInput = document.getElementById("ideaTitleInput");
const ideaCategoryInput = document.getElementById("ideaCategoryInput");
const ideaNotesInput = document.getElementById("ideaNotesInput");
const ideaAuthorInput = document.getElementById("ideaAuthorInput");

const scheduleModal = document.getElementById("scheduleModal");
const closeScheduleModal = document.getElementById("closeScheduleModal");
const confirmScheduleBtn = document.getElementById("confirmScheduleBtn");
const scheduleDateInput = document.getElementById("scheduleDateInput");

let dateNights = [];
let schedulingId = null;

async function loadDateNights() {
  plannedList.innerHTML = `<div class="skeleton dn-skeleton"></div>`;
  ideaList.innerHTML = `<div class="skeleton dn-skeleton"></div>`;

  const { data, error } = await supabaseClient
    .from("date_nights")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden:", error);
    showToast("Date-Ideen konnten nicht geladen werden.", "error");
    return;
  }

  dateNights = data;
  renderAll();
}

function renderAll() {
  const planned = dateNights
    .filter(d => d.planned_date && !d.done)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date));

  const ideas = dateNights.filter(d => !d.planned_date && !d.done);

  const history = dateNights
    .filter(d => d.done)
    .sort((a, b) => (b.planned_date || b.created_at).localeCompare(a.planned_date || a.created_at));

  renderNextDateCard(planned[0]);
  renderPlanned(planned);
  renderIdeas(ideas);
  renderHistory(history);
}

function countdownText(plannedDate) {
  const days = daysBetween(new Date(), plannedDate);
  if (days < 0) return "überfällig";
  if (days === 0) return "Heute! 🎉";
  if (days === 1) return "Morgen!";
  return `in ${days} Tagen`;
}

function renderNextDateCard(next) {
  if (!next) {
    nextDateCard.classList.remove("filled");
    nextDateCard.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🌙</span>
        <p>Noch kein Date geplant.<br>Wählt eine Idee aus dem Pool und plant sie ein!</p>
      </div>
    `;
    return;
  }

  nextDateCard.classList.add("filled");
  nextDateCard.innerHTML = `
    <span class="next-date-chip chip">Nächstes Date</span>
    <h2 class="next-date-countdown">${countdownText(next.planned_date)}</h2>
    <p class="next-date-title">${escapeHtml(next.title)}</p>
    <p class="next-date-meta">${next.category || ""} · ${formatDate(next.planned_date)}</p>
    ${next.notes ? `<p class="next-date-notes">${escapeHtml(next.notes)}</p>` : ""}
  `;
}

function renderPlanned(planned) {
  plannedList.innerHTML = "";

  if (planned.length === 0) {
    plannedList.innerHTML = `<p class="dn-empty-hint">Noch keine eingeplanten Dates.</p>`;
    return;
  }

  planned.forEach(item => plannedList.appendChild(renderPlannedCard(item)));
}

function renderPlannedCard(item) {
  const card = document.createElement("div");
  card.className = "dn-item card";

  card.innerHTML = `
    <div class="dn-item-main">
      <span class="dn-date-badge chip">${formatDate(item.planned_date)} · ${countdownText(item.planned_date)}</span>
      <h3 class="dn-item-title">${escapeHtml(item.title)}</h3>
      <p class="dn-item-meta">${item.category || ""}${item.added_by ? " · von " + item.added_by : ""}</p>
      ${item.notes ? `<p class="dn-item-notes">${escapeHtml(item.notes)}</p>` : ""}
    </div>
    <div class="dn-item-actions">
      <button class="btn btn-sm btn-secondary reschedule-btn">✏️ Datum ändern</button>
      <button class="btn btn-sm done-btn">✅ Erledigt</button>
      <button class="icon-action delete-dn-btn" title="Löschen">×</button>
    </div>
  `;

  card.querySelector(".reschedule-btn").addEventListener("click", () => openScheduleModal(item));
  card.querySelector(".done-btn").addEventListener("click", () => markDone(item.id, true));
  card.querySelector(".delete-dn-btn").addEventListener("click", () => deleteDateNight(item.id));

  return card;
}

function renderIdeas(ideas) {
  ideaList.innerHTML = "";

  if (ideas.length === 0) {
    ideaList.innerHTML = `<p class="dn-empty-hint">Der Ideen-Pool ist leer. Tippt auf + für die erste Idee.</p>`;
    return;
  }

  ideas.forEach(item => ideaList.appendChild(renderIdeaCard(item)));
}

function renderIdeaCard(item) {
  const card = document.createElement("div");
  card.className = "dn-item card";

  card.innerHTML = `
    <div class="dn-item-main">
      <span class="chip">${item.category || "Sonstiges ✨"}</span>
      <h3 class="dn-item-title">${escapeHtml(item.title)}</h3>
      <p class="dn-item-meta">${item.added_by ? "von " + item.added_by : ""}</p>
      ${item.notes ? `<p class="dn-item-notes">${escapeHtml(item.notes)}</p>` : ""}
    </div>
    <div class="dn-item-actions">
      <button class="btn btn-sm schedule-btn">📅 Einplanen</button>
      <button class="icon-action delete-dn-btn" title="Löschen">×</button>
    </div>
  `;

  card.querySelector(".schedule-btn").addEventListener("click", () => openScheduleModal(item));
  card.querySelector(".delete-dn-btn").addEventListener("click", () => deleteDateNight(item.id));

  return card;
}

function renderHistory(history) {
  historyList.innerHTML = "";

  if (history.length === 0) {
    historyList.innerHTML = `<p class="dn-empty-hint">Noch keine vergangenen Dates.</p>`;
    return;
  }

  history.forEach(item => {
    const row = document.createElement("div");
    row.className = "dn-history-item card";

    row.innerHTML = `
      <div class="dn-item-main">
        <p class="dn-item-title">${escapeHtml(item.title)}</p>
        <p class="dn-item-meta">${item.planned_date ? formatDate(item.planned_date) : ""} ${item.category || ""}</p>
      </div>
      <div class="dn-item-actions">
        <button class="icon-action undo-btn" title="Zurück in Planung">↩️</button>
        <button class="icon-action delete-dn-btn" title="Löschen">×</button>
      </div>
    `;

    row.querySelector(".undo-btn").addEventListener("click", () => markDone(item.id, false));
    row.querySelector(".delete-dn-btn").addEventListener("click", () => deleteDateNight(item.id));

    historyList.appendChild(row);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function saveIdea() {
  const title = ideaTitleInput.value.trim();

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("date_nights")
    .insert({
      title,
      category: ideaCategoryInput.value,
      notes: ideaNotesInput.value.trim() || null,
      added_by: ideaAuthorInput.value,
      planned_date: null,
      done: false
    });

  if (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Idee konnte nicht gespeichert werden.", "error");
    return;
  }

  ideaTitleInput.value = "";
  ideaNotesInput.value = "";
  ideaModal.classList.add("hidden");
  showToast("Idee hinzugefügt 💡", "success");
  await loadDateNights();
}

function openScheduleModal(item) {
  schedulingId = item.id;
  scheduleDateInput.value = item.planned_date || "";
  scheduleModal.classList.remove("hidden");
}

async function confirmSchedule() {
  const date = scheduleDateInput.value;

  if (!date) {
    showToast("Bitte ein Datum wählen.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("date_nights")
    .update({ planned_date: date })
    .eq("id", schedulingId);

  if (error) {
    console.error("Fehler beim Einplanen:", error);
    showToast("Konnte nicht eingeplant werden.", "error");
    return;
  }

  scheduleModal.classList.add("hidden");
  showToast("Date eingeplant 📅", "success");
  celebrate(6);
  await loadDateNights();
}

async function markDone(id, done) {
  const { error } = await supabaseClient
    .from("date_nights")
    .update({ done })
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    showToast("Konnte nicht aktualisiert werden.", "error");
    return;
  }

  if (done) {
    showToast("Date als erledigt markiert ✨", "success");
    celebrate(10);
  }

  await loadDateNights();
}

async function deleteDateNight(id) {
  const confirmed = await confirmDialog("Dieser Eintrag wird endgültig gelöscht.");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("date_nights")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Löschen hat nicht geklappt.", "error");
    return;
  }

  showToast("Eintrag gelöscht.");
  await loadDateNights();
}

openIdeaModal.addEventListener("click", () => {
  ideaModal.classList.remove("hidden");
  ideaTitleInput.focus();
});

closeIdeaModal.addEventListener("click", () => {
  ideaModal.classList.add("hidden");
});

saveIdeaBtn.addEventListener("click", saveIdea);

closeScheduleModal.addEventListener("click", () => {
  scheduleModal.classList.add("hidden");
});

confirmScheduleBtn.addEventListener("click", confirmSchedule);

toggleHistoryBtn.addEventListener("click", () => {
  const hidden = historyList.classList.toggle("hidden");
  toggleHistoryBtn.textContent = hidden ? "Verlauf anzeigen" : "Verlauf ausblenden";
});

loadDateNights();

supabaseClient
  .channel("date_nights_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "date_nights" },
    () => {
      loadDateNights();
    }
  )
  .subscribe();
