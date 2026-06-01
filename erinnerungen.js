const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const memoryOverview = document.getElementById("memoryOverview");
const galleryView = document.getElementById("galleryView");

const memoryGrid = document.getElementById("memoryGrid");
const imageGrid = document.getElementById("imageGrid");

const openMemoryModal = document.getElementById("openMemoryModal");
const memoryModal = document.getElementById("memoryModal");
const closeMemoryModal = document.getElementById("closeMemoryModal");
const createMemoryBtn = document.getElementById("createMemoryBtn");

const memoryTitleInput = document.getElementById("memoryTitleInput");
const memoryLocationInput = document.getElementById("memoryLocationInput");
const memoryStartInput = document.getElementById("memoryStartInput");
const memoryEndInput = document.getElementById("memoryEndInput");
const coverInput = document.getElementById("coverInput");

const backToMemories = document.getElementById("backToMemories");
const galleryTitle = document.getElementById("galleryTitle");
const galleryInfo = document.getElementById("galleryInfo");

const imageInput = document.getElementById("imageInput");
const captionInput = document.getElementById("captionInput");
const uploadImageBtn = document.getElementById("uploadImageBtn");

const imageLightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeLightbox = document.getElementById("closeLightbox");

let memories = [];
let images = [];
let currentMemory = null;

async function loadMemories() {
  const { data, error } = await supabaseClient
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Fehler beim Laden der Erinnerungen:", error);
    alert("Erinnerungen konnten nicht geladen werden.");
    return;
  }

  memories = data;
  renderMemories();
}

function renderMemories() {
  memoryGrid.innerHTML = "";

  if (memories.length === 0) {
    memoryGrid.innerHTML = "<p>Noch keine Erinnerungen angelegt 📸</p>";
    return;
  }

  memories.forEach(memory => {
    const card = document.createElement("div");
    card.className = "memory-card";

    if (isFutureMemory(memory.start_date)) {
      card.classList.add("future-memory");
    }

    card.innerHTML = `
      ${isFutureMemory(memory.start_date) ? `<span class="future-badge">Geplant</span>` : ""}
      <button class="delete-memory-btn">×</button>
      <img src="${memory.cover_url || ""}" alt="${memory.title}">
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

    memoryGrid.appendChild(card);
  });
}

async function createMemory() {
  const title = memoryTitleInput.value.trim();
  const location = memoryLocationInput.value.trim();
  const startDate = memoryStartInput.value;
  const endDate = memoryEndInput.value;
  const coverFile = coverInput.files[0];

  if (!title) {
    alert("Bitte einen Titel eingeben.");
    return;
  }

  let coverUrl = "";

  if (coverFile) {
    coverUrl = await uploadFile(coverFile, "covers");
  }

  const { error } = await supabaseClient
    .from("trips")
    .insert({
      title: title,
      location: location,
      start_date: startDate || null,
      end_date: endDate || null,
      cover_url: coverUrl
    });

  if (error) {
    console.error("Fehler beim Erstellen:", error);
    alert("Erinnerung konnte nicht erstellt werden.");
    return;
  }

  memoryTitleInput.value = "";
  memoryLocationInput.value = "";
  memoryStartInput.value = "";
  memoryEndInput.value = "";
  coverInput.value = "";

  memoryModal.classList.add("hidden");
  await loadMemories();
}

async function openGallery(memory) {
  currentMemory = memory;

  memoryOverview.classList.add("hidden");
  galleryView.classList.remove("hidden");

  galleryTitle.textContent = memory.title;
  galleryInfo.textContent = `${memory.location || ""} ${formatDateRange(memory.start_date, memory.end_date)}`;

  await loadImages();
}

async function loadImages() {
  if (!currentMemory) return;

  const { data, error } = await supabaseClient
    .from("trip_images")
    .select("*")
    .eq("trip_id", currentMemory.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Bilder:", error);
    alert("Bilder konnten nicht geladen werden.");
    return;
  }

  images = data;
  renderImages();
}

function renderImages() {
  imageGrid.innerHTML = "";

  if (images.length === 0) {
    imageGrid.innerHTML = "<p>Noch keine Bilder vorhanden 📸</p>";
    return;
  }

  images.forEach(image => {
    const card = document.createElement("div");
    card.className = "image-card";

    card.innerHTML = `
      <button class="delete-image-btn">×</button>
      <img src="${image.image_url}" alt="${image.caption || "Erinnerungsbild"}">
      ${image.caption ? `<p>${image.caption}</p>` : ""}
    `;

    card.querySelector(".delete-image-btn").addEventListener("click", event => {
      event.stopPropagation();
      deleteImage(image.id);
    });

    card.querySelector("img").addEventListener("click", event => {
      event.stopPropagation();
      openLightbox(image.image_url, image.caption);
    });

    imageGrid.appendChild(card);
  });
}

async function uploadImage() {
  if (!currentMemory) return;

  const file = imageInput.files[0];

  if (!file) {
    alert("Bitte ein Bild auswählen.");
    return;
  }

  const imageUrl = await uploadFile(file, `memories/${currentMemory.id}`);

  const { error } = await supabaseClient
    .from("trip_images")
    .insert({
      trip_id: currentMemory.id,
      image_url: imageUrl,
      caption: captionInput.value.trim()
    });

  if (error) {
    console.error("Fehler beim Bild speichern:", error);
    alert("Bild konnte nicht gespeichert werden.");
    return;
  }

  imageInput.value = "";
  captionInput.value = "";

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
    alert("Upload hat nicht geklappt.");
    throw error;
  }

  const { data } = supabaseClient
    .storage
    .from("trip-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function deleteImage(id) {
  if (!confirm("Bild wirklich löschen?")) return;

  const { error } = await supabaseClient
    .from("trip_images")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    alert("Bild konnte nicht gelöscht werden.");
    return;
  }

  await loadImages();
}

async function deleteMemory(id) {
  if (!confirm("Erinnerung wirklich löschen?")) return;

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
    alert("Erinnerung konnte nicht gelöscht werden.");
    return;
  }

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

  const today = new Date();
  const memoryDate = new Date(startDate);

  today.setHours(0, 0, 0, 0);
  memoryDate.setHours(0, 0, 0, 0);

  return memoryDate > today;
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("de-DE");
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  if (start && !end) return formatDate(start);
  if (!start && end) return formatDate(end);
  return `${formatDate(start)} - ${formatDate(end)}`;
}

openMemoryModal.addEventListener("click", () => {
  memoryModal.classList.remove("hidden");
});

closeMemoryModal.addEventListener("click", () => {
  memoryModal.classList.add("hidden");
});

createMemoryBtn.addEventListener("click", createMemory);

backToMemories.addEventListener("click", () => {
  currentMemory = null;
  galleryView.classList.add("hidden");
  memoryOverview.classList.remove("hidden");
});

uploadImageBtn.addEventListener("click", uploadImage);

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
    {
      event: "*",
      schema: "public",
      table: "trips"
    },
    () => {
      loadMemories();
    }
  )
  .subscribe();

supabaseClient
  .channel("memory_images_changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "trip_images"
    },
    () => {
      if (currentMemory) {
        loadImages();
      }
    }
  )
  .subscribe();
