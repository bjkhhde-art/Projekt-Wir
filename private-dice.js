/* "🎲 Zufall" in Nur für uns: a random link from our own list, or something new from
   eporner.com via the random-video function. Results are only copied, never opened from here. Uses the state and helpers of private-links.js. */

const openDiceModal = document.getElementById("openDiceModal");
const diceModal = document.getElementById("diceModal");
const diceOurs = document.getElementById("diceOurs");
const diceNew = document.getElementById("diceNew");
const diceTagChips = document.getElementById("diceTagChips");
const diceUnrated = document.getElementById("diceUnrated");
const diceQuery = document.getElementById("diceQuery");
const diceQueryChips = document.getElementById("diceQueryChips");
const diceResult = document.getElementById("diceResult");
const diceRollBtn = document.getElementById("diceRollBtn");
const closeDiceModal = document.getElementById("closeDiceModal");

const DICE_MODE_KEY = "pw_dice_mode";
const DICE_RECENT = 5;

let diceMode = readDiceMode();
let diceTags = [];
let diceRecentIds = [];
const diceSuggested = [];
let diceRolling = false;

function readDiceMode() {
  try {
    return localStorage.getItem(DICE_MODE_KEY) === "new" ? "new" : "ours";
  } catch (error) {
    return "ours";
  }
}

function storeDiceMode() {
  try {
    localStorage.setItem(DICE_MODE_KEY, diceMode);
  } catch (error) {
    /* only a convenience */
  }
}

function renderDiceModes() {
  diceModal.querySelectorAll(".pl-dice-mode").forEach(btn => {
    const on = btn.dataset.mode === diceMode;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-selected", String(on));
  });
  diceOurs.classList.toggle("hidden", diceMode !== "ours");
  diceNew.classList.toggle("hidden", diceMode !== "new");
  diceRollBtn.textContent = "🎲 Würfeln";
  renderDiceChips();
}

