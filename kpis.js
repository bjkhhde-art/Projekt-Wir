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
  formatDate(nextAnniv.toISOString().slice(0, 10));

document.querySelectorAll(".flip-card").forEach(card => {
  card.addEventListener("click", () => {
    card.classList.toggle("flipped");
  });
});
