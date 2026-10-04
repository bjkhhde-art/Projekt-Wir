/* Watchlist filters: several choices per group. Within a group any choice may match (OR),
   all groups with a choice must match (AND). Pure logic – used by watchlist.js
   (window.WatchlistFilter) and the node tests (module.exports). */
(function () {
  const STATUS_OPTIONS = [
    { value: "open", label: "🍿 Noch offen" },
    { value: "both", label: "👫 Zusammen" },
    { value: "Isi", label: "👤 Isi allein" },
    { value: "Benji", label: "👤 Benji allein" },
    { value: "unknown", label: "❔ Gesehen, ohne Angabe" }
  ];
  const TYPE_OPTIONS = [
    { value: "film", label: "🎬 Filme" },
    { value: "serie", label: "📺 Serien" }
  ];
  const NO_PLATFORM = "__none__";
  const DAY_MS = 24 * 3600 * 1000;

  function emptyFilters() {
    return { types: [], status: [], platforms: [], periods: [], from: "", to: "" };
  }

  /* platform names are compared without case or extra spaces */
  function platformKey(platform) {
    const value = (platform || "").trim().replace(/\s+/g, " ").toLowerCase();
    return value || NO_PLATFORM;
  }

  function statusOf(entry) {
    if (!entry.watched) return "open";
    return entry.seen_by || "unknown";
  }

  function periodMatches(period, watchedAt, now) {
    if (!watchedAt) return false;
    const time = new Date(watchedAt).getTime();
    if (period === "30d") return now - time <= 30 * DAY_MS;
    if (period === "90d") return now - time <= 90 * DAY_MS;
    if (/^\d{4}$/.test(period)) return new Date(watchedAt).getFullYear() === Number(period);
    return false;
  }

  /* from / to are yyyy-mm-dd (local days, both inclusive) */
  function rangeMatches(filters, watchedAt) {
    if (!filters.from && !filters.to) return true;
    if (!watchedAt) return false;
    const day = new Date(watchedAt);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    if (filters.from && key < filters.from) return false;
    if (filters.to && key > filters.to) return false;
    return true;
  }

  function matches(entry, filters, now = Date.now()) {
    if (filters.types.length && !filters.types.includes(entry.media_type)) return false;
    if (filters.status.length && !filters.status.includes(statusOf(entry))) return false;
    if (filters.platforms.length && !filters.platforms.includes(platformKey(entry.platform))) return false;
    if (filters.periods.length && !filters.periods.some(p => periodMatches(p, entry.watched_at, now))) return false;
    if (!rangeMatches(filters, entry.watched_at)) return false;
    return true;
  }

  function activeCount(filters) {
    return filters.types.length + filters.status.length + filters.platforms.length + filters.periods.length +
      (filters.from || filters.to ? 1 : 0);
  }

  /* choices offered for the current list: platforms and years that actually occur */
  function options(entries) {
    const platforms = new Map();
    entries.forEach(entry => {
      const key = platformKey(entry.platform);
      if (!platforms.has(key)) platforms.set(key, { value: key, label: "", count: 0, spellings: new Map() });
      const item = platforms.get(key);
      item.count++;
      if (key !== NO_PLATFORM) {
        const spelling = entry.platform.trim().replace(/\s+/g, " ");
        item.spellings.set(spelling, (item.spellings.get(spelling) || 0) + 1);
      }
    });
    /* show the most used spelling ("Netflix" rather than a one-off "netflix") */
    platforms.forEach(item => {
      const ranked = [...item.spellings.entries()].sort((a, b) =>
        b[1] - a[1] || (/^[A-ZÄÖÜ]/.test(b[0]) - /^[A-ZÄÖÜ]/.test(a[0])));
      item.label = item.value === NO_PLATFORM ? "Ohne Anbieter" : ranked[0][0];
      delete item.spellings;
    });
    const years = [...new Set(entries.filter(e => e.watched_at).map(e => new Date(e.watched_at).getFullYear()))]
      .sort((a, b) => b - a)
      .map(String);
    return {
      types: TYPE_OPTIONS,
      status: STATUS_OPTIONS,
      platforms: [...platforms.values()].sort((a, b) =>
        (a.value === NO_PLATFORM) - (b.value === NO_PLATFORM) || b.count - a.count || a.label.localeCompare(b.label)),
      periods: [{ value: "30d", label: "Letzte 30 Tage" }, { value: "90d", label: "Letzte 3 Monate" }, ...years.map(y => ({ value: y, label: y }))]
    };
  }

  /* stored filters may mention choices that no longer exist – keep only sane values */
  function sanitize(raw) {
    const base = emptyFilters();
    if (!raw || typeof raw !== "object") return base;
    ["types", "status", "platforms", "periods"].forEach(group => {
      if (Array.isArray(raw[group])) base[group] = raw[group].filter(v => typeof v === "string");
    });
    if (typeof raw.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.from)) base.from = raw.from;
    if (typeof raw.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.to)) base.to = raw.to;
    return base;
  }

  const api = { STATUS_OPTIONS, TYPE_OPTIONS, NO_PLATFORM, emptyFilters, platformKey, statusOf, matches, activeCount, options, sanitize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.WatchlistFilter = api;
})();
