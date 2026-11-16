/* Song-Quiz: a 30-second preview from our Spotify playlist plays on both phones, both pick the song or the
   artist. Rules live in songquiz-engine.js, lobby/sync/versions in game-room.js, the songs in playlist.json
   (kept up to date by .github/workflows/playlist.yml). Two players only (no computer players, no guests). */
const Q = SongQuizEngine;

const boardEl = document.getElementById("sqBoard");
const scoreEl = document.getElementById("sqScore");
const stageEl = document.getElementById("sqStage");
const hintEl = document.getElementById("sqHint");

let pool = null;
let playlistUrl = "https://open.spotify.com/";
let currentGame = null;
let celebrated = null;

/* ---------- the music: one audio element for the whole page ----------
   Phones only play sound after a tap; once the first song was started by hand, the next ones start by
   themselves. The time until my answer counts from when the song really started on this phone. */
const audio = new Audio();
audio.preload = "auto";
let loadedKey = null;
let startedAt = null;
let shownAt = performance.now();
let blocked = false;

function loadSong(key, url) {
  if (loadedKey === key) return;
  loadedKey = key;
  startedAt = null;
  shownAt = performance.now();
  audio.pause();
  if (url) {
    audio.src = url;
    playSong();
  } else {
    audio.removeAttribute("src");
  }
}

function playSong() {
  if (!audio.src) return;
  const attempt = audio.play();
  if (attempt && attempt.catch) {
    attempt.then(() => { blocked = false; paintPlayer(); }).catch(() => { blocked = true; paintPlayer(); });
  }
}

function stopSong() {
  audio.pause();
  loadedKey = null;
}

audio.addEventListener("playing", () => {
  if (startedAt === null) startedAt = performance.now();
  blocked = false;
  paintPlayer();
});
audio.addEventListener("pause", paintPlayer);
audio.addEventListener("ended", paintPlayer);
audio.addEventListener("error", () => { if (audio.getAttribute("src")) paintPlayer(); });
audio.addEventListener("timeupdate", () => {
  const bar = document.getElementById("sqProgress");
  if (bar && audio.duration) bar.style.width = `${Math.min(100, (audio.currentTime / audio.duration) * 100)}%`;
});

/* how long I listened before answering; without sound (blocked, failed) from when the question showed */
const listenedMs = () => Math.round(performance.now() - (startedAt !== null ? startedAt : shownAt));

function paintPlayer() {
  const button = document.getElementById("sqPlay");
  const disc = document.getElementById("sqDisc");
  const note = document.getElementById("sqPlayNote");
  if (!button) return;
  const playing = !audio.paused && !audio.ended;
  const failed = Boolean(audio.error);
  button.textContent = playing ? "⏸" : "▶";
  button.setAttribute("aria-label", playing ? "Pause" : "Abspielen");
  if (disc) disc.classList.toggle("spinning", playing);
  if (note) {
    note.textContent = failed
      ? "Die Hörprobe lädt gerade nicht – raten geht trotzdem."
      : blocked && startedAt === null ? "Tippe auf ▶, um den Song zu hören." : audio.ended ? "Hörprobe zu Ende – nochmal? ▶" : "";
  }
}

/* ---------- room ---------- */

const room = GameRoom.create({
  table: "songquiz_games",
  title: "Song-Quiz",
  icon: "🎧",
  url: "songquiz.html",
  lobbyEl: document.getElementById("sqLobby"),
  boardEl,
  leaveBtn: document.getElementById("sqLeaveBtn"),
  createState: (players, option, carried) => Q.createInitialState(players[0], players[1], pool, option, Math.random, carried && carried.used),
  /* the songs already played go on to the next game */
  carryOver: state => ({ used: Q.memoryOf(state) }),
  maxPlayers: 2,
  invites: false,
  isFinished: () => false,
  startOptions: [
    { value: "mix", label: "Gemischt", hint: "Mal den Song, mal wer singt" },
    { value: "title", label: "Welcher Song?", hint: "Den Titel erraten" },
    { value: "artist", label: "Wer singt?", hint: "Die Künstler erraten" }
  ],
  renderBoard: game => {
    currentGame = game;
    renderQuiz();
  }
});

/* ---------- the playlist ---------- */

