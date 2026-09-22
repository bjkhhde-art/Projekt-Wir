const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const visionTimeline = document.getElementById("visionTimeline");

const openVisionModal = document.getElementById("openVisionModal");
const visionModal = document.getElementById("visionModal");
const visionModalTitle = document.getElementById("visionModalTitle");
const visionTitleInput = document.getElementById("visionTitleInput");
const visionDescInput = document.getElementById("visionDescInput");
const visionHorizonInput = document.getElementById("visionHorizonInput");
const visionCoverPreviewWrap = document.getElementById("visionCoverPreviewWrap");
const visionCoverPreviewImg = document.getElementById("visionCoverPreviewImg");
const visionCoverInput = document.getElementById("visionCoverInput");
const saveVisionBtn = document.getElementById("saveVisionBtn");
const closeVisionModal = document.getElementById("closeVisionModal");

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const HORIZON_ORDER = ["bald", "1_2", "3_5", "5_plus", "irgendwann"];

const HORIZON_HEADINGS = {
  bald: "🌱 Schon bald",
  "1_2": "🌤️ In 1–2 Jahren",
  "3_5": "🌳 In 3–5 Jahren",
  "5_plus": "🏔️ In über 5 Jahren",
  irgendwann: "✨ Irgendwann"
};

let currentPerson = localStorage.getItem("pw_person");
let visions = [];
let editingVisionId = null;

function requirePerson() {
  if (currentPerson) return true;
  personModal.classList.remove("hidden");
  return false;
}

personButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentPerson = button.dataset.person;
    localStorage.setItem("pw_person", currentPerson);
    personModal.classList.add("hidden");
  });
});

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- rendering ---------- */

function personBadge(person) {
  const isIsi = normalizePerson(person) === "Isi";
  return `<span class="vision-person-badge ${isIsi ? "person-isi" : "person-benji"}">${isIsi ? "💗" : "💜"} ${escapeHtml(person)}</span>`;
}

function buildVisionEntry(vision) {
  const entry = document.createElement("div");
  entry.className = "vision-entry";

  entry.innerHTML = `
    <div class="vision-dot ${vision.achieved ? "achieved" : ""}"></div>
    <div class="vision-card card ${vision.achieved ? "achieved" : ""}">
      ${vision.image_url
        ? `<img class="vision-card-image" src="${vision.image_url}" alt="${escapeHtml(vision.title)}">`
        : ""}
      <div class="vision-card-body">
        <div class="vision-card-top">
          <div>
            <h3 class="vision-card-title">${vision.achieved ? "✓ " : ""}${escapeHtml(vision.title)}</h3>
            ${vision.description ? `<p class="vision-card-desc">${escapeHtml(vision.description)}</p>` : ""}
          </div>
          ${personBadge(vision.person)}
        </div>
        <div class="vision-card-actions">
          <button class="vision-achieved-toggle ${vision.achieved ? "is-achieved" : ""}" data-action="toggle">
            ${vision.achieved ? "✓ Erreicht" : "Als erreicht markieren"}
          </button>
          <button class="vision-card-icon-btn edit-vision-btn" data-action="edit" title="Bearbeiten">✏️</button>
          <button class="vision-card-icon-btn delete-vision-btn" data-action="delete" title="Löschen">×</button>
        </div>
      </div>
    </div>
  `;

  entry.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleAchieved(vision));
  entry.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(vision));
  entry.querySelector('[data-action="delete"]').addEventListener("click", () => deleteVision(vision.id));

  return entry;
}

function renderTimeline() {
  visionTimeline.innerHTML = "";

  if (visions.length === 0) {
    visionTimeline.innerHTML = `
      <div class="vision-empty-state">
        <span class="empty-icon">🔭</span>
        <p>Noch keine Ziele eingetragen.<br>Wir tippen unten rechts auf + und tragen unser erstes gemeinsames Ziel ein.</p>
      </div>
    `;
    return;
  }

  HORIZON_ORDER.forEach(horizon => {
    const entries = visions.filter(v => v.horizon === horizon);
    if (entries.length === 0) return;

    const bucket = document.createElement("div");
    bucket.className = "vision-bucket";

    const heading = document.createElement("h2");
    heading.className = "vision-bucket-heading";
    heading.textContent = HORIZON_HEADINGS[horizon] || horizon;
    bucket.appendChild(heading);

    const track = document.createElement("div");
    track.className = "vision-track";
    entries.forEach(vision => track.appendChild(buildVisionEntry(vision)));
    bucket.appendChild(track);

    visionTimeline.appendChild(bucket);
  });
}