/* our hashtags: narrow the pick in "ours", quick search words in "new" */
function renderDiceChips() {
  const tags = Tags.tagCounts(privateLinks).map(t => t.tag);
  diceTags = diceTags.filter(tag => tags.includes(tag));
  diceTagChips.innerHTML = tags.map(tag =>
    `<button type="button" class="pl-tag${diceTags.includes(tag) ? " selected" : ""}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("");
  diceTagChips.querySelectorAll(".pl-tag").forEach(btn => btn.addEventListener("click", () => {
    const tag = btn.dataset.tag;
    diceTags = diceTags.includes(tag) ? diceTags.filter(t => t !== tag) : [...diceTags, tag];
    renderDiceChips();
  }));
  diceQueryChips.innerHTML = tags.slice(0, 10).map(tag =>
    `<button type="button" class="pl-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("");
  diceQueryChips.querySelectorAll(".pl-tag").forEach(btn => btn.addEventListener("click", () => {
    diceQuery.value = btn.dataset.tag;
    rollDice();
  }));
}

function openDice() {
  if (!plRequirePerson(openDice)) return;
  diceResult.innerHTML = "";
  renderDiceModes();
  diceModal.classList.remove("hidden");
}

function showDiceResult(html) {
  diceResult.innerHTML = html;
  const card = diceResult.firstElementChild;
  if (card) {
    card.classList.remove("pl-dice-pop");
    void card.offsetWidth;
    card.classList.add("pl-dice-pop");
  }
}

function diceMessage(text) {
  showDiceResult(`<p class="pl-dice-empty">${escapeHtml(text)}</p>`);
}

function rollDice() {
  if (diceRolling) return;
  if (diceMode === "ours") rollOurs();
  else rollNew();
}

/* ---------- from our list ---------- */

function rollOurs() {
  if (!privateLinks.length) {
    diceMessage("Noch keine Links geteilt – probiert „Etwas Neues“ ✨");
    return;
  }
  const list = LinkDice.candidates(privateLinks, { tags: diceTags, unratedBy: diceUnrated.checked ? plPerson() : null });
  if (!list.length) {
    diceMessage(diceUnrated.checked ? "Du hast schon alles bewertet, was passt 🔥" : "Kein Link hat alle gewählten Hashtags.");
    return;
  }
  const link = LinkDice.pick(list, diceRecentIds);
  diceRecentIds = [link.id, ...diceRecentIds.filter(id => id !== link.id)].slice(0, Math.min(DICE_RECENT, list.length - 1));

  const picture = link.preview_status === "ok" && link.preview_image
    ? `<img class="pl-dice-thumb" src="${escapeHtml(link.preview_image)}" alt="" referrerpolicy="no-referrer">` : "";
  const tags = (link.tags || []).map(tag => `<span class="pl-tag">#${escapeHtml(tag)}</span>`).join("");
  showDiceResult(`
    <div class="pl-dice-card" data-id="${escapeHtml(String(link.id))}">
      ${picture}
      <h3 class="pl-dice-title">${escapeHtml(link.title || link.preview_title || hostOf(link.url))}</h3>
      <p class="pl-meta">von ${escapeHtml(link.added_by)} · ${timeAgo(link.created_at)}</p>
      ${tags ? `<div class="pl-tags">${tags}</div>` : ""}
      <div class="pl-actions">
        <button type="button" class="btn btn-sm pl-dice-copy">📋 Link kopieren</button>
        <button type="button" class="btn btn-sm btn-secondary pl-dice-goto">📍 Zur Karte</button>
      </div>
    </div>`);
  diceResult.querySelector(".pl-dice-copy").addEventListener("click", () => copyLink(link.url));
  diceResult.querySelector(".pl-dice-goto").addEventListener("click", () => goToCard(link.id));
  diceRollBtn.textContent = "🎲 Nochmal";
}

/* the card in the list, even if the hashtag filter was hiding it */
function goToCard(id) {
  diceModal.classList.add("hidden");
  const selector = `.pl-card[data-id="${CSS.escape(String(id))}"]`;
  if (!privateLinkList.querySelector(selector)) {
    selectedTags = [];
    storeTagFilter();
    renderPrivateLinks();
  }
  const card = privateLinkList.querySelector(selector);
  if (!card) return;
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.classList.add("pl-flash");
  setTimeout(() => card.classList.remove("pl-flash"), 1800);
}

/* ---------- something new ---------- */

function isEpornerLink(url) {
  const clean = cleanUrl(url);
  if (!clean || !clean.startsWith("https://")) return null;
  const host = new URL(clean).hostname.toLowerCase();
  return host === "eporner.com" || host.endsWith(".eporner.com") ? clean : null;
}

async function rollNew() {
  diceRolling = true;
  diceRollBtn.disabled = true;
  diceResult.innerHTML = `<div class="pl-dice-loading"><span class="pl-dice-spin">🎲</span> Wird gewürfelt …</div>`;
  const query = diceQuery.value.trim();
  const exclude = [...privateLinks.map(link => link.url), ...diceSuggested].slice(-500);

  let answer = null;
  try {
    const { data, error } = await supabaseClient.functions.invoke("random-video", { body: { query, exclude } });
    if (error) throw error;
    answer = data;
  } catch (error) {
    console.error("Zufallsvorschlag fehlgeschlagen:", error);
  }
  diceRolling = false;
  diceRollBtn.disabled = false;

  if (answer && answer.status === "none") {
    diceMessage(query ? `Zu „${query}“ gibt es nichts Neues – anderes Wort probieren?` : "Gerade nichts Neues gefunden.");
    return;
  }
  const video = answer && answer.status === "ok" ? answer.video : null;
  const url = video && isEpornerLink(video.url);
  if (!url) {
    diceMessage("Eporner antwortet gerade nicht – gleich nochmal versuchen.");
    return;
  }
  diceSuggested.push(url);

  const title = String(video.title || "").slice(0, 120) || "Vorschlag";
  const thumb = typeof video.thumb === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(video.thumb) ? video.thumb : "";
  const facts = [
    video.length ? `⏱ ${video.length}` : "",
    Number.isFinite(video.rating) ? `⭐ ${String(video.rating).replace(".", ",")}` : "",
    LinkDice.formatViews(video.views)
  ].filter(Boolean).join(" · ");
  showDiceResult(`
    <div class="pl-dice-card">
      ${thumb ? `<img class="pl-dice-thumb" src="${escapeHtml(thumb)}" alt="">` : ""}
      <h3 class="pl-dice-title">${escapeHtml(title)}</h3>
      ${facts ? `<p class="pl-meta">${escapeHtml(facts)}</p>` : ""}
      <div class="pl-actions">
        <button type="button" class="btn btn-sm pl-dice-copy">📋 Link kopieren</button>
        <button type="button" class="btn btn-sm btn-secondary pl-dice-take">➕ In unsere Liste</button>
      </div>
    </div>`);
  diceResult.querySelector(".pl-dice-copy").addEventListener("click", () => copyLink(url));
  diceResult.querySelector(".pl-dice-take").addEventListener("click", () => {
    diceModal.classList.add("hidden");
    openPrivateModal(null, false, { url, title, tags: Tags.parseTags(query) });
  });
  diceRollBtn.textContent = "🎲 Nochmal";
}

/* ---------- wiring ---------- */

openDiceModal.addEventListener("click", openDice);
closeDiceModal.addEventListener("click", () => diceModal.classList.add("hidden"));
diceRollBtn.addEventListener("click", rollDice);
diceModal.querySelectorAll(".pl-dice-mode").forEach(btn => btn.addEventListener("click", () => {
  if (diceMode === btn.dataset.mode) return;
  diceMode = btn.dataset.mode;
  storeDiceMode();
  diceResult.innerHTML = "";
  renderDiceModes();
}));
diceQuery.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    rollDice();
  }
});
