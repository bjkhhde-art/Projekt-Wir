# Karten für „Murphys Gesetz“

Hier liegen die Bilder der Karten. Welche Karten im Spiel sind, steht in
[`../murphy-karten.json`](../murphy-karten.json) – dort Karten **hinzufügen oder entnehmen**
(Anleitung steht oben in der Datei). Solange zu einer Karte kein Bild da ist, zeigt das Spiel ihren Text.

## So kommt ein Bild ins Spiel

1. Bild hier hochladen, z. B. `murphy-m01.png`.
2. In `murphy-karten.json` bei der Karte `"bild": "murphy-m01.png"` eintragen.
3. Bei einer Murphy-Karte Text und `bedingung` an die echte Aufgabe anpassen, damit das Spiel
   selbst prüfen kann, ob sie erfüllt ist (ohne `bedingung` tippt man „Murphy erfüllt!“).

Format: PNG, JPG oder WebP, Hochformat (z. B. 300 × 420 px). Dateinamen nur mit a–z, 0–9, `-`, `_` und `.`.

## Zahlenkarten und Rückseite

`rot-1.png` … `rot-11.png`, `gelb-1.png` … `gelb-11.png`, `gruen-1.png` … `gruen-11.png` und `rueckseite.png`
(eine Datei pro Zahl und Farbe, gleiche Karten teilen sich das Bild). Sind alle da, in
`murphy-karten.json` `"zahlenBilder": true` setzen.

## Murphy-Karten (vorgeschlagene Dateinamen)

| Datei | id | Aufgabe (Platzhalter) |
|---|---|---|
| `murphy-m01.png` | m01 | Sammle Karten einer Farbe, die zusammen nicht mehr als 29 ergeben. Du brauchst mindestens 5. |
| `murphy-m02.png` | m02 | Genau 4 Karten mit derselben Zahl. |
| `murphy-m03.png` | m03 | Eine Reihe aus mindestens 5 Zahlen (Farbe egal). |
| `murphy-m04.png` | m04 | Nur gerade Zahlen – mindestens 5 Karten. |
| `murphy-m05.png` | m05 | Nur ungerade Zahlen – mindestens 6 Karten. |
| `murphy-m06.png` | m06 | Höchstens 5 Karten, die zusammen genau 30 ergeben. |
| `murphy-m07.png` | m07 | Von jeder Farbe genau 2 Karten. |
| `murphy-m08.png` | m08 | Drei Paare – sonst nichts. |
| `murphy-m09.png` | m09 | Zwei Drillinge – sonst nichts. |
| `murphy-m10.png` | m10 | Ein Drilling und ein Paar. |
| `murphy-m11.png` | m11 | Mindestens 7 Karten, keine Zahl doppelt. |
| `murphy-m12.png` | m12 | Nur Zahlen von 1 bis 5 – mindestens 5 Karten. |
| `murphy-m13.png` | m13 | Nur Zahlen ab 8 – mindestens 5 Karten. |
| `murphy-m14.png` | m14 | Höchstens 6 Karten, zusammen mindestens 50. |
| `murphy-m15.png` | m15 | Genau 3 Karten, zusammen 25 bis 30. |
| `murphy-m16.png` | m16 | Nur rote Karten – mindestens 6. |
| `murphy-m17.png` | m17 | Nur grüne Karten, zusammen mindestens 40. |
| `murphy-m18.png` | m18 | Eine gelbe Reihe aus mindestens 4 Zahlen. |
| `murphy-m19.png` | m19 | Zwei Farben mit je genau 3 Karten. |
| `murphy-m20.png` | m20 | Nur noch eine einzige Karte: eine 11. |
| `murphy-m21.png` | m21 | Mindestens 4 Karten, die zusammen genau 21 ergeben. |

## Aktionskarten (vorgeschlagene Dateinamen)

| Datei | id | Farbe | Titel |
|---|---|---|---|
| `aktion-zieh-zwei.png` | zieh-zwei | rot | Zieh zwei (2×) |
| `aktion-alle-ziehen.png` | alle-ziehen | rot | Alle ziehen (1×) |
| `aktion-weitergeben.png` | weitergeben | rot | Weitergeben (2×) |
| `aktion-tausch-zwang.png` | tausch-zwang | rot | Zwangstausch (1×) |
| `aktion-murphy-weiter.png` | murphy-weiter | rot | Aufgaben weiter (1×) |
| `aktion-aussetzen.png` | aussetzen | rot | Aussetzen (1×) |
| `aktion-richtung.png` | richtung | rot | Richtungswechsel (1×) |
| `aktion-neue-aufgabe.png` | neue-aufgabe | gruen | Neue Aufgabe (2×) |
| `aktion-klauen.png` | klauen | gruen | Klauen (2×) |
| `aktion-abgeben.png` | abgeben | gruen | Abgeben (1×) |
| `aktion-ablegen.png` | ablegen | gruen | Ablegen (1×) |
| `aktion-doppelzug.png` | doppelzug | gruen | Doppelt tauschen (1×) |
| `aktion-tausch-wahl.png` | tausch-wahl | gruen | Handtausch (1×) |
