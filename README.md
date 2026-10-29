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

## Struktur

Statisches Vanilla HTML/CSS/JS ohne Build-Schritt. `shared.css` und `shared.js`
enthalten das gemeinsame Design-System (Farben, Typografie, Navigation,
Buttons, Modals, Toasts) und werden von jeder Seite eingebunden.

Live:
https://bjkhhde-art.github.io/bingo-board/
