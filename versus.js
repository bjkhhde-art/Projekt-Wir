/* Versus on the questions page: both type their own answers and their guesses about the other,
   then each judges the other's guesses on the questions about themselves. Rules live in versus-engine.js, lobby/sync/versions in game-room.js. */

const V = VersusEngine;
const talkMode = document.getElementById("talkMode");
const otherMode = document.getElementById("otherMode");
const versusMode = document.getElementById("versusMode");
const modeButtons = document.querySelectorAll(".mode-btn");
const vsBoard = document.getElementById("vsBoard");
const vsScore = document.getElementById("vsScore");
const vsStage = document.getElementById("vsStage");

const MODE_KEY = "pw_questions_mode";
const VERSUS_URL = "questions.html?mode=versus";

let currentVersusGame = null;
let draftKey = null;
let draft = [];
let celebratedRound = null;

/* ---------- talk / other games (Versus is one of them) ---------- */

const MODES = ["talk", "other", "versus"];

function showMode(mode) {
  talkMode.hidden = mode !== "talk";
  otherMode.hidden = mode !== "other";
  versusMode.hidden = mode !== "versus";
  const tab = mode === "talk" ? "talk" : "other";
  modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === tab));
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch (error) {
    /* only a convenience */
  }
}

document.querySelectorAll(".mode-btn, .other-versus, .vs-back").forEach(btn => btn.addEventListener("click", () => showMode(btn.dataset.mode)));

function initialMode() {
  const fromQuery = new URLSearchParams(location.search).get("mode");
  if (MODES.includes(fromQuery)) return fromQuery;
  try {
    const stored = localStorage.getItem(MODE_KEY);
    return MODES.includes(stored) ? stored : "talk";
  } catch (error) {
    return "talk";
  }
}

/* ---------- room ---------- */

const versusRoom = GameRoom.create({
  table: "versus_games",
  title: "Versus",
  icon: "⚔️",
  url: VERSUS_URL,
  lobbyEl: document.getElementById("vsLobby"),
  boardEl: vsBoard,
  leaveBtn: document.getElementById("vsLeaveBtn"),
  createState: (players, option) => V.createInitialState(players[0], players[1], option),
  maxPlayers: 2,
  invites: false,
  isFinished: () => false,
  renderBoard: game => {
    currentVersusGame = game;
    renderVersus();
  },
  startOptions: [
    { value: "mixed", label: "Gemischt", hint: "Von allem etwas" },
    { value: "alltag", label: "Alltag", hint: "Gewohnheiten & Macken" },
    { value: "essen", label: "Essen & Trinken", hint: "Kaffee, Pizza, Paella" },
    { value: "wir", label: "Wir zwei", hint: "Unsere Beziehung" },
    { value: "freizeit", label: "Freizeit", hint: "Filme, Reisen, Hobbys" },
    { value: "gewagt", label: "Gewagt 🔥", hint: "Nur für uns zwei" }
  ]
});

/* ---------- formatting ---------- */

function fmtPoints(value) {
  return String(value).replace(".", ",");
}

/* the old answer options are only a hint now – everybody types freely */
function hintFor(question, owner, viewer) {
  if (question.type === "scale") return `1 = ${question.low} · 5 = ${question.high}`;
  const labels = V.optionLabels(question, owner, viewer).map(label => label.replace(" (ich)", ""));
  return question.type === "rank" ? `z. B. eine Reihenfolge aus ${labels.join(", ")}` : `z. B. ${labels.join(" oder ")}`;
}

/* ---------- drafts: what I am typing or judging right now (kept across live updates) ---------- */

let stageKey = null;

function draftFor(game, phase, size) {
  const key = `${game.id}:${game.state.round}:${phase}`;
  if (key !== draftKey) {
    draftKey = key;
    draft = Array.from({ length: size }, () => (phase === "judge" ? null : ""));
  }
  return draft;
}

