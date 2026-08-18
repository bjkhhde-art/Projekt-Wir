const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const board = document.getElementById("board");
const input = document.getElementById("newItemInput");
const categoryInput = document.getElementById("categoryInput");
const authorInput = document.getElementById("authorInput");
const dueDateInput = document.getElementById("dueDateInput");
const targetInput = document.getElementById("targetInput");
const questModalTitle = document.getElementById("questModalTitle");

const addBtn = document.getElementById("addBtn");
const openAddModal = document.getElementById("openAddModal");
const closeModal = document.getElementById("closeModal");
const addModal = document.getElementById("addModal");

const openDeleteMode = document.getElementById("openDeleteMode");
const deleteBar = document.getElementById("deleteBar");
const confirmDelete = document.getElementById("confirmDelete");
const cancelDelete = document.getElementById("cancelDelete");

let items = [];
let deleteMode = false;
let selectedForDelete = [];
let editingItemId = null;

async function loadItems() {
  const { data, error } = await supabaseClient
    .from("bingo_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error);
    showToast("Daten konnten nicht geladen werden.", "error");
    return;
  }

  items = data.slice(0, 16);
  renderBoard();
}

function renderBoard() {
  board.innerHTML = "";

  for (let i = 0; i < 16; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";

    const item = items[i];

    if (deleteMode && item) {
      cell.classList.add("delete-mode");
    }

    if (selectedForDelete.includes(item?.id)) {
      cell.classList.add("selected-delete");
    }

    if (item) {
      if (item.done) {
        cell.classList.add("done");
      }

      const progressIcons = [];

      for (let j = 0; j < item.target; j++) {
        progressIcons.push(j < item.current ? "✅" : "⬜");
      }

      cell.innerHTML = `
        ${!deleteMode ? `<button class="cell-edit-btn" title="Bearbeiten">✏️</button>` : ""}
        <div class="category">${item.category || "Sonstiges ⭐"}</div>
        <div class="author">Von: ${item.author || "Unbekannt"}</div>
        <div class="due-date">${item.due_date ? "Fällig: " + formatDate(item.due_date) : ""}</div>
        <div class="cell-title">${item.title}</div>
        <div class="progress">${progressIcons.join(" ")}</div>
      `;

      cell.addEventListener("click", async () => {
        if (deleteMode) {
          toggleDeleteSelection(item.id);
          return;
        }

        await updateProgress(item);
      });

      const editBtn = cell.querySelector(".cell-edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", event => {
          event.stopPropagation();
          openEditModal(item);
        });
      }
    }

    board.appendChild(cell);
  }
}

function openAddModalHandler() {
  editingItemId = null;
  questModalTitle.textContent = "Neues Bingo-Feld";
  addBtn.textContent = "Hinzufügen";

  input.value = "";
  categoryInput.value = "Liebe ❤️";
  authorInput.value = "Isi";
  dueDateInput.value = "";
  targetInput.value = "1";

  addModal.classList.remove("hidden");
  input.focus();
}

function openEditModal(item) {
  editingItemId = item.id;
  questModalTitle.textContent = "Feld bearbeiten";
  addBtn.textContent = "Änderungen speichern";

  input.value = item.title || "";
  categoryInput.value = item.category || "Liebe ❤️";
  authorInput.value = item.author || "Isi";
  dueDateInput.value = item.due_date || "";
  targetInput.value = String(item.target ?? 1);

  addModal.classList.remove("hidden");
  input.focus();
}

async function saveItem() {
  const title = input.value.trim();

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  if (editingItemId) {
    const item = items.find(existing => existing.id === editingItemId);
    const target = Number(targetInput.value);
    let current = item ? item.current : 0;

    if (current > target) current = target;

    const { error } = await supabaseClient
      .from("bingo_items")
      .update({
        title,
        category: categoryInput.value,
        author: authorInput.value,
        due_date: dueDateInput.value || null,
        target,
        current,
        done: target > 0 && current >= target
      })
      .eq("id", editingItemId);

    if (error) {
      console.error("Fehler beim Speichern:", error);
      showToast("Speichern hat nicht geklappt.", "error");
      return;
    }

    showToast("Feld aktualisiert 💗", "success");
  } else {
    if (items.length >= 16) {
      showToast("Das Bingo ist voll. Es können maximal 16 Felder genutzt werden.", "error");
      return;
    }

    const { error } = await supabaseClient
      .from("bingo_items")
      .insert({
        title,
        category: categoryInput.value,
        author: authorInput.value,
        due_date: dueDateInput.value || null,
        target: Number(targetInput.value),
        current: 0,
        done: false
      });

    if (error) {
      console.error("Fehler beim Speichern:", error);
      showToast("Speichern hat nicht geklappt.", "error");
      return;
    }

    showToast("Neues Feld hinzugefügt ✨", "success");
  }

  addModal.classList.add("hidden");
  await loadItems();
}

async function updateProgress(item) {
  const target = Number(item.target);

  if (target === 0) {
    return;
  }

  const newCurrent = item.current < target ? item.current + 1 : 0;
  const newDone = newCurrent >= target;

  const { error } = await supabaseClient
    .from("bingo_items")
    .update({
      current: newCurrent,
      done: newDone
    })
    .eq("id", item.id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    showToast("Aktualisieren hat nicht geklappt.", "error");
    return;
  }

  if (newDone && !item.done) {
    celebrate(16);
    showToast(`"${item.title}" geschafft! 🎉`, "success");
  }

  await loadItems();
}

function startDeleteMode() {
  deleteMode = true;
  selectedForDelete = [];
  deleteBar.classList.remove("hidden");
  renderBoard();
}

function cancelDeleteMode() {
  deleteMode = false;
  selectedForDelete = [];
  deleteBar.classList.add("hidden");
  renderBoard();
}

function toggleDeleteSelection(id) {
  if (selectedForDelete.includes(id)) {
    selectedForDelete = selectedForDelete.filter(itemId => itemId !== id);
  } else {
    selectedForDelete.push(id);
  }

  renderBoard();
}

async function deleteSelectedItems() {
  if (selectedForDelete.length === 0) {
    showToast("Bitte erst mindestens ein Feld auswählen.", "error");
    return;
  }

  const confirmed = await confirmDialog(`${selectedForDelete.length} Feld(er) werden endgültig gelöscht.`);
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("bingo_items")
    .delete()
    .in("id", selectedForDelete);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Löschen hat nicht geklappt.", "error");
    return;
  }

  showToast("Felder gelöscht.");

  deleteMode = false;
  selectedForDelete = [];
  deleteBar.classList.add("hidden");

  await loadItems();
}

openAddModal.addEventListener("click", openAddModalHandler);

closeModal.addEventListener("click", () => {
  addModal.classList.add("hidden");
});

addBtn.addEventListener("click", saveItem);

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    saveItem();
  }
});

openDeleteMode.addEventListener("click", startDeleteMode);
cancelDelete.addEventListener("click", cancelDeleteMode);
confirmDelete.addEventListener("click", deleteSelectedItems);

loadItems();

supabaseClient
  .channel("bingo_items_changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "bingo_items"
    },
    () => {
      loadItems();
    }
  )
  .subscribe();
