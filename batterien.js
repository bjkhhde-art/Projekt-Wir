const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PEOPLE = [
  { person: "Isi G", slug: "isi-g" },
  { person: "Benji", slug: "benji" }
];

const levels = {};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function gradientForLevel(level) {
  if (level <= 20) return "linear-gradient(180deg, #f87171, var(--danger))";
  if (level <= 45) return "linear-gradient(180deg, #fbbf24, var(--warning))";
  if (level <= 75) return "var(--gradient-warm)";
  return "var(--gradient-brand)";
}

function emojiForLevel(level) {
  if (level <= 15) return "😴";
  if (level <= 35) return "😐";
  if (level <= 55) return "🙂";
  if (level <= 75) return "😊";
  if (level <= 94) return "🥰";
  return "🤩";
}

function statusForLevel(level) {
  if (level <= 15) return "Akku leer – Zeit zum Kuscheln!";
  if (level <= 35) return "Braucht bald Kuscheleinheiten";
  if (level <= 55) return "Bereit zum Kuscheln";
  if (level <= 75) return "Fühlt sich schon kuschelig";
  if (level <= 94) return "Fast randvoll mit Liebe";
  return "Voll aufgeladen 💗";
}

function triggerSpark(shell) {
  const spark = shell.querySelector(".battery-spark");
  spark.classList.remove("hidden", "pop");
  void spark.offsetWidth;
  spark.classList.add("pop");
}

const extremeFlags = {};

function renderLevel(config, level) {
  const rounded = Math.round(clamp(level, 0, 100));
  const shell = document.getElementById(`battery-${config.slug}`);
  const fill = shell.querySelector(".battery-fill");
  const percentEl = document.getElementById(`percent-${config.slug}`);
  const emojiEl = document.getElementById(`emoji-${config.slug}`);
  const statusEl = document.getElementById(`status-${config.slug}`);

  fill.style.height = rounded + "%";
  fill.style.background = gradientForLevel(rounded);
  percentEl.textContent = rounded + "%";
  emojiEl.textContent = emojiForLevel(rounded);
  statusEl.textContent = statusForLevel(rounded);

  const flags = extremeFlags[config.person] || (extremeFlags[config.person] = { wasFull: false, wasEmpty: false });
  let firedBigVibration = false;

  if (rounded >= 100) {
    shell.classList.add("full");
    if (!flags.wasFull) {
      triggerSpark(shell);
      celebrate(10);
      vibrate([15, 40, 15]);
      firedBigVibration = true;
    }
    flags.wasFull = true;
  } else {
    shell.classList.remove("full");
    flags.wasFull = false;
  }

  if (rounded <= 0) {
    if (!flags.wasEmpty) {
      vibrate([10, 30, 10]);
      firedBigVibration = true;
    }
    flags.wasEmpty = true;
  } else {
    flags.wasEmpty = false;
  }

  return firedBigVibration;
}

async function saveLevel(person, level) {
  const { error } = await supabaseClient
    .from("cuddle_batteries")
    .update({ level, updated_at: new Date().toISOString() })
    .eq("person", person);

  if (error) {
    console.error("Fehler beim Speichern:", error);
    showToast("Akku-Stand konnte nicht gespeichert werden.", "error");
  }
}

async function loadLevels() {
  const { data, error } = await supabaseClient
    .from("cuddle_batteries")
    .select("*");

  if (error) {
    console.error("Fehler beim Laden:", error);
    showToast("Kuschelbatterien konnten nicht geladen werden.", "error");
    return;
  }

  data.forEach(row => {
    levels[row.person] = row.level;
    const config = PEOPLE.find(p => p.person === row.person);
    if (config) renderLevel(config, row.level);
  });
}

function attachDrag(config) {
  const shell = document.getElementById(`battery-${config.slug}`);
  const unit = shell.closest(".battery-unit");

  let dragging = false;
  let startY = 0;
  let startLevel = levels[config.person] || 50;
  let liveLevel = startLevel;
  let lastTickDecile = Math.floor(startLevel / 10);

  shell.addEventListener("pointerdown", event => {
    dragging = true;
    shell.setPointerCapture(event.pointerId);
    startY = event.clientY;
    startLevel = levels[config.person] ?? 50;
    liveLevel = startLevel;
    lastTickDecile = Math.floor(startLevel / 10);
    unit.classList.add("dragging");
    shell.classList.add("dragging");
    vibrate(8);
  });

  shell.addEventListener("pointermove", event => {
    if (!dragging) return;

    const deltaY = startY - event.clientY;
    const range = shell.clientHeight;
    const deltaPercent = (deltaY / range) * 100;

    liveLevel = clamp(startLevel + deltaPercent, 0, 100);
    const firedBig = renderLevel(config, liveLevel);

    const rounded = Math.round(liveLevel);
    const decile = Math.floor(rounded / 10);
    if (decile !== lastTickDecile) {
      lastTickDecile = decile;
      if (!firedBig) {
        vibrate(rounded === 0 || rounded === 100 ? 12 : 6);
      }
    }
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    unit.classList.remove("dragging");
    shell.classList.remove("dragging");

    const finalLevel = Math.round(liveLevel);
    renderLevel(config, finalLevel);

    if (finalLevel !== startLevel) {
      levels[config.person] = finalLevel;
      saveLevel(config.person, finalLevel);
      vibrate(10);
    }
  }

  shell.addEventListener("pointerup", endDrag);
  shell.addEventListener("pointercancel", endDrag);
}

PEOPLE.forEach(attachDrag);
loadLevels();

supabaseClient
  .channel("cuddle_batteries_changes")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "cuddle_batteries" },
    payload => {
      const row = payload.new;
      const config = PEOPLE.find(p => p.person === row.person);
      if (!config) return;

      const shell = document.getElementById(`battery-${config.slug}`);
      if (shell.classList.contains("dragging")) return;

      levels[row.person] = row.level;
      renderLevel(config, row.level);
    }
  )
  .subscribe();