/* ---------- stages ---------- */

function renderScore(state, me, partner) {
  const lead = V.leader(state);
  const player = (name, label) => `
    <div class="vs-player${name === me ? " me" : ""}">
      <span class="vs-player-name">${lead === name ? "👑 " : ""}${escapeHtml(label)}</span>
      <span class="vs-player-points">${fmtPoints(state.scores[name] || 0)}</span>
    </div>`;
  vsScore.innerHTML = `
    ${player(me, "Du")}
    <div class="vs-round">Runde ${state.round}<span>${escapeHtml(V.CATEGORIES[state.category] || "Gemischt")}</span></div>
    ${player(partner, partner)}`;
}

function waitingCard(icon, title, text) {
  return `
    <div class="vs-wait card">
      <div class="vs-wait-icon">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p><span class="gr-spinner"></span> ${escapeHtml(text)}</p>
    </div>`;
}

function partnerStatus(text) {
  return `<p id="vsPartnerStatus" class="vs-partner-status">${escapeHtml(text)}</p>`;
}

/* six cards in the same order on both phones: 1–3 about the first player, 4–6 about the second */
function renderAnswerStage(game, me, partner) {
  const state = game.state;
  const statusText = state.answers[partner] ? `💌 ${partner} ist schon fertig.` : `${partner} tippt noch …`;
  if (state.answers[me]) {
    stageKey = null;
    vsStage.innerHTML = waitingCard("✅", "Deine Antworten sind drin", `${partner} tippt noch …`);
    return;
  }
  /* typing must not be interrupted by live updates: keep the cards, only refresh the status line */
  const key = `${game.id}:${state.round}:answer`;
  if (stageKey === key && document.getElementById("vsPartnerStatus")) {
    document.getElementById("vsPartnerStatus").textContent = statusText;
    return;
  }
  stageKey = key;

  const values = draftFor(game, "answer", 6);
  let number = 0;
  const section = owner => {
    const own = owner === me;
    const cards = state.questions[owner].map(id => {
      const question = V.questionById(id);
      const index = number++;
      return `
        <article class="vs-question card${values[index] ? " done" : ""}" data-card="${index}">
          <div class="vs-q-head"><span class="vs-q-num">${index + 1}/6</span><span class="vs-q-lead">${own ? "Über dich" : `Über ${escapeHtml(owner)}`}</span></div>
          <h3 class="vs-q-text">${escapeHtml(question.q)}</h3>
          <p class="vs-q-hint">${escapeHtml(hintFor(question, owner, me))}</p>
          <input type="text" class="vs-input" data-index="${index}" maxlength="${V.MAX_TEXT}" autocomplete="off"
            placeholder="${own ? "Deine Antwort …" : `Was antwortet ${escapeHtml(owner)}?`}" value="${escapeHtml(values[index]).replace(/"/g, "&quot;")}">
        </article>`;
    }).join("");
    return `
      <h2 class="vs-stage-title">${own ? "Über dich 🙋" : `Über ${escapeHtml(owner)} 🔮`}</h2>
      <p class="vs-stage-sub">${own ? `Ehrlich antworten &ndash; ${escapeHtml(partner)} rät gleichzeitig.` : `Was antwortet ${escapeHtml(owner)}? ${escapeHtml(owner)} entscheidet danach, ob du richtig liegst.`}</p>
      ${cards}`;
  };

  vsStage.innerHTML = `
    ${state.players.map(section).join("")}
    ${partnerStatus(statusText)}
    <button type="button" id="vsSubmit" class="btn btn-block vs-submit">Antworten abschicken 🔒</button>`;

  const submitBtn = document.getElementById("vsSubmit");
  const refresh = () => { submitBtn.disabled = values.some(v => !v.trim()); };
  vsStage.querySelectorAll(".vs-input").forEach(input => {
    input.addEventListener("input", () => {
      values[Number(input.dataset.index)] = input.value;
      input.closest(".vs-question").classList.toggle("done", Boolean(input.value.trim()));
      refresh();
    });
  });
  refresh();
  submitBtn.addEventListener("click", () => {
    const firstOwn = state.players.indexOf(me) * 3;
    const own = values.slice(firstOwn, firstOwn + 3);
    const guesses = values.slice(3 - firstOwn, 6 - firstOwn);
    submit("answers", own, guesses);
  });
}

