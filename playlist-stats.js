/* Playlist-Wrapped – numbers about our shared Spotify playlist (playlist.json). Pure functions without DOM,
   shared by playlist.js (window.PlaylistStats) and the node tests (module.exports). */
(function () {
  const PEOPLE = ["Isi", "Benji"];

  const yearOf = date => (/^\d{4}/.test(String(date || "")) ? Number(String(date).slice(0, 4)) : null);
  const monthOf = date => (/^\d{4}-\d{2}/.test(String(date || "")) ? String(date).slice(0, 7) : null);
  const cleanTitle = title => String(title || "").replace(/^[\s⁠]+/, "");

  function songs(playlist) {
    return ((playlist && playlist.tracks) || [])
      .filter(t => t && t.title)
      .map((t, i) => ({ ...t, title: cleanTitle(t.title), artists: Array.isArray(t.artists) ? t.artists : [], position: i + 1, durationMs: Number(t.durationMs) || 0 }));
  }

  /* every credited artist counts, so a feature counts for both; ties are broken alphabetically */
  function topArtists(list, limit = 5) {
    const counts = new Map();
    for (const song of list) {
      for (const name of new Set(song.artists)) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"))
      .slice(0, limit);
  }

  function artistCount(list) {
    return new Set(list.flatMap(s => s.artists)).size;
  }

  /* songs per release year, every year between the oldest and the newest (gaps included, so the bars read
     as a timeline); with more than maxBars years the oldest ones share one "bis …" bar */
  function years(list, maxBars = 12) {
    const counts = new Map();
    for (const song of list) {
      const y = yearOf(song.released);
      if (y) counts.set(y, (counts.get(y) || 0) + 1);
    }
    if (!counts.size) return [];
    const max = Math.max(...counts.keys());
    const min = Math.min(...counts.keys());
    const from = max - min + 1 > maxBars ? max - maxBars + 2 : min;
    const out = [];
    if (from > min) {
      const older = [...counts.entries()].filter(([y]) => y < from).reduce((sum, [, c]) => sum + c, 0);
      out.push({ label: `bis ${String(from - 1).slice(2)}`, year: from - 1, older: true, count: older });
    }
    for (let y = from; y <= max; y++) out.push({ label: `'${String(y).slice(2)}`, year: y, count: counts.get(y) || 0 });
    return out;
  }

  const by = (list, key, dir) => list.filter(s => key(s) !== null && key(s) !== "").slice().sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : a.position - b.position))[0] || null;

  function records(list) {
    const dated = s => (yearOf(s.released) ? s.released : null);
    const len = s => (s.durationMs > 0 ? s.durationMs : null);
    return {
      oldest: by(list, dated, 1),
      newest: by(list, dated, -1),
      longest: by(list, len, -1),
      shortest: by(list, len, 1),
      mostArtists: list.filter(s => s.artists.length > 1).sort((a, b) => b.artists.length - a.artists.length || a.position - b.position)[0] || null
    };
  }

  /* the release year most songs come from, and how many songs are from the last two years */
  function freshness(list, now = new Date()) {
    const dated = list.filter(s => yearOf(s.released));
    if (!dated.length) return null;
    const thisYear = now.getFullYear();
    const recent = dated.filter(s => yearOf(s.released) >= thisYear - 1).length;
    const ys = dated.map(s => yearOf(s.released)).sort((a, b) => a - b);
    const median = ys[Math.floor((ys.length - 1) / 2)];
    return { recent, recentShare: recent / dated.length, median };
  }

  /* who put what in – only when playlist.json knows who added the songs (Spotify keys, see README) */
  function people(list) {
    const known = list.filter(s => PEOPLE.includes(s.addedBy));
    if (!known.length) return null;
    return PEOPLE.map(name => {
      const mine = known.filter(s => s.addedBy === name);
      const dated = mine.filter(s => s.addedAt).sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
      return {
        name,
        count: mine.length,
        share: mine.length / known.length,
        durationMs: mine.reduce((sum, s) => sum + s.durationMs, 0),
        topArtist: topArtists(mine, 1)[0] || null,
        first: dated[0] || null,
        latest: dated[dated.length - 1] || null
      };
    });
  }

  /* songs added per month (only with addedAt) */
  function months(list) {
    const counts = new Map();
    for (const song of list) {
      const m = monthOf(song.addedAt);
      if (m) counts.set(m, (counts.get(m) || 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  }

  function summarize(playlist, now = new Date()) {
    const list = songs(playlist);
    const durationMs = list.reduce((sum, s) => sum + s.durationMs, 0);
    const total = Math.max(Number(playlist && playlist.total) || 0, list.length);
    return {
      name: String((playlist && playlist.name) || "Playlist"),
      count: list.length,
      total,
      complete: list.length >= total,
      durationMs,
      averageMs: list.length ? Math.round(durationMs / list.length) : 0,
      artistCount: artistCount(list),
      topArtists: topArtists(list, 5),
      features: list.filter(s => s.artists.length > 1).length,
      years: years(list),
      freshness: freshness(list, now),
      records: records(list),
      people: people(list),
      months: months(list)
    };
  }

  /* "4 Std. 53 Min." */
  function formatDuration(ms) {
    const minutes = Math.round((Number(ms) || 0) / 60000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} Min.`;
    return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  }

  /* "3:27" */
  function formatClock(ms) {
    const seconds = Math.round((Number(ms) || 0) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  /* a random song with a preview, never the one just shown */
  function randomSong(playlist, exceptId = null, rand = Math.random) {
    const list = songs(playlist).filter(s => s.preview && s.id !== exceptId);
    return list.length ? list[Math.floor(rand() * list.length)] : null;
  }

  const api = { summarize, topArtists, years, records, people, months, formatDuration, formatClock, randomSong };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.PlaylistStats = api;
})();
