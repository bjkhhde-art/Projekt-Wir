# Tests

Engine-Tests für Cabo, 6 nimmt!, Qwixx, Flip 7 und Monopoly sowie Browser-Tests, die zwei Geräte (Isi + Benji)
gleichzeitig spielen lassen. Supabase wird dabei durch ein lokales Fake-Backend ersetzt –
die echten Daten werden nie angefasst.

```bash
cd tests
npm ci
npx playwright install chromium
npm test            # alles
npm test -- qwixx   # nur Dateien mit "qwixx" im Namen
```

Die Testdateien laufen parallel (bis zu 4 gleichzeitig, je nach Prozessorkernen). Jeder Worker hat
ein eigenes Fake-Backend und einen eigenen Seiten-Server auf eigenen Ports, und vor jeder Datei wird
das Backend geleert. So sehen sich Tests nie gegenseitig ihre Runden.

```bash
TEST_WORKERS=1 npm test   # eine Datei nach der anderen
TEST_RETRIES=0 npm test   # ohne Wiederholung – zeigt jeden wackligen Test
```

Eine einzelne Browser-Testdatei lässt sich auch direkt starten, wenn Fake-Backend (Port 8991) und
Seiten-Server (Port 9091) laufen; die Adressen stehen in `support/ports.mjs`.

Auf GitHub laufen die Tests automatisch bei jedem Push (siehe `.github/workflows/tests.yml`).
