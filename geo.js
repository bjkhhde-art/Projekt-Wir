/* Geo-Guesser: one trip photo at a time, both pick the trip it was taken on. Rules live in geo-engine.js,
   lobby/sync/versions in game-room.js. Two players only (no computer players, no guests). */
const G = GeoEngine;

const boardEl = document.getElementById("geoBoard");
const scoreEl = document.getElementById("geoScore");
const stageEl = document.getElementById("geoStage");
const hintEl = document.getElementById("geoHint");

const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let pool = null;
let currentGeoGame = null;
let celebrated = null;
/* what only this phone knows: the trip tapped but not yet confirmed */
let selected = { key: null, trip: null };

const room = GameRoom.create({
  table: "geo_games",
  title: "Geo-Guesser",
  icon: "📍",
  url: "geo.html",
  lobbyEl: document.getElementById("geoLobby"),
  boardEl,
  leaveBtn: document.getElementById("geoLeaveBtn"),
  createState: (players, option, carried) => G.createInitialState(players[0], players[1], pool, Math.random, carried && carried.used),
  /* the photos already shown go on to the next game */
  carryOver: state => ({ used: G.memoryOf(state) }),
  maxPlayers: 2,
  invites: false,
  isFinished: () => false,
  renderBoard: game => {
    currentGeoGame = game;
    renderGeo();
  }
});

/* ---------- the trips and their photos ---------- */

async function loadPool() {
  const [trips, images] = await Promise.all([
    client.from("trips").select("id, title, location, start_date"),
    client.from("trip_images").select("id, trip_id, image_url")
  ]);
  if (trips.error || images.error) {
    console.error("Fehler beim Laden der Reisefotos:", trips.error || images.error);
    showToast("Reisefotos konnten nicht geladen werden.", "error");
    return;
  }
  pool = G.buildPool(trips.data, images.data);
  const problem = G.poolProblem(pool);
  hintEl.textContent = problem || "";
  hintEl.classList.toggle("hidden", !problem);
}

/* ---------- pieces ---------- */

const nameFor = (person, me) => (person === me ? "Du" : person);

function renderScore(state, me, partner) {
  const lead = G.leader(state);
  const chip = (name, label) => `<span class="geo-chip${name === me ? " me" : ""}">${lead === name ? "👑 " : ""}${escapeHtml(label)} <strong>${state.scores[name] || 0}</strong></span>`;
  scoreEl.innerHTML = `${chip(me, "Du")}${chip(partner, partner)}<span class="geo-chip">Runde <strong>${state.round}</strong></span>`;
}

function photoHtml(photo, index, total) {
  return `
    <figure class="geo-photo">
      <img src="${escapeHtml(photo.url)}" alt="Reisefoto ${index + 1} von ${total}" decoding="async">
      <figcaption>Foto ${index + 1} von ${total}</figcaption>
    </figure>`;
}

/* "Alicante · Spanien · 2026" – the place and year tell similar trips apart */
function tripLabel(trip) {
  return [trip.title, trip.location && trip.location !== trip.title ? trip.location : "", trip.year].filter(Boolean).join(" · ");
}

/* ---------- screens ---------- */

function renderPlay(game, state, me, partner) {
  const photo = G.currentPhoto(state);
  const key = `${game.id}:${state.round}:${state.index}`;
  if (selected.key !== key) selected = { key, trip: null };
  const mine = state.picks[me];
  const theirs = state.picks[partner] !== null;

  const chosenId = mine !== null ? mine : selected.trip;
  const options = state.trips.map(trip => `<option value="${escapeHtml(trip.id)}"${chosenId === trip.id ? " selected" : ""}>${escapeHtml(tripLabel(trip))}</option>`).join("");

  stageEl.innerHTML = `
    ${photoHtml(photo, state.index, state.photos.length)}
    <p class="geo-question">${mine === null ? "Auf welcher Reise ist dieses Foto entstanden?" : "Dein Tipp ist drin ✓"}</p>
    <select id="geoTrip" class="geo-select" aria-label="Reise auswählen"${mine !== null ? " disabled" : ""}>
      ${mine === null ? `<option value=""${chosenId === null ? " selected" : ""} disabled>Reise auswählen …</option>` : ""}
      ${options}
    </select>
    ${mine === null
      ? `<button type="button" id="geoSubmit" class="btn btn-block"${selected.trip === null ? " disabled" : ""}>Tipp abgeben</button>`
      : `<p class="geo-wait">${theirs ? "…" : `⏳ Warte auf ${escapeHtml(partner)}`}</p>`}`;

  if (mine !== null) return;
  const submit = document.getElementById("geoSubmit");
  document.getElementById("geoTrip").addEventListener("change", event => {
    selected.trip = event.target.value || null;
    submit.disabled = selected.trip === null;
    if (navigator.vibrate) navigator.vibrate(8);
  });
  submit.addEventListener("click", () => {
    if (selected.trip === null || submit.disabled) return;
    submit.disabled = true;
    room.dispatch(G.pick, selected.trip);
  });
}

