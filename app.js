const board = document.getElementById("board");
const input = document.getElementById("newItemInput");
const addBtn = document.getElementById("addBtn");

let items = JSON.parse(localStorage.getItem("bingoItems")) || [];

function saveItems() {
  localStorage.setItem("bingoItems", JSON.stringify(items));
}

function renderBoard() {
  board.innerHTML = "";

  items.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    if (item.done) {
      cell.classList.add("done");
    }

    cell.innerHTML = `
      <button class="delete-btn">×</button>
      <div>${item.title}</div>
    `;

    cell.addEventListener("click", () => {
      items[index].done = !items[index].done;
      saveItems();
      renderBoard();
    });

    cell.querySelector(".delete-btn").addEventListener("click", (event) => {
      event.stopPropagation();

      if (confirm("Eintrag wirklich löschen?")) {
        items.splice(index, 1);
        saveItems();
        renderBoard();
      }
    });

    board.appendChild(cell);
  });
}

function addItem() {
  const title = input.value.trim();

  if (title === "") return;

  items.push({
    title: title,
    done: false
  });

  input.value = "";
  saveItems();
  renderBoard();
}

addBtn.addEventListener("click", addItem);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addItem();
  }
});

renderBoard();
