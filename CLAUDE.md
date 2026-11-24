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
