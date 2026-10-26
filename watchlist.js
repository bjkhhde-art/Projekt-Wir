const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const watchlistList = document.getElementById("watchlistList");
const watchlistFilterToggle = document.getElementById("watchlistFilterToggle");
const watchlistFilterPanel = document.getElementById("watchlistFilterPanel");
const watchlistFilterCount = document.getElementById("watchlistFilterCount");
const watchlistFilterReset = document.getElementById("watchlistFilterReset");
const watchlistResultCount = document.getElementById("watchlistResultCount");
const watchlistFilterFrom = document.getElementById("watchlistFilterFrom");
const watchlistFilterTo = document.getElementById("watchlistFilterTo");
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
const watchlistWatchedAtInput = document.getElementById("watchlistWatchedAtInput");
const seenByDateInput = document.getElementById("seenByDateInput");
const watchlistSeriesField = document.getElementById("watchlistSeriesField");
const watchlistWatchingInput = document.getElementById("watchlistWatchingInput");
const watchlistSeriesCounts = document.getElementById("watchlistSeriesCounts");
const watchlistSeasonsInput = document.getElementById("watchlistSeasonsInput");
const watchlistEpisodesInput = document.getElementById("watchlistEpisodesInput");

const MEDIA_LABELS = { film: "🎬 Film", serie: "📺 Serie" };
const MEDIA_ICONS = { film: "🎬", serie: "📺" };
const SEEN_OPEN_KEY = "pw_watchlist_seen_open";
const SEEN_BY_LABELS = { both: "👫 zusammen", Isi: "👤 Isi allein", Benji: "👤 Benji allein" };
const LONG_PRESS_MS = 500;

let watchlistEntries = [];
const FILTERS_KEY = "pw_watchlist_filters";
let filters = loadFilters();
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

/* series we are watching: seasons × episodes per season, ticked episodes stored as "season-episode" */
function episodeKey(season, episode) {
  return `${season}-${episode}`;
}

function seenEpisodes(entry) {
  return new Set(Array.isArray(entry.episodes_seen) ? entry.episodes_seen : []);
}

function totalEpisodes(entry) {
  return (entry.season_count || 0) * (entry.episodes_per_season || 0);
}

function seenEpisodeCount(entry, seen = seenEpisodes(entry)) {
  let count = 0;
  for (let s = 1; s <= entry.season_count; s++) {
    for (let e = 1; e <= entry.episodes_per_season; e++) if (seen.has(episodeKey(s, e))) count++;
  }
  return count;
}

/* the last tick finishes the series: it moves to "Schon gesehen" (together, today – editable by holding the row) */
async function saveEpisodes(entry, seen, finished) {
  const update = { episodes_seen: [...seen] };
  if (finished) {
    update.watched = true;
    update.watching = false;
    update.watched_at = new Date().toISOString();
    update.seen_by = entry.seen_by || "both";
  }
  const { error } = await supabaseClient.from("watchlist").update(update).eq("id", entry.id);

  if (error) {
    console.error("Fehler beim Speichern der Folgen:", error);
    showToast("Folge konnte nicht gespeichert werden.", "error");
    return;
  }

  if (finished) {
    celebrate(8);
    showToast(`Alle Folgen von "${entry.title}" gesehen 🎉`, "success");
  }
  await loadWatchlist();
}

function toggleEpisodes(entry, keys) {
  const seen = seenEpisodes(entry);
  const allSeen = keys.every(key => seen.has(key));
  keys.forEach(key => (allSeen ? seen.delete(key) : seen.add(key)));
  saveEpisodes(entry, seen, seenEpisodeCount(entry, seen) === totalEpisodes(entry));
}

