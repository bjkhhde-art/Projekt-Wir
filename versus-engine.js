/* Versus – who knows the other better? Pure rules without DOM, shared by questions.js
   (window.VersusEngine) and the node tests (module.exports).

   A round: both answer three questions about themselves (in secret, at the same time),
   then both guess the other's three answers, then both answers are revealed. */
(function () {
  const bank = typeof module !== "undefined" && module.exports
    ? require("./versus-questions.js")
    : window.VersusQuestions;

  const PER_ROUND = 3;
  const MIXED = "mixed";

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
    if (fresh.length < PER_ROUND * 2) {
      fresh = pool.slice();
      nextUsed = [];
    }
    const picked = [];
    const candidates = fresh.slice();
    while (picked.length < PER_ROUND * 2 && candidates.length) {
      picked.push(candidates.splice(Math.floor(rand() * candidates.length), 1)[0].id);
    }
    return { first: picked.slice(0, PER_ROUND), second: picked.slice(PER_ROUND), used: [...nextUsed, ...picked] };
  }

  function createInitialState(host, guest, option, rand = Math.random) {
    const category = bank.CATEGORIES[option] ? option : MIXED;
    const drawn = drawQuestions(category, [], rand);
    return {
      players: [host, guest],
      category,
      round: 1,
      phase: "answer",
      questions: { [host]: drawn.first, [guest]: drawn.second },
      answers: {},
      guesses: {},
      results: null,
      scores: { [host]: 0, [guest]: 0 },
      used: drawn.used,
      history: [],
      moveSeq: 0
    };
  }

  function validAnswer(question, value) {
    if (question.type === "pick") return value === 0 || value === 1;
    if (question.type === "scale") return Number.isInteger(value) && value >= 1 && value <= 5;
    if (question.type === "rank") {
      return Array.isArray(value) && value.length === 3 && [0, 1, 2].every(i => value.includes(i));
    }
    return false;
  }

  function checkSet(questionIds, values) {
    if (!Array.isArray(values) || values.length !== questionIds.length) throw new Error("Bitte alle drei Fragen beantworten.");
    questionIds.forEach((id, i) => {
      if (!validAnswer(questionById(id), values[i])) throw new Error("Bitte alle drei Fragen beantworten.");
    });
  }

  /* 1 point for a hit; half a point when close (scale off by one, rank with the right favourite) */
  function scoreGuess(question, answer, guess) {
    if (question.type === "pick") return answer === guess ? 1 : 0;
    if (question.type === "scale") {
      const diff = Math.abs(answer - guess);
      return diff === 0 ? 1 : diff === 1 ? 0.5 : 0;
    }
    if (answer.every((value, i) => value === guess[i])) return 1;
    return answer[0] === guess[0] ? 0.5 : 0;
  }

  function submitAnswers(state, person, answers) {
    assertPlayer(state, person);
    if (state.phase !== "answer") throw new Error("Die Antworten sind schon abgegeben.");
    if (state.answers[person]) throw new Error("Du hast schon geantwortet.");
    checkSet(state.questions[person], answers);

    const next = { ...state, answers: { ...state.answers, [person]: answers }, moveSeq: (state.moveSeq || 0) + 1 };
    if (state.players.every(p => next.answers[p])) next.phase = "guess";
    return next;
  }

  function submitGuesses(state, person, guesses) {
    assertPlayer(state, person);
    if (state.phase !== "guess") throw new Error("Gerade wird nicht geraten.");
    if (state.guesses[person]) throw new Error("Du hast schon getippt.");
    const partner = partnerOf(state, person);
    checkSet(state.questions[partner], guesses);

    const next = { ...state, guesses: { ...state.guesses, [person]: guesses }, moveSeq: (state.moveSeq || 0) + 1 };
    if (!state.players.every(p => next.guesses[p])) return next;

    /* both guessed: score each guesser on the partner's questions */
    const results = {};
    const scores = { ...state.scores };
    state.players.forEach(guesser => {
      const owner = partnerOf(state, guesser);
      const points = state.questions[owner].map((id, i) =>
        scoreGuess(questionById(id), next.answers[owner][i], next.guesses[guesser][i]));
      const total = points.reduce((sum, p) => sum + p, 0);
      results[guesser] = { points, total };
      scores[guesser] = (scores[guesser] || 0) + total;
    });

    return {
      ...next,
      phase: "reveal",
      results,
      scores,
      history: [...(state.history || []), { round: state.round, totals: Object.fromEntries(state.players.map(p => [p, results[p].total])) }]
    };
  }

  function nextRound(state, person, rand = Math.random) {
    assertPlayer(state, person);
    if (state.phase !== "reveal") throw new Error("Die Runde läuft noch.");
    const drawn = drawQuestions(state.category, state.used || [], rand);
    const [a, b] = state.players;
    return {
      ...state,
      round: state.round + 1,
      phase: "answer",
      questions: { [a]: drawn.first, [b]: drawn.second },
      answers: {},
      guesses: {},
      results: null,
      used: drawn.used,
      moveSeq: (state.moveSeq || 0) + 1
    };
  }

  /* the guesser sees the partner's question with names filled in */
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
    MIXED,
    CATEGORIES: bank.CATEGORIES,
    questionById,
    partnerOf,
    createInitialState,
    validAnswer,
    scoreGuess,
    submitAnswers,
    submitGuesses,
    nextRound,
    optionLabels,
    leader
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.VersusEngine = api;
})();
