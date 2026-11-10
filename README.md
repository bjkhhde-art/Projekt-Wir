# Projekt Wir 💗

Gemeinsame Couple-App mit:

- 🎯 Couple Quest – Bingo-Board mit Zielen, Fortschritt & Bearbeiten
- 🔋 Kuschelbatterien – Akkustand per Wischgeste anpassen, live synchronisiert
- 📊 KPIs – Meilensteine, Tage zusammen & Countdown zum nächsten Jahrestag
- 📸 Erinnerungen – Trips anlegen/bearbeiten, Bilder per Drag & Drop hochladen
- 💬 Questions – Gesprächsthemen nach Kategorie
- 💌 Liebesbriefe – Kurznachrichten als Umschläge, zum Öffnen antippen & hochwischen
- 📊 Chat-Wrapped – WhatsApp-Export hochladen: Statistiken, Awards, Wortwolke, Zitate, „Wer hat's geschrieben?“. Weitere Exporte werden mit dem vorhandenen Chat abgeglichen (nur Neues kommt dazu, auch mitten im Verlauf). Der Chat liegt für beide in Supabase, aber nur **verschlüsselt** (AES-GCM im Browser, eigenes Chat-Passwort, nicht lesbar ohne es)
- ☁️ Supabase Realtime Sync (Datenbank & Storage)
- 📱 Mobile-first mit Bottom-Navigation, Dark Mode & sanften Animationen

## Navigation

Sechs Bereiche in der unteren Leiste:

- 🏠 **Home** – Tage zusammen, wie lange Isi noch in Alicante ist, Status von Mochi, Kuschelbatterie vom anderen, Bild der letzten Reise
- 📊 **KPIs** – Tage zusammen, nächster Jahrestag, wann wir uns kennengelernt haben, WhatsApp Wrapped (Chat-Wrapped) und „Wie lange noch bis …“
- 💬 **Wir** – Kuschelakku, Watchlist, Briefe
- ✅ **ToDos** – Couple Quest
- ✈️ **Reisen** – Karte, „Kommt noch“ und „Vergangen“
- 🎮 **Spiele** – alle Spiele und Gesprächsfragen

Mochi erreicht man über die Mochi-Kachel auf Home.

## Struktur

Statisches Vanilla HTML/CSS/JS ohne Build-Schritt. `shared.css` und `shared.js`
enthalten das gemeinsame Design-System (Farben, Typografie, Navigation,
Buttons, Modals, Toasts) und werden von jeder Seite eingebunden.

Live:
https://bjkhhde-art.github.io/Projekt-Wir/

## Login & Datenschutz

Das Passwortfeld ist ein echter Login: Es meldet das Handy beim gemeinsamen Supabase-Konto
`projekt-wir@example.com` an. Die Datenbank (Tabellen und der Speicher für Reisebilder)
antwortet nur angemeldeten Mitgliedern (`public.members`). Der öffentliche Schlüssel im Code
reicht allein nicht mehr, um etwas zu lesen oder zu ändern. Das Passwort steht in keiner Datei.

Eingeladene Freunde (`?invite=…` auf einer Spielseite) melden sich nicht an. Ihre Seite schickt den
Einladungscode mit, und die Datenbank zeigt ihnen genau diese eine Runde.

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
