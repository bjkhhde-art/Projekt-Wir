const board = document.getElementById("board");
const input = document.getElementById("newItemInput");
const addBtn = document.getElementById("addBtn");
const openAddModal = document.getElementById("openAddModal");
const closeModal = document.getElementById("closeModal");
const addModal = document.getElementById("addModal");

let items = JSON.parse(localStorage.getItem("bingoItems")) || [];

function saveItems() {
  localStorage.setItem("bingoItems", JSON.stringify(items));
}

function renderBoard() {
  board.innerHTML = "";

  items.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = item.title;

    if (item.done) cell.classList.add("done");

    cell.addEventListener("click", () => {
      items[index].done = !items[index].done;
      saveItems();
      renderBoard();
    });

    board.appendChild(cell);
  });
}

function addItem() {
  const title = input.value.trim();
  if (!title) return;

  items.push({ title, done: false });
  saveItems();

  input.value = "";
  addModal.classList.add("hidden");
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
  if (event.key === "Enter") addItem();
});

renderBoard();
