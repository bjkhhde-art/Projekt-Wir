const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const notesFeed = document.getElementById("notesFeed");

const openNoteModal = document.getElementById("openNoteModal");
const noteModal = document.getElementById("noteModal");
const closeNoteModal = document.getElementById("closeNoteModal");
const sendNoteBtn = document.getElementById("sendNoteBtn");
const noteAuthorInput = document.getElementById("noteAuthorInput");
const noteMessageInput = document.getElementById("noteMessageInput");

const letterOverlay = document.getElementById("letterOverlay");
const closeLetterOverlay = document.getElementById("closeLetterOverlay");
const deleteLetterBtn = document.getElementById("deleteLetterBtn");
const envelopeFlap = document.getElementById("envelopeFlap");
const letterPaper = document.getElementById("letterPaper");
const letterMessageEl = document.getElementById("letterMessage");
const letterSignatureEl = document.getElementById("letterSignature");

const OPENED_STORAGE_KEY = "love_notes_opened";
const DRAG_RANGE = 150;
const OPEN_THRESHOLD = 0.55;

let notes = [];
let currentNoteId = null;
let flapDragging = false;
let flapStartY = 0;
let flapProgress = 0;
let flapOpened = false;

async function loadNotes() {
  notesFeed.innerHTML = `<div class="skeleton note-skeleton"></div><div class="skeleton note-skeleton"></div><div class="skeleton note-skeleton"></div><div class="skeleton note-skeleton"></div>`;

  const { data, error } = await supabaseClient
    .from("love_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden:", error);
    showToast("Nachrichten konnten nicht geladen werden.", "error");
    return;
  }

  notes = data;
  renderNotes();
}

function renderNotes() {
  notesFeed.innerHTML = "";

  if (notes.length === 0) {
    notesFeed.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">💌</span>
        <p>Noch keine Nachrichten.<br>Schreib die erste Liebeserklärung des Tages.</p>
      </div>
    `;
    return;
  }

  const openedIds = getOpenedIds();

  notes.forEach(note => {
    const authorClass = note.author === "Isi" ? "author-isi" : "author-benji";
    const isNew = !openedIds.includes(note.id);

    const card = document.createElement("button");
    card.type = "button";
    card.className = `envelope-card ${authorClass}`;

    card.innerHTML = `
      <div class="envelope-mini">
        ${isNew ? `<span class="envelope-new-badge chip">Neu</span>` : ""}
        <div class="envelope-mini-body"></div>
        <div class="envelope-mini-flap"></div>
        <span class="envelope-mini-seal">💗</span>
      </div>
      <div class="envelope-label">
        <span class="envelope-author">Von ${note.author}</span>
        <span class="envelope-time">${timeAgo(note.created_at)}</span>
      </div>
    `;

    card.addEventListener("click", () => openLetter(note));

    notesFeed.appendChild(card);
  });
}

function getOpenedIds() {
  return JSON.parse(localStorage.getItem(OPENED_STORAGE_KEY)) || [];
}

function markOpened(id) {
  const openedIds = getOpenedIds();
  if (!openedIds.includes(id)) {
    openedIds.push(id);
    localStorage.setItem(OPENED_STORAGE_KEY, JSON.stringify(openedIds));
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setFlapProgress(progress) {
  flapProgress = clamp(progress, 0, 1);

  envelopeFlap.style.transform = `rotateX(${-120 * flapProgress}deg)`;

  const paperY = 20 - flapProgress * 230;
  letterPaper.style.transform = `translateY(${paperY}px)`;
  letterPaper.style.opacity = String(Math.min(1, flapProgress * 1.6));
}

function openFlapFully() {
  envelopeFlap.classList.add("opened");
  setFlapProgress(1);
  flapOpened = true;

  if (currentNoteId !== null) {
    markOpened(currentNoteId);
    renderNotes();
  }
}

function closeFlapFully() {
  envelopeFlap.classList.remove("opened");
  setFlapProgress(0);
  flapOpened = false;
}

function openLetter(note) {
  currentNoteId = note.id;
  letterMessageEl.innerHTML = escapeHtml(note.message);
  letterSignatureEl.textContent = `– ${note.author}`;

  envelopeFlap.classList.remove("opened", "settling", "dragging");
  letterPaper.classList.add("dragging");
  setFlapProgress(0);
  void letterPaper.offsetWidth;
  letterPaper.classList.remove("dragging");

  flapOpened = false;
  letterOverlay.classList.remove("hidden");
}

function dismissLetter() {
  letterOverlay.classList.add("hidden");
  currentNoteId = null;
}

envelopeFlap.addEventListener("pointerdown", event => {
  if (flapOpened) return;

  flapDragging = true;
  envelopeFlap.setPointerCapture(event.pointerId);
  flapStartY = event.clientY;
  envelopeFlap.classList.remove("settling");
  envelopeFlap.classList.add("dragging");
  letterPaper.classList.add("dragging");
});

envelopeFlap.addEventListener("pointermove", event => {
  if (!flapDragging) return;

  const deltaY = flapStartY - event.clientY;
  setFlapProgress(deltaY / DRAG_RANGE);
});

function endFlapDrag() {
  if (!flapDragging) return;

  flapDragging = false;
  envelopeFlap.classList.remove("dragging");
  envelopeFlap.classList.add("settling");
  letterPaper.classList.remove("dragging");

  if (flapProgress >= OPEN_THRESHOLD) {
    vibrate(12);
    openFlapFully();
  } else {
    closeFlapFully();
  }
}

envelopeFlap.addEventListener("pointerup", endFlapDrag);
envelopeFlap.addEventListener("pointercancel", endFlapDrag);

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, "<br>");
}

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);

  if (seconds < 60) return "gerade eben";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag(en)`;
  return formatDate(dateString);
}

async function sendNote() {
  const message = noteMessageInput.value.trim();

  if (!message) {
    showToast("Bitte eine Nachricht schreiben.", "error");
    return;
  }

  sendNoteBtn.disabled = true;

  const { error } = await supabaseClient
    .from("love_notes")
    .insert({
      author: noteAuthorInput.value,
      message
    });

  sendNoteBtn.disabled = false;

  if (error) {
    console.error("Fehler beim Senden:", error);
    showToast("Nachricht konnte nicht gesendet werden.", "error");
    return;
  }

  noteMessageInput.value = "";
  noteModal.classList.add("hidden");
  showToast("Nachricht gesendet 💌", "success");
  celebrate(6);
  await loadNotes();
}

async function deleteNote(id) {
  const confirmed = await confirmDialog("Diese Nachricht wird endgültig gelöscht.");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("love_notes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Löschen hat nicht geklappt.", "error");
    return;
  }

  dismissLetter();
  showToast("Nachricht gelöscht.");
  await loadNotes();
}

openNoteModal.addEventListener("click", () => {
  noteModal.classList.remove("hidden");
  noteMessageInput.focus();
});

closeNoteModal.addEventListener("click", () => {
  noteModal.classList.add("hidden");
});

sendNoteBtn.addEventListener("click", sendNote);

closeLetterOverlay.addEventListener("click", dismissLetter);

deleteLetterBtn.addEventListener("click", () => {
  if (currentNoteId !== null) deleteNote(currentNoteId);
});

letterOverlay.addEventListener("click", event => {
  if (event.target === letterOverlay) {
    dismissLetter();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !letterOverlay.classList.contains("hidden")) {
    dismissLetter();
  }
});

loadNotes();

supabaseClient
  .channel("love_notes_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "love_notes" },
    () => {
      loadNotes();
    }
  )
  .subscribe();