async function loadPool() {
  try {
    const res = await fetch("playlist.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    const playlist = await res.json();
    pool = Q.buildPool(playlist);
    if (playlist.url) playlistUrl = playlist.url;
    const problem = Q.poolProblem(pool);
    hintEl.textContent = problem || "";
    hintEl.classList.toggle("hidden", !problem);
  } catch (error) {
    console.error("Playlist konnte nicht geladen werden:", error);
    hintEl.textContent = "Die Playlist konnte nicht geladen werden.";
    hintEl.classList.remove("hidden");
  }
}

/* ---------- pieces ---------- */

const nameFor = (person, me) => (person === me ? "Du" : person);
const songUrl = song => `https://open.spotify.com/track/${encodeURIComponent(song.id)}`;
const keyOf = (game, state) => `${game.id}:${state.round}:${state.index}`;
const seconds = ms => (ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function renderScore(state, me, partner) {
  const lead = Q.leader(state);
  const chip = (name, label) => `<span class="sq-chip${name === me ? " me" : ""}">${lead === name ? "👑 " : ""}${escapeHtml(label)} <strong>${state.scores[name] || 0}</strong></span>`;
  scoreEl.innerHTML = `${chip(me, "Du")}${chip(partner, partner)}<span class="sq-chip">Runde <strong>${state.round}</strong></span>`;
}

function playerHtml(state, revealed) {
  const q = Q.currentQuestion(state);
  const cover = revealed && q.song.cover
    ? `<img src="${escapeHtml(q.song.cover)}" alt="" class="sq-cover" decoding="async">`
    : `<span class="sq-disc-label" aria-hidden="true">?</span>`;
  return `
    <div class="sq-player">
      <div id="sqDisc" class="sq-disc${revealed ? " revealed" : ""}">${cover}</div>
      <div class="sq-player-side">
        <p class="sq-count">Song ${state.index + 1} von ${state.questions.length}</p>
        <div class="sq-controls">
          <button type="button" id="sqPlay" class="sq-play" aria-label="Abspielen">▶</button>
          <div class="sq-track" aria-hidden="true"><span id="sqProgress" class="sq-progress"></span></div>
        </div>
        <p id="sqPlayNote" class="sq-play-note" role="status" aria-live="polite"></p>
      </div>
    </div>`;
}

function wirePlayer() {
  const button = document.getElementById("sqPlay");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!audio.paused && !audio.ended) audio.pause();
    else {
      if (audio.ended) audio.currentTime = 0;
      playSong();
    }
  });
  paintPlayer();
}

const questionText = q => (q.kind === "artist" ? "Wer singt das?" : "Welcher Song ist das?");

/* ---------- screens ---------- */

function renderPlay(game, state, me, partner) {
  const q = Q.currentQuestion(state);
  loadSong(keyOf(game, state), q.song.preview);
  const mine = state.picks[me];

  stageEl.innerHTML = `
    ${playerHtml(state, false)}
    <p class="sq-question">${mine === null ? questionText(q) : "Deine Antwort ist drin ✓"}</p>
    <div class="sq-options" role="group" aria-label="${escapeHtml(questionText(q))}">
      ${q.options.map((label, i) => `<button type="button" class="sq-option${mine && mine.choice === i ? " chosen" : ""}" data-choice="${i}"${mine !== null ? " disabled" : ""}>${escapeHtml(label)}</button>`).join("")}
    </div>
    ${mine !== null ? `<p class="sq-wait">⏳ Warte auf ${escapeHtml(partner)}</p>` : ""}`;
  wirePlayer();

  if (mine !== null) return;
  stageEl.querySelectorAll(".sq-option").forEach(button => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const ms = listenedMs();
      stageEl.querySelectorAll(".sq-option").forEach(b => { b.disabled = true; });
      button.classList.add("chosen");
      if (navigator.vibrate) navigator.vibrate(8);
      room.dispatch(Q.pick, Number(button.dataset.choice), ms);
    });
  });
}

