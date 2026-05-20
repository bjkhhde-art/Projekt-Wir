const board = document.getElementById("board");

let items = [];

async function loadCSV() {
  try {
    const response = await fetch("bingo.csv?v=" + Date.now());
    const text = await response.text();

    const lines = text.trim().split("\n").slice(1);

    items = lines.map(line => {
      const values = parseCSVLine(line);

      return {
        title: values[0],
        category: values[1],
        author: values[2],
        target: Number(values[3]),
        current: Number(values[4]),
        done: values[5].trim() === "true"
      };
    });

    items = items.slice(0, 16);
    renderBoard();

  } catch (error) {
    board.innerHTML = "<p>CSV konnte nicht geladen werden.</p>";
    console.error(error);
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

loadCSV();
