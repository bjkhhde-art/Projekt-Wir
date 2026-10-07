/* "Wir zwei" – only for the two of us: the question of the day with our flame streak, and the
   live rounds of "Wer von uns beiden?" and "Hot oder Not?" (two players through game-room.js). */

const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dailyEl = document.getElementById("duoDaily");
const boardEl = document.getElementById("duoBoard");
const stageEl = document.getElementById("duoStage");

const MODE_LABELS = { daily: "Frage des Tages", who: "Wer von uns beiden?", hotnot: "Hot oder Not?" };
const VOTE_LABELS = { hot: "🔥 Hot", not: "❄️ Not" };
const MODE_TITLES = { daily: "Frage des Tages 🔥", who: "Wer von uns beiden? 🤔", hotnot: "Hot oder Not? 🌶️" };
const MODE_SUBTITLES = {
  daily: "Jeden Tag eine neue Frage – zusammen beantworten und die Flamme am Leben halten.",
  who: "Isi oder Benji? Seht, wo ihr euch einig seid.",
  hotnot: "🔥 oder ❄️ – tickt ihr gleich?"
};
const queryMode = new URLSearchParams(location.search).get("mode");
const START_MODE = MODE_LABELS[queryMode] ? queryMode : "daily";

const room = GameRoom.create({
  table: "duo_games",
  title: "Wir zwei",
  icon: "💞",
  url: option => `duo.html?mode=${option}`,
  lobbyEl: document.getElementById("duoLobby"),
  boardEl,
  leaveBtn: document.getElementById("duoLeaveBtn"),
  createState: (players, option, carried) => DuoEngine.createInitialState(players[0], players[1], option, Math.random, carried && carried.memory),
  /* the questions already played (per mode) go on to the next game */
  carryOver: state => ({ memory: DuoEngine.memoryOf(state) }),
  isFinished: state => state.mode === "daily" && state.phase === "reveal",
  renderBoard,
  maxPlayers: 2,
  invites: false,
  initialOption: START_MODE,
  hideOptions: true,
  onSync: onRoomSync,
  startOptions: [
    { value: "daily", label: "🔥 Frage des Tages", hint: "Zusammen beantworten, Flamme am Leben halten" },
    { value: "who", label: "Wer von uns beiden?", hint: "Isi oder Benji – seid ihr euch einig?" },
    { value: "hotnot", label: "Hot oder Not?", hint: "🔥 oder ❄️ – tickt ihr gleich?" }
  ]
});

const me = () => room.person;
const partnerOf = person => (person === "Isi" ? "Benji" : "Isi");

/* =================== Frage des Tages: flame, countdown, result of today =================== */

let dailyRows = [];
let dailyDay = DuoDaily.dayKey();

let dailyLoaded;
const dailyReady = new Promise(resolve => { dailyLoaded = resolve; });

async function loadDaily() {
  const { data, error } = await db.from("daily_answers").select("*").order("day", { ascending: true });
  if (error) {
    console.error("Frage des Tages konnte nicht geladen werden:", error);
    dailyEl.innerHTML = `<p class="duo-loading">Die Frage des Tages konnte nicht geladen werden.</p>`;
    return;
  }
  dailyRows = data || [];
  renderDaily();
  dailyLoaded();
}

function flameRow(info) {
  return info.lastSeven.map(d => `<span class="duo-flame ${d.status}" title="${d.day}">🔥</span>`).join("");
}

function countdownHtml(info) {
  if (info.doneToday) return "";
  const [h, m, s] = DuoDaily.formatCountdown(DuoDaily.secondsLeftToday());
  return `
    <div class="duo-countdown">
      <p>Verbleibende Zeit:</p>
      <div class="duo-countdown-digits" id="duoCountdown"><span>${h}</span>:<span>${m}</span>:<span>${s}</span></div>
    </div>`;
}

