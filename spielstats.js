/* Spiele-Statistik: reads every game table and game_plays (the measured play time since 16.11.2026),
   game-stats.js does the counting. */
const GS = GameStats;

const appEl = document.getElementById("gsApp");
const loadingEl = document.getElementById("gsLoading");
const errorEl = document.getElementById("gsError");

const fmt = n => Math.round(n).toLocaleString("de-DE");
const day = iso => new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long" });
const shortDay = iso => new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
/* short label above the highest column: "8,1 Std" or "45 Min" */
const compact = seconds => (seconds >= 3600
  ? `${(seconds / 3600).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std`
  : `${Math.round(seconds / 60)} Min`);
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/* ---------- cards ---------- */

function renderHero(s) {
  document.getElementById("gsHero").innerHTML = `
    <p class="gs-kicker">Zusammen gespielt</p>
    <p class="gs-hero-big">${escapeHtml(GS.formatSeconds(s.totalSeconds))}</p>
    <p class="gs-hero-sub">${s.firstAt ? `seit dem ${escapeHtml(day(s.firstAt))}` : "noch keine Spiele"}</p>
    <div class="gs-stats">
      <div class="gs-stat"><strong>${fmt(s.tables)}</strong><span>Spieltische</span></div>
      <div class="gs-stat"><strong>${fmt(s.played)}</strong><span>Partien &amp; Runden</span></div>
      <div class="gs-stat"><strong>${fmt(s.moves)}</strong><span>Züge</span></div>
    </div>`;
}

/* one series (time per game), bars sorted, the value next to each */
function renderGames(s) {
  const games = s.games.filter(g => g.tables > 0);
  const max = Math.max(1, ...games.map(g => g.seconds));
  const unused = s.games.filter(g => g.tables === 0);
  document.getElementById("gsGames").innerHTML = `
    <h3 class="gs-card-title">🏆 Eure Spiele nach Spielzeit</h3>
    <ol class="gs-games">
      ${games.map((g, i) => `
        <li class="gs-game">
          <div class="gs-game-head">
            <span class="gs-game-name">${i === 0 ? "👑 " : ""}${g.icon} ${escapeHtml(g.name)}</span>
            <span class="gs-game-time">${escapeHtml(GS.formatSeconds(g.seconds))}</span>
          </div>
          <span class="gs-track"><span class="gs-bar" style="width:${(g.seconds / max) * 100}%"></span></span>
          <span class="gs-game-meta">${fmt(g.tables)} ${g.tables === 1 ? "Tisch" : "Tische"} · ${fmt(g.played)} ${escapeHtml(g.unit)} · ${fmt(g.moves)} Züge${g.lastAt ? ` · zuletzt ${escapeHtml(day(g.lastAt))}` : ""}</span>
        </li>`).join("")}
    </ol>
    ${unused.length ? `<p class="gs-sub">Noch nie gespielt: ${unused.map(g => `${g.icon} ${escapeHtml(g.name)}`).join(", ")}</p>` : ""}`;
}

/* two people: a split bar overall, then one per game */
function split(a, b, big) {
  const total = a + b;
  if (!total) return `<div class="gs-split${big ? " big" : ""} empty"><span>noch keine Siege</span></div>`;
  const pa = Math.round((a / total) * 100);
  return `<div class="gs-split${big ? " big" : ""}" role="img" aria-label="Isi ${a} Siege, Benji ${b} Siege">
    ${a ? `<span class="gs-split-a" style="flex-grow:${a}">${big ? "Isi " : ""}${a}</span>` : ""}
    ${b ? `<span class="gs-split-b" style="flex-grow:${b}">${big ? "Benji " : ""}${b}</span>` : ""}
  </div>${big ? `<p class="gs-split-note">Isi ${pa} % · Benji ${100 - pa} %</p>` : ""}`;
}

function renderWins(s) {
  const games = s.games.filter(g => g.wins.Isi + g.wins.Benji > 0);
  const lead = s.wins.Isi === s.wins.Benji ? "Gleichstand 💞" : s.wins.Isi > s.wins.Benji ? "Isi liegt vorn 👑" : "Benji liegt vorn 👑";
  document.getElementById("gsWins").innerHTML = `
    <h3 class="gs-card-title">⚔️ Wer gewinnt? <span class="gs-title-note">${escapeHtml(lead)}</span></h3>
    ${split(s.wins.Isi, s.wins.Benji, true)}
    <ul class="gs-win-list">
      ${games.map(g => `
        <li class="gs-win-row">
          <span class="gs-win-name">${g.icon} ${escapeHtml(g.name)}</span>
          ${split(g.wins.Isi, g.wins.Benji, false)}
        </li>`).join("")}
    </ul>
    <p class="gs-sub">Gezählt sind beendete Partien (bei Cabo ganze Spiele, bei Geo-Guesser und Song-Quiz wer am Ende vorn lag). Siege von Udiou, Klausi und Gästen zählen hier nicht.</p>`;
}

function columns(items, max, peak, labelOf, tipOf) {
  return `<div class="gs-cols">${items.map((item, i) => `
    <button type="button" class="gs-col${i === peak ? " peak" : ""}" aria-label="${escapeHtml(tipOf(item, i))}">
      <span class="gs-col-value">${i === peak ? escapeHtml(compact(item.seconds)) : ""}</span>
      <span class="gs-col-bar" style="height:${item.seconds ? Math.max(4, (item.seconds / max) * 100) : 0}%"></span>
      <span class="gs-col-label">${escapeHtml(labelOf(item, i))}</span>
    </button>`).join("")}</div>`;
}

