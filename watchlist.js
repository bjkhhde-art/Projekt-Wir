const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const watchlistList = document.getElementById("watchlistList");
const watchlistFilterButtons = document.querySelectorAll(".watchlist-filter-btn");
const watchlistSearchInput = document.getElementById("watchlistSearchInput");

const openWatchlistModal = document.getElementById("openWatchlistModal");
const watchlistModal = document.getElementById("watchlistModal");
const watchlistModalTitle = document.getElementById("watchlistModalTitle");
const closeWatchlistModal = document.getElementById("closeWatchlistModal");
const saveWatchlistBtn = document.getElementById("saveWatchlistBtn");
const watchlistTitleInput = document.getElementById("watchlistTitleInput");
const watchlistTypeInput = document.getElementById("watchlistTypeInput");
const watchlistPlatformInput = document.getElementById("watchlistPlatformInput");
const watchlistAddedByInput = document.getElementById("watchlistAddedByInput");

const MEDIA_LABELS = { film: "🎬 Film", serie: "📺 Serie" };
const LONG_PRESS_MS = 500;

let watchlistEntries = [];
let currentFilter = "alle";
let currentSearch = "";
let editingWatchlistId = null;

async function loadWatchlist() {
  const { data, error } = await supabaseClient
    .from("watchlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Watchlist:", error);
    showToast("Watchlist konnte nicht geladen werden.", "error");
    return;
  }

  watchlistEntries = data || [];
  renderWatchlist();
}

function buildRatingHearts(entry) {
  const container = document.createElement("div");
  container.className = "watchlist-rating-hearts";

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "watchlist-rating-heart" + (entry.rating >= i ? " filled" : "");
    btn.textContent = "💗";
    btn.title = `${i} von 5`;
    btn.addEventListener("click", () => setRating(entry, i));
    container.appendChild(btn);
  }

  return container;
}

