const memoryOverview = document.getElementById("memoryOverview");
const galleryView = document.getElementById("galleryView");

const memoryGrid = document.getElementById("memoryGrid");
const imageGrid = document.getElementById("imageGrid");

const openMemoryModal = document.getElementById("openMemoryModal");
const memoryModal = document.getElementById("memoryModal");
const memoryModalTitle = document.getElementById("memoryModalTitle");
const closeMemoryModal = document.getElementById("closeMemoryModal");
const saveMemoryBtn = document.getElementById("saveMemoryBtn");

const memoryTitleInput = document.getElementById("memoryTitleInput");
const memoryLocationInput = document.getElementById("memoryLocationInput");
const memoryStartInput = document.getElementById("memoryStartInput");
const memoryEndInput = document.getElementById("memoryEndInput");
const memoryCoordsInput = document.getElementById("memoryCoordsInput");
const coverInput = document.getElementById("coverInput");
const coverPreviewWrap = document.getElementById("coverPreviewWrap");
const coverPreviewImg = document.getElementById("coverPreviewImg");

const backToMemories = document.getElementById("backToMemories");
const galleryTitle = document.getElementById("galleryTitle");
const galleryInfo = document.getElementById("galleryInfo");
const galleryCoverImg = document.getElementById("galleryCoverImg");
const editTripBtn = document.getElementById("editTripBtn");

const imageInput = document.getElementById("imageInput");
const uploadQueue = document.getElementById("uploadQueue");
const uploadPreviewList = document.getElementById("uploadPreviewList");
const captionInput = document.getElementById("captionInput");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const clearQueueBtn = document.getElementById("clearQueueBtn");

const imageHint = document.getElementById("imageHint");
const tripCountdown = document.getElementById("tripCountdown");

const imageSheet = document.getElementById("imageSheet");
const imageSheetPreview = document.getElementById("imageSheetPreview");
const imageSheetActions = document.getElementById("imageSheetActions");
const imageSheetCaption = document.getElementById("imageSheetCaption");
const sheetCaptionInput = document.getElementById("sheetCaptionInput");
const sheetEditCaption = document.getElementById("sheetEditCaption");
const sheetSetCover = document.getElementById("sheetSetCover");
const sheetDelete = document.getElementById("sheetDelete");
const sheetSaveCaption = document.getElementById("sheetSaveCaption");
const sheetCancel = document.getElementById("sheetCancel");
const sheetEditDate = document.getElementById("sheetEditDate");
const imageSheetDate = document.getElementById("imageSheetDate");
const sheetDateInput = document.getElementById("sheetDateInput");
const sheetDateHint = document.getElementById("sheetDateHint");
const sheetSaveDate = document.getElementById("sheetSaveDate");

const imageLightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeLightbox = document.getElementById("closeLightbox");

let memories = [];
let images = [];
let currentMemory = null;
let editingTripId = null;
let pendingFiles = [];
let tripsMapInstance = null;
let tripMarkersLayer = null;
let sheetImage = null;
let countdownTimer = null;

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

async function loadMemories() {
  memoryGrid.innerHTML = `<div class="skeleton memory-skeleton"></div><div class="skeleton memory-skeleton"></div><div class="skeleton memory-skeleton"></div>`;

  const { data, error } = await supabaseClient
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Erinnerungen:", error);
    showToast("Erinnerungen konnten nicht geladen werden.", "error");
    return;
  }

  memories = data;
  renderMemories();
}

window.handleBrokenCover = function (imgEl) {
  const placeholder = document.createElement("div");
  placeholder.className = "memory-cover-placeholder";
  placeholder.textContent = "📷";
  imgEl.replaceWith(placeholder);
};

