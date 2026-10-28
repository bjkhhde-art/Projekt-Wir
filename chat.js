/* Chat-Wrapped page: upload, local storage (IndexedDB), wrapped cards, quiz, quotes, awards.
   The chat is read and stored in this browser only – nothing is sent anywhere. */
(function () {
  const E = window.ChatEngine;
  const esc = window.escapeHtml;
  const DB_NAME = "pw-chat";
  const KEY = "export";
  const QUIZ_ROUNDS = 10;

  const $ = id => document.getElementById(id);
  const num = n => Math.round(n).toLocaleString("de-DE");
  const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

  /* ---------- storage ---------- */

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("no indexedDB")); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbRun(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("kv", mode);
      const request = action(tx.objectStore("kv"));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  const saveData = data => dbRun("readwrite", store => store.put(data, KEY));
  const loadData = () => dbRun("readonly", store => store.get(KEY)).catch(() => null);
  const clearData = () => dbRun("readwrite", store => store.delete(KEY));

  /* ---------- state ---------- */

  let data = null;
  let stats = null;
  let words = null;
  let pools = null;
  let quizPools = null;
  let quote = { filter: "pearls", index: -1, today: true };
  let quiz = null;

  const colorOf = i => (i === 0 ? "a" : "b");
  const nameTag = i => `<span class="c-${colorOf(i)}">${esc(data.names[i])}</span>`;

  /* ---------- upload ---------- */

  function setStatus(message, isError) {
    const el = $("chatUploadStatus");
    el.textContent = message || "";
    el.classList.toggle("cu-error", !!isError);
  }

  async function importFile(file) {
    if (!file) return;
    setStatus("Lese den Chat …");
    try {
      const text = await window.ChatZip.readChatText(await file.arrayBuffer());
      const messages = E.parseChat(text);
      if (messages.length < 10) throw new Error("Ich habe kaum Nachrichten gefunden. Ist das wirklich ein WhatsApp-Export?");
      const prepared = E.prepare(messages);
      if (!prepared) throw new Error("Im Chat schreiben keine zwei verschiedenen Personen.");
      prepared.savedAt = Date.now();
      let kept = true;
      try { await saveData(prepared); } catch (error) { kept = false; }
      show(prepared);
      setStatus("");
      if (kept) window.showToast("Chat geladen – bleibt nur auf diesem Gerät 💗", "success");
      else window.showToast("Chat geladen, lässt sich hier aber nicht speichern – nach dem Schließen muss er neu hochgeladen werden.");
    } catch (error) {
      setStatus(error && error.message ? error.message : "Das hat nicht geklappt.", true);
    }
  }

  function wireUpload() {
    const input = $("chatFileInput");
    const drop = $("chatDrop");
    input.addEventListener("change", () => { importFile(input.files[0]); input.value = ""; });
    ["dragenter", "dragover"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", event => importFile(event.dataTransfer.files[0]));

    $("chatReplaceBtn").addEventListener("click", () => {
      $("chatUpload").classList.remove("hidden");
      $("chatUpload").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("chatDeleteBtn").addEventListener("click", async () => {
      if (!confirm("Den gespeicherten Chat von diesem Gerät löschen?")) return;
      try { await clearData(); } catch (error) { /* nothing stored */ }
      data = null;
      $("chatApp").classList.add("hidden");
      $("chatUpload").classList.remove("hidden");
      window.showToast("Chat gelöscht");
    });
  }

  /* ---------- show everything ---------- */

  function show(next) {
    data = next;
    stats = E.computeStats(data);
    words = E.computeWords(data);
    pools = E.quotePools(data);
    quizPools = E.quizPool(data);
    quote = { filter: "pearls", index: -1, today: true };
    quiz = null;

    $("chatUpload").classList.add("hidden");
    $("chatApp").classList.remove("hidden");
    $("chatSummary").innerHTML = `<strong>${esc(data.names[0])} &amp; ${esc(data.names[1])}</strong><span>${num(stats.total)} Nachrichten &middot; ${esc(E.formatDay(stats.first))} bis ${esc(E.formatDay(stats.last))}</span>`;

    renderWrapped();
    startQuiz();
    renderQuotes();
    renderAwards();
  }

  /* ---------- wrapped cards ---------- */

  function splitBar(a, b) {
    const total = a + b || 1;
    return `<div class="cw-split" aria-hidden="true"><span class="cw-split-a" style="width:${(a / total) * 100}%"></span><span class="cw-split-b" style="width:${(b / total) * 100}%"></span></div>`;
  }

  function versus(label, a, b, format = num) {
    return `<div class="cw-row"><div class="cw-row-label">${esc(label)}</div><div class="cw-row-values"><span class="c-a">${format(a)}</span><span class="c-b">${format(b)}</span></div></div>`;
  }

  function bars(values, labels, highlight) {
    const max = Math.max(1, ...values);
    return `<div class="cw-bars">${values.map((v, i) =>
      `<div class="cw-bar${i === highlight ? " top" : ""}" title="${esc(labels[i])}: ${num(v)}"><span style="height:${Math.max(2, (v / max) * 100)}%"></span><em>${esc(labels[i])}</em></div>`).join("")}</div>`;
  }

  function wrappedCards() {
    const [pa, pb] = stats.people;
    const cards = [];
    const textOf = p => p.messages - p.deleted - Object.values(p.media).reduce((x, y) => x + y, 0);

    cards.push(`
      <div class="cw-kicker">Euer Chat</div>
      <div class="cw-hero">${num(stats.total)}</div>
      <div class="cw-big-label">Nachrichten</div>
      <p class="cw-note">in ${num(stats.spanDays)} Tagen &ndash; an ${num(stats.activeDays)} davon habt ihr geschrieben.<br>Das sind ${(stats.total / stats.activeDays).toFixed(1).replace(".", ",")} Nachrichten pro Tag.</p>
      <div class="cw-foot">${esc(E.formatDay(stats.first))} &rarr; ${esc(E.formatDay(stats.last))}</div>`);

    const leader = pa.messages >= pb.messages ? 0 : 1;
    cards.push(`
      <div class="cw-kicker">Wer schreibt mehr?</div>
      <div class="cw-big-label">${nameTag(leader)} quatscht mehr</div>
      ${splitBar(pa.messages, pb.messages)}
      <div class="cw-percent"><span class="c-a">${percent(pa.messages, stats.total)} %</span><span class="c-b">${percent(pb.messages, stats.total)} %</span></div>
      <div class="cw-names"><span class="c-a">${esc(data.names[0])}</span><span class="c-b">${esc(data.names[1])}</span></div>
      ${versus("Nachrichten", pa.messages, pb.messages)}
      ${versus("Wörter", pa.words, pb.words)}
      ${versus("Wörter pro Nachricht", textOf(pa) ? pa.words / textOf(pa) : 0, textOf(pb) ? pb.words / textOf(pb) : 0, v => v.toFixed(1).replace(".", ","))}`);

    if (pa.replyMedian !== null && pb.replyMedian !== null) {
      const faster = pa.replyMedian <= pb.replyMedian ? 0 : 1;
      cards.push(`
        <div class="cw-kicker">Antwortzeit</div>
        <div class="cw-big-label">${nameTag(faster)} antwortet schneller</div>
        <div class="cw-hero cw-hero-sm">${esc(E.formatMinutes(stats.people[faster].replyMedian))}</div>
        <p class="cw-note">Mittlere Zeit, bis eine Antwort kommt &ndash; nur innerhalb eines Gesprächs gezählt.</p>
        <div class="cw-names"><span class="c-a">${esc(data.names[0])}</span><span class="c-b">${esc(data.names[1])}</span></div>
        ${versus("Antwortet nach", pa.replyMedian, pb.replyMedian, E.formatMinutes)}
        <div class="cw-foot">${nameTag(0)} ${pa.starts}&times; &middot; ${nameTag(1)} ${pb.starts}&times; das Gespräch eröffnet</div>`);
    }

    const peak = stats.busiestMonth;
    cards.push(`
      <div class="cw-kicker">Eure Monate</div>
      <div class="cw-big-label">${esc(E.MONTHS_LONG[peak.month])} ${peak.year} war am lautesten</div>
      <p class="cw-note">${num(peak.total)} Nachrichten in einem Monat.</p>
      <div class="cw-scroll">${bars(stats.months.map(m => m.total), stats.months.map(m => m.label), stats.months.indexOf(peak))}</div>`);

    const silence = stats.longestSilence;
    const silenceDays = silence ? silence.gap / 86400000 : 0;
    cards.push(`
      <div class="cw-kicker">Rekorde</div>
      ${stats.busiestDay ? `<div class="cw-record"><span>🔥</span><div><strong>${num(stats.busiestDay.count)} Nachrichten</strong> an einem Tag<br><small>${esc(E.formatDay(new Date(stats.busiestDay.key + "T12:00:00").getTime()))}</small></div></div>` : ""}
      <div class="cw-record"><span>📅</span><div><strong>${num(stats.dayStreak.length)} Tage am Stück</strong> geschrieben<br><small>${esc(E.formatDay(stats.dayStreak.from))} bis ${esc(E.formatDay(stats.dayStreak.to))}</small></div></div>
      ${silence && silenceDays >= 1 ? `<div class="cw-record"><span>🤐</span><div><strong>${silenceDays >= 2 ? num(silenceDays) + " Tage" : "Ein Tag"} Funkstille</strong><br><small>bis sich ${nameTag(silence.breaker)} am ${esc(E.formatDay(silence.to))} wieder gemeldet hat</small></div></div>` : ""}
      <div class="cw-record"><span>⏰</span><div>Lieblingsstunde: <strong>${stats.peakHour}&ndash;${stats.peakHour + 1} Uhr</strong></div></div>`);

    const hours = stats.perHour[0].map((n, h) => n + stats.perHour[1][h]);
    const weekdays = stats.perWeekday;
    const topDay = weekdays.indexOf(Math.max(...weekdays));
    cards.push(`
      <div class="cw-kicker">Rund um die Uhr</div>
      <div class="cw-big-label">Am meisten läuft's um ${stats.peakHour} Uhr</div>
      ${bars(hours, hours.map((_, h) => (h % 3 === 0 ? String(h) : "")), stats.peakHour)}
      <p class="cw-note">Lieblingstag zum Schreiben: <strong>${esc(E.WEEKDAYS[topDay])}</strong> (${percent(weekdays[topDay], stats.total)} % aller Nachrichten).<br>Nachts zwischen 0 und 5 Uhr: ${nameTag(0)} ${num(pa.lateNight)}&times;, ${nameTag(1)} ${num(pb.lateNight)}&times;</p>`);

    if (stats.emojis.total.length) {
      const list = (items, empty) => (items.length ? items.map(([e, n]) => `<span class="cw-emoji">${esc(e)}<small>${num(n)}</small></span>`).join("") : `<small>${empty}</small>`);
      cards.push(`
        <div class="cw-kicker">Emojis</div>
        <div class="cw-big-label">Euer Emoji</div>
        <div class="cw-hero">${esc(stats.emojis.total[0][0])}</div>
        <div class="cw-emoji-row">${list(stats.emojis.total.slice(0, 6))}</div>
        <div class="cw-emoji-people">
          <div>${nameTag(0)}<div class="cw-emoji-row">${list(stats.emojis.people[0].slice(0, 4), "keine")}</div></div>
          <div>${nameTag(1)}<div class="cw-emoji-row">${list(stats.emojis.people[1].slice(0, 4), "keine")}</div></div>
        </div>`);
    }

    if (stats.phrases.length) {
      cards.push(`
        <div class="cw-kicker">Wer sagt was?</div>
        <div class="cw-big-label">Eure Standard-Sätze</div>
        <div class="cw-names"><span class="c-a">${esc(data.names[0])}</span><span class="c-b">${esc(data.names[1])}</span></div>
        <div class="cw-phrases">${stats.phrases.map(p => `<div class="cw-phrase"><span>${p.icon} ${esc(p.label)}</span><b class="c-a">${num(p.counts[0])}</b><b class="c-b">${num(p.counts[1])}</b></div>`).join("")}</div>`);
    }

    const mediaTotal = k => pa.media[k] + pb.media[k];
    const mediaRows = [["image", "📸 Fotos"], ["video", "🎬 Videos"], ["audio", "🎤 Sprachnachrichten"], ["sticker", "🎭 Sticker"], ["gif", "🖼️ GIFs"], ["media", "📎 Medien (ohne Details)"]].filter(([k]) => mediaTotal(k) > 0);
    if (mediaRows.length) {
      cards.push(`
        <div class="cw-kicker">Außer Text</div>
        <div class="cw-big-label">Fotos, Sprachnachrichten &amp; Co.</div>
        <div class="cw-names"><span class="c-a">${esc(data.names[0])}</span><span class="c-b">${esc(data.names[1])}</span></div>
        <div class="cw-phrases">${mediaRows.map(([k, label]) => `<div class="cw-phrase"><span>${label}</span><b class="c-a">${num(pa.media[k])}</b><b class="c-b">${num(pb.media[k])}</b></div>`).join("")}</div>
        ${pa.deleted + pb.deleted ? `<p class="cw-note">🫣 ${num(pa.deleted + pb.deleted)} Nachrichten wurden wieder gelöscht.</p>` : ""}`);
    }

    cards.push(`
      <div class="cw-kicker">Das war's</div>
      <div class="cw-hero">💗</div>
      <div class="cw-big-label">Mehr gibt's bei „Awards“ und „Zitate“</div>
      <p class="cw-note">Wer ist die Quasselstrippe, welche Wörter sind typisch für euch &ndash; und welcher Spruch war nochmal von wem?</p>`);
    return cards;
  }

  function renderWrapped() {
    const deck = $("wrappedDeck");
    const cards = wrappedCards();
    deck.innerHTML = cards.map((html, i) => `<article class="cw-card cw-theme-${i % 5}">${html}</article>`).join("");
    $("wrappedDots").innerHTML = cards.map((_, i) => `<button type="button" class="cw-dot" data-index="${i}" aria-label="Karte ${i + 1}"></button>`).join("");
    deck.scrollLeft = 0;
    syncDots();
  }

  function currentCard() {
    const deck = $("wrappedDeck");
    return Math.round(deck.scrollLeft / Math.max(1, deck.clientWidth));
  }

  function syncDots() {
    const active = currentCard();
    document.querySelectorAll(".cw-dot").forEach((dot, i) => dot.classList.toggle("active", i === active));
  }

  function goToCard(index) {
    const deck = $("wrappedDeck");
    const count = deck.children.length;
    const target = Math.max(0, Math.min(count - 1, index));
    deck.scrollTo({ left: target * deck.clientWidth, behavior: "smooth" });
  }

  function wireWrapped() {
    const deck = $("wrappedDeck");
    deck.addEventListener("scroll", syncDots, { passive: true });
    $("wrappedPrev").addEventListener("click", () => goToCard(currentCard() - 1));
    $("wrappedNext").addEventListener("click", () => goToCard(currentCard() + 1));
    $("wrappedDots").addEventListener("click", event => {
      const dot = event.target.closest(".cw-dot");
      if (dot) goToCard(Number(dot.dataset.index));
    });
    deck.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") { event.preventDefault(); goToCard(currentCard() + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); goToCard(currentCard() - 1); }
    });
  }

  /* ---------- bubbles (quotes and quiz) ---------- */

  function bubble(message, extra = "") {
    return `<div class="cq-line cq-${colorOf(message.a)}${message.main ? " main" : ""}${extra}"><span class="cq-who">${esc(data.names[message.a])}</span><div class="cq-bubble">${esc(message.x).replace(/\n/g, "<br>")}</div></div>`;
  }

  /* ---------- quiz: who wrote it? ---------- */

  function startQuiz() {
    quiz = { round: 0, score: 0, used: new Set(), current: null, answered: false, finished: false };
    nextQuizRound();
  }

  function nextQuizRound() {
    const round = E.quizRound(quizPools, Math.random, quiz.used);
    if (!round || quiz.round >= QUIZ_ROUNDS) { quiz.finished = true; renderQuiz(); return; }
    quiz.used.add(round.index);
    quiz.round++;
    quiz.current = round;
    quiz.answered = false;
    renderQuiz();
  }

  function renderQuiz() {
    const stage = $("quizStage");
    if (!quizPools[0].length || !quizPools[1].length) {
      stage.innerHTML = `<div class="card cq-card"><p class="cw-note">Dafür gibt es noch zu wenige passende Nachrichten im Chat.</p></div>`;
      return;
    }
    if (quiz.finished) {
      const total = quiz.round;
      const verdict = quiz.score >= total * 0.8 ? "Ihr kennt euch in- und auswendig 💗" : quiz.score >= total * 0.5 ? "Ganz ordentlich – ihr habt euch gut gelesen 😊" : "Hmm … ihr schreibt euch wohl zu ähnlich 😅";
      stage.innerHTML = `<div class="card cq-card cq-result"><div class="cw-kicker">Geschafft</div><div class="cw-hero">${quiz.score}/${total}</div><p class="cw-note">${verdict}</p><button id="quizAgain" class="btn btn-block" type="button">Nochmal spielen</button></div>`;
      $("quizAgain").addEventListener("click", startQuiz);
      return;
    }

    const m = data.msgs[quiz.current.index];
    const right = quiz.current.author;
    stage.innerHTML = `
      <div class="card cq-card">
        <div class="cq-head"><span>Frage ${quiz.round}/${QUIZ_ROUNDS}</span><span>⭐ ${quiz.score}</span></div>
        <p class="cq-ask">Wer hat das geschrieben?</p>
        <div class="cq-line cq-quiz"><div class="cq-bubble">${esc(m.x).replace(/\n/g, "<br>")}</div></div>
        <div class="cq-answers">
          <button type="button" class="btn cq-answer cq-answer-a" data-who="0">${esc(data.names[0])}</button>
          <button type="button" class="btn cq-answer cq-answer-b" data-who="1">${esc(data.names[1])}</button>
        </div>
        <div id="quizFeedback" class="cq-feedback" role="status" aria-live="polite"></div>
      </div>`;
    stage.querySelectorAll(".cq-answer").forEach(button => button.addEventListener("click", () => {
      if (quiz.answered) return;
      quiz.answered = true;
      const guess = Number(button.dataset.who);
      const correct = guess === right;
      if (correct) quiz.score++;
      stage.querySelectorAll(".cq-answer").forEach(b => {
        b.disabled = true;
        b.classList.toggle("right", Number(b.dataset.who) === right);
        b.classList.toggle("wrong", b === button && !correct);
      });
      const last = quiz.round >= QUIZ_ROUNDS;
      $("quizFeedback").innerHTML = `<strong>${correct ? "Richtig! 🎉" : "Leider nein 🙈"}</strong> Das war ${nameTag(right)} am ${esc(E.formatDay(m.t))}.<button id="quizNext" class="btn btn-block" type="button">${last ? "Ergebnis ansehen" : "Nächste Frage →"}</button>`;
      $("quizNext").addEventListener("click", () => { if (last) { quiz.finished = true; renderQuiz(); } else nextQuizRound(); });
      const head = stage.querySelector(".cq-head");
      head.lastElementChild.textContent = "⭐ " + quiz.score;
    }));
  }

  /* ---------- quotes ---------- */

  const QUOTE_FILTERS = [["pearls", "✨ Perlen"], ["funny", "😂 Lustig"], ["sweet", "💗 Süß"], ["long", "📜 Lang"], ["all", "🎲 Alles"]];

  function pickQuote(newOne) {
    const pool = pools[quote.filter];
    if (!pool.length) { quote.index = -1; return; }
    if (newOne) { quote.index = E.randomFrom(pool, Math.random, quote.index); quote.today = false; }
    else { quote.index = E.quoteOfDay(pool, E.dayKey(Date.now())); quote.today = true; }
  }

  function renderQuotes() {
    pickQuote(false);
    drawQuotes();
  }

  function drawQuotes() {
    const stage = $("quoteStage");
    const lines = quote.index >= 0 ? E.context(data, quote.index) : [];
    const main = quote.index >= 0 ? data.msgs[quote.index] : null;
    stage.innerHTML = `
      <div class="cq-chips" role="group" aria-label="Auswahl">${QUOTE_FILTERS.map(([key, label]) => `<button type="button" class="cq-chip${quote.filter === key ? " active" : ""}" data-filter="${key}">${label}</button>`).join("")}</div>
      <div class="card cq-card">
        <div class="cw-kicker">${quote.today ? "Zitat des Tages" : "Zufälliges Zitat"}</div>
        ${main ? `<div class="cq-thread">${lines.map(l => bubble(l)).join("")}</div><p class="cq-date">${esc(E.formatDay(main.t))}, ${new Date(main.t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</p>` : `<p class="cw-note">In dieser Auswahl gibt es keine passenden Nachrichten.</p>`}
        <div class="cq-actions">
          ${quote.today ? "" : `<button id="quoteToday" class="btn btn-secondary" type="button">Zitat des Tages</button>`}
          <button id="quoteRandom" class="btn" type="button">🎲 Noch eins</button>
        </div>
      </div>`;
    stage.querySelectorAll(".cq-chip").forEach(chip => chip.addEventListener("click", () => { quote.filter = chip.dataset.filter; quote.today = true; pickQuote(false); drawQuotes(); }));
    $("quoteRandom").addEventListener("click", () => { pickQuote(true); drawQuotes(); });
    const today = $("quoteToday");
    if (today) today.addEventListener("click", () => { pickQuote(false); drawQuotes(); });
  }

  /* ---------- awards, favourite words, cloud ---------- */

  function renderAwards() {
    const prizes = E.awards(stats, data);
    const cloud = words.cloud;
    const maxCount = cloud.length ? cloud[0].count : 1;
    const minCount = cloud.length ? cloud[cloud.length - 1].count : 1;
    const size = count => 14 + ((count - minCount) / Math.max(1, maxCount - minCount)) * 26;
    /* shuffle in a fixed order so the biggest words do not all sit at the start */
    const arranged = cloud.map((w, i) => ({ w, key: (i * 7919) % 101 })).sort((x, y) => x.key - y.key).map(x => x.w);

    $("awardsStage").innerHTML = `
      <h2 class="ca-heading">🏆 Die Awards</h2>
      <div class="ca-awards">${prizes.length ? prizes.map(p => `
        <div class="card ca-award ca-award-${colorOf(p.index)}">
          <div class="ca-award-icon" aria-hidden="true">${p.icon}</div>
          <div class="ca-award-text"><small>${esc(p.title)}</small><strong>${esc(p.winner)}</strong><span>${esc(p.detail)}</span></div>
        </div>`).join("") : `<p class="cw-note">Für Awards ist der Chat noch zu klein.</p>`}</div>

      <h2 class="ca-heading">☁️ Eure Wörter</h2>
      <div class="card ca-cloud">${arranged.length ? arranged.map(w => {
        const tone = w.lean > 0.35 ? "a" : w.lean < -0.35 ? "b" : "n";
        return `<span class="ca-word ca-word-${tone}" style="font-size:${size(w.count).toFixed(1)}px" title="${esc(w.word)}: ${num(w.counts[0])}× ${esc(data.names[0])}, ${num(w.counts[1])}× ${esc(data.names[1])}">${esc(w.word)}</span>`;
      }).join(" ") : `<p class="cw-note">Noch zu wenig Text für eine Wortwolke.</p>`}
        <p class="ca-legend"><span class="c-a">${esc(data.names[0])}</span> &middot; <span class="c-b">${esc(data.names[1])}</span> &middot; <span>beide</span></p>
      </div>

      <h2 class="ca-heading">💬 Typisch für …</h2>
      <div class="ca-typical">${[0, 1].map(i => `
        <div class="card ca-typical-card">
          <h3 class="c-${colorOf(i)}">${esc(data.names[i])}</h3>
          ${words.typical[i].length ? `<ol>${words.typical[i].map(w => `<li><span>${esc(w.word)}</span><small>${num(w.count)}× &middot; ${esc(data.names[1 - i])} ${num(w.other)}×</small></li>`).join("")}</ol>` : `<p class="cw-note">Noch nichts Auffälliges.</p>`}
        </div>`).join("")}</div>
      <p class="ca-hint">„Typisch“ heißt: Das Wort benutzt die Person deutlich öfter als die andere.</p>`;
  }

  /* ---------- start ---------- */

  wireUpload();
  wireWrapped();
  loadData().then(saved => {
    if (saved && saved.msgs && saved.msgs.length) show(saved);
  });
})();
