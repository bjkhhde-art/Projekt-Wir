const board = document.getElementById("board");

const input = document.getElementById("newItemInput");
const categoryInput = document.getElementById("categoryInput");
const authorInput = document.getElementById("authorInput");
const targetInput = document.getElementById("targetInput");

const openAddModal = document.getElementById("openAddModal");
const addModal = document.getElementById("addModal");
const addBtn = document.getElementById("addBtn");
const closeModal = document.getElementById("closeModal");

let items = [];

async function loadCSV() {
  try {
    const response = await fetch("bingo.csv?v=" + Date.now());
    const text = await response.text();

    const lines = text.trim().split("\n").slice(1).filter(line => line.trim() !== "");

    items = lines.map(line => {
      const values = parseCSVLine(line);

      return {
        title: values[0],
        category: values[1],
        author: values[2],
        target: Number(values[3]),
        current: Number(values[4]),
        done: values[5]?.trim() === "true"
      };
    });

    items = items.slice(0, 16);
    renderBoard();

  } catch (error) {
    items = [];
    renderBoard();
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
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
        <div class="category">${item.category}</div>
        <div class="author">Von: ${item.author}</div>
        <div>${item.title}</div>
        <div class="progress">${progressIcons.join(" ")}</div>
      `;
    }

    board.appendChild(cell);
  }
}

function addItem() {
  const title = input.value.trim();

  if (!title) return;

  if (items.length >= 16) {
    alert("Das Bingo ist voll.");
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

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    addItem();
  }
});

loadCSV();