function buildWatchingCard(entry) {
  const card = document.createElement("div");
  card.className = "watchlist-card card";
  card.setAttribute("data-reveal", "");
  attachLongPressToEdit(card, entry);

  const head = document.createElement("div");
  head.className = "watchlist-card-head";
  head.innerHTML = `
    <span class="watchlist-type-badge chip">📺 Läuft gerade</span>
    ${entry.platform ? `<span class="watchlist-platform">▶️ ${escapeHtml(entry.platform)}</span>` : ""}
  `;
  card.appendChild(head);

  const title = document.createElement("h3");
  title.className = "watchlist-title";
  title.textContent = entry.title;
  card.appendChild(title);

  const total = totalEpisodes(entry);
  if (!total) {
    const hint = document.createElement("p");
    hint.className = "watchlist-not-watched-hint";
    hint.textContent = "Halte die Karte gedrückt und trag Staffeln und Folgen ein.";
    card.appendChild(hint);
  } else {
    const count = seenEpisodeCount(entry);
    const progress = document.createElement("div");
    progress.className = "watch-progress";
    progress.innerHTML = `<span>${count} von ${total} Folgen</span><div class="watch-progress-bar"><span style="width:${Math.round(count / total * 100)}%"></span></div>`;
    card.appendChild(progress);

    const seen = seenEpisodes(entry);
    for (let s = 1; s <= entry.season_count; s++) {
      const keys = Array.from({ length: entry.episodes_per_season }, (_, i) => episodeKey(s, i + 1));
      const season = document.createElement("div");
      season.className = "watch-season";

      const seasonHead = document.createElement("div");
      seasonHead.className = "watch-season-head";
      seasonHead.innerHTML = `<span>Staffel ${s}</span>`;
      const allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.className = "watch-season-all";
      allBtn.textContent = keys.every(key => seen.has(key)) ? "Alle abwählen" : "Alle gesehen";
      allBtn.addEventListener("click", () => toggleEpisodes(entry, keys));
      seasonHead.appendChild(allBtn);
      season.appendChild(seasonHead);

      const grid = document.createElement("div");
      grid.className = "watch-episodes";
      keys.forEach((key, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "watch-episode" + (seen.has(key) ? " seen" : "");
        btn.textContent = i + 1;
        btn.title = `Staffel ${s}, Folge ${i + 1}`;
        btn.setAttribute("aria-pressed", String(seen.has(key)));
        btn.addEventListener("click", () => toggleEpisodes(entry, [key]));
        grid.appendChild(btn);
      });
      season.appendChild(grid);
      card.appendChild(season);
    }
  }

  const actions = document.createElement("div");
  actions.className = "watchlist-actions";

  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.className = "btn btn-secondary btn-sm";
  stopBtn.textContent = "⏸️ Zurück auf die Liste";
  stopBtn.addEventListener("click", () => setWatching(entry, false));
  actions.appendChild(stopBtn);

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

async function setWatching(entry, watching) {
  const { error } = await supabaseClient.from("watchlist").update({ watching }).eq("id", entry.id);
  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    showToast("Konnte nicht aktualisiert werden.", "error");
    return;
  }
  await loadWatchlist();
}

/* a series without counts yet asks for them first (the edit form with "gerade" ticked) */
function startWatching(entry) {
  if (totalEpisodes(entry)) {
    setWatching(entry, true);
    return;
  }
  openEditModal(entry);
  watchlistWatchingInput.checked = true;
  updateSeriesFields();
  watchlistSeasonsInput.focus();
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
  if (entry.media_type === "serie") {
    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "btn btn-secondary btn-sm";
    startBtn.textContent = "▶️ Wir schauen gerade";
    startBtn.addEventListener("click", () => startWatching(entry));
    actions.appendChild(startBtn);
  }
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
    if (!WatchlistFilter.matches(entry, filters)) return false;
    if (!search) return true;
    const score = FuzzySearch.score(search, entry.title, entry.platform);
    scores.set(entry.id, score);
    return score > 0;
  });
  const byRelevance = (a, b) => scores.get(b.id) - scores.get(a.id);
  if (search) filtered.sort(byRelevance);

  const filtering = WatchlistFilter.activeCount(filters) > 0;
  renderFilterPanel(filtered.length);

  if (filtered.length === 0) {
    watchlistList.innerHTML = search || filtering
      ? `<div class="watchlist-empty"><p>Nichts gefunden.</p></div>`
      : `
      <div class="watchlist-empty">
        <p>Noch nichts auf der Watchlist.<br>Tippt unten rechts auf + und tragt euren ersten Film oder eure erste Serie ein.</p>
      </div>
    `;
    return;
  }

  const watching = filtered.filter(entry => !entry.watched && entry.watching);
  const open = filtered.filter(entry => !entry.watched && !entry.watching);
  const watched = filtered
    .filter(entry => entry.watched)
    .sort(search ? byRelevance : (a, b) => (b.watched_at || "").localeCompare(a.watched_at || ""));

  if (watching.length > 0) {
    const label = document.createElement("p");
    label.className = "watchlist-section-label";
    label.textContent = `📺 Wir schauen gerade · ${watching.length}`;
    watchlistList.appendChild(label);
    watching.forEach(entry => watchlistList.appendChild(buildWatchingCard(entry)));
  }

  if (open.length > 0) {
    const label = document.createElement("p");
    label.className = "watchlist-section-label";
    label.textContent = `🍿 Noch zu schauen · ${open.length}`;
    watchlistList.appendChild(label);
    open.forEach(entry => watchlistList.appendChild(buildWatchlistCard(entry)));
  }

  if (watched.length > 0) {
    watchlistList.appendChild(buildSeenSection(watched, !!search || filtering));
  }
}

