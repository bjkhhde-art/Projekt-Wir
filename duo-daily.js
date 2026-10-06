/* Frage des Tages: which question is today's, our flame streak and the time left today.
   Days run on German time (Isi in Spain shares it). Pure logic – used by duo.js and index.js
   (window.DuoDaily) and the node tests (module.exports). */
(function () {
  const PERSONS = ["Isi", "Benji"];
  const TZ = "Europe/Berlin";
  const DAY_MS = 86400000;
  /* our flame from LovBirdz before this page existed: 14 days in a row up to 5 Oct 2026, record 19 */
  const HISTORY = { record: 19, from: "2026-09-22", to: "2026-10-05" };

  function parts(date) {
    const out = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .forEach(p => { out[p.type] = p.value; });
    return out;
  }

  /* "2026-10-06" for any moment, as seen in Germany */
  function dayKey(date = new Date()) {
    const p = parts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }

  function dayNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
  }

  function shiftDay(key, days) {
    return new Date((dayNumber(key) + days) * DAY_MS).toISOString().slice(0, 10);
  }

  /* a fixed shuffled order of all questions: no repeats until every question was asked */
  function order(count) {
    const list = Array.from({ length: count }, (_, i) => i);
    let seed = 20261006;
    for (let i = list.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const j = seed % (i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function questionFor(key, questions) {
    const sequence = order(questions.length);
    const n = dayNumber(key);
    return questions[sequence[((n % questions.length) + questions.length) % questions.length]];
  }

  /* the carried-over days as if both of us had answered them */
  function historyRows(history = HISTORY) {
    const rows = [];
    for (let day = history.from; day <= history.to; day = shiftDay(day, 1)) {
      PERSONS.forEach(person => rows.push({ day, person, history: true }));
    }
    return rows;
  }

  /* rows: [{ day, person }] – a day counts when both of us answered.
     The flame stays alive until midnight if yesterday was complete and today is not yet.
     options.record: a record carried over from before (it only ever goes up). */
  function streakInfo(rows, today, options = {}) {
    const byDay = new Map();
    (rows || []).forEach(row => {
      if (!PERSONS.includes(row.person)) return;
      if (!byDay.has(row.day)) byDay.set(row.day, new Set());
      byDay.get(row.day).add(row.person);
    });
    const complete = key => byDay.has(key) && PERSONS.every(p => byDay.get(key).has(p));

    let current = 0;
    let cursor = complete(today) ? today : shiftDay(today, -1);
    while (complete(cursor)) {
      current++;
      cursor = shiftDay(cursor, -1);
    }

    let record = 0;
    let run = 0;
    let previous = null;
    [...byDay.keys()].filter(complete).sort().forEach(key => {
      run = previous && dayNumber(key) - dayNumber(previous) === 1 ? run + 1 : 1;
      record = Math.max(record, run);
      previous = key;
    });

    const lastSeven = Array.from({ length: 7 }, (_, i) => {
      const key = shiftDay(today, i - 6);
      const count = byDay.has(key) ? byDay.get(key).size : 0;
      return { day: key, status: count === 2 ? "done" : count === 1 ? "half" : "none" };
    });
    const answeredToday = PERSONS.filter(p => byDay.has(today) && byDay.get(today).has(p));

    return { current, record: Math.max(record, current, options.record || 0), lastSeven, answeredToday, doneToday: complete(today), atRisk: current > 0 && !complete(today) };
  }

  /* seconds until midnight in Germany */
  function secondsLeftToday(now = new Date()) {
    const p = parts(now);
    const elapsed = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
    return Math.max(0, 86400 - elapsed);
  }

  function formatCountdown(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0"));
  }

  function streakHeadline(info) {
    if (info.current === 0) return "Startet eure Flamme – beantwortet heute beide die Frage!";
    if (info.atRisk) return "Eure Flamme braucht euch heute noch! 🔥";
    if (info.current >= 7) return "Nichts kann euch aufhalten!";
    if (info.current >= 3) return "Ihr seid on fire!";
    return "Schön weitermachen – jeden Tag ein bisschen mehr wir.";
  }

  const api = { PERSONS, HISTORY, historyRows, dayKey, dayNumber, shiftDay, questionFor, streakInfo, secondsLeftToday, formatCountdown, streakHeadline };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.DuoDaily = api;
})();
