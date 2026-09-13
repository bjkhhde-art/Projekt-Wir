const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const personModal = document.getElementById("personModal");
const personButtons = document.querySelectorAll(".person-choice-btn");

const pushStatusText = document.getElementById("pushStatusText");
const enablePushBtn = document.getElementById("enablePushBtn");

const switches = document.querySelectorAll(".settings-switch");
const dailyTimeRow = document.getElementById("dailyTimeRow");
const weeklyTimeRow = document.getElementById("weeklyTimeRow");
const dailyReminderTime = document.getElementById("dailyReminderTime");
const weeklyReminderTime = document.getElementById("weeklyReminderTime");

const DEFAULT_SETTINGS = {
  letters_enabled: true,
  quest_enabled: true,
  battery_enabled: true,
  mochi_enabled: true,
  daily_reflection_enabled: true,
  weekly_reflection_enabled: true,
  daily_reminder_time: "18:00",
  weekly_reminder_time: "18:00"
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

/* ---------- time select options ---------- */

function populateTimeSelect(select) {
  select.innerHTML = "";
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
  }
}

populateTimeSelect(dailyReminderTime);
populateTimeSelect(weeklyReminderTime);

/* ---------- settings load + render ---------- */

function normalizeTime(value) {
  if (!value) return "18:00";
  return value.slice(0, 5);
}

function renderSettings() {
  switches.forEach(btn => {
    const field = btn.dataset.field;
    const on = currentSettings[field] !== false;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", String(on));
  });

  dailyReminderTime.value = normalizeTime(currentSettings.daily_reminder_time);
  weeklyReminderTime.value = normalizeTime(currentSettings.weekly_reminder_time);

  dailyTimeRow.classList.toggle("hidden", currentSettings.daily_reflection_enabled === false);
  weeklyTimeRow.classList.toggle("hidden", currentSettings.weekly_reflection_enabled === false);
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

    if (field === "daily_reflection_enabled") {
      dailyTimeRow.classList.toggle("hidden", !nextValue);
    }
    if (field === "weekly_reflection_enabled") {
      weeklyTimeRow.classList.toggle("hidden", !nextValue);
    }

    const success = await saveSettings({ [field]: nextValue });

    if (!success) {
      btn.classList.toggle("on", !nextValue);
      btn.setAttribute("aria-checked", String(!nextValue));
      if (field === "daily_reflection_enabled") {
        dailyTimeRow.classList.toggle("hidden", nextValue);
      }
      if (field === "weekly_reflection_enabled") {
        weeklyTimeRow.classList.toggle("hidden", nextValue);
      }
    }
  });
});

dailyReminderTime.addEventListener("change", () => {
  saveSettings({ daily_reminder_time: dailyReminderTime.value });
});

weeklyReminderTime.addEventListener("change", () => {
  saveSettings({ weekly_reminder_time: weeklyReminderTime.value });
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
