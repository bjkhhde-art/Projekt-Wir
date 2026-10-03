# Tests

Engine-Tests für Cabo, 6 nimmt! und Qwixx sowie Browser-Tests, die zwei Geräte (Isi + Benji)
gleichzeitig spielen lassen. Supabase wird dabei durch ein lokales Fake-Backend ersetzt –
die echten Daten werden nie angefasst.

```bash
cd tests
npm ci
npx playwright install chromium
npm test            # alles
npm test -- qwixx   # nur Dateien mit "qwixx" im Namen
```

Auf GitHub laufen die Tests automatisch bei jedem Push (siehe `.github/workflows/tests.yml`).
