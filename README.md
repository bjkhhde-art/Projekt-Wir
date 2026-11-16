# Projekt Wir 💗

Gemeinsame Couple-App (installierbar, mit Login, Push-Benachrichtigungen und Dark Mode) mit:

- 🎯 **Couple Quest** – Bingo-Board mit Zielen; offene Quests zuerst, erledigte danach
- 🔋 **Kuschelakku** – Akkustand per Wischgeste, live für beide
- 📊 **KPIs** – Tage zusammen, nächster Jahrestag, „Wie lange noch bis …“
- ✈️ **Reisen** – Karte mit vergangenen und kommenden Reisen, Fotos mit Aufnahmedatum, Story-Modus
- 💌 **Briefe** – Kurznachrichten als Umschläge, zum Öffnen antippen & hochwischen
- 🎬 **Watchlist** (in ToDos) – Filme und Serien mit Filter, Serienfortschritt und „Wie geschaut?“: zusammen live,
  beide getrennt, nur Isi oder nur Benji – für Filme, ganze Serien und jede einzelne Folge
- 🍰 **Mochi** – gemeinsames Haustier mit Pflege, Shop, Garten, Minispielen, Wünschen und Nachrichten
- 🎮 **Spiele** – Cabo, 6 nimmt!, Qwixx, Flip 7, Phase 10, Murphys Gesetz, Geo-Guesser und Song-Quiz, live auf zwei Handys; Freunde per
  Einladungslink und die Computer-Spieler Udiou und Klausi können mitspielen; Emoji-Reaktionen
- 🎧 **Song-Quiz** (in Spiele) – 30-Sekunden-Hörproben aus unserer Spotify-Playlist „Hau raus“: Welcher Song,
  wer singt? Richtig = 1 Punkt, wer bei zwei richtigen Antworten schneller war, bekommt ⚡ einen Bonuspunkt
- 🎮 **Spiele-Statistik** (in KPIs) – wie oft und wie lange wir welches Spiel gespielt haben, Siege Isi gegen Benji,
  Spielzeit pro Woche und Wochentag, Rekorde
- 🎶 **Playlist Wrapped** (in KPIs) – die Playlist in Zahlen: Top-Künstler, Erscheinungsjahre, Rekorde, Zufallssong
  und – mit Spotify-Schlüssel – wer welche Songs reingepackt hat
- 💬 **Gesprächsfragen** – über 5.000 Fragen nach Kategorie
- 📊 **Chat-Wrapped** – WhatsApp-Export hochladen: Statistiken, Awards, Wortwolke, Zitate, „Wer hat's
  geschrieben?“. Weitere Exporte werden abgeglichen (nur Neues kommt dazu). Der Chat liegt für beide in
  Supabase, aber nur **verschlüsselt** (AES-GCM im Browser, eigenes Chat-Passwort)
- ☁️ Supabase für Datenbank, Speicher und Live-Sync; offline zeigt die App die letzte Version

## Navigation

Sechs Bereiche in der unteren Leiste:

- 🏠 **Home** – Tage zusammen, wie lange Isi noch in Alicante ist, Status von Mochi, Kuschelbatterie vom anderen, Bild der letzten Reise
- 📊 **KPIs** – Tage zusammen, nächster Jahrestag, wann wir uns kennengelernt haben, WhatsApp Wrapped (Chat-Wrapped) und „Wie lange noch bis …“
- 💬 **Wir** – Kuschelakku, Briefe
- ✅ **ToDos** – Couple Quest, Watchlist
- ✈️ **Reisen** – Karte, „Kommt noch“ und „Vergangen“
- 🎮 **Spiele** – alle Spiele und Gesprächsfragen

Mochi erreicht man über die Mochi-Kachel auf Home.

## Struktur

Statisches Vanilla HTML/CSS/JS ohne Build-Schritt. `shared.css` und `shared.js`
enthalten das gemeinsame Design-System (Farben, Typografie, Navigation,
Buttons, Modals, Toasts) und werden von jeder Seite eingebunden.

- `supabase-client.js` ist die eine Verbindung zu Supabase (`supabaseClient`). Jede Seite lädt sie direkt
  nach supabase-js, die Seitenskripte benutzen nur noch `supabaseClient`.
- Murphys Gesetz: Murphy- und Aktionskarten stehen in `murphy-karten.json` (hinzufügen, entnehmen oder mit
  `"aktiv": false` parken; Anleitung oben in der Datei), die Kartenbilder in `murphy-karten/`.
- Spiele: Regeln in `*-engine.js`, Lobby/Sync/Gäste in `game-room.js`, Animationen in `game-anim.js`
  (`GameAnim.moveTracker()` merkt sich, welcher Zug schon animiert wurde), Computer-Spieler in `game-bots.js`.
- Mochi ist in Teile aufgeteilt, die nacheinander geladen werden und sich einen Scope teilen:
  `mochi-core.js` (reine Logik), `mochi.js`, `mochi-care.js`, `mochi-games.js`, `mochi-shop.js`,
  `mochi-social.js`, `mochi-start.js` (startet alles) sowie `mochi.css`, `mochi-world.css`,
  `mochi-social.css`, `mochi-garden.css`.

