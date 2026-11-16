/* Song-Quiz – which song is this, who sings it? Pure rules without DOM, shared by songquiz.js
   (window.SongQuizEngine) and the node tests (module.exports).

   The songs come from our shared Spotify playlist (playlist.json). A round plays five 30-second previews,
   one after the other, on both phones. For each one both pick one of four answers; when both have picked,
   the answer is revealed: a right answer is a point, and when both are right the faster one gets a
   ⚡ bonus point. Two players, no computer players. */
(function () {
  const SONGS_PER_ROUND = 5;
  const OPTIONS = 4;
  const FORMAT = 1;
  /* longest time that counts for the speed bonus; anything slower is "slow" */
  const MAX_MS = 120000;
  const MODES = ["mix", "title", "artist"];

  const norm = text => String(text || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

  /* every song with a title and an artist; only songs with a preview can be asked */
  function buildPool(playlist) {
    const songs = ((playlist && playlist.tracks) || [])
      .filter(t => t && t.id && t.title && Array.isArray(t.artists) && t.artists.length)
      .map(t => ({
        id: String(t.id),
        title: String(t.title).replace(/^[\s⁠]+/, ""),
        artists: t.artists.map(a => String(a).trim()).filter(Boolean),
        preview: String(t.preview || ""),
        cover: String(t.cover || ""),
        released: String(t.released || "")
      }));
    return { name: String((playlist && playlist.name) || "Playlist"), songs };
  }

  const playable = pool => pool.songs.filter(s => s.preview);

  /* why a game cannot start yet, or null */
  function poolProblem(pool) {
    if (!pool || playable(pool).length < OPTIONS) return "Für das Song-Quiz braucht die Playlist mindestens vier Songs mit Hörprobe.";
    if (new Set(pool.songs.map(s => norm(s.title))).size < OPTIONS || new Set(pool.songs.map(s => norm(s.artists[0]))).size < OPTIONS) {
      return "Für das Song-Quiz braucht die Playlist mehr verschiedene Songs.";
    }
    return null;
  }

  function assertPlayer(state, person) {
    if (!state.players.includes(person)) throw new Error("Du spielst in dieser Runde nicht mit.");
  }

  function partnerOf(state, person) {
    return state.players[0] === person ? state.players[1] : state.players[0];
  }

  function emptyPicks(players) {
    return Object.fromEntries(players.map(p => [p, null]));
  }

  function shuffle(list, rand) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* three wrong answers of the same kind: other titles, or main artists that are not on the song at all */
  function buildQuestion(song, kind, pool, rand) {
    const right = kind === "artist" ? song.artists[0] : song.title;
    const taken = new Set(kind === "artist" ? song.artists.map(norm) : [norm(song.title)]);
    const wrong = [];
    for (const other of shuffle(pool.songs, rand)) {
      if (wrong.length >= OPTIONS - 1) break;
      const label = kind === "artist" ? other.artists[0] : other.title;
      if (taken.has(norm(label))) continue;
      taken.add(norm(label));
      wrong.push(label);
    }
    const options = shuffle([right, ...wrong], rand);
    return {
      song: { id: song.id, title: song.title, artists: song.artists, preview: song.preview, cover: song.cover, released: song.released },
      kind,
      options,
      answer: options.indexOf(right)
    };
  }

  /* songs nobody has heard in a quiz yet; only when too few are left do all of them come again */
  function drawSongs(pool, used, rand) {
    const all = playable(pool);
    let fresh = all.filter(s => !used.includes(s.id));
    let nextUsed = used;
    if (fresh.length < Math.min(SONGS_PER_ROUND, all.length)) {
      fresh = all.slice();
      nextUsed = [];
    }
    const picked = shuffle(fresh, rand).slice(0, SONGS_PER_ROUND);
    return { picked, used: [...nextUsed, ...picked.map(s => s.id)] };
  }

  function freshRound(players, pool, mode, picked, rand) {
    /* mixed: alternate, starting at random, so both kinds always come up */
    const offset = rand() < 0.5 ? 0 : 1;
    const kindAt = i => (mode === "mix" ? ((i + offset) % 2 ? "artist" : "title") : mode);
    return {
      phase: "play",
      questions: picked.map((song, i) => buildQuestion(song, kindAt(i), pool, rand)),
      index: 0,
      picks: emptyPicks(players),
      answers: picked.map(() => null),
      readyNext: []
    };
  }

  /* memory: the songs earlier games already played, so a new game starts with new ones */
  function createInitialState(host, guest, pool, mode = "mix", rand = Math.random, memory = null) {
    const problem = poolProblem(pool);
    if (problem) throw new Error(problem);
    const option = MODES.includes(mode) ? mode : "mix";
    const known = Array.isArray(memory) ? memory.map(String) : [];
    const drawn = drawSongs(pool, known, rand);
    return {
      v: FORMAT,
      option,
      players: [host, guest],
      round: 1,
      ...freshRound([host, guest], pool, option, drawn.picked, rand),
      scores: { [host]: 0, [guest]: 0 },
      used: drawn.used,
      moveSeq: 0
    };
  }

  function currentQuestion(state) {
    return state.questions[state.index];
  }

  const cleanMs = ms => Math.max(0, Math.min(MAX_MS, Math.round(Number(ms) || 0)));

  /* points per player for one answered question: 1 for right, +1 for the faster of two right answers */
  function pointsFor(question, picks, players) {
    const right = players.filter(p => picks[p] && picks[p].choice === question.answer);
    const points = Object.fromEntries(players.map(p => [p, right.includes(p) ? 1 : 0]));
    let fastest = null;
    if (right.length === players.length && players.length === 2) {
      const [a, b] = players;
      if (picks[a].ms !== picks[b].ms) fastest = picks[a].ms < picks[b].ms ? a : b;
    }
    if (fastest) points[fastest] += 1;
    return { points, fastest };
  }

  /* my answer for the song that is playing; the answer shows as soon as both have picked.
     ms: how long this phone had been playing the song (for the speed bonus) */
  function pick(state, person, choice, ms) {
    assertPlayer(state, person);
    if (state.phase !== "play") throw new Error("Gerade wird nicht geraten.");
    const index = Number(choice);
    if (!Number.isInteger(index) || index < 0 || index >= currentQuestion(state).options.length) throw new Error("Diese Antwort gibt es nicht.");
    if (state.picks[person] !== null) throw new Error("Du hast schon geantwortet.");

    const picks = { ...state.picks, [person]: { choice: index, ms: cleanMs(ms) } };
    const next = { ...state, picks, moveSeq: (state.moveSeq || 0) + 1 };
    if (!state.players.every(p => picks[p] !== null)) return next;

    const { points, fastest } = pointsFor(currentQuestion(state), picks, state.players);
    const answers = state.answers.slice();
    answers[state.index] = { picks, points, fastest };
    const scores = Object.fromEntries(state.players.map(p => [p, (state.scores[p] || 0) + points[p]]));
    return { ...next, phase: "reveal", answers, scores };
  }

  /* both are ready after a reveal: the next song, or the result after the last one */
  function advance(state) {
    if (state.phase !== "reveal") return state;
    const next = { ...state, readyNext: [], moveSeq: (state.moveSeq || 0) + 1 };
    if (state.index + 1 >= state.questions.length) return { ...next, phase: "summary" };
    return { ...next, phase: "play", index: state.index + 1, picks: emptyPicks(state.players) };
  }

  function nextRound(state, person, pool, rand = Math.random) {
    if (state.phase !== "summary") return state;
    const problem = poolProblem(pool);
    if (problem) throw new Error(problem);
    const drawn = drawSongs(pool, state.used || [], rand);
    return {
      ...state,
      round: state.round + 1,
      ...freshRound(state.players, pool, state.option || "mix", drawn.picked, rand),
      used: drawn.used,
      moveSeq: (state.moveSeq || 0) + 1
    };
  }

  /* points a player made in this round */
  function roundScore(state, person) {
    return state.answers.reduce((sum, a) => sum + (a && a.points ? a.points[person] || 0 : 0), 0);
  }

  function isRight(state, index, person) {
    const a = state.answers[index];
    return Boolean(a && a.picks[person] && a.picks[person].choice === state.questions[index].answer);
  }

  function leader(state) {
    const [a, b] = state.players;
    if (state.scores[a] === state.scores[b]) return null;
    return state.scores[a] > state.scores[b] ? a : b;
  }

  function memoryOf(state) {
    return state && Array.isArray(state.used) ? state.used.slice() : [];
  }

  function isCurrentFormat(state) {
    return Boolean(state) && state.v === FORMAT;
  }

  const api = {
    SONGS_PER_ROUND,
    OPTIONS,
    MAX_MS,
    MODES,
    buildPool,
    poolProblem,
    createInitialState,
    currentQuestion,
    partnerOf,
    pick,
    advance,
    nextRound,
    roundScore,
    isRight,
    leader,
    memoryOf,
    isCurrentFormat
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.SongQuizEngine = api;
})();
