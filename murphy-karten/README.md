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

## Murphy-Karten

| Datei (falls ein Bild dazukommt) | id | Aufgabe |
|---|---|---|
| `murphy-m01.webp` | m01 | Die Aufgabe ist erfüllt, wenn du mindestens 8 Karten hast, die in Summe 90 oder mehr ergeben. |
| `murphy-m02.webp` | m02 | Die Aufgabe ist erfüllt, wenn du NUR eine blaue 5 und eine beliebige andere Karte hast. |
| `murphy-m03.webp` | m03 | Die Aufgabe ist erfüllt, wenn du NUR aufeinander folgende Karten gleicher Farbe hast. Du brauchst mindestens 4. |
| `murphy-m04.webp` | m04 | Die Aufgabe ist erfüllt, wenn du NUR Karten mit der Zahl 10 hast – egal wie viele. |
| `murphy-m05.webp` | m05 | Die Aufgabe ist erfüllt, wenn du NUR eine gelbe 6 und eine beliebige andere Karte hast. |
| `murphy-m06.webp` | m06 | Die Aufgabe ist erfüllt, wenn du NUR gelbe Karten hast. Du brauchst mindestens 7. |
| `murphy-m07.webp` | m07 | Die Aufgabe ist erfüllt, wenn du NUR Karten hast, deren Zahl höchstens 3 ist. Du brauchst mindestens 3. |
| `murphy-m08.webp` | m08 | Die Aufgabe ist erfüllt, wenn du NUR Karten hast, deren Zahlen mehr als 4 Buchstaben haben. Du brauchst mindestens 4. (Zahlen mit mehr als 4 Buchstaben: sechs und sieben) |
| `murphy-m09.webp` | m09 | Die Aufgabe ist erfüllt, wenn bei Mac NUR Pärchen liegen. Es müssen mindestens 2 Pärchen sein – Farbe egal. |
| `murphy-m10.webp` | m10 | Die Aufgabe ist erfüllt, wenn du NUR Karten mit Zahlen der Dreierreihe hast. Du brauchst mindestens 6. (Zahlen der Dreierreihe: 3, 6, 9) |
| `murphy-m11.webp` | m11 | Die Aufgabe ist erfüllt, wenn du NUR Karten mit ungeraden Zahlen hast. Du brauchst mindestens 9. |
| `murphy-m12.webp` | m12 | Die Aufgabe ist erfüllt, wenn bei Mac NUR eine Zahlenfolge liegt. Es müssen mindestens 3 Karten sein – Farbe egal. |

## Aktionskarten (alle mit Bild)

| Datei | id | Farbe | Text |
|---|---|---|---|
| `aktion-alle-klauen.webp` | alle-klauen | blau (sofort) | Ziehe von jeder Person eine Handkarte. |
| `aktion-zieh-drei.webp` | zieh-drei | blau (sofort) | Ziehe 3 Karten vom Nachziehstapel. |
| `aktion-neue-aufgabe.webp` | neue-aufgabe | blau (sofort) | Ziehe eine neue Murphykarte und leg die alte ab. |
| `aktion-tausch-alles-blau.webp` | tausch-alles-blau | blau (sofort) | Tausche deine Handkarten und deine Murphykarte mit einer Person. |
| `aktion-murphy-offen.webp` | murphy-offen | blau (sofort) | Lege deine Murphykarte offen auf den Tisch. (Sollte diese zu einem späteren Zeitpunkt getauscht werden, darf die Karte wieder verdeckt werden.) |
| `aktion-nimm-drei.webp` | nimm-drei | grün (sammeln) | Nimm 3 Karten von Mac oder dem Nachziehstapel. |
| `aktion-paar-abgeben.webp` | paar-abgeben | grün (sammeln) | Gib einer Person 2 gleiche Zahlenkarten aus deiner Hand (gleiche Zahl und gleiche Farbe). |
| `aktion-ablegen-farbe.webp` | ablegen-farbe | grün (sammeln) | Lege bis zu 5 Zahlenkarten einer Farbe auf einen oder beide Ablagestapel. |
| `aktion-abgeben.webp` | abgeben | grün (sammeln) | Gib 2 Zahlenkarten aus deiner Hand an eine oder mehrere Personen. |
| `aktion-alle-geben.webp` | alle-geben | grün (sammeln) | Jede Person gibt dir eine der eigenen Handkarten. |
| `aktion-alle-ablegen.webp` | alle-ablegen | grün (sammeln) | Beginnend bei der aktiven Person legen alle eine Zahlenkarte auf einen der Ablagestapel. |
| `aktion-alle-ziehen.webp` | alle-ziehen | grün (sammeln) | Beginnend bei der aktiven Person ziehen alle eine Karte vom verdeckten Stapel. |
| `aktion-fordern.webp` | fordern | grün (sammeln) | Fordere von einer Person eine bestimmte Zahlenkarte (z. B. eine blaue 5). Die Person hat sie nicht? Dumm gelaufen. |
| `aktion-tausch-alles.webp` | tausch-alles | grün (sammeln) | Tausche deine Handkarten und deine Murphykarte mit einer Person. |
| `aktion-basar-auffuellen.webp` | basar-auffuellen | grün (sammeln) | Lege so viele Zahlenkarten bei Mac ab, dass er wieder 7 hat. |
| `aktion-murphy-tausch.webp` | murphy-tausch | grün (sammeln) | Tausche deine Murphykarte mit einer Person. |

Die Rückseite ist `rueckseite.webp`.
