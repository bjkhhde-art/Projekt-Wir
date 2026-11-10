const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");
const devicePersonName = document.getElementById("devicePersonName");
const changePersonBtn = document.getElementById("changePersonBtn");

const pushStatusText = document.getElementById("pushStatusText");
const enablePushBtn = document.getElementById("enablePushBtn");

const switches = document.querySelectorAll(".settings-switch");

const alicanteStartInput = document.getElementById("alicanteStartInput");
const alicanteEndInput = document.getElementById("alicanteEndInput");

const DEFAULT_SETTINGS = {
  letters_enabled: true,
  quest_enabled: true,
  battery_enabled: true,
  mochi_enabled: true,
  games_enabled: true
};

let currentPerson = localStorage.getItem("pw_person");
let currentSettings = { ...DEFAULT_SETTINGS };

function requirePerson() {
  if (currentPerson) return true;
  personModal.classList.remove("hidden");
  return false;
}

function showDevicePerson() {
  devicePersonName.textContent = currentPerson ? normalizePerson(currentPerson) : "noch niemand";
}

personButtons.forEach(button => {
  button.addEventListener("click", async () => {
    const changed = currentPerson !== button.dataset.person;
    currentPerson = button.dataset.person;
    personModal.classList.add("hidden");
    showDevicePerson();
    await setDevicePerson(supabaseClient, currentPerson);
    loadSettings();
    refreshPushStatus();
    if (changed) showToast(`Dieses Handy gehört jetzt ${currentPerson} 💗`, "success");
  });
});

changePersonBtn.addEventListener("click", () => personModal.classList.remove("hidden"));
showDevicePerson();

if (!currentPerson) {
  personModal.classList.remove("hidden");
}

/* ---------- settings load + render ---------- */

function renderSettings() {
  switches.forEach(btn => {
    const field = btn.dataset.field;
    const on = currentSettings[field] !== false;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  });
}

async function loadSettings() {
  if (!currentPerson) return;

  const { data, error } = await supabaseClient
    .from("notification_settings")
    .select("*")
    .eq("person", currentPerson)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden der Einstellungen:", error);
    return;
  }

  currentSettings = data ? { ...DEFAULT_SETTINGS, ...data } : { ...DEFAULT_SETTINGS };
  renderSettings();
}

async function saveSettings(patch) {
  if (!requirePerson()) return false;

  const payload = { person: currentPerson, ...patch };

  const { error } = await supabaseClient
    .from("notification_settings")
    .upsert(payload, { onConflict: "person" });

  if (error) {
    console.error("Fehler beim Speichern der Einstellungen:", error);
    showToast("Einstellung konnte nicht gespeichert werden.", "error");
    return false;
  }

  Object.assign(currentSettings, patch);
  return true;
}

/* ---------- switches ---------- */

switches.forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!requirePerson()) return;

    const field = btn.dataset.field;
    const nextValue = !(currentSettings[field] !== false);

    btn.classList.toggle("on", nextValue);
    btn.setAttribute("aria-checked", String(nextValue));

    const success = await saveSettings({ [field]: nextValue });

    if (!success) {
      btn.classList.toggle("on", !nextValue);
      btn.setAttribute("aria-checked", String(!nextValue));
    }
  });
});

/* ---------- Alicante-Zeitraum (geteilt) ---------- */

async function loadAlicanteSettings() {
  const { data, error } = await supabaseClient
    .from("app_settings")
    .select("alicante_start, alicante_end")
    .eq("id", "shared")
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden des Alicante-Zeitraums:", error);
    return;
  }

  if (data) {
    alicanteStartInput.value = data.alicante_start || "";
    alicanteEndInput.value = data.alicante_end || "";
  }
}

async function saveAlicanteSettings(patch) {
  const { error } = await supabaseClient
    .from("app_settings")
    .upsert({ id: "shared", ...patch }, { onConflict: "id" });

  if (error) {
    console.error("Fehler beim Speichern des Alicante-Zeitraums:", error);
    showToast("Datum konnte nicht gespeichert werden.", "error");
    return;
  }

  showToast("Alicante-Zeitraum gespeichert 💾", "success");
}

alicanteStartInput.addEventListener("change", () => {
  if (!alicanteStartInput.value) return;
  saveAlicanteSettings({ alicante_start: alicanteStartInput.value });
});

alicanteEndInput.addEventListener("change", () => {
  if (!alicanteEndInput.value) return;
  saveAlicanteSettings({ alicante_end: alicanteEndInput.value });
});

/* ---------- names of the computer players (shared) ---------- */

const botNameInputs = document.querySelectorAll(".bot-name-input");

function showBotNames(names) {
  botNameInputs.forEach(input => {
    input.value = names[input.dataset.bot] || "";
  });
}