function buildMemoryCard(memory) {
  const card = document.createElement("div");
  card.className = "memory-card card card-hover";

  card.innerHTML = `
    ${isFutureMemory(memory.start_date) ? `<span class="future-badge chip">${escapeHtml(countdownLabel(memory.start_date))}</span>` : ""}
    <div class="memory-card-actions">
      <button class="icon-action edit-memory-btn" title="Bearbeiten">✏️</button>
      <button class="icon-action delete-memory-btn" title="Löschen">×</button>
    </div>
    ${memory.cover_url
      ? `<img src="${escapeHtml(memory.cover_url)}" alt="${escapeHtml(memory.title)}" loading="lazy" decoding="async" onerror="window.handleBrokenCover(this)">`
      : `<div class="memory-cover-placeholder">📷</div>`}
    <div class="memory-content">
      <h2>${escapeHtml(memory.title)}</h2>
      <p>${escapeHtml(memory.location || "")}</p>
      <p>${formatDateRange(memory.start_date, memory.end_date)}</p>
    </div>
  `;

  card.addEventListener("click", () => {
    openTrip(memory);
  });

  card.querySelector(".delete-memory-btn").addEventListener("click", event => {
    event.stopPropagation();
    deleteMemory(memory.id);
  });

  card.querySelector(".edit-memory-btn").addEventListener("click", event => {
    event.stopPropagation();
    openEditModal(memory);
  });

  return card;
}

function buildMemorySectionHeading(text) {
  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = text;
  return heading;
}

function buildMemorySubgrid(list) {
  const grid = document.createElement("div");
  grid.className = "memory-subgrid";
  list.forEach(memory => grid.appendChild(buildMemoryCard(memory)));
  return grid;
}

