/* Mochi, part 2 of 6: caring for Mochi – feeding, cuddling, sleeping, showering, dancing – and the activity buttons. */

/* ---------- interactions ---------- */

async function wakeMochi() {
  if (!requirePerson()) return;
  if (wakingInProgress) return;
  wakingInProgress = true;

  vibrate([15, 15]);

  const sleepStart = petState && petState.sleep_started_at ? new Date(petState.sleep_started_at).getTime() : null;
  const sleptRatio = sleepStart ? clamp((Date.now() - sleepStart) / FULL_REST_MS, 0, 1) : 0;
  const energyBoost = Math.round(sleptRatio * 50);
  const coinReward = sleptRatio >= 0.8 ? 6 : 0;

  showToast("Die Sonne geht auf ☀️", "success");
  sleepSky.classList.add("waking");

  await new Promise(resolve => setTimeout(resolve, SUNRISE_DURATION_MS));

  sleepSky.classList.remove("waking");
  showToast("Mochi ist aufgewacht 💤➡️😊", "success");

  await applyCare({ energy: energyBoost }, coinReward, 3, { sleep_started_at: null }, { type: "sleep", full: sleptRatio >= 0.8 });
  wakingInProgress = false;
}

async function triggerPet() {
  if (isAsleep()) {
    wakeMochi();
    return;
  }

  const now = Date.now();
  if (now - lastPetTrigger < PET_COOLDOWN_MS) return;
  if (!requirePerson()) return;

  lastPetTrigger = now;
  spawnHeart(false);
  vibrate([10, 20, 10]);

  const foundCoin = Math.random() < SURPRISE_COIN_CHANCE;
  const result = await applyCare({ bond: 6 }, 1, 1, nowIso => ({ last_petted_at: nowIso, extraCoins: foundCoin ? SURPRISE_COINS : 0 }), { type: "pet" });
  if (result && foundCoin) {
    showToast(`Mochi hat beim Streicheln eine Münze gefunden! +${SURPRISE_COINS} 🪙`, "success");
    spawnParticle("🪙", { size: 24 });
    say("Guck mal, was ich gefunden hab! 🪙");
  }
}

async function triggerCuddle() {
  if (isAsleep()) {
    wakeMochi();
    return;
  }

  if (!requirePerson()) return;

  petCreature.classList.add("hugging");
  vibrate([15, 40, 15, 40, 25]);
  setTimeout(() => petCreature.classList.remove("hugging"), 900);

  noteOwnCuddle();

  const now = Date.now();
  if (now - lastCuddleTrigger < CUDDLE_COOLDOWN_MS) {
    showToast("Mochi ist schon ganz warm gekuschelt, gleich nochmal 💭", "success");
    return;
  }
  lastCuddleTrigger = now;

  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnHeart(true), i * 120);
  }

  showToast(`${currentPerson} hat Mochi geknuddelt 🤗`, "success");

  const success = await applyCare({ bond: 28 }, 3, 2, nowIso => ({ last_cuddled_at: nowIso }), { type: "cuddle" });
  if (!success) return;

  sendAppNotification(supabaseClient, {
    title: "Mochi wurde geknuddelt 🎂",
    body: `${currentPerson} hat Mochi gerade richtig doll gedrückt.`,
    excludePerson: normalizePerson(currentPerson),
    category: "mochi",
    url: "mochi.html"
  });
}

async function performActivity(kind, extraLabel, particleEmojiOverride, options = {}) {
  if (showerLathering || activityLocked) return false;

  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return false;
  }

  if (!requirePerson()) return false;

  const activity = ACTIVITIES[kind];
  activityLocked = true;

  petCreature.classList.add(activity.animationClass);
  vibrate(activity.vibratePattern);
  const particleEmoji = particleEmojiOverride || activity.particleEmoji;
  for (let i = 0; i < activity.particleCount; i++) {
    setTimeout(() => spawnParticle(particleEmoji, { falling: activity.falling }), i * 130);
  }
  setTimeout(() => petCreature.classList.remove(activity.animationClass), 1400);

  const label = extraLabel ? `${activity.label} (${extraLabel})` : activity.label;
  showToast(`${label} 🎉`, "success");

  const activityLog = extraLabel ? `${kind}:${extraLabel}` : kind;
  const extra = nowIso => ({ last_activity: activityLog });

  if (kind === "feed" && options.fromGarden) {
    /* home-grown fruit: more filling, more coins, and it leaves the pantry */
    await applyCare({ hunger: 60, bond: 12 }, 7, 3, (nowIso, state) => {
      const taken = Core.takeFromPantry(state, extraLabel);
      return { last_activity: activityLog, ...(taken ? taken.patch : {}) };
    }, { type: "feed", food: extraLabel });
  } else if (kind === "feed") {
    await applyCare({ hunger: 45, bond: 5 }, 3, 2, extra, { type: "feed", food: extraLabel });
  } else {
    await applyCare({ bond: 12 }, 5, 2, extra, { type: kind });
  }

  activityLocked = false;
  return true;
}

