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
const watchlistEditExtras = document.getElementById("watchlistEditExtras");
const watchlistDuplicateHint = document.getElementById("watchlistDuplicateHint");
const watchlistSeenByField = document.getElementById("watchlistSeenByField");
const seenByEditButtons = watchlistSeenByField.querySelectorAll(".seen-by-btn");
const seenByModal = document.getElementById("seenByModal");
const seenByModalText = document.getElementById("seenByModalText");
const cancelSeenBy = document.getElementById("cancelSeenBy");
const watchlistToggleWatchedBtn = document.getElementById("watchlistToggleWatchedBtn");
const watchlistDeleteBtn = document.getElementById("watchlistDeleteBtn");

const MEDIA_LABELS = { film: "🎬 Film", serie: "📺 Serie" };
const MEDIA_ICONS = { film: "🎬", serie: "📺" };
const SEEN_OPEN_KEY = "pw_watchlist_seen_open";
const SEEN_BY_LABELS = { both: "👫 zusammen", Isi: "👤 Isi allein", Benji: "👤 Benji allein" };
const LONG_PRESS_MS = 500;

let watchlistEntries = [];
let currentFilter = "alle";
let currentSearch = "";
let editingWatchlistId = null;
let editingSeenBy = null;
let seenByEntry = null;

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

function buildRatingHearts(entry, compact) {
  const container = document.createElement("div");
  container.className = "watchlist-rating-hearts" + (compact ? " compact" : "");

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
  card.className = "watchlist-card card";
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

  const hint = document.createElement("p");
  hint.className = "watchlist-not-watched-hint";
  hint.textContent = "Noch nicht gesehen – nach dem Schauen gibt's die Bewertung.";
  card.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "watchlist-actions";

  const watchedBtn = document.createElement("button");
  watchedBtn.type = "button";
  watchedBtn.className = "btn btn-sm";
  watchedBtn.textContent = "✅ Als gesehen markieren";
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

/* watched titles: one slim row each – type, title, where/when, rating. Holding the row edits it. */
function buildWatchedRow(entry) {
  const row = document.createElement("div");
  row.className = "watched-row";
  attachLongPressToEdit(row, entry);

  const meta = [SEEN_BY_LABELS[entry.seen_by], entry.platform, entry.watched_at ? `gesehen ${formatDate(entry.watched_at)}` : null].filter(Boolean).join(" · ");
  row.innerHTML = `
    <span class="watched-type" title="${entry.media_type === "serie" ? "Serie" : "Film"}">${MEDIA_ICONS[entry.media_type] || MEDIA_ICONS.film}</span>
    <div class="watched-main">
      <span class="watched-title">${escapeHtml(entry.title)}</span>
      ${meta ? `<span class="watched-meta">${escapeHtml(meta)}</span>` : ""}
    </div>
  `;
  row.appendChild(buildRatingHearts(entry, true));
  return row;
}

function seenSectionOpen() {
  try {
    return localStorage.getItem(SEEN_OPEN_KEY) !== "false";
  } catch (error) {
    return true;
  }
}

function buildSeenSection(watched, forceOpen) {
  const section = document.createElement("section");
  section.className = "watched-section";

  const open = forceOpen || seenSectionOpen();
  const rated = watched.filter(entry => entry.rating);
  const average = rated.length ? (rated.reduce((sum, entry) => sum + entry.rating, 0) / rated.length) : null;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "watched-toggle";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.innerHTML = `
    <span>✅ Schon gesehen <span class="watched-count">${watched.length}</span></span>
    <span class="watched-toggle-side">${average ? `Ø ${average.toFixed(1).replace(".", ",")} 💗 ` : ""}<span class="watched-chevron">⌄</span></span>
  `;

  const list = document.createElement("div");
  list.className = "watched-list card";
  list.hidden = !open;
  watched.forEach(entry => list.appendChild(buildWatchedRow(entry)));

  toggle.addEventListener("click", () => {
    const next = list.hidden;
    list.hidden = !next;
    toggle.setAttribute("aria-expanded", String(next));
    try {
      localStorage.setItem(SEEN_OPEN_KEY, String(next));
    } catch (error) {
      /* only a convenience */
    }
  });

  section.appendChild(toggle);
  section.appendChild(list);
  return section;
}

function renderWatchlist() {
  watchlistList.innerHTML = "";

  const search = currentSearch.trim();

  /* forgiving search (typos, umlauts, word beginnings); best matches first */
  const scores = new Map();
  const filtered = watchlistEntries.filter(entry => {
    if (currentFilter !== "alle" && entry.media_type !== currentFilter) return false;
    if (!search) return true;
    const score = FuzzySearch.score(search, entry.title, entry.platform);
    scores.set(entry.id, score);
    return score > 0;
  });
  const byRelevance = (a, b) => scores.get(b.id) - scores.get(a.id);
  if (search) filtered.sort(byRelevance);

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
  const watched = filtered
    .filter(entry => entry.watched)
    .sort(search ? byRelevance : (a, b) => (b.watched_at || "").localeCompare(a.watched_at || ""));

  if (open.length > 0) {
    const label = document.createElement("p");
    label.className = "watchlist-section-label";
    label.textContent = `🍿 Noch zu schauen · ${open.length}`;
    watchlistList.appendChild(label);
    open.forEach(entry => watchlistList.appendChild(buildWatchlistCard(entry)));
  }

  if (watched.length > 0) {
    watchlistList.appendChild(buildSeenSection(watched, !!search));
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

/* marking as watched first asks how: together or one of us alone */
function toggleWatched(entry) {
  if (entry.watched) {
    setWatched(entry, false, null);
    return;
  }
  seenByEntry = entry;
  seenByModalText.textContent = `Wie habt ihr „${entry.title}“ geschaut?`;
  seenByModal.classList.remove("hidden");
}

seenByModal.querySelectorAll(".seen-by-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const entry = seenByEntry;
    seenByEntry = null;
    seenByModal.classList.add("hidden");
    if (entry) setWatched(entry, true, btn.dataset.seen);
  });
});

