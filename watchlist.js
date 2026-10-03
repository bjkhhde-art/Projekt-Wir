const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const watchlistList = document.getElementById("watchlistList");
const watchlistFilterButtons = document.querySelectorAll(".watchlist-filter-btn");

const openWatchlistModal = document.getElementById("openWatchlistModal");
const watchlistModal = document.getElementById("watchlistModal");
const closeWatchlistModal = document.getElementById("closeWatchlistModal");
const saveWatchlistBtn = document.getElementById("saveWatchlistBtn");
const watchlistTitleInput = document.getElementById("watchlistTitleInput");
const watchlistTypeInput = document.getElementById("watchlistTypeInput");
const watchlistPlatformInput = document.getElementById("watchlistPlatformInput");
const watchlistAddedByInput = document.getElementById("watchlistAddedByInput");

const MEDIA_LABELS = { film: "🎬 Film", serie: "📺 Serie" };

let watchlistEntries = [];
let currentFilter = "alle";

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

function buildWatchlistCard(entry) {
  const card = document.createElement("div");
  card.className = "watchlist-card card" + (entry.watched ? " watched" : "");
  card.setAttribute("data-reveal", "");

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

  const filtered = watchlistEntries.filter(entry => {
    return currentFilter === "alle" || entry.media_type === currentFilter;
  });

  if (filtered.length === 0) {
    watchlistList.innerHTML = `
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
  watchlistTitleInput.value = "";
  watchlistTypeInput.value = "film";
  watchlistPlatformInput.value = "";
  watchlistModal.classList.remove("hidden");
  watchlistTitleInput.focus();
});

closeWatchlistModal.addEventListener("click", () => {
  watchlistModal.classList.add("hidden");
});

async function saveWatchlistEntry() {
  const title = watchlistTitleInput.value.trim();

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("watchlist")
    .insert({
      title,
      media_type: watchlistTypeInput.value,
      platform: watchlistPlatformInput.value.trim() || null,
      added_by: watchlistAddedByInput.value
    });

  if (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Speichern hat nicht geklappt.", "error");
    return;
  }

  showToast("Zur Watchlist hinzugefügt ✨", "success");
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
