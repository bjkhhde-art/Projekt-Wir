const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
const coverInput = document.getElementById("coverInput");
const coverPreviewWrap = document.getElementById("coverPreviewWrap");
const coverPreviewImg = document.getElementById("coverPreviewImg");

const backToMemories = document.getElementById("backToMemories");
const galleryTitle = document.getElementById("galleryTitle");
const galleryInfo = document.getElementById("galleryInfo");
const galleryCoverImg = document.getElementById("galleryCoverImg");
const editTripBtn = document.getElementById("editTripBtn");

const dropzone = document.getElementById("dropzone");
const imageInput = document.getElementById("imageInput");
const uploadQueue = document.getElementById("uploadQueue");
const uploadPreviewList = document.getElementById("uploadPreviewList");
const captionInput = document.getElementById("captionInput");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const clearQueueBtn = document.getElementById("clearQueueBtn");

const imageLightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeLightbox = document.getElementById("closeLightbox");

let memories = [];
let images = [];
let currentMemory = null;
let editingTripId = null;
let pendingFiles = [];

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

function renderMemories() {
  memoryGrid.innerHTML = "";

  if (memories.length === 0) {
    memoryGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📸</span>
        <p>Noch keine Erinnerungen angelegt.<br>Tippt unten rechts auf + und startet euren ersten Trip.</p>
      </div>
    `;
    return;
  }

  memories.forEach(memory => {
    const card = document.createElement("div");
    card.className = "memory-card card card-hover";

    if (isFutureMemory(memory.start_date)) {
      card.classList.add("future-memory");
    }

    card.innerHTML = `
      ${isFutureMemory(memory.start_date) ? `<span class="future-badge chip">Geplant</span>` : ""}
      <div class="memory-card-actions">
        <button class="icon-action edit-memory-btn" title="Bearbeiten">✏️</button>
        <button class="icon-action delete-memory-btn" title="Löschen">×</button>
      </div>
      <img src="${memory.cover_url || ""}" alt="${memory.title}" onerror="this.style.display='none'">
      <div class="memory-content">
        <h2>${memory.title}</h2>
        <p>${memory.location || ""}</p>
        <p>${formatDateRange(memory.start_date, memory.end_date)}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      openGallery(memory);
    });

    card.querySelector(".delete-memory-btn").addEventListener("click", event => {
      event.stopPropagation();
      deleteMemory(memory.id);
    });

    card.querySelector(".edit-memory-btn").addEventListener("click", event => {
      event.stopPropagation();
      openEditModal(memory);
    });

    memoryGrid.appendChild(card);
  });
}

function openCreateModal() {
  editingTripId = null;
  memoryModalTitle.textContent = "Neue Erinnerung";
  saveMemoryBtn.textContent = "Erinnerung erstellen";

  memoryTitleInput.value = "";
  memoryLocationInput.value = "";
  memoryStartInput.value = "";
  memoryEndInput.value = "";
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

  saveMemoryBtn.disabled = true;
  saveMemoryBtn.innerHTML = `<span class="spinner"></span> Speichern…`;

  try {
    let coverUrl;

    if (coverFile) {
      coverUrl = await uploadFile(coverFile, "covers");
    }

    if (editingTripId) {
      const update = { title, location, start_date: startDate || null, end_date: endDate || null };
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
}

async function openGallery(memory) {
  currentMemory = memory;

  memoryOverview.classList.add("hidden");
  galleryView.classList.remove("hidden");
  openMemoryModal.classList.add("hidden");

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

  images = data;
  renderImages();
}

function renderImages() {
  imageGrid.innerHTML = "";

  if (images.length === 0) {
    imageGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🖼️</span>
        <p>Noch keine Bilder in diesem Trip.<br>Zieht welche in das Feld oben.</p>
      </div>
    `;
    return;
  }

  images.forEach(image => {
    const card = document.createElement("div");
    card.className = "image-card card";

    card.innerHTML = `
      <button class="delete-image-btn icon-action" title="Löschen">×</button>
      <img src="${image.image_url}" alt="${image.caption || "Erinnerungsbild"}">
      <div class="image-caption-row">
        <p class="image-caption ${image.caption ? "" : "empty"}">${image.caption || "Beschriftung hinzufügen…"}</p>
        <button class="edit-caption-btn icon-action" title="Beschriftung bearbeiten">✏️</button>
      </div>
    `;

    card.querySelector(".delete-image-btn").addEventListener("click", event => {
      event.stopPropagation();
      deleteImage(image.id);
    });

    card.querySelector("img").addEventListener("click", event => {
      event.stopPropagation();
      openLightbox(image.image_url, image.caption);
    });

    card.querySelector(".edit-caption-btn").addEventListener("click", event => {
      event.stopPropagation();
      startCaptionEdit(card, image);
    });

    imageGrid.appendChild(card);
  });
}

function startCaptionEdit(card, image) {
  const row = card.querySelector(".image-caption-row");
  const currentText = image.caption || "";

  row.innerHTML = `
    <input type="text" class="caption-edit-input" value="${currentText.replace(/"/g, "&quot;")}" placeholder="Beschriftung...">
    <button class="save-caption-btn icon-action" title="Speichern">✓</button>
  `;

  const input = row.querySelector(".caption-edit-input");
  input.focus();
  input.select();

  function save() {
    updateCaption(image.id, input.value.trim());
  }

  row.querySelector(".save-caption-btn").addEventListener("click", save);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") save();
    if (event.key === "Escape") renderImages();
  });
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
      <img src="${url}" alt="${file.name}">
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
      const imageUrl = await uploadFile(file, `memories/${currentMemory.id}`);

      const { error } = await supabaseClient
        .from("trip_images")
        .insert({
          trip_id: currentMemory.id,
          image_url: imageUrl,
          caption: caption
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

async function uploadFile(file, folder) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabaseClient
    .storage
    .from("trip-images")
    .upload(fileName, file);

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
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/* ---------- event wiring ---------- */

openMemoryModal.addEventListener("click", openCreateModal);

closeMemoryModal.addEventListener("click", () => {
  memoryModal.classList.add("hidden");
});

saveMemoryBtn.addEventListener("click", saveMemory);

editTripBtn.addEventListener("click", () => {
  if (currentMemory) openEditModal(currentMemory);
});

backToMemories.addEventListener("click", () => {
  currentMemory = null;
  galleryView.classList.add("hidden");
  memoryOverview.classList.remove("hidden");
  openMemoryModal.classList.remove("hidden");
});

dropzone.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", () => {
  addFilesToQueue(imageInput.files);
  imageInput.value = "";
});

["dragenter", "dragover"].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", event => {
  if (event.dataTransfer.files.length) {
    addFilesToQueue(event.dataTransfer.files);
  }
});

uploadImageBtn.addEventListener("click", uploadQueuedImages);
clearQueueBtn.addEventListener("click", clearUploadQueue);

closeLightbox.addEventListener("click", closeImageLightbox);

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
