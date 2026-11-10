/* Mochi, part 4 of 6: the shop and the achievements list. */

/* ---------- shop ---------- */

function renderShopList(container, items) {
  container.innerHTML = "";
  const owned = (petState && petState.owned_items) || [];
  const coins = (petState && petState.coins) || 0;
  const placedDeco = (petState && petState.room_decor) || [];

  items.forEach(item => {
    const isOwned = owned.includes(item.id);
    const isDeco = item.slot === "deco";
    const isEquipped = isDeco
      ? placedDeco.includes(item.id)
      : petState && petState[SLOT_TO_FIELD[item.slot]] === item.id;

    let btnHtml;
    if (isEquipped) {
      const label = isDeco ? "Abräumen" : "Ausgerüstet";
      btnHtml = `<button class="shop-item-btn equipped" data-action="unequip" data-slot="${item.slot}" data-id="${item.id}">${label}</button>`;
    } else if (isOwned) {
      const label = isDeco ? "Aufstellen" : "Ausrüsten";
      btnHtml = `<button class="shop-item-btn equip" data-action="equip" data-slot="${item.slot}" data-id="${item.id}">${label}</button>`;
    } else if (coins >= item.price) {
      btnHtml = `<button class="shop-item-btn buy" data-action="buy" data-slot="${item.slot}" data-id="${item.id}" data-price="${item.price}">Kaufen</button>`;
    } else {
      btnHtml = `<button class="shop-item-btn locked" disabled>🪙 ${item.price}</button>`;
    }

    const row = document.createElement("div");
    row.className = "shop-item";
    row.innerHTML = `
      <span class="shop-item-icon">${item.icon}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-price">🪙 ${item.price}${isOwned ? " · besitzt du schon" : ""}</div>
      </div>
      ${btnHtml}
    `;
    container.appendChild(row);
  });
}

function renderShop() {
  shopCoinCount.textContent = (petState && petState.coins) || 0;
  renderShopList(shopItemsRoom, SHOP_ITEMS.room);
  renderShopList(shopItemsOutfit, SHOP_ITEMS.outfit);
}

async function handleShopClick(event) {
  const btn = event.target.closest(".shop-item-btn");
  if (!btn || btn.disabled) return;
  if (!requirePerson()) return;

  const action = btn.dataset.action;
  const slot = btn.dataset.slot;
  const id = btn.dataset.id;
  const price = Number(btn.dataset.price);
  const item = findShopItem(id);
  const itemName = item ? item.name : "Artikel";
  const isDeco = slot === "deco";
  const field = SLOT_TO_FIELD[slot];
  let message = null;

  const result = await mutatePet(base => {
    const owned = base.owned_items || [];
    const placed = base.room_decor || [];
    message = null;

    if (action === "buy") {
      if ((base.coins || 0) < price || owned.includes(id)) return null;
      const patch = { coins: base.coins - price, owned_items: [...owned, id] };
      if (isDeco) {
        const roomHasSpace = placed.length < MAX_DECOR;
        patch.room_decor = roomHasSpace ? [...placed, id] : placed;
        message = roomHasSpace ? `${itemName} gekauft und aufgestellt 🎉` : `${itemName} gekauft. Zimmer ist voll, räum zuerst etwas ab 📦`;
      } else {
        patch[field] = id;
        message = `${itemName} gekauft und ausgerüstet 🎉`;
      }
      return patch;
    }

    if (action === "equip") {
      if (!isDeco) return { [field]: id };
      if (placed.includes(id)) return null;
      if (placed.length >= MAX_DECOR) {
        message = "Zimmer ist schon voll, räum zuerst etwas ab 📦";
        return null;
      }
      return { room_decor: [...placed, id] };
    }

    if (action === "unequip") {
      return isDeco ? { room_decor: placed.filter(existing => existing !== id) } : { [field]: null };
    }
    return null;
  });

  renderShop();
  if (message) showToast(message, "success");
  if (result && action === "buy") {
    vibrate([10, 20, 10]);
    announceNewAchievements(result.previous, result.next);
  }
}

shopItemsRoom.addEventListener("click", handleShopClick);
shopItemsOutfit.addEventListener("click", handleShopClick);

shopTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    shopTabs.forEach(t => t.classList.toggle("active", t === tab));
    shopItemsRoom.classList.toggle("hidden", tab.dataset.tab !== "room");
    shopItemsOutfit.classList.toggle("hidden", tab.dataset.tab !== "outfit");
  });
});

function openShop() {
  renderShop();
  shopModal.classList.remove("hidden");
}

openShopBtn.addEventListener("click", openShop);
openShopFromRoom.addEventListener("click", openShop);
closeShopModal.addEventListener("click", () => shopModal.classList.add("hidden"));

/* ---------- achievements modal ---------- */

function renderAchievements() {
  achievementsList.innerHTML = "";
  const state = petState || {};

  ACHIEVEMENTS.forEach(achievement => {
    const unlocked = achievement.check(state);
    const card = document.createElement("div");
    card.className = "achievement-card " + (unlocked ? "unlocked" : "locked");
    card.innerHTML = `
      <span class="achievement-icon">${unlocked ? achievement.icon : "🔒"}</span>
      <div class="achievement-info">
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.desc}</div>
      </div>
    `;
    achievementsList.appendChild(card);
  });
}

openAchievementsBtn.addEventListener("click", () => {
  renderAchievements();
  achievementsModal.classList.remove("hidden");
});

closeAchievementsModal.addEventListener("click", () => achievementsModal.classList.add("hidden"));
