// Tests der Spiellogik:  node --test tests
const test = require('node:test');
const assert = require('node:assert');
const S = require('../public/skatlogik.js');

test('Reizwerte', () => {
  assert.deepStrictEqual(S.REIZWERTE.slice(0, 12), [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44]);
  assert.ok(!S.REIZWERTE.includes(21));
  assert.strictEqual(S.REIZWERTE[S.REIZWERTE.length - 1], 264);
});

test('Stichgewinner', () => {
  const st = (...k) => k.map((karte, i) => ({ platz: i, karte }));
  assert.strictEqual(S.stichGewinner(st('hA', 'hZ', 'hK'), 'kreuz'), 0);
  assert.strictEqual(S.stichGewinner(st('hA', 'c7', 'hK'), 'kreuz'), 1);   // Trumpf sticht
  assert.strictEqual(S.stichGewinner(st('c7', 'dB', 'cA'), 'kreuz'), 1);   // Bube > Ass
  assert.strictEqual(S.stichGewinner(st('dB', 'cB', 'sB'), 'grand'), 1);
  assert.strictEqual(S.stichGewinner(st('hA', 'sA', 'hZ'), 'grand'), 0);   // abwerfen sticht nicht
  assert.strictEqual(S.stichGewinner(st('hZ', 'hB', 'h9'), 'null'), 1);    // Null: B > 10
  assert.strictEqual(S.stichGewinner(st('h7', 'cB', 'h8'), 'null'), 2);
});

test('Bedienen', () => {
  const hand = ['cB', 'hA', 'h7', 'sZ'];
  // Herz-Spiel: Trumpf ausgespielt → Bube oder Herz
  assert.deepStrictEqual(S.gueltigeKarten(hand, [{ platz: 0, karte: 'dB' }], 'herz').sort(), ['cB', 'h7', 'hA']);
  // Grand: Herz ausgespielt → nur Herz (Bube ist Trumpf)
  assert.deepStrictEqual(S.gueltigeKarten(hand, [{ platz: 0, karte: 'hK' }], 'grand').sort(), ['h7', 'hA']);
  // Null: Bube gehört zur Farbe
  assert.deepStrictEqual(S.gueltigeKarten(hand, [{ platz: 0, karte: 'c9' }], 'null'), ['cB']);
  // Karo ausgespielt, keins da → alles
  assert.strictEqual(S.gueltigeKarten(hand, [{ platz: 0, karte: 'd9' }], 'grand').length, 4);
});

test('Spitzen', () => {
  assert.deepStrictEqual(S.spitzen(['cB', 'sB', 'dB', 'hA'], 'herz'), { anzahl: 2, mit: true });
  assert.deepStrictEqual(S.spitzen(['hB', 'dB'], 'grand'), { anzahl: 2, mit: false });
  assert.deepStrictEqual(S.spitzen(['cB', 'sB', 'hB', 'dB', 'cA', 'cZ', 'c9'], 'kreuz'), { anzahl: 6, mit: true });
});