/* both answers side by side, with who guessed right */
function dailyRevealHtml(question, person, mineAnswer, mineGuess, theirAnswer, theirGuess) {
  const partner = partnerOf(person);
  const option = i => escapeHtml(question.options[i] || "–");
  const myHit = mineGuess === theirAnswer;
  const theirHit = theirGuess === mineAnswer;
  return `
    <div class="duo-reveal">
      <div class="duo-reveal-col">
        <p class="duo-reveal-name">Du</p>
        <p class="duo-reveal-answer">${option(mineAnswer)}</p>
        <p class="duo-reveal-guess ${theirHit ? "hit" : "miss"}">${escapeHtml(partner)} hat getippt: ${option(theirGuess)} ${theirHit ? "✓" : "✗"}</p>
      </div>
      <div class="duo-reveal-col">
        <p class="duo-reveal-name">${escapeHtml(partner)}</p>
        <p class="duo-reveal-answer">${option(theirAnswer)}</p>
        <p class="duo-reveal-guess ${myHit ? "hit" : "miss"}">Du hast getippt: ${option(mineGuess)} ${myHit ? "✓" : "✗"}</p>
      </div>
    </div>
    <p class="duo-wait">${myHit && theirHit ? "Ihr kennt euch einfach 💞" : myHit || theirHit ? "Einer von euch lag richtig 😊" : "Heute habt ihr euch überrascht 😄"}</p>`;
}

function renderDaily() {
  dailyDay = DuoDaily.dayKey();
  const person = me();
  const info = DuoDaily.streakInfo([...DuoDaily.historyRows(), ...dailyRows], dailyDay, DuoDaily.HISTORY);
  const header = `
    <div class="duo-streak">
      <div class="duo-streak-flame" aria-hidden="true">🔥</div>
      <div class="duo-streak-number" aria-label="${info.current} Tage in Folge">${info.current}</div>
    </div>
    ${info.record ? `<p class="duo-record">🏅 Rekord: ${info.record} ${info.record === 1 ? "Tag" : "Tage"}</p>` : ""}
    <h2 id="duoDailyTitle" class="duo-headline">${escapeHtml(DuoDaily.streakHeadline(info))}</h2>
    <div class="duo-flames" aria-label="Die letzten sieben Tage">${flameRow(info)}</div>`;

  let body;
  const rowsToday = dailyRows.filter(r => r.day === dailyDay);
  const mine = person && rowsToday.find(r => r.person === person);
  const theirs = person && rowsToday.find(r => r.person === partnerOf(person));
  const question = mine ? DuoContent.DAILY.find(q => q.id === mine.question_id) : null;
  if (info.doneToday && mine && theirs && question) {
    body = `
      <p class="duo-q-label">Frage des Tages</p>
      <p class="duo-q-text">${escapeHtml(question.text)}</p>
      ${dailyRevealHtml(question, person, mine.answer, mine.guess, theirs.answer, theirs.guess)}
      <p class="duo-q-note">Morgen gibt's die nächste Frage.</p>`;
  } else {
    body = `
      <p class="duo-q-label">Frage des Tages</p>
      <p class="duo-q-text duo-q-hidden">Die Frage seht ihr erst, wenn ihr beide da seid.</p>
      <p class="duo-q-note">Startet eine Runde, der andere tritt bei – dann beantwortet ihr sie gleichzeitig und deckt zusammen auf.</p>
      <button type="button" class="btn btn-block duo-daily-start" id="duoDailyStart">🔥 Frage des Tages zusammen spielen</button>`;
  }

  dailyEl.innerHTML = `${header}<div class="duo-q">${body}</div>${countdownHtml(info)}`;
  updateLayout();
  const start = document.getElementById("duoDailyStart");
  if (start) start.addEventListener("click", startDailyGame);
}

