/* Versus – who knows the other better? Pure rules without DOM, shared by questions.js
   (window.VersusEngine) and the node tests (module.exports).

   Like LovBirdz: a round has six questions and two roles. For questions 1–3 the first player
   answers about themself and the second one guesses; for 4–6 the roles swap. Everybody types at
   their own pace, one question after the other. When both have all six, the round is revealed
   question by question: whoever answered says whether the guess was right. */
(function () {
  const bank = typeof module !== "undefined" && module.exports
    ? require("./versus-questions.js")
    : window.VersusQuestions;

  const PER_ROUND = 3;
  const QUESTIONS_PER_ROUND = PER_ROUND * 2;
  const MIXED = "mixed";
  const FORMAT = 4;
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

  /* six different questions per round; only when a category is used up do its questions come again
     (the other categories keep their memory) */
  function drawQuestions(category, used, rand) {
    const pool = bank.QUESTIONS.filter(q => category === MIXED || q.cat === category);
    let fresh = pool.filter(q => !used.includes(q.id));
    let nextUsed = used;
    if (fresh.length < QUESTIONS_PER_ROUND) {
      const poolIds = new Set(pool.map(q => q.id));
      fresh = pool.slice();
      nextUsed = used.filter(id => !poolIds.has(id));
    }
    const picked = [];
    const candidates = fresh.slice();
    while (picked.length < QUESTIONS_PER_ROUND && candidates.length) {
      picked.push(candidates.splice(Math.floor(rand() * candidates.length), 1)[0].id);
    }
    return { picked, used: [...nextUsed, ...picked] };
  }

  function freshRound(players, picked) {
    return {
      phase: "play",
      questions: picked,
      inputs: Object.fromEntries(players.map(p => [p, []])),
      verdicts: Array(QUESTIONS_PER_ROUND).fill(null)
    };
  }

  /* memory: the questions earlier games already played, so a new game does not start with repeats */
  function createInitialState(host, guest, option, rand = Math.random, memory = null) {
    const category = bank.CATEGORIES[option] ? option : MIXED;
    const known = Array.isArray(memory) ? memory.filter(id => questionById(id)) : [];
    const drawn = drawQuestions(category, known, rand);
    return {
      v: FORMAT,
      players: [host, guest],
      category,
      round: 1,
      ...freshRound([host, guest], drawn.picked),
      scores: { [host]: 0, [guest]: 0 },
      used: drawn.used,
      history: [],
      moveSeq: 0
    };
  }

  /* questions 1–3: the first player answers, the second guesses; 4–6 the other way round */
  function rolesAt(state, index) {
    const [a, b] = state.players;
    return index < PER_ROUND ? { answerer: a, guesser: b } : { answerer: b, guesser: a };
  }

  /* how far somebody has typed: the index of their next question (6 = done) */
  function progressOf(state, person) {
    return ((state.inputs || {})[person] || []).length;
  }

  function answerAt(state, index) {
    return state.inputs[rolesAt(state, index).answerer][index];
  }

  function guessAt(state, index) {
    return state.inputs[rolesAt(state, index).guesser][index];
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT) : "";
  }

  /* my next question: as the answerer my answer, as the guesser my guess */
  function submitText(state, person, value) {
    assertPlayer(state, person);
    if (state.phase !== "play") throw new Error("Gerade wird nicht getippt.");
    const text = cleanText(value);
    if (!text) throw new Error("Bitte erst etwas eintippen.");
    const mine = state.inputs[person] || [];
    if (mine.length >= QUESTIONS_PER_ROUND) throw new Error("Du hast schon alle Fragen beantwortet.");

    const inputs = { ...state.inputs, [person]: [...mine, text] };
    const next = { ...state, inputs, moveSeq: (state.moveSeq || 0) + 1 };
    if (state.players.every(p => (inputs[p] || []).length === QUESTIONS_PER_ROUND)) next.phase = "judge";
    return next;
  }

  /* the reveal: whoever answered says whether the guess was right */
  function judge(state, person, index, right) {
    assertPlayer(state, person);
    if (state.phase !== "judge") throw new Error("Gerade wird nicht aufgelöst.");
    if (!Number.isInteger(index) || index < 0 || index >= QUESTIONS_PER_ROUND) throw new Error("Diese Frage gibt es nicht.");
    const { answerer } = rolesAt(state, index);
    if (person !== answerer) throw new Error(`${answerer} entscheidet, ob du richtig liegst.`);
    if (state.verdicts[index] !== null) throw new Error("Diese Frage ist schon bewertet.");
    if (typeof right !== "boolean") throw new Error("Richtig oder falsch?");

    const verdicts = state.verdicts.slice();
    verdicts[index] = right;
    const next = { ...state, verdicts, moveSeq: (state.moveSeq || 0) + 1 };
    if (verdicts.some(v => v === null)) return next;

    const totals = roundTotals(next);
    const scores = Object.fromEntries(state.players.map(p => [p, (state.scores[p] || 0) + totals[p]]));
    return { ...next, phase: "reveal", scores, history: [...(state.history || []), { round: state.round, totals }] };
  }

  /* a guesser scores one point for every guess that was called right */
  function roundTotals(state) {
    const totals = Object.fromEntries(state.players.map(p => [p, 0]));
    state.verdicts.forEach((right, i) => {
      if (right) totals[rolesAt(state, i).guesser]++;
    });
    return totals;
  }

  function nextRound(state, person, rand = Math.random) {
    assertPlayer(state, person);
    if (state.phase !== "reveal") throw new Error("Die Runde läuft noch.");
    const drawn = drawQuestions(state.category, state.used || [], rand);
    return {
      ...state,
      round: state.round + 1,
      ...freshRound(state.players, drawn.picked),
      used: drawn.used,
      moveSeq: (state.moveSeq || 0) + 1
    };
  }

  function memoryOf(state) {
    return state && Array.isArray(state.used) ? state.used.slice() : [];
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
    memoryOf,
    rolesAt,
    progressOf,
    answerAt,
    guessAt,
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
