# Tests

Zwei Arten von Tests:

- **Engine-Tests** (`engine/`) prüfen die reine Logik ohne Browser: Spielregeln, Mochi, Chat-Auswertung,
  Verschlüsselung, Filter, Service Worker.
- **Browser-Tests** (`e2e/`) öffnen die echten Seiten in Chromium, oft auf zwei „Handys“ gleichzeitig (Isi + Benji).

Supabase wird dabei durch ein lokales Fake-Backend ersetzt (`support/`). Die echten Daten werden nie angefasst.

```bash
cd tests
npm ci
npx playwright install chromium
npm test                  # alles
npm test -- qwixx         # ein Bereich (alle Dateien mit „qwixx“ im Namen)
npm test -- cabo briefe   # mehrere Bereiche
npm test -- spiele        # eine Gruppe (siehe unten)
npm run lint              # ESLint über die Skripte der Seite (Regeln: ../eslint.config.mjs)
```

Auf GitHub laufen Lint und alle Tests automatisch bei jedem Push (siehe `.github/workflows/tests.yml`).

## Was ist wo getestet – und wie teste ich nur das?

| Bereich | Befehl | Engine | Browser |
|---|---|---|---|
| 🦄 Cabo | `npm test -- cabo` | Regeln, Simulation vieler Runden | Einladen, Züge, Kräfte, Rundenende, Animationen, Verlassen, Nachmischen, 3 Spieler mit Gast |
| 🐮 6 nimmt! | `npm test -- nimmt` | Regeln | 2 Geräte, Animationen, 4 Spieler mit 2 Gästen |
| 🎲 Qwixx | `npm test -- qwixx` | Regeln | 2 Geräte, Animationen, 3 Spieler mit Gast |
| 🃏 Flip 7 | `npm test -- flip7` | Regeln | 2 Geräte, 3 Spieler mit Gast |
| 🎯 Phase 10 | `npm test -- phase10` (Dateien heißen `gipfel`) | Regeln | 2 Geräte, an fremde Phasen anlegen |
| 🌍 Geo-Guesser | `npm test -- geo` | Regeln | 2 Geräte |
| 🤖 Computer-Spieler | `npm test -- bots` | Züge von Udiou und Klausi | Lobby, Ersatz-Handy, Cabo, Qwixx, 6 nimmt!, Flip 7 |
| 😂 Reaktionen & Bot-Namen | `npm test -- game-reactions bot-names` | Namen bereinigen | Emojis/Sticker im Spiel, Namen in den Einstellungen |
| 🎯 Couple Quest (ToDos) | `npm test -- quest` | – | Reihenfolge, Hinzufügen, Abhaken, Zurücksetzen, Bearbeiten, Löschen |
| 🔋 Kuschelakku | `npm test -- akku` | – | Anzeige, Wischen, Pfeiltasten, Speichern, Live-Änderung vom anderen Handy |
| 💌 Briefe | `npm test -- briefe` | – | Liste, „Neu“, Umschlag aufwischen, Schreiben + Benachrichtigung, Löschen |
| 🎬 Watchlist | `npm test -- watchlist fuzzy` | Filter, unscharfe Suche | Gesehen, Filter, Datum, Serienfortschritt |
| ✈️ Reisen | `npm test -- reise` | Aufnahmedatum von Fotos | Galerie, Fotodaten, Story-Modus, Karte |
| 🍰 Mochi | `npm test -- mochi` | Pflege-Logik | Zusammen, klassisch, Schlaf, Garten & Sternenregen |
| 📊 Chat-Wrapped | `npm test -- chat` | Auswertung, Verschlüsselung | Hochladen, ZIP, zwei Handys, Exporte zusammenführen |
| 📈 KPIs | `npm test -- kpis` | – | Tage zusammen, Jahrestag, Countdowns (mit festem Datum) |
| 🏠 Home | `npm test -- home` | – | Tage, Alicante, Mochi-Stimmung, Akku des anderen, letzte Reise |
| ⚙️ Einstellungen | `npm test -- einstellungen` | – | Wer bin ich, Schalter pro Person, Alicante-Daten |
| 💬 Fragen | `npm test -- fragen` | – | Große Kategorien |
| 🔐 Login | `npm test -- login` | – | Passwort, Fehlermeldungen, ohne Netz, alte Sperre |
| 📱 App allgemein | `npm test -- app` | Service Worker | Alle Seiten laden, Manifest/Icons/Design, Navigation, schwaches Netz, Login |
| Alle Spiele | `npm test -- spiele` | | |

## Neue Tests schreiben

- Dateiname beginnt mit dem Bereich (`briefe-02-….test.mjs`). Dann läuft er mit `npm test -- briefe` mit.
- Daten am Anfang mit `POST /t/<tabelle>/seed` setzen und am Ende mit `POST /t/<tabelle>/reset` aufräumen.
  Alle Tests eines Laufs teilen sich ein Fake-Backend.
- Auf Ergebnisse warten statt feste Pausen zu nutzen (kleine `until(...)`-Hilfe wie in den vorhandenen Tests).
  Die Seiten zeichnen bei Live-Updates neu.
- Für datumsabhängige Seiten das Datum festsetzen: `await page.clock.setFixedTime(new Date("2026-03-01T10:00:00+01:00"))`.
