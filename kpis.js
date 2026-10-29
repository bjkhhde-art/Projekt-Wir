const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const { firstMeeting, firstDate, anniversary } = MILESTONES;

function calculateDaysTogether(startDate) {
  return daysBetween(startDate);
}

function nextAnniversaryDate(startDate) {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  next.setHours(0, 0, 0, 0);

  if (next < today) {
    next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
  }

  return next;
}

document.getElementById("firstMeetingDate").textContent =
  formatDate(firstMeeting.date);

document.getElementById("firstMeetingPlace").textContent =
  firstMeeting.place;

document.getElementById("anniversaryDate").textContent =
  formatDate(anniversary.date);

document.getElementById("anniversaryPlace").textContent =
  anniversary.place;

document.getElementById("daysTogether").textContent =
  calculateDaysTogether(anniversary.date) + " Tage";

document.getElementById("firstDateDate").textContent =
  formatDate(firstDate.date);

document.getElementById("firstDatePlace").textContent =
  firstDate.place;

const nextAnniv = nextAnniversaryDate(anniversary.date);
const daysUntilNext = daysBetween(new Date(), nextAnniv);

document.getElementById("nextAnniversaryCountdown").textContent =
  daysUntilNext === 0 ? "Heute! 🎉" : daysUntilNext + " Tage";

document.getElementById("nextAnniversaryDate").textContent =
  nextAnniv.toLocaleDateString("de-DE");

/* ---------- "Wie lange noch bis …": next trip, Isi back from Alicante ---------- */

const DEFAULT_ALICANTE_END = "2027-01-24";
const kpiCountdowns = document.getElementById("kpiCountdowns");

function daysLabel(days) {
  if (days === 0) return "Heute! 🎉";
  return `${days} Tag${days === 1 ? "" : "e"}`;
}

function countdownRow({ icon, title, sub, days, href }) {
  return `
    <a class="kpi-countdown-row card card-hover" href="${escapeHtml(href)}">
      <span class="kpi-countdown-icon" aria-hidden="true">${icon}</span>
      <span class="kpi-countdown-text">
        <span class="kpi-countdown-title">${escapeHtml(title)}</span>
        <span class="kpi-countdown-sub">${escapeHtml(sub)}</span>
      </span>
      <span class="kpi-countdown-days">${escapeHtml(daysLabel(days))}</span>
    </a>`;
}

async function loadCountdowns() {
  const [tripsResult, settingsResult] = await Promise.all([
    supabaseClient.from("trips").select("id, title, location, start_date").order("start_date", { ascending: true }),
    supabaseClient.from("app_settings").select("alicante_end").eq("id", "shared").maybeSingle()
  ]);

  if (tripsResult.error) console.error("Fehler beim Laden der Reisen:", tripsResult.error);
  if (settingsResult.error) console.error("Fehler beim Laden der Alicante-Daten:", settingsResult.error);

  const rows = [];

  const nextTrip = (tripsResult.data || []).find(trip => trip.start_date && daysBetween(new Date(), trip.start_date) >= 0);
  if (nextTrip) {
    rows.push(countdownRow({
      icon: "✈️",
      title: `Unsere nächste Reise: ${nextTrip.title}`,
      sub: [nextTrip.location, formatDate(nextTrip.start_date)].filter(Boolean).join(" · "),
      days: daysBetween(new Date(), nextTrip.start_date),
      href: "reise.html?tab=kommend"
    }));
  } else {
    rows.push(`
      <a class="kpi-countdown-row card card-hover" href="reise.html?tab=kommend">
        <span class="kpi-countdown-icon" aria-hidden="true">✈️</span>
        <span class="kpi-countdown-text">
          <span class="kpi-countdown-title">Unsere nächste Reise</span>
          <span class="kpi-countdown-sub">Noch nichts geplant, wir tragen die nächste ein</span>
        </span>
      </a>`);
  }

  const alicanteEnd = (settingsResult.data && settingsResult.data.alicante_end) || DEFAULT_ALICANTE_END;
  const daysUntilBack = daysBetween(new Date(), alicanteEnd + "T00:00:00");
  if (daysUntilBack >= 0) {
    rows.push(countdownRow({
      icon: "🏠",
      title: "Isi ist wieder in Deutschland",
      sub: formatDate(alicanteEnd + "T00:00:00"),
      days: daysUntilBack,
      href: "reise.html?tab=vergleich"
    }));
  }

  kpiCountdowns.innerHTML = rows.join("");
}

loadCountdowns();

document.querySelectorAll(".flip-card").forEach(card => {
  card.addEventListener("click", () => {
    card.classList.toggle("flipped");
  });
});
