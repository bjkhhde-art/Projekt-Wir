# CLAUDE-Gedächnis – Projekt Wir 💗

> Zweck: Wer diese Datei gelesen hat, kann sofort am Projekt weiterarbeiten.
> Stand: 2026-11-20 (letzter Commit vor dieser Datei: `bc7ceab` „Murphy: 26 neue Murphy-Karten (jetzt 75)“).
> Ergänzt `README.md` (Features, Login, Spotify) und `tests/README.md` (Testtabelle) – beide bei Bedarf mitlesen.
> **Bitte aktuell halten:** Wer etwas Wesentliches ändert, trägt es hier ein.

---

## 1. Worum geht es?

Eine private, installierbare **Couple-App (PWA)** für **Isi** und **Benji** (Titel überall „I + B“).
Live: https://bjkhhde-art.github.io/Projekt-Wir/ (GitHub Pages, direkt aus `main`).

- Sprache der App, der Commits, PR-Titel und READMEs: **Deutsch**, locker und kurz („Murphys Gesetz: …“).
  Code-Kommentare sind meist **Englisch**.
- Die Nutzer sind keine Entwickler: Erklärungen in Commits/PRs in Alltagssprache, was sich für sie ändert.
- Zwei Personen (`MEMBERS = ["Isi", "Benji"]`). Jedes Handy merkt sich „Wer bin ich“ in `localStorage.pw_person`.
- Isi ist (zeitweise) in **Alicante** – Home zeigt den Fortschritt (Daten in den Einstellungen).

## 2. Technik in einem Satz

**Statisches Vanilla HTML/CSS/JS, kein Build, kein Framework, kein Bundler.** Jede Seite ist eine eigene
`.html` mit klassischen `<script>`-Tags (globaler Scope, keine Module). Backend = **Supabase**
(Postgres + RLS, Realtime, Storage, eine Edge Function). Tests mit Node + Playwright in `tests/`.

Reihenfolge der Skripte auf jeder Seite (wichtig, alles ist global):
```
theme.js → pin-lock.js → supabase-js (CDN jsdelivr @2.118.0) → supabase-client.js → shared.js → [hub-tabs.js] → Seiten-Skripte
```
Spiele zusätzlich: `<spiel>-engine.js → game-anim.js → game-bots.js → bot-names.js → game-room.js → <spiel>.js`.

## 3. Seiten & Navigation

Untere Leiste mit 6 Bereichen:

| Bereich | Datei | Skripte | Inhalt |
|---|---|---|---|
| 🏠 Home | `index.html` | `index.js`, `home.css` | Tage zusammen, Alicante-Fortschritt, Mochi-Status, Akku des anderen, letzte Reise |
| 📊 KPIs | `kpis.html` | `kpis.js` | Tage, Jahrestag, Kennenlernen, Countdowns; Links zu Chat-Wrapped, Spiele-Statistik, Playlist Wrapped |
| 💬 Wir | `wir.html` (+ `batterien.html`) | `liebesbriefe.js`, `batterien.js` | Briefe (Umschläge), Kuschelakku |
| ✅ ToDos | `ziele.html` | `app.js` (Couple Quest/Bingo), `watchlist.js`, `watchlist-filter.js`, `fuzzy-search.js` | Couple Quest (max. 16 Felder), Watchlist |
| ✈️ Reisen | `reise.html` | `erinnerungen.js`, `photo-date.js`, Leaflet | Karte, kommende/vergangene Reisen, Galerie, Story-Modus |
| 🎮 Spiele | `games.html` | – | Übersicht aller Spiele + Gesprächsfragen |

Weitere Seiten: `mochi.html` (über Home-Kachel), `chat.html` (Chat-Wrapped), `spielstats.html`, `playlist.html`,
`questions.html`, `einstellungen.html`, `offline.html`, `404.html`.
Hubs mit Tabs nutzen `hub-tabs.js` (`data-tab`, `data-panel`, merkt Tab in `localStorage.pw_hub_tab_<hub>`).

## 4. Gemeinsame Bausteine

