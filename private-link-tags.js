/* Hashtags for "Nur für uns": cleaning what was typed, counting the tags in use and
   filtering. Pure logic – used by private-links.js (window.PrivateLinkTags) and the node
   tests (module.exports). */
(function () {
  const MAX_TAGS = 12;
  const MAX_LENGTH = 30;

  /* "#Mein Lieblings-Tag!" → "meinlieblings-tag": lowercase, no "#", no spaces or symbols */
  function cleanTag(raw) {
    return String(raw || "")
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, "")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, MAX_LENGTH);
  }

  /* several tags at once: "#pov, outdoor #lustig" → ["pov", "outdoor", "lustig"] */
  function parseTags(text) {
    return unique(String(text || "").split(/[\s,;#]+/).map(cleanTag));
  }

  function unique(tags) {
    const out = [];
    tags.forEach(tag => {
      if (tag && !out.includes(tag) && out.length < MAX_TAGS) out.push(tag);
    });
    return out;
  }

  function addTags(current, text) {
    return unique([...(current || []), ...parseTags(text)]);
  }

  function removeTag(current, tag) {
    return (current || []).filter(t => t !== tag);
  }

  /* tags in use, most used first */
  function tagCounts(links) {
    const counts = new Map();
    links.forEach(link => (link.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
  }

  /* every chosen tag has to be on the link – each tap narrows the list */
  function matches(link, selected) {
    if (!selected || !selected.length) return true;
    const tags = link.tags || [];
    return selected.every(tag => tags.includes(tag));
  }

  /* stored choices may name tags that are gone by now */
  function sanitizeSelection(raw, links) {
    if (!Array.isArray(raw)) return [];
    const inUse = new Set(tagCounts(links).map(t => t.tag));
    return unique(raw.filter(tag => typeof tag === "string" && inUse.has(tag)));
  }

  const api = { MAX_TAGS, MAX_LENGTH, cleanTag, parseTags, addTags, removeTag, tagCounts, matches, sanitizeSelection };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.PrivateLinkTags = api;
})();
