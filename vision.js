/* shares ziele.html with the Couple Quest (app.js), so its client gets its own name */
const visionDb = supabase.createClient(
  "https://lrzgcqoqcwicpuuuhaoj.supabase.co",
  "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK"
);

const visionTimeline = document.getElementById("visionTimeline");

const openVisionModal = document.getElementById("openVisionModal");
const visionModal = document.getElementById("visionModal");
const visionModalTitle = document.getElementById("visionModalTitle");
const visionTitleInput = document.getElementById("visionTitleInput");
const visionDescInput = document.getElementById("visionDescInput");
const visionYearInput = document.getElementById("visionYearInput");
const visionCoverPreviewWrap = document.getElementById("visionCoverPreviewWrap");
const visionCoverPreviewImg = document.getElementById("visionCoverPreviewImg");
const visionCoverInput = document.getElementById("visionCoverInput");
const saveVisionBtn = document.getElementById("saveVisionBtn");
const closeVisionModal = document.getElementById("closeVisionModal");

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const CURRENT_YEAR = new Date().getFullYear();
const MAX_YEAR = 2100;

let currentPerson = localStorage.getItem("pw_person");
let visions = [];
let editingVisionId = null;

function populateYearOptions() {
  let options = "";
  for (let year = CURRENT_YEAR; year <= MAX_YEAR; year++) {
    options += `<option value="${year}">${year}</option>`;
  }
  visionYearInput.innerHTML = options;
}
populateYearOptions();

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

function buildVisionCard(vision) {
  const card = document.createElement("div");
  card.className = `vision-card card ${vision.achieved ? "achieved" : ""}`;

  card.innerHTML = `
    ${vision.image_url
      ? `<img class="vision-card-image" src="${escapeHtml(vision.image_url)}" alt="${escapeHtml(vision.title)}" loading="lazy" decoding="async">`
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
  `;

  card.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleAchieved(vision));
  card.querySelector('[data-action="edit"]').addEventListener("click", () => openVisionEditModal(vision));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteVision(vision.id));

  return card;
}

function buildYearRow(year, entries) {
  const row = document.createElement("div");
  row.dataset.year = year;
  row.className = "vision-year-row" +
    (entries.length > 0 ? " has-entries" : "") +
    (year === CURRENT_YEAR ? " is-current-year" : "");

  const gutter = document.createElement("div");
  gutter.className = "vision-year-gutter";
  const dot = document.createElement("span");
  dot.className = "vision-year-dot";
  gutter.appendChild(dot);

  const content = document.createElement("div");
  content.className = "vision-year-content";

  const num = document.createElement("div");
  num.className = "vision-year-num";
  num.textContent = String(year);
  content.appendChild(num);

  if (entries.length > 0) {
    const entriesWrap = document.createElement("div");
    entriesWrap.className = "vision-year-entries";
    entries.forEach(vision => entriesWrap.appendChild(buildVisionCard(vision)));
    content.appendChild(entriesWrap);
  }

  row.appendChild(gutter);
  row.appendChild(content);

  return row;
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

  const track = document.createElement("div");
  track.className = "vision-track";

  for (let year = CURRENT_YEAR; year <= MAX_YEAR; year++) {
    const entries = visions.filter(v => v.target_year === year);
    track.appendChild(buildYearRow(year, entries));
  }

  visionTimeline.appendChild(track);
}

/* ---------- data ---------- */

async function loadVisions() {
  const { data, error } = await visionDb
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

async function uploadCover(originalFile) {
  const file = await shrinkImageForUpload(originalFile);
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await visionDb
    .storage
    .from("vision-images")
    .upload(fileName, file, { contentType: file.type, cacheControl: "31536000" });

  if (error) {
    console.error("Fehler beim Upload:", error);
    throw error;
  }

  const { data } = visionDb
    .storage
    .from("vision-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function toggleAchieved(vision) {
  const achieved = !vision.achieved;

  const { error } = await visionDb
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

  const { error } = await visionDb
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
  visionYearInput.value = String(CURRENT_YEAR);
  visionCoverInput.value = "";
  visionCoverPreviewWrap.classList.add("hidden");
  visionCoverPreviewImg.src = "";

  visionModal.classList.remove("hidden");
  visionTitleInput.focus();
}

function openVisionEditModal(vision) {
  editingVisionId = vision.id;
  visionModalTitle.textContent = "Ziel bearbeiten";
  saveVisionBtn.textContent = "Änderungen speichern";

  visionTitleInput.value = vision.title || "";
  visionDescInput.value = vision.description || "";
  visionYearInput.value = String(vision.target_year || CURRENT_YEAR);
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
  const targetYear = Number(visionYearInput.value);
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
      const update = { title, description, target_year: targetYear };
      if (imageUrl) update.image_url = imageUrl;

      const { error } = await visionDb
        .from("visions")
        .update(update)
        .eq("id", editingVisionId);

      if (error) throw error;

      showToast("Ziel aktualisiert 💗", "success");
    } else {
      const { error } = await visionDb
        .from("visions")
        .insert({
          title,
          description,
          target_year: targetYear,
          person: currentPerson,
          image_url: imageUrl || null
        });

      if (error) throw error;

      celebrate(10);
      showToast(`${currentPerson} hat ein neues Ziel für ${targetYear} eingetragen 🔭`, "success");
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

visionDb
  .channel("visions_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "visions" }, () => {
    loadVisions();
  })
  .subscribe();

loadVisions();