| Datei | Aufgabe |
|---|---|
| `theme.js` | Hell/Dunkel/System pro Gerät (`pw_theme`), lädt im `<head>` |
| `pin-lock.js` | **Login-Sperre**: Passwort meldet beim gemeinsamen Supabase-Konto `projekt-wir@example.com` an. Lässt `?invite=…` auf Spielseiten durch (`window.PW_GUEST_INVITE`). Prüft ca. alle 30 min, ob die Sitzung noch gilt |
| `supabase-client.js` | Einzige Supabase-Verbindung: globales `supabaseClient` + `PW_SUPABASE` (URL, publishable Key – darf öffentlich sein) |
| `shared.js` / `shared.css` | Design-System + Helfer: `PwMilestones`, `escapeHtml`, `formatDate`, `daysBetween`, `timeAgo`, `shrinkImageForUpload`, `InPageHistory`, `PwInstall`, Push (`subscribeToPush`, `setDevicePerson`, `sendAppNotification`), `animateCountUp`, Toasts, Navigation |
| `sw.js` | Service Worker: Netzwerk zuerst (4 s Timeout, dann Cache), offline `offline.html`. **`CACHE = "pw-pages-vN"` hochzählen, wenn Dateien umbenannt/entfernt/aufgeteilt werden** |
| `manifest.webmanifest`, `icons/` | PWA-Installation, App-Icons, 5 Foto-Sticker für Spiel-Reaktionen (`sticker-*.png`, Liste `STICKERS` in `game-room.js`) |

**Escaping:** Nutzertexte immer über `escapeHtml()` in `innerHTML`.

## 5. Spiele

Alle live auf mehreren Handys. Bis 4 Spieler mit Gästen per Einladungslink – **außer Geo-Guesser und Song-Quiz** (`maxPlayers: 2`, `invites: false`, nur Isi + Benji).

| Spiel | Dateien | Tabelle | Bots |
|---|---|---|---|
| Cabo | `cabo*.js/css/html`, `cabo-cards/` | `cabo_games` | ✅ |
| 6 nimmt! | `nimmt*` | `nimmt_games` | ✅ |
| Qwixx | `qwixx*` | `qwixx_games` | ✅ |
| Flip 7 | `flip7*` | `flip7_games` | ✅ |
| **Phase 10** | **`gipfel*`** (alter Name „Gipfel/Phasenjagd“!), `phasen.json`, `phase-cards/` | `gipfel_games` | ✅ |
| Murphys Gesetz | `murphy*`, `murphy-karten.json`, `murphy-karten/` | `murphy_games` | ✅ |
| Geo-Guesser | `geo*` | `geo_games` | – |
| Song-Quiz | `songquiz*`, liest `playlist.json` | `songquiz_games` | – |

### Architektur eines Spiels
- **`<spiel>-engine.js`**: reine Regeln, kein DOM, als IIFE (`const XEngine = (() => …)()`), in Node per
  `require` testbar. Zustand ist ein JSON-Objekt; Aktionen sind Funktionen `(state, who, …args) → neuer state`.
- **`game-room.js` (`GameRoom.create(config)`)**: Lobby, Einladungscodes, Gastnamen, versionsgeschützte Züge
  (`version`-Spalte, optimistisches Locking, bis 4 Versuche), Realtime + Polling (schwaches Netz), Verlassen,
  Emoji-/Sticker-Reaktionen, „Bereit für nächste Runde“ (`readyFor`), Bots antreiben, Spielzeit aufzeichnen
  (`record_game_play` RPC nach jedem Zug). Config-Beispiel siehe `qwixx.js` (`table`, `bot`, `title`, `icon`,
  `url`, `lobbyEl`, `boardEl`, `leaveBtn`, `createState`, `isFinished`, `renderBoard`, `startOptions`).
- **`game-anim.js`**: Zug-Animationen; `GameAnim.moveTracker()` merkt sich, welcher Zug (`state.moveSeq`) schon animiert wurde.
- **`game-bots.js`**: Computer-Spieler **Udiou** und **Klausi** (`{ play(state,name), delay(state), reaction? }`);
  sehen nur, was ein Mensch wissen könnte. Namen anpassbar über `bot-names.js` / `app_settings`.
- Gäste: eigener Supabase-Client mit Header `x-pw-invite`; RLS zeigt nur genau diese Runde. Code wird nach Rundenende gelöscht.
  Reservierte Gastnamen: Isi, Benji, du, dich, dir, ich.
- Statistik: `game-stats.js` + `spielstats.html` (Tabelle `game_plays`; aktive Zeit max. 5 min pro Zug, serverseitig gemessen).

### Murphys Gesetz (zuletzt am meisten bearbeitet)
- Karten in **`murphy-karten.json`**: aktuell **75 Murphy-Karten** (`m01`…) und **16 Aktionskarten**.
  Anleitung (Bedingungs-Syntax, Wirkungen, `bucket`, `siegKarten`, `zahlenBilder`, `rueckseite`) steht oben in der Datei unter `_anleitung`.