/* ---------- filters: several choices per group, remembered on this phone ---------- */

function loadFilters() {
  try {
    return WatchlistFilter.sanitize(JSON.parse(localStorage.getItem(FILTERS_KEY) || "null"));
  } catch (error) {
    return WatchlistFilter.emptyFilters();
  }
}

function saveFilters() {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch (error) {
    /* only a convenience */
  }
}

function renderFilterPanel(shownCount) {
  const options = WatchlistFilter.options(watchlistEntries);
  watchlistFilterPanel.querySelectorAll(".wl-filter-group").forEach(groupEl => {
    const group = groupEl.dataset.group;
    const selected = filters[group];
    const known = new Set(options[group].map(o => o.value));
    /* a stored choice that no longer exists (e.g. a deleted platform) still shows, so it can be removed */
    const list = [...options[group], ...selected.filter(v => !known.has(v)).map(v => ({ value: v, label: v }))];
    groupEl.querySelector(".wl-chips").innerHTML = list.map(o => `
      <button type="button" class="wl-chip${selected.includes(o.value) ? " selected" : ""}" data-group="${group}" data-value="${escapeHtml(o.value)}" aria-pressed="${selected.includes(o.value)}">
        ${escapeHtml(o.label)}${o.count ? ` <span class="wl-chip-count">${o.count}</span>` : ""}
      </button>`).join("");
  });
  watchlistFilterFrom.value = filters.from;
  watchlistFilterTo.value = filters.to;

  const active = WatchlistFilter.activeCount(filters);
  watchlistFilterCount.textContent = active;
  watchlistFilterCount.classList.toggle("hidden", active === 0);
  watchlistFilterToggle.classList.toggle("active", active > 0);
  watchlistFilterReset.classList.toggle("hidden", active === 0);
  watchlistResultCount.textContent = active || currentSearch.trim()
    ? `${shownCount} von ${watchlistEntries.length}`
    : "";
}

watchlistFilterToggle.addEventListener("click", () => {
  const open = watchlistFilterPanel.hidden;
  watchlistFilterPanel.hidden = !open;
  watchlistFilterToggle.setAttribute("aria-expanded", String(open));
});

watchlistFilterPanel.addEventListener("click", event => {
  const chip = event.target.closest(".wl-chip");
  if (!chip) return;
  const { group, value } = chip.dataset;
  filters[group] = filters[group].includes(value)
    ? filters[group].filter(v => v !== value)
    : [...filters[group], value];
  saveFilters();
  renderWatchlist();
});

[watchlistFilterFrom, watchlistFilterTo].forEach(input => {
  input.addEventListener("change", () => {
    filters.from = watchlistFilterFrom.value;
    filters.to = watchlistFilterTo.value;
    saveFilters();
    renderWatchlist();
  });
});

watchlistFilterReset.addEventListener("click", () => {
  filters = WatchlistFilter.emptyFilters();
  saveFilters();
  renderWatchlist();
});

watchlistSearchInput.addEventListener("input", () => {
  currentSearch = watchlistSearchInput.value;
  renderWatchlist();
});

/* watch dates as the yyyy-mm-dd of a date field, in local time */
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/* a picked day keeps the time of day it had before (or now), so titles watched on the same
   day stay in their order. Returns null for an empty field, false for a day in the future. */
function watchedAtFromDay(day, previousIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return null;
  if (day > dayKey(new Date())) return false;
  const [year, month, date] = day.split("-").map(Number);
  const result = previousIso ? new Date(previousIso) : new Date();
  result.setFullYear(year, month - 1, date);
  return result.toISOString();
}

function prepareDateInput(input, iso) {
  input.max = dayKey(new Date());
  input.value = iso ? dayKey(new Date(iso)) : "";
}

