# CLAUDE.md

Skat-Online: Skat für 3/4 Spieler an verschiedenen PCs. Siehe README.md für Aufbau und Deploy.

- Spiellogik nur in `public/skatlogik.js` ändern (Master); `functions/skatlogik.js` ist eine Kopie (`node tools/kopiere-logik.js`, läuft auch als predeploy).
- Logik-Aktionen müssen erst prüfen, dann ändern (abgelehnte Aktion darf `welt` nicht verändern).
- Das öffentliche Tischdokument darf nie Handkarten oder den Skat enthalten (Test in `tests/function.test.js`). Der Skat wird erst im `ergebnis` nach Spielende veröffentlicht.
- Firestore-Regeln liegen nicht hier, sondern in `C:\Skat_Spieltag\4erListe\Neuer Ordner\firestore.rules` (Block „Skat-Online“).
- Nach Änderungen: `npm test` und Übungsmodus `?demo` prüfen.
- Alle Texte und Kommentare auf Deutsch.
- Kartenblatt wählbar (`kartenStil`, localStorage `skatonline_karten`): `altenburger` (Standard) = Bilder aus Firestore `skatonline_kartenbilder/<Farbe>-<Wert>` {daten: Bytes} (nur Mitglieder lesen, Admin lädt in der Verwaltung hoch; `ladeKartenbilder`), `eigen` = SVG aus `public/kartenbild.js` (Ersatz ohne Bilder, Übungsmodus). Beide Möglichkeiten erhalten. Die ASS-Altenburger-Bilder (`cards/`) dürfen NIE ins öffentliche Repo oder nach `public/` (`.gitignore`). Rückseite immer SVG (`--ruecken`). Vorschau: `karten.html`.
- Privater Zugang: Admin-UID, Sintherner Spielleiter oder `skatonline_mitglieder/<uid>`; geprüft in `hatZugang` (Function), `pruefeZugang` (Seite) und `istSkatMitglied()` (Regeln). Anträge `skatonline_antraege/<uid>`, Verwaltung in der Übersicht.
- Veröffentlichung: GitHub `FrankBertram/Skat-Online` (öffentlich), Pages „Deploy from a branch“ (main, Root); `index.html` im Root leitet auf `public/` weiter, `.nojekyll`.
- Tischlayout (`public/index.html`): am Tisch `body.amTisch` = feste Fensterhöhe, feste Rasterreihen (Infoleiste 44 px, Sitzreihe 126 px, Mitte Rest, Hand = Kartenhöhe + 28 px) – der grüne Tisch darf seine Größe nie ändern (kein Springen). Kartengröße `--kb-spiel` (Hand = Stich). Unter 900 px Breite / 540 px Höhe scrollt die Seite stattdessen (Media-Query). Nach Layout-Änderungen im Übungsmodus über ein ganzes Spiel prüfen, dass Positionen gleich bleiben.
- Sitzordnung (`positionen`, `unterePerson`): aktive Spieler unten / oben links / oben rechts, Geber am 4er-Tisch im Uhrzeigersinn dazwischen (`linksMitte`, `oben`, `rechtsMitte`); gibt man selbst, sitzt unten die Vorhand (verdeckt). Stichkarten liegen vor dem Platz (`s-unten`, `s-links`, `s-rechts`).
- Spielbereit/Pause (`bereitMelden`, Aktionen `bereit` / `pause`, Felder `tisch.bereit`, `tisch.pause`): nächstes Spiel erst, wenn alle Plätze bereit sind; Pause bleibt bis zum nächsten „Spielbereit“. Es gibt keine Aktion `weiter` mehr.
- Function-Aktionen außerhalb der Logik (`functions/index.js`): `ping` (schreibt nur `tisch.gesehen[platz]`, Seite zeigt nach 100 s „offline“; `tischGeaendert` zeichnet bei reinem Lebenszeichen nur die Sitze neu), `mitgliedHinzufuegen` (nur Verwalter, per E-Mail/UID über Admin-Auth), Aufräumen alter Tische (30 Tage, in `tischAnlegen`).
- Nach Änderungen an `skatlogik.js`/`kartenbild.js` die Versionsnummer `?v=…` in den `<script>`-Tags von `public/index.html` erhöhen (Browser-Cache) und die Function neu deployen: `firebase deploy --only functions:skatonline --project skatverein-b77ef`.