async function toggleSleep() {
  if (showerLathering) return;

  if (isAsleep()) {
    wakeMochi();
    return;
  }

  if (!requirePerson()) return;

  vibrate([10, 10, 10]);
  showToast("Gute Nacht, Mochi schläft jetzt ein 😴", "success");

  await mutatePet((base, nowIso) => ({ sleep_started_at: nowIso }));
}

function spawnShowerBubble() {
  if (!showerLathering) return;

  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "shower-bubble-target";
  bubble.style.left = (28 + Math.random() * 44) + "%";
  bubble.style.top = (30 + Math.random() * 42) + "%";
  const size = 30 + Math.random() * 16;
  bubble.style.width = size + "px";
  bubble.style.height = size + "px";

  let resolved = false;

  const missTimer = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    bubble.classList.add("popped-miss");
    setTimeout(() => bubble.remove(), 200);
    afterBubbleResolved();
  }, SHOWER_BUBBLE_LIFETIME_MS);

  bubble.addEventListener("pointerdown", event => {
    event.stopPropagation();
    if (resolved) return;
    resolved = true;
    clearTimeout(missTimer);
    showerBubblesCaught++;
    vibrate(8);
    spawnParticle("🫧", { size: 14 });
    bubble.classList.add("popped-catch");
    setTimeout(() => bubble.remove(), 200);
    afterBubbleResolved();
  });

  petCreature.appendChild(bubble);
}

function afterBubbleResolved() {
  showerBubblesResolved++;
  petFoamOverlay.setAttribute("opacity", String(Math.min(0.85, (showerBubblesResolved / SHOWER_BUBBLE_COUNT) * 0.85)));
  petHint.textContent = `Tippe die Seifenblasen an, bevor sie zerplatzen! (${showerBubblesResolved}/${SHOWER_BUBBLE_COUNT})`;

  if (showerBubblesResolved >= SHOWER_BUBBLE_COUNT) {
    finishShower();
  }
}

function startShowerBubbleRound() {
  showerBubblesSpawned = 0;
  showerBubblesCaught = 0;
  showerBubblesResolved = 0;

  spawnShowerBubble();
  showerBubblesSpawned++;

  showerBubbleTimer = setInterval(() => {
    if (showerBubblesSpawned >= SHOWER_BUBBLE_COUNT) {
      clearInterval(showerBubbleTimer);
      return;
    }
    spawnShowerBubble();
    showerBubblesSpawned++;
  }, SHOWER_BUBBLE_SPAWN_GAP_MS);
}

function startShowerLathering() {
  showerLathering = true;
  petFoamOverlay.setAttribute("opacity", "0");
  petCreature.classList.add("showering");
  shampooBottle.classList.remove("hidden");
  [messengerBtn, feedBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn, gardenBtn, starsBtn].forEach(btn => btn.classList.add("hidden"));
  showerBtn.classList.add("hidden");
  petHint.textContent = `Tippe die Seifenblasen an, bevor sie zerplatzen! (0/${SHOWER_BUBBLE_COUNT})`;
  showToast("Seifenblasen-Zeit! Fang so viele wie möglich 🫧", "success");
  startShowerBubbleRound();
}

async function finishShower() {
  showerLathering = false;
  clearInterval(showerBubbleTimer);
  document.querySelectorAll(".shower-bubble-target").forEach(el => el.remove());
  shampooBottle.classList.add("hidden");
  petHint.textContent = DEFAULT_PET_HINT;
  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn, gardenBtn, starsBtn].forEach(btn => btn.classList.remove("hidden"));

  for (let i = 0; i < 6; i++) {
    setTimeout(() => spawnParticle("💧", { falling: true }), i * 100);
  }
  petFoamOverlay.setAttribute("opacity", "0");
  vibrate([10, 10, 10, 10]);
  setTimeout(() => petCreature.classList.remove("showering"), 1300);

  const hitRate = showerBubblesCaught / SHOWER_BUBBLE_COUNT;
  const cleanlinessGain = Math.round(25 + hitRate * 25);
  const coinReward = Math.round(2 + hitRate * 6);

  showToast(`Mochi ist frisch geduscht 🚿✨ (${showerBubblesCaught}/${SHOWER_BUBBLE_COUNT} Blasen gefangen)`, "success");

  await applyCare({ cleanliness: cleanlinessGain, bond: 5 }, coinReward, 2, () => ({ last_activity: "shower" }), { type: "shower", caught: showerBubblesCaught });
}

