/* Versus on the questions page, like LovBirdz: one answers, one guesses, the roles swap after
   three questions, and every question is resolved as soon as both have typed. Rules live in versus-engine.js, lobby/sync/versions in game-room.js. */

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

function nameFor(person, me) {
  return person === me ? "Du" : person;
}

/* the old answer options are tappable suggestions – or type something of your own */
function suggestionsFor(question, answerer, viewer) {
  if (question.type === "scale") return ["1", "2", "3", "4", "5"];
  if (question.type === "pick") return V.optionLabels(question, answerer, viewer).map(label => label.replace(" (ich)", ""));
  return [];
}

function hintFor(question, answerer, viewer) {
  if (question.type === "scale") return `1 = ${question.low} · 5 = ${question.high}`;
  if (question.type === "rank") {
    const labels = V.optionLabels(question, answerer, viewer).map(label => label.replace(" (ich)", ""));
    return `Reihenfolge aus ${labels.join(", ")}`;
  }
  return "";
}

/* ---------- what only this phone knows: text being typed, results already seen, role cards seen ---------- */

let stageKey = null;
let typed = { key: null, text: "" };
let seen = { key: null, count: 0 };
const rolesSeen = new Set();

/* ---------- pieces ---------- */

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

/* six steps, the role swap in the middle */
function progressBar(state) {
  const step = i => `<span class="vs-step${i < state.results.length ? " done" : i === state.index ? " now" : ""}${i < V.PER_ROUND ? " first" : " second"}"></span>`;
  const steps = Array.from({ length: V.QUESTIONS_PER_ROUND }, (_, i) => i);
  return `
    <div class="vs-progress" aria-label="Frage ${state.index + 1} von ${V.QUESTIONS_PER_ROUND}">
      ${steps.slice(0, V.PER_ROUND).map(step).join("")}
      <span class="vs-swap" aria-hidden="true">🔄</span>
      ${steps.slice(V.PER_ROUND).map(step).join("")}
    </div>`;
}

function roleBanner(amAnswerer) {
  return `<div class="vs-role ${amAnswerer ? "answer" : "guess"}">${amAnswerer ? "💬 Du bist dran mit Antworten" : "🔮 Du bist dran mit Raten"}</div>`;
}

function questionHead(state, question, roles, me) {
  const amAnswerer = roles.answerer === me;
  return `
    ${roleBanner(amAnswerer)}
    ${progressBar(state)}
    <div class="vs-q-head"><span class="vs-q-num">Frage ${state.index + 1}/${V.QUESTIONS_PER_ROUND}</span><span class="vs-q-lead">${amAnswerer ? "Über dich" : `Was antwortet ${escapeHtml(roles.answerer)}?`}</span></div>
    <h3 class="vs-q-text">${escapeHtml(question.q)}</h3>`;
}

/* ---------- stages ---------- */

function renderRoles(state, me, half, key) {
  const roles = V.rolesAt(state, half * V.PER_ROUND);
  const roleCard = (person, answering) => `
    <div class="vs-role-card ${answering ? "answer" : "guess"}">
      <span class="vs-role-name">${escapeHtml(person === me ? `${person} (du)` : person)}</span>
      <span class="vs-role-text">${person === me ? "Du bist" : `${escapeHtml(person)} ist`} dran mit ${answering ? "Antworten" : "Raten"}</span>
      <span class="vs-role-icon" aria-hidden="true">${answering ? "💬" : "🔮"}</span>
    </div>`;
  vsStage.innerHTML = `
    <h2 class="vs-stage-title vs-roles-title">${half === 0 ? "❗ Rollenverteilung" : "🔄 Rollenwechsel"}</h2>
    <div class="vs-roles">
      ${roleCard(roles.answerer, true)}
      ${roleCard(roles.guesser, false)}
    </div>
    <button type="button" id="vsRolesGo" class="btn btn-block vs-submit">Los geht's ▶</button>`;
  document.getElementById("vsRolesGo").addEventListener("click", () => {
    rolesSeen.add(key);
    renderVersus();
  });
}