/* I decide whether my partner's guesses about me were right */
function renderJudgeStage(game, me, partner) {
  const state = game.state;
  stageKey = null;
  if ((state.verdicts || {})[me]) {
    vsStage.innerHTML = waitingCard("⚖️", "Deine Bewertung ist drin", `${partner} bewertet noch deine Tipps …`);
    return;
  }
  const values = draftFor(game, "judge", 3);
  const offset = state.players.indexOf(me) * 3;
  const cards = state.questions[me].map((id, i) => {
    const question = V.questionById(id);
    return `
      <article class="vs-question vs-judge card${values[i] !== null ? " done" : ""}">
        <div class="vs-q-head"><span class="vs-q-num">${offset + i + 1}/6</span><span class="vs-q-lead">Über dich</span></div>
        <h3 class="vs-q-text">${escapeHtml(question.q)}</h3>
        <div class="vs-judge-line"><b>Du:</b> ${escapeHtml(state.answers[me][i])}</div>
        <div class="vs-judge-line guess"><b>Tipp von ${escapeHtml(partner)}:</b> ${escapeHtml(state.guesses[partner][i])}</div>
        <div class="vs-verdict">
          <button type="button" class="vs-verdict-btn right${values[i] === true ? " selected" : ""}" data-i="${i}" data-right="1">✓ Richtig</button>
          <button type="button" class="vs-verdict-btn wrong${values[i] === false ? " selected" : ""}" data-i="${i}" data-right="0">✗ Falsch</button>
        </div>
      </article>`;
  }).join("");

  vsStage.innerHTML = `
    <h2 class="vs-stage-title">Lag ${escapeHtml(partner)} richtig? ⚖️</h2>
    <p class="vs-stage-sub">Du entscheidest bei den Fragen über dich &ndash; ${escapeHtml(partner)} bei den Fragen über ${escapeHtml(partner)}.</p>
    ${cards}
    <button type="button" id="vsSubmit" class="btn btn-block vs-submit"${values.every(v => v !== null) ? "" : " disabled"}>Bewertung abschicken ⚖️</button>`;

  vsStage.querySelectorAll(".vs-verdict-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      values[Number(btn.dataset.i)] = btn.dataset.right === "1";
      if (navigator.vibrate) navigator.vibrate(8);
      renderJudgeStage(game, me, partner);
    });
  });
  document.getElementById("vsSubmit").addEventListener("click", () => submit("verdicts", values.slice()));
}

function resultList(state, guesser, owner, viewer) {
  const questions = state.questions[owner].map(V.questionById);
  const points = state.results[guesser].points;
  return questions.map((q, i) => {
    const hit = points[i] === 1;
    return `
      <li class="vs-result ${hit ? "hit" : "miss"}" style="animation-delay:${i * 180}ms">
        <span class="vs-result-mark">${hit ? "✅" : "❌"}</span>
        <div class="vs-result-body">
          <div class="vs-result-q">${escapeHtml(q.q)}</div>
          <div class="vs-result-line"><b>${escapeHtml(owner === viewer ? "Du" : owner)}:</b> ${escapeHtml(state.answers[owner][i])}</div>
          <div class="vs-result-line guess"><b>${escapeHtml(guesser === viewer ? "Dein Tipp" : `Tipp von ${guesser}`)}:</b> ${escapeHtml(state.guesses[guesser][i])}</div>
        </div>
        <span class="vs-result-points">+${fmtPoints(points[i])}</span>
      </li>`;
  }).join("");
}