- Karte parken: `"aktiv": false`. Bedingung fehlt → Spieler tippt selbst „Erfüllt!“.
- `bucket: 0.5`: lange nicht gekommene Murphy-Karten werden wahrscheinlicher.
- Zahlenkarten 1–11 in Blau/Grün/Gelb, „Mac“ = offene Auslage (früher „Basar“), 2 Ablagestapel, Starthand 8, Sieg bei 3 erfüllten Karten (in Lobby einstellbar).
- Hausregel: gerade genommene Karten nicht sofort wieder abgeben.
- Neue Murphy-Karten: auch die Tabelle in `murphy-karten/README.md` ergänzen und in `tests/engine/murphy.test.mjs`
  Beispielhände ergänzen (die Tests prüfen jede Karte mit Beispielhand).

### Phase 10
- Phasen in `phasen.json` (Anleitung oben in der Datei, `handKarten` 5–12). 108 Karten, Zahlen bis 12, „Joker“ und „Aussetzen“.
- Engine-Tests hängen bewusst **nicht** von `phasen.json` ab.

## 6. Weitere Bereiche

- **Mochi** (gemeinsames Haustier): in 7 nacheinander geladene Skripte mit geteiltem Scope zerlegt:
  `mochi-core.js` (reine Logik, getestet) → `mochi.js` → `mochi-care.js` → `mochi-games.js` → `mochi-shop.js` →
  `mochi-social.js` → `mochi-start.js` (Realtime + Start). Tabellen `pet_state` (mit `version`), `mochi_messages`.
  Speichervorgänge eines Handys laufen nacheinander (Queue).
- **Watchlist**: Tabelle `watchlist`; Serienfortschritt, „Wie geschaut?“ (zusammen / getrennt / nur Isi / nur Benji)
  für Filme, Serien und jede Folge; Filter in `watchlist-filter.js`, unscharfe Suche in `fuzzy-search.js`.
- **Couple Quest**: `app.js`, Tabelle `bingo_items`, max. 16 Felder, offene zuerst.
- **Kuschelakku**: `batterien.js`, Tabelle `cuddle_batteries`, eine Push-Nachricht pro Änderung an den anderen.
- **Briefe**: `liebesbriefe.js`, Tabelle `love_notes`.
- **Reisen**: `erinnerungen.js`, Tabellen `trips`, `trip_images`, Storage-Bucket `trip-images`; Aufnahmedatum via `photo-date.js` (EXIF, HEIC), Leaflet-Karte, Story-Modus, Upload mit Beschriftung im Popup.
- **Chat-Wrapped**: `chat-engine.js` (Auswertung), `chat-zip.js`, `chat-crypto.js` (AES-GCM im Browser, eigenes Chat-Passwort); Tabellen `chat_exports`, `chat_chunks` (nur verschlüsselt).
- **Playlist**: `playlist.json` wird täglich vom Workflow `.github/workflows/playlist.yml` via `tools/update-playlist.mjs` aktualisiert (Commits „Playlist aktualisiert“ vom Bot – nicht wundern). Ohne Spotify-Secrets nur die ersten 100 Songs.
- **Fragen**: `questions.js`, Tabelle `questions` (> 5.000).
- **Einstellungen**: Wer bin ich, Push pro Kategorie (`notification_settings`, `push_subscriptions`), Alicante-Daten, Bot-Namen, Theme, Abmelden.

## 7. Supabase

- Projekt-URL: `https://lrzgcqoqcwicpuuuhaoj.supabase.co` (siehe `supabase-client.js`). Supabase-MCP-Tools sind in der Session verfügbar.
- **Zugriff nur für Mitglieder** (`public.members`, RLS) – siehe `20261110120000_members_only_access.sql`. Gäste nur per Invite-Header auf ihre Runde.
- Private Daten (Jahrestage) in `app_settings.milestones` (Zeile `id = 'shared'`), nie im Code. Lokale Kopie `pw_milestones`.
- Realtime ist für die geteilten Tabellen aktiviert.
- **Migrationen**: `supabase/migrations/<Zeitstempel>_<name>.sql`. Neue Migration = neuer, späterer Zeitstempel.
  **Ausgeführte Dateien nie ändern.** Neue Spiel-Tabelle → eigene Migration (Vorbild: `20261111180000_create_murphy_games_table.sql`, inkl. RLS für Mitglieder + Invite, Realtime) und ggf. in `game_plays`/Statistik aufnehmen.
- Entfernte Features (Frage des Tages, Vision, Vergleich, Monopoly, Links …) liegen im Schema `archive`.
- Edge Function `supabase/functions/notify-new-letter/index.ts`: verschickt Web-Push (VAPID) für alle Kategorien (`letters`, `quest`, `battery`, `mochi`, `games`, …); Aufruf über `sendAppNotification()` in `shared.js`. URLs nur app-intern.

## 8. Tests & CI

