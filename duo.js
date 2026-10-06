/* "Wir zwei" – only for the two of us: the question of the day with our flame streak, and the
   live rounds of "Wer von uns beiden?" and "Hot oder Not?" (two players through game-room.js). */

const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dailyEl = document.getElementById("duoDaily");
const boardEl = document.getElementById("duoBoard");
const stageEl = document.getElementById("duoStage");

const MODE_LABELS = { who: "Wer von uns beiden?", hotnot: "Hot oder Not?" };
const VOTE_LABELS = { hot: "🔥 Hot", not: "❄️ Not" };

const room = GameRoom.create({
  table: "duo_games",
  title: "Wir zwei",
  icon: "💞",
  url: "duo.html",
  lobbyEl: document.getElementById("duoLobby"),
  boardEl,
  leaveBtn: document.getElementById("duoLeaveBtn"),
  createState: (players, option) => DuoEngine.createInitialState(players[0], players[1], option),
  isFinished: () => false,
  renderBoard,
  maxPlayers: 2,
  invites: false,
  startOptions: [
    { value: "who", label: "Wer von uns beiden?", hint: "Isi oder Benji – seid ihr euch einig?" },
    { value: "hotnot", label: "Hot oder Not?", hint: "🔥 oder ❄️ – tickt ihr gleich?" }
  ]
});

const me = () => room.person;
const partnerOf = person => (person === "Isi" ? "Benji" : "Isi");

/* =================== Frage des Tages =================== */

let dailyRows = [];
let dailyDay = DuoDaily.dayKey();
let dailyDraft = { day: null, answer: null };
let dailySaving = false;

