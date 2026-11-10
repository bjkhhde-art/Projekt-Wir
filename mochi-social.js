/* Mochi, part 5 of 6: gestures, personality, wishes/streak/chest, Mochi as messenger and being together. */

/* ---------- pointer gestures ---------- */

petCreature.addEventListener("pointerdown", event => {
  try {
    petCreature.setPointerCapture(event.pointerId);
  } catch (error) {
    // some browsers reject capture for an id not yet tracked as active; harmless to skip
  }

  if (danceRhythmActive) {
    registerDanceTap();
    return;
  }

  if (showerLathering) {
    return;
  }

  gestureState = {
    startX: event.clientX,
    startY: event.clientY,
    startedAt: Date.now(),
    mode: "pending",
    tickDistance: 0,
    totalMoved: 0,
    longPressTimer: setTimeout(() => {
      if (gestureState && gestureState.mode === "pending") {
        gestureState.mode = "cuddled";
        triggerCuddle();
      }
    }, LONG_PRESS_MS)
  };
});

petCreature.addEventListener("pointermove", event => {
  if (danceRhythmActive || showerLathering) return;

  if (!gestureState) return;

  const dx = event.clientX - gestureState.startX;
  const dy = event.clientY - gestureState.startY;
  const dist = Math.hypot(dx, dy);

  if (gestureState.mode === "pending" && dist > MOVE_THRESHOLD) {
    clearTimeout(gestureState.longPressTimer);
    gestureState.mode = "stroking";
    petCreature.classList.add("stroking");
  }

  if (gestureState.mode === "stroking") {
    gestureState.tickDistance += dist;
    gestureState.totalMoved += dist;
    gestureState.startX = event.clientX;
    gestureState.startY = event.clientY;

    if (gestureState.tickDistance >= STROKE_TICK_DISTANCE) {
      gestureState.tickDistance = 0;
      vibrate(8);
      spawnHeart(false);
    }
  }
});

function endGesture() {
  if (danceRhythmActive || showerLathering) return;

  if (!gestureState) return;

  clearTimeout(gestureState.longPressTimer);

  if (gestureState.mode === "stroking" && gestureState.totalMoved >= STROKE_MIN_DISTANCE) {
    triggerPet();
  } else if (gestureState.mode === "pending" && Date.now() - gestureState.startedAt < TAP_MAX_MS) {
    handleTap();
  }

  petCreature.classList.remove("stroking");
  gestureState = null;
}

petCreature.addEventListener("pointerup", endGesture);
petCreature.addEventListener("pointercancel", endGesture);

/* ---------- personality: speech, eyes, taps, idle moods ---------- */

const SPEECH_MS = 4200;
const TAP_MAX_MS = 320;
const TAP_SERIES_MS = 1500;
const EYE_RANGE = 3.6;
let speechTimer = null;
let lookResetTimer = null;
let tapTimes = [];

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sceneBusy() {
  return showerLathering || activityLocked || danceRhythmActive || wakingInProgress || petMainView.classList.contains("hidden");
}

function say(text, ms = SPEECH_MS) {
  mochiSpeech.textContent = text;
  mochiSpeech.classList.remove("hidden", "pop");
  void mochiSpeech.offsetWidth;
  mochiSpeech.classList.add("pop");
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => mochiSpeech.classList.add("hidden"), ms);
}

function chatter() {
  if (document.hidden || sceneBusy()) return;
  if (isAsleep()) {
    say(randomOf(["Zzz… Karotten… 💤", "*schnarch* 😴", "Mmmh… Kuchen… 🎂"]));
    return;
  }
  const stats = decayedStats();
  say(Core.speechLine({
    stats,
    mood: moodTier(overallMood(stats)),
    hour: Core.hourIn(),
    person: currentPerson ? normalizePerson(currentPerson) : null
  }));
}

function scheduleChatter() {
  setTimeout(() => {
    chatter();
    scheduleChatter();
  }, 15000 + Math.random() * 12000);
}