```bash
cd tests
npm ci
npm test                 # alles (Engine + Browser)
npm test -- murphy       # nur ein Bereich (Dateiname enthält „murphy“)
npm test -- spiele       # Gruppe (siehe GROUPS in tests/run-all.mjs)
npm run lint             # ESLint (Regeln: ../eslint.config.mjs)
```
- In dieser Cloud-Umgebung ist Chromium vorinstalliert – **kein** `playwright install` nötig.
- `tests/engine/*.test.mjs`: reine Logik in Node. `tests/e2e/*.test.mjs`: echte Seiten in Chromium, oft zwei „Handys“ (Isi + Benji).
- Supabase wird durch ein Fake-Backend ersetzt (`tests/support/fake-backend.mjs`, Port 8991, `supabase-mock.js` im Browser, `static-server.mjs`). Echte Daten werden nie angefasst.
- Neue Tests: Dateiname beginnt mit dem Bereich; Daten per `POST /t/<tabelle>/seed`, aufräumen mit `/reset`; auf Ergebnisse warten (`until(...)`) statt feste Pausen; Datum mit `page.clock.setFixedTime(...)` fixieren.
- Browser-Tests werden bei Fehlschlag einmal wiederholt.
- GitHub Actions `Tests` (`.github/workflows/tests.yml`) läuft bei jedem Push/PR: Lint + alle Tests.
- **Neue Seite?** Dann auch `tests/e2e/all-pages-smoke.test.mjs` und ggf. Navigation prüfen; neue Spielseite in `GAME_PAGES` (`pin-lock.js`) eintragen, damit Einladungslinks funktionieren.

## 9. Arbeitsweise / Workflow

1. Auf dem Session-Branch arbeiten (`claude/…`), nie direkt auf `main`.
2. Lint + betroffene Tests lokal laufen lassen (`npm test -- <bereich>`), bei größeren Änderungen alles.
3. Commit auf Deutsch, Muster: `<Bereich>: <was sich ändert>`.
4. Push, PR (Draft) erstellen, nach grüner CI **squash-mergen** (PR-Nummer landet im Commit-Titel, z. B. `(#73)`).
   Der Nutzer erlaubt in der Regel direktes Mergen.
5. GitHub Pages deployt `main` automatisch. Bei umbenannten/entfernten Dateien `CACHE` in `sw.js` hochzählen.
6. Neue DB-Änderungen: Migration-Datei anlegen **und** im Supabase-Projekt anwenden (Supabase-MCP `apply_migration`) – sonst funktioniert die Live-Seite nicht.
7. README / tests/README / diese Datei aktualisieren, wenn sich Features oder Abläufe ändern.

## 10. Stolperfallen

- Phase 10 heißt im Code **`gipfel`** (Dateien, Tabelle, Tests) – Testgruppe `npm test -- phase10`.
- Globale Namen: alle Skripte teilen einen Scope. Keine doppelten `const`-Namen über Skripte derselben Seite (v. a. Mochi-Teile!). ESLint prüft undefinierte Namen **nicht** – das fangen die Browser-Tests.
- Keine Geheimnisse ins Repo: Passwort, Daten, Spotify-Keys stehen nur in Supabase bzw. GitHub-Secrets.
- Bilder komprimieren (WebP), Kartenbilder waren mal 35 MB → 1,4 MB.
- `playlist.json` nicht von Hand bearbeiten – wird vom Workflow überschrieben.
- Spielzustände sind JSON in einer Zeile pro Spieltisch; Änderungen am State-Format müssen alte laufende Partien vertragen.
- Alte Cabo-Runden haben Status `finished` statt `active` (wird in `game-room.js` berücksichtigt).

## 11. Verlauf (grob)

- **Sept/Okt 2026**: Grundgerüst, Quest, Akku, Briefe, Mochi, Watchlist, Cabo, 6 nimmt!, Qwixx, Flip 7, Chat-Wrapped, Reisen, Fragen.
- **Ende Okt/Nov**: Geo-Guesser, Phase 10 (Gipfel), Bots, Reaktionen/Sticker, Mochi-Garten.
- **10.11.**: Echter Login (Members-only RLS), Migrationen mit Zeitstempel, Archiv-Schema, Struktur-Aufräumen, ESLint, CI.
- **11.–20.11.**: Murphys Gesetz (neu, viele Iterationen, 75 Murphy-Karten, Bucket-Ziehen, Bots, Browsertests),
  Watchlist-Redesign + „Wie geschaut?“, Song-Quiz + Playlist Wrapped, Spiele-Statistik mit genauer Spielzeit, Mochi-Speicher-Queue.
- **23.11.**: Fünfter Foto-Sticker „Wut-Sticker“ (`icons/sticker-wut.png`, wie 😡) für die Spiel-Reaktionen.
