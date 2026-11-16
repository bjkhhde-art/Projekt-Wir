/* Playlist Wrapped: our shared Spotify playlist in numbers. The songs come from playlist.json (kept up to
   date by .github/workflows/playlist.yml), the numbers from playlist-stats.js. */
const S = PlaylistStats;

const appEl = document.getElementById("plApp");
const loadingEl = document.getElementById("plLoading");
const errorEl = document.getElementById("plError");

let playlist = null;
let randomSong = null;
const audio = new Audio();
audio.preload = "none";

const songUrl = song => `https://open.spotify.com/track/${encodeURIComponent(song.id)}`;
const artists = song => escapeHtml((song.artists || []).join(", "));
const year = song => (/^\d{4}/.test(song.released || "") ? song.released.slice(0, 4) : "");
const fmt = n => Number(n).toLocaleString("de-DE");
const percent = share => `${Math.round(share * 100)} %`;
const cover = (song, cls) => song.cover
  ? `<img src="${escapeHtml(song.cover)}" alt="" class="${cls}" loading="lazy" decoding="async">`
  : `<span class="${cls} pl-cover-ph" aria-hidden="true">🎵</span>`;

/* ---------- cards ---------- */

function renderHero(stats) {
  const missing = stats.total - stats.count;
  document.getElementById("plHero").innerHTML = `
    <div class="pl-hero-top">
      ${playlist.cover ? `<img src="${escapeHtml(playlist.cover)}" alt="" class="pl-hero-cover" decoding="async">` : ""}
      <div class="pl-hero-text">
        <p class="pl-kicker">Unsere Playlist</p>
        <h2>${escapeHtml(stats.name)}</h2>
        ${playlist.description ? `<p class="pl-hero-desc">${escapeHtml(playlist.description)}</p>` : ""}
      </div>
    </div>
    <div class="pl-stats">
      <div class="pl-stat"><strong>${fmt(stats.total)}</strong><span>Songs</span></div>
      <div class="pl-stat"><strong>${escapeHtml(S.formatDuration(stats.durationMs * (stats.total / Math.max(1, stats.count))))}</strong><span>${stats.complete ? "Spielzeit" : "Spielzeit (ca.)"}</span></div>
      <div class="pl-stat"><strong>${fmt(stats.artistCount)}</strong><span>Künstler</span></div>
    </div>
    ${missing > 0 ? `<p class="pl-note">Ausgewertet sind die ersten ${fmt(stats.count)} der ${fmt(stats.total)} Songs – mehr zeigt Spotify ohne Anmeldung nicht.</p>` : ""}
    <a class="pl-spotify" href="${escapeHtml(playlist.url || "https://open.spotify.com/")}" target="_blank" rel="noopener">In Spotify öffnen ↗</a>`;
}

function renderRandom() {
  const el = document.getElementById("plRandom");
  if (!randomSong) {
    el.classList.add("hidden");
    return;
  }
  const playing = !audio.paused && !audio.ended;
  el.innerHTML = `
    <h3 class="pl-card-title">🎲 Zufallssong</h3>
    <div class="pl-random">
      ${cover(randomSong, "pl-random-cover")}
      <div class="pl-random-text">
        <a href="${escapeHtml(songUrl(randomSong))}" target="_blank" rel="noopener" class="pl-random-title">${escapeHtml(randomSong.title)}</a>
        <span class="pl-random-artists">${artists(randomSong)}${year(randomSong) ? ` · ${year(randomSong)}` : ""}</span>
      </div>
      <button type="button" id="plPlay" class="pl-play" aria-label="${playing ? "Pause" : "Hörprobe abspielen"}">${playing ? "⏸" : "▶"}</button>
    </div>
    <button type="button" id="plNext" class="btn btn-secondary btn-sm pl-next">Noch einer 🎲</button>`;

  document.getElementById("plPlay").addEventListener("click", () => {
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    if (audio.getAttribute("src") !== randomSong.preview) audio.src = randomSong.preview;
    const attempt = audio.play();
    if (attempt && attempt.catch) attempt.catch(() => showToast("Die Hörprobe lässt sich gerade nicht abspielen.", "error"));
  });
  document.getElementById("plNext").addEventListener("click", () => {
    const wasPlaying = !audio.paused && !audio.ended;
    randomSong = S.randomSong(playlist, randomSong.id);
    audio.pause();
    if (wasPlaying && randomSong) {
      audio.src = randomSong.preview;
      audio.play().catch(() => {});
    }
    renderRandom();
  });
}

