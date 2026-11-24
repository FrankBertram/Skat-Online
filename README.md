# Skat-Online

Skat für 3 oder 4 Spieler an verschiedenen PCs (1. Sintherner Skatclub).
Jeder sieht nur seine eigenen Karten. Am 4er-Tisch setzt der Geber aus und sieht
nur die gespielten Karten. Wertung nach Seeger-Fabian wie in der 4erListe.

## Aufbau

| Datei | Zweck |
|---|---|
| `public/index.html` | Webseite (Anmeldung, Übersicht, Tisch, Liste) |
| `public/kartenbild.js` | Eigene Kartengrafik als SVG (Turnierbild, 4 Farben; Rückseite) – Standard |
| `cards/` | ASS-Altenburger-Bilder – **nur lokal**, nicht im Repo (`.gitignore`); werden in Firestore hochgeladen |
| `public/karten.html` | Vorschau des eigenen Blatts |
| `public/skatlogik.js` | **Master** der Spiellogik (Reizen, Bedienen, Stiche, Spielwert, Seeger) – läuft im Browser und in der Function |
| `functions/index.js` | Cloud Function `skatAktion` (europe-west3): mischt, verteilt, prüft jeden Zug |
| `functions/skatlogik.js` | Kopie der Logik – wird vor jedem Deploy automatisch erzeugt (`tools/kopiere-logik.js`) |
| `tests/` | `npm test`: Regeln, Bewertung, 40 simulierte Listen, Function mit simuliertem Firestore |

Firestore (Projekt `skatverein-b77ef`):

- `skatonline_tische/{CODE}` – öffentlicher Tischzustand (alle angemeldeten Nutzer lesen)
- `skatonline_tische/{CODE}/haende/{uid}` – eigene Karten, nur der Spieler selbst liest
- `skatonline_tische/{CODE}/geheim/stand` – Skat, Augen, Spitzen: liest niemand außer der Function

Geschrieben wird **nur** von der Function (Admin SDK). Damit kann niemand fremde
Karten oder den Skat sehen oder ungültige Züge machen.

## Einrichten (einmalig)

1. **Firestore-Regeln**: Der Block „Skat-Online“ ist in
   `C:\Skat_Spieltag\4erListe\Neuer Ordner\firestore.rules` eingefügt
   (Sicherung: `firestore - vor Skat-Online.rules`). Die Regeln wie gewohnt in der
   Firebase-Konsole veröffentlichen.
2. **Firebase CLI** installieren und anmelden:
   ```
   npm install -g firebase-tools
   firebase login
   ```
3. **Function deployen** (aus diesem Ordner):
   ```
   cd C:\Temp\Skat-Online\functions
   npm install
   cd ..
   firebase deploy --only functions:skatonline
   ```
   Durch `"codebase": "skatonline"` in `firebase.json` werden andere Functions
   im Projekt nicht angefasst.
4. **Webseite**: GitHub-Repo `FrankBertram/Skat-Online`, GitHub Pages „Deploy from a branch“
   (`main`, Hauptverzeichnis). `index.html` im Hauptverzeichnis leitet auf `public/` weiter
   (Parameter wie `?tisch=CODE` bleiben erhalten) → https://frankbertram.github.io/Skat-Online/
5. **Kartenbilder hochladen** (einmalig, als Admin angemeldet): Übersicht → Verwaltung →
   „Kartenbilder ASS Altenburger“ → alle 32 PNG aus `C:\Temp\Skat-Online\cards` auswählen.

Die Domain `frankbertram.github.io` ist für die Google-Anmeldung schon freigegeben.

**Anmeldung ohne Google:** Auf der Startseite kann man sich einen Anmeldelink per E-Mail schicken lassen
(Firebase „E-Mail-Link“, ohne Passwort). Dafür muss in der Firebase Console unter
Authentication → Sign-in method der Anbieter **E-Mail/Passwort** mit der Option **E-Mail-Link (Anmeldung ohne Passwort)**
aktiviert sein. Die Freischaltung läuft wie bei Google-Konten über einen Antrag (mit Namensfeld).

## Privater Zugang

Spielen können nur der Admin, die Sintherner Spielleiter (`spielleiter/<uid>` ohne `verein`
oder `verein: 'sinthern'`) und freigeschaltete Mitglieder (`skatonline_mitglieder/<uid>`).
Wer sich ohne Freischaltung anmeldet, sieht nur „Freischaltung beantragen“ (Antrag in
`skatonline_antraege/<uid>`) und „✉️ Admin benachrichtigen“. Spielleiter/Admin schalten in der
Übersicht unter „Verwaltung“ frei oder entfernen Mitglieder. Die Cloud Function prüft den Zugang
bei jedem Aufruf (positives Ergebnis 5 Minuten zwischengespeichert), die Firestore-Regeln lassen
Tische und Kartenbilder nur Mitglieder lesen.

## Ausprobieren ohne Firebase

`npm run demo`, dann http://localhost:8771/?demo – alle 4 Plätze an einem PC
(Ansicht wechselt automatisch zum Spieler am Zug). `?demo=3` für den 3er-Tisch.

## Spielablauf

Tisch anlegen → Code bzw. Link an die Mitspieler → Plätze besetzen → „Spiel starten“
(erster Geber zufällig) → Reizen (Mittelhand sagt, Vorhand hört, dann Hinterhand) →
Skat aufnehmen und drücken oder Hand → Ansage (Farbe/Grand/Null, Schneider/Schwarz
angesagt und Ouvert nur bei Hand; Null ouvert auch mit Skat) → 10 Stiche →
Abrechnung → „Nächstes Spiel geben“. Nach der eingestellten Spielanzahl
(Standard 48 bzw. 36) ist die Liste beendet.

Neben der eigenen Hand: **Sortieren** wie Grand, Null, ♣, ♠, ♥ oder ♦, Farben abwechselnd schwarz/rot
(Kreuz, Herz, Pik, Karo; bei Farbspielen Trumpf vorn, dann reihum) (nach der Ansage
automatisch wie das angesagte Spiel). Der Alleinspieler hat im Spiel **🃏 Karten zeigen**
(beansprucht alle restlichen Stiche, bei Null: keinen Stich mehr; beide Gegenspieler müssen
zustimmen, sonst wird mit offenen Karten weitergespielt) und **🏳 Aufgeben** (verloren; die
restlichen Karten gehen an die Gegenspieler; vor dem ersten Ausspiel einfach verloren, ohne
Schneider/Schwarz außer angesagt).

Wertung: gewonnen +(Wert + 50); verloren −(2 × Wert + 50) und alle anderen am Tisch
+30 (4er) bzw. +40 (3er). Überreizt: verloren mit dem nächsten Vielfachen des
Grundwerts ≥ Reizwert. Eingepasste Spiele zählen als Spiel ohne Punkte.

## Kartenblatt

Oben rechts „Karten:“ – *ASS Altenburger* (Standard, nur nach Anmeldung als Mitglied verfügbar;
die Bilder kommen aus Firestore `skatonline_kartenbilder`) oder *Eigene (Turnierbild)*
(SVG, auch im Übungsmodus und als Ersatz, solange keine Bilder geladen sind); gespeichert pro Gerät
(`localStorage` `skatonline_karten`). Für das eigene Blatt im klassischen 2-Farben-Bild
in `kartenbild.js` `VIER_FARBEN = false` setzen.
