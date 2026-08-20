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

let notes = [];

async function loadNotes() {
  notesFeed.innerHTML = `<div class="skeleton note-skeleton"></div><div class="skeleton note-skeleton"></div>`;

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

  notes.forEach(note => {
    const side = note.author === "Isi" ? "left" : "right";

    const card = document.createElement("div");
    card.className = `note-card note-${side}`;

    card.innerHTML = `
      <div class="note-bubble card">
        <button class="delete-note-btn icon-action" title="Löschen">×</button>
        <p class="note-message">${escapeHtml(note.message)}</p>
        <div class="note-meta">
          <span class="note-author">${note.author}</span>
          <span class="note-time">${timeAgo(note.created_at)}</span>
        </div>
      </div>
    `;

    card.querySelector(".delete-note-btn").addEventListener("click", () => deleteNote(note.id));

    notesFeed.appendChild(card);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, "<br>");
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