["play", "pause", "ended"].forEach(type => audio.addEventListener(type, () => {
  const button = document.getElementById("plPlay");
  if (!button) return;
  const playing = !audio.paused && !audio.ended;
  button.textContent = playing ? "⏸" : "▶";
  button.setAttribute("aria-label", playing ? "Pause" : "Hörprobe abspielen");
}));

/* horizontal bars, one series: the length is the count, the number sits next to it */
function renderTop(stats) {
  const max = Math.max(1, ...stats.topArtists.map(a => a.count));
  document.getElementById("plTop").innerHTML = `
    <h3 class="pl-card-title">🎤 Top-Künstler</h3>
    <ol class="pl-bars">
      ${stats.topArtists.map((a, i) => `
        <li class="pl-bar-row" title="${escapeHtml(a.name)}: ${a.count} Songs">
          <span class="pl-bar-name">${i === 0 ? "👑 " : ""}${escapeHtml(a.name)}</span>
          <span class="pl-bar-track"><span class="pl-bar" style="width:${(a.count / max) * 100}%"></span></span>
          <span class="pl-bar-value">${a.count}</span>
        </li>`).join("")}
    </ol>
    <p class="pl-sub">${fmt(stats.features)} von ${fmt(stats.count)} Songs sind Features – da zählt jeder Künstler mit.</p>`;
}

/* columns per release year; tapping a column shows its number */
function renderYears(stats) {
  const el = document.getElementById("plYears");
  if (!stats.years.length) {
    el.classList.add("hidden");
    return;
  }
  const max = Math.max(1, ...stats.years.map(y => y.count));
  const peak = stats.years.reduce((a, b) => (b.count > a.count ? b : a));
  const fresh = stats.freshness;
  el.innerHTML = `
    <h3 class="pl-card-title">📅 Aus welchem Jahr?</h3>
    <div class="pl-cols" role="list">
      ${stats.years.map(y => `
        <button type="button" class="pl-col${y === peak ? " peak" : ""}" role="listitem" aria-label="${escapeHtml(y.older ? `Bis ${y.year}` : String(y.year))}: ${y.count} Songs" data-tip="${y.count} ${y.count === 1 ? "Song" : "Songs"}">
          <span class="pl-col-value">${y === peak ? y.count : ""}</span>
          <span class="pl-col-bar" style="height:${y.count ? Math.max(4, (y.count / max) * 100) : 0}%"></span>
          <span class="pl-col-label">${escapeHtml(y.label)}</span>
        </button>`).join("")}
    </div>
    <p id="plYearTip" class="pl-sub" aria-live="polite">${fresh ? `${percent(fresh.recentShare)} der Songs sind von letztem oder diesem Jahr. Die Hälfte ist von ${fresh.median} oder neuer.` : ""}</p>`;
  const tip = document.getElementById("plYearTip");
  const resting = tip.textContent;
  el.querySelectorAll(".pl-col").forEach(col => {
    const show = () => { tip.textContent = `${col.getAttribute("aria-label").split(":")[0]}: ${col.dataset.tip}`; };
    col.addEventListener("mouseenter", show);
    col.addEventListener("focus", show);
    col.addEventListener("click", show);
    col.addEventListener("mouseleave", () => { tip.textContent = resting; });
    col.addEventListener("blur", () => { tip.textContent = resting; });
  });
}