function startDailyGame() {
  if (!roomRunning(room.game)) room.startWith("daily");
  document.getElementById("duoLobby").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =================== one mode per page: the colourful cards lead straight into a round =================== */

function roomRunning(game) {
  return Boolean(game && game.status !== "closed");
}

function currentMode() {
  const game = room.game;
  if (roomRunning(game) && game.state) return game.state.option || game.state.mode || START_MODE;
  return START_MODE;
}

function dailyDoneToday() {
  return DuoDaily.streakInfo([...DuoDaily.historyRows(), ...dailyRows], DuoDaily.dayKey(), DuoDaily.HISTORY).doneToday;
}

function updateLayout() {
  const mode = currentMode();
  document.getElementById("duoTitle").textContent = MODE_TITLES[mode];
  document.getElementById("duoSubtitle").textContent = MODE_SUBTITLES[mode];
  document.getElementById("daily").classList.toggle("hidden", mode !== "daily");
  /* today's question is done: the card at the top shows the result, no new round needed */
  const dailyStart = document.getElementById("duoDailyStart");
  if (dailyStart) dailyStart.classList.toggle("hidden", roomRunning(room.game));
  document.getElementById("duoLobby").classList.toggle("duo-lobby-off", mode === "daily" && !roomRunning(room.game) && dailyDoneToday());
}

let entered = false;

async function enterMode(game) {
  await dailyReady;
  const person = me();
  if (!person) return;
  if (!roomRunning(game)) {
    if (START_MODE === "daily" && dailyDoneToday()) return;
    room.startWith(START_MODE);
    return;
  }
  if (game.status !== "waiting" || !game.state) return;
  const lobby = game.state.lobby || [game.host_person];
  if (!lobby.includes(person)) {
    /* the other one is already waiting for exactly this game: step straight in */
    if (game.state.option === START_MODE) room.join();
    return;
  }
  if (game.state.option !== START_MODE) room.switchOption(START_MODE);
}

function onRoomSync(game) {
  updateLayout();
  if (entered) return;
  entered = true;
  enterMode(game);
}

/* the answer also lands in daily_answers – that is what the flame counts (saved once per day) */
const dailySaving = new Set();

async function saveDailyRow(state, answer, guess) {
  const person = me();
  const key = `${state.day}:${person}`;
  if (dailySaving.has(key) || dailyRows.some(r => r.day === state.day && r.person === person)) return;
  dailySaving.add(key);
  const { error } = await db.from("daily_answers").insert({ day: state.day, person, question_id: state.questionId, answer, guess });
  if (error && error.code !== "23505") {
    console.error("Antwort konnte nicht gespeichert werden:", error);
    dailySaving.delete(key);
    return;
  }
  await loadDaily();
}

/* the countdown ticks every second; at midnight the next question appears */
setInterval(() => {
  if (DuoDaily.dayKey() !== dailyDay) {
    loadDaily();
    return;
  }
  const el = document.getElementById("duoCountdown");
  if (!el) return;
  DuoDaily.formatCountdown(DuoDaily.secondsLeftToday()).forEach((value, i) => {
    if (el.children[i]) el.children[i].textContent = value;
  });
}, 1000);

document.querySelectorAll(".person-choice-btn").forEach(button => button.addEventListener("click", () => setTimeout(renderDaily, 0)));

db.channel("daily_answers_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "daily_answers" }, () => loadDaily())
  .subscribe();

/* =================== the lobby game: daily / who / hot-or-not =================== */

/* =================== the round itself: full screen, one question at a time =================== */

const scoreEl = document.getElementById("duoScore");
/* the round is a full-screen layer directly on <body> (no animated parent may confine it) */
document.body.appendChild(boardEl);
/* "‹" goes back to the list of modes without ending the round – opening the mode again continues it */
document.getElementById("duoBackBtn").addEventListener("click", () => { location.href = "questions.html?mode=other"; });

let dailyDraft = { key: null, answer: null, step: 0, pick: null };
let draft = { key: null, answers: [], index: 0 };
let pick = { key: null, value: null };
let revealPos = { key: null, pos: 0 };

function answerLabel(state, value) {
  return state.mode === "hotnot" ? VOTE_LABELS[value] || "–" : value;
}

function headHtml(icon, title, tone = "plain") {
  return `<div class="qz-head ${tone}"><span class="qz-head-icon">${icon}</span>${escapeHtml(title)}</div>`;
}

function progressHtml(done, total) {
  return `
    <div class="qz-progress" aria-label="Frage ${Math.min(done + 1, total)} von ${total}">
      <div class="qz-progress-half"><div class="qz-progress-fill" style="width:${done / total * 100}%"></div></div>
    </div>`;
}

function centerHtml(emoji, title, text, extra = "") {
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

/* question in the upper half, the answers in the lower half, the big button at the bottom */
function questionScreen({ head, progress = "", lead, text, answers, note = "", confirm }) {
  return `
    <div class="qz-screen">
      ${head}
      ${progress}
      <div class="qz-card">
        <div class="qz-question">
          ${lead ? `<p class="qz-lead">${lead}</p>` : ""}
          <h2 class="qz-text">${escapeHtml(text)}</h2>
          <hr class="qz-rule">
        </div>
        <div class="qz-answers">${answers}</div>
      </div>
      ${note ? `<p class="qz-note">${note}</p>` : ""}
      ${confirm}
    </div>`;
}

function optionButtons(options, selected, extraClass = () => "") {
  const buttons = options.map(o => `<button type="button" class="qz-option ${extraClass(o)}${o.value === selected ? " selected" : ""}" data-value="${escapeHtml(String(o.value))}">${escapeHtml(o.label)}</button>`);
  if (options.length === 2) return `${buttons[0]}<p class="qz-or">ODER</p>${buttons[1]}`;
  return `<div class="qz-options-4">${buttons.join("")}</div>`;
}

/* tapping an option selects it; "Bestätigen" goes on */
function wireOptions(onPick) {
  stageEl.querySelectorAll(".qz-answers .qz-option").forEach(button => button.addEventListener("click", () => {
    stageEl.querySelectorAll(".qz-answers .qz-option").forEach(b => b.classList.toggle("selected", b === button));
    const confirm = document.getElementById("duoConfirm");
    if (confirm) confirm.disabled = false;
    if (navigator.vibrate) navigator.vibrate(8);
    onPick(button.dataset.value);
  }));
}

function renderScore(state, person, partner) {
  if (state.mode === "daily") {
    scoreEl.innerHTML = `<span class="qz-chip">🔥 ${escapeHtml(state.day.split("-").reverse().join("."))}</span>`;
    return;
  }
  const total = (state.history || []).reduce((sum, h) => sum + h.matches, 0);
  const played = (state.history || []).length;
  scoreEl.innerHTML = `<span class="qz-chip">Runde ${state.round}</span>${played ? `<span class="qz-chip me">💞 ${total}/${played * DuoEngine.ROUND_SIZE}</span>` : ""}`;
}

/* ---------- Frage des Tages: my answer, then my guess, then both are revealed ---------- */

function renderDailyGame(game, person, partner) {
  const state = game.state;
  const question = DuoEngine.dailyQuestion(state);
  if (!question) {
    stageEl.innerHTML = centerHtml("🤷", "Diese Frage gibt es nicht mehr", "Beendet die Runde oben und startet neu.");
    return;
  }
  const label = i => question.options[i] || "–";
  const mine = state.answers[person];

  if (state.phase === "reveal") {
    const theirs = state.answers[partner];
    const myHit = mine.guess === theirs.answer;
    const theirHit = theirs.guess === mine.answer;
    const both = myHit && theirHit;
    stageEl.innerHTML = `
      <div class="qz-screen">
        ${headHtml("✨", "Aufklärung")}
        <div class="qz-card">
          <div class="qz-question">
            <p class="qz-lead">Frage des Tages</p>
            <h2 class="qz-text">${escapeHtml(question.text)}</h2>
            <hr class="qz-rule">
          </div>
          <div class="qz-answers">
            <div class="qz-pair">
              <div class="qz-pair-row answer"><span class="qz-pair-who">Deine Antwort</span><span class="qz-pair-text">${escapeHtml(label(mine.answer))}</span><span class="qz-pair-tip ${theirHit ? "hit" : "miss"}">${escapeHtml(partner)} hat getippt: ${escapeHtml(label(theirs.guess))} ${theirHit ? "✓" : "✗"}</span></div>
              <div class="qz-pair-row guess"><span class="qz-pair-who">${escapeHtml(partner)}s Antwort</span><span class="qz-pair-text">${escapeHtml(label(theirs.answer))}</span><span class="qz-pair-tip ${myHit ? "hit" : "miss"}">Du hast getippt: ${escapeHtml(label(mine.guess))} ${myHit ? "✓" : "✗"}</span></div>
            </div>
            <div class="qz-result ${both ? "hit" : myHit || theirHit ? "open" : "miss"}" id="duoDailyResult">
              <h3>${both ? "Ihr kennt euch! 💞" : myHit || theirHit ? "Einer lag richtig 😊" : "Überraschung! 😄"}</h3>
              <p>${both ? "Beide richtig getippt." : myHit || theirHit ? "Einer von euch lag richtig." : "Heute habt ihr euch überrascht."} Die Flamme brennt weiter 🔥</p>
            </div>
          </div>
        </div>
        <button type="button" id="duoDone" class="qz-confirm">Fertig ✓</button>
      </div>`;
    document.getElementById("duoDone").addEventListener("click", () => document.getElementById("duoLeaveBtn").click());
    saveDailyRow(state, mine.answer, mine.guess);
    return;
  }

  if (mine) {
    stageEl.innerHTML = centerHtml("⏳", "Fertig!", `Warte auf ${partner} – dann deckt ihr gemeinsam auf.`);
    return;
  }

  const key = `${game.id}`;
  if (dailyDraft.key !== key) dailyDraft = { key, answer: null, step: 0, pick: null };
  const guessing = dailyDraft.step === 1;
  const selected = dailyDraft.pick;
  const options = question.options.map((text, i) => ({ value: i, label: text }));
  stageEl.innerHTML = questionScreen({
    head: headHtml("!", guessing ? "Du bist dran mit Raten" : "Du bist dran mit Antworten", guessing ? "guess" : "answer"),
    progress: progressHtml(dailyDraft.step, 2),
    lead: guessing ? `Schritt 2 von 2 · Was antwortet ${escapeHtml(partner)}?` : "Schritt 1 von 2 · Deine Antwort",
    text: question.text,
    answers: optionButtons(options, selected ?? null),
    note: guessing
      ? `Deine Antwort: <strong>${escapeHtml(label(dailyDraft.answer))}</strong> · <button type="button" class="qz-link" id="duoDailyBack">ändern</button>`
      : escapeHtml(state.answers[partner] ? `💌 ${partner} ist schon fertig.` : `${partner} überlegt noch …`),
    confirm: `<button type="button" id="duoConfirm" class="qz-confirm"${selected === null || selected === undefined ? " disabled" : ""}>✓ Bestätigen</button>`
  });
  wireOptions(value => { dailyDraft.pick = Number(value); });
  document.getElementById("duoConfirm").addEventListener("click", async () => {
    if (dailyDraft.pick === null || dailyDraft.pick === undefined) return;
    if (!guessing) {
      dailyDraft.answer = dailyDraft.pick;
      dailyDraft.step = 1;
      dailyDraft.pick = null;
      renderDailyGame(game, person, partner);
      return;
    }
    const answer = dailyDraft.answer;
    const guess = dailyDraft.pick;
    document.getElementById("duoConfirm").disabled = true;
    await room.dispatch(DuoEngine.submitDaily, answer, guess);
    saveDailyRow(state, answer, guess);
  });
  const back = document.getElementById("duoDailyBack");
  if (back) back.addEventListener("click", () => {
    dailyDraft.step = 0;
    dailyDraft.pick = dailyDraft.answer;
    renderDailyGame(game, person, partner);
  });
}

/* ---------- Wer von uns beiden? / Hot oder Not? ---------- */

function choicesFor(state) {
  return state.mode === "who"
    ? state.players.map(p => ({ value: p, label: p, cls: p === "Isi" ? "isi" : "benji" }))
    : [{ value: "hot", label: "🔥 Hot", cls: "hot" }, { value: "not", label: "❄️ Not", cls: "not" }];
}

function renderQuestionFlow(game, partner) {
  const state = game.state;
  const key = `${game.id}:${state.round}`;
  if (draft.key !== key) draft = { key, answers: [], index: 0 };
  const total = state.items.length;
  const i = Math.min(draft.index, total - 1);
  const selected = draft.answers[i] ?? null;

  stageEl.innerHTML = questionScreen({
    head: headHtml(state.mode === "who" ? "🤔" : "🌶️", MODE_LABELS[state.mode], "answer"),
    progress: progressHtml(i, total),
    lead: `Frage ${i + 1} von ${total}`,
    text: DuoEngine.itemText(state, state.items[i]),
    answers: optionButtons(choicesFor(state), selected, o => o.cls),
    note: `${i > 0 ? `<button type="button" class="qz-link" id="duoBack">← vorherige</button> · ` : ""}${escapeHtml(state.answers[partner] ? `💌 ${partner} ist schon fertig.` : `${partner} ist noch dabei …`)}`,
    confirm: `<button type="button" id="duoConfirm" class="qz-confirm"${selected === null ? " disabled" : ""}>${i < total - 1 ? "✓ Bestätigen" : "✓ Abschicken"}</button>`
  });
  wireOptions(value => { draft.answers[i] = value; });
  document.getElementById("duoConfirm").addEventListener("click", () => {
    if (draft.answers[i] === undefined || draft.answers[i] === null) return;
    if (i < total - 1) {
      draft.index = i + 1;
      renderQuestionFlow(game, partner);
      return;
    }
    document.getElementById("duoConfirm").disabled = true;
    room.dispatch(DuoEngine.submitAnswers, draft.answers.slice());
  });
  const back = document.getElementById("duoBack");
  if (back) back.addEventListener("click", () => {
    draft.index = i - 1;
    renderQuestionFlow(game, partner);
  });
}

/* the reveal, item by item – then the summary */
function renderRevealItem(state, person, partner, k) {
  const r = state.results.perItem[k];
  const total = state.results.perItem.length;
  stageEl.innerHTML = `
    <div class="qz-screen">
      ${headHtml("✨", `Aufklärung ${k + 1}/${total}`)}
      <div class="qz-card">
        <div class="qz-question">
          <p class="qz-lead">${escapeHtml(MODE_LABELS[state.mode])}</p>
          <h2 class="qz-text">${escapeHtml(DuoEngine.itemText(state, r.item))}</h2>
          <hr class="qz-rule">
        </div>
        <div class="qz-answers">
          <div class="qz-pair">
            <div class="qz-pair-row answer"><span class="qz-pair-who">Du</span><span class="qz-pair-text">${escapeHtml(answerLabel(state, r[person]))}</span></div>
            <div class="qz-pair-row guess"><span class="qz-pair-who">${escapeHtml(partner)}</span><span class="qz-pair-text">${escapeHtml(answerLabel(state, r[partner]))}</span></div>
          </div>
          <div class="qz-result ${r.match ? "hit" : "miss"}">
            <h3>${r.match ? "Einig! 💞" : "Uneinig! 😄"}</h3>
            <p>${r.match ? "Ihr habt gleich geantwortet." : "Da seid ihr verschiedener Meinung."}</p>
          </div>
        </div>
      </div>
      <button type="button" id="duoConfirm" class="qz-confirm">${k + 1 < total ? "Weiter ▶" : "Zum Ergebnis ▶"}</button>
    </div>`;
  document.getElementById("duoConfirm").addEventListener("click", () => {
    revealPos.pos = k + 1;
    renderBoard(room.game);
  });
}

function renderReveal(state, person, partner) {
  const { perItem, matches } = state.results;
  stageEl.innerHTML = `
    <div class="qz-screen">
      <div class="qz-scroll">
        <div class="qz-summary-head">
          <div class="qz-big-emoji" aria-hidden="true">${matches === perItem.length ? "💞" : matches >= perItem.length / 2 ? "😊" : "😂"}</div>
          <div class="qz-summary-score" id="duoMatches">${matches} von ${perItem.length}</div>
          <p>gleich geantwortet</p>
          <p class="qz-verdict-text" id="duoVerdict">${escapeHtml(DuoEngine.verdict(matches, perItem.length))}</p>
        </div>
        <ul class="qz-list">
          ${perItem.map(r => `
            <li class="qz-item ${r.match ? "hit" : "miss"}">
              <span class="qz-item-mark" aria-label="${r.match ? "gleich" : "unterschiedlich"}">${r.match ? "💞" : "≠"}</span>
              <div class="qz-item-body">
                <div class="qz-item-q">${escapeHtml(DuoEngine.itemText(state, r.item))}</div>
                <div class="qz-item-line"><b>Du:</b> ${escapeHtml(answerLabel(state, r[person]))}</div>
                <div class="qz-item-line muted"><b>${escapeHtml(partner)}:</b> ${escapeHtml(answerLabel(state, r[partner]))}</div>
              </div>
            </li>`).join("")}
        </ul>
        <div id="duoNext"></div>
      </div>
    </div>`;
  room.renderReady(document.getElementById("duoNext"), state, { label: "Nächste Runde ▶", nextFn: DuoEngine.nextRound });
}

function renderBoard(game) {
  if (!game || !game.state) return;
  const state = game.state;
  const person = me();
  const partner = state.players.find(p => p !== person);
  renderScore(state, person, partner);
  if (state.mode === "daily") {
    renderDailyGame(game, person, partner);
    return;
  }

  if (state.phase === "answer") {
    if (!state.answers[person]) renderQuestionFlow(game, partner);
    else stageEl.innerHTML = centerHtml("⏳", "Fertig!", `Warte auf ${partner} – dann seht ihr, wo ihr euch einig seid.`);
    return;
  }

  /* walk through the six one by one, then the summary */
  const roundKey = `${game.id}:${state.round}`;
  if (revealPos.key !== roundKey) revealPos = { key: roundKey, pos: 0 };
  if (revealPos.pos < state.results.perItem.length) {
    renderRevealItem(state, person, partner, revealPos.pos);
    return;
  }
  renderReveal(state, person, partner);
}

loadDaily();
room.start();
