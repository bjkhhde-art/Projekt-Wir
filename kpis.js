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

const setText = (id, text) => { document.getElementById(id).textContent = text; };

function renderMilestones(milestones) {
  if (!milestones) {
    ["daysTogether", "nextAnniversaryCountdown"].forEach(id => setText(id, "–"));
    return;
  }
  const { firstMeeting = {}, firstDate = {}, anniversary } = milestones;

  setText("firstMeetingDate", formatDate(firstMeeting.date));
  setText("firstMeetingPlace", firstMeeting.place || "");
  setText("firstDateDate", formatDate(firstDate.date));
  setText("firstDatePlace", firstDate.place || "");
  setText("anniversaryDate", formatDate(anniversary.date));
  setText("anniversaryPlace", anniversary.place || "");
  setText("daysTogether", daysBetween(anniversary.date) + " Tage");

  const nextAnniv = nextAnniversaryDate(anniversary.date);
  const daysUntilNext = daysBetween(new Date(), nextAnniv);
  setText("nextAnniversaryCountdown", daysUntilNext === 0 ? "Heute! 🎉" : daysUntilNext + " Tage");
  setText("nextAnniversaryDate", nextAnniv.toLocaleDateString("de-DE"));
}

/* the phone's copy at once, then the fresh one */
const cachedMilestones = PwMilestones.cached();
if (cachedMilestones) renderMilestones(cachedMilestones);
PwMilestones.load(supabaseClient).then(fresh => {
  if (fresh || !cachedMilestones) renderMilestones(fresh);
});

/* ---------- "Wie lange noch bis …": next trip, Isi back from Alicante ---------- */

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

  const alicanteEnd = settingsResult.data && settingsResult.data.alicante_end;
  const daysUntilBack = alicanteEnd ? daysBetween(new Date(), alicanteEnd + "T00:00:00") : -1;
  if (daysUntilBack >= 0) {
    rows.push(countdownRow({
      icon: "🏠",
      title: "Isi ist wieder in Deutschland",
      sub: formatDate(alicanteEnd + "T00:00:00"),
      days: daysUntilBack,
      href: "reise.html"
    }));
  }

  kpiCountdowns.innerHTML = rows.join("");
}

loadCountdowns();
