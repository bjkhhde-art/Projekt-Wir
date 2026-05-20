const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const board = document.getElementById("board");
const input = document.getElementById("newItemInput");
const categoryInput = document.getElementById("categoryInput");
const authorInput = document.getElementById("authorInput");
const targetInput = document.getElementById("targetInput");

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

async function loadItems() {
  const { data, error } = await supabaseClient
    .from("bingo_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error);
    alert("Daten konnten nicht geladen werden.");
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
        <div class="category">${item.category || "Sonstiges ⭐"}</div>
        <div class="author">Von: ${item.author || "Unbekannt"}</div>
        <div>${item.title}</div>
        <div class="progress">${progressIcons.join(" ")}</div>
      `;

      cell.addEventListener("click", async () => {
        if (deleteMode) {
          toggleDeleteSelection(item.id);
          return;
        }

        await updateProgress(item);
      });
    }

    board.appendChild(cell);
  }
}

async function addItem() {
  const title = input.value.trim();

  if (!title) return;

  if (items.length >= 16) {
    alert("Das Bingo ist voll. Es können maximal 16 Felder genutzt werden.");
    return;
  }

  const { error } = await supabaseClient
    .from("bingo_items")
    .insert({
      title: title,
      category: categoryInput.value,
      author: authorInput.value,
      target: Number(targetInput.value),
      current: 0,
      done: false
    });

  if (error) {
    console.error("Fehler beim Speichern:", error);
    alert("Speichern hat nicht geklappt.");
    return;
  }

  input.value = "";
  categoryInput.value = "Liebe ❤️";
  authorInput.value = "Isi";
  targetInput.value = "1";
  addModal.classList.add("hidden");

  await loadItems();
}

async function updateProgress(item) {
  const newCurrent = item.current < item.target ? item.current + 1 : 0;
  const newDone = newCurrent >= item.target;

  const { error } = await supabaseClient
    .from("bingo_items")
    .update({
      current: newCurrent,
      done: newDone
    })
    .eq("id", item.id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    alert("Aktualisieren hat nicht geklappt.");
    return;
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
    alert("Bitte erst mindestens ein Feld auswählen.");
    return;
  }

  if (!confirm("Ausgewählte Einträge wirklich löschen?")) {
    return;
  }

  const { error } = await supabaseClient
    .from("bingo_items")
    .delete()
    .in("id", selectedForDelete);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    alert("Löschen hat nicht geklappt.");
    return;
  }

  deleteMode = false;
  selectedForDelete = [];
  deleteBar.classList.add("hidden");

  await loadItems();
}

openAddModal.addEventListener("click", () => {
  addModal.classList.remove("hidden");
  input.focus();
});

closeModal.addEventListener("click", () => {
  addModal.classList.add("hidden");
});

addBtn.addEventListener("click", addItem);

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    addItem();
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
