/* Geo-Guesser – on which trip was this photo taken? Pure rules without DOM, shared by geo.js
   (window.GeoEngine) and the node tests (module.exports).

   A round shows up to five photos from the trips, one after the other, to both players at the same time.
   Everybody picks the trip they think the photo belongs to; when both have picked, the answer is
   revealed and every right pick scores a point. Two players, no computer players. */
(function () {
  const PHOTOS_PER_ROUND = 5;
  const MIN_TRIPS = 2;
  const MIN_PHOTOS = 3;
  const FORMAT = 1;

  /* every trip is in the list to pick from (newest first), but only trips with photos can be the answer;
     ids are compared as text everywhere */
  function buildPool(trips, images) {
    const options = (trips || [])
      .filter(t => t && t.id !== undefined && t.id !== null)
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))
      .map(t => ({
        id: String(t.id),
        title: String(t.title || "Reise"),
        location: String(t.location || ""),
        year: /^\d{4}/.test(t.start_date || "") ? String(t.start_date).slice(0, 4) : ""
      }));
    const known = new Set(options.map(t => t.id));
    const photos = (images || [])
      .filter(i => i && i.image_url && known.has(String(i.trip_id)))
      .map(i => ({ id: String(i.id), url: String(i.image_url), trip: String(i.trip_id) }));
    return { trips: options, photos };
  }

  /* why a game cannot start yet, or null */
  function poolProblem(pool) {
    if (!pool || new Set(pool.photos.map(p => p.trip)).size < MIN_TRIPS) return "Für Geo-Guesser braucht ihr Fotos von mindestens zwei Reisen.";
    if (pool.photos.length < MIN_PHOTOS) return "Für Geo-Guesser braucht ihr noch ein paar mehr Reisefotos.";
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

  /* photos nobody has seen yet; only when too few are left do all of them come again */
  function drawPhotos(pool, used, rand) {
    let fresh = pool.photos.filter(p => !used.includes(p.id));
    let nextUsed = used;
    if (fresh.length < Math.min(PHOTOS_PER_ROUND, pool.photos.length)) {
      fresh = pool.photos.slice();
      nextUsed = [];
    }
    const picked = [];
    while (picked.length < PHOTOS_PER_ROUND && fresh.length) {
      picked.push(fresh.splice(Math.floor(rand() * fresh.length), 1)[0]);
    }
    return { picked, used: [...nextUsed, ...picked.map(p => p.id)] };
  }

  function freshRound(players, picked) {
    return {
      phase: "play",
      photos: picked,
      index: 0,
      picks: emptyPicks(players),
      answers: picked.map(() => null),
      readyNext: []
    };
  }

  /* memory: the photos earlier games already showed, so a new game starts with new ones */
  function createInitialState(host, guest, pool, rand = Math.random, memory = null) {
    const problem = poolProblem(pool);
    if (problem) throw new Error(problem);
    const known = Array.isArray(memory) ? memory.map(String) : [];
    const drawn = drawPhotos(pool, known, rand);
    return {
      v: FORMAT,
      players: [host, guest],
      trips: pool.trips,
      round: 1,
      ...freshRound([host, guest], drawn.picked),
      scores: { [host]: 0, [guest]: 0 },
      used: drawn.used,
      moveSeq: 0
    };
  }

  function currentPhoto(state) {
    return state.photos[state.index];
  }

  function tripById(state, id) {
    return state.trips.find(t => t.id === String(id)) || null;
  }

  /* my pick for the photo on the table; the answer shows as soon as both have picked */
  function pick(state, person, tripId) {
    assertPlayer(state, person);
    if (state.phase !== "play") throw new Error("Gerade wird nicht getippt.");
    if (!tripById(state, tripId)) throw new Error("Diese Reise gibt es nicht.");
    if (state.picks[person] !== null) throw new Error("Du hast schon getippt.");

    const picks = { ...state.picks, [person]: String(tripId) };
    const next = { ...state, picks, moveSeq: (state.moveSeq || 0) + 1 };
    if (!state.players.every(p => picks[p] !== null)) return next;

    const right = currentPhoto(state).trip;
    const answers = state.answers.slice();
    answers[state.index] = picks;
    const scores = Object.fromEntries(state.players.map(p => [p, (state.scores[p] || 0) + (picks[p] === right ? 1 : 0)]));
    return { ...next, phase: "reveal", answers, scores };
  }

  /* both are ready after a reveal: the next photo, or the result after the last one */
  function advance(state) {
    if (state.phase !== "reveal") return state;
    const next = { ...state, readyNext: [], moveSeq: (state.moveSeq || 0) + 1 };
    if (state.index + 1 >= state.photos.length) return { ...next, phase: "summary" };
    return { ...next, phase: "play", index: state.index + 1, picks: emptyPicks(state.players) };
  }

  function nextRound(state, person, pool, rand = Math.random) {
    if (state.phase !== "summary") return state;
    const problem = poolProblem(pool);
    if (problem) throw new Error(problem);
    const drawn = drawPhotos(pool, state.used || [], rand);
    return {
      ...state,
      trips: pool.trips,
      round: state.round + 1,
      ...freshRound(state.players, drawn.picked),
      used: drawn.used,
      moveSeq: (state.moveSeq || 0) + 1
    };
  }

  /* how many of this round's photos a player got right */
  function roundScore(state, person) {
    return state.answers.reduce((sum, picks, i) => sum + (picks && picks[person] === state.photos[i].trip ? 1 : 0), 0);
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
    PHOTOS_PER_ROUND,
    buildPool,
    poolProblem,
    createInitialState,
    currentPhoto,
    tripById,
    partnerOf,
    pick,
    advance,
    nextRound,
    roundScore,
    leader,
    memoryOf,
    isCurrentFormat
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.GeoEngine = api;
})();
