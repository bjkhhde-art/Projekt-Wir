/* Versus on the questions page: both answer three questions about themselves, then guess the
   other's answers. Rules live in versus-engine.js, lobby/sync/versions in game-room.js. */

const V = VersusEngine;
const talkMode = document.getElementById("talkMode");
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

/* ---------- talk / versus switch ---------- */

function showMode(mode) {
  const versus = mode === "versus";
  talkMode.hidden = versus;
  versusMode.hidden = !versus;
  modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch (error) {
    /* only a convenience */
  }
}

modeButtons.forEach(btn => btn.addEventListener("click", () => showMode(btn.dataset.mode)));

function initialMode() {
  const fromQuery = new URLSearchParams(location.search).get("mode");
  if (fromQuery === "versus" || fromQuery === "talk") return fromQuery;
  try {
    return localStorage.getItem(MODE_KEY) === "versus" ? "versus" : "talk";
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

function answerText(question, value, owner, viewer) {
  if (question.type === "pick") return V.optionLabels(question, owner, viewer)[value];
  if (question.type === "scale") return `${value} von 5`;
  const labels = V.optionLabels(question, owner, viewer);
  return value.map((index, place) => `${place + 1}. ${labels[index]}`).join(" · ");
}

function isComplete(question, value) {
  return value !== null && value !== undefined && V.validAnswer(question, value);
}

/* ---------- drafts: what I am answering or guessing right now (kept across live updates) ---------- */

function draftFor(game, phase) {
  const key = `${game.id}:${game.state.round}:${phase}`;
  if (key !== draftKey) {
    draftKey = key;
    draft = [null, null, null];
  }
  return draft;
}

function setDraft(index, value) {
  draft[index] = value;
  renderVersus();
}

/* ---------- question cards ---------- */

function questionCard(question, index, owner, viewer, value, mode) {
  const labels = V.optionLabels(question, owner, viewer);
  const lead = mode === "guess" ? `<span class="vs-q-lead">${escapeHtml(owner)} über sich</span>` : "";
  let body = "";

  if (question.type === "pick") {
    body = `<div class="vs-pick">${labels.map((label, i) => `
      <button type="button" class="vs-choice${value === i ? " selected" : ""}" data-q="${index}" data-value="${i}">${escapeHtml(label)}</button>`).join("")}</div>`;
  } else if (question.type === "scale") {
    body = `
      <div class="vs-scale">${[1, 2, 3, 4, 5].map(n => `
        <button type="button" class="vs-dot${value === n ? " selected" : ""}" data-q="${index}" data-value="${n}" aria-label="${n} von 5">${n}</button>`).join("")}</div>
      <div class="vs-scale-labels"><span>${escapeHtml(question.low)}</span><span>${escapeHtml(question.high)}</span></div>`;
  } else {
    const order = Array.isArray(value) ? value : [];
    body = `<div class="vs-rank">${labels.map((label, i) => {
      const place = order.indexOf(i);
      return `
        <button type="button" class="vs-rank-item${place >= 0 ? " ranked" : ""}" data-q="${index}" data-rank="${i}">
          <span class="vs-rank-place">${place >= 0 ? place + 1 : ""}</span>${escapeHtml(label)}
        </button>`;
    }).join("")}</div>
    <p class="vs-rank-hint">${order.length === 3 ? "Nochmal tippen zum Ändern" : "Der Reihe nach antippen – Liebstes zuerst"}</p>`;
  }

  return `
    <article class="vs-question card${isComplete(question, value) ? " done" : ""}">
      <div class="vs-q-head"><span class="vs-q-num">${index + 1}/3</span>${lead}</div>
      <h3 class="vs-q-text">${escapeHtml(question.q)}</h3>
      ${body}
    </article>`;
}

function wireCards(questions) {
  vsStage.querySelectorAll("[data-q]").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.q);
      const question = questions[index];
      if (question.type === "rank") {
        /* tap in order of preference; tapping a ranked item takes it back, a full ranking starts over */
        const item = Number(btn.dataset.rank);
        const order = Array.isArray(draft[index]) ? draft[index] : [];
        if (order.length === 3) setDraft(index, [item]);
        else if (order.includes(item)) setDraft(index, order.filter(i => i !== item));
        else setDraft(index, [...order, item]);
      } else {
        setDraft(index, Number(btn.dataset.value));
      }
      if (navigator.vibrate) navigator.vibrate(8);
    });
  });
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