test('Bewertung', () => {
  const basis = { hand: false, schneiderAngesagt: false, schwarzAngesagt: false, ouvert: false };
  // Grand mit 1, gewonnen 70 Augen: 24 × 2 = 48
  let r = S.bewerte({ ...basis, art: 'grand', reizwert: 18, augenAllein: 70, sticheAllein: 6, spitzen: { anzahl: 1, mit: true } });
  assert.strictEqual(r.wert, 48); assert.ok(r.gewonnen);
  // Herz ohne 2, Hand, Schneider: 10 × (2+1+1+1) = 50
  r = S.bewerte({ ...basis, art: 'herz', hand: true, reizwert: 18, augenAllein: 95, sticheAllein: 8, spitzen: { anzahl: 2, mit: false } });
  assert.strictEqual(r.wert, 50); assert.ok(r.gewonnen);
  // Überreizt: Karo mit 1 (18) bei Reizwert 20 → verloren, Wert 27
  r = S.bewerte({ ...basis, art: 'karo', reizwert: 20, augenAllein: 80, sticheAllein: 7, spitzen: { anzahl: 1, mit: true } });
  assert.ok(!r.gewonnen); assert.ok(r.ueberreizt); assert.strictEqual(r.wert, 27);
  // 60 Augen verloren
  r = S.bewerte({ ...basis, art: 'pik', reizwert: 18, augenAllein: 60, sticheAllein: 5, spitzen: { anzahl: 1, mit: true } });
  assert.ok(!r.gewonnen); assert.strictEqual(r.wert, 22);
  // Grand ouvert mit 4 schwarz: 24 × (4+1+1+1+1+1+1+1) = 264
  r = S.bewerte({ art: 'grand', hand: true, schneiderAngesagt: true, schwarzAngesagt: true, ouvert: true, reizwert: 18, augenAllein: 120, sticheAllein: 10, spitzen: { anzahl: 4, mit: true } });
  assert.strictEqual(r.wert, 264); assert.ok(r.gewonnen);
  // Null Hand gewonnen / Null überreizt
  r = S.bewerte({ ...basis, art: 'null', hand: true, reizwert: 33, alleinStichBekommen: false });
  assert.strictEqual(r.wert, 35); assert.ok(r.gewonnen);
  r = S.bewerte({ ...basis, art: 'null', reizwert: 24, alleinStichBekommen: false });
  assert.ok(!r.gewonnen); assert.strictEqual(r.wert, 46);
});

test('Seeger-Punkte', () => {
  assert.deepStrictEqual(S.seegerPunkte(4, 1, 48, true), [0, 98, 0, 0]);
  assert.deepStrictEqual(S.seegerPunkte(4, 1, 48, false), [30, -146, 30, 30]);
  assert.deepStrictEqual(S.seegerPunkte(3, 0, 24, false), [-98, 40, 40]);
});

