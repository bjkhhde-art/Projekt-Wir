/* Forgiving search: ignores case, accents and punctuation, accepts word beginnings and
   small typos ("hartstoper" finds "Heartstopper", "gohte" finds "Fack ju Göhte 3").
   Shared by watchlist.js (window.FuzzySearch) and the node tests (module.exports). */
(function () {
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /* Damerau–Levenshtein (with transpositions), stops early once over the limit */
  function distance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    const rows = [];
    for (let i = 0; i <= a.length; i++) {
      rows[i] = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        if (i === 0) {
          rows[0][j] = j;
          continue;
        }
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let value = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, rows[i - 2][j - 2] + 1);
        rows[i][j] = value;
        rowMin = Math.min(rowMin, value);
      }
      if (i > 0 && rowMin > limit) return limit + 1;
    }
    return rows[a.length][b.length];
  }

  function typoLimit(token) {
    if (token.length <= 3) return 0;
    if (token.length <= 6) return 1;
    return 2;
  }

  /* how well one typed word fits one word of the title: 1 best … 0 no match */
  function tokenScore(token, word) {
    if (word === token) return 1;
    if (word.startsWith(token)) return 0.9;
    if (word.includes(token)) return 0.75;
    const limit = typoLimit(token);
    if (!limit) return 0;
    /* compare with the whole word and with its beginning (the user may still be typing) */
    const whole = distance(token, word, limit);
    const prefix = distance(token, word.slice(0, token.length), limit);
    const best = Math.min(whole, prefix);
    return best <= limit ? 0.6 - best * 0.1 : 0;
  }

  /* 0 = no match; otherwise higher is better. Every typed word has to fit somewhere. */
  function score(query, ...fields) {
    const q = normalize(query);
    if (!q) return 1;
    const haystack = fields.map(normalize).filter(Boolean);
    if (!haystack.length) return 0;

    const joined = haystack.join(" ");
    if (joined.replace(/ /g, "").includes(q.replace(/ /g, ""))) return 2 + (normalize(fields[0]).startsWith(q) ? 0.5 : 0);

    const words = joined.split(" ");
    let total = 0;
    for (const token of q.split(" ")) {
      let best = 0;
      for (const word of words) best = Math.max(best, tokenScore(token, word));
      if (best === 0) return 0;
      total += best;
    }
    return total / q.split(" ").length;
  }

  const api = { normalize, distance, score };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.FuzzySearch = api;
})();
