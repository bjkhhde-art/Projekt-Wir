/* Mochi, part 3 of 6: the coffee mini-game, the room, the garden and the star rain mini-game. */

/* ---------- coffee mini-game ---------- */

function svgToScreen(svgX, svgY) {
  const rect = coffeeSvg.getBoundingClientRect();
  return {
    x: rect.left + (svgX / 320) * rect.width,
    y: rect.top + (svgY / 200) * rect.height
  };
}

function attachDragGesture(el, minDistance, isActive, onComplete) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let maxDist = 0;

  el.addEventListener("pointerdown", event => {
    if (!isActive()) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    maxDist = 0;
  });

  el.addEventListener("pointermove", event => {
    if (!dragging || !isActive()) return;
    maxDist = Math.max(maxDist, Math.hypot(event.clientX - startX, event.clientY - startY));
  });

  function end() {
    if (dragging && isActive() && maxDist >= minDistance) onComplete();
    dragging = false;
  }

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => { dragging = false; });
}

function attachRotateGesture(el, pivotSvgX, pivotSvgY, degreesNeeded, isActive, onProgress, onComplete) {
  let dragging = false;
  let lastAngle = 0;
  let accumulated = 0;

  el.addEventListener("pointerdown", event => {
    if (!isActive()) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    accumulated = 0;
    const pivot = svgToScreen(pivotSvgX, pivotSvgY);
    lastAngle = Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x);
  });

  el.addEventListener("pointermove", event => {
    if (!dragging || !isActive()) return;
    const pivot = svgToScreen(pivotSvgX, pivotSvgY);
    const angle = Math.atan2(event.clientY - pivot.y, event.clientX - pivot.x);
    let delta = angle - lastAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    accumulated += Math.abs(delta) * (180 / Math.PI);
    lastAngle = angle;

    onProgress(Math.min(accumulated, degreesNeeded), degreesNeeded);

    if (accumulated >= degreesNeeded) {
      dragging = false;
      onComplete();
    }
  });

  function end() { dragging = false; }
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function attachPressGesture(el, minDownDistance, requiredTaps, isActive, onTap, onComplete) {
  let dragging = false;
  let startY = 0;
  let taps = 0;

  el.addEventListener("pointerdown", event => {
    if (!isActive()) return;
    el.setPointerCapture(event.pointerId);
    dragging = true;
    startY = event.clientY;
  });

  function end(event) {
    if (dragging && isActive()) {
      const dy = event.clientY - startY;
      if (dy >= minDownDistance) {
        taps++;
        onTap(taps, requiredTaps);
        if (taps >= requiredTaps) {
          taps = 0;
          onComplete();
        }
      }
    }
    dragging = false;
  }

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => { dragging = false; });
}

function updateCoffeeUI() {
  const info = COFFEE_STEPS[Math.min(coffeeStep, COFFEE_STEPS.length - 1)];
  coffeeStepLabel.textContent = info.label;
  coffeeHint.textContent = coffeeStep === 4 && lockPhase === "twist"
    ? "Jetzt drehen, um den Siebträger zu verriegeln"
    : info.hint;

  document.querySelectorAll(".coffee-hotspot").forEach(el => {
    const step = Number(el.dataset.step);
    el.classList.toggle("active-step", step === coffeeStep);
    el.classList.toggle("step-done", step < coffeeStep);
  });
}

function resetCoffeeGame() {
  coffeeStep = 0;
  lockPhase = "dock";
  hopperBeans.classList.add("hidden");
  groundPileAtGrinder.classList.add("hidden");
  groundPileAtPortafilter.classList.add("hidden");
  steamGroup.classList.add("hidden");
  coffeeLiquid.setAttribute("height", "0");
  coffeeLiquid.setAttribute("y", "178");
  portafilterGroup.style.transform = "";
  grinderCrankRotor.style.transform = "";
  mochiCoffeeIcon.classList.remove("cheering");
  updateCoffeeUI();
}