function renderMemories() {
  memoryGrid.innerHTML = "";
  renderMapMarkers();

  if (memories.length === 0) {
    memoryGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📸</span>
        <p>Noch keine Erinnerungen angelegt.<br>Wir tippen unten rechts auf + und starten unseren ersten Trip.</p>
      </div>
    `;
    return;
  }

  const upcoming = memories.filter(memory => isFutureMemory(memory.start_date));
  const past = memories.filter(memory => !isFutureMemory(memory.start_date));

  if (upcoming.length > 0) {
    memoryGrid.appendChild(buildMemorySectionHeading("Kommt noch ✈️"));
    memoryGrid.appendChild(buildMemorySubgrid(upcoming));
  }

  if (past.length > 0) {
    if (upcoming.length > 0) {
      memoryGrid.appendChild(buildMemorySectionHeading("Erinnerungen"));
    }
    memoryGrid.appendChild(buildMemorySubgrid(past));
  }
}

/* ---------- world map ---------- */

function initTripsMap() {
  /* without the map library (bad network) only the map is missing, not the memories */
  if (typeof L === "undefined") {
    document.getElementById("tripsMap").classList.add("hidden");
    return;
  }
  tripsMapInstance = L.map("tripsMap", {
    worldCopyJump: true
  }).setView([20, 10], 2);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
    maxZoom: 16,
    maxNativeZoom: 16,
    minZoom: 2
  }).addTo(tripsMapInstance);

  tripMarkersLayer = L.layerGroup().addTo(tripsMapInstance);

  setTimeout(() => tripsMapInstance.invalidateSize(), 200);
}

function renderMapMarkers() {
  if (!tripsMapInstance) return;

  tripMarkersLayer.clearLayers();

  const allPoints = [];

  memories.forEach(memory => {
    const coords = memory.coordinates || [];

    coords.forEach(point => {
      const icon = L.divIcon({
        className: "",
        html: '<div class="trip-pin" title="' + memory.title.replace(/"/g, "&quot;") + '"></div>',
        iconSize: [18, 18]
      });

      const marker = L.marker([point.lat, point.lng], { icon });
      marker.on("click", () => openTrip(memory));
      marker.addTo(tripMarkersLayer);
      allPoints.push([point.lat, point.lng]);
    });
  });

  if (allPoints.length > 0) {
    const bounds = L.latLngBounds(allPoints);
    tripsMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }
}

function parseCoordsList(text) {
  const lines = (text || "").split("\n").map(line => line.trim()).filter(Boolean);

  if (lines.length === 0) return [];

  const points = [];

  for (const line of lines) {
    const match = line.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    points.push({ lat, lng });
  }

  return points;
}

function openCreateModal() {
  editingTripId = null;
  memoryModalTitle.textContent = "Neue Erinnerung";
  saveMemoryBtn.textContent = "Erinnerung erstellen";

  memoryTitleInput.value = "";
  memoryLocationInput.value = "";
  memoryStartInput.value = "";
  memoryEndInput.value = "";
  memoryCoordsInput.value = "";
  coverInput.value = "";
  coverPreviewWrap.classList.add("hidden");
  coverPreviewImg.src = "";

  memoryModal.classList.remove("hidden");
  memoryTitleInput.focus();
}

function openEditModal(memory) {
  editingTripId = memory.id;
  memoryModalTitle.textContent = "Erinnerung bearbeiten";
  saveMemoryBtn.textContent = "Änderungen speichern";

  memoryTitleInput.value = memory.title || "";
  memoryLocationInput.value = memory.location || "";
  memoryStartInput.value = memory.start_date || "";
  memoryEndInput.value = memory.end_date || "";
  memoryCoordsInput.value = (memory.coordinates || []).map(point => `${point.lat}, ${point.lng}`).join("\n");
  coverInput.value = "";

  if (memory.cover_url) {
    coverPreviewImg.src = memory.cover_url;
    coverPreviewWrap.classList.remove("hidden");
  } else {
    coverPreviewWrap.classList.add("hidden");
  }

  memoryModal.classList.remove("hidden");
  memoryTitleInput.focus();
}

async function saveMemory() {
  const title = memoryTitleInput.value.trim();
  const location = memoryLocationInput.value.trim();
  const startDate = memoryStartInput.value;
  const endDate = memoryEndInput.value;
  const coverFile = coverInput.files[0];

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  const coords = parseCoordsList(memoryCoordsInput.value);

  if (coords === null) {
    showToast("Ungültige Koordinaten. Format pro Zeile: Breitengrad, Längengrad (z. B. 53.5511, 9.9937)", "error");
    return;
  }

  saveMemoryBtn.disabled = true;
  saveMemoryBtn.innerHTML = `<span class="spinner"></span> Speichern…`;

  try {
    let coverUrl;

    if (coverFile) {
      coverUrl = await uploadFile(coverFile, "covers");
    }

    if (editingTripId) {
      const update = {
        title,
        location,
        start_date: startDate || null,
        end_date: endDate || null,
        coordinates: coords
      };
      if (coverUrl) update.cover_url = coverUrl;

      const { error } = await supabaseClient
        .from("trips")
        .update(update)
        .eq("id", editingTripId);

      if (error) throw error;

      showToast("Erinnerung aktualisiert 💗", "success");

      if (currentMemory && currentMemory.id === editingTripId) {
        currentMemory = { ...currentMemory, ...update };
        renderGalleryHeader();
      }
    } else {
      const { error } = await supabaseClient
        .from("trips")
        .insert({
          title,
          location,
          start_date: startDate || null,
          end_date: endDate || null,
          coordinates: coords,
          cover_url: coverUrl || ""
        });

      if (error) throw error;

      showToast("Neue Erinnerung erstellt ✨", "success");
      celebrate(10);
    }

    memoryModal.classList.add("hidden");
    await loadMemories();
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Speichern hat nicht geklappt.", "error");
  } finally {
    saveMemoryBtn.disabled = false;
    saveMemoryBtn.textContent = editingTripId ? "Änderungen speichern" : "Erinnerung erstellen";
  }
}

function renderGalleryHeader() {
  galleryTitle.textContent = currentMemory.title;
  galleryInfo.textContent = `${currentMemory.location || ""} · ${formatDateRange(currentMemory.start_date, currentMemory.end_date)}`;

  if (currentMemory.cover_url) {
    galleryCoverImg.src = currentMemory.cover_url;
    galleryCoverImg.style.display = "block";
  } else {
    galleryCoverImg.style.display = "none";
  }

  startTripCountdown();
}

/* ---------- countdown for upcoming trips ---------- */

function tripStartTime(startDate) {
  const [y, m, d] = startDate.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function countdownLabel(startDate) {
  const days = daysBetween(new Date(), startDate);
  if (days === 1) return "⏳ Morgen geht's los!";
  return `⏳ in ${days} Tagen`;
}

function renderTripCountdown() {
  const remaining = currentMemory && currentMemory.start_date ? tripStartTime(currentMemory.start_date) - Date.now() : 0;

  if (remaining <= 0) {
    stopTripCountdown();
    return;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const parts = [
    [Math.floor(totalSeconds / 86400), "Tage"],
    [Math.floor(totalSeconds / 3600) % 24, "Std"],
    [Math.floor(totalSeconds / 60) % 60, "Min"],
    [totalSeconds % 60, "Sek"]
  ];

  tripCountdown.innerHTML = `
    <span class="trip-countdown-label">✈️ Noch bis zur Abreise</span>
    <div class="trip-countdown-boxes">
      ${parts.map(([value, unit]) => `
        <div class="trip-countdown-box">
          <span class="trip-countdown-value">${String(value).padStart(2, "0")}</span>
          <span class="trip-countdown-unit">${unit}</span>
        </div>`).join("")}
    </div>
  `;
  tripCountdown.classList.remove("hidden");
}

function startTripCountdown() {
  stopTripCountdown();
  if (!currentMemory || !isFutureMemory(currentMemory.start_date)) return;
  renderTripCountdown();
  countdownTimer = setInterval(() => { if (!document.hidden) renderTripCountdown(); }, 1000);
}

function stopTripCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  tripCountdown.classList.add("hidden");
  tripCountdown.innerHTML = "";
}

/* opening a trip is a step of its own: the phone's back button returns to the overview */
function openTrip(memory) {
  if (window.InPageHistory) InPageHistory.push({ view: "trip:" + memory.id });
  openGallery(memory);
}

function closeGallery() {
  currentMemory = null;
  galleryView.classList.add("hidden");
  memoryOverview.classList.remove("hidden");
  setFabMode("trip");
  stopTripCountdown();
  closeImageSheet();
  closeImageLightbox();
  renderMemories();
}

window.addEventListener("popstate", event => {
  const view = (event.state && event.state.view) || "";
  const tripId = view.startsWith("trip:") ? view.slice(5) : null;
  if (tripId) {
    const memory = memories.find(m => String(m.id) === tripId);
    if (memory && (!currentMemory || String(currentMemory.id) !== tripId)) openGallery(memory);
  } else if (currentMemory) {
    closeGallery();
  }
});

async function openGallery(memory) {
  currentMemory = memory;

  memoryOverview.classList.add("hidden");
  galleryView.classList.remove("hidden");
  setFabMode("images");

  renderGalleryHeader();
  clearUploadQueue();

  await loadImages();
}

async function loadImages() {
  if (!currentMemory) return;

  imageGrid.innerHTML = `<div class="skeleton image-skeleton"></div><div class="skeleton image-skeleton"></div><div class="skeleton image-skeleton"></div>`;

  const { data, error } = await supabaseClient
    .from("trip_images")
    .select("*")
    .eq("trip_id", currentMemory.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Bilder:", error);
    showToast("Bilder konnten nicht geladen werden.", "error");
    return;
  }

  images = sortByTakenAt(data);
  renderImages();
}

/* photos in the order they were taken; without a date the upload time counts */
const takenTime = image => new Date(image.taken_at || image.created_at).getTime();

function sortByTakenAt(list) {
  return list.slice().sort((a, b) => takenTime(a) - takenTime(b) || new Date(a.created_at) - new Date(b.created_at));
}

function takenLabel(image) {
  if (!image.taken_at) return "";
  const date = new Date(image.taken_at);
  const day = date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  /* an estimated date has no real time of day */
  if (image.taken_at_source === "estimate") return `≈ ${day}`;
  return `${day} · ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

/* <input type="datetime-local"> wants local time without a zone */
function toLocalInputValue(value) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderImages() {
  imageGrid.innerHTML = "";
  imageHint.classList.toggle("hidden", images.length === 0);

  if (images.length === 0) {
    imageGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🖼️</span>
        <p>Noch keine Bilder in diesem Trip.<br>Wir tippen unten rechts auf + und fügen die ersten hinzu.</p>
      </div>
    `;
    return;
  }

  images.forEach(image => {
    const card = document.createElement("div");
    card.className = "image-card card";

    const taken = takenLabel(image);
    card.innerHTML = `
      <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.caption || "Erinnerungsbild")}" loading="lazy" decoding="async" draggable="false">
      ${taken ? `<span class="image-date${image.taken_at_source === "estimate" ? " estimate" : ""}">${escapeHtml(taken)}</span>` : ""}
      ${image.caption ? `<p class="image-caption">${escapeHtml(image.caption)}</p>` : ""}
    `;

    attachLongPress(card, () => openImageSheet(image), () => openLightbox(image.image_url, image.caption));
    imageGrid.appendChild(card);
  });
}

/* tap opens the photo, holding it (or right-click on a computer) opens the edit menu */
function attachLongPress(el, onLongPress, onTap) {
  let timer = null;
  let start = null;
  let fired = false;

  function cancel() {
    clearTimeout(timer);
    timer = null;
    el.classList.remove("pressing");
  }

  el.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    fired = false;
    start = { x: event.clientX, y: event.clientY };
    el.classList.add("pressing");
    timer = setTimeout(() => {
      fired = true;
      cancel();
      if (navigator.vibrate) navigator.vibrate(15);
      onLongPress();
    }, LONG_PRESS_MS);
  });

  el.addEventListener("pointermove", event => {
    if (!timer || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE) cancel();
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach(name => el.addEventListener(name, cancel));

  el.addEventListener("click", event => {
    event.stopPropagation();
    if (fired) {
      fired = false;
      return;
    }
    onTap();
  });

  el.addEventListener("contextmenu", event => {
    event.preventDefault();
    if (fired) return;
    fired = true;
    cancel();
    onLongPress();
  });
}

function openImageSheet(image) {
  sheetImage = image;
  imageSheetPreview.src = image.image_url;
  imageSheetPreview.alt = image.caption || "Erinnerungsbild";
  imageSheetActions.classList.remove("hidden");
  imageSheetCaption.classList.add("hidden");
  imageSheetDate.classList.add("hidden");
  sheetSetCover.classList.toggle("hidden", !!currentMemory && currentMemory.cover_url === image.image_url);
  imageSheet.classList.remove("hidden");
}

function closeImageSheet() {
  imageSheet.classList.add("hidden");
  sheetImage = null;
}

function showCaptionEditor() {
  if (!sheetImage) return;
  imageSheetActions.classList.add("hidden");
  imageSheetCaption.classList.remove("hidden");
  sheetCaptionInput.value = sheetImage.caption || "";
  sheetCaptionInput.focus();
  sheetCaptionInput.select();
}

function showDateEditor() {
  if (!sheetImage) return;
  imageSheetActions.classList.add("hidden");
  imageSheetDate.classList.remove("hidden");
  sheetDateInput.value = toLocalInputValue(sheetImage.taken_at || sheetImage.created_at);
  sheetDateHint.textContent = sheetImage.taken_at_source === "estimate" || !sheetImage.taken_at
    ? "Das Datum ist nur geschätzt – hier könnt ihr das richtige eintragen."
    : sheetImage.taken_at_source === "manual" ? "Von euch eingetragen." : "Aus dem Foto gelesen.";
  sheetDateInput.focus();
}

async function saveSheetDate() {
  if (!sheetImage || !sheetDateInput.value) return;
  const imageId = sheetImage.id;
  const takenAt = new Date(sheetDateInput.value);
  if (isNaN(takenAt)) return;
  closeImageSheet();

  const { error } = await supabaseClient
    .from("trip_images")
    .update({ taken_at: takenAt.toISOString(), taken_at_source: "manual" })
    .eq("id", imageId);

  if (error) {
    console.error("Fehler beim Speichern des Datums:", error);
    showToast("Datum konnte nicht gespeichert werden.", "error");
    return;
  }

  showToast("Datum gespeichert 📅", "success");
  await loadImages();
}

async function saveSheetCaption() {
  if (!sheetImage) return;
  const imageId = sheetImage.id;
  closeImageSheet();
  await updateCaption(imageId, sheetCaptionInput.value.trim());
}

async function setImageAsCover() {
  if (!sheetImage || !currentMemory) return;
  const imageUrl = sheetImage.image_url;
  closeImageSheet();

  const { error } = await supabaseClient
    .from("trips")
    .update({ cover_url: imageUrl })
    .eq("id", currentMemory.id);

  if (error) {
    console.error("Fehler beim Setzen des Titelbilds:", error);
    showToast("Titelbild konnte nicht gesetzt werden.", "error");
    return;
  }

  currentMemory.cover_url = imageUrl;
  const listed = memories.find(memory => memory.id === currentMemory.id);
  if (listed) listed.cover_url = imageUrl;
  renderGalleryHeader();
  showToast("Neues Titelbild gesetzt 🖼️", "success");
}

async function deleteSheetImage() {
  if (!sheetImage) return;
  const imageId = sheetImage.id;
  closeImageSheet();
  await deleteImage(imageId);
}

async function updateCaption(imageId, caption) {
  const { error } = await supabaseClient
    .from("trip_images")
    .update({ caption })
    .eq("id", imageId);

  if (error) {
    console.error("Fehler beim Aktualisieren der Beschriftung:", error);
    showToast("Beschriftung konnte nicht gespeichert werden.", "error");
    return;
  }

  await loadImages();
}

/* ---------- drag & drop / multi upload ---------- */

function addFilesToQueue(fileList) {
  const files = Array.from(fileList).filter(file => file.type.startsWith("image/"));

  if (files.length === 0) return;

  pendingFiles = pendingFiles.concat(files);
  renderUploadQueue();
}

function renderUploadQueue() {
  if (pendingFiles.length === 0) {
    uploadQueue.classList.add("hidden");
    return;
  }

  uploadQueue.classList.remove("hidden");
  uploadPreviewList.innerHTML = "";

  pendingFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);

    const thumb = document.createElement("div");
    thumb.className = "upload-thumb";
    thumb.innerHTML = `
      <img src="${url}" alt="${escapeHtml(file.name)}">
      <button class="remove-thumb-btn" title="Entfernen">×</button>
    `;

    thumb.querySelector(".remove-thumb-btn").addEventListener("click", () => {
      pendingFiles.splice(index, 1);
      renderUploadQueue();
    });

    uploadPreviewList.appendChild(thumb);
  });
}

function clearUploadQueue() {
  pendingFiles = [];
  captionInput.value = "";
  renderUploadQueue();
}

async function uploadQueuedImages() {
  if (!currentMemory || pendingFiles.length === 0) return;

  uploadImageBtn.disabled = true;
  uploadImageBtn.innerHTML = `<span class="spinner"></span> Lade ${pendingFiles.length} Bild(er) hoch…`;

  const caption = captionInput.value.trim();
  let successCount = 0;

  for (const file of pendingFiles) {
    try {
      /* read the date from the original – the smaller upload copy has no metadata any more */
      const taken = await takenAtOf(file);
      const imageUrl = await uploadFile(file, `memories/${currentMemory.id}`);

      const { error } = await supabaseClient
        .from("trip_images")
        .insert({
          trip_id: currentMemory.id,
          image_url: imageUrl,
          caption: caption,
          taken_at: taken.date.toISOString(),
          taken_at_source: taken.source
        });

      if (error) throw error;
      successCount++;
    } catch (error) {
      console.error("Fehler beim Bild speichern:", error);
    }
  }

  uploadImageBtn.disabled = false;
  uploadImageBtn.textContent = "Hochladen";

  if (successCount > 0) {
    showToast(`${successCount} Bild(er) hochgeladen 📸`, "success");
    celebrate(8);
  }

  if (successCount < pendingFiles.length) {
    showToast("Manche Bilder konnten nicht hochgeladen werden.", "error");
  }

  clearUploadQueue();
  await loadImages();
}

/* camera data or file name; otherwise the file's own date (if it is not just "now"), as an estimate */
async function takenAtOf(file) {
  const found = window.PhotoDate ? await PhotoDate.fromFile(file) : null;
  if (found) return found;
  const modified = file.lastModified ? new Date(file.lastModified) : null;
  const fresh = !modified || Date.now() - modified.getTime() < 60 * 60 * 1000;
  return { date: fresh ? new Date() : modified, source: "estimate" };
}

async function uploadFile(originalFile, folder) {
  const file = await shrinkImageForUpload(originalFile);
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabaseClient
    .storage
    .from("trip-images")
    .upload(fileName, file, { contentType: file.type, cacheControl: "31536000" });

  if (error) {
    console.error("Fehler beim Upload:", error);
    throw error;
  }

  const { data } = supabaseClient
    .storage
    .from("trip-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function deleteImage(id) {
  const confirmed = await confirmDialog("Dieses Bild wird endgültig gelöscht.");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("trip_images")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Bild konnte nicht gelöscht werden.", "error");
    return;
  }

  showToast("Bild gelöscht.");
  await loadImages();
}

async function deleteMemory(id) {
  const confirmed = await confirmDialog("Die Erinnerung und alle enthaltenen Bilder werden endgültig gelöscht.");
  if (!confirmed) return;

  await supabaseClient
    .from("trip_images")
    .delete()
    .eq("trip_id", id);

  const { error } = await supabaseClient
    .from("trips")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen der Erinnerung:", error);
    showToast("Erinnerung konnte nicht gelöscht werden.", "error");
    return;
  }

  showToast("Erinnerung gelöscht.");
  await loadMemories();
}

function openLightbox(imageUrl, caption) {
  lightboxImage.src = imageUrl;
  lightboxCaption.textContent = caption || "";
  imageLightbox.classList.remove("hidden");
}

function closeImageLightbox() {
  imageLightbox.classList.add("hidden");
  lightboxImage.src = "";
  lightboxCaption.textContent = "";
}

function isFutureMemory(startDate) {
  if (!startDate) return false;
  return daysBetween(new Date(), startDate) > 0;
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  if (start && !end) return formatDate(start);
  if (!start && end) return formatDate(end);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/* ---------- event wiring ---------- */

/* one "+" button: new trip in the overview, add photos inside a trip */
function setFabMode(mode) {
  openMemoryModal.dataset.mode = mode;
  const label = mode === "images" ? "Bilder hinzufügen" : "Neue Erinnerung";
  openMemoryModal.title = label;
  openMemoryModal.setAttribute("aria-label", label);
}

openMemoryModal.addEventListener("click", () => {
  if (openMemoryModal.dataset.mode === "images" && currentMemory) {
    imageInput.click();
  } else {
    openCreateModal();
  }
});

closeMemoryModal.addEventListener("click", () => {
  memoryModal.classList.add("hidden");
});

saveMemoryBtn.addEventListener("click", saveMemory);

editTripBtn.addEventListener("click", () => {
  if (currentMemory) openEditModal(currentMemory);
});

backToMemories.addEventListener("click", () => {
  const openedHere = history.state && history.state.view && history.state.view.startsWith("trip:");
  if (openedHere && window.InPageHistory) InPageHistory.back(closeGallery);
  else closeGallery();
});

imageInput.addEventListener("change", () => {
  addFilesToQueue(imageInput.files);
  imageInput.value = "";
});

/* on a computer photos can still be dragged anywhere onto the open trip */
["dragenter", "dragover"].forEach(eventName => {
  galleryView.addEventListener(eventName, event => {
    event.preventDefault();
    galleryView.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(eventName => {
  galleryView.addEventListener(eventName, event => {
    if (eventName === "dragleave" && galleryView.contains(event.relatedTarget)) return;
    event.preventDefault();
    galleryView.classList.remove("dragover");
  });
});

galleryView.addEventListener("drop", event => {
  if (event.dataTransfer.files.length) {
    addFilesToQueue(event.dataTransfer.files);
  }
});

uploadImageBtn.addEventListener("click", uploadQueuedImages);
clearQueueBtn.addEventListener("click", clearUploadQueue);

closeLightbox.addEventListener("click", closeImageLightbox);

sheetEditCaption.addEventListener("click", showCaptionEditor);
sheetSetCover.addEventListener("click", setImageAsCover);
sheetDelete.addEventListener("click", deleteSheetImage);
sheetSaveCaption.addEventListener("click", saveSheetCaption);
sheetEditDate.addEventListener("click", showDateEditor);
sheetSaveDate.addEventListener("click", saveSheetDate);
sheetDateInput.addEventListener("keydown", event => {
  if (event.key === "Enter") saveSheetDate();
  if (event.key === "Escape") closeImageSheet();
});
sheetCancel.addEventListener("click", closeImageSheet);
sheetCaptionInput.addEventListener("keydown", event => {
  if (event.key === "Enter") saveSheetCaption();
  if (event.key === "Escape") closeImageSheet();
});
imageSheet.addEventListener("click", event => {
  if (event.target === imageSheet) closeImageSheet();
});

imageLightbox.addEventListener("click", event => {
  if (event.target === imageLightbox) {
    closeImageLightbox();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !imageLightbox.classList.contains("hidden")) {
    closeImageLightbox();
  }
});

initTripsMap();
loadMemories();

supabaseClient
  .channel("memories_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "trips" },
    () => {
      loadMemories();
    }
  )
  .subscribe();

supabaseClient
  .channel("memory_images_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "trip_images" },
    () => {
      if (currentMemory) {
        loadImages();
      }
    }
  )
  .subscribe();

document.addEventListener("pw:hub-tab-shown", event => {
  if (event.detail.tab === "erinnerungen" && tripsMapInstance) {
    setTimeout(() => tripsMapInstance.invalidateSize(), 50);
  }
});