async function saveBotName(input) {
  const id = input.dataset.bot;
  const name = BotNames.clean(input.value);
  const wanted = BotNames.all();
  if (name && name !== id) wanted[id] = name;
  else delete wanted[id];
  const problem = BotNames.problem(id, name, wanted);
  if (problem) {
    showToast(problem, "error");
    showBotNames(BotNames.all());
    return;
  }
  try {
    const saved = await BotNames.save(supabaseClient, wanted);
    showBotNames(saved);
    showToast(name && name !== id ? `${id} heißt jetzt ${name} 🤖` : `${id} heißt wieder ${id} 🤖`, "success");
  } catch (error) {
    console.error("Fehler beim Speichern der Namen:", error);
    showToast("Name konnte nicht gespeichert werden.", "error");
    showBotNames(BotNames.all());
  }
}

botNameInputs.forEach(input => {
  input.addEventListener("change", () => saveBotName(input));
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") input.blur();
  });
});

showBotNames(BotNames.all());
BotNames.load(supabaseClient).then(showBotNames);

/* ---------- push status ---------- */

async function refreshPushStatus() {
  const supported = "serviceWorker" in navigator && "PushManager" in window;

  if (!supported) {
    pushStatusText.textContent = "Push wird von diesem Browser nicht unterstützt.";
    pushStatusText.className = "settings-subtitle status-off";
    enablePushBtn.classList.add("hidden");
    return;
  }

  /* the phone itself says whether push still works – not only what was remembered when turning it on */
  const enabled = await pushIsActive();
  const wasOn = localStorage.getItem("pw_push_enabled") === "true";
  if (!enabled && wasOn) localStorage.removeItem("pw_push_enabled");
  const blocked = "Notification" in window && Notification.permission === "denied";

  if (enabled) {
    pushStatusText.textContent = "Push-Benachrichtigungen sind aktiviert ✅";
    pushStatusText.className = "settings-subtitle status-on";
    enablePushBtn.classList.add("hidden");
  } else {
    pushStatusText.textContent = blocked
      ? "Benachrichtigungen sind für diese Seite blockiert – in den Browser- bzw. Handy-Einstellungen wieder erlauben."
      : wasOn
        ? "Push ist auf diesem Handy nicht mehr aktiv – bitte nochmal aktivieren."
        : "Push-Benachrichtigungen sind noch nicht aktiviert.";
    pushStatusText.className = "settings-subtitle status-off";
    enablePushBtn.classList.toggle("hidden", blocked);
  }
}

enablePushBtn.addEventListener("click", async () => {
  if (!requirePerson()) return;

  enablePushBtn.disabled = true;

  try {
    await subscribeToPush(supabaseClient, currentPerson);
    showToast("Push-Benachrichtigungen aktiviert 🔔", "success");
    refreshPushStatus();
  } catch (error) {
    console.error("Fehler beim Aktivieren von Push:", error);
    showToast("Push-Benachrichtigungen konnten nicht aktiviert werden.", "error");
  } finally {
    enablePushBtn.disabled = false;
  }
});

renderSettings();
refreshPushStatus();
loadSettings();
loadAlicanteSettings();

/* ---------- Darstellung (pro Gerät) ---------- */

const themeOptions = document.querySelectorAll(".theme-option");

function renderTheme() {
  const theme = window.PwTheme.get();
  themeOptions.forEach(option => {
    option.setAttribute("aria-checked", String(option.dataset.themeOption === theme));
  });
}

themeOptions.forEach(option => {
  option.addEventListener("click", () => {
    window.PwTheme.set(option.dataset.themeOption);
    renderTheme();
  });
});
renderTheme();

/* ---------- install as an app ---------- */

const installText = document.getElementById("installText");
const installBtn = document.getElementById("installBtn");
const installSteps = document.getElementById("installSteps");

function renderInstall() {
  if (window.PwInstall.isInstalled()) {
    installText.textContent = "✓ Projekt Wir läuft gerade als installierte App.";
    installBtn.classList.add("hidden");
    installSteps.classList.add("hidden");
    return;
  }
  const canPrompt = Boolean(window.PwInstall.prompt);
  installBtn.classList.toggle("hidden", !canPrompt);
  /* without the browser's dialog (or before it is ready) the menu steps help */
  installSteps.classList.toggle("hidden", canPrompt);
}

installBtn.addEventListener("click", async () => {
  const accepted = await window.PwInstall.install();
  if (accepted) showToast("Projekt Wir ist jetzt auf dem Startbildschirm 📲", "success");
  renderInstall();
});
document.addEventListener("pw:install-changed", renderInstall);
renderInstall();

/* ---------- sign out (this phone only) ---------- */

document.getElementById("signOutBtn").addEventListener("click", async () => {
  const confirmed = await confirmDialog("Dieses Handy wird abgemeldet. Zum Wiederkommen braucht ihr das Passwort.", "Abmelden");
  if (!confirmed) return;
  window.PW_SIGNING_OUT = true;
  /* "local": the shared login stays valid on the other phone (the default would sign out everywhere) */
  const { error } = await supabaseClient.auth.signOut({ scope: "local" });
  if (error) console.error("Abmelden:", error);
  /* the copy of our dates is for signed-in phones only */
  PwMilestones.forget();
  location.replace("index.html");
});