Live:
https://bjkhhde-art.github.io/Projekt-Wir/

## Spotify-Playlist

Song-Quiz und Playlist Wrapped lesen `playlist.json`. Die Datei schreibt `tools/update-playlist.mjs`, jeden Tag
automatisch über den GitHub-Workflow **Playlist** (`.github/workflows/playlist.yml`, per Hand: Actions → Playlist →
*Run workflow*; lokal: `node tools/update-playlist.mjs`). Nur wenn sich etwas geändert hat, wird committet.

- **Ohne Schlüssel** liest das Skript Spotifys öffentlichen Player: nur die **ersten 100 Songs**, ohne „wer hat's
  hinzugefügt“. Die Seiten sagen dann dazu, dass nur ein Teil ausgewertet ist.
- **Mit Schlüssel** kommen alle Songs und wer sie wann hinzugefügt hat: Auf developer.spotify.com/dashboard eine App
  anlegen (Web API, Redirect-URI egal, z. B. `https://example.com`), dann im GitHub-Repo unter Settings → Secrets and
  variables → Actions `SPOTIFY_CLIENT_ID` und `SPOTIFY_CLIENT_SECRET` eintragen und den Workflow einmal starten.
  Das Spotify-Konto `ben.kzyk` ist Benji, das andere Konto Isi (`PEOPLE` oben im Skript).

Hörproben, Cover und Erscheinungsdatum holt das Skript pro Song einmal aus dem öffentlichen Song-Player; bekannte Songs
behalten, was schon da ist. Einmalig für das Spiel: Migration `20261116120000_create_songquiz_games_table.sql` ausführen.

## Spiele-Statistik

`spielstats.html` liest alle Spiel-Tabellen und `game_plays`. Seit Migration `20261116130000_game_plays.sql` ruft
`game-room.js` nach jedem gespeicherten Zug `record_game_play` auf: Der Server zählt die aktive Spielzeit pro
Spieltisch mit seiner eigenen Uhr (Zeit seit dem letzten Zug, höchstens 5 Minuten – ein tagelang offener Tisch zählt
also nicht als Spielzeit), dazu Züge, Spieler und eine kleine Zusammenfassung (Siege, Runden – keine Karten).
Eingeladene Gäste zeichnen nichts auf. Ältere Spieltische schätzt `game-stats.js`: bis 3 Stunden zwischen Öffnen und
letztem Zug zählt diese Zeit, sonst Züge × übliches Tempo des Spiels.

## Login & Datenschutz

Das Passwortfeld ist ein echter Login: Es meldet das Handy beim gemeinsamen Supabase-Konto
`projekt-wir@example.com` an. Die Datenbank (Tabellen und der Speicher für Reisebilder)
antwortet nur angemeldeten Mitgliedern (`public.members`). Der öffentliche Schlüssel im Code
reicht allein nicht mehr, um etwas zu lesen oder zu ändern. Das Passwort steht in keiner Datei.

Eingeladene Freunde (`?invite=…` auf einer Spielseite) melden sich nicht an. Ihre Seite schickt den
Einladungscode mit, und die Datenbank zeigt ihnen genau diese eine Runde. Ist die Runde beendet (oder wird
eine neue gestartet), wird der Code gelöscht – alte Links funktionieren dann nicht mehr.

Unsere Daten (erstes Treffen, erstes Date, Jahrestag mit Orten) stehen nicht im öffentlichen Code, sondern in
`app_settings.milestones` (nur für Mitglieder lesbar). Ändern im Supabase-SQL-Editor:
`update public.app_settings set milestones = '{"firstMeeting": {"date": "JJJJ-MM-TT", "place": "…"}, "firstDate": {…}, "anniversary": {…}}' where id = 'shared';`

„Abmelden“ in den Einstellungen meldet nur dieses Handy ab, das andere bleibt angemeldet.

Einrichtung (einmalig, siehe `supabase/migrations/20261110120000_members_only_access.sql`):

1. Supabase → Authentication → Users → *Add user*: E-Mail `projekt-wir@example.com`,
   ein **neues** Passwort, Haken bei *Auto Confirm User*.
2. Supabase → Authentication → Sign In / Providers: *Allow new users to sign up* ausschalten.
3. Website veröffentlichen. Jedes Handy fragt dann einmal nach dem Passwort.
4. Migration ausführen und die Edge Function `notify-new-letter` neu deployen.

## Datenbank-Migrationen

`supabase/migrations/` folgt dem Schema der Supabase CLI: `<Zeitstempel>_<name>.sql`. Der Zeitstempel ist
dieselbe Version, unter der die Migration in Supabase eingetragen ist, so dass Reihenfolge und Stand
übereinstimmen. Neue Migrationen bekommen einen neuen, späteren Zeitstempel. Bereits ausgeführte Dateien
werden nicht mehr geändert.

Tabellen entfernter Features liegen im Schema `archive` (über die API nicht erreichbar).