function enterCoffeeScene() {
  resetCoffeeGame();
  petMainView.classList.add("leaving");

  setTimeout(() => {
    petMainView.classList.add("hidden");
    petMainView.classList.remove("leaving");
    coffeeScene.classList.remove("hidden");
    coffeeScene.classList.add("entering");
    void coffeeScene.offsetWidth;
    coffeeScene.classList.remove("entering");
  }, 350);
}

function exitCoffeeScene() {
  coffeeScene.classList.add("entering");

  setTimeout(() => {
    coffeeScene.classList.add("hidden");
    coffeeScene.classList.remove("entering");
    petMainView.classList.add("leaving");
    petMainView.classList.remove("hidden");
    void petMainView.offsetWidth;
    petMainView.classList.remove("leaving");
  }, 350);
}

async function completeCoffee() {
  vibrate([15, 30, 15, 30, 40]);
  steamGroup.classList.remove("hidden");
  coffeeLiquid.setAttribute("y", "160");
  coffeeLiquid.setAttribute("height", "18");
  mochiCoffeeIcon.classList.add("cheering");

  showToast("Kaffee ist fertig ☕ Wohl bekomm's!", "success");

  await applyCare({ bond: 20 }, 8, 3, () => ({ last_activity: "coffee" }), { type: "coffee" });

  setTimeout(() => exitCoffeeScene(), 2400);
}

attachDragGesture(beanJarGroup, 45, () => coffeeStep === 0, () => {
  beanJarGroup.classList.add("pouring");
  setTimeout(() => beanJarGroup.classList.remove("pouring"), 400);
  hopperBeans.classList.remove("hidden");
  vibrate([10, 15, 10]);
  coffeeStep = 1;
  updateCoffeeUI();
});

attachRotateGesture(
  grinderCrankGroup, 132, 140, GRIND_DEGREES_NEEDED,
  () => coffeeStep === 1,
  accumulated => {
    grinderCrankRotor.style.transform = `rotate(${accumulated}deg)`;
    coffeeHint.textContent = `Wir drehen die Kurbel (${Math.round((accumulated / GRIND_DEGREES_NEEDED) * 100)}%)`;
  },
  () => {
    hopperBeans.classList.add("hidden");
    groundPileAtGrinder.classList.remove("hidden");
    vibrate([10, 10, 10, 10, 10]);
    coffeeStep = 2;
    updateCoffeeUI();
  }
);

attachDragGesture(groundPileAtGrinder, 45, () => coffeeStep === 2, () => {
  groundPileAtGrinder.classList.add("pouring");
  setTimeout(() => groundPileAtGrinder.classList.remove("pouring"), 400);
  groundPileAtGrinder.classList.add("hidden");
  groundPileAtPortafilter.classList.remove("hidden");
  vibrate([10, 15, 10]);
  coffeeStep = 3;
  updateCoffeeUI();
});

attachPressGesture(
  tamperGroup, 12, TAMP_REQUIRED,
  () => coffeeStep === 3,
  (taps, required) => {
    tamperGroup.classList.remove("tamping");
    void tamperGroup.offsetWidth;
    tamperGroup.classList.add("tamping");
    vibrate([20]);
    coffeeHint.textContent = `Wir drücken fest an (${taps}/${required})`;
  },
  () => {
    coffeeStep = 4;
    lockPhase = "dock";
    updateCoffeeUI();
  }
);

attachDragGesture(portafilterGroup, DOCK_DISTANCE, () => coffeeStep === 4 && lockPhase === "dock", () => {
  portafilterGroup.style.transform = "translateX(60px)";
  lockPhase = "twist";
  vibrate([10, 20]);
  updateCoffeeUI();
});