cancelSeenBy.addEventListener("click", () => {
  seenByEntry = null;
  seenByModal.classList.add("hidden");
});

async function setWatched(entry, nextWatched, seenBy) {
  const { error } = await supabaseClient
    .from("watchlist")
    .update({
      watched: nextWatched,
      watched_at: nextWatched ? new Date().toISOString() : null,
      rating: nextWatched ? entry.rating : null,
      seen_by: nextWatched ? seenBy : null
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
  watchlistEditExtras.classList.add("hidden");
  watchlistSeenByField.classList.add("hidden");
  editingSeenBy = null;
  updateDuplicateHint();
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
  watchlistToggleWatchedBtn.textContent = entry.watched ? "↩️ Doch noch nicht gesehen" : "✅ Als gesehen markieren";
  watchlistEditExtras.classList.remove("hidden");
  editingSeenBy = entry.seen_by || null;
  watchlistSeenByField.classList.toggle("hidden", !entry.watched);
  renderSeenByChoice();
  updateDuplicateHint();
  watchlistModal.classList.remove("hidden");
  watchlistTitleInput.focus();
}

closeWatchlistModal.addEventListener("click", () => {
  editingWatchlistId = null;
  watchlistModal.classList.add("hidden");
});

/* the same title counts as a duplicate however it is capitalised or spaced (a film and a
   series may share a name). The database enforces the same rule. */
function normalizeTitle(title) {
  return (title || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function findDuplicate(title, mediaType) {
  const key = normalizeTitle(title);
  if (!key) return null;
  return watchlistEntries.find(entry =>
    entry.id !== editingWatchlistId &&
    entry.media_type === mediaType &&
    normalizeTitle(entry.title) === key) || null;
}

function duplicateMessage(entry) {
  const where = entry.watched ? "habt ihr schon gesehen" : "steht schon auf der Watchlist";
  return `„${entry.title}“ ${where} ${entry.media_type === "serie" ? "📺" : "🎬"}`;
}

function updateDuplicateHint() {
  const duplicate = findDuplicate(watchlistTitleInput.value, watchlistTypeInput.value);
  watchlistDuplicateHint.textContent = duplicate ? duplicateMessage(duplicate) : "";
  watchlistDuplicateHint.classList.toggle("hidden", !duplicate);
  saveWatchlistBtn.disabled = !!duplicate;
}

watchlistTitleInput.addEventListener("input", updateDuplicateHint);
watchlistTypeInput.addEventListener("change", updateDuplicateHint);

async function saveWatchlistEntry() {
  const title = watchlistTitleInput.value.trim().replace(/\s+/g, " ");

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  const duplicate = findDuplicate(title, watchlistTypeInput.value);
  if (duplicate) {
    showToast(duplicateMessage(duplicate), "error");
    updateDuplicateHint();
    return;
  }

  const payload = {
    title,
    media_type: watchlistTypeInput.value,
    platform: watchlistPlatformInput.value.trim() || null,
    added_by: watchlistAddedByInput.value
  };
  if (editingWatchlistId && !watchlistSeenByField.classList.contains("hidden")) payload.seen_by = editingSeenBy;

  const { error } = editingWatchlistId
    ? await supabaseClient.from("watchlist").update(payload).eq("id", editingWatchlistId)
    : await supabaseClient.from("watchlist").insert(payload);

  if (error) {
    /* the other phone added the same title a moment ago */
    if (error.code === "23505") {
      showToast(`„${title}“ steht schon auf der Watchlist`, "error");
      await loadWatchlist();
      updateDuplicateHint();
      return;
    }
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

function renderSeenByChoice() {
  seenByEditButtons.forEach(btn => {
    const selected = btn.dataset.seen === editingSeenBy;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-checked", String(selected));
  });
}

/* tapping the selected option again clears it ("not recorded") */
seenByEditButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    editingSeenBy = editingSeenBy === btn.dataset.seen ? null : btn.dataset.seen;
    renderSeenByChoice();
  });
});

function editingEntry() {
  return watchlistEntries.find(entry => entry.id === editingWatchlistId);
}

watchlistToggleWatchedBtn.addEventListener("click", async () => {
  const entry = editingEntry();
  if (!entry) return;
  editingWatchlistId = null;
  watchlistModal.classList.add("hidden");
  await toggleWatched(entry);
});

watchlistDeleteBtn.addEventListener("click", async () => {
  const entry = editingEntry();
  if (!entry) return;
  editingWatchlistId = null;
  watchlistModal.classList.add("hidden");
  await deleteEntry(entry);
});

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
