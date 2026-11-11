# Karten für „Murphys Gesetz“

Hier liegen die Bilder der Karten. Welche Karten im Spiel sind, steht in
[`../murphy-karten.json`](../murphy-karten.json) – dort Karten **hinzufügen oder entnehmen**
(Anleitung steht oben in der Datei). Solange zu einer Karte kein Bild da ist, zeigt das Spiel ihren Text.

## So kommt ein Bild ins Spiel

1. Bild hier hochladen, z. B. `murphy-m01.webp`.
2. In `murphy-karten.json` bei der Karte `"bild": "murphy-m01.webp"` eintragen.
3. Bei einer Murphy-Karte Text und `bedingung` an die echte Aufgabe anpassen, damit das Spiel
   selbst prüfen kann, ob sie erfüllt ist (ohne `bedingung` tippt man „Murphy erfüllt!“).

Format: PNG, JPG oder WebP, Hochformat (z. B. 300 × 420 px). Dateinamen nur mit a–z, 0–9, `-`, `_` und `.`.

## Zahlenkarten und Rückseite

Die Farbe einer Zahlenkarte erkennt man am Rahmen: **Blau** (Dreiecke), **Grün** (eckige Felder), **Gelb** (Kreise).
Die Bilder sind schon da: `blau-1.webp` … `blau-11.webp`, `gruen-1.webp` … `gruen-11.webp`,
`gelb-1.webp` … `gelb-11.webp` (eine Datei pro Zahl und Farbe, gleiche Karten teilen sich das Bild).
`"zahlenBilder": true` in `murphy-karten.json` schaltet sie ein. Für die Rückseite ein Bild hochladen und
`"rueckseite": "rueckseite.webp"` eintragen.

## Murphy-Karten (vorgeschlagene Dateinamen)

| Datei | id | Aufgabe (Platzhalter) |
|---|---|---|
| `murphy-m01.webp` | m01 | Sammle Karten einer Farbe, die zusammen nicht mehr als 29 ergeben. Du brauchst mindestens 5. |
| `murphy-m02.webp` | m02 | Genau 4 Karten mit derselben Zahl. |
| `murphy-m03.webp` | m03 | Eine Reihe aus mindestens 5 Zahlen (Farbe egal). |
| `murphy-m04.webp` | m04 | Nur gerade Zahlen – mindestens 5 Karten. |
| `murphy-m05.webp` | m05 | Nur ungerade Zahlen – mindestens 6 Karten. |
| `murphy-m06.webp` | m06 | Höchstens 5 Karten, die zusammen genau 30 ergeben. |
| `murphy-m07.webp` | m07 | Von jeder Farbe genau 2 Karten. |
| `murphy-m08.webp` | m08 | Drei Paare – sonst nichts. |
| `murphy-m09.webp` | m09 | Zwei Drillinge – sonst nichts. |
| `murphy-m10.webp` | m10 | Ein Drilling und ein Paar. |
| `murphy-m11.webp` | m11 | Mindestens 7 Karten, keine Zahl doppelt. |
| `murphy-m12.webp` | m12 | Nur Zahlen von 1 bis 5 – mindestens 5 Karten. |
| `murphy-m13.webp` | m13 | Nur Zahlen ab 8 – mindestens 5 Karten. |
| `murphy-m14.webp` | m14 | Höchstens 6 Karten, zusammen mindestens 50. |
| `murphy-m15.webp` | m15 | Genau 3 Karten, zusammen 25 bis 30. |
| `murphy-m16.webp` | m16 | Nur rote Karten – mindestens 6. |
| `murphy-m17.webp` | m17 | Nur grüne Karten, zusammen mindestens 40. |
| `murphy-m18.webp` | m18 | Eine gelbe Reihe aus mindestens 4 Zahlen. |
| `murphy-m19.webp` | m19 | Zwei Farben mit je genau 3 Karten. |
| `murphy-m20.webp` | m20 | Nur noch eine einzige Karte: eine 11. |
| `murphy-m21.webp` | m21 | Mindestens 4 Karten, die zusammen genau 21 ergeben. |

## Aktionskarten (vorgeschlagene Dateinamen)

| Datei | id | Farbe | Titel |
|---|---|---|---|
| `aktion-zieh-zwei.webp` | zieh-zwei | rot | Zieh zwei (2×) |
| `aktion-alle-ziehen.webp` | alle-ziehen | rot | Alle ziehen (1×) |
| `aktion-weitergeben.webp` | weitergeben | rot | Weitergeben (2×) |
| `aktion-tausch-zwang.webp` | tausch-zwang | rot | Zwangstausch (1×) |
| `aktion-murphy-weiter.webp` | murphy-weiter | rot | Aufgaben weiter (1×) |
| `aktion-aussetzen.webp` | aussetzen | rot | Aussetzen (1×) |
| `aktion-richtung.webp` | richtung | rot | Richtungswechsel (1×) |
| `aktion-neue-aufgabe.webp` | neue-aufgabe | gruen | Neue Aufgabe (2×) |
| `aktion-klauen.webp` | klauen | gruen | Klauen (2×) |
| `aktion-abgeben.webp` | abgeben | gruen | Abgeben (1×) |
| `aktion-ablegen.webp` | ablegen | gruen | Ablegen (1×) |
| `aktion-doppelzug.webp` | doppelzug | gruen | Doppelt tauschen (1×) |
| `aktion-tausch-wahl.webp` | tausch-wahl | gruen | Handtausch (1×) |
