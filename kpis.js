const firstMeeting = {
  date: "2025-11-27",
  place: "Prof's Night (Park Theater Kempten)"
};

const anniversary = {
  date: "2026-01-05",
  place: "Botanischer Garten Hamburg Nienstedten"
};

const firstDate = {
  date: "2025-12-01",
  place: "Weihnachtsmarkt Kempten"
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("de-DE");
}

function calculateDaysTogether(startDate) {
  const start = new Date(startDate);
  const today = new Date();

  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = today - start;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