function renderRecords(stats) {
  const r = stats.records;
  const tile = (icon, label, song, detail) => song ? `
    <a class="card pl-record" href="${escapeHtml(songUrl(song))}" target="_blank" rel="noopener">
      ${cover(song, "pl-record-cover")}
      <span class="pl-record-label">${icon} ${escapeHtml(label)}</span>
      <strong class="pl-record-title">${escapeHtml(song.title)}</strong>
      <span class="pl-record-artists">${artists(song)}</span>
      <span class="pl-record-detail">${escapeHtml(detail)}</span>
    </a>` : "";
  document.getElementById("plRecords").innerHTML = `
    ${tile("🦕", "Ältester Song", r.oldest, r.oldest ? year(r.oldest) : "")}
    ${tile("🐣", "Neuester Song", r.newest, r.newest ? new Date(r.newest.released).toLocaleDateString("de-DE", { month: "long", year: "numeric" }) : "")}
    ${tile("🏃", "Längster Song", r.longest, r.longest ? S.formatClock(r.longest.durationMs) + " Min." : "")}
    ${tile("⚡", "Kürzester Song", r.shortest, r.shortest ? S.formatClock(r.shortest.durationMs) + " Min." : "")}
    ${tile("👯", "Meiste Künstler", r.mostArtists, r.mostArtists ? `${r.mostArtists.artists.length} auf einem Song` : "")}
    <div class="card pl-record pl-record-plain">
      <span class="pl-record-label">⏱️ Im Schnitt</span>
      <strong class="pl-record-big">${escapeHtml(S.formatClock(stats.averageMs))}</strong>
      <span class="pl-record-detail">Minuten pro Song</span>
    </div>`;
}

/* only when playlist.json knows who added what (Spotify keys, see README) */
function renderPeople(stats) {
  const el = document.getElementById("plPeople");
  if (!stats.people) return;
  const [a, b] = stats.people;
  el.classList.remove("hidden");
  const person = p => `
    <div class="pl-person">
      <strong>${escapeHtml(p.name)}</strong>
      <span>${fmt(p.count)} Songs · ${escapeHtml(S.formatDuration(p.durationMs))}</span>
      ${p.topArtist ? `<span>Am liebsten: ${escapeHtml(p.topArtist.name)} (${p.topArtist.count})</span>` : ""}
      ${p.latest ? `<span>Zuletzt: ${escapeHtml(p.latest.title)}</span>` : ""}
    </div>`;
  el.innerHTML = `
    <h3 class="pl-card-title">💞 Wer hat was reingepackt?</h3>
    <div class="pl-split" role="img" aria-label="${escapeHtml(a.name)} ${percent(a.share)}, ${escapeHtml(b.name)} ${percent(b.share)}">
      <span class="pl-split-a" style="flex-grow:${Math.max(a.count, 0.001)}">${escapeHtml(a.name)} ${percent(a.share)}</span>
      <span class="pl-split-b" style="flex-grow:${Math.max(b.count, 0.001)}">${escapeHtml(b.name)} ${percent(b.share)}</span>
    </div>
    <div class="pl-people">${person(a)}${person(b)}</div>`;
}

function renderMonths(stats) {
  const el = document.getElementById("plMonths");
  if (stats.months.length < 2) return;
  el.classList.remove("hidden");
  const max = Math.max(1, ...stats.months.map(m => m.count));
  const label = m => new Date(`${m.month}-01T12:00:00`).toLocaleDateString("de-DE", { month: "short" });
  el.innerHTML = `
    <h3 class="pl-card-title">📈 Neue Songs pro Monat</h3>
    <div class="pl-cols">
      ${stats.months.map(m => `
        <div class="pl-col" title="${escapeHtml(label(m))} ${m.month.slice(0, 4)}: ${m.count} Songs">
          <span class="pl-col-value">${m.count}</span>
          <span class="pl-col-bar" style="height:${Math.max(4, (m.count / max) * 100)}%"></span>
          <span class="pl-col-label">${escapeHtml(label(m))}</span>
        </div>`).join("")}
    </div>`;
}

function render() {
  const stats = S.summarize(playlist);
  randomSong = randomSong || S.randomSong(playlist);
  renderHero(stats);
  renderRandom();
  renderPeople(stats);
  renderTop(stats);
  renderYears(stats);
  renderRecords(stats);
  renderMonths(stats);
  document.getElementById("plFoot").textContent = playlist.updatedAt
    ? `Stand: ${new Date(playlist.updatedAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })} · neue Songs kommen jeden Tag automatisch dazu`
    : "";
  loadingEl.classList.add("hidden");
  appEl.classList.remove("hidden");
}

async function load() {
  try {
    const res = await fetch("playlist.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    playlist = await res.json();
    if (!playlist || !Array.isArray(playlist.tracks) || !playlist.tracks.length) throw new Error("leer");
    render();
  } catch (error) {
    console.error("Playlist konnte nicht geladen werden:", error);
    loadingEl.classList.add("hidden");
    errorEl.textContent = "Die Playlist konnte gerade nicht geladen werden.";
    errorEl.classList.remove("hidden");
  }
}

load();