function danceUpdateHint() {
  petHint.textContent = `Tippe im Takt auf Mochi! (${danceHits}/${DANCE_BEAT_COUNT} getroffen)`;
}

function registerDanceTap() {
  const now = Date.now();
  for (let i = danceBeatTimestamps.length - 1; i >= 0; i--) {
    if (danceBeatConsumed[i]) continue;
    if (Math.abs(now - danceBeatTimestamps[i]) <= DANCE_HIT_WINDOW_MS) {
      danceBeatConsumed[i] = true;
      danceHits++;
      spawnParticle("✨", {});
      danceUpdateHint();
      return;
    }
  }
}

function runDanceRhythm() {
  return new Promise(resolve => {
    danceRhythmActive = true;
    danceHits = 0;
    danceBeatTimestamps = [];
    danceBeatConsumed = [];
    danceUpdateHint();

    let beatIndex = 0;

    function fireBeat() {
      if (beatIndex >= DANCE_BEAT_COUNT) {
        clearInterval(danceBeatIntervalId);
        danceRhythmActive = false;
        resolve(danceHits / DANCE_BEAT_COUNT);
        return;
      }

      danceBeatTimestamps.push(Date.now());
      danceBeatConsumed.push(false);
      beatIndex++;

      petCreature.classList.remove("beat-pulse");
      void petCreature.offsetWidth;
      petCreature.classList.add("beat-pulse");
      vibrate(12);
    }

    fireBeat();
    danceBeatIntervalId = setInterval(fireBeat, DANCE_BEAT_INTERVAL_MS);
  });
}

async function performDance() {
  if (showerLathering || activityLocked) return false;

  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return false;
  }

  if (!requirePerson()) return false;

  activityLocked = true;

  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn, gardenBtn, starsBtn].forEach(btn => btn.classList.add("hidden"));

  petCreature.classList.add("disco-rising");
  vibrate([10, 15, 10]);

  await new Promise(resolve => setTimeout(resolve, DISCO_RISE_DURATION_MS));

  petCreature.classList.remove("disco-rising");
  petCreature.classList.add("party");
  vibrate([10, 20, 10, 20, 10]);
  showToast("Tanz mit dem Takt mit! 🎶", "success");

  const hitRate = await runDanceRhythm();

  const coinReward = Math.round(2 + hitRate * 6);
  const bondGain = Math.round(6 + hitRate * 10);
  const finalHits = danceHits;

  for (let i = 0; i < 7; i++) {
    setTimeout(() => spawnParticle(["🎵", "🎶", "✨", "🪩"][Math.floor(Math.random() * 4)]), i * 200);
  }

  petHint.textContent = DEFAULT_PET_HINT;
  [messengerBtn, feedBtn, showerBtn, sportBtn, danceBtn, coffeeBtn, sleepBtn, openRoomBtn, gardenBtn, starsBtn].forEach(btn => btn.classList.remove("hidden"));

  setTimeout(() => petCreature.classList.remove("party"), DANCE_PARTY_TAIL_MS);

  showToast(`Mochi hat getanzt 🎉 (${finalHits}/${DANCE_BEAT_COUNT} im Takt)`, "success");

  await applyCare({ bond: bondGain }, coinReward, 2, () => ({ last_activity: "dance" }), { type: "dance", hits: finalHits });

  activityLocked = false;
  return true;
}

/* ---------- activity buttons ---------- */

feedBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  renderGardenFood();
  foodModal.classList.remove("hidden");
});

closeFoodModal.addEventListener("click", () => foodModal.classList.add("hidden"));

foodButtons.forEach(button => {
  button.addEventListener("click", () => {
    foodModal.classList.add("hidden");
    performActivity("feed", button.dataset.food, button.dataset.emoji);
  });
});

showerBtn.addEventListener("click", () => {
  if (showerLathering || activityLocked) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  startShowerLathering();
});

sportBtn.addEventListener("click", () => performActivity("sport"));

danceBtn.addEventListener("click", () => performDance());

sleepBtn.addEventListener("click", toggleSleep);
