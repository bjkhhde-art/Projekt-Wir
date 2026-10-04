/* "Nur für uns": links we send each other, a 🔥 rating from each of us and comments.
   Uses the supabaseClient from watchlist.js (same page). */

const privateLinkList = document.getElementById("privateLinkList");
const openPrivateLinkModal = document.getElementById("openPrivateLinkModal");
const privateLinkModal = document.getElementById("privateLinkModal");
const privateLinkModalTitle = document.getElementById("privateLinkModalTitle");
const privateLinkUrlInput = document.getElementById("privateLinkUrlInput");
const privateLinkTitleInput = document.getElementById("privateLinkTitleInput");
const savePrivateLinkBtn = document.getElementById("savePrivateLinkBtn");
const closePrivateLinkModal = document.getElementById("closePrivateLinkModal");
const privateLinkEditExtras = document.getElementById("privateLinkEditExtras");
const deletePrivateLinkBtn = document.getElementById("deletePrivateLinkBtn");
const privatePersonModal = document.getElementById("personModal");

const PL_SEEN_KEY = "pw_private_links_seen";
const PL_LONG_PRESS_MS = 500;

let privateLinks = [];
let privateComments = [];
let editingPrivateLinkId = null;
let plSeenBefore = readSeen();
let plPendingAction = null;

function plPerson() {
  const stored = localStorage.getItem("pw_person");
  return stored ? normalizePerson(stored) : null;
}

/* ask once who is using this phone, then continue with what was tapped */
function plRequirePerson(then) {
  if (plPerson()) return true;
  plPendingAction = then || null;
  privatePersonModal.classList.remove("hidden");
  return false;
}

privatePersonModal.querySelectorAll(".person-choice-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    localStorage.setItem("pw_person", btn.dataset.person);
    privatePersonModal.classList.add("hidden");
    renderPrivateLinks();
    if (plPendingAction) plPendingAction();
    plPendingAction = null;
  });
});

function readSeen() {
  try {
    return localStorage.getItem(PL_SEEN_KEY) || "";
  } catch (error) {
    return "";
  }
}

function markSeen() {
  try {
    localStorage.setItem(PL_SEEN_KEY, new Date().toISOString());
  } catch (error) {
    /* only a convenience */
  }
}

/* only real web links; everything else (javascript:, data:, …) is refused */
function cleanUrl(raw) {
  const value = (raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : "https://" + value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href.length <= 2000 ? url.href : null;
  } catch (error) {
    return null;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "Link";
  }
}

/* ---------- data ---------- */

async function loadPrivateLinks() {
  const [links, comments] = await Promise.all([
    supabaseClient.from("private_links").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("private_link_comments").select("*").order("created_at", { ascending: true })
  ]);

  if (links.error || comments.error) {
    console.error("Fehler beim Laden der Links:", links.error || comments.error);
    privateLinkList.innerHTML = `<p class="pl-empty">Links konnten nicht geladen werden.</p>`;
    return;
  }

  privateLinks = links.data || [];
  privateComments = comments.data || [];
  renderPrivateLinks();
}

/* ---------- rendering ---------- */

function flames(value, interactive, linkId) {
  return [1, 2, 3, 4, 5].map(n => {
    const on = value && n <= value;
    return interactive
      ? `<button type="button" class="pl-flame${on ? " on" : ""}" data-rate="${n}" data-link="${linkId}" aria-label="${n} von 5">🔥</button>`
      : `<span class="pl-flame${on ? " on" : ""}">🔥</span>`;
  }).join("");
}