attachRotateGesture(
  portafilterGroup, 245, 172, TWIST_DEGREES_NEEDED,
  () => coffeeStep === 4 && lockPhase === "twist",
  accumulated => {
    const visualAngle = Math.min(accumulated / TWIST_DEGREES_NEEDED, 1) * 35;
    portafilterGroup.style.transform = `translateX(60px) rotate(${visualAngle}deg)`;
    coffeeHint.textContent = `Jetzt drehen, um den Siebträger zu verriegeln (${Math.round((accumulated / TWIST_DEGREES_NEEDED) * 100)}%)`;
  },
  () => {
    portafilterGroup.style.transform = "translateX(60px) rotate(35deg)";
    completeCoffee();
  }
);

coffeeBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  enterCoffeeScene();
});

leaveCoffeeScene.addEventListener("click", exitCoffeeScene);

/* ---------- room scene ---------- */

function enterRoomScene() {
  petMainView.classList.add("leaving");

  setTimeout(() => {
    petMainView.classList.add("hidden");
    petMainView.classList.remove("leaving");
    roomScene.classList.remove("hidden");
    roomScene.classList.add("entering");
    void roomScene.offsetWidth;
    roomScene.classList.remove("entering");
  }, 350);
}

function exitRoomScene() {
  roomScene.classList.add("entering");

  setTimeout(() => {
    roomScene.classList.add("hidden");
    roomScene.classList.remove("entering");
    petMainView.classList.add("leaving");
    petMainView.classList.remove("hidden");
    void petMainView.offsetWidth;
    petMainView.classList.remove("leaving");
  }, 350);
}

openRoomBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked || isAsleep()) return;
  enterRoomScene();
});

leaveRoomScene.addEventListener("click", exitRoomScene);

/* ---------- scenes (garden, star rain) ---------- */

function enterScene(scene) {
  petMainView.classList.add("leaving");

  setTimeout(() => {
    petMainView.classList.add("hidden");
    petMainView.classList.remove("leaving");
    scene.classList.remove("hidden");
    scene.classList.add("entering");
    void scene.offsetWidth;
    scene.classList.remove("entering");
  }, 350);
}

function exitScene(scene) {
  scene.classList.add("entering");

  setTimeout(() => {
    scene.classList.add("hidden");
    scene.classList.remove("entering");
    petMainView.classList.add("leaving");
    petMainView.classList.remove("hidden");
    void petMainView.offsetWidth;
    petMainView.classList.remove("leaving");
  }, 350);
}

/* ---------- garden ---------- */

const PLOT_STAGE_EMOJI = { empty: "🟫", seed: "🌰", sprout: "🌱" };
let seedTargetPlot = null;
let gardenBusy = false;

function renderGarden() {
  const extras = Core.currentExtras(petState);
  const key = Core.dayKey();

  gardenPlots.innerHTML = "";
  extras.garden.forEach((plot, index) => {
    const stage = Core.plotStage(plot);
    const seed = plot ? Core.findSeed(plot.seed) : null;
    const card = document.createElement("div");
    card.className = "garden-plot stage-" + stage;
    card.dataset.plot = String(index);

    let info = "Freies Beet";
    let button = `<button class="garden-plot-btn plant" data-action="plant" data-plot="${index}">Pflanzen</button>`;

    if (plot && seed) {
      const drops = `💧 ${Math.min(plot.waterings || 0, seed.days)}/${seed.days}`;
      if (stage === "ready") {
        info = `${seed.fruit} ist reif!`;
        button = `<button class="garden-plot-btn harvest" data-action="harvest" data-plot="${index}">Ernten 🧺</button>`;
      } else if (Core.canWater(plot, key)) {
        info = `${seed.fruit} · ${drops}`;
        button = `<button class="garden-plot-btn water" data-action="water" data-plot="${index}">Gießen 💧</button>`;
      } else {
        info = `${seed.fruit} · ${drops}`;
        button = `<button class="garden-plot-btn done" disabled>Heute gegossen${plot.watered_by ? " von " + escapeHtml(plot.watered_by) : ""} ✓</button>`;
      }
    }

    const emoji = stage === "ready" ? seed.emoji : PLOT_STAGE_EMOJI[stage];
    card.innerHTML = `
      <span class="garden-plot-emoji">${emoji}</span>
      <span class="garden-plot-info">${info}</span>
      ${button}
    `;
    gardenPlots.appendChild(card);
  });

  const pantry = Object.entries(extras.pantry).filter(([, count]) => count > 0);
  gardenPantry.textContent = pantry.length
    ? pantry.map(([fruit, count]) => `${(Core.seedForFruit(fruit) || {}).emoji || "🍎"} ${count}× ${fruit}`).join(" · ")
    : "noch leer";
}

