const board = document.getElementById("board");

fetch("bingo.json")
  .then(response => response.json())
  .then(items => {
    items.forEach((item, index) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = item.title;

      const saved = localStorage.getItem("bingo-" + index);
      if (saved === "true") {
        cell.classList.add("done");
      }

      cell.addEventListener("click", () => {
        cell.classList.toggle("done");
        localStorage.setItem(
          "bingo-" + index,
          cell.classList.contains("done")
        );
      });

      board.appendChild(cell);
    });
  });
