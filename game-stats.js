/* Spiele-Statistik – how often and how long we played which game, and who won. Pure functions without DOM,
   shared by spielstats.js (window.GameStats) and the node tests (module.exports).

   Input: the rows of every game table (one row = one "Spieltisch", from the lobby until "Spiel beenden")
   and the rows of game_plays. Since 16.11.2026 game_plays measures the active play time of every table
   (server clock, pauses over 5 minutes do not count). Older tables only know when they were opened, when
   they were last saved and how many moves were made, so their time is estimated:
   - up to 3 hours between opening and the last save: that time counts as it is;
   - longer (left open for days): the moves times the usual seconds per move of that game. */
(function () {
  const PEOPLE = ["Isi", "Benji"];
  const PLAUSIBLE_MIN = 180;
  const DEFAULT_SECONDS_PER_MOVE = 8;

  /* every game, in the order of the Spiele page; unit: what one "played" counts */
  const GAMES = [
    { table: "cabo_games", name: "Cabo", icon: "🦄", unit: "Runden" },
    { table: "nimmt_games", name: "6 nimmt!", icon: "🐮", unit: "Partien" },
    { table: "qwixx_games", name: "Qwixx", icon: "🎲", unit: "Partien" },
    { table: "flip7_games", name: "Flip 7", icon: "🃏", unit: "Partien" },
    { table: "gipfel_games", name: "Phase 10", icon: "🎯", unit: "Partien" },
    { table: "murphy_games", name: "Murphys Gesetz", icon: "🍞", unit: "Partien" },
    { table: "geo_games", name: "Geo-Guesser", icon: "📍", unit: "Runden" },
    { table: "songquiz_games", name: "Song-Quiz", icon: "🎧", unit: "Runden" }
  ];

  const minutesBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
  const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

  /* how many games/rounds a table played and who won them, from its state (or game_plays.summary) */
  function outcome(table, state) {
    const s = state || {};
    const wins = Object.fromEntries(PEOPLE.map(p => [p, 0]));
    let played = 0;
    if (table === "cabo_games") {
      /* every finished round has a score row; the whole game has one winner */
      played = Math.max(0, num(s.round) - (s.gameOver ? 0 : 1));
      if (s.scores && typeof s.scores === "object") {
        const lengths = Object.values(s.scores).map(v => (Array.isArray(v) ? v.length : 0));
        played = Math.max(played, ...lengths, 0);
      }
      if (s.gameOver && PEOPLE.includes(s.winner)) wins[s.winner] += 1;
    } else if (table === "geo_games" || table === "songquiz_games") {
      played = Math.max(0, num(s.round) - (s.phase === "summary" ? 0 : 1)) || (num(s.moveSeq) > 0 ? 1 : 0);
      /* the whole table: who is ahead at the end */
      const scores = s.scores || {};
      const [a, b] = PEOPLE;
      if (num(s.moveSeq) > 0 && a in scores && b in scores && num(scores[a]) !== num(scores[b])) {
        wins[num(scores[a]) > num(scores[b]) ? a : b] += 1;
      }
    } else {
      const w = s.wins && typeof s.wins === "object" ? s.wins : {};
      played = Object.values(w).reduce((sum, v) => sum + num(v), 0);
      for (const p of PEOPLE) wins[p] += num(w[p]);
    }
    return { played, wins };
  }

  /* one entry per table that really started (not still waiting in the lobby) */
  function sessions(tables, plays) {
    const measured = new Map((plays || []).map(p => [`${p.game}:${p.game_id}`, p]));
    const out = [];
    for (const game of GAMES) {
      for (const row of (tables && tables[game.table]) || []) {
        if (!row || row.status === "waiting") continue;
        const state = row.state || {};
        const play = measured.get(`${game.table}:${row.id}`);
        const source = play && play.summary && Object.keys(play.summary).length ? play.summary : state;
        const players = Array.isArray(state.players) ? state.players : (play && play.players) || [];
        out.push({
          table: game.table,
          id: row.id,
          startedAt: row.created_at,
          lastAt: row.updated_at || row.created_at,
          moves: Math.max(num(state.moveSeq), play ? num(play.moves) : 0),
          rawMinutes: Math.max(0, minutesBetween(row.created_at, row.updated_at || row.created_at)),
          measuredSeconds: play ? num(play.active_seconds) : null,
          players,
          withOthers: players.some(p => !PEOPLE.includes(p)),
          ...outcome(game.table, source)
        });
      }
    }
    return out;
  }

  /* seconds per move of each game, learned from the tables with a plausible length */
  function paces(list) {
    const out = {};
    for (const game of GAMES) {
      const known = list.filter(s => s.table === game.table && s.measuredSeconds === null && s.moves > 0 && s.rawMinutes >= 1 && s.rawMinutes <= PLAUSIBLE_MIN);
      const moves = known.reduce((sum, s) => sum + s.moves, 0);
      const seconds = known.reduce((sum, s) => sum + s.rawMinutes * 60, 0);
      out[game.table] = moves >= 20 ? seconds / moves : DEFAULT_SECONDS_PER_MOVE;
    }
    return out;
  }

  function secondsOf(session, pace) {
    if (session.measuredSeconds !== null) return { seconds: session.measuredSeconds, how: "measured" };
    if (session.rawMinutes >= 1 && session.rawMinutes <= PLAUSIBLE_MIN) return { seconds: session.rawMinutes * 60, how: "span" };
    return { seconds: session.moves * pace, how: "pace" };
  }

  /* Monday of the week a date falls in, as "YYYY-MM-DD" in local time */
  function weekOf(iso) {
    const d = new Date(iso);
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  }

  function summarize(tables, plays) {
    const list = sessions(tables, plays);
    const pace = paces(list);
    for (const s of list) Object.assign(s, secondsOf(s, pace[s.table]));

    const games = GAMES.map(game => {
      const mine = list.filter(s => s.table === game.table);
      const wins = Object.fromEntries(PEOPLE.map(p => [p, mine.reduce((sum, s) => sum + s.wins[p], 0)]));
      return {
        ...game,
        tables: mine.length,
        played: mine.reduce((sum, s) => sum + s.played, 0),
        moves: mine.reduce((sum, s) => sum + s.moves, 0),
        seconds: mine.reduce((sum, s) => sum + s.seconds, 0),
        withOthers: mine.filter(s => s.withOthers).length,
        wins,
        lastAt: mine.reduce((latest, s) => (!latest || s.lastAt > latest ? s.lastAt : latest), null),
        secondsPerMove: Math.round(pace[game.table])
      };
    }).sort((a, b) => b.seconds - a.seconds || b.tables - a.tables);

    const weeks = new Map();
    const weekdays = Array(7).fill(0);
    for (const s of list) {
      const w = weekOf(s.startedAt);
      weeks.set(w, (weeks.get(w) || 0) + s.seconds);
      weekdays[(new Date(s.startedAt).getDay() + 6) % 7] += s.seconds;
    }
    const weekList = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, seconds]) => ({ week, seconds }));

    const wins = Object.fromEntries(PEOPLE.map(p => [p, games.reduce((sum, g) => sum + g.wins[p], 0)]));
    const longest = list.slice().sort((a, b) => b.seconds - a.seconds)[0] || null;
    const busiestWeek = weekList.slice().sort((a, b) => b.seconds - a.seconds)[0] || null;
    const measuredSince = (plays || []).reduce((first, p) => (!first || p.started_at < first ? p.started_at : first), null);

    return {
      totalSeconds: list.reduce((sum, s) => sum + s.seconds, 0),
      tables: list.length,
      played: list.reduce((sum, s) => sum + s.played, 0),
      moves: list.reduce((sum, s) => sum + s.moves, 0),
      measuredTables: list.filter(s => s.how === "measured").length,
      estimatedTables: list.filter(s => s.how === "pace").length,
      measuredSince,
      firstAt: list.reduce((first, s) => (!first || s.startedAt < first ? s.startedAt : first), null),
      games,
      wins,
      weeks: weekList,
      weekdays,
      longest: longest ? { ...longest, game: GAMES.find(g => g.table === longest.table) } : null,
      busiestWeek
    };
  }

  /* "32 Std. 5 Min.", "12 Min.", "45 Sek." */
  function formatSeconds(seconds) {
    const total = Math.round(num(seconds));
    if (total < 60) return `${total} Sek.`;
    const minutes = Math.round(total / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} Min.`;
    return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  }

  const api = { GAMES, PEOPLE, PLAUSIBLE_MIN, outcome, sessions, paces, summarize, weekOf, formatSeconds };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.GameStats = api;
})();
