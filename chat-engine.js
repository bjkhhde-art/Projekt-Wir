/* Chat-Wrapped: reads a WhatsApp export and turns it into numbers, awards, quotes and quiz rounds.
   Pure functions without DOM or storage – used by chat.js (window.ChatEngine) and the node tests.
   The chat never leaves the device: everything here runs in the browser. */
(function () {
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  /* a pause this long ends a conversation; the next message starts a new one */
  const CONVERSATION_GAP = 6 * HOUR;

  const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const MONTHS_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  /* ---------- reading the export ---------- */

  /* Android: "27.11.25, 21:34 - Name: Text"   iOS: "[27.11.25, 21:34:12] Name: Text"
     (US exports: "1/5/26, 9:34 PM - …"; iOS puts invisible direction marks in front of lines) */
  const HEADER = /^[‎‏‪-‮]*\[?(\d{1,2})([./])(\d{1,2})[./](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?\]?\s*(?:-\s*)?(.*)$/;
  const INVISIBLE = /[‎‏‪-‮]/g;

  const DELETED = /^(diese nachricht wurde gelöscht\.?|du hast diese nachricht gelöscht\.?|this message was deleted\.?|you deleted this message\.?)$/i;
  const MEDIA_KINDS = [
    ["image", /^(<?(bild|image|foto|photo)n? (weggelassen|omitted|ausgeschlossen)>?|<angehängt:.*(photo|img|\.jpe?g|\.png|\.heic).*>|.*\.(jpe?g|png|heic)( \(datei angehängt\))?)$/i],
    ["video", /^(<?video (weggelassen|omitted|ausgeschlossen)>?|<angehängt:.*(video|vid-|\.mp4|\.mov).*>|.*\.(mp4|mov)( \(datei angehängt\))?)$/i],
    ["audio", /^(<?(audio|sprachnachricht|voice message)n? (weggelassen|omitted|ausgeschlossen)>?|<angehängt:.*(audio|ptt|\.opus|\.m4a|\.aac).*>|.*\.(opus|m4a|aac)( \(datei angehängt\))?)$/i],
    ["sticker", /^(<?sticker (weggelassen|omitted|ausgeschlossen)>?|<angehängt:.*(sticker|\.webp).*>|.*\.webp( \(datei angehängt\))?)$/i],
    ["gif", /^<?gif (weggelassen|omitted|ausgeschlossen)>?$/i],
    ["doc", /^(<?(dokument|document|kontakt|contact)(karte)? (weggelassen|omitted|ausgeschlossen)>?|<angehängt:.*>|.* \(datei angehängt\))$/i],
    ["media", /^<?(medien|media) (ausgeschlossen|weggelassen|omitted)>?$/i]
  ];

  function classify(text) {
    const clean = text.replace(INVISIBLE, "").replace(/\s*<(diese nachricht wurde bearbeitet|this message was edited)>$/i, "").trim();
    if (DELETED.test(clean)) return { kind: "deleted", text: "" };
    for (const [kind, pattern] of MEDIA_KINDS) {
      if (pattern.test(clean)) return { kind, text: "" };
    }
    return { kind: "text", text: clean };
  }

  function buildDate(a, separator, b, yearText, hour, minute, second, meridiem) {
    let day = a;
    let month = b;
    /* "5/1/26" is January 5th in US exports; "27/11/25" can only be day first */
    if (separator === "/" && a <= 12) { day = b; month = a; }
    let year = Number(yearText);
    if (yearText.length <= 2) year += 2000;
    let h = hour;
    if (meridiem) {
      const pm = /^p/i.test(meridiem);
      h = (h % 12) + (pm ? 12 : 0);
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || h > 23 || minute > 59) return NaN;
    return new Date(year, month - 1, day, h, minute, second || 0).getTime();
  }

  /* lines → [{ t, a: author, x: text, k: kind }]; system lines (no author) are dropped */
  function parseChat(raw) {
    const lines = String(raw || "").replace(/^﻿/, "").split(/\r?\n/);
    const messages = [];
    let current = null;

    const flush = () => {
      if (!current) return;
      const result = classify(current.x);
      current.x = result.text;
      current.k = result.kind;
      if (current.x || current.k !== "text") messages.push(current);
      current = null;
    };

    for (const line of lines) {
      const match = HEADER.exec(line);
      const t = match ? buildDate(Number(match[1]), match[2], Number(match[3]), match[4], Number(match[5]), Number(match[6]), Number(match[7] || 0), match[8]) : NaN;

      if (match && !Number.isNaN(t)) {
        flush();
        const rest = match[9];
        const split = rest.indexOf(": ");
        const author = split > 0 ? rest.slice(0, split).replace(INVISIBLE, "").trim() : "";
        /* "Anna: Hallo" is a message; "Anna hat die Gruppe verlassen" or a long sentence with a colon is not */
        if (author && author.length <= 40) current = { t, a: author, x: rest.slice(split + 2), k: "text" };
      } else if (current) {
        current.x += "\n" + line;
      }
    }
    flush();
    return messages;
  }

  /* keeps the two people who write the most (a partner chat has exactly two) */
  function prepare(messages) {
    const counts = new Map();
    for (const m of messages) counts.set(m.a, (counts.get(m.a) || 0) + 1);
    const names = Array.from(counts.entries()).sort((x, y) => y[1] - x[1]).slice(0, 2).map(entry => entry[0]);
    if (names.length < 2) return null;
    /* the one who wrote first is "A" – stable, no matter who writes more */
    const sorted = messages.filter(m => names.includes(m.a)).sort((x, y) => x.t - y.t);
    const ordered = sorted[0].a === names[0] ? names : [names[1], names[0]];
    return {
      names: ordered,
      msgs: sorted.map(m => ({ t: m.t, a: ordered.indexOf(m.a), x: m.x, k: m.k }))
    };
  }

  /* ---------- text helpers ---------- */

  const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;
  const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;

  const wordsOf = text => (text.replace(URL_PATTERN, " ").toLowerCase().match(/[\p{L}\p{N}']+/gu) || []).map(w => w.replace(/^'+|'+$/g, "")).filter(Boolean);

  const dayKey = t => {
    const d = new Date(t);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const monthKey = t => dayKey(t).slice(0, 7);
  const weekdayOf = t => (new Date(t).getDay() + 6) % 7;

  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function top(map, count) {
    return Array.from(map.entries()).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, count);
  }

  /* things people say a lot – only those that really occur are shown */
  const PHRASES = [
    { key: "love", icon: "💗", label: "„Ich liebe dich“", pattern: /\b(?:ich )?liebe dich\b/gi },
    { key: "miss", icon: "🥺", label: "„Vermisse dich“", pattern: /\b(?:ich )?vermiss(?:e)? dich\b/gi },
    { key: "schatz", icon: "🍯", label: "„Schatz“", pattern: /\bschatz(?:i|ii|l|erl)?\b/gi },
    { key: "morning", icon: "☀️", label: "„Guten Morgen“", pattern: /\bguten morgen\b|\bmoin\b/gi },
    { key: "night", icon: "🌙", label: "„Gute Nacht“", pattern: /\bgute nacht\b|\bgn8\b|\bschlaf gut\b/gi },
    { key: "hunger", icon: "🍕", label: "„Hunger“", pattern: /\bhunger\b|\bhungrig\b/gi },
    { key: "arriving", icon: "🚗", label: "„Gleich da“", pattern: /\bgleich da\b|\bbin gleich\b|\bbin unterwegs\b|\bbin auf dem weg\b/gi },
    { key: "laugh", icon: "😂", label: "Gelacht (haha, hihi, 😂)", pattern: /\b(?:ha){2,}h?\b|\bhi(?:hi)+\b|\blol\b|\bxd\b|😂|🤣/gi },
    { key: "thanks", icon: "🙏", label: "„Danke“", pattern: /\bdanke(?:schön)?\b/gi },
    { key: "sorry", icon: "🙇", label: "„Sorry“", pattern: /\bsorry\b|\bentschuldigung\b|\btut mir leid\b/gi }
  ];

  const STOPWORDS = new Set(("aber alle allem allen aller alles also auch auf aus bei bin bis bist dann das dass dein deine deinem deinen deiner dem den denn der des die dir doch dort du durch ein eine einem einen einer eines einfach er es etwas euch euer für gar gegen gerade gibt geht gut habe haben hab hat hatte hätte hast her hier hin hinter ich ihm ihn ihr ihre im in ist ja jetzt kann kannst kein keine können könnte machen mach macht mal man mehr mein meine meinem meinen meiner mich mir mit muss musst müssen nach nein nee nicht nichts noch nun nur ob oder ohne okay ok sehr sein seine sich sie sind so soll sollen sollte sonst über um und uns unser unsere von vor war waren warst was weil weiss weiß wenn werden wie wieder will willst wir wird wirst wo wollen wollte wurde würde würden zu zum zur zwar the and you that this with have not are but for what").split(" "));

  /* ---------- the numbers ---------- */

  function emptyPerson() {
    return {
      messages: 0, words: 0, chars: 0, questions: 0, deleted: 0,
      media: { image: 0, video: 0, audio: 0, sticker: 0, gif: 0, doc: 0, media: 0 },
      lateNight: 0, early: 0, starts: 0, maxStreak: 0, longest: null, laughs: 0
    };
  }

  function computeStats(data) {
    const msgs = data.msgs;
    const people = [emptyPerson(), emptyPerson()];
    const perMonth = new Map();
    const perDay = new Map();
    const perHour = [new Array(24).fill(0), new Array(24).fill(0)];
    const perWeekday = new Array(7).fill(0);
    const emojis = [new Map(), new Map()];
    const replyMinutes = [[], []];
    const phraseCounts = PHRASES.map(() => [0, 0]);
    let streak = 0;
    let streakAuthor = -1;
    let longestSilence = null;

    msgs.forEach((m, i) => {
      const p = people[m.a];
      const prev = msgs[i - 1];
      p.messages++;
      if (m.k === "deleted") p.deleted++;
      else if (m.k !== "text") p.media[m.k]++;

      const hour = new Date(m.t).getHours();
      perHour[m.a][hour]++;
      perWeekday[weekdayOf(m.t)]++;
      if (hour < 5) p.lateNight++;
      else if (hour < 9) p.early++;

      const month = monthKey(m.t);
      if (!perMonth.has(month)) perMonth.set(month, [0, 0]);
      perMonth.get(month)[m.a]++;
      perDay.set(dayKey(m.t), (perDay.get(dayKey(m.t)) || 0) + 1);

      if (streakAuthor === m.a) streak++;
      else { streakAuthor = m.a; streak = 1; }
      if (streak > p.maxStreak) p.maxStreak = streak;

      if (prev) {
        const gap = m.t - prev.t;
        if (gap >= CONVERSATION_GAP) p.starts++;
        if (!longestSilence || gap > longestSilence.gap) longestSilence = { gap, from: prev.t, to: m.t, breaker: m.a };
        if (prev.a !== m.a && gap < CONVERSATION_GAP) replyMinutes[m.a].push(gap / 60000);
      } else {
        p.starts++;
      }

      if (m.k !== "text") return;
      const words = wordsOf(m.x);
      p.words += words.length;
      p.chars += m.x.length;
      p.questions += (m.x.match(/\?/g) || []).length;
      if (!p.longest || words.length > p.longest.words) p.longest = { words: words.length, text: m.x, t: m.t };
      for (const e of m.x.match(EMOJI) || []) emojis[m.a].set(e, (emojis[m.a].get(e) || 0) + 1);
      PHRASES.forEach((phrase, index) => {
        const found = m.x.match(phrase.pattern);
        if (found) phraseCounts[index][m.a] += found.length;
      });
    });

    people.forEach((p, i) => {
      p.replyMedian = median(replyMinutes[i]);
      p.avgWords = p.messages ? p.words / Math.max(1, p.messages - p.deleted - Object.values(p.media).reduce((a, b) => a + b, 0)) : 0;
    });

    /* every month between the first and the last message, also the silent ones */
    const months = [];
    const first = new Date(msgs[0].t);
    const last = new Date(msgs[msgs.length - 1].t);
    for (let y = first.getFullYear(), m = first.getMonth(); y < last.getFullYear() || (y === last.getFullYear() && m <= last.getMonth()); m++) {
      if (m > 11) { m = 0; y++; }
      const key = y + "-" + String(m + 1).padStart(2, "0");
      const counts = perMonth.get(key) || [0, 0];
      months.push({ key, label: MONTHS[m] + (m === 0 || !months.length ? " " + String(y).slice(2) : ""), year: y, month: m, counts, total: counts[0] + counts[1] });
      if (y === last.getFullYear() && m === last.getMonth()) break;
    }

    const days = Array.from(perDay.keys()).sort();
    let bestRun = { length: 0, from: null, to: null };
    let run = { length: 0, from: null, to: null };
    for (const key of days) {
      const [y, mo, d] = key.split("-").map(Number);
      const dateMs = new Date(y, mo - 1, d, 12).getTime();
      if (run.length && Math.round((dateMs - run.lastMs) / DAY) === 1) { run.length++; run.to = dateMs; }
      else run = { length: 1, from: dateMs, to: dateMs };
      run.lastMs = dateMs;
      if (run.length > bestRun.length) bestRun = { length: run.length, from: run.from, to: run.to };
    }

    const busiest = top(perDay, 1)[0];
    const busiestMonth = months.slice().sort((x, y) => y.total - x.total)[0];
    const totalEmojis = new Map();
    for (const map of emojis) for (const [e, n] of map) totalEmojis.set(e, (totalEmojis.get(e) || 0) + n);

    return {
      total: msgs.length,
      first: msgs[0].t,
      last: msgs[msgs.length - 1].t,
      spanDays: Math.max(1, Math.round((msgs[msgs.length - 1].t - msgs[0].t) / DAY) + 1),
      activeDays: perDay.size,
      people,
      months,
      busiestMonth,
      busiestDay: busiest ? { key: busiest[0], count: busiest[1] } : null,
      longestSilence,
      dayStreak: bestRun,
      perHour,
      perWeekday,
      peakHour: perHour[0].map((n, h) => n + perHour[1][h]).reduce((best, n, h, all) => (n > all[best] ? h : best), 0),
      emojis: { total: top(totalEmojis, 8), people: [top(emojis[0], 5), top(emojis[1], 5)] },
      phrases: PHRASES.map((phrase, i) => ({ key: phrase.key, icon: phrase.icon, label: phrase.label, counts: phraseCounts[i] })).filter(p => p.counts[0] + p.counts[1] > 0)
    };
  }

  /* ---------- words, cloud, favourites ---------- */

  function computeWords(data) {
    const counts = [new Map(), new Map()];
    const totals = [0, 0];
    for (const m of data.msgs) {
      if (m.k !== "text") continue;
      for (const w of wordsOf(m.x)) {
        if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w) || /^(?:ha)+h?$/.test(w) || /^(?:hi)+$/.test(w)) continue;
        counts[m.a].set(w, (counts[m.a].get(w) || 0) + 1);
        totals[m.a]++;
      }
    }
    const all = new Map();
    for (const map of counts) for (const [w, n] of map) all.set(w, (all.get(w) || 0) + n);
    const cloud = top(all, 40).filter(entry => entry[1] >= 3).map(([word, n]) => {
      const a = counts[0].get(word) || 0;
      const b = counts[1].get(word) || 0;
      return { word, count: n, counts: [a, b], lean: a + b ? (a - b) / (a + b) : 0 };
    });

    /* "typical" for one person: used much more often than the other does, relative to how much each writes */
    const typical = [0, 1].map(i => {
      const other = 1 - i;
      const list = [];
      for (const [word, n] of counts[i]) {
        if (n < 4) continue;
        const mine = (n + 1) / (totals[i] + 1);
        const theirs = ((counts[other].get(word) || 0) + 1) / (totals[other] + 1);
        list.push({ word, count: n, other: counts[other].get(word) || 0, score: Math.log(mine / theirs) * Math.log(n + 1) });
      }
      return list.sort((x, y) => y.score - x.score).slice(0, 8);
    });

    return { cloud, typical, favourites: [top(counts[0], 8), top(counts[1], 8)], totals };
  }

  /* ---------- awards ---------- */

  function awards(stats, data) {
    const [pa, pb] = stats.people;
    const names = data.names;
    const list = [];
    /* higher wins; nothing is awarded for a tie or when nobody scores */
    const add = (icon, title, a, b, detail, minimum = 1, lowerWins = false) => {
      if (a === null || b === null || a === undefined || b === undefined) return;
      if (a === b || (a < minimum && b < minimum)) return;
      const winner = (lowerWins ? a < b : a > b) ? 0 : 1;
      list.push({ icon, title, winner: names[winner], index: winner, detail: detail(winner, [a, b]) });
    };
    const phrase = key => (stats.phrases.find(p => p.key === key) || { counts: [0, 0] }).counts;
    const num = n => Math.round(n).toLocaleString("de-DE");

    add("🗣️", "Quasselstrippe", pa.words, pb.words, (w, v) => `${num(v[w])} Wörter geschrieben, ${num(v[1 - w])} bei ${names[1 - w]}`);
    add("✍️", "Romanschreiber:in", pa.longest ? pa.longest.words : 0, pb.longest ? pb.longest.words : 0,
      (w, v) => `längste Nachricht: ${num(v[w])} Wörter am ${formatDay(w ? pb.longest.t : pa.longest.t)}`, 15);
    add("⚡", "Blitzantwort", pa.replyMedian, pb.replyMedian, (w, v) => `antwortet im Schnitt nach ${formatMinutes(v[w])} (${names[1 - w]}: ${formatMinutes(v[1 - w])})`, 0, true);
    add("🐣", "Gesprächsstarter:in", pa.starts, pb.starts, (w, v) => `hat ${num(v[w])}-mal das Gespräch eröffnet`);
    add("📨", "Doppel-Texter:in", pa.maxStreak, pb.maxStreak, (w, v) => `${num(v[w])} Nachrichten am Stück, ohne dass geantwortet wurde`, 4);
    add("🌙", "Nachteule", pa.lateNight, pb.lateNight, (w, v) => `${num(v[w])} Nachrichten zwischen Mitternacht und 5 Uhr`, 5);
    add("🌅", "Frühaufsteher:in", pa.early, pb.early, (w, v) => `${num(v[w])} Nachrichten zwischen 5 und 9 Uhr`, 20);
    add("💌", "Romantiker:in", phrase("love")[0], phrase("love")[1], (w, v) => `${num(v[w])}-mal „Ich liebe dich“ geschrieben`);
    add("🥺", "Vermisser:in", phrase("miss")[0], phrase("miss")[1], (w, v) => `${num(v[w])}-mal „Vermisse dich“`);
    add("😂", "Lachkrampf", phrase("laugh")[0], phrase("laugh")[1], (w, v) => `${num(v[w])}-mal gelacht (haha, hihi, 😂)`, 5);
    add("🍕", "Hunger-Held:in", phrase("hunger")[0], phrase("hunger")[1], (w, v) => `${num(v[w])}-mal „Hunger“`, 3);
    add("🚗", "„Bin gleich da“-Profi", phrase("arriving")[0], phrase("arriving")[1], (w, v) => `${num(v[w])}-mal „gleich da“ oder „unterwegs“`, 3);
    add("🙇", "Entschuldiger:in", phrase("sorry")[0], phrase("sorry")[1], (w, v) => `${num(v[w])}-mal „Sorry“`, 3);
    add("❓", "Fragezeichen-Queen / -King", pa.questions, pb.questions, (w, v) => `${num(v[w])} Fragezeichen verteilt`, 10);
    add("🎤", "Sprachnachrichten-Meister:in", pa.media.audio, pb.media.audio, (w, v) => `${num(v[w])} Sprachnachrichten`, 5);
    add("📸", "Fotograf:in", pa.media.image, pb.media.image, (w, v) => `${num(v[w])} Fotos geschickt`, 5);
    add("🎭", "Sticker-Sammler:in", pa.media.sticker, pb.media.sticker, (w, v) => `${num(v[w])} Sticker`, 5);
    add("🫣", "Nachrichten-Zurückholer:in", pa.deleted, pb.deleted, (w, v) => `${num(v[w])} Nachrichten wieder gelöscht`, 3);
    return list;
  }

  /* ---------- quotes and quiz ---------- */

  const SWEET = /liebe|schatz|vermiss|❤|💗|💕|😘|🥰|😍|kuss|knuddel|süß|süss|umarm/i;
  const FUNNY = /\b(?:ha){2,}|\bhi(?:hi)+\b|\blol\b|😂|🤣|😭|💀|!!|\bwtf\b|\bdigga\b/i;

  function isQuotable(m) {
    if (m.k !== "text") return false;
    const length = m.x.length;
    if (length < 15 || length > 220) return false;
    if (/https?:\/\/|www\./i.test(m.x)) return false;
    return wordsOf(m.x).length >= 3;
  }

  /* indices into data.msgs, grouped by taste */
  function quotePools(data) {
    const all = [];
    const funny = [];
    const sweet = [];
    const long = [];
    data.msgs.forEach((m, i) => {
      if (!isQuotable(m)) return;
      all.push(i);
      if (FUNNY.test(m.x)) funny.push(i);
      if (SWEET.test(m.x)) sweet.push(i);
      if (m.x.length >= 110) long.push(i);
    });
    /* "pearls" = the funny and the sweet ones; a tiny chat falls back to everything */
    const pearls = Array.from(new Set(funny.concat(sweet))).sort((x, y) => x - y);
    return { pearls: pearls.length >= 5 ? pearls : all, funny, sweet, long, all };
  }

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* the same quote for the whole day, a different one tomorrow */
  function quoteOfDay(pool, dateKey) {
    return pool.length ? pool[hash(dateKey) % pool.length] : -1;
  }

  function randomFrom(pool, rng, avoid) {
    if (!pool.length) return -1;
    if (pool.length === 1) return pool[0];
    let pick;
    do { pick = pool[Math.floor(rng() * pool.length)]; } while (pick === avoid);
    return pick;
  }

  function context(data, index, before = 2, after = 1) {
    const out = [];
    for (let i = Math.max(0, index - before); i <= Math.min(data.msgs.length - 1, index + after); i++) {
      const m = data.msgs[i];
      /* the lines around a quote are only shown while they are close in time and plain text */
      if (i !== index && (Math.abs(m.t - data.msgs[index].t) > 2 * HOUR || m.k !== "text" || /https?:\/\//i.test(m.x))) continue;
      out.push({ index: i, ...m, main: i === index });
    }
    return out;
  }

  /* quiz: a message that sounds like one of them – picks the writer first so both appear equally often */
  function quizPool(data) {
    const pools = [[], []];
    data.msgs.forEach((m, i) => {
      if (isQuotable(m) && m.x.length <= 170 && wordsOf(m.x).length >= 4) pools[m.a].push(i);
    });
    return pools;
  }

  function quizRound(pools, rng, used) {
    const order = rng() < 0.5 ? [0, 1] : [1, 0];
    for (const author of order) {
      const candidates = pools[author].filter(i => !used.has(i));
      if (candidates.length) {
        const index = candidates[Math.floor(rng() * candidates.length)];
        return { index, author };
      }
    }
    return null;
  }

  /* ---------- formatting ---------- */

  function formatDay(t) {
    const d = new Date(t);
    return d.getDate() + ". " + MONTHS_LONG[d.getMonth()] + " " + d.getFullYear();
  }

  function formatMinutes(minutes) {
    if (minutes < 1) return "unter 1 Min.";
    if (minutes < 60) return Math.round(minutes) + " Min.";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h + " Std." + (m ? " " + m + " Min." : "");
  }

  const api = {
    parseChat, prepare, computeStats, computeWords, awards,
    quotePools, quoteOfDay, randomFrom, context, quizPool, quizRound,
    dayKey, formatDay, formatMinutes, MONTHS_LONG, WEEKDAYS, CONVERSATION_GAP
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ChatEngine = api;
})();
