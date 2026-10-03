const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const pushStatusText = document.getElementById("pushStatusText");
const enablePushBtn = document.getElementById("enablePushBtn");

const switches = document.querySelectorAll(".settings-switch");

const alicanteStartInput = document.getElementById("alicanteStartInput");
const alicanteEndInput = document.getElementById("alicanteEndInput");

const DEFAULT_SETTINGS = {
  letters_enabled: true,
  quest_enabled: true,
  battery_enabled: true,
  mochi_enabled: true
};

let currentPerson = localStorage.getItem("pw_person");
let currentSettings = { ...DEFAULT_SETTINGS };

function requirePerson() {
  if (currentPerson) return true;
  personModal.classList.remove("hidden");
  return false;
}

personButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentPerson = button.dataset.person;
    localStorage.setItem("pw_person", currentPerson);
    personModal.classList.add("hidden");
    loadSettings();
    refreshPushStatus();
  });
});

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

/* ---------- push status ---------- */

function refreshPushStatus() {
  const supported = "serviceWorker" in navigator && "PushManager" in window;
  const enabled = supported && localStorage.getItem("pw_push_enabled") === "true";

  if (!supported) {
    pushStatusText.textContent = "Push wird von diesem Browser nicht unterstützt.";
    pushStatusText.className = "settings-subtitle status-off";
    enablePushBtn.classList.add("hidden");
    return;
  }

  if (enabled) {
    pushStatusText.textContent = "Push-Benachrichtigungen sind aktiviert ✅";
    pushStatusText.className = "settings-subtitle status-on";
    enablePushBtn.classList.add("hidden");
  } else {
    pushStatusText.textContent = "Push-Benachrichtigungen sind noch nicht aktiviert.";
    pushStatusText.className = "settings-subtitle status-off";
    enablePushBtn.classList.remove("hidden");
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