// ── Simulation ganzer Listen mit zufälligen (gültigen) Zügen ─────
function zufall(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function spieleListe(plaetze) {
  const welt = S.neuerTisch({ name: 'Test', plaetze, maxSpiele: plaetze === 4 ? 48 : 36, uid: 'u0' });
  for (let i = 0; i < plaetze; i++) S.beitreten(welt, 'u' + i, 'Spieler ' + (i + 1), i);
  S.aktion(welt, 0, { typ: 'starten' });
  let schritte = 0;
  while (welt.tisch.phase !== 'beendet') {
    if (++schritte > 100000) throw new Error('Endlosschleife');
    const t = welt.tisch;
    if (t.phase === 'spielende') {
      // Prüfungen nach jedem Spiel
      const e = t.ergebnis;
      if (!e.eingepasst) {
        assert.strictEqual(e.augenAllein === null || e.augenAllein + e.augenGegner === 120, true);
      }
      S.aktion(welt, zufall([0, 1, 2].slice(0, plaetze)), { typ: 'weiter' });
      continue;
    }
    const p = t.amZug;
    if (t.phase === 'reizen') {
      // Geber am 4er-Tisch darf nie gefragt werden
      if (plaetze === 4) assert.notStrictEqual(p, t.geber);
      const r = t.reizen;
      if (r.frage === 'sagen') {
        const moegl = S.REIZWERTE.filter(w => w > r.wert && w <= 60);
        if (moegl.length && Math.random() < 0.5) S.aktion(welt, p, { typ: 'sagen', wert: moegl[0] });
        else S.aktion(welt, p, { typ: 'passe' });
      } else S.aktion(welt, p, { typ: Math.random() < 0.6 ? 'ja' : 'passe' });
    } else if (t.phase === 'skataufnahme') {
      if (Math.random() < 0.7) S.aktion(welt, p, { typ: 'aufnehmen' });
      else {
        const art = zufall(Object.keys(S.SPIELARTEN));
        const ouvert = Math.random() < 0.1;
        S.aktion(welt, p, { typ: 'ansagen', art, ouvert, schneider: Math.random() < 0.1 });
      }
    } else if (t.phase === 'druecken') {
      assert.strictEqual(welt.haende[p].length, 12);
      const h = S.mischen(welt.haende[p]);
      const art = zufall(Object.keys(S.SPIELARTEN));
      if (art !== 'null') assert.throws(() => S.aktion(welt, p, { typ: 'ansagen', art, druecken: h.slice(0, 2), ouvert: true }), /Handspielen/);
      assert.strictEqual(welt.haende[p].length, 12);
      S.aktion(welt, p, { typ: 'ansagen', art, druecken: h.slice(0, 2), ouvert: art === 'null' && Math.random() < 0.2 });
    } else if (t.phase === 'spielen') {
      const g = S.gueltigeKarten(welt.haende[p], t.stich, t.spiel.art);
      assert.ok(g.length > 0);
      // ungültige Karte muss abgelehnt werden
      const ungueltig = welt.haende[p].find(k => !g.includes(k));
      if (ungueltig) assert.throws(() => S.aktion(welt, p, { typ: 'karte', karte: ungueltig }), /bedienen/);
      // falscher Spieler muss abgelehnt werden
      const anderer = t.aktive.find(x => x !== p);
      assert.throws(() => S.aktion(welt, anderer, { typ: 'karte', karte: welt.haende[anderer][0] }), /nicht am Zug/);
      S.aktion(welt, p, { typ: 'karte', karte: zufall(g) });
    } else throw new Error('Unerwartete Phase ' + t.phase);
  }
  return welt;
}

test('Simulation: 4er-Tisch, 20 Listen à 48 Spiele', () => {
  for (let n = 0; n < 20; n++) {
    const welt = spieleListe(4);
    const t = welt.tisch;
    assert.strictEqual(t.liste.length, 48);
    // Summen aus der Liste == Summe der Einzelpunkte
    const s = S.summen(t);
    for (let p = 0; p < 4; p++) {
      const einzel = t.liste.reduce((a, e) => a + e.punkte[p], 0);
      assert.strictEqual(s[p].gesamt, einzel);
    }
    // Jeder hat 12-mal gegeben
    const geber = [0, 0, 0, 0];
    t.liste.forEach(e => geber[e.geber]++);
    assert.deepStrictEqual(geber, [12, 12, 12, 12]);
  }
});

test('Simulation: 3er-Tisch', () => {
  for (let n = 0; n < 20; n++) {
    const t = spieleListe(3).tisch;
    assert.strictEqual(t.liste.length, 36);
    const s = S.summen(t);
    for (let p = 0; p < 3; p++) assert.strictEqual(s[p].gesamt, t.liste.reduce((a, e) => a + e.punkte[p], 0));
  }
});

test('Reizen: alle passen → eingepasst, Vorhand spielt 18', () => {
  const welt = S.neuerTisch({ plaetze: 4 });
  for (let i = 0; i < 4; i++) S.beitreten(welt, 'u' + i, 'S' + i, i);
  S.aktion(welt, 0, { typ: 'starten' });
  const [vh, mh, hh] = welt.tisch.aktive;
  S.aktion(welt, mh, { typ: 'passe' });
  assert.strictEqual(welt.tisch.amZug, hh);
  S.aktion(welt, hh, { typ: 'passe' });
  assert.strictEqual(welt.tisch.reizen.frage, 'achtzehn');
  assert.strictEqual(welt.tisch.amZug, vh);
  S.aktion(welt, vh, { typ: 'ja' });
  assert.strictEqual(welt.tisch.alleinspieler, vh);
  assert.strictEqual(welt.tisch.reizwert, 18);
});

test('Reizen: MH sagt, VH hält, HH reizt höher', () => {
  const welt = S.neuerTisch({ plaetze: 3 });
  for (let i = 0; i < 3; i++) S.beitreten(welt, 'u' + i, 'S' + i, i);
  S.aktion(welt, 0, { typ: 'starten' });
  const [vh, mh, hh] = welt.tisch.aktive;
  S.aktion(welt, mh, { typ: 'sagen', wert: 18 });
  assert.throws(() => S.aktion(welt, mh, { typ: 'sagen', wert: 20 }), /nicht an der Reihe/);
  S.aktion(welt, vh, { typ: 'ja' });
  S.aktion(welt, mh, { typ: 'sagen', wert: 20 });
  S.aktion(welt, vh, { typ: 'passe' });
  assert.strictEqual(welt.tisch.reizen.hoerer, mh);
  assert.strictEqual(welt.tisch.amZug, hh);
  assert.throws(() => S.aktion(welt, hh, { typ: 'sagen', wert: 20 }), /Ungültiger Reizwert/);
  S.aktion(welt, hh, { typ: 'sagen', wert: 22 });
  S.aktion(welt, mh, { typ: 'passe' });
  assert.strictEqual(welt.tisch.alleinspieler, hh);
  assert.strictEqual(welt.tisch.reizwert, 22);
  assert.strictEqual(welt.tisch.phase, 'skataufnahme');
  // Schneider angesagt ohne Hand ist verboten
  S.aktion(welt, hh, { typ: 'aufnehmen' });
  const h = welt.haende[hh];
  assert.throws(() => S.aktion(welt, hh, { typ: 'ansagen', art: 'grand', druecken: h.slice(0, 2), schneider: true }), /Handspielen/);
  S.aktion(welt, hh, { typ: 'ansagen', art: 'grand', druecken: h.slice(0, 2) });
  assert.strictEqual(welt.haende[hh].length, 10);
  assert.strictEqual(welt.tisch.amZug, vh);
});

// ── Karten zeigen und Aufgabe ─────────────────────────────────────
function spielBisAnsage(art, druecken = true) {
  const welt = S.neuerTisch({ plaetze: 4 });
  for (let i = 0; i < 4; i++) S.beitreten(welt, 'u' + i, 'S' + i, i);
  S.aktion(welt, 0, { typ: 'starten' });
  const [vh, mh, hh] = welt.tisch.aktive;
  S.aktion(welt, mh, { typ: 'passe' });
  S.aktion(welt, hh, { typ: 'passe' });
  S.aktion(welt, vh, { typ: 'ja' });
  if (druecken) {
    S.aktion(welt, vh, { typ: 'aufnehmen' });
    S.aktion(welt, vh, { typ: 'ansagen', art, druecken: welt.haende[vh].slice(0, 2) });
  } else S.aktion(welt, vh, { typ: 'ansagen', art });
  return { welt, vh, mh, hh };
}
function spieleKarten(welt, n) {
  for (let i = 0; i < n; i++) {
    const t = welt.tisch, p = t.amZug;
    S.aktion(welt, p, { typ: 'karte', karte: S.gueltigeKarten(welt.haende[p], t.stich, t.spiel.art)[0] });
  }
}

test('Karten zeigen: beide Gegner einverstanden → Rest an Alleinspieler', () => {
  const { welt, vh, mh, hh } = spielBisAnsage('grand');
  spieleKarten(welt, 4);                       // 1 Stich + 1 Karte im neuen Stich
  assert.throws(() => S.aktion(welt, mh, { typ: 'zeigen' }), /Nur der Alleinspieler/);
  S.aktion(welt, vh, { typ: 'zeigen' });
  assert.strictEqual(welt.tisch.offeneKarten.length, welt.haende[vh].length);
  assert.throws(() => S.aktion(welt, welt.tisch.amZug, { typ: 'karte', karte: welt.haende[welt.tisch.amZug][0] }), /entscheiden/);
  assert.throws(() => S.aktion(welt, vh, { typ: 'zustimmen', ja: true }), /Gegenspieler/);
  S.aktion(welt, mh, { typ: 'zustimmen', ja: true });
  assert.strictEqual(welt.tisch.phase, 'spielen');
  S.aktion(welt, hh, { typ: 'zustimmen', ja: true });
  const e = welt.tisch.ergebnis;
  assert.strictEqual(welt.tisch.phase, 'spielende');
  assert.strictEqual(e.augenAllein + e.augenGegner, 120);
  const sticheGes = welt.tisch.stichZahl.reduce((a, b) => a + b, 0);
  assert.strictEqual(sticheGes, 10);
  assert.match(e.text, /Rest beansprucht/);
});

test('Karten zeigen: Gegner lehnt ab → weiterspielen, Karten bleiben offen', () => {
  const { welt, vh, mh } = spielBisAnsage('herz');
  S.aktion(welt, vh, { typ: 'zeigen' });
  S.aktion(welt, mh, { typ: 'zustimmen', ja: false });
  assert.strictEqual(welt.tisch.anspruch, null);
  assert.ok(welt.tisch.offeneKarten.length === 10);
  spieleKarten(welt, 30);
  assert.strictEqual(welt.tisch.phase, 'spielende');
});

test('Null: gezeigt und angenommen → gewonnen', () => {
  const { welt, vh, mh, hh } = spielBisAnsage('null');
  S.aktion(welt, vh, { typ: 'zeigen' });
  S.aktion(welt, mh, { typ: 'zustimmen', ja: true });
  S.aktion(welt, hh, { typ: 'zustimmen', ja: true });
  assert.ok(welt.tisch.ergebnis.gewonnen);
  assert.strictEqual(welt.tisch.ergebnis.wert, 23);
});

test('Aufgabe vor dem ersten Ausspiel: einfach verloren', () => {
  const { welt, vh } = spielBisAnsage('grand');
  S.aktion(welt, vh, { typ: 'aufgeben' });
  const e = welt.tisch.ergebnis;
  assert.ok(!e.gewonnen);
  assert.match(e.text, /aufgegeben/);
  assert.doesNotMatch(e.text, /Schneider|Schwarz/);
  // Grand mit/ohne n: 24 × (n + 1), ohne Schneider-Stufe
  assert.strictEqual(e.wert, 24 * (e.spitzen.anzahl + 1));
  assert.strictEqual(welt.tisch.liste[0].punkte[vh], -(2 * e.wert + 50));
});

test('Aufgabe nach dem ersten Stich: verloren, Rest an Gegner', () => {
  const { welt, vh } = spielBisAnsage('kreuz');
  spieleKarten(welt, 3);
  S.aktion(welt, vh, { typ: 'aufgeben' });
  const e = welt.tisch.ergebnis;
  assert.ok(!e.gewonnen);
  assert.strictEqual(e.augenAllein + e.augenGegner, 120);
  assert.ok(e.augenAllein <= 30 + 30);   // nur erster Stich + Skat können beim Alleinspieler sein
});

test('Hand-Sortierung: Farben abwechselnd', () => {
  const hand = ['d7', 'sA', 'hK', 'cZ', 'hB', 'cB'];
  assert.deepStrictEqual(S.sortiereHand(hand, 'grand'), ['cB', 'hB', 'cZ', 'hK', 'sA', 'd7']);
  assert.deepStrictEqual(S.sortiereHand(hand, 'pik'), ['cB', 'hB', 'sA', 'd7', 'cZ', 'hK']);
  assert.deepStrictEqual(S.sortiereHand(hand, 'herz'), ['cB', 'hB', 'hK', 'sA', 'd7', 'cZ']);
  assert.deepStrictEqual(S.sortiereHand(hand, 'null'), ['cB', 'cZ', 'hK', 'hB', 'sA', 'd7']);  // Null: B über 10
});