function buildPrivateLinkCard(link) {
  const me = plPerson();
  const partner = me === "Isi" ? "Benji" : "Isi";
  const myRating = me ? link[`rating_${me.toLowerCase()}`] : null;
  const partnerRating = link[`rating_${partner.toLowerCase()}`];
  const comments = privateComments.filter(c => c.link_id === link.id);
  const isNew = link.added_by !== me && plSeenBefore && link.created_at > plSeenBefore;

  const card = document.createElement("article");
  card.className = "pl-card card";
  card.dataset.id = link.id;
  card.innerHTML = `
    <div class="pl-head">
      <span class="pl-host chip">${escapeHtml(hostOf(link.url))}</span>
      ${isNew ? `<span class="pl-new">Neu</span>` : ""}
    </div>
    <h3 class="pl-title">${escapeHtml(link.title || hostOf(link.url))}</h3>
    <p class="pl-meta">von ${escapeHtml(link.added_by)} · ${timeAgo(link.created_at)}</p>

    <div class="pl-actions">
      <a class="btn btn-sm pl-open" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">▶️ Öffnen</a>
      <button type="button" class="btn btn-sm btn-secondary pl-copy">📋 Link kopieren</button>
    </div>

    <div class="pl-ratings">
      <div class="pl-rating-row"><span class="pl-rating-label">Du</span><span class="pl-flames">${flames(myRating, true, link.id)}</span></div>
      <div class="pl-rating-row"><span class="pl-rating-label">${escapeHtml(partner)}</span><span class="pl-flames">${partnerRating ? flames(partnerRating, false) : `<span class="pl-pending">noch keine Wertung</span>`}</span></div>
    </div>

    <ul class="pl-comments">
      ${comments.map(c => `
        <li class="pl-comment${c.author === me ? " mine" : ""}">
          <span class="pl-comment-author">${escapeHtml(c.author)}</span>
          <span class="pl-comment-body">${escapeHtml(c.body)}</span>
          <span class="pl-comment-time">${timeAgo(c.created_at)}</span>
        </li>`).join("")}
    </ul>
    <form class="pl-comment-form">
      <input type="text" class="pl-comment-input" maxlength="500" placeholder="Kommentar …" aria-label="Kommentar schreiben">
      <button type="submit" class="pl-comment-send" aria-label="Senden">➤</button>
    </form>
  `;

  card.querySelector(".pl-copy").addEventListener("click", () => copyLink(link.url));
  card.querySelectorAll(".pl-flame[data-rate]").forEach(btn => {
    btn.addEventListener("click", () => rateLink(link, Number(btn.dataset.rate)));
  });
  card.querySelector(".pl-comment-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = card.querySelector(".pl-comment-input");
    addComment(link, input.value);
  });
  attachPrivateLongPress(card, link);
  return card;
}

function renderPrivateLinks() {
  /* keep a half-written comment when the list re-renders after a live update */
  const drafts = {};
  privateLinkList.querySelectorAll(".pl-card").forEach(card => {
    const input = card.querySelector(".pl-comment-input");
    if (input && input.value) drafts[card.dataset.id] = { value: input.value, focused: document.activeElement === input };
  });

  privateLinkList.innerHTML = "";
  if (privateLinks.length === 0) {
    privateLinkList.innerHTML = `<p class="pl-empty">Noch nichts geteilt. Tippt unten rechts auf + und schickt den ersten Link 🔥</p>`;
    return;
  }
  privateLinks.forEach(link => {
    const card = buildPrivateLinkCard(link);
    const draft = drafts[link.id];
    if (draft) {
      const input = card.querySelector(".pl-comment-input");
      input.value = draft.value;
      if (draft.focused) setTimeout(() => input.focus(), 0);
    }
    privateLinkList.appendChild(card);
  });
}

/* ---------- actions ---------- */

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link kopiert – jetzt im privaten Tab einfügen 🕶️", "success");
  } catch (error) {
    window.prompt("Link kopieren:", url);
  }
}

async function rateLink(link, value) {
  if (!plRequirePerson(() => rateLink(link, value))) return;
  const column = `rating_${plPerson().toLowerCase()}`;
  const next = link[column] === value ? null : value;
  link[column] = next;
  renderPrivateLinks();

  const { error } = await supabaseClient.from("private_links").update({ [column]: next }).eq("id", link.id);
  if (error) {
    console.error("Fehler beim Bewerten:", error);
    showToast("Bewertung konnte nicht gespeichert werden.", "error");
    await loadPrivateLinks();
  }
}