function renderReveal(game, state, me, partner) {
  const photo = G.currentPhoto(state);
  const right = G.tripById(state, photo.trip);
  const picks = state.answers[state.index];
  const hit = person => picks[person] === photo.trip;
  const pickRow = person => {
    const trip = G.tripById(state, picks[person]);
    return `<div class="geo-pick ${hit(person) ? "hit" : "miss"}">
      <span class="geo-pick-who">${hit(person) ? "✅" : "❌"} ${escapeHtml(nameFor(person, me))}</span>
      <span class="geo-pick-trip">${escapeHtml(trip ? tripLabel(trip) : "?")}</span>
    </div>`;
  };

  stageEl.innerHTML = `
    ${photoHtml(photo, state.index, state.photos.length)}
    <div class="geo-answer">
      <p class="geo-answer-lead">Das war</p>
      <h2>📍 ${escapeHtml(right ? right.title : "?")}</h2>
      ${right && right.location && right.location !== right.title ? `<p class="geo-answer-place">${escapeHtml(right.location)}</p>` : ""}
    </div>
    <div class="geo-picks">${pickRow(me)}${pickRow(partner)}</div>
    <div id="geoNextWrap"></div>`;

  const last = state.index + 1 >= state.photos.length;
  room.renderReady(document.getElementById("geoNextWrap"), state, { label: last ? "Zum Ergebnis ▶" : "Nächstes Foto ▶", nextFn: G.advance });

  const cheerKey = `${key(game, state)}`;
  if (hit(me) && celebrated !== cheerKey) {
    celebrated = cheerKey;
    celebrate(10);
  }
}

const key = (game, state) => `${game.id}:${state.round}:${state.index}`;

function renderSummary(game, state, me, partner) {
  const mine = G.roundScore(state, me);
  const theirs = G.roundScore(state, partner);
  const total = state.photos.length;
  const headline = mine === theirs
    ? "Unentschieden – ihr kennt eure Reisen gleich gut 💞"
    : mine > theirs ? "Du kennst eure Reisen besser!" : `${partner} kennt eure Reisen besser!`;

  const rows = state.photos.map((photo, i) => {
    const trip = G.tripById(state, photo.trip);
    const picks = state.answers[i] || {};
    const mark = person => `<span class="geo-mini ${picks[person] === photo.trip ? "hit" : "miss"}">${picks[person] === photo.trip ? "✅" : "❌"} ${escapeHtml(nameFor(person, me))}</span>`;
    return `<li class="geo-result">
      <img src="${escapeHtml(photo.url)}" alt="" loading="lazy" decoding="async">
      <div class="geo-result-body">
        <strong>${escapeHtml(trip ? trip.title : "?")}</strong>
        <div class="geo-result-marks">${mark(me)}${mark(partner)}</div>
      </div>
    </li>`;
  }).join("");

  stageEl.innerHTML = `
    <div class="geo-summary-head">
      <div class="geo-big" aria-hidden="true">${mine === theirs ? "💞" : mine > theirs ? "🏆" : "🥈"}</div>
      <div class="geo-summary-score">Du ${mine} : ${theirs} ${escapeHtml(partner)}</div>
      <p>${escapeHtml(headline)}</p>
      <p class="geo-summary-sub">${total} Fotos in dieser Runde</p>
    </div>
    <ul class="geo-results">${rows}</ul>
    <div id="geoNextWrap"></div>`;
  room.renderReady(document.getElementById("geoNextWrap"), state, {
    label: "Nächste Runde ▶",
    nextFn: (s, who) => G.nextRound(s, who, pool)
  });

  const roundKey = `${game.id}:${state.round}:done`;
  if (celebrated !== roundKey) {
    celebrated = roundKey;
    if (mine > theirs) celebrate(16);
  }
}

function renderGeo() {
  const game = currentGeoGame;
  if (!game || !game.state || !game.state.players) return;
  const state = game.state;
  const me = room.person;
  const partner = G.partnerOf(state, me);
  renderScore(state, me, partner);

  if (!G.isCurrentFormat(state)) {
    stageEl.innerHTML = `<div class="geo-answer"><h2>Geo-Guesser hat neue Regeln</h2><p>Beendet diese Runde mit „Spiel beenden“ und startet eine neue.</p></div>`;
    return;
  }
  if (state.phase === "play") renderPlay(game, state, me, partner);
  else if (state.phase === "reveal") renderReveal(game, state, me, partner);
  else renderSummary(game, state, me, partner);
}

loadPool().finally(() => room.start());