/* ---------- data ---------- */

async function loadVisions() {
  const { data, error } = await supabaseClient
    .from("visions")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Vision:", error);
    showToast("Vision konnte nicht geladen werden.", "error");
    return;
  }

  visions = data || [];
  renderTimeline();
}

async function uploadCover(file) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabaseClient
    .storage
    .from("vision-images")
    .upload(fileName, file);

  if (error) {
    console.error("Fehler beim Upload:", error);
    throw error;
  }

  const { data } = supabaseClient
    .storage
    .from("vision-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function toggleAchieved(vision) {
  const achieved = !vision.achieved;

  const { error } = await supabaseClient
    .from("visions")
    .update({ achieved })
    .eq("id", vision.id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    showToast("Konnte nicht gespeichert werden.", "error");
    return;
  }

  if (achieved) celebrate(14);
  await loadVisions();
}

async function deleteVision(id) {
  const confirmed = await confirmDialog("Dieses Ziel wird endgültig gelöscht.");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("visions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Ziel konnte nicht gelöscht werden.", "error");
    return;
  }

  showToast("Ziel gelöscht.");
  await loadVisions();
}

/* ---------- modal ---------- */

function openCreateModal() {
  if (!requirePerson()) return;

  editingVisionId = null;
  visionModalTitle.textContent = "Neues Ziel";
  saveVisionBtn.textContent = "Ziel eintragen";

  visionTitleInput.value = "";
  visionDescInput.value = "";
  visionHorizonInput.value = "bald";
  visionCoverInput.value = "";
  visionCoverPreviewWrap.classList.add("hidden");
  visionCoverPreviewImg.src = "";

  visionModal.classList.remove("hidden");
  visionTitleInput.focus();
}

function openEditModal(vision) {
  editingVisionId = vision.id;
  visionModalTitle.textContent = "Ziel bearbeiten";
  saveVisionBtn.textContent = "Änderungen speichern";

  visionTitleInput.value = vision.title || "";
  visionDescInput.value = vision.description || "";
  visionHorizonInput.value = vision.horizon || "bald";
  visionCoverInput.value = "";

  if (vision.image_url) {
    visionCoverPreviewImg.src = vision.image_url;
    visionCoverPreviewWrap.classList.remove("hidden");
  } else {
    visionCoverPreviewWrap.classList.add("hidden");
  }

  visionModal.classList.remove("hidden");
  visionTitleInput.focus();
}

async function saveVision() {
  const title = visionTitleInput.value.trim();
  const description = visionDescInput.value.trim();
  const horizon = visionHorizonInput.value;
  const coverFile = visionCoverInput.files[0];

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  saveVisionBtn.disabled = true;
  saveVisionBtn.innerHTML = `<span class="spinner"></span> Speichern…`;

  try {
    let imageUrl;

    if (coverFile) {
      imageUrl = await uploadCover(coverFile);
    }

    if (editingVisionId) {
      const update = { title, description, horizon };
      if (imageUrl) update.image_url = imageUrl;

      const { error } = await supabaseClient
        .from("visions")
        .update(update)
        .eq("id", editingVisionId);

      if (error) throw error;

      showToast("Ziel aktualisiert 💗", "success");
    } else {
      const { error } = await supabaseClient
        .from("visions")
        .insert({
          title,
          description,
          horizon,
          person: currentPerson,
          image_url: imageUrl || null
        });

      if (error) throw error;

      celebrate(10);
      showToast(`${currentPerson} hat ein neues Ziel eingetragen 🔭`, "success");
    }

    visionModal.classList.add("hidden");
    await loadVisions();
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Ziel konnte nicht gespeichert werden.", "error");
  } finally {
    saveVisionBtn.disabled = false;
    saveVisionBtn.textContent = editingVisionId ? "Änderungen speichern" : "Ziel eintragen";
  }
}

visionCoverInput.addEventListener("change", () => {
  const file = visionCoverInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    visionCoverPreviewImg.src = reader.result;
    visionCoverPreviewWrap.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

openVisionModal.addEventListener("click", openCreateModal);
closeVisionModal.addEventListener("click", () => visionModal.classList.add("hidden"));
saveVisionBtn.addEventListener("click", saveVision);

/* ---------- realtime + init ---------- */

supabaseClient
  .channel("visions_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "visions" }, () => {
    loadVisions();
  })
  .subscribe();

loadVisions();
