/* Versus – who knows the other better? Pure rules without DOM, shared by questions.js
   (window.VersusEngine) and the node tests (module.exports).

   A round has six questions: three about the first player, three about the second. Both type
   at the same time – their own answers to their three and a guess for each of the other's three.
   Then each judges the other's guesses on their own questions (right or wrong), and all is revealed. */
(function () {
  const bank = typeof module !== "undefined" && module.exports
    ? require("./versus-questions.js")
    : window.VersusQuestions;

  const PER_ROUND = 3;
  const MIXED = "mixed";
  const FORMAT = 2;

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
      v: FORMAT,
      players: [host, guest],
      category,
      round: 1,
      phase: "answer",
      questions: { [host]: drawn.first, [guest]: drawn.second },
      answers: {},
      guesses: {},
      verdicts: {},
      results: null,
      scores: { [host]: 0, [guest]: 0 },
      used: drawn.used,
      history: [],
      moveSeq: 0
    };
  }

  const MAX_TEXT = 140;

  function cleanText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT) : "";
  }

  function checkTexts(values) {
    if (!Array.isArray(values) || values.length !== PER_ROUND) throw new Error("Bitte alle sechs Fragen beantworten.");
    const texts = values.map(cleanText);
    if (texts.some(text => !text)) throw new Error("Bitte alle sechs Fragen beantworten.");
    return texts;
  }

  /* both type at the same time: three answers about themselves, three guesses about the other */
  function submitAnswers(state, person, answers, guesses) {
    assertPlayer(state, person);
    if (state.phase !== "answer") throw new Error("Die Antworten sind schon abgegeben.");
    if (state.answers[person]) throw new Error("Du hast schon geantwortet.");
    const ownTexts = checkTexts(answers);
    const guessTexts = checkTexts(guesses);

    const next = {
      ...state,
      answers: { ...state.answers, [person]: ownTexts },
      guesses: { ...state.guesses, [person]: guessTexts },
      moveSeq: (state.moveSeq || 0) + 1
    };
    if (state.players.every(p => next.answers[p])) next.phase = "judge";
    return next;
  }

  /* the one the questions are about decides whether the other one was right:
     the first three are judged by the first player, the second three by the second */
  function submitVerdicts(state, person, verdicts) {
    assertPlayer(state, person);
    if (state.phase !== "judge") throw new Error("Gerade wird nicht bewertet.");
    if ((state.verdicts || {})[person]) throw new Error("Du hast schon bewertet.");
    if (!Array.isArray(verdicts) || verdicts.length !== PER_ROUND || verdicts.some(v => typeof v !== "boolean")) {
      throw new Error("Bitte alle drei Tipps bewerten.");
    }

    const next = { ...state, verdicts: { ...(state.verdicts || {}), [person]: verdicts.slice() }, moveSeq: (state.moveSeq || 0) + 1 };
    if (!state.players.every(p => next.verdicts[p])) return next;

    /* both judged: the guesser scores a point for every tip the other one called right */
    const results = {};
    const scores = { ...state.scores };
    state.players.forEach(guesser => {
      const owner = partnerOf(state, guesser);
      const points = next.verdicts[owner].map(right => (right ? 1 : 0));
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
      verdicts: {},
      results: null,
      used: drawn.used,
      moveSeq: (state.moveSeq || 0) + 1
    };
  }

  /* a round from before typed answers (picked options) cannot be played on */
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
    MIXED,
    CATEGORIES: bank.CATEGORIES,
    questionById,
    partnerOf,
    createInitialState,
    MAX_TEXT,
    cleanText,
    submitAnswers,
    submitVerdicts,
    nextRound,
    isCurrentFormat,
    optionLabels,
    leader
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.VersusEngine = api;
})();
