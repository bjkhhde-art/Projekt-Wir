/* Versus – who knows the other better? Pure rules without DOM, shared by questions.js
   (window.VersusEngine) and the node tests (module.exports).

   Like LovBirdz: a round has six questions and two roles. For the first three the first player
   answers about themself and the second one guesses; then the roles swap. Both type at the same
   time; as soon as both are in, the one who answered says whether the guess was right – and the
   question is resolved right away. After six questions the round is summed up. */
(function () {
  const bank = typeof module !== "undefined" && module.exports
    ? require("./versus-questions.js")
    : window.VersusQuestions;

  const PER_ROUND = 3;
  const QUESTIONS_PER_ROUND = PER_ROUND * 2;
  const MIXED = "mixed";
  const FORMAT = 3;
  const MAX_TEXT = 140;

  function questionById(id) {
    return bank.QUESTIONS.find(q => q.id === id);
  }

  function partnerOf(state, person) {
    return state.players[0] === person ? state.players[1] : state.players[0];
  }

  function assertPlayer(state, person) {
    if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  }

  /* six different questions per round; once a category is used up it starts over */
  function drawQuestions(category, used, rand) {
    const pool = bank.QUESTIONS.filter(q => category === MIXED || q.cat === category);
    let fresh = pool.filter(q => !used.includes(q.id));
    let nextUsed = used;
    if (fresh.length < QUESTIONS_PER_ROUND) {
      fresh = pool.slice();
      nextUsed = [];
    }
    const picked = [];
    const candidates = fresh.slice();
    while (picked.length < QUESTIONS_PER_ROUND && candidates.length) {
      picked.push(candidates.splice(Math.floor(rand() * candidates.length), 1)[0].id);
    }
    return { picked, used: [...nextUsed, ...picked] };
  }

  function freshQuestion() {
    return { answer: null, guess: null };
  }

  function createInitialState(host, guest, option, rand = Math.random) {
    const category = bank.CATEGORIES[option] ? option : MIXED;
    const drawn = drawQuestions(category, [], rand);
    return {
      v: FORMAT,
      players: [host, guest],
      category,
      round: 1,
      phase: "input",
      questions: drawn.picked,
      index: 0,
      current: freshQuestion(),
      results: [],
      scores: { [host]: 0, [guest]: 0 },
      used: drawn.used,
      history: [],
      moveSeq: 0
    };
  }

  /* question 1–3: the first player answers, the second guesses; 4–6 the other way round */
  function rolesAt(state, index = state.index) {
    const [a, b] = state.players;
    return index < PER_ROUND ? { answerer: a, guesser: b } : { answerer: b, guesser: a };
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT) : "";
  }

  /* both type at the same time: the answerer their answer, the guesser their guess */
  function submitText(state, person, value) {
    assertPlayer(state, person);
    if (state.phase !== "input") throw new Error("Gerade wird nicht getippt.");
    const text = cleanText(value);
    if (!text) throw new Error("Bitte erst etwas eintippen.");
    const { answerer } = rolesAt(state);
    const field = person === answerer ? "answer" : "guess";
    if (state.current[field] !== null) throw new Error("Du hast schon geantwortet.");

    const current = { ...state.current, [field]: text };
    const next = { ...state, current, moveSeq: (state.moveSeq || 0) + 1 };
    if (current.answer !== null && current.guess !== null) next.phase = "judge";
    return next;
  }

  /* the one who answered says whether the guess was right – the question is resolved at once */
  function judge(state, person, right) {
    assertPlayer(state, person);
    if (state.phase !== "judge") throw new Error("Gerade wird nicht bewertet.");
    const { answerer, guesser } = rolesAt(state);
    if (person !== answerer) throw new Error(`${answerer} entscheidet, ob du richtig liegst.`);
    if (typeof right !== "boolean") throw new Error("Richtig oder falsch?");

    const result = { questionId: state.questions[state.index], answerer, guesser, answer: state.current.answer, guess: state.current.guess, right };
    const results = [...state.results, result];
    const scores = { ...state.scores, [guesser]: (state.scores[guesser] || 0) + (right ? 1 : 0) };
    const next = { ...state, results, scores, moveSeq: (state.moveSeq || 0) + 1 };

    if (state.index + 1 < QUESTIONS_PER_ROUND) {
      return { ...next, phase: "input", index: state.index + 1, current: freshQuestion() };
    }
    const totals = Object.fromEntries(state.players.map(p => [p, results.filter(r => r.guesser === p && r.right).length]));
    return { ...next, phase: "reveal", history: [...(state.history || []), { round: state.round, totals }] };
  }

  function roundTotals(state) {
    return Object.fromEntries(state.players.map(p => [p, state.results.filter(r => r.guesser === p && r.right).length]));
  }

  function nextRound(state, person, rand = Math.random) {
    assertPlayer(state, person);
    if (state.phase !== "reveal") throw new Error("Die Runde läuft noch.");
    const drawn = drawQuestions(state.category, state.used || [], rand);
    return {
      ...state,
      round: state.round + 1,
      phase: "input",
      questions: drawn.picked,
      index: 0,
      current: freshQuestion(),
      results: [],
      used: drawn.used,
      moveSeq: (state.moveSeq || 0) + 1
    };
  }

  /* a round from an older version of Versus cannot be played on */
  function isCurrentFormat(state) {
    return Boolean(state) && state.v === FORMAT;
  }

  /* the options of the old question bank are shown as a hint, with names filled in */
  function optionLabels(question, owner, viewer) {
    if (question.type === "scale") return [];
    return question.options.map(option => {
      if (option === "@self") return owner === viewer ? `${owner} (ich)` : owner;
      if (option === "@other") {
        const other = owner === "Isi" ? "Benji" : "Isi";
        return other === viewer ? `${other} (ich)` : other;
      }
      return option;
    });
  }

  function leader(state) {
    const [a, b] = state.players;
    if (state.scores[a] === state.scores[b]) return null;
    return state.scores[a] > state.scores[b] ? a : b;
  }

  const api = {
    PER_ROUND,
    QUESTIONS_PER_ROUND,
    MIXED,
    MAX_TEXT,
    CATEGORIES: bank.CATEGORIES,
    questionById,
    partnerOf,
    createInitialState,
    rolesAt,
    cleanText,
    submitText,
    judge,
    roundTotals,
    nextRound,
    isCurrentFormat,
    optionLabels,
    leader
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.VersusEngine = api;
})();