function renderSeedList() {
  const coins = (petState && petState.coins) || 0;
  seedList.innerHTML = "";
  Core.SEEDS.forEach(seed => {
    const row = document.createElement("div");
    row.className = "shop-item";
    const days = seed.days === 1 ? "1 Tag" : `${seed.days} Tage`;
    row.innerHTML = `
      <span class="shop-item-icon">${seed.emoji}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${seed.fruit}</div>
        <div class="shop-item-price">🪙 ${seed.price} · reif nach ${days} Gießen</div>
      </div>
      ${coins >= seed.price
        ? `<button class="shop-item-btn buy" data-seed="${seed.id}">Säen</button>`
        : `<button class="shop-item-btn locked" disabled>🪙 ${seed.price}</button>`}
    `;
    seedList.appendChild(row);
  });
}

const GARDEN_ERRORS = {
  coins: "Dafür reichen unsere Münzen noch nicht 🪙",
  occupied: "In dem Beet wächst schon etwas 🌱",
  watered: "Das Beet wurde heute schon gegossen 💧",
  ready: "Das ist schon reif, jetzt ernten! 🧺",
  not_ready: "Das ist noch nicht reif 🌱",
  empty: "Das Beet ist leer"
};

async function gardenAction(action, index, seedId) {
  if (!requirePerson() || gardenBusy) return;
  gardenBusy = true;
  const person = normalizePerson(currentPerson);
  const key = Core.dayKey();
  let outcome = null;

  const result = await mutatePet(base => {
    if (action === "plant") {
      outcome = Core.plantSeed(base, index, seedId, person, key);
      if (outcome.error) return null;
      return { ...outcome.patch, coins: (base.coins || 0) - outcome.cost };
    }
    outcome = action === "water" ? Core.waterPlot(base, index, person, key) : Core.harvestPlot(base, index);
    if (outcome.error) return null;
    return {
      ...outcome.patch,
      coins: (base.coins || 0) + outcome.coins,
      total_coins_earned: (base.total_coins_earned || 0) + outcome.coins
    };
  });

  gardenBusy = false;
  renderGarden();

  if (!result) {
    if (outcome && outcome.error) showToast(GARDEN_ERRORS[outcome.error] || "Das ging gerade nicht", "error");
    return;
  }

  if (action === "plant") {
    vibrate([10, 20, 10]);
    showToast(`${outcome.seed.emoji} ${outcome.seed.fruit} gesät! Jetzt jeden Tag gießen 💧`, "success");
  } else if (action === "water") {
    vibrate(12);
    showToast(outcome.ready ? `Reif! Jetzt können wir ernten 🧺 (+${outcome.coins} 🪙)` : `Gegossen 💧 +${outcome.coins} 🪙`, "success");
  } else {
    vibrate([10, 20, 10, 20]);
    celebrate(12);
    showToast(`${outcome.seed.emoji} ${outcome.seed.fruit} geerntet! Liegt jetzt im Vorratskorb (+${outcome.coins} 🪙)`, "success");
  }

  announceNewAchievements(result.previous, result.next);
  broadcastTogether("care", { person, type: "garden" });
}

