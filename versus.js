/* Versus on the questions page, like LovBirdz and full screen: one answers, one guesses, the roles
   swap after three questions; everybody types at their own pace and the reveal comes at the end. Rules live in versus-engine.js, lobby/sync/versions in game-room.js. */

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

/* the running round is a full-screen layer directly on <body> (no animated parent may confine it),
   shown only while the Versus tab is open */
document.body.appendChild(vsBoard);
/* "‹" leaves the full screen without ending the round – opening Versus again continues it */
document.getElementById("vsBackBtn").addEventListener("click", () => showMode("other"));

function showMode(mode) {
  document.body.classList.toggle("vs-open", mode === "versus");
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
  createState: (players, option, carried) => V.createInitialState(players[0], players[1], option, Math.random, carried && carried.used),
  /* the questions already played go on to the next game */
  carryOver: state => ({ used: V.memoryOf(state) }),
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

/* ---------- small helpers ---------- */

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

/* ---------- what only this phone knows: text being typed, role cards seen, where the reveal is ---------- */

let stageKey = null;
let typed = { key: null, text: "" };
const rolesSeen = new Set();
let reveal = { key: null, pos: 0 };
const cheered = new Set();

/* ---------- pieces ---------- */

function renderScore(state, me, partner) {
  const lead = V.leader(state);
  const chip = (name, label) => `<span class="qz-chip${name === me ? " me" : ""}">${lead === name ? "👑 " : ""}${escapeHtml(label)} ${state.scores[name] || 0}</span>`;
  vsScore.innerHTML = `${chip(me, "Du")}${chip(partner, partner)}`;
}

/* two halves with the role swap in the middle, filled by how far I am */
function progressBar(done) {
  const first = Math.min(done, V.PER_ROUND) / V.PER_ROUND * 100;
  const second = Math.max(done - V.PER_ROUND, 0) / V.PER_ROUND * 100;
  return `
    <div class="qz-progress" aria-label="Frage ${Math.min(done + 1, V.QUESTIONS_PER_ROUND)} von ${V.QUESTIONS_PER_ROUND}">
      <div class="qz-progress-half first"><div class="qz-progress-fill" style="width:${first}%"></div></div>
      <span class="qz-progress-swap" aria-hidden="true">🔄</span>
      <div class="qz-progress-half second"><div class="qz-progress-fill" style="width:${second}%"></div></div>
    </div>`;
}

function centerScreen(emoji, title, text, extra = "") {
  return `
    <div class="qz-screen">
      <div class="qz-center">
        <div class="qz-big-emoji" aria-hidden="true">${emoji}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
        ${extra}
      </div>
    </div>`;
}

/* ---------- screens ---------- */

function renderRoles(state, me, half, key) {
  stageKey = null;
  const roles = V.rolesAt(state, half * V.PER_ROUND);
  const card = (person, answering) => `
    <div class="qz-role-card ${answering ? "answer" : "guess"}">
      <span class="qz-role-name">${escapeHtml(person)}</span>
      <span class="qz-role-text">${person === me ? "Du bist" : `${escapeHtml(person)} ist`} dran mit ${answering ? "Antworten" : "Raten"}</span>
      <span class="qz-role-icon" aria-hidden="true">${answering ? "💬" : "🔮"}</span>
    </div>`;
  vsStage.innerHTML = `
    <div class="qz-screen">
      <div class="qz-head plain"><span class="qz-head-icon">${half === 0 ? "!" : "🔄"}</span>${half === 0 ? "Rollenverteilung" : "Rollenwechsel"}</div>
      <div class="qz-roles">
        ${card(roles.answerer, true)}
        <div class="qz-role-swap" aria-hidden="true">🔄</div>
        ${card(roles.guesser, false)}
      </div>
      <button type="button" id="vsRolesGo" class="qz-confirm">Los geht's ▶</button>
    </div>`;
  document.getElementById("vsRolesGo").addEventListener("click", () => {
    rolesSeen.add(key);
    renderVersus();
  });
}

/* my next question: upper half the question, lower half the text field */
function renderQuestion(game, state, me, partner) {
  const index = V.progressOf(state, me);
  const roles = V.rolesAt(state, index);
  const amAnswerer = roles.answerer === me;
  const theirs = V.progressOf(state, partner);
  const statusText = theirs >= V.QUESTIONS_PER_ROUND ? `💌 ${partner} ist schon fertig.` : `${partner} ist bei Frage ${theirs + 1} von ${V.QUESTIONS_PER_ROUND}.`;

  /* typing must not be interrupted by live updates: keep the screen, only refresh the status line */
  const key = `${game.id}:${state.round}:${index}`;
  if (stageKey === key && document.getElementById("vsPartnerStatus")) {
    document.getElementById("vsPartnerStatus").textContent = statusText;
    return;
  }
  stageKey = key;
  if (typed.key !== key) typed = { key, text: "" };

  const question = V.questionById(state.questions[index]);
  const hint = hintFor(question, roles.answerer, me);
  const chips = suggestionsFor(question, roles.answerer, me);
  vsStage.innerHTML = `
    <div class="qz-screen">
      <div class="qz-head ${amAnswerer ? "answer" : "guess"}"><span class="qz-head-icon">!</span>Du bist dran mit ${amAnswerer ? "Antworten" : "Raten"}</div>
      ${progressBar(index)}
      <div class="qz-card">
        <div class="qz-question">
          <p class="qz-lead">Frage ${index + 1} von ${V.QUESTIONS_PER_ROUND} · ${amAnswerer ? "Über dich" : `Was antwortet ${escapeHtml(partner)}?`}</p>
          <h2 class="qz-text">${escapeHtml(question.q)}</h2>
          <hr class="qz-rule">
        </div>
        <div class="qz-answers">
          <input type="text" id="vsInput" class="qz-input" maxlength="${V.MAX_TEXT}" autocomplete="off" enterkeyhint="done"
            placeholder="${amAnswerer ? "Deine Antwort …" : `${escapeHtml(partner)}s Antwort …`}" value="${escapeHtml(typed.text)}">
          ${hint ? `<p class="qz-hint">${escapeHtml(hint)}</p>` : ""}
          ${chips.length ? `<div class="qz-chips">${chips.map(c => `<button type="button" class="qz-chip-btn" data-text="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}</div>` : ""}
        </div>
      </div>
      <p id="vsPartnerStatus" class="qz-note">${escapeHtml(statusText)}</p>
      <button type="button" id="vsSubmit" class="qz-confirm">✓ Bestätigen</button>
    </div>`;

  const input = document.getElementById("vsInput");
  const submitBtn = document.getElementById("vsSubmit");
  const refresh = () => {
    submitBtn.disabled = !input.value.trim();
    vsStage.querySelectorAll(".qz-chip-btn").forEach(chip => chip.classList.toggle("selected", chip.dataset.text === input.value.trim()));
  };
  input.addEventListener("input", () => {
    typed.text = input.value;
    refresh();
  });
  vsStage.querySelectorAll(".qz-chip-btn").forEach(chip => chip.addEventListener("click", () => {
    input.value = chip.dataset.text;
    typed.text = input.value;
    refresh();
    if (navigator.vibrate) navigator.vibrate(8);
  }));
  const send = () => {
    if (!input.value.trim() || submitBtn.disabled) return;
    submitBtn.disabled = true;
    stageKey = null;
    versusRoom.dispatch(V.submitText, input.value);
  };
  submitBtn.addEventListener("click", send);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") send();
  });
  refresh();
}

function renderWaiting(state, me, partner) {
  stageKey = null;
  const theirs = V.progressOf(state, partner);
  const dots = Array.from({ length: V.QUESTIONS_PER_ROUND }, (_, i) => `<span class="${i < theirs ? "done" : ""}"></span>`).join("");
  vsStage.innerHTML = centerScreen("⏳", "Fertig!", `Warte auf ${partner} – bei Frage ${Math.min(theirs + 1, V.QUESTIONS_PER_ROUND)} von ${V.QUESTIONS_PER_ROUND}. Dann kommt die Aufklärung.`, `<div class="qz-mini-progress" aria-label="${escapeHtml(partner)}: ${theirs} von ${V.QUESTIONS_PER_ROUND}">${dots}</div>`);
}

/* the reveal, question by question: whoever answered decides, both see the result */
function renderRevealCard(state, me, partner, index) {
  stageKey = null;
  const roles = V.rolesAt(state, index);
  const amAnswerer = roles.answerer === me;
  const question = V.questionById(state.questions[index]);
  const verdict = state.verdicts[index];

  let bottom;
  if (verdict === null && amAnswerer) {
    bottom = `
      <p class="qz-note">Lag ${escapeHtml(partner)} richtig?</p>
      <div class="qz-verdict">
        <button type="button" class="qz-option right" data-right="1">✓ Richtig</button>
        <button type="button" class="qz-option wrong" data-right="0">✗ Falsch</button>
      </div>`;
  } else if (verdict === null) {
    bottom = `<div class="qz-result open"><h3>⏳ Moment …</h3><p>${escapeHtml(partner)} entscheidet, ob du richtig liegst.</p></div>`;
  } else {
    const iGuessed = roles.guesser === me;
    bottom = verdict
      ? `<div class="qz-result hit"><h3>Richtig! 🎉</h3><p>${iGuessed ? "Du kennst " + escapeHtml(partner) + " einfach." : escapeHtml(partner) + " kennt dich einfach."}</p><span class="qz-points">+1 Punkt für ${iGuessed ? "dich" : escapeHtml(roles.guesser)}</span></div>`
      : `<div class="qz-result miss"><h3>Oh je! 😵‍💫</h3><p>${iGuessed ? "Knapp daneben – nächstes Mal! 💪" : escapeHtml(partner) + " lag daneben."}</p><span class="qz-points">+0 Punkte</span></div>`;
  }

  vsStage.innerHTML = `
    <div class="qz-screen">
      <div class="qz-head plain"><span class="qz-head-icon">✨</span>Aufklärung ${index + 1}/${V.QUESTIONS_PER_ROUND}</div>
      <div class="qz-card">
        <div class="qz-question">
          <p class="qz-lead">${amAnswerer ? "Über dich" : `Über ${escapeHtml(roles.answerer)}`}</p>
          <h2 class="qz-text">${escapeHtml(question.q)}</h2>
          <hr class="qz-rule">
        </div>
        <div class="qz-answers">
          <div class="qz-pair">
            <div class="qz-pair-row answer"><span class="qz-pair-who">${amAnswerer ? "Deine Antwort" : `Antwort von ${escapeHtml(roles.answerer)}`}</span><span class="qz-pair-text">${escapeHtml(V.answerAt(state, index))}</span></div>
            <div class="qz-pair-row guess"><span class="qz-pair-who">${amAnswerer ? `Tipp von ${escapeHtml(roles.guesser)}` : "Dein Tipp"}</span><span class="qz-pair-text">${escapeHtml(V.guessAt(state, index))}</span></div>
          </div>
          ${bottom}
        </div>
      </div>
      <button type="button" id="vsContinue" class="qz-confirm"${verdict === null ? " disabled" : ""}>${index + 1 < V.QUESTIONS_PER_ROUND ? "Weiter ▶" : "Zum Ergebnis ▶"}</button>
    </div>`;

  vsStage.querySelectorAll(".qz-verdict .qz-option").forEach(btn => btn.addEventListener("click", () => {
    vsStage.querySelectorAll(".qz-verdict .qz-option").forEach(b => { b.disabled = true; });
    if (navigator.vibrate) navigator.vibrate(10);
    versusRoom.dispatch(V.judge, index, btn.dataset.right === "1");
  }));
  document.getElementById("vsContinue").addEventListener("click", () => {
    if (state.verdicts[index] === null) return;
    reveal.pos = index + 1;
    renderVersus();
  });
  const cheerKey = `${reveal.key}:${index}`;
  if (verdict === true && roles.guesser === me && !cheered.has(cheerKey)) {
    cheered.add(cheerKey);
    celebrate(10);
  }
}

function resultList(state, me, guesser) {
  return state.questions.map((id, i) => ({ id, i, roles: V.rolesAt(state, i) }))
    .filter(entry => entry.roles.guesser === guesser)
    .map(({ id, i, roles }) => {
      const right = state.verdicts[i];
      return `
        <li class="qz-item ${right ? "hit" : "miss"}">
          <span class="qz-item-mark">${right ? "✅" : "❌"}</span>
          <div class="qz-item-body">
            <div class="qz-item-q">${escapeHtml(V.questionById(id).q)}</div>
            <div class="qz-item-line"><b>${escapeHtml(nameFor(roles.answerer, me))}:</b> ${escapeHtml(V.answerAt(state, i))}</div>
            <div class="qz-item-line muted"><b>${roles.guesser === me ? "Dein Tipp" : `Tipp von ${escapeHtml(roles.guesser)}`}:</b> ${escapeHtml(V.guessAt(state, i))}</div>
          </div>
        </li>`;
    }).join("");
}

function renderSummary(game, state, me, partner) {
  stageKey = null;
  const totals = V.roundTotals(state);
  const mine = totals[me];
  const theirs = totals[partner];
  const headline = mine === theirs
    ? "Unentschieden – ihr kennt euch gleich gut 💞"
    : mine > theirs ? `Du kennst ${partner} diese Runde besser!` : `${partner} kennt dich diese Runde besser!`;

  vsStage.innerHTML = `
    <div class="qz-screen">
      <div class="qz-scroll">
        <div class="qz-summary-head" id="vsSummary">
          <div class="qz-big-emoji" aria-hidden="true">${mine === theirs ? "💞" : mine > theirs ? "🏆" : "🥈"}</div>
          <div class="qz-summary-score">Du ${mine} : ${theirs} ${escapeHtml(partner)}</div>
          <p>${escapeHtml(headline)}</p>
        </div>
        <h3 class="qz-section-title">Deine Tipps über ${escapeHtml(partner)} · ${mine}/${V.PER_ROUND}</h3>
        <ul class="qz-list">${resultList(state, me, me)}</ul>
        <h3 class="qz-section-title">${escapeHtml(partner)}s Tipps über dich · ${theirs}/${V.PER_ROUND}</h3>
        <ul class="qz-list">${resultList(state, me, partner)}</ul>
        <div id="vsNextWrap"></div>
      </div>
    </div>`;
  const next = versusRoom.renderReady(document.getElementById("vsNextWrap"), state, { label: "Nächste Runde ▶", nextFn: V.nextRound });
  next.id = "vsNext";

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
    vsStage.innerHTML = centerScreen("✍️", "Versus hat neue Regeln", "Diese Runde läuft noch nach den alten Regeln – beendet sie oben mit „Spiel beenden“ und startet eine neue.");
    return;
  }

  const roundKey = `${game.id}:${state.round}`;
  if (state.phase === "play") {
    const done = V.progressOf(state, me);
    if (done >= V.QUESTIONS_PER_ROUND) {
      renderWaiting(state, me, partner);
      return;
    }
    /* who answers and who guesses – at the start and again at the swap */
    const half = done < V.PER_ROUND ? 0 : 1;
    const rolesKey = `${roundKey}:${half}`;
    if (done % V.PER_ROUND === 0 && !rolesSeen.has(rolesKey)) {
      renderRoles(state, me, half, rolesKey);
      return;
    }
    renderQuestion(game, state, me, partner);
    return;
  }

  /* the reveal walks through all six; after a reload of a finished round go straight to the result */
  if (reveal.key !== roundKey) reveal = { key: roundKey, pos: state.phase === "reveal" ? V.QUESTIONS_PER_ROUND : 0 };
  if (reveal.pos < V.QUESTIONS_PER_ROUND) {
    renderRevealCard(state, me, partner, reveal.pos);
    return;
  }
  if (state.phase === "reveal") {
    renderSummary(game, state, me, partner);
    return;
  }
  stageKey = null;
  vsStage.innerHTML = centerScreen("⏳", "Gleich geht's weiter", `${partner} bewertet noch die letzten Tipps …`);
}

showMode(initialMode());
versusRoom.start();
