/* "🎲 Zufall" in Nur für uns: which of our own links can come up, and a random pick that does
   not repeat the last ones. Pure logic – used by private-dice.js (window.LinkDice) and the node
   tests (module.exports). */
(function () {
  /* options: tags (all must be on the link), unratedBy ("Isi"/"Benji": only links that person has not rated) */
  function candidates(links, options = {}) {
    const tags = options.tags || [];
    const column = options.unratedBy ? `rating_${String(options.unratedBy).toLowerCase()}` : null;
    return (links || []).filter(link =>
      tags.every(tag => (link.tags || []).includes(tag)) &&
      (!column || link[column] == null));
  }

  /* a random link, avoiding the recent picks as long as something else is left */
  function pick(list, recentIds = [], random = Math.random) {
    if (!list || !list.length) return null;
    const fresh = list.filter(link => !recentIds.includes(link.id));
    const pool = fresh.length ? fresh : list;
    return pool[Math.floor(random() * pool.length)];
  }

  /* "1,2 Mio." / "12.345" – views as they read nicely */
  function formatViews(views) {
    if (views == null || !Number.isFinite(views)) return "";
    if (views >= 1e6) return `${(views / 1e6).toFixed(1).replace(".", ",").replace(",0", "")} Mio. Aufrufe`;
    return `${views.toLocaleString("de-DE")} Aufrufe`;
  }

  const api = { candidates, pick, formatViews };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.LinkDice = api;
})();