async function addComment(link, raw) {
  const body = (raw || "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (!body) return;
  if (!plRequirePerson(() => addComment(link, raw))) return;
  const me = plPerson();

  const { error } = await supabaseClient.from("private_link_comments").insert({ link_id: link.id, author: me, body });
  if (error) {
    console.error("Fehler beim Kommentieren:", error);
    showToast("Kommentar konnte nicht gespeichert werden.", "error");
    return;
  }

  const card = privateLinkList.querySelector(`.pl-card[data-id="${link.id}"] .pl-comment-input`);
  if (card) card.value = "";
  await loadPrivateLinks();

  /* deliberately neutral – lock screens are visible to others */
  sendAppNotification(supabaseClient, {
    title: "Projekt Wir 🔥",
    body: `${me} hat etwas kommentiert.`,
    excludePerson: me,
    url: "wir.html?tab=privat"
  });
}

function openPrivateModal(link) {
  if (!plRequirePerson(() => openPrivateModal(link))) return;
  editingPrivateLinkId = link ? link.id : null;
  privateLinkModalTitle.textContent = link ? "Link bearbeiten" : "Link teilen 🔥";
  savePrivateLinkBtn.textContent = link ? "Speichern" : "Teilen";
  privateLinkUrlInput.value = link ? link.url : "";
  privateLinkTitleInput.value = link ? link.title || "" : "";
  privateLinkEditExtras.classList.toggle("hidden", !link);
  privateLinkModal.classList.remove("hidden");
  privateLinkUrlInput.focus();
}

async function savePrivateLink() {
  const url = cleanUrl(privateLinkUrlInput.value);
  if (!url) {
    showToast("Bitte einen gültigen Link (https://…) einfügen.", "error");
    return;
  }
  const title = privateLinkTitleInput.value.trim().slice(0, 120) || null;
  const me = plPerson();

  const duplicate = privateLinks.find(link => link.url === url && link.id !== editingPrivateLinkId);
  if (duplicate) {
    showToast(`Den Link hat ${duplicate.added_by} schon geteilt.`, "error");
    return;
  }

  const editing = editingPrivateLinkId;
  const { error } = editing
    ? await supabaseClient.from("private_links").update({ url, title }).eq("id", editing)
    : await supabaseClient.from("private_links").insert({ url, title, added_by: me });

  if (error) {
    console.error("Fehler beim Speichern des Links:", error);
    showToast("Link konnte nicht gespeichert werden.", "error");
    return;
  }

  privateLinkModal.classList.add("hidden");
  editingPrivateLinkId = null;
  showToast(editing ? "Gespeichert 💾" : "Geteilt 🔥", "success");
  await loadPrivateLinks();

  if (!editing) {
    sendAppNotification(supabaseClient, {
      title: "Projekt Wir 🔥",
      body: `${me} hat etwas für dich geteilt.`,
      excludePerson: me,
      url: "wir.html?tab=privat"
    });
  }
}

async function deletePrivateLink() {
  const link = privateLinks.find(l => l.id === editingPrivateLinkId);
  if (!link) return;
  privateLinkModal.classList.add("hidden");
  editingPrivateLinkId = null;
  const confirmed = await confirmDialog("Der Link und alle Kommentare dazu werden gelöscht.");
  if (!confirmed) return;

  const { error } = await supabaseClient.from("private_links").delete().eq("id", link.id);
  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Löschen hat nicht geklappt.", "error");
    return;
  }
  showToast("Gelöscht.");
  await loadPrivateLinks();
}

/* holding a card (not its buttons or the comment field) opens edit/delete */
function attachPrivateLongPress(card, link) {
  let timer = null;
  let fired = false;
  const cancel = () => {
    clearTimeout(timer);
    card.classList.remove("long-pressing");
  };
  card.addEventListener("pointerdown", event => {
    if (event.target.closest("button, a, input, form")) return;
    fired = false;
    card.classList.add("long-pressing");
    timer = setTimeout(() => {
      fired = true;
      cancel();
      if (navigator.vibrate) navigator.vibrate(15);
      openPrivateModal(link);
    }, PL_LONG_PRESS_MS);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(name => card.addEventListener(name, cancel));
  card.addEventListener("click", event => {
    if (fired) {
      event.preventDefault();
      event.stopPropagation();
      fired = false;
    }
  }, true);
}

/* ---------- wiring ---------- */

openPrivateLinkModal.addEventListener("click", () => openPrivateModal(null));
closePrivateLinkModal.addEventListener("click", () => {
  editingPrivateLinkId = null;
  privateLinkModal.classList.add("hidden");
});
savePrivateLinkBtn.addEventListener("click", savePrivateLink);
deletePrivateLinkBtn.addEventListener("click", deletePrivateLink);
[privateLinkUrlInput, privateLinkTitleInput].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") savePrivateLink();
  });
});

/* "Neu" marks what arrived since the tab was last opened on this phone */
document.addEventListener("pw:hub-tab-shown", event => {
  if (event.detail.tab === "privat") {
    renderPrivateLinks();
    markSeen();
  } else {
    plSeenBefore = readSeen();
  }
});

supabaseClient
  .channel("private_links_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "private_links" }, () => loadPrivateLinks())
  .subscribe();

supabaseClient
  .channel("private_link_comments_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "private_link_comments" }, () => loadPrivateLinks())
  .subscribe();

loadPrivateLinks().then(() => {
  const panel = document.querySelector('[data-panel="privat"]');
  if (panel && !panel.hidden) markSeen();
});