function renderInput(game, state, me, partner) {
  const roles = V.rolesAt(state);
  const amAnswerer = roles.answerer === me;
  const mine = state.current[amAnswerer ? "answer" : "guess"];
  const theirs = state.current[amAnswerer ? "guess" : "answer"];
  const question = V.questionById(state.questions[state.index]);
  const statusText = theirs !== null ? `💌 ${partner} ist schon fertig.` : `${partner} tippt noch …`;

  if (mine !== null) {
    stageKey = null;
    vsStage.innerHTML = `
      <div class="vs-question card">
        ${questionHead(state, question, roles, me)}
        <div class="vs-judge-line"><b>${amAnswerer ? "Deine Antwort" : "Dein Tipp"}:</b> ${escapeHtml(mine)}</div>
      </div>
      ${waitingCard("⏳", "Eingeloggt!", amAnswerer ? `${partner} rät noch, was du geantwortet hast …` : `${partner} antwortet noch …`)}`;
    return;
  }

  /* typing must not be interrupted by live updates: keep the card, only refresh the status line */
  const key = `${game.id}:${state.round}:${state.index}`;
  if (stageKey === key && document.getElementById("vsPartnerStatus")) {
    document.getElementById("vsPartnerStatus").textContent = statusText;
    return;
  }
  stageKey = key;
  if (typed.key !== key) typed = { key, text: "" };

  const hint = hintFor(question, roles.answerer, me);
  const chips = suggestionsFor(question, roles.answerer, me);
  vsStage.innerHTML = `
    <div class="vs-question card">
      ${questionHead(state, question, roles, me)}
      ${hint ? `<p class="vs-q-hint">${escapeHtml(hint)}</p>` : ""}
      ${chips.length ? `<div class="vs-chips">${chips.map(c => `<button type="button" class="vs-chip" data-text="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}</div>` : ""}
      <input type="text" id="vsInput" class="vs-input" maxlength="${V.MAX_TEXT}" autocomplete="off"
        placeholder="${amAnswerer ? "Deine Antwort …" : `Was antwortet ${escapeHtml(partner)}?`}" value="${escapeHtml(typed.text)}">
    </div>
    <p id="vsPartnerStatus" class="vs-partner-status">${escapeHtml(statusText)}</p>
    <button type="button" id="vsSubmit" class="btn btn-block vs-submit">✓ Bestätigen</button>`;

  const input = document.getElementById("vsInput");
  const submitBtn = document.getElementById("vsSubmit");
  const refresh = () => {
    submitBtn.disabled = !input.value.trim();
    vsStage.querySelectorAll(".vs-chip").forEach(chip => chip.classList.toggle("selected", chip.dataset.text === input.value.trim()));
  };
  input.addEventListener("input", () => {
    typed.text = input.value;
    refresh();
  });
  vsStage.querySelectorAll(".vs-chip").forEach(chip => chip.addEventListener("click", () => {
    input.value = chip.dataset.text;
    typed.text = input.value;
    refresh();
    if (navigator.vibrate) navigator.vibrate(8);
  }));
  const send = () => {
    if (!input.value.trim()) return;
    stageKey = null;
    versusRoom.dispatch(V.submitText, input.value);
  };
  submitBtn.addEventListener("click", send);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") send();
  });
  refresh();
}

function renderJudge(state, me, partner) {
  stageKey = null;
  const roles = V.rolesAt(state);
  const amAnswerer = roles.answerer === me;
  const question = V.questionById(state.questions[state.index]);
  vsStage.innerHTML = `
    <div class="vs-question vs-judge card">
      ${questionHead(state, question, roles, me)}
      <div class="vs-judge-line"><b>${escapeHtml(nameFor(roles.answerer, me))}:</b> ${escapeHtml(state.current.answer)}</div>
      <div class="vs-judge-line guess"><b>${amAnswerer ? `Tipp von ${escapeHtml(partner)}` : "Dein Tipp"}:</b> ${escapeHtml(state.current.guess)}</div>
      ${amAnswerer ? `
        <p class="vs-judge-ask">Lag ${escapeHtml(partner)} richtig?</p>
        <div class="vs-verdict">
          <button type="button" class="vs-verdict-btn right" data-right="1">✓ Richtig</button>
          <button type="button" class="vs-verdict-btn wrong" data-right="0">✗ Falsch</button>
        </div>` : ""}
    </div>
    ${amAnswerer ? "" : waitingCard("⚖️", "Beide sind drin!", `${partner} entscheidet, ob du richtig liegst …`)}`;
  vsStage.querySelectorAll(".vs-verdict-btn").forEach(btn => btn.addEventListener("click", () => {
    vsStage.querySelectorAll(".vs-verdict-btn").forEach(b => { b.disabled = true; });
    versusRoom.dispatch(V.judge, btn.dataset.right === "1");
  }));
}

/* every question is resolved right away; each phone moves on with "Weiter" */
function renderResult(state, result, me) {
  stageKey = null;
  const question = V.questionById(result.questionId);
  const iGuessed = result.guesser === me;
  const title = result.right ? "Richtig! 🎉" : "Oh je! 😵‍💫";
  const text = result.right
    ? `+1 Punkt für ${iGuessed ? "dich" : escapeHtml(result.guesser)}`
    : iGuessed ? "Knapp daneben – nächstes Mal! 💪" : `${escapeHtml(result.guesser)} lag daneben.`;
  vsStage.innerHTML = `
    <div class="vs-outcome card ${result.right ? "hit" : "miss"}">
      <div class="vs-outcome-icon" aria-hidden="true">${result.right ? "🥳" : "😵‍💫"}</div>
      <h2>${title}</h2>
      <p class="vs-outcome-text">${text}</p>
      <div class="vs-outcome-q">${escapeHtml(question.q)}</div>
      <div class="vs-judge-line"><b>${escapeHtml(nameFor(result.answerer, me))}:</b> ${escapeHtml(result.answer)}</div>
      <div class="vs-judge-line guess"><b>${iGuessed ? "Dein Tipp" : `Tipp von ${escapeHtml(result.guesser)}`}:</b> ${escapeHtml(result.guess)}</div>
    </div>
    <button type="button" id="vsContinue" class="btn btn-block vs-submit">Weiter ▶</button>`;
  document.getElementById("vsContinue").addEventListener("click", () => {
    seen.count++;
    renderVersus();
  });
  if (result.right && iGuessed) celebrate(10);
}

function resultList(results, me) {
  return results.map((r, i) => `
    <li class="vs-result ${r.right ? "hit" : "miss"}" style="animation-delay:${i * 180}ms">
      <span class="vs-result-mark">${r.right ? "✅" : "❌"}</span>
      <div class="vs-result-body">
        <div class="vs-result-q">${escapeHtml(V.questionById(r.questionId).q)}</div>
        <div class="vs-result-line"><b>${escapeHtml(nameFor(r.answerer, me))}:</b> ${escapeHtml(r.answer)}</div>
        <div class="vs-result-line guess"><b>${r.guesser === me ? "Dein Tipp" : `Tipp von ${escapeHtml(r.guesser)}`}:</b> ${escapeHtml(r.guess)}</div>
      </div>
      <span class="vs-result-points">+${r.right ? 1 : 0}</span>
    </li>`).join("");
}

function renderReveal(game, state, me, partner) {
  stageKey = null;
  const totals = V.roundTotals(state);
  const mine = totals[me];
  const theirs = totals[partner];
  const headline = mine === theirs
    ? "Unentschieden – ihr kennt euch gleich gut 💞"
    : mine > theirs ? `Du kennst ${partner} diese Runde besser! 🏆` : `${partner} kennt dich diese Runde besser! 🏆`;

  vsStage.innerHTML = `
    <div class="vs-headline card">
      <div class="vs-headline-score"><span>Du ${fmtPoints(mine)}</span><span class="vs-headline-vs">:</span><span>${fmtPoints(theirs)} ${escapeHtml(partner)}</span></div>
      <p>${escapeHtml(headline)}</p>
    </div>
    <h3 class="vs-section-title">Deine Tipps über ${escapeHtml(partner)} · ${fmtPoints(mine)}/${V.PER_ROUND}</h3>
    <ul class="vs-results">${resultList(state.results.filter(r => r.guesser === me), me)}</ul>
    <h3 class="vs-section-title">${escapeHtml(partner)}s Tipps über dich · ${fmtPoints(theirs)}/${V.PER_ROUND}</h3>
    <ul class="vs-results">${resultList(state.results.filter(r => r.guesser === partner), me)}</ul>
    <div id="vsNextWrap"></div>`;
  const next = versusRoom.renderReady(document.getElementById("vsNextWrap"), state, { label: "Nächste Runde ▶", nextFn: V.nextRound });
  next.id = "vsNext";
  next.classList.add("vs-submit");

  const roundKey = `${game.id}:${state.round}`;
  if (celebratedRound !== roundKey) {
    celebratedRound = roundKey;
    if (mine > theirs || mine === V.PER_ROUND) celebrate(mine === V.PER_ROUND ? 30 : 16);
  }
}

function renderVersus() {
  const game = currentVersusGame;
  if (!game || !game.state || !game.state.players) return;
  const state = game.state;
  const me = versusRoom.person;
  const partner = V.partnerOf(state, me);
  renderScore(state, me, partner);

  if (!V.isCurrentFormat(state)) {
    stageKey = null;
    vsStage.innerHTML = `
      <div class="vs-wait card">
        <div class="vs-wait-icon">✍️</div>
        <h3>Versus hat neue Regeln</h3>
        <p>Jetzt gibt es Rollen wie bei LovBirdz und jede Frage wird sofort aufgelöst. Diese Runde läuft noch nach den alten Regeln &ndash; beendet sie unten mit „Spiel beenden" und startet eine neue.</p>
      </div>`;
    return;
  }

  /* after a reload the results so far are not replayed */
  const roundKey = `${game.id}:${state.round}`;
  if (seen.key !== roundKey) seen = { key: roundKey, count: state.results.length };
  if (seen.count < state.results.length) {
    renderResult(state, state.results[seen.count], me);
    return;
  }
  if (state.phase === "reveal") {
    renderReveal(game, state, me, partner);
    return;
  }

  /* who answers and who guesses – at the start and again at the swap */
  const half = state.index < V.PER_ROUND ? 0 : 1;
  const rolesKey = `${roundKey}:${half}`;
  const roles = V.rolesAt(state);
  const mineDone = state.current[roles.answerer === me ? "answer" : "guess"] !== null;
  if (state.phase === "input" && state.index % V.PER_ROUND === 0 && !mineDone && !rolesSeen.has(rolesKey)) {
    stageKey = null;
    renderRoles(state, me, half, rolesKey);
    return;
  }

  if (state.phase === "judge") renderJudge(state, me, partner);
  else renderInput(game, state, me, partner);
}

showMode(initialMode());
versusRoom.start();