async function loadDaily() {
  const { data, error } = await db.from("daily_answers").select("*").order("day", { ascending: true });
  if (error) {
    console.error("Frage des Tages konnte nicht geladen werden:", error);
    dailyEl.innerHTML = `<p class="duo-loading">Die Frage des Tages konnte nicht geladen werden.</p>`;
    return;
  }
  dailyRows = data || [];
  renderDaily();
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

function renderDaily() {
  dailyDay = DuoDaily.dayKey();
  const person = me();
  const info = DuoDaily.streakInfo(dailyRows, dailyDay);
  const question = DuoDaily.questionFor(dailyDay, DuoContent.DAILY);
  const header = `
    <div class="duo-streak">
      <div class="duo-streak-flame" aria-hidden="true">🔥</div>
      <div class="duo-streak-number" aria-label="${info.current} Tage in Folge">${info.current}</div>
    </div>
    ${info.record ? `<p class="duo-record">🏅 Rekord: ${info.record} ${info.record === 1 ? "Tag" : "Tage"}</p>` : ""}
    <h2 id="duoDailyTitle" class="duo-headline">${escapeHtml(DuoDaily.streakHeadline(info))}</h2>
    <div class="duo-flames" aria-label="Die letzten sieben Tage">${flameRow(info)}</div>`;

  if (!person) {
    dailyEl.innerHTML = `${header}<div class="duo-q"><p class="duo-q-label">Frage des Tages</p><p class="duo-q-text">${escapeHtml(question.text)}</p></div>`;
    return;
  }

  const partner = partnerOf(person);
  const mine = dailyRows.find(r => r.day === dailyDay && r.person === person);
  const theirs = dailyRows.find(r => r.day === dailyDay && r.person === partner);
  const option = i => escapeHtml(question.options[i] || "–");
  let body;

  if (!mine) {
    if (dailyDraft.day !== dailyDay) dailyDraft = { day: dailyDay, answer: null };
    const guessing = dailyDraft.answer !== null;
    body = `
      <p class="duo-q-step">${guessing ? `Schritt 2 von 2 · Was antwortet ${escapeHtml(partner)}?` : "Schritt 1 von 2 · Deine Antwort"}</p>
      <div class="duo-options" role="group">
        ${question.options.map((text, i) => `<button type="button" class="duo-option" data-index="${i}">${escapeHtml(text)}</button>`).join("")}
      </div>
      ${guessing ? `<p class="duo-q-note">Deine Antwort: <strong>${option(dailyDraft.answer)}</strong> · <button type="button" class="duo-link" id="duoDailyBack">ändern</button></p>` : ""}
      ${theirs ? `<p class="duo-q-note">💌 ${escapeHtml(partner)} hat schon geantwortet – du bist dran!</p>` : ""}`;
  } else if (!theirs) {
    body = `
      <div class="duo-mine">
        <p>Deine Antwort: <strong>${option(mine.answer)}</strong></p>
        <p>Dein Tipp für ${escapeHtml(partner)}: <strong>${option(mine.guess)}</strong></p>
      </div>
      <p class="duo-wait">⏳ Warte auf ${escapeHtml(partner)} – dann deckt ihr gemeinsam auf.</p>`;
  } else {
    const myHit = mine.guess === theirs.answer;
    const theirHit = theirs.guess === mine.answer;
    body = `
      <div class="duo-reveal">
        <div class="duo-reveal-col">
          <p class="duo-reveal-name">Du</p>
          <p class="duo-reveal-answer">${option(mine.answer)}</p>
          <p class="duo-reveal-guess ${theirHit ? "hit" : "miss"}">${escapeHtml(partner)} hat getippt: ${option(theirs.guess)} ${theirHit ? "✓" : "✗"}</p>
        </div>
        <div class="duo-reveal-col">
          <p class="duo-reveal-name">${escapeHtml(partner)}</p>
          <p class="duo-reveal-answer">${option(theirs.answer)}</p>
          <p class="duo-reveal-guess ${myHit ? "hit" : "miss"}">Du hast getippt: ${option(mine.guess)} ${myHit ? "✓" : "✗"}</p>
        </div>
      </div>
      <p class="duo-wait">${myHit && theirHit ? "Ihr kennt euch einfach 💞" : myHit || theirHit ? "Einer von euch lag richtig 😊" : "Heute habt ihr euch überrascht 😄"} Morgen gibt's die nächste Frage.</p>`;
  }

  dailyEl.innerHTML = `
    ${header}
    <div class="duo-q">
      <p class="duo-q-label">Frage des Tages</p>
      <p class="duo-q-text">${escapeHtml(question.text)}</p>
      ${body}
    </div>
    ${countdownHtml(info)}`;

  dailyEl.querySelectorAll(".duo-option").forEach(button => {
    button.addEventListener("click", () => chooseDaily(Number(button.dataset.index), question));
  });
  const back = document.getElementById("duoDailyBack");
  if (back) back.addEventListener("click", () => {
    dailyDraft.answer = null;
    renderDaily();
  });
}

async function chooseDaily(index, question) {
  if (dailyDraft.answer === null) {
    dailyDraft = { day: dailyDay, answer: index };
    renderDaily();
    return;
  }
  if (dailySaving) return;
  dailySaving = true;
  const person = me();
  const partner = partnerOf(person);
  const { error } = await db.from("daily_answers").insert({
    day: dailyDay, person, question_id: question.id, answer: dailyDraft.answer, guess: index
  });
  dailySaving = false;
  if (error && error.code !== "23505") {
    console.error("Antwort konnte nicht gespeichert werden:", error);
    showToast("Antwort konnte nicht gespeichert werden.", "error");
    return;
  }
  dailyDraft = { day: dailyDay, answer: null };
  await loadDaily();
  const theirs = dailyRows.find(r => r.day === dailyDay && r.person === partner);
  if (theirs) celebrate(18);
  sendAppNotification(db, {
    title: "Frage des Tages 🔥",
    body: theirs ? `${person} hat geantwortet – ihr könnt aufdecken!` : `${person} hat die Frage des Tages beantwortet – du bist dran!`,
    excludePerson: person,
    category: "games",
    url: "duo.html"
  });
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

/* =================== Wer von uns beiden? / Hot oder Not? =================== */

let draft = { key: null, answers: [], index: 0 };

function answerLabel(state, value) {
  return state.mode === "hotnot" ? VOTE_LABELS[value] || "–" : value;
}

function renderBoard(game) {
  const state = game.state;
  const person = me();
  const partner = state.players.find(p => p !== person);
  const total = (state.history || []).reduce((sum, h) => sum + h.matches, 0);
  const played = (state.history || []).length;
  const head = `
    <div class="duo-round-head">
      <span class="duo-mode">${escapeHtml(MODE_LABELS[state.mode])}</span>
      <span>Runde ${state.round}${played ? ` · bisher ${total}/${played * DuoEngine.ROUND_SIZE} gleich` : ""}</span>
    </div>`;

  if (state.phase === "answer") {
    if (!state.answers[person]) {
      renderQuestionFlow(game, head, partner);
    } else {
      stageEl.innerHTML = `${head}
        <div class="duo-card duo-waiting card">
          <div class="duo-waiting-icon">✓</div>
          <h3>Fertig!</h3>
          <p>Warte auf ${escapeHtml(partner)} – dann seht ihr, wo ihr euch einig seid.</p>
        </div>`;
    }
    return;
  }
  renderReveal(state, head, person, partner);
}

function renderQuestionFlow(game, head, partner) {
  const state = game.state;
  const key = `${game.id}:${state.round}`;
  if (draft.key !== key) draft = { key, answers: [], index: 0 };
  const i = Math.min(draft.index, state.items.length - 1);
  const text = DuoEngine.itemText(state, state.items[i]);
  const choices = state.mode === "who"
    ? state.players.map(p => ({ value: p, label: p, cls: p === "Isi" ? "isi" : "benji" }))
    : [{ value: "hot", label: "🔥 Hot", cls: "hot" }, { value: "not", label: "❄️ Not", cls: "not" }];
  const theirsDone = Boolean(state.answers[partner]);

  stageEl.innerHTML = `${head}
    <div class="duo-card card">
      <div class="duo-dots">${state.items.map((_, k) => `<span class="${k < i ? "done" : k === i ? "now" : ""}"></span>`).join("")}</div>
      <p class="duo-card-count">Frage ${i + 1} von ${state.items.length}</p>
      <p class="duo-card-text">${escapeHtml(text)}</p>
      <div class="duo-choices">
        ${choices.map(c => `<button type="button" class="duo-choice ${c.cls}${draft.answers[i] === c.value ? " picked" : ""}" data-value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`).join("")}
      </div>
      ${i > 0 ? `<button type="button" class="duo-link duo-back" id="duoBack">← vorherige</button>` : ""}
      ${theirsDone ? `<p class="duo-q-note">💌 ${escapeHtml(partner)} ist schon fertig.</p>` : ""}
    </div>`;

  stageEl.querySelectorAll(".duo-choice").forEach(button => {
    button.addEventListener("click", () => {
      draft.answers[i] = button.dataset.value;
      if (i < state.items.length - 1) {
        draft.index = i + 1;
        renderQuestionFlow(game, head, partner);
      } else {
        room.dispatch(DuoEngine.submitAnswers, draft.answers.slice());
      }
    });
  });
  const back = document.getElementById("duoBack");
  if (back) back.addEventListener("click", () => {
    draft.index = i - 1;
    renderQuestionFlow(game, head, partner);
  });
}

function renderReveal(state, head, person, partner) {
  const { perItem, matches } = state.results;
  stageEl.innerHTML = `${head}
    <div class="duo-score card">
      <p class="duo-score-number">${matches}<span>/${perItem.length}</span></p>
      <p class="duo-score-label">gleich geantwortet</p>
      <p class="duo-score-verdict">${escapeHtml(DuoEngine.verdict(matches, perItem.length))}</p>
    </div>
    <ul class="duo-results">
      ${perItem.map(r => `
        <li class="duo-result ${r.match ? "match" : "differ"}">
          <p class="duo-result-text">${escapeHtml(DuoEngine.itemText(state, r.item))}</p>
          <div class="duo-result-answers">
            <span class="duo-chip">Du: <strong>${escapeHtml(answerLabel(state, r[person]))}</strong></span>
            <span class="duo-chip">${escapeHtml(partner)}: <strong>${escapeHtml(answerLabel(state, r[partner]))}</strong></span>
            <span class="duo-result-mark" aria-label="${r.match ? "gleich" : "unterschiedlich"}">${r.match ? "💞" : "≠"}</span>
          </div>
        </li>`).join("")}
    </ul>
    <div id="duoNext"></div>`;
  room.renderReady(document.getElementById("duoNext"), state, { label: "Nächste Runde ▶", nextFn: DuoEngine.nextRound });
}

loadDaily();
room.start();