gardenPlots.addEventListener("click", event => {
  const btn = event.target.closest(".garden-plot-btn");
  if (!btn || btn.disabled) return;
  const index = Number(btn.dataset.plot);
  if (btn.dataset.action === "plant") {
    if (!requirePerson()) return;
    seedTargetPlot = index;
    renderSeedList();
    seedModal.classList.remove("hidden");
    return;
  }
  gardenAction(btn.dataset.action, index);
});

seedList.addEventListener("click", event => {
  const btn = event.target.closest(".shop-item-btn");
  if (!btn || btn.disabled || seedTargetPlot === null) return;
  seedModal.classList.add("hidden");
  gardenAction("plant", seedTargetPlot, btn.dataset.seed);
  seedTargetPlot = null;
});

closeSeedModal.addEventListener("click", () => {
  seedModal.classList.add("hidden");
  seedTargetPlot = null;
});

gardenBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked || isAsleep()) return;
  renderGarden();
  enterScene(gardenScene);
});

leaveGardenScene.addEventListener("click", () => exitScene(gardenScene));

/* the food menu shows what we harvested */
function renderGardenFood() {
  const pantry = Object.entries(Core.currentExtras(petState).pantry).filter(([, count]) => count > 0);
  gardenFoodSection.classList.toggle("hidden", pantry.length === 0);
  gardenFoodGrid.innerHTML = "";
  pantry.forEach(([fruit, count]) => {
    const emoji = (Core.seedForFruit(fruit) || {}).emoji || "🍎";
    const btn = document.createElement("button");
    btn.className = "food-btn garden-food-btn";
    btn.dataset.food = fruit;
    btn.dataset.emoji = emoji;
    btn.innerHTML = `<span class="activity-icon">${emoji}</span><span class="activity-label">${fruit}</span><span class="garden-food-count">${count}×</span>`;
    gardenFoodGrid.appendChild(btn);
  });
}

gardenFoodGrid.addEventListener("click", event => {
  const btn = event.target.closest(".garden-food-btn");
  if (!btn) return;
  foodModal.classList.add("hidden");
  performActivity("feed", btn.dataset.food, btn.dataset.emoji, { fromGarden: true });
});

/* ---------- star rain mini game ---------- */

const STARS_GAME_MS = 20000;
const STARS_SPAWN_MS = 420;
const STAR_KINDS = [
  { emoji: "🌟", points: 3, chance: 0.12, cls: "golden" },
  { emoji: "🌧️", points: -2, chance: 0.22, cls: "cloud" },
  { emoji: "⭐", points: 1, chance: 1, cls: "star" }
];

let starsRunning = false;
let starsPoints = 0;
let starsSpawnTimer = null;
let starsClockTimer = null;
let starsEndsAt = 0;

function renderStarsInfo(resultText) {
  const extras = Core.currentExtras(petState);
  starsBest.textContent = extras.star_best;
  const left = currentPerson ? Core.starRoundsLeft(petState, normalizePerson(currentPerson), Core.dayKey()) : Core.STAR_ROUNDS_REWARDED;
  const energy = decayedStats().energy;
  const roundsText = left > 0
    ? `Heute noch ${left} ${left === 1 ? "Runde" : "Runden"} mit Münzen (bis zu ${Core.STAR_MAX_COINS} 🪙). Kostet Mochi ${Core.STAR_ENERGY_COST} Energie.`
    : "Für heute gibt's keine Münzen mehr, aber für den Rekord könnt ihr weiterspielen!";
  starsRoundsInfo.textContent = (resultText ? resultText + " " : "") + roundsText + (energy < Core.STAR_ENERGY_COST ? " Mochi ist gerade zu müde 😴" : "");
  starsPlayBtn.disabled = energy < Core.STAR_ENERGY_COST;
}