function greet() {
  if (!currentPerson || isAsleep()) return;
  const me = normalizePerson(currentPerson);
  const partner = Core.partnerOf(me);
  const daily = Core.currentDaily(petState, Core.dayKey());
  if (inbox.length) {
    say(`Ich hab Post für dich, ${me}! 💌`, 5200);
  } else if (daily.visitors.includes(partner) && !daily.visitors.includes(me)) {
    say(`${partner} war heute schon bei mir 💗 Jetzt du!`, 5200);
  } else {
    chatter();
  }
}

function setEyeOffset(dx, dy) {
  petEyes.forEach(eye => {
    if (eye.el) eye.el.style.transform = dx || dy ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` : "";
  });
}

function lookAt(clientX, clientY) {
  if (!petSvg || isAsleep()) return;
  const rect = petSvg.getBoundingClientRect();
  if (!rect.width) return;
  const sx = rect.width / 200;
  const sy = rect.height / 215;
  const cx = rect.left + 100 * sx;
  const cy = rect.top + 152 * sy;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const reach = Math.min(1, dist / 90) * EYE_RANGE;
  setEyeOffset((dx / dist) * reach, (dy / dist) * reach);

  clearTimeout(lookResetTimer);
  lookResetTimer = setTimeout(() => setEyeOffset(0, 0), 2200);
}

document.addEventListener("pointermove", event => lookAt(event.clientX, event.clientY), { passive: true });
document.addEventListener("pointerdown", event => lookAt(event.clientX, event.clientY), { passive: true });

function playOnce(className, ms) {
  petCreature.classList.remove(className);
  void petCreature.offsetWidth;
  petCreature.classList.add(className);
  setTimeout(() => petCreature.classList.remove(className), ms);
}

function handleTap() {
  if (isAsleep()) {
    say("Zzz… 😴 (Halt mich gedrückt, dann wach ich auf)");
    return;
  }
  if (sceneBusy()) return;

  const now = Date.now();
  tapTimes = tapTimes.filter(t => now - t < TAP_SERIES_MS);
  tapTimes.push(now);
  const reaction = Core.tapReaction(tapTimes.length);

  if (reaction === "dizzy") {
    tapTimes = [];
    playOnce("dizzy", 1400);
    say("Uiii, mir ist ganz schwindelig 😵‍💫");
    vibrate([20, 30, 20, 30, 20]);
    return;
  }
  if (reaction === "sneeze") {
    playOnce("sneeze", 900);
    say("Hatschi! 🤧");
    ["💨", "✨", "💨"].forEach((emoji, i) => setTimeout(() => spawnParticle(emoji, { size: 16 }), i * 90));
    vibrate([40]);
    return;
  }
  playOnce("giggle", 500);
  vibrate(6);
  if (tapTimes.length === 1 || Math.random() < 0.5) say(randomOf(["Hihi! 😆", "Das kitzelt!", "Hehe 🤭", "Nochmal!", "Pieks! 😄"]), 1800);
}

function idleMoment() {
  if (document.hidden || sceneBusy() || isAsleep() || Math.random() > 0.45) return;
  const stats = decayedStats();

  if (stats.energy < 45 && Math.random() < 0.5) {
    petMouthPath.setAttribute("d", "M90,174 Q100,194 110,174 Q100,168 90,174 Z");
    petCreature.classList.add("yawning");
    say("*gähn* 🥱", 1800);
    setTimeout(() => {
      petCreature.classList.remove("yawning");
      render();
    }, 1600);
    return;
  }

  if (Math.random() < 0.5) {
    setEyeOffset(-EYE_RANGE, 0);
    setTimeout(() => setEyeOffset(EYE_RANGE, 0), 700);
    setTimeout(() => setEyeOffset(0, 0), 1400);
  } else {
    playOnce("hop", 700);
  }
}

setInterval(() => { if (!document.hidden) idleMoment(); }, 9000);

/* ---------- wishes, streak, chest ---------- */

let renderedWishDone = null;

function renderDaily() {
  const key = Core.dayKey();
  const daily = Core.currentDaily(petState, key);
  const wishes = Core.wishesFor(key);
  const doneIds = wishes.filter(w => daily.wishes_done[w.id]).map(w => w.id);
  const doneKey = key + ":" + doneIds.join(",");

  if (doneKey !== renderedWishDone) {
    const previouslyDone = renderedWishDone && renderedWishDone.startsWith(key) ? renderedWishDone.split(":")[1].split(",") : doneIds;
    wishList.innerHTML = wishes.map(wish => {
      const by = daily.wishes_done[wish.id];
      const fresh = by && !previouslyDone.includes(wish.id);
      return `
        <li class="wish-item${by ? " done" : ""}${fresh ? " just-done" : ""}" data-wish="${escapeHtml(wish.id)}">
          <span class="wish-emoji">${wish.emoji}</span>
          <span class="wish-text">${escapeHtml(wish.text)}</span>
          <span class="wish-state">${by ? "✓ " + escapeHtml(by) : "+" + Core.WISH_REWARD + " 🪙"}</span>
        </li>`;
    }).join("");
    renderedWishDone = doneKey;
  }

  wishProgress.textContent = `${doneIds.length}/${wishes.length}`;
  wishBonusHint.textContent = daily.bonus_claimed
    ? "Alle Wünsche erfüllt – Mochi ist überglücklich 🎉"
    : `Alle erfüllt: +${Core.ALL_WISHES_BONUS} 🪙 Bonus obendrauf`;

  const streak = Core.currentStreak(petState, key);
  streakCount.textContent = streak;
  streakPill.classList.toggle("cold", streak === 0);
  const visitorLine = Core.PERSONS.map(p => `${p} ${daily.visitors.includes(p) ? "✓" : "⏳"}`).join(" · ");
  const best = (petState && petState.best_streak) || 0;
  streakLine.textContent = `🔥 Wir-Serie: ${streak} ${streak === 1 ? "Tag" : "Tage"} · heute: ${visitorLine}${best > streak ? ` · Rekord ${best}` : ""}`;

  const me = currentPerson ? normalizePerson(currentPerson) : null;
  chestBtn.classList.toggle("has-gift", !!me && !Core.chestOpened(petState, me, key));
}

streakPill.addEventListener("click", () => {
  const streak = Core.currentStreak(petState, Core.dayKey());
  showToast(streak
    ? `🔥 ${streak} ${streak === 1 ? "Tag" : "Tage"} in Folge wart ihr beide bei Mochi. Weiter so!`
    : "🔥 Kümmert euch heute beide um Mochi, dann startet eure Wir-Serie!", "success");
});

function renderChestModal() {
  const me = normalizePerson(currentPerson);
  const daily = Core.currentDaily(petState, Core.dayKey());
  const mine = daily.chest[me];
  const partner = Core.partnerOf(me);
  const partnerNote = daily.chest[partner] !== undefined ? ` ${partner} hat heute ${daily.chest[partner]} 🪙 gefunden.` : "";

  chestOpenBtn.classList.remove("shaking", "opened");
  if (mine !== undefined) {
    chestOpenBtn.textContent = "📭";
    chestOpenBtn.disabled = true;
    chestText.textContent = `Heute schon geöffnet – morgen wartet eine neue Truhe!${partnerNote}`;
    chestResult.textContent = `Deine Beute heute: ${mine} 🪙`;
  } else {
    chestOpenBtn.textContent = "🎁";
    chestOpenBtn.disabled = false;
    chestText.textContent = `Tippe auf die Truhe! Jeden Tag darf jede:r von euch einmal öffnen.${partnerNote}`;
    chestResult.textContent = "";
  }
}

async function openChest() {
  if (!requirePerson()) return;
  const me = normalizePerson(currentPerson);
  const key = Core.dayKey();
  if (Core.chestOpened(petState, me, key)) return;

  chestOpenBtn.disabled = true;
  chestOpenBtn.classList.add("shaking");
  vibrate([10, 40, 10, 40, 10]);
  await new Promise(resolve => setTimeout(resolve, 900));

  let roll = null;
  const result = await mutatePet(base => {
    roll = Core.openChest(base, me, key);
    if (!roll) return null;
    return {
      ...roll.patch,
      coins: (base.coins || 0) + roll.coins,
      total_coins_earned: (base.total_coins_earned || 0) + roll.coins
    };
  });

  chestOpenBtn.classList.remove("shaking");
  if (!result || !roll) {
    renderChestModal();
    return;
  }

  chestOpenBtn.textContent = roll.jackpot ? "💎" : "🪙";
  chestOpenBtn.classList.add("opened");
  chestResult.textContent = roll.jackpot ? `JACKPOT! +${roll.coins} 🪙` : `+${roll.coins} 🪙`;
  chestText.textContent = roll.jackpot ? "Wahnsinn, die ganz große Truhe! 🤩" : "Mochi freut sich mit dir!";
  celebrate(roll.jackpot ? 40 : 14);
  vibrate(roll.jackpot ? [30, 40, 30, 40, 60] : [20, 30, 20]);
  announceNewAchievements(result.previous, result.next);
}

chestBtn.addEventListener("click", () => {
  if (!requirePerson()) return;
  renderChestModal();
  chestModal.classList.remove("hidden");
});
chestOpenBtn.addEventListener("click", openChest);
closeChest.addEventListener("click", () => chestModal.classList.add("hidden"));

/* ---------- Mochi as messenger ---------- */

let inbox = [];
let selectedKind = null;
let openDeliveryMessage = null;

function updateSendButton() {
  const needsNote = selectedKind === "note";
  sendMessenger.disabled = !selectedKind || (needsNote && !Core.cleanNote(messengerNote.value));
}

function selectKind(kind) {
  selectedKind = kind;
  messengerKinds.forEach(btn => btn.classList.toggle("selected", btn.dataset.kind === kind));
  messengerNoteWrap.classList.toggle("hidden", kind !== "note");
  if (kind === "note") setTimeout(() => messengerNote.focus(), 50);
  updateSendButton();
}

async function renderMessengerHistory() {
  const { data, error } = await supabaseClient
    .from("mochi_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Fehler beim Laden der Botschaften:", error);
    return;
  }

  const rows = data || [];
  messengerHistory.innerHTML = rows.length
    ? rows.map(msg => {
      const kind = Core.MESSAGE_KINDS[msg.kind] || Core.MESSAGE_KINDS.heart;
      const status = msg.delivered_at ? "✓✓ angekommen" : "✈️ unterwegs";
      return `
        <li class="messenger-history-item">
          <span class="messenger-history-emoji">${kind.emoji}</span>
          <div>
            <div class="messenger-history-head">${escapeHtml(msg.from_person)} → ${escapeHtml(msg.to_person)} · ${timeAgo(msg.created_at)} · ${status}</div>
            ${msg.note ? `<div class="messenger-history-note">„${escapeHtml(msg.note)}“</div>` : ""}
          </div>
        </li>`;
    }).join("")
    : `<li class="messenger-history-empty">Noch keine Post – schick die erste! 💌</li>`;
}

function openMessenger() {
  if (sceneBusy()) return;
  if (isAsleep()) {
    showToast("Mochi schläft gerade, erst aufwecken 😴", "success");
    return;
  }
  if (!requirePerson()) return;
  const partner = Core.partnerOf(normalizePerson(currentPerson));
  messengerIntro.textContent = `Mochi macht sich auf den Weg zu ${partner} und überbringt deine Botschaft.`;
  messengerNote.value = "";
  messengerNoteCount.textContent = `0/${Core.NOTE_MAX_LENGTH}`;
  selectKind(null);
  messengerModal.classList.remove("hidden");
  renderMessengerHistory();
}

async function sendLoveMessage(kind, rawNote) {
  if (!requirePerson()) return false;
  const me = normalizePerson(currentPerson);
  const partner = Core.partnerOf(me);
  const note = kind === "note" ? Core.cleanNote(rawNote) : null;
  if (kind === "note" && !note) return false;

  const { error } = await supabaseClient
    .from("mochi_messages")
    .insert({ from_person: me, to_person: partner, kind, note });

  if (error) {
    console.error("Fehler beim Verschicken:", error);
    showToast("Mochi konnte nicht losfliegen, bitte nochmal versuchen.", "error");
    return false;
  }

  const kindInfo = Core.MESSAGE_KINDS[kind];
  playOnce("messenger-flight", 1500);
  const envelope = document.createElement("span");
  envelope.className = "flying-envelope";
  envelope.textContent = kind === "note" ? "✉️" : kindInfo.emoji;
  petHearts.appendChild(envelope);
  setTimeout(() => envelope.remove(), 1500);
  vibrate([10, 30, 10]);
  showToast(`Mochi bringt ${partner} ${kindInfo.phrase} ✈️`, "success");
  say(`Bin gleich bei ${partner}! ✈️`);

  sendAppNotification(supabaseClient, {
    title: "Mochi bringt dir Post 💌",
    body: note ? `${me}: „${note}“` : Core.deliveryText({ from_person: me, kind }),
    excludePerson: me,
    category: "mochi",
    url: "mochi.html"
  });
  broadcastTogether("mail", { person: me });

  const key = Core.dayKey();
  await applyCare({ bond: 8 }, 0, 1, (nowIso, state) => {
    const reward = Core.messageReward(state, me, key);
    return { ...reward.patch, messages_sent: (state.messages_sent || 0) + 1, extraCoins: reward.coins };
  }, { type: "message" });
  return true;
}

messengerBtn.addEventListener("click", openMessenger);
messengerKinds.forEach(btn => btn.addEventListener("click", () => selectKind(btn.dataset.kind)));
messengerNote.addEventListener("input", () => {
  messengerNoteCount.textContent = `${messengerNote.value.length}/${Core.NOTE_MAX_LENGTH}`;
  updateSendButton();
});
cancelMessenger.addEventListener("click", () => messengerModal.classList.add("hidden"));
sendMessenger.addEventListener("click", async () => {
  if (!selectedKind) return;
  sendMessenger.disabled = true;
  const sent = await sendLoveMessage(selectedKind, messengerNote.value);
  if (sent) messengerModal.classList.add("hidden");
  else updateSendButton();
});

async function loadInbox() {
  if (!currentPerson) return;
  const { data, error } = await supabaseClient
    .from("mochi_messages")
    .select("*")
    .eq("to_person", normalizePerson(currentPerson))
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Fehler beim Laden der Post:", error);
    return;
  }

  const hadMail = inbox.length;
  inbox = (data || []).filter(msg => !openDeliveryMessage || msg.id !== openDeliveryMessage.id);
  renderMailEnvelope();
  if (inbox.length > hadMail && !sceneBusy()) {
    playOnce("hop", 700);
    say(`Ich hab Post für dich, ${normalizePerson(currentPerson)}! 💌`, 5200);
  }
}

function renderMailEnvelope() {
  mailEnvelope.classList.toggle("hidden", inbox.length === 0 || !!openDeliveryMessage);
  mailCount.classList.toggle("hidden", inbox.length < 2);
  mailCount.textContent = inbox.length;
}

function burst(emoji, count) {
  deliveryBurst.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "delivery-piece";
    piece.textContent = emoji;
    piece.style.setProperty("--x", Math.round((Math.random() - 0.5) * 260) + "px");
    piece.style.setProperty("--y", Math.round(-40 - Math.random() * 160) + "px");
    piece.style.setProperty("--r", Math.round((Math.random() - 0.5) * 120) + "deg");
    piece.style.animationDelay = (i * 45) + "ms";
    deliveryBurst.appendChild(piece);
  }
}

function openDelivery() {
  const msg = inbox.shift();
  if (!msg) return;
  openDeliveryMessage = msg;
  renderMailEnvelope();

  const kind = Core.MESSAGE_KINDS[msg.kind] || Core.MESSAGE_KINDS.heart;
  deliveryModal.querySelector(".delivery-box").dataset.kind = msg.kind;
  deliveryEmoji.textContent = kind.emoji;
  deliveryTitle.textContent = Core.deliveryText(msg);
  deliveryNote.textContent = msg.note ? `„${msg.note}“` : "";
  deliveryNote.classList.toggle("hidden", !msg.note);
  deliveryTime.textContent = `abgeschickt ${timeAgo(msg.created_at)}`;
  replyDelivery.textContent = `💋 Küsschen zurück an ${msg.from_person}`;
  deliveryModal.classList.remove("hidden");

  burst(msg.kind === "kiss" ? "💋" : msg.kind === "hug" ? "🤗" : msg.kind === "note" ? "💌" : "💗", 14);
  if (msg.kind === "hug") playOnce("hugging", 900);
  vibrate(msg.kind === "hug" ? [30, 60, 30, 60, 60] : [15, 30, 15]);
  celebrate(10);
}

async function finishDelivery() {
  const msg = openDeliveryMessage;
  deliveryModal.classList.add("hidden");
  openDeliveryMessage = null;
  renderMailEnvelope();
  if (!msg) return;

  const { error } = await supabaseClient
    .from("mochi_messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", msg.id);
  if (error) console.error("Fehler beim Zustellen:", error);

  if (inbox.length) say("Da ist noch mehr Post! 💌");
}

mailEnvelope.addEventListener("pointerdown", event => event.stopPropagation());
mailEnvelope.addEventListener("click", event => {
  event.stopPropagation();
  openDelivery();
});
closeDelivery.addEventListener("click", finishDelivery);
replyDelivery.addEventListener("click", async () => {
  await finishDelivery();
  await sendLoveMessage("kiss");
});

/* ---------- together: who is here right now, double cuddles ---------- */

const DOUBLE_CUDDLE_WINDOW_MS = 15000;
const DOUBLE_CUDDLE_COINS = 12;
let togetherChannel = null;
let partnerHere = false;
let partnerCuddleAt = 0;
let ownCuddleAt = 0;

function broadcastTogether(event, payload) {
  if (!togetherChannel) return;
  togetherChannel.send({ type: "broadcast", event, payload }).catch(() => {});
}

function joinTogether() {
  if (!currentPerson || togetherChannel) return;
  const me = normalizePerson(currentPerson);

  togetherChannel = supabaseClient.channel("mochi-together", { config: { presence: { key: me } } });
  togetherChannel
    .on("presence", { event: "sync" }, updateTogether)
    .on("broadcast", { event: "care" }, ({ payload }) => onPartnerCare(payload))
    .on("broadcast", { event: "cuddle" }, ({ payload }) => onPartnerCuddle(payload))
    .on("broadcast", { event: "double" }, () => celebrateDoubleCuddle(false))
    .on("broadcast", { event: "mail" }, () => loadInbox())
    .subscribe(status => {
      if (status === "SUBSCRIBED") togetherChannel.track({ person: me, since: new Date().toISOString() });
    });
}

function updateTogether() {
  if (!togetherChannel || !currentPerson) return;
  const partner = Core.partnerOf(normalizePerson(currentPerson));
  const here = Object.keys(togetherChannel.presenceState() || {}).includes(partner);
  if (here === partnerHere) return;
  partnerHere = here;

  togetherBanner.textContent = `💞 ${partner} ist auch gerade bei Mochi`;
  togetherBanner.classList.toggle("hidden", !here);
  petCreature.classList.toggle("together", here);
  if (here && !sceneBusy()) {
    say(`Juhu, ${partner} ist auch da! 💞`);
    playOnce("hop", 700);
  }
}

function spawnPartnerParticle(emoji) {
  const particle = document.createElement("span");
  particle.className = "pet-heart-particle from-partner";
  particle.textContent = emoji;
  particle.style.setProperty("--drift", Math.round(-40 - Math.random() * 40) + "px");
  particle.style.left = 78 + Math.random() * 12 + "%";
  petHearts.appendChild(particle);
  setTimeout(() => particle.remove(), 1200);
}

const PARTNER_CARE_LINES = {
  pet: "{p} streichelt mich gerade! 🥰",
  cuddle: "{p} knuddelt mich! 🤗",
  feed: "{p} hat mir {food} gegeben 😋",
  shower: "{p} hat mich gebadet 🫧",
  dance: "Ich hab mit {p} getanzt! 💃",
  sport: "{p} macht Sport mit mir 🏃",
  coffee: "{p} hat mir Kaffee gemacht ☕",
  message: "Ich soll dir was von {p} bringen 💌",
  sleep: "{p} hat mich geweckt ☀️",
  stars: "{p} hat Sterne für mich gefangen ⭐",
  garden: "{p} kümmert sich um unseren Garten 🌱"
};

function onPartnerCare(payload) {
  if (!payload || !payload.person || payload.type === "cuddle") return;
  for (let i = 0; i < 3; i++) setTimeout(() => spawnPartnerParticle(randomOf(["💗", "💕", "✨"])), i * 140);
  const line = PARTNER_CARE_LINES[payload.type];
  if (line && !sceneBusy()) say(line.replace("{p}", payload.person).replace("{food}", payload.food || "etwas Leckeres"));
}

function onPartnerCuddle(payload) {
  partnerCuddleAt = Date.now();
  for (let i = 0; i < 4; i++) setTimeout(() => spawnPartnerParticle("💞"), i * 120);
  if (!sceneBusy()) say(`${(payload && payload.person) || "Dein Schatz"} knuddelt mich! Drück mich auch! 🤗`, 5200);
}

/* called on every long-press: whoever completes the pair within the window books the bonus */
function noteOwnCuddle() {
  const me = normalizePerson(currentPerson);
  ownCuddleAt = Date.now();
  broadcastTogether("cuddle", { person: me });
  if (partnerHere && ownCuddleAt - partnerCuddleAt < DOUBLE_CUDDLE_WINDOW_MS) {
    partnerCuddleAt = 0;
    completeDoubleCuddle();
  }
}

async function completeDoubleCuddle() {
  const result = await mutatePet(base => ({
    bond: 100,
    coins: (base.coins || 0) + DOUBLE_CUDDLE_COINS,
    total_coins_earned: (base.total_coins_earned || 0) + DOUBLE_CUDDLE_COINS,
    double_cuddles: (base.double_cuddles || 0) + 1
  }));
  if (!result) return;
  broadcastTogether("double", { person: normalizePerson(currentPerson) });
  celebrateDoubleCuddle(true);
  announceNewAchievements(result.previous, result.next);
}

function celebrateDoubleCuddle() {
  playOnce("double-hug", 1600);
  for (let i = 0; i < 10; i++) setTimeout(() => spawnHeart(true), i * 90);
  for (let i = 0; i < 4; i++) setTimeout(() => spawnPartnerParticle("💞"), i * 150);
  showToast(`Doppelknuddler! Ihr habt Mochi gleichzeitig gedrückt 💞 +${DOUBLE_CUDDLE_COINS} 🪙`, "success");
  say("Ich werde von euch BEIDEN geknuddelt!! 🥹💞", 5200);
  celebrate(30);
  vibrate([30, 50, 30, 50, 80]);
}