function renderReveal(game, state, me, partner) {
  const q = Q.currentQuestion(state);
  /* the song keeps playing while you look at the answer (a reload starts it again) */
  loadSong(keyOf(game, state), q.song.preview);
  const result = state.answers[state.index];
  const right = person => Q.isRight(state, state.index, person);
  const pickRow = person => {
    const p = result.picks[person];
    const points = result.points[person];
    return `<div class="sq-pick ${right(person) ? "hit" : "miss"}">
      <span class="sq-pick-who">${right(person) ? "✅" : "❌"} ${escapeHtml(nameFor(person, me))}</span>
      <span class="sq-pick-what">${escapeHtml(q.options[p.choice])}</span>
      <span class="sq-pick-time">${seconds(p.ms)} s${result.fastest === person ? " ⚡" : ""}${points ? ` · +${points}` : ""}</span>
    </div>`;
  };

  stageEl.innerHTML = `
    ${playerHtml(state, true)}
    <div class="sq-answer">
      <h2>${escapeHtml(q.song.title)}</h2>
      <p class="sq-answer-artists">${escapeHtml(q.song.artists.join(", "))}${/^\d{4}/.test(q.song.released) ? ` · ${q.song.released.slice(0, 4)}` : ""}</p>
      <a class="sq-spotify" href="${escapeHtml(songUrl(q.song))}" target="_blank" rel="noopener">In Spotify öffnen ↗</a>
    </div>
    <div class="sq-picks">${pickRow(me)}${pickRow(partner)}</div>
    ${result.fastest ? `<p class="sq-bonus">⚡ ${escapeHtml(result.fastest === me ? "Du warst schneller" : `${result.fastest} war schneller`)} – ein Bonuspunkt</p>` : ""}
    <div id="sqNextWrap"></div>`;
  wirePlayer();

  const last = state.index + 1 >= state.questions.length;
  room.renderReady(document.getElementById("sqNextWrap"), state, { label: last ? "Zum Ergebnis ▶" : "Nächster Song ▶", nextFn: Q.advance });

  const cheerKey = keyOf(game, state);
  if (right(me) && celebrated !== cheerKey) {
    celebrated = cheerKey;
    celebrate(result.fastest === me ? 16 : 10);
  }
}

function renderSummary(game, state, me, partner) {
  stopSong();
  const mine = Q.roundScore(state, me);
  const theirs = Q.roundScore(state, partner);
  const headline = mine === theirs
    ? "Unentschieden – ihr kennt eure Playlist gleich gut 💞"
    : mine > theirs ? "Du kennst eure Playlist besser!" : `${partner} kennt eure Playlist besser!`;

  const rows = state.questions.map((q, i) => {
    const mark = person => `<span class="sq-mini">${Q.isRight(state, i, person) ? "✅" : "❌"} ${escapeHtml(nameFor(person, me))}${state.answers[i] && state.answers[i].fastest === person ? " ⚡" : ""}</span>`;
    return `<li class="sq-result">
      ${q.song.cover ? `<img src="${escapeHtml(q.song.cover)}" alt="" loading="lazy" decoding="async">` : `<span class="sq-result-ph" aria-hidden="true">🎵</span>`}
      <div class="sq-result-body">
        <a href="${escapeHtml(songUrl(q.song))}" target="_blank" rel="noopener"><strong>${escapeHtml(q.song.title)}</strong></a>
        <span class="sq-result-artists">${escapeHtml(q.song.artists.join(", "))}</span>
        <div class="sq-result-marks">${mark(me)}${mark(partner)}</div>
      </div>
    </li>`;
  }).join("");

  stageEl.innerHTML = `
    <div class="sq-summary-head">
      <div class="sq-big" aria-hidden="true">${mine === theirs ? "💞" : mine > theirs ? "🏆" : "🥈"}</div>
      <div class="sq-summary-score">Du ${mine} : ${theirs} ${escapeHtml(partner)}</div>
      <p>${escapeHtml(headline)}</p>
      <p class="sq-summary-sub">${state.questions.length} Songs in dieser Runde · <a href="${escapeHtml(playlistUrl)}" target="_blank" rel="noopener">Playlist öffnen ↗</a></p>
    </div>
    <ul class="sq-results">${rows}</ul>
    <div id="sqNextWrap"></div>`;
  room.renderReady(document.getElementById("sqNextWrap"), state, {
    label: "Nächste Runde ▶",
    nextFn: (s, who) => Q.nextRound(s, who, pool)
  });

  const roundKey = `${game.id}:${state.round}:done`;
  if (celebrated !== roundKey) {
    celebrated = roundKey;
    if (mine > theirs) celebrate(16);
  }
}

function renderQuiz() {
  const game = currentGame;
  if (!game || !game.state || !game.state.players) {
    stopSong();
    return;
  }
  const state = game.state;
  const me = room.person;
  const partner = Q.partnerOf(state, me);
  renderScore(state, me, partner);

  if (!Q.isCurrentFormat(state)) {
    stopSong();
    stageEl.innerHTML = `<div class="sq-answer"><h2>Das Song-Quiz hat neue Regeln</h2><p>Beendet diese Runde mit „Spiel beenden“ und startet eine neue.</p></div>`;
    return;
  }
  if (state.phase === "play") renderPlay(game, state, me, partner);
  else if (state.phase === "reveal") renderReveal(game, state, me, partner);
  else renderSummary(game, state, me, partner);
}

/* leaving the board (game ended, back to the lobby) stops the music */
new MutationObserver(() => { if (boardEl.classList.contains("hidden")) stopSong(); }).observe(boardEl, { attributes: true, attributeFilter: ["class"] });

loadPool().finally(() => room.start());