function renderReveal(game, me, partner) {
  const state = game.state;
  stageKey = null;
  const mine = state.results[me].total;
  const theirs = state.results[partner].total;
  const headline = mine === theirs
    ? "Unentschieden – ihr kennt euch gleich gut 💞"
    : mine > theirs ? `Du kennst ${partner} diese Runde besser! 🏆` : `${partner} kennt dich diese Runde besser! 🏆`;

  vsStage.innerHTML = `
    <div class="vs-headline card">
      <div class="vs-headline-score"><span>Du ${fmtPoints(mine)}</span><span class="vs-headline-vs">:</span><span>${fmtPoints(theirs)} ${escapeHtml(partner)}</span></div>
      <p>${escapeHtml(headline)}</p>
    </div>
    <h3 class="vs-section-title">Deine Tipps über ${escapeHtml(partner)} · ${fmtPoints(mine)}/3</h3>
    <ul class="vs-results">${resultList(state, me, partner, me)}</ul>
    <h3 class="vs-section-title">${escapeHtml(partner)}s Tipps über dich · ${fmtPoints(theirs)}/3</h3>
    <ul class="vs-results">${resultList(state, partner, me, me)}</ul>
    <div id="vsNextWrap"></div>`;
  const next = versusRoom.renderReady(document.getElementById("vsNextWrap"), state, { label: "Nächste Runde ▶", nextFn: V.nextRound });
  next.id = "vsNext";
  next.classList.add("vs-submit");

  const roundKey = `${game.id}:${state.round}`;
  if (celebratedRound !== roundKey) {
    celebratedRound = roundKey;
    if (mine > theirs || mine === 3) celebrate(mine === 3 ? 30 : 16);
  }
}

function renderVersus() {
  const game = currentVersusGame;
  if (!game || !game.state || !game.state.players) return;
  const me = versusRoom.person;
  const partner = V.partnerOf(game.state, me);
  renderScore(game.state, me, partner);

  if (!V.isCurrentFormat(game.state)) {
    stageKey = null;
    vsStage.innerHTML = `
      <div class="vs-wait card">
        <div class="vs-wait-icon">✍️</div>
        <h3>Versus hat neue Regeln</h3>
        <p>Jetzt tippt ihr eure Antworten selbst ein. Diese Runde läuft noch nach den alten Regeln &ndash; beendet sie unten mit „Spiel beenden" und startet eine neue.</p>
      </div>`;
    return;
  }

  const phase = game.state.phase;
  if (phase === "answer") renderAnswerStage(game, me, partner);
  else if (phase === "judge") renderJudgeStage(game, me, partner);
  else renderReveal(game, me, partner);
}

/* ---------- submitting + letting the other one know ---------- */

async function submit(kind, ...values) {
  const me = versusRoom.person;
  await versusRoom.dispatch(kind === "answers" ? V.submitAnswers : V.submitVerdicts, ...values);

  const state = versusRoom.game && versusRoom.game.state;
  if (!state || !state.players) return;
  const done = kind === "answers" ? state.answers[me] : (state.verdicts || {})[me];
  if (!done) return;

  const partner = V.partnerOf(state, me);
  let body;
  if (kind === "answers") {
    body = state.phase === "judge" ? "Ihr seid beide fertig – jetzt bewertet ihr die Tipps! ⚖️" : `${me} hat getippt – du bist dran ⚔️`;
  } else {
    body = state.phase === "reveal" ? "Das Ergebnis ist da – wer kennt wen besser? 🏆" : `${me} hat bewertet – jetzt bist du dran ⚖️`;
  }
  sendAppNotification(supabaseClient, {
    title: "Versus ⚔️",
    body,
    onlyPerson: normalizePerson(partner),
    category: "games",
    url: VERSUS_URL
  });
}

showMode(initialMode());
versusRoom.start();
