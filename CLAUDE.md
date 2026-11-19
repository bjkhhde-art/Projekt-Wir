# CLAUDE.md

Couple-App (PWA) für Isi und Benji. Statisches Vanilla HTML/CSS/JS, kein Build, kein Framework. Backend: Supabase.
Details stehen in `README.md` und `tests/README.md`. Lies sie nur, wenn du sie brauchst.

## Arbeitsweise (Tokens sparen)
- Lies nur die Dateien, die die Aufgabe betrifft. Viele Dateien sind groß (30–50 KB): erst `grep -n`, dann gezielt
  mit `offset`/`limit` lesen statt der ganzen Datei.
- Kein Erkunden des ganzen Repos, keine Subagenten, außer es wird ausdrücklich verlangt.
- Kleinste Änderung, die die Aufgabe löst. Antworten kurz und auf Deutsch.

## Wo liegt was
- Jede Seite = `<name>.html` + `<name>.js` + `<name>.css`. Alle laden `shared.js`/`shared.css` (Design-System,
  Navigation, Modals, Toasts), `theme.js`, `pin-lock.js`, `supabase-client.js` (einziger Client: `supabaseClient`).
- Hubs der unteren Leiste: Home `index.html`/`index.js` · KPIs `kpis.*` · Wir `wir.html` (Akku `batterien.*`,
  Briefe `liebesbriefe.*`) · ToDos `ziele.html` (Quest `app.js`, Watchlist `watchlist*.js`) · Reisen `reise.html`
  (`erinnerungen.*`, `photo-date.js`) · Spiele `games.html`. Tabs innerhalb der Hubs: `hub-tabs.js`.
- Spiele: Regeln in `<spiel>-engine.js` (rein, testbar), UI in `<spiel>.js`, Lobby/Sync/Gäste/Einladungen in
  `game-room.js`, Animationen `game-anim.js`, Bots (Udiou, Klausi) `game-bots.js`, Statistik `game-stats.js`.
  Phase 10 heißt im Code `gipfel`. Murphy-Karten: `murphy-karten.json`.
- Mochi: `mochi-core.js` (Logik) + `mochi*.js`/`mochi*.css`, geteilter Scope, `mochi-start.js` startet.
- Chat-Wrapped: `chat-engine.js` (Auswertung), `chat-crypto.js` (AES-GCM), `chat-zip.js`, `chat.js`.
- Song-Quiz/Playlist: `playlist.json` wird von `tools/update-playlist.mjs` (Workflow `playlist.yml`) geschrieben,
  nicht von Hand ändern.
- Offline: `sw.js` cacht Seiten beim Aufruf, `offline.html` als Rückfall.

## Datenbank
- Migrationen in `supabase/migrations/<Zeitstempel>_<name>.sql`. Neue Datei mit späterem Zeitstempel,
  bestehende nie ändern. Zugriff nur für Mitglieder (`public.members`), Gäste per Einladungscode.
- Keine Passwörter oder persönlichen Daten in Dateien (Meilensteine liegen in `app_settings.milestones`).

## Tests (in `tests/`)
```bash
cd tests && npm ci
npm test -- <bereich>   # z. B. cabo, watchlist, mochi – nur betroffene Bereiche laufen lassen
npm run lint
```
Supabase ist im Test durch ein Fake-Backend (`tests/support/`) ersetzt. Neue Features: Engine-Test in
`tests/engine/`, Browser-Test in `tests/e2e/<bereich>-NN-<thema>.test.mjs`. CI führt alles bei jedem Push aus.