function wireTips(el, tipEl) {
  const resting = tipEl.textContent;
  el.querySelectorAll(".gs-col").forEach(col => {
    const show = () => { tipEl.textContent = col.getAttribute("aria-label"); };
    col.addEventListener("mouseenter", show);
    col.addEventListener("focus", show);
    col.addEventListener("click", show);
    col.addEventListener("mouseleave", () => { tipEl.textContent = resting; });
    col.addEventListener("blur", () => { tipEl.textContent = resting; });
  });
}

function renderWeeks(s) {
  const el = document.getElementById("gsWeeks");
  const weeks = s.weeks.slice(-12);
  if (!weeks.length) {
    el.classList.add("hidden");
    return;
  }
  const max = Math.max(1, ...weeks.map(w => w.seconds));
  const peak = weeks.reduce((best, w, i) => (w.seconds > weeks[best].seconds ? i : best), 0);
  el.innerHTML = `
    <h3 class="gs-card-title">📈 Spielzeit pro Woche</h3>
    ${columns(weeks, max, peak, w => shortDay(w.week), w => `Woche ab ${day(w.week)}: ${GS.formatSeconds(w.seconds)}`)}
    <p id="gsWeekTip" class="gs-sub" aria-live="polite">Tippe auf eine Woche für die genaue Zeit.</p>`;
  wireTips(el, document.getElementById("gsWeekTip"));
}

function renderDays(s) {
  const el = document.getElementById("gsDays");
  const items = s.weekdays.map(seconds => ({ seconds }));
  const max = Math.max(1, ...s.weekdays);
  const peak = s.weekdays.indexOf(Math.max(...s.weekdays));
  el.innerHTML = `
    <h3 class="gs-card-title">🗓️ An welchen Tagen?</h3>
    ${columns(items, max, peak, (d, i) => WEEKDAYS[i], (d, i) => `${WEEKDAY_NAMES[i]}: ${GS.formatSeconds(d.seconds)}`)}
    <p id="gsDayTip" class="gs-sub" aria-live="polite">${s.totalSeconds ? `Am meisten spielt ihr ${escapeHtml(WEEKDAY_NAMES[peak])}s.` : ""}</p>`;
  wireTips(el, document.getElementById("gsDayTip"));
}

function renderRecords(s) {
  const social = s.games.filter(g => g.tables > 0).sort((a, b) => b.withOthers / b.tables - a.withOthers / a.tables)[0];
  const tile = (icon, label, value, detail) => `
    <div class="card gs-record">
      <span class="gs-record-label">${icon} ${escapeHtml(label)}</span>
      <strong class="gs-record-value">${escapeHtml(value)}</strong>
      <span class="gs-record-detail">${escapeHtml(detail)}</span>
    </div>`;
  document.getElementById("gsRecords").innerHTML = [
    s.longest ? tile("⏱️", "Längster Spieltisch", GS.formatSeconds(s.longest.seconds), `${s.longest.game.name} am ${day(s.longest.startedAt)}`) : "",
    s.busiestWeek ? tile("🔥", "Fleißigste Woche", GS.formatSeconds(s.busiestWeek.seconds), `ab ${day(s.busiestWeek.week)}`) : "",
    social && social.withOthers ? tile("🤖", "Am liebsten mit anderen", social.name, `${social.withOthers} von ${social.tables} Tischen mit Gästen oder Bots`) : "",
    s.tables ? tile("🎲", "Pro Spieltisch", GS.formatSeconds(s.totalSeconds / s.tables), `im Schnitt, ${fmt(s.moves / s.tables)} Züge`) : ""
  ].join("");
}

function renderFoot(s) {
  const parts = [];
  if (s.measuredTables) parts.push(`${fmt(s.measuredTables)} ${s.measuredTables === 1 ? "Spieltisch" : "Spieltische"} genau gemessen${s.measuredSince ? ` (seit ${day(s.measuredSince)})` : ""}`);
  parts.push("ältere Spieltische geschätzt: die Zeit vom Öffnen bis zum letzten Zug, bei tagelang offenen Tischen die Züge mal dem üblichen Tempo des Spiels");
  document.getElementById("gsFoot").textContent = `ℹ️ ${parts.join(" · ")}. Neue Spiele werden ab jetzt genau mitgezählt (Pausen über 5 Minuten nicht).`;
}

/* ---------- data ---------- */

async function loadTable(table) {
  const { data, error } = await supabaseClient.from(table).select("id, status, created_at, updated_at, state");
  if (error) {
    console.warn(`${table} nicht lesbar:`, error.message || error);
    return [];
  }
  return data || [];
}

async function load() {
  try {
    const tables = {};
    const rows = await Promise.all(GS.GAMES.map(g => loadTable(g.table)));
    GS.GAMES.forEach((g, i) => { tables[g.table] = rows[i]; });
    const plays = await supabaseClient.from("game_plays").select("*");
    if (plays.error) console.warn("game_plays nicht lesbar:", plays.error.message || plays.error);
    const s = GS.summarize(tables, plays.error ? [] : plays.data || []);
    renderHero(s);
    renderGames(s);
    renderWins(s);
    renderWeeks(s);
    renderDays(s);
    renderRecords(s);
    renderFoot(s);
    loadingEl.classList.add("hidden");
    appEl.classList.remove("hidden");
  } catch (error) {
    console.error("Spiele-Statistik konnte nicht geladen werden:", error);
    loadingEl.classList.add("hidden");
    errorEl.textContent = "Die Spiele-Statistik konnte gerade nicht geladen werden.";
    errorEl.classList.remove("hidden");
  }
}

load();