/* marking as watched first asks how (together or one of us alone) and when – today unless changed */
function toggleWatched(entry) {
  if (entry.watched) {
    setWatched(entry, false, null);
    return;
  }
  seenByEntry = entry;
  seenByModalText.textContent = `Wie habt ihr „${entry.title}“ geschaut?`;
  prepareDateInput(seenByDateInput, new Date().toISOString());
  seenByModal.classList.remove("hidden");
}

seenByModal.querySelectorAll(".seen-by-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const entry = seenByEntry;
    const watchedAt = watchedAtFromDay(seenByDateInput.value, null);
    if (watchedAt === false) {
      showToast("Das Datum liegt in der Zukunft 🙂", "error");
      return;
    }
    seenByEntry = null;
    seenByModal.classList.add("hidden");
    if (entry) setWatched(entry, true, btn.dataset.seen, watchedAt);
  });
});

cancelSeenBy.addEventListener("click", () => {
  seenByEntry = null;
  seenByModal.classList.add("hidden");
});

async function setWatched(entry, nextWatched, seenBy, watchedAt) {
  const { error } = await supabaseClient
    .from("watchlist")
    .update({
      watched: nextWatched,
      watching: false,
      ...(nextWatched ? {} : { episodes_seen: [] }),
      watched_at: nextWatched ? watchedAt || new Date().toISOString() : null,
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
  watchlistWatchingInput.checked = false;
  watchlistSeasonsInput.value = "";
  watchlistEpisodesInput.value = "";
  editingSeenBy = null;
  updateSeriesFields();
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
  prepareDateInput(watchlistWatchedAtInput, entry.watched_at);
  watchlistWatchingInput.checked = !!entry.watching;
  watchlistSeasonsInput.value = entry.season_count || "";
  watchlistEpisodesInput.value = entry.episodes_per_season || "";
  renderSeenByChoice();
  updateSeriesFields();
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

/* seasons / episodes only make sense for a series that is not finished yet */
function updateSeriesFields() {
  const entry = editingEntry();
  const finished = !!(entry && entry.watched);
  const show = watchlistTypeInput.value === "serie" && !finished;
  watchlistSeriesField.classList.toggle("hidden", !show);
  watchlistSeriesCounts.classList.toggle("hidden", !show || !watchlistWatchingInput.checked);
}

watchlistWatchingInput.addEventListener("change", updateSeriesFields);
watchlistTitleInput.addEventListener("input", updateDuplicateHint);
watchlistTypeInput.addEventListener("change", () => {
  updateSeriesFields();
  updateDuplicateHint();
});

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
  const entryBefore = editingEntry();
  if (watchlistTypeInput.value === "serie" && !(entryBefore && entryBefore.watched)) {
    const watching = watchlistWatchingInput.checked;
    const seasons = parseInt(watchlistSeasonsInput.value, 10);
    const episodes = parseInt(watchlistEpisodesInput.value, 10);
    if (watching && !(seasons >= 1 && seasons <= 99 && episodes >= 1 && episodes <= 999)) {
      showToast("Bitte Staffeln und Folgen pro Staffel eintragen.", "error");
      return;
    }
    payload.watching = watching;
    if (seasons >= 1 && episodes >= 1) {
      payload.season_count = seasons;
      payload.episodes_per_season = episodes;
      /* ticks outside a shrunken grid fall away */
      payload.episodes_seen = entryBefore
        ? [...seenEpisodes(entryBefore)].filter(key => {
            const [s, e] = key.split("-").map(Number);
            return s <= seasons && e <= episodes;
          })
        : [];
    }
  } else if (watchlistTypeInput.value !== "serie") {
    payload.watching = false;
  }
  if (editingWatchlistId && !watchlistSeenByField.classList.contains("hidden")) {
    payload.seen_by = editingSeenBy;
    /* only a changed day is written; an emptied field keeps the old date */
    const entry = editingEntry();
    const previous = entry && entry.watched_at ? dayKey(new Date(entry.watched_at)) : "";
    if (watchlistWatchedAtInput.value && watchlistWatchedAtInput.value !== previous) {
      const watchedAt = watchedAtFromDay(watchlistWatchedAtInput.value, entry && entry.watched_at);
      if (watchedAt === false) {
        showToast("Das Datum liegt in der Zukunft 🙂", "error");
        return;
      }
      if (watchedAt) payload.watched_at = watchedAt;
    }
  }

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
