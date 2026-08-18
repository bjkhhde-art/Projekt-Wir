const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const shoppingList = document.getElementById("shoppingList");

const openAddItemModal = document.getElementById("openAddItemModal");
const addItemModal = document.getElementById("addItemModal");
const closeAddItemModal = document.getElementById("closeAddItemModal");
const addItemBtn = document.getElementById("addItemBtn");

const itemTitleInput = document.getElementById("itemTitleInput");
const itemQuantityInput = document.getElementById("itemQuantityInput");
const itemCategoryInput = document.getElementById("itemCategoryInput");
const itemAuthorInput = document.getElementById("itemAuthorInput");

let items = [];

async function loadItems() {
  shoppingList.innerHTML = `<div class="skeleton item-skeleton"></div><div class="skeleton item-skeleton"></div><div class="skeleton item-skeleton"></div>`;

  const { data, error } = await supabaseClient
    .from("shopping_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error);
    showToast("Einkaufsliste konnte nicht geladen werden.", "error");
    return;
  }

  items = data;
  renderList();
}

function renderList() {
  shoppingList.innerHTML = "";

  if (items.length === 0) {
    shoppingList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🛒</span>
        <p>Die Liste ist leer.<br>Tippt unten rechts auf + und fügt etwas hinzu.</p>
      </div>
    `;
    return;
  }

  const open = items.filter(item => !item.done);
  const done = items.filter(item => item.done);

  const groups = groupByCategory(open);

  Object.keys(groups).forEach(category => {
    const section = document.createElement("div");
    section.className = "shopping-group";
    section.innerHTML = `<h3 class="shopping-group-title">${category}</h3>`;

    const list = document.createElement("div");
    list.className = "shopping-items";

    groups[category].forEach(item => list.appendChild(renderItem(item)));

    section.appendChild(list);
    shoppingList.appendChild(section);
  });

  if (done.length > 0) {
    const section = document.createElement("div");
    section.className = "shopping-group done-group";
    section.innerHTML = `<h3 class="shopping-group-title">✅ Erledigt (${done.length})</h3>`;

    const list = document.createElement("div");
    list.className = "shopping-items";

    done.forEach(item => list.appendChild(renderItem(item)));

    section.appendChild(list);
    shoppingList.appendChild(section);
  }
}

function groupByCategory(list) {
  const groups = {};

  list.forEach(item => {
    const category = item.category || "Sonstiges 🛒";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  });

  return groups;
}

function renderItem(item) {
  const row = document.createElement("div");
  row.className = "shopping-item card" + (item.done ? " done" : "");

  row.innerHTML = `
    <button class="check-btn" title="Erledigt markieren">${item.done ? "✅" : ""}</button>
    <div class="shopping-item-text">
      <span class="shopping-item-title">${item.title}</span>
      ${item.quantity ? `<span class="shopping-item-qty">${item.quantity}</span>` : ""}
      ${item.added_by ? `<span class="shopping-item-author">von ${item.added_by}</span>` : ""}
    </div>
    <button class="delete-item-btn icon-action" title="Löschen">×</button>
  `;

  row.querySelector(".check-btn").addEventListener("click", () => toggleDone(item));
  row.querySelector(".delete-item-btn").addEventListener("click", () => deleteItem(item.id));

  return row;
}

async function toggleDone(item) {
  const newDone = !item.done;

  const { error } = await supabaseClient
    .from("shopping_items")
    .update({ done: newDone })
    .eq("id", item.id);

  if (error) {
    console.error("Fehler beim Aktualisieren:", error);
    showToast("Konnte nicht aktualisiert werden.", "error");
    return;
  }

  if (newDone) celebrate(6);

  await loadItems();
}

async function addItem() {
  const title = itemTitleInput.value.trim();

  if (!title) {
    showToast("Bitte einen Artikelnamen eingeben.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("shopping_items")
    .insert({
      title,
      quantity: itemQuantityInput.value.trim(),
      category: itemCategoryInput.value,
      added_by: itemAuthorInput.value,
      done: false
    });

  if (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Speichern hat nicht geklappt.", "error");
    return;
  }

  itemTitleInput.value = "";
  itemQuantityInput.value = "";
  itemCategoryInput.value = "Lebensmittel 🥦";
  itemAuthorInput.value = "Isi";

  addItemModal.classList.add("hidden");
  showToast("Artikel hinzugefügt 🛒", "success");
  await loadItems();
}

async function deleteItem(id) {
  const confirmed = await confirmDialog("Der Artikel wird endgültig gelöscht.");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("shopping_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Fehler beim Löschen:", error);
    showToast("Löschen hat nicht geklappt.", "error");
    return;
  }

  showToast("Artikel gelöscht.");
  await loadItems();
}

openAddItemModal.addEventListener("click", () => {
  addItemModal.classList.remove("hidden");
  itemTitleInput.focus();
});

closeAddItemModal.addEventListener("click", () => {
  addItemModal.classList.add("hidden");
});

addItemBtn.addEventListener("click", addItem);

itemTitleInput.addEventListener("keydown", event => {
  if (event.key === "Enter") addItem();
});

loadItems();

supabaseClient
  .channel("shopping_items_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "shopping_items" },
    () => {
      loadItems();
    }
  )
  .subscribe();