function spawnStar() {
  const roll = Math.random();
  let acc = 0;
  const kind = STAR_KINDS.find(k => (acc += k.chance) > roll) || STAR_KINDS[2];

  const drop = document.createElement("button");
  drop.type = "button";
  drop.className = "stars-drop " + kind.cls;
  drop.textContent = kind.emoji;
  drop.style.left = (4 + Math.random() * 80) + "%";
  drop.style.setProperty("--fall", (2.1 + Math.random() * 1.4).toFixed(2) + "s");

  drop.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (!starsRunning || drop.dataset.hit) return;
    drop.dataset.hit = "1";
    starsPoints = Math.max(0, starsPoints + kind.points);
    starsScore.textContent = starsPoints;
    drop.classList.add(kind.points < 0 ? "popped-bad" : "popped-good");
    vibrate(kind.points < 0 ? [30, 20, 30] : 8);
    starsMochi.classList.remove("bounce", "shake");
    void starsMochi.offsetWidth;
    starsMochi.classList.add(kind.points < 0 ? "shake" : "bounce");
    setTimeout(() => drop.remove(), 220);
  });
  drop.addEventListener("animationend", event => {
    if (event.animationName === "stars-fall") drop.remove();
  });

  starsField.appendChild(drop);
}

function stopStarsTimers() {
  clearInterval(starsSpawnTimer);
  clearInterval(starsClockTimer);
  starsSpawnTimer = null;
  starsClockTimer = null;
  starsField.querySelectorAll(".stars-drop").forEach(el => el.remove());
}

function startStars() {
  if (starsRunning || activityLocked || isAsleep()) return;
  if (!requirePerson()) return;
  if (decayedStats().energy < Core.STAR_ENERGY_COST) {
    showToast("Mochi ist zu müde zum Spielen, erst ein Nickerchen 😴", "error");
    return;
  }

  starsRunning = true;
  activityLocked = true;
  starsPoints = 0;
  starsScore.textContent = "0";
  starsTime.textContent = String(STARS_GAME_MS / 1000);
  starsStart.classList.add("hidden");
  starsEndsAt = Date.now() + STARS_GAME_MS;

  spawnStar();
  starsSpawnTimer = setInterval(spawnStar, STARS_SPAWN_MS);
  starsClockTimer = setInterval(() => {
    const left = Math.max(0, Math.ceil((starsEndsAt - Date.now()) / 1000));
    starsTime.textContent = String(left);
    if (left <= 0) finishStars();
  }, 250);
}

async function finishStars() {
  if (!starsRunning) return;
  starsRunning = false;
  stopStarsTimers();

  const score = starsPoints;
  const person = normalizePerson(currentPerson);
  let round = null;

  const result = await applyCare({ energy: -Core.STAR_ENERGY_COST, bond: 8 }, 0, 2, (nowIso, state) => {
    round = Core.starRoundOutcome(state, person, Core.dayKey(), score);
    return { last_activity: "stars", extraCoins: round.coins, ...round.patch };
  }, { type: "stars", score });

  activityLocked = false;

  let text = `${score} ${score === 1 ? "Punkt" : "Punkte"}!`;
  if (result && round) {
    if (round.coins) text += ` +${round.coins} 🪙`;
    if (round.record) {
      text += " Neuer Rekord! 🏅";
      celebrate(18);
    }
    showToast(`Sternenregen: ${text}`, "success");
  }
  starsStart.classList.remove("hidden");
  starsPlayBtn.textContent = "Nochmal!";
  renderStarsInfo(text);
}

function abortStars() {
  if (!starsRunning) return;
  starsRunning = false;
  activityLocked = false;
  stopStarsTimers();
  starsStart.classList.remove("hidden");
}

starsPlayBtn.addEventListener("click", startStars);

starsBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  starsPlayBtn.textContent = "Los geht's!";
  starsScore.textContent = "0";
  starsTime.textContent = String(STARS_GAME_MS / 1000);
  renderStarsInfo();
  enterScene(starsScene);
});

leaveStarsScene.addEventListener("click", () => {
  abortStars();
  exitScene(starsScene);
});
