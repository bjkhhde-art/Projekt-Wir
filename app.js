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

const MAX_FIELDS = 16;

let items = [];
let saving = false;
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

  /* normally at most 16 – if both phones added the 16th field at once, the extra one still shows
     (and can be deleted) instead of silently disappearing */
  items = data || [];
  renderBoard();
}

function renderBoard() {
  board.innerHTML = "";

  // Offene Quests zuerst, abgeschlossene danach (Reihenfolge innerhalb bleibt erhalten)
  const sortedItems = [...items].sort((a, b) => Number(!!a.done) - Number(!!b.done));

  for (let i = 0; i < Math.max(MAX_FIELDS, sortedItems.length); i++) {
    const cell = document.createElement("div");
    cell.className = "cell";

    const item = sortedItems[i];

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

      /* an open quest whose day has passed */
      const overdue = Boolean(item.due_date) && !item.done && daysBetween(new Date(), item.due_date) < 0;
      if (overdue) cell.classList.add("overdue");

      const progressIcons = [];

      for (let j = 0; j < item.target; j++) {
        progressIcons.push(j < item.current ? "✅" : "⬜");
      }

      cell.innerHTML = `
        ${item.done ? `<span class="cell-done-badge">✓ Geschafft</span>` : ""}
        ${!deleteMode ? `<button class="cell-edit-btn" title="Bearbeiten">✏️</button>` : ""}
        <div class="category">${escapeHtml(item.category || "Sonstiges ⭐")}</div>
        <div class="author">Von: ${escapeHtml(item.author || "Unbekannt")}</div>
        <div class="due-date${overdue ? " overdue" : ""}">${item.due_date ? (overdue ? "⏰ Überfällig: " : "Fällig: ") + formatDate(item.due_date) : ""}</div>
        <div class="cell-title">${escapeHtml(item.title)}</div>
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
          openQuestEditModal(item);
        });
      }
    } else if (!deleteMode) {
      cell.classList.add("empty");
      cell.innerHTML = `<span class="cell-plus">+</span>`;
      cell.title = "Neues Bingofeld hinzufügen";

      cell.addEventListener("click", () => {
        openAddModalHandler();
      });
    }

    board.appendChild(cell);
  }
}

function openAddModalHandler() {
  editingItemId = null;
  questModalTitle.textContent = "Neues Bingofeld";
  addBtn.textContent = "Hinzufügen";

  input.value = "";
  categoryInput.value = "Liebe ❤️";
  authorInput.value = devicePerson() || "Isi";
  dueDateInput.value = "";
  targetInput.value = "1";

  addModal.classList.remove("hidden");
  input.focus();
}

function openQuestEditModal(item) {
  editingItemId = item.id;
  questModalTitle.textContent = "Feld bearbeiten";
  addBtn.textContent = "Änderungen speichern";

  input.value = item.title || "";
  categoryInput.value = item.category || "Liebe ❤️";
  authorInput.value = item.author || "Isi";
  dueDateInput.value = item.due_date || "";
  /* "0" is no goal any more – such an older quest gets 1 when it is saved */
  targetInput.value = String(Number(item.target) > 0 ? item.target : 1);

  addModal.classList.remove("hidden");
  input.focus();
}

/* one save at a time: a double tap (or Enter plus a tap) must not add the quest twice */
async function saveItem() {
  if (saving) return;
  const title = input.value.trim();

  if (!title) {
    showToast("Bitte einen Titel eingeben.", "error");
    return;
  }

  saving = true;
  addBtn.disabled = true;
  try {
    await writeItem(title);
  } finally {
    saving = false;
    addBtn.disabled = false;
  }
}

/* how many fields the board has right now – asked fresh, the other phone may just have added one */
async function countFields() {
  const { data, error } = await supabaseClient.from("bingo_items").select("id");
  return error ? items.length : (data || []).length;
}

async function writeItem(title) {

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
    if (await countFields() >= MAX_FIELDS) {
      showToast(`Das Bingo ist voll. Es können maximal ${MAX_FIELDS} Felder genutzt werden.`, "error");
      await loadItems();
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

    /* the phone that added it never gets the notification – the other one does */
    const sender = devicePerson() || normalizePerson(authorInput.value);
    sendAppNotification(supabaseClient, {
      title: "Neue Couple Quest 🎯",
      body: `${sender} hat "${title}" hinzugefügt.`,
      excludePerson: sender,
      category: "quest",
      url: "ziele.html?tab=quest"
    });
  }

  addModal.classList.add("hidden");
  await loadItems();
}

let progressInFlight = false;

/* the quest as it is in the database right now (the other phone may have ticked it a moment ago) */
async function freshItem(item) {
  const { data, error } = await supabaseClient.from("bingo_items").select("*").eq("id", item.id).maybeSingle();
  return error || !data ? item : data;
}

async function updateProgress(item) {
  if (progressInFlight) return;

  /* a quest without a goal cannot be ticked – it opens so a goal can be chosen */
  if (!(Number(item.target) > 0)) {
    openQuestEditModal(item);
    return;
  }

  progressInFlight = true;
  try {
    /* each tap counts once, even when both phones tap at the same moment: the step is only written
       if nobody changed the quest in between – otherwise it is counted again on the new value */
    for (let attempt = 0; attempt < 4; attempt++) {
      const base = await freshItem(item);
      const target = Number(base.target);
      const current = Number(base.current) || 0;
      const newCurrent = current < target ? current + 1 : 0;
      const newDone = newCurrent >= target;

      /* tapping a finished quest starts it over – only on purpose, not by an accidental tap */
      if (newCurrent === 0 && !(await confirmDialog(`"${base.title}" wieder auf 0 zurücksetzen?`, "Zurücksetzen"))) {
        return;
      }

      const { data, error } = await supabaseClient
        .from("bingo_items")
        .update({ current: newCurrent, done: newDone })
        .eq("id", base.id)
        .eq("current", current)
        .select();

      if (error) {
        console.error("Fehler beim Aktualisieren:", error);
        showToast("Aktualisieren hat nicht geklappt.", "error");
        return;
      }

      if (data && data.length > 0) {
        if (newDone && !base.done) {
          celebrate(16);
          showToast(`"${base.title}" geschafft! 🎉`, "success");
        }
        return;
      }
    }
    showToast("Das hat gerade nicht geklappt – tipp nochmal.", "error");
  } finally {
    progressInFlight = false;
    await loadItems();
  }
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