function attachLongPressToEdit(card, entry) {
  let pressTimer = null;
  let longPressFired = false;

  function start(event) {
    if (event.target.closest("button")) return;
    longPressFired = false;
    card.classList.add("long-pressing");
    pressTimer = setTimeout(() => {
      longPressFired = true;
      card.classList.remove("long-pressing");
      if (navigator.vibrate) navigator.vibrate(15);
      openEditModal(entry);
    }, LONG_PRESS_MS);
  }

  function cancel() {
    clearTimeout(pressTimer);
    card.classList.remove("long-pressing");
  }

  card.addEventListener("pointerdown", start);
  card.addEventListener("pointerup", cancel);
  card.addEventListener("pointerleave", cancel);
  card.addEventListener("pointercancel", cancel);
  card.addEventListener("click", event => {
    if (longPressFired) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

function buildWatchlistCard(entry) {
  const card = document.createElement("div");
  card.className = "watchlist-card card" + (entry.watched ? " watched" : "");
  card.setAttribute("data-reveal", "");
  attachLongPressToEdit(card, entry);

  const head = document.createElement("div");
  head.className = "watchlist-card-head";
  head.innerHTML = `
    <span class="watchlist-type-badge chip">${MEDIA_LABELS[entry.media_type] || MEDIA_LABELS.film}</span>
    ${entry.platform ? `<span class="watchlist-platform">▶️ ${escapeHtml(entry.platform)}</span>` : ""}
  `;
  card.appendChild(head);

  const title = document.createElement("h3");
  title.className = "watchlist-title";
  title.textContent = entry.title;
  card.appendChild(title);

  if (entry.added_by) {
    const addedBy = document.createElement("p");
    addedBy.className = "watchlist-added-by";
    addedBy.textContent = `Hinzugefügt von ${entry.added_by}`;
    card.appendChild(addedBy);
  }

  if (entry.watched) {
    card.appendChild(buildRatingHearts(entry));
  } else {
    const hint = document.createElement("p");
    hint.className = "watchlist-not-watched-hint";
    hint.textContent = "Noch nicht gesehen – nach dem Schauen gibt's die Bewertung.";
    card.appendChild(hint);
  }

  const actions = document.createElement("div");
  actions.className = "watchlist-actions";

  const watchedBtn = document.createElement("button");
  watchedBtn.type = "button";
  watchedBtn.className = "btn btn-sm" + (entry.watched ? " btn-secondary" : "");
  watchedBtn.textContent = entry.watched ? "↩️ Als ungesehen markieren" : "✅ Als gesehen markieren";
  watchedBtn.addEventListener("click", () => toggleWatched(entry));
  actions.appendChild(watchedBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "watchlist-delete-btn";
  deleteBtn.title = "Löschen";
  deleteBtn.textContent = "🗑️";
  deleteBtn.addEventListener("click", () => deleteEntry(entry));
  actions.appendChild(deleteBtn);

  card.appendChild(actions);

  return card;
}

function renderWatchlist() {
  watchlistList.innerHTML = "";

  const search = currentSearch.trim().toLowerCase();

  const filtered = watchlistEntries.filter(entry => {
    const matchesFilter = currentFilter === "alle" || entry.media_type === currentFilter;
    const matchesSearch = !search ||
      entry.title.toLowerCase().includes(search) ||
      (entry.platform && entry.platform.toLowerCase().includes(search));
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    watchlistList.innerHTML = search || currentFilter !== "alle"
      ? `<div class="watchlist-empty"><p>Nichts gefunden.</p></div>`
      : `
      <div class="watchlist-empty">
        <p>Noch nichts auf der Watchlist.<br>Tippt unten rechts auf + und tragt euren ersten Film oder eure erste Serie ein.</p>
      </div>
    `;
    return;
  }

  const open = filtered.filter(entry => !entry.watched);
  const watched = filtered.filter(entry => entry.watched);

  if (open.length > 0) {
    open.forEach(entry => watchlistList.appendChild(buildWatchlistCard(entry)));
  }

  if (watched.length > 0) {
    const label = document.createElement("p");
    label.className = "watchlist-section-label";
    label.textContent = "Schon gesehen";
    watchlistList.appendChild(label);
    watched.forEach(entry => watchlistList.appendChild(buildWatchlistCard(entry)));
  }
}

watchlistFilterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    watchlistFilterButtons.forEach(b => b.classList.toggle("active", b === btn));
    renderWatchlist();
  });
});

watchlistSearchInput.addEventListener("input", () => {
  currentSearch = watchlistSearchInput.value;
  renderWatchlist();
});

async function toggleWatched(entry) {
  const nextWatched = !entry.watched;

  const { error } = await supabaseClient
    .from("watchlist")
    .update({
      watched: nextWatched,
      watched_at: nextWatched ? new Date().toISOString() : null,
      rating: nextWatched ? entry.rating : null
    })
    .eq("id", entry.id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    showToast("Konnte nicht aktualisiert werden.", "error");
    return;
  }

  if (nextWatched) {
    celebrate(8);
    showToast(`"${entry.title}" als gesehen markiert 🎉`, "success");
  }

  await loadWatchlist();
}

async function setRating(entry, rating) {
  const nextRating = entry.rating === rating ? null : rating;

  const { error } = await supabaseClient
    .from("watchlist")
    .update({ rating: nextRating })
    .eq("id", entry.id);

  if (error) {
    console.error("Fehler beim Bewerten:", error);
    showToast("Bewertung konnte nicht gespeichert werden.", "error");
    return;
  }

  await loadWatchlist();
}

async function deleteEntry(entry) {
  const confirmed = await confirmDialog(`"${entry.title}" wird endgültig von der Watchlist gelöscht.`);
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("watchlist")
    .delete()
    .eq("id", entry.id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Löschen hat nicht geklappt.", "error");
    return;
  }

  showToast("Eintrag gelöscht.");
  await loadWatchlist();
}

openWatchlistModal.addEventListener("click", () => {
  editingWatchlistId = null;
  watchlistModalTitle.textContent = "Neuer Eintrag";
  saveWatchlistBtn.textContent = "Hinzufügen";
  watchlistTitleInput.value = "";
  watchlistTypeInput.value = "film";
  watchlistPlatformInput.value = "";
  watchlistAddedByInput.value = "Isi";
  watchlistModal.classList.remove("hidden");
  watchlistTitleInput.focus();
});

function openEditModal(entry) {
  editingWatchlistId = entry.id;
  watchlistModalTitle.textContent = "Eintrag bearbeiten";
  saveWatchlistBtn.textContent = "Speichern";
  watchlistTitleInput.value = entry.title;
  watchlistTypeInput.value = entry.media_type;
  watchlistPlatformInput.value = entry.platform || "";
  watchlistAddedByInput.value = entry.added_by || "Isi";
  watchlistModal.classList.remove("hidden");
  watchlistTitleInput.focus();
}

closeWatchlistModal.addEventListener("click", () => {
  editingWatchlistId = null;
  watchlistModal.classList.add("hidden");
});

async function saveWatchlistEntry() {
  const title = watchlistTitleInput.value.trim();

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  const payload = {
    title,
    media_type: watchlistTypeInput.value,
    platform: watchlistPlatformInput.value.trim() || null,
    added_by: watchlistAddedByInput.value
  };

  const { error } = editingWatchlistId
    ? await supabaseClient.from("watchlist").update(payload).eq("id", editingWatchlistId)
    : await supabaseClient.from("watchlist").insert(payload);

  if (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Speichern hat nicht geklappt.", "error");
    return;
  }

  showToast(editingWatchlistId ? "Eintrag aktualisiert 💾" : "Zur Watchlist hinzugefügt ✨", "success");
  editingWatchlistId = null;
  watchlistModal.classList.add("hidden");
  await loadWatchlist();
}

saveWatchlistBtn.addEventListener("click", saveWatchlistEntry);

watchlistTitleInput.addEventListener("keydown", event => {
  if (event.key === "Enter") saveWatchlistEntry();
});

loadWatchlist();

supabaseClient
  .channel("watchlist_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "watchlist" }, () => {
    loadWatchlist();
  })
  .subscribe();