function renderAnswerStage(game, me, partner) {
  const state = game.state;
  if (state.answers[me]) {
    vsStage.innerHTML = waitingCard("✅", "Deine Antworten sind drin", `${partner} beantwortet noch die eigenen Fragen …`);
    return;
  }
  const questions = state.questions[me].map(V.questionById);
  const values = draftFor(game, "answer");
  const ready = questions.every((q, i) => isComplete(q, values[i]));
  vsStage.innerHTML = `
    <h2 class="vs-stage-title">Über dich 🙋</h2>
    <p class="vs-stage-sub">Ehrlich antworten &ndash; ${escapeHtml(partner)} muss gleich raten.</p>
    ${questions.map((q, i) => questionCard(q, i, me, me, values[i], "answer")).join("")}
    <button type="button" id="vsSubmit" class="btn btn-block vs-submit"${ready ? "" : " disabled"}>Antworten abschicken 🔒</button>`;
  wireCards(questions);
  document.getElementById("vsSubmit").addEventListener("click", () => submit("answers", values.slice()));
}

function renderGuessStage(game, me, partner) {
  const state = game.state;
  if (state.guesses[me]) {
    vsStage.innerHTML = waitingCard("🔮", "Deine Tipps sind drin", `${partner} rät noch, was du geantwortet hast …`);
    return;
  }
  const questions = state.questions[partner].map(V.questionById);
  const values = draftFor(game, "guess");
  const ready = questions.every((q, i) => isComplete(q, values[i]));
  vsStage.innerHTML = `
    <h2 class="vs-stage-title">Was hat ${escapeHtml(partner)} gewählt? 🔮</h2>
    <p class="vs-stage-sub">Je näher dran, desto mehr Punkte.</p>
    ${questions.map((q, i) => questionCard(q, i, partner, me, values[i], "guess")).join("")}
    <button type="button" id="vsSubmit" class="btn btn-block vs-submit"${ready ? "" : " disabled"}>Tipps abgeben 🎯</button>`;
  wireCards(questions);
  document.getElementById("vsSubmit").addEventListener("click", () => submit("guesses", values.slice()));
}

function resultList(state, guesser, owner, viewer) {
  const questions = state.questions[owner].map(V.questionById);
  const points = state.results[guesser].points;
  return questions.map((q, i) => {
    const p = points[i];
    const mark = p === 1 ? "✅" : p > 0 ? "🤏" : "❌";
    return `
      <li class="vs-result ${p === 1 ? "hit" : p > 0 ? "close" : "miss"}" style="animation-delay:${i * 180}ms">
        <span class="vs-result-mark">${mark}</span>
        <div class="vs-result-body">
          <div class="vs-result-q">${escapeHtml(q.q)}</div>
          <div class="vs-result-line"><b>${escapeHtml(owner === viewer ? "Du" : owner)}:</b> ${escapeHtml(answerText(q, state.answers[owner][i], owner, viewer))}</div>
          <div class="vs-result-line guess"><b>${escapeHtml(guesser === viewer ? "Dein Tipp" : `Tipp von ${guesser}`)}:</b> ${escapeHtml(answerText(q, state.guesses[guesser][i], owner, viewer))}</div>
        </div>
        <span class="vs-result-points">+${fmtPoints(p)}</span>
      </li>`;
  }).join("");
}

function renderReveal(game, me, partner) {
  const state = game.state;
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
    <button type="button" id="vsNext" class="btn btn-block vs-submit">Nächste Runde ▶</button>`;
  document.getElementById("vsNext").addEventListener("click", () => versusRoom.dispatch(V.nextRound));

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

  const phase = game.state.phase;
  if (phase === "answer") renderAnswerStage(game, me, partner);
  else if (phase === "guess") renderGuessStage(game, me, partner);
  else renderReveal(game, me, partner);
}

/* ---------- submitting + letting the other one know ---------- */

async function submit(kind, values) {
  const me = versusRoom.person;
  await versusRoom.dispatch(kind === "answers" ? V.submitAnswers : V.submitGuesses, values);

  const state = versusRoom.game && versusRoom.game.state;
  if (!state || !state.players) return;
  const done = kind === "answers" ? state.answers[me] : state.guesses[me];
  if (!done) return;

  const partner = V.partnerOf(state, me);
  let body;
  if (kind === "answers") {
    body = state.phase === "guess" ? "Ihr habt beide geantwortet – jetzt wird geraten! 🔮" : `${me} hat geantwortet – du bist dran ⚔️`;
  } else {
    body = state.phase === "reveal" ? "Das Ergebnis ist da – wer kennt wen besser? 🏆" : `${me} hat getippt – jetzt rätst du! 🔮`;
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
