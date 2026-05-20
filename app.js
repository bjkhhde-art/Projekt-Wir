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

let items = JSON.parse(localStorage.getItem("bingoItems")) || [];
items = items.slice(0, 16);

let deleteMode = false;
let selectedForDelete = [];

saveItems();

function saveItems() {
  localStorage.setItem("bingoItems", JSON.stringify(items));
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

    if (selectedForDelete.includes(i)) {
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

      cell.addEventListener("click", () => {
        if (deleteMode) {
          if (selectedForDelete.includes(i)) {
            selectedForDelete = selectedForDelete.filter(index => index !== i);
          } else {
            selectedForDelete.push(i);
          }

          renderBoard();
          return;
        }

        if (item.current < item.target) {
          item.current++;
        } else {
          item.current = 0;
        }

        item.done = item.current >= item.target;

        saveItems();
        renderBoard();
      });
    }

    board.appendChild(cell);
  }
}

function addItem() {
  const title = input.value.trim();

  if (!title) return;

  if (items.length >= 16) {
    alert("Das Bingo ist voll. Es können maximal 16 Felder genutzt werden.");
    return;
  }

  items.push({
    title: title,
    category: categoryInput.value,
    author: authorInput.value,
    target: Number(targetInput.value),
    current: 0,
    done: false
  });

  saveItems();

  input.value = "";
  categoryInput.value = "Liebe ❤️";
  authorInput.value = "Isi";
  targetInput.value = "1";

  addModal.classList.add("hidden");
  renderBoard();
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

function deleteSelectedItems() {
  if (selectedForDelete.length === 0) {
    alert("Bitte erst mindestens ein Feld auswählen.");
    return;
  }

  if (!confirm("Ausgewählte Einträge wirklich löschen?")) {
    return;
  }

  items = items.filter((item, index) => !selectedForDelete.includes(index));

  deleteMode = false;
  selectedForDelete = [];
  deleteBar.classList.add("hidden");

  saveItems();
  renderBoard();
}

openAddModal.addEventListener("click", () => {
  addModal.classList.remove("hidden");
  input.focus();
});

closeModal.addEventListener("click", () => {
  addModal.classList.add("hidden");
});

addBtn.addEventListener("click", addItem);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addItem();
  }
});

openDeleteMode.addEventListener("click", startDeleteMode);
cancelDelete.addEventListener("click", cancelDeleteMode);
confirmDelete.addEventListener("click", deleteSelectedItems);

renderBoard();
