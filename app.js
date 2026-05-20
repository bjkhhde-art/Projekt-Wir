const board = document.getElementById("board");
const input = document.getElementById("newItemInput");
const categoryInput = document.getElementById("categoryInput");
const targetInput = document.getElementById("targetInput");

const addBtn = document.getElementById("addBtn");
const openAddModal = document.getElementById("openAddModal");
const closeModal = document.getElementById("closeModal");
const addModal = document.getElementById("addModal");

let items = JSON.parse(localStorage.getItem("bingoItems")) || [];

items = items.slice(0, 16);
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

    if (item) {
      if (item.done) {
        cell.classList.add("done");
      }

      const progressIcons = [];

      for (let j = 0; j < item.target; j++) {
        progressIcons.push(j < item.current ? "✅" : "⬜");
      }

      cell.innerHTML = `
        <button class="delete-field hidden-delete">🗑️</button>
        <div class="category">${item.category}</div>
        <div>${item.title}</div>
        <div class="progress">${progressIcons.join(" ")}</div>
      `;

      let pressTimer;

      cell.addEventListener("mousedown", () => {
        pressTimer = setTimeout(() => {
          cell.querySelector(".delete-field").classList.remove("hidden-delete");
        }, 700);
      });

      cell.addEventListener("mouseup", () => {
        clearTimeout(pressTimer);
      });

      cell.addEventListener("mouseleave", () => {
        clearTimeout(pressTimer);
      });

      cell.addEventListener("touchstart", () => {
        pressTimer = setTimeout(() => {
          cell.querySelector(".delete-field").classList.remove("hidden-delete");
        }, 700);
      });

      cell.addEventListener("touchend", () => {
        clearTimeout(pressTimer);
      });

      cell.querySelector(".delete-field").addEventListener("click", (event) => {
        event.stopPropagation();

        if (confirm("Eintrag wirklich löschen?")) {
          items.splice(i, 1);
          saveItems();
          renderBoard();
        }
      });

      cell.addEventListener("click", (event) => {
        if (event.target.classList.contains("delete-field")) return;

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
    target: Number(targetInput.value),
    current: 0,
    done: false
  });

  saveItems();

  input.value = "";
  categoryInput.value = "Liebe ❤️";
  targetInput.value = "1";

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
  if (event.key === "Enter") {
    addItem();
  }
});

renderBoard();
