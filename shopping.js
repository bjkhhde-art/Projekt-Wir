const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const itemInput = document.getElementById("itemInput");
const categoryInput = document.getElementById("categoryInput");
const addedByInput = document.getElementById("addedByInput");
const addBtn = document.getElementById("addBtn");
const shoppingList = document.getElementById("shoppingList");
const deleteDoneBtn = document.getElementById("deleteDoneBtn");

let items = [];

async function loadItems() {
  const { data, error } = await supabaseClient
    .from("shopping_items")
    .select("*")
    .order("done", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error);
    alert("Einkaufsliste konnte nicht geladen werden.");
    return;
  }

  items = data;
  renderItems();
}

function renderItems() {
  shoppingList.innerHTML = "";

  if (items.length === 0) {
    shoppingList.innerHTML = `<p>Noch nichts auf der Liste 🛒</p>`;
    return;
  }

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "shopping-item";

    if (item.done) {
      div.classList.add("done");
    }

    div.innerHTML = `
      <button class="check-btn">${item.done ? "✓" : ""}</button>

      <div>
        <div class="title">${item.title}</div>
        <div class="meta">${item.category || "Sonstiges"} · von ${item.added_by || "Unbekannt"}</div>
      </div>

      <button class="delete-btn">×</button>
    `;

    div.querySelector(".check-btn").addEventListener("click", () => {
      toggleDone(item);
    });

    div.querySelector(".delete-btn").addEventListener("click", () => {
      deleteItem(item.id);
    });

    shoppingList.appendChild(div);
  });
}

async function addItem() {
  const title = itemInput.value.trim();

  if (!title) return;

  const { error } = await supabaseClient
    .from("shopping_items")
    .insert({
      title: title,
      category: categoryInput.value,
      added_by: addedByInput.value,
      done: false
    });

  if (error) {
    console.error("Fehler beim Speichern:", error);
    alert("Speichern hat nicht geklappt.");
    return;
  }

  itemInput.value = "";
  await loadItems();
}

async function toggleDone(item) {
  const { error } = await supabaseClient
    .from("shopping_items")
    .update({
      done: !item.done
    })
    .eq("id", item.id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    alert("Aktualisieren hat nicht geklappt.");
    return;
  }

  await loadItems();
}

async function deleteItem(id) {
  const { error } = await supabaseClient
    .from("shopping_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    alert("Löschen hat nicht geklappt.");
    return;
  }

  await loadItems();
}

async function deleteDoneItems() {
  if (!confirm("Alle erledigten Einträge löschen?")) return;

  const { error } = await supabaseClient
    .from("shopping_items")
    .delete()
    .eq("done", true);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    alert("Löschen hat nicht geklappt.");
    return;
  }

  await loadItems();
}

addBtn.addEventListener("click", addItem);

itemInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    addItem();
  }
});

deleteDoneBtn.addEventListener("click", deleteDoneItems);

loadItems();

supabaseClient
  .channel("shopping_items_changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "shopping_items"
    },
    () => {
      loadItems();
    }
  )
  .subscribe();
