/* The computer players can be renamed in the settings – one name for both phones, stored in
   app_settings.bot_names as { "Udiou": "…", "Klausi": "…" }. Inside the games they keep their ids
   (Udiou, Klausi), so running rounds and saved states stay valid; only what is shown changes.
   On a game page watch() swaps the ids for the chosen names in everything that is drawn. */

const BotNames = (() => {
  const IDS = ["Udiou", "Klausi"];
  const MEMBERS = ["Isi", "Benji"];
  const NAME_MAX = 20;
  const CACHE_KEY = "pw_bot_names";

  /* the same rules as a friend's name: short plain text */
  function clean(raw) {
    return String(raw || "")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N} .'-]+/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX);
  }

  /* why `name` cannot be the name of bot `id` next to the other names in `wanted` (null when fine) */
  function problem(id, name, wanted = {}) {
    if (!name) return null; /* empty = keep the original name */
    const lower = name.toLowerCase();
    if (MEMBERS.some(m => m.toLowerCase() === lower)) return `„${name}“ ist schon vergeben – nimm einen anderen Namen.`;
    const others = IDS.filter(other => other !== id);
    if (others.some(other => other.toLowerCase() === lower || String(wanted[other] || "").toLowerCase() === lower)) {
      return `„${name}“ heißt schon der andere Computer-Spieler.`;
    }
    return null;
  }

  /* only known ids, cleaned names that differ from the id and do not clash */
  function sanitize(map) {
    const result = {};
    if (!map || typeof map !== "object") return result;
    IDS.forEach(id => {
      const name = clean(map[id]);
      if (name && name !== id && !problem(id, name, result)) result[id] = name;
    });
    return result;
  }

  function readCache() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"));
    } catch (error) {
      return {};
    }
  }

  let names = typeof localStorage !== "undefined" ? readCache() : {};

  function set(map) {
    names = sanitize(map);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(names));
    } catch (error) {
      /* then the names are loaded again next time */
    }
    if (watched) relabel(watched);
    return names;
  }

  const display = id => names[id] || id;
  const all = () => ({ ...names });

  async function load(client) {
    try {
      const { data, error } = await client.from("app_settings").select("bot_names").eq("id", "shared").maybeSingle();
      if (!error && data) set(data.bot_names || {});
    } catch (error) {
      /* no connection: the last known names stay */
    }
    return all();
  }

  async function save(client, map) {
    const chosen = sanitize(map);
    const { error } = await client.from("app_settings").upsert({ id: "shared", bot_names: chosen }, { onConflict: "id" });
    if (error) throw error;
    return set(chosen);
  }

  /* ---------- showing the names on a game page ---------- */

  let watched = null;
  /* what a text node / attribute looked like after we last touched it – so a name that contains
     an id ("Udiou 2") is not replaced again and again */
  const done = new WeakMap();

  function pattern() {
    const renamed = IDS.filter(id => names[id]);
    return renamed.length ? new RegExp(`\\b(${renamed.join("|")})\\b`, "g") : null;
  }

  function relabelText(node, regex) {
    if (done.get(node) === node.data) return;
    regex.lastIndex = 0;
    if (regex.test(node.data)) {
      regex.lastIndex = 0;
      node.data = node.data.replace(regex, id => display(id));
    }
    done.set(node, node.data);
  }

  function relabelAttributes(el, regex) {
    ["title", "aria-label"].forEach(attr => {
      const value = el.getAttribute(attr);
      if (!value) return;
      const key = `${attr}:${value}`;
      if (done.get(el) === key) return;
      regex.lastIndex = 0;
      const next = value.replace(regex, id => display(id));
      if (next !== value) el.setAttribute(attr, next);
      done.set(el, `${attr}:${next}`);
    });
  }

  function relabel(root) {
    const regex = pattern();
    if (!regex || !root) return;
    if (root.nodeType === 3) {
      relabelText(root, regex);
      return;
    }
    if (root.nodeType !== 1) return;
    relabelAttributes(root, regex);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 3) {
        /* what people type stays as typed */
        if (node.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentNode.nodeName)) continue;
        relabelText(node, regex);
      } else {
        relabelAttributes(node, regex);
      }
    }
  }

  function watch(root) {
    watched = root;
    relabel(root);
    new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === "childList") record.addedNodes.forEach(relabel);
        else relabel(record.target);
      });
    }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label"] });
  }

  return { IDS, NAME_MAX, clean, problem, sanitize, set, display, all, load, save, relabel, watch };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BotNames;
}
if (typeof window !== "undefined") {
  window.BotNames = BotNames;
}
