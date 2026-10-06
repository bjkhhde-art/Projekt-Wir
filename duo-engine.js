/* "Wir zwei" in a lobby for the two of us:
   - "daily": today's question, both answer at the same time (own answer + guess), then reveal
   - "who" / "hotnot": a round of six, both answer secretly, then we see where we agree.
   Pure logic – used by duo.js through game-room.js and by the node tests. */
(function () {
  const inNode = typeof module !== "undefined" && module.exports;
  const Content = inNode ? require("./duo-content.js") : window.DuoContent;
  const Daily = inNode ? require("./duo-daily.js") : window.DuoDaily;
  const ROUND_SIZE = 6;
  const MODES = {
    daily: { label: "Frage des Tages", pool: () => Content.DAILY },
    who: { label: "Wer von uns beiden?", pool: () => Content.WHO },
    hotnot: { label: "Hot oder Not?", pool: () => Content.HOTNOT }
  };

  function pick(count, poolSize, used, rand) {
    let free = Array.from({ length: poolSize }, (_, i) => i).filter(i => !used.includes(i));
    let reset = false;
    if (free.length < count) {
      free = Array.from({ length: poolSize }, (_, i) => i);
      reset = true;
    }
    const chosen = [];
    while (chosen.length < count) {
      const index = Math.floor(rand() * free.length);
      chosen.push(free.splice(index, 1)[0]);
    }
    return { chosen, reset };
  }

  /* today's question, answered together */
  function createDailyState(host, guest, now) {
    const day = Daily.dayKey(now);
    const question = Daily.questionFor(day, Content.DAILY);
    return {
      players: [host, guest],
      mode: "daily",
      day,
      questionId: question.id,
      answers: {},
      phase: "answer",
      results: null,
      moveSeq: 1,
      lastMove: { type: "deal", seq: 1 }
    };
  }

  function dailyQuestion(state) {
    return Content.DAILY.find(q => q.id === state.questionId) || null;
  }

  function submitDaily(state, person, answer, guess) {
    if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
    if (state.phase !== "answer") throw new Error("Die Frage ist schon aufgedeckt.");
    if (state.answers[person]) throw new Error("Du hast schon geantwortet.");
    const valid = v => Number.isInteger(v) && v >= 0 && v <= 3;
    if (!valid(answer) || !valid(guess)) throw new Error("Bitte wähle deine Antwort und deinen Tipp.");
    const next = JSON.parse(JSON.stringify(state));
    next.answers[person] = { answer, guess };
    next.moveSeq = (next.moveSeq || 0) + 1;
    next.lastMove = { type: "answer", person, seq: next.moveSeq };
    if (next.players.every(p => next.answers[p])) {
      const [a, b] = next.players;
      next.results = {
        hits: { [a]: next.answers[a].guess === next.answers[b].answer, [b]: next.answers[b].guess === next.answers[a].answer }
      };
      next.phase = "reveal";
    }
    return next;
  }

  function createInitialState(host, guest, mode, rand = Math.random) {
    if (mode === "daily") return createDailyState(host, guest);
    const type = MODES[mode] ? mode : "who";
    const { chosen } = pick(ROUND_SIZE, MODES[type].pool().length, [], rand);
    return {
      players: [host, guest],
      mode: type,
      round: 1,
      items: chosen,
      used: chosen.slice(),
      answers: {},
      phase: "answer",
      results: null,
      history: [],
      moveSeq: 1,
      lastMove: { type: "deal", seq: 1 }
    };
  }

  function validAnswer(state, value) {
    return state.mode === "who" ? state.players.includes(value) : value === "hot" || value === "not";
  }

  function submitAnswers(state, person, answers) {
    if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
    if (state.phase !== "answer") throw new Error("Die Runde ist schon aufgedeckt.");
    if (state.answers[person]) throw new Error("Du hast schon geantwortet.");
    if (!Array.isArray(answers) || answers.length !== state.items.length || !answers.every(a => validAnswer(state, a))) {
      throw new Error("Bitte beantworte alle Fragen.");
    }
    const next = JSON.parse(JSON.stringify(state));
    next.answers[person] = answers.slice();
    next.moveSeq = (next.moveSeq || 0) + 1;
    next.lastMove = { type: "answer", person, seq: next.moveSeq };
    if (next.players.every(p => next.answers[p])) {
      const [a, b] = next.players;
      const perItem = next.items.map((item, i) => ({ item, [a]: next.answers[a][i], [b]: next.answers[b][i], match: next.answers[a][i] === next.answers[b][i] }));
      const matches = perItem.filter(r => r.match).length;
      next.results = { perItem, matches };
      next.phase = "reveal";
      next.history = [...(next.history || []), { round: next.round, matches }];
    }
    return next;
  }

  function nextRound(state, person, rand = Math.random) {
    if (state.phase !== "reveal") throw new Error("Erst aufdecken, dann weiter.");
    const { chosen, reset } = pick(ROUND_SIZE, MODES[state.mode].pool().length, state.used || [], rand);
    return {
      ...JSON.parse(JSON.stringify(state)),
      round: state.round + 1,
      items: chosen,
      used: reset ? chosen.slice() : [...(state.used || []), ...chosen],
      answers: {},
      phase: "answer",
      results: null,
      readyNext: [],
      moveSeq: (state.moveSeq || 0) + 1,
      lastMove: { type: "deal", seq: (state.moveSeq || 0) + 1 }
    };
  }

  function itemText(state, index) {
    return MODES[state.mode].pool()[index] || "";
  }

  function verdict(matches, total) {
    if (matches === total) return "Komplett einer Meinung – Seelenverwandte! 💞";
    if (matches >= total - 1) return "Fast immer einig – ihr kennt euch richtig gut!";
    if (matches >= total / 2) return "Meistens auf einer Wellenlänge 😊";
    if (matches > 0) return "Da gibt's noch was zu besprechen 😏";
    return "Gegensätze ziehen sich an! 😂";
  }

  const api = { ROUND_SIZE, MODES, createInitialState, createDailyState, dailyQuestion, submitDaily, submitAnswers, nextRound, itemText, verdict };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.DuoEngine = api;
})();
