/* ═══════════════════════════════════════════════════════════════════
   Skat-Online – gemeinsame Spiellogik
   Läuft unverändert im Browser (window.SkatLogik, Testmodus ?demo)
   und in der Cloud Function (require('./skatlogik.js')).
   MASTER-DATEI: public/skatlogik.js – functions/skatlogik.js ist eine
   Kopie (wird vor jedem Deploy durch tools/kopiere-logik.js erzeugt).

   Spielregeln nach ISkO, Wertung nach Seeger-Fabian:
     gewonnen  : Alleinspieler + (Spielwert + 50)
     verloren  : Alleinspieler − (2 × Spielwert + 50),
                 alle anderen am Tisch je + 40 (3er-Tisch) / + 30 (4er-Tisch)
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  // ── Karten ──────────────────────────────────────────────────────
  // Karte = Farbe + Wert, z. B. 'cB' (Kreuz-Bube), 'hZ' (Herz-10)
  const FARBEN = ['c', 's', 'h', 'd'];                   // Kreuz, Pik, Herz, Karo
  const FARB_NAME = { c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' };
  const FARB_SYMBOL = { c: '♣', s: '♠', h: '♥', d: '♦' };
  const WERTE = ['7', '8', '9', 'Z', 'B', 'D', 'K', 'A'];
  const WERT_NAME = { '7': '7', '8': '8', '9': '9', Z: '10', B: 'B', D: 'D', K: 'K', A: 'A' };
  const AUGEN = { '7': 0, '8': 0, '9': 0, Z: 10, B: 2, D: 3, K: 4, A: 11 };

  // Rangfolge innerhalb einer Farbe (aufsteigend)
  const RANG_NORMAL = ['7', '8', '9', 'D', 'K', 'Z', 'A'];        // ohne Buben
  const RANG_NULL = ['7', '8', '9', 'Z', 'B', 'D', 'K', 'A'];
  const BUBEN_RANG = { d: 0, h: 1, s: 2, c: 3 };

  const SPIELARTEN = {
    kreuz: { farbe: 'c', basis: 12, name: 'Kreuz' },
    pik:   { farbe: 's', basis: 11, name: 'Pik' },
    herz:  { farbe: 'h', basis: 10, name: 'Herz' },
    karo:  { farbe: 'd', basis: 9,  name: 'Karo' },
    grand: { farbe: null, basis: 24, name: 'Grand' },
    null:  { farbe: null, basis: 0,  name: 'Null' }
  };

  // Alle möglichen Reizwerte 18 … 264
  const REIZWERTE = (function () {
    const s = new Set([23, 35, 46, 59]);
    [9, 10, 11, 12].forEach(b => { for (let m = 2; m <= 18; m++) s.add(b * m); });
    for (let m = 2; m <= 11; m++) s.add(24 * m);
    return Array.from(s).filter(w => w >= 18).sort((a, b) => a - b);
  })();

  class SkatFehler extends Error {
    constructor(msg) { super(msg); this.skatFehler = true; }
  }
  function fehler(msg) { throw new SkatFehler(msg); }

  const farbe = k => k[0];
  const wert = k => k[1];
  const augen = karten => karten.reduce((s, k) => s + AUGEN[wert(k)], 0);

  function alleKarten() {
    const r = [];
    FARBEN.forEach(f => WERTE.forEach(w => r.push(f + w)));
    return r;
  }

  // Kryptografisch sicherer Zufall (Node 20+ und Browser)
  function zufallInt(n) {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
    const max = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do { c.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }

  function mischen(karten) {
    const a = karten.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = zufallInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Trumpf, Bedienen, Stich ─────────────────────────────────────
  function istTrumpf(k, art) {
    if (art === 'null') return false;
    if (wert(k) === 'B') return true;
    const sa = SPIELARTEN[art];
    return !!(sa && sa.farbe && farbe(k) === sa.farbe);
  }

  // Farbe, die beim Bedienen zählt ('T' = Trumpf)
  function bedienFarbe(k, art) {
    return istTrumpf(k, art) ? 'T' : farbe(k);
  }

  function trumpfRang(k) {
    if (wert(k) === 'B') return 100 + BUBEN_RANG[farbe(k)];
    return RANG_NORMAL.indexOf(wert(k));
  }

  function farbRang(k, art) {
    return art === 'null' ? RANG_NULL.indexOf(wert(k)) : RANG_NORMAL.indexOf(wert(k));
  }

  // stich = [{ platz, karte }, …] (3 Karten); liefert den Platz des Gewinners
  function stichGewinner(stich, art) {
    let best = stich[0];
    for (let i = 1; i < stich.length; i++) {
      if (schlaegt(stich[i].karte, best.karte, stich[0].karte, art)) best = stich[i];
    }
    return best.platz;
  }

  // Schlägt Karte a die bisher höchste Karte b? (aus = ausgespielte Karte)
  function schlaegt(a, b, aus, art) {
    const ta = istTrumpf(a, art), tb = istTrumpf(b, art);
    if (ta && !tb) return true;
    if (!ta && tb) return false;
    if (ta && tb) return trumpfRang(a) > trumpfRang(b);
    const fa = bedienFarbe(aus, art);
    if (farbe(a) !== fa) return false;
    if (farbe(b) !== fa) return true;
    return farbRang(a, art) > farbRang(b, art);
  }

  // Welche Karten der Hand dürfen gespielt werden?
  function gueltigeKarten(hand, stich, art) {
    if (!stich || stich.length === 0) return hand.slice();
    const f = bedienFarbe(stich[0].karte, art);
    const passend = hand.filter(k => bedienFarbe(k, art) === f);
    return passend.length ? passend : hand.slice();
  }

  // Spitzen: { anzahl, mit } aus den 12 Karten des Alleinspielers
  function spitzen(karten, art) {
    const reihe = ['cB', 'sB', 'hB', 'dB'];
    const f = SPIELARTEN[art].farbe;
    if (f) ['A', 'Z', 'K', 'D', '9', '8', '7'].forEach(w => reihe.push(f + w));
    const mit = karten.includes(reihe[0]);
    let n = 0;
    while (n < reihe.length && karten.includes(reihe[n]) === mit) n++;
    return { anzahl: n, mit };
  }

  function nullWert(hand, ouvert) {
    return ouvert ? (hand ? 59 : 46) : (hand ? 35 : 23);
  }

  // Sortierung für die Anzeige der eigenen Hand
  function sortiereHand(karten, art) {
    const a = art || 'grand';
    const farbReihe = ['c', 's', 'h', 'd'];
    const sa = SPIELARTEN[a];
    let reihe = farbReihe;
    if (sa && sa.farbe) reihe = [sa.farbe].concat(farbReihe.filter(f => f !== sa.farbe));
    const schluessel = k => {
      if (a !== 'null' && wert(k) === 'B') return [0, 3 - BUBEN_RANG[farbe(k)]];
      const rang = a === 'null' ? RANG_NULL : RANG_NORMAL;
      return [1 + reihe.indexOf(farbe(k)), rang.length - rang.indexOf(wert(k))];
    };
    return karten.slice().sort((x, y) => {
      const kx = schluessel(x), ky = schluessel(y);
      return kx[0] - ky[0] || kx[1] - ky[1];
    });
  }

  function karteText(k) { return FARB_SYMBOL[farbe(k)] + WERT_NAME[wert(k)]; }

  function spielText(spiel) {
    if (!spiel) return '';
    const t = [SPIELARTEN[spiel.art].name];
    if (spiel.hand) t.push('Hand');
    if (spiel.art !== 'null') {
      if (spiel.schwarzAngesagt) t.push('Schwarz angesagt');
      else if (spiel.schneiderAngesagt) t.push('Schneider angesagt');
    }
    if (spiel.ouvert) t.push('ouvert');
    return t.join(' ');
  }

  // ── Tisch / Spielablauf ─────────────────────────────────────────
  // welt = { tisch, geheim, haende: [Karten je Platz] }
  //   tisch  : öffentliches Dokument (alle Mitspieler/Zuschauer)
  //   geheim : nur Server (Skat, Augen, Spitzen)
  //   haende : je Platz nur für den jeweiligen Spieler lesbar

  function neuerTisch(cfg) {
    const plaetze = cfg.plaetze === 3 ? 3 : 4;
    let maxSpiele = parseInt(cfg.maxSpiele, 10);
    if (!(maxSpiele >= 0)) maxSpiele = plaetze === 4 ? 48 : 36;
    return {
      tisch: {
        name: String(cfg.name || 'Skattisch').slice(0, 40),
        erstelltVon: cfg.uid || null,
        erstelltAm: Date.now(),
        aktualisiertMs: Date.now(),
        plaetze,
        maxSpiele,
        spieler: new Array(plaetze).fill(null),
        uids: [],
        status: 'warten',
        phase: 'warten',
        spielNr: 0,
        geber: null,
        aktive: [],
        amZug: null,
        reizen: null,
        alleinspieler: null,
        reizwert: 0,
        skatAufgenommen: false,
        spiel: null,
        stich: [],
        stichNr: 0,
        letzterStich: null,
        stichZahl: new Array(plaetze).fill(0),
        kartenAnzahl: new Array(plaetze).fill(0),
        offeneKarten: null,
        ergebnis: null,
        liste: [],
        log: 'Tisch angelegt',
        version: 0
      },
      geheim: {},
      haende: new Array(plaetze).fill(null).map(() => [])
    };
  }

  function name(t, p) { return (t.spieler[p] && t.spieler[p].name) || ('Platz ' + (p + 1)); }

  function beitreten(welt, uid, spielerName, wunschPlatz) {
    const t = welt.tisch;
    if (t.spieler.some(s => s && s.uid === uid)) return t.spieler.findIndex(s => s && s.uid === uid);
    if (t.status !== 'warten') fehler('Das Spiel an diesem Tisch läuft bereits.');
    let p = Number.isInteger(wunschPlatz) ? wunschPlatz : -1;
    if (p < 0 || p >= t.plaetze || t.spieler[p]) p = t.spieler.findIndex(s => !s);
    if (p < 0) fehler('Der Tisch ist voll.');
    t.spieler[p] = { uid, name: String(spielerName || 'Spieler').trim().slice(0, 20) || 'Spieler' };
    t.uids = t.spieler.filter(Boolean).map(s => s.uid);
    t.log = name(t, p) + ' hat Platz ' + (p + 1) + ' genommen';
    return p;
  }

  function verlassen(welt, platz) {
    const t = welt.tisch;
    if (t.status !== 'warten') fehler('Während des Spiels kann der Platz nicht verlassen werden.');
    t.log = name(t, platz) + ' hat den Tisch verlassen';
    t.spieler[platz] = null;
    t.uids = t.spieler.filter(Boolean).map(s => s.uid);
  }

  function starten(welt) {
    const t = welt.tisch;
    if (t.status !== 'warten') fehler('Das Spiel läuft bereits.');
    if (t.spieler.some(s => !s)) fehler('Es sind noch nicht alle Plätze besetzt.');
    t.status = 'laeuft';
    t.geber = zufallInt(t.plaetze);
    geben(welt);
  }

  // Vorhand, Mittelhand, Hinterhand zum aktuellen Geber
  function aktiveSitze(plaetze, geber) {
    return plaetze === 4
      ? [(geber + 1) % 4, (geber + 2) % 4, (geber + 3) % 4]
      : [(geber + 1) % 3, (geber + 2) % 3, geber];
  }

  function geben(welt) {
    const t = welt.tisch;
    const deck = mischen(alleKarten());
    const aktive = aktiveSitze(t.plaetze, t.geber);
    welt.haende = new Array(t.plaetze).fill(null).map(() => []);
    aktive.forEach((p, i) => { welt.haende[p] = deck.slice(i * 10, i * 10 + 10); });
    welt.geheim = { skat: deck.slice(30, 32), gedrueckt: [], augenAllein: 0, augenGegner: 0, spitzen: null };
    t.spielNr += 1;
    t.phase = 'reizen';
    t.aktive = aktive;
    t.reizen = { stufe: 1, sager: aktive[1], hoerer: aktive[0], wert: 0, frage: 'sagen', gepasst: [] };
    t.amZug = aktive[1];
    t.alleinspieler = null;
    t.reizwert = 0;
    t.skatAufgenommen = false;
    t.spiel = null;
    t.stich = [];
    t.stichNr = 0;
    t.letzterStich = null;
    t.stichZahl = new Array(t.plaetze).fill(0);
    t.kartenAnzahl = welt.haende.map(h => h.length);
    t.offeneKarten = null;
    t.anspruch = null;
    t.ergebnis = null;
    t.log = 'Spiel ' + t.spielNr + ': ' + name(t, t.geber) + ' hat gegeben' +
      (t.plaetze === 4 ? ' und setzt aus' : '');
  }

  // ── Reizen ──────────────────────────────────────────────────────
  function reizAktion(welt, platz, a) {
    const t = welt.tisch, r = t.reizen;
    if (platz !== t.amZug) fehler('Du bist beim Reizen nicht an der Reihe.');
    if (a.typ === 'sagen') {
      if (r.frage !== 'sagen' || platz !== r.sager) fehler('Du kannst jetzt nicht sagen.');
      const w = parseInt(a.wert, 10);
      if (!REIZWERTE.includes(w) || w <= r.wert) fehler('Ungültiger Reizwert.');
      r.wert = w;
      r.frage = 'hoeren';
      t.amZug = r.hoerer;
      t.log = name(t, platz) + ' sagt ' + w;
      return;
    }
    if (a.typ === 'ja') {
      if (r.frage === 'hoeren' && platz === r.hoerer) {
        r.frage = 'sagen';
        t.amZug = r.sager;
        t.log = name(t, platz) + ': ja (' + r.wert + ')';
        return;
      }
      if (r.frage === 'achtzehn' && platz === r.hoerer) {
        r.wert = 18;
        t.log = name(t, platz) + ' spielt für 18';
        return alleinspielerFestlegen(welt, platz);
      }
      fehler('Du kannst jetzt nicht „ja“ sagen.');
    }
    if (a.typ === 'passe') {
      let bleibt;
      if (r.frage === 'sagen' && platz === r.sager) bleibt = r.hoerer;
      else if (r.frage === 'hoeren' && platz === r.hoerer) bleibt = r.sager;
      else if (r.frage === 'achtzehn' && platz === r.hoerer) {
        r.gepasst = (r.gepasst || []).concat([platz]);
        t.log = name(t, platz) + ' passt – eingepasst';
        return eingepasst(welt);
      } else fehler('Du kannst jetzt nicht passen.');
      r.gepasst = (r.gepasst || []).concat([platz]);
      t.log = name(t, platz) + ' passt' + (r.wert ? ' (' + r.wert + ')' : '');
      if (r.stufe === 1) {
        r.stufe = 2;
        r.sager = t.aktive[2];
        r.hoerer = bleibt;
        r.frage = 'sagen';
        t.amZug = r.sager;
        return;
      }
      if (r.wert > 0) return alleinspielerFestlegen(welt, bleibt);
      // Mittel- und Hinterhand haben ohne Gebot gepasst: Vorhand darf 18 spielen
      r.stufe = 3;
      r.sager = null;
      r.hoerer = bleibt;
      r.frage = 'achtzehn';
      t.amZug = bleibt;
      return;
    }
    fehler('Unbekannte Aktion beim Reizen.');
  }

  function alleinspielerFestlegen(welt, platz) {
    const t = welt.tisch;
    t.alleinspieler = platz;
    t.reizwert = t.reizen.wert;
    t.phase = 'skataufnahme';
    t.amZug = platz;
    t.log += ' – ' + name(t, platz) + ' spielt (Reizwert ' + t.reizwert + ')';
  }

  function eingepasst(welt) {
    const t = welt.tisch;
    t.ergebnis = { eingepasst: true, skat: welt.geheim.skat.slice() };
    t.liste.push({
      nr: t.spielNr, geber: t.geber, alleinspieler: null, eingepasst: true,
      text: 'eingepasst', wert: 0, gewonnen: null, punkte: new Array(t.plaetze).fill(0)
    });
    spielEnde(welt);
  }

  function spielEnde(welt) {
    const t = welt.tisch;
    t.amZug = null;
    t.offeneKarten = null;
    t.anspruch = null;
    if (t.maxSpiele > 0 && t.spielNr >= t.maxSpiele) {
      t.phase = 'beendet';
      t.status = 'beendet';
      t.log += ' – Liste beendet';
    } else {
      t.phase = 'spielende';
    }
  }

  // ── Skat und Ansage ─────────────────────────────────────────────
  function skatAufnehmen(welt, platz) {
    const t = welt.tisch;
    if (t.phase !== 'skataufnahme' || platz !== t.alleinspieler) fehler('Du kannst den Skat jetzt nicht aufnehmen.');
    welt.haende[platz] = welt.haende[platz].concat(welt.geheim.skat);
    t.skatAufgenommen = true;
    t.phase = 'druecken';
    t.kartenAnzahl[platz] = welt.haende[platz].length;
    t.log = name(t, platz) + ' nimmt den Skat auf';
  }

  function ansagen(welt, platz, a) {
    const t = welt.tisch;
    if (platz !== t.alleinspieler || (t.phase !== 'skataufnahme' && t.phase !== 'druecken')) {
      fehler('Du kannst jetzt kein Spiel ansagen.');
    }
    const art = a.art;
    if (!SPIELARTEN[art]) fehler('Unbekannte Spielart.');
    const hand = t.phase === 'skataufnahme';
    let ouvert = !!a.ouvert, schwarz = !!a.schwarz, schneider = !!a.schneider || schwarz;
    // erst alles prüfen, dann ändern (abgelehnte Ansage darf nichts verändern)
    if (art === 'null') {
      schneider = false; schwarz = false;
    } else {
      if (ouvert) { schneider = true; schwarz = true; }
      if ((schneider || schwarz || ouvert) && !hand) fehler('Schneider, Schwarz und Ouvert können nur bei Handspielen angesagt werden.');
    }
    let gedrueckt;
    if (hand) {
      gedrueckt = welt.geheim.skat.slice();
    } else {
      const d = Array.isArray(a.druecken) ? a.druecken : [];
      const h = welt.haende[platz];
      if (d.length !== 2 || d[0] === d[1] || !d.every(k => h.includes(k))) fehler('Bitte genau zwei Karten zum Drücken wählen.');
      gedrueckt = d.slice();
      welt.haende[platz] = h.filter(k => !d.includes(k));
    }
    t.spiel = { art, hand, schneiderAngesagt: schneider, schwarzAngesagt: schwarz, ouvert };
    welt.geheim.gedrueckt = gedrueckt;
    welt.geheim.augenAllein = augen(gedrueckt);
    welt.geheim.augenGegner = 0;
    welt.geheim.spitzen = art === 'null' ? null : spitzen(welt.haende[platz].concat(gedrueckt), art);
    t.phase = 'spielen';
    t.amZug = t.aktive[0];
    t.stich = [];
    t.kartenAnzahl[platz] = welt.haende[platz].length;
    t.offeneKarten = ouvert ? sortiereHand(welt.haende[platz], art) : null;
    t.log = name(t, platz) + ' spielt ' + spielText(t.spiel);
  }

  // ── Kartenspiel ─────────────────────────────────────────────────
  function karteSpielen(welt, platz, karte) {
    const t = welt.tisch;
    if (t.phase !== 'spielen') fehler('Es wird gerade nicht gespielt.');
    if (t.anspruch) fehler('Erst über die gezeigten Karten entscheiden.');
    if (platz !== t.amZug) fehler('Du bist nicht am Zug.');
    const hand = welt.haende[platz];
    if (!hand.includes(karte)) fehler('Diese Karte hast du nicht.');
    const art = t.spiel.art;
    if (!gueltigeKarten(hand, t.stich, art).includes(karte)) fehler('Du musst bedienen.');
    welt.haende[platz] = hand.filter(k => k !== karte);
    t.kartenAnzahl[platz] = welt.haende[platz].length;
    if (t.offeneKarten && platz === t.alleinspieler) t.offeneKarten = t.offeneKarten.filter(k => k !== karte);
    t.stich.push({ platz, karte });
    t.log = name(t, platz) + ' spielt ' + karteText(karte);
    if (t.stich.length < 3) {
      t.amZug = t.aktive[(t.aktive.indexOf(platz) + 1) % 3];
      return;
    }
    const g = stichGewinner(t.stich, art);
    const a = augen(t.stich.map(s => s.karte));
    if (g === t.alleinspieler) welt.geheim.augenAllein += a; else welt.geheim.augenGegner += a;
    t.stichZahl[g] += 1;
    t.stichNr += 1;
    t.letzterStich = { karten: t.stich.slice(), gewinner: g, nr: t.stichNr };
    t.stich = [];
    t.amZug = g;
    t.log = name(t, g) + ' bekommt den Stich';
    if (t.stichNr >= 10 || (art === 'null' && g === t.alleinspieler)) abrechnen(welt);
  }

  // ── Karten zeigen (Rest beanspruchen) und Aufgabe ──────────────
  // Alle noch nicht gewerteten Karten (Hände + angefangener Stich) einer Partei
  // zuschlagen; der angefangene Stich zählt als Stich.
  function restVerteilen(welt, anAllein) {
    const t = welt.tisch, g = welt.geheim;
    let karten = t.stich.map(x => x.karte);
    t.aktive.forEach(p => { karten = karten.concat(welt.haende[p]); welt.haende[p] = []; t.kartenAnzahl[p] = 0; });
    const restStiche = 10 - t.stichNr;
    const a = augen(karten);
    const gegner = t.aktive.filter(p => p !== t.alleinspieler);
    if (anAllein) { g.augenAllein += a; t.stichZahl[t.alleinspieler] += restStiche; }
    else { g.augenGegner += a; t.stichZahl[gegner[0]] += restStiche; }
    t.stich = [];
    t.stichNr = 10;
  }

  function kartenZeigen(welt, platz) {
    const t = welt.tisch;
    if (t.phase !== 'spielen' || platz !== t.alleinspieler) fehler('Nur der Alleinspieler kann seine Karten zeigen.');
    if (t.anspruch) fehler('Die Karten sind bereits gezeigt.');
    t.anspruch = { von: platz, zustimmung: [] };
    t.offeneKarten = sortiereHand(welt.haende[platz], t.spiel.art);
    t.log = name(t, platz) + ' zeigt die Karten und ' +
      (t.spiel.art === 'null' ? 'beansprucht, keinen Stich mehr zu bekommen' : 'beansprucht alle restlichen Stiche');
  }

  function anspruchBeantworten(welt, platz, ja) {
    const t = welt.tisch;
    if (!t.anspruch) fehler('Es wurden keine Karten gezeigt.');
    if (!t.aktive.includes(platz) || platz === t.alleinspieler) fehler('Nur die Gegenspieler entscheiden über die gezeigten Karten.');
    if (t.anspruch.zustimmung.includes(platz)) fehler('Du hast bereits zugestimmt.');
    if (!ja) {
      t.anspruch = null;   // Karten bleiben offen liegen, es wird weitergespielt
      t.log = name(t, platz) + ' ist nicht einverstanden – es wird weitergespielt';
      return;
    }
    t.anspruch.zustimmung = t.anspruch.zustimmung.concat([platz]);
    t.log = name(t, platz) + ' ist einverstanden';
    if (t.anspruch.zustimmung.length < 2) return;
    const allein = t.alleinspieler;
    restVerteilen(welt, t.spiel.art !== 'null');   // Null: Rest an die Gegenspieler
    t.ergebnisZusatz = 'Rest beansprucht';
    t.log = name(t, allein) + ': Rest beansprucht';
    abrechnen(welt);
  }

  function aufgeben(welt, platz) {
    const t = welt.tisch;
    if (t.phase !== 'spielen' || platz !== t.alleinspieler) fehler('Nur der Alleinspieler kann aufgeben.');
    // Aufgabe vor dem ersten Ausspiel: einfach verloren (ohne Schneider/Schwarz, außer angesagt)
    t.aufgabeEinfach = t.stichNr === 0 && t.stich.length === 0;
    restVerteilen(welt, false);
    t.aufgegeben = true;
    abrechnen(welt);
  }

  // ── Abrechnung ──────────────────────────────────────────────────
  // Liefert das Ergebnis eines beendeten Spiels (auch für Tests nutzbar)
  function bewerte(o) {
    // o = { art, hand, schneiderAngesagt, schwarzAngesagt, ouvert, reizwert,
    //       augenAllein, sticheAllein, alleinStichBekommen (Null), spitzen,
    //       aufgegeben, einfach (Aufgabe vor dem ersten Ausspiel) }
    const r = { ueberreizt: false, schneider: false, schwarz: false };
    if (o.art === 'null') {
      const nw = nullWert(o.hand, o.ouvert);
      r.gewonnen = !o.alleinStichBekommen && !o.aufgegeben;
      r.wert = nw;
      if (o.reizwert > nw) {
        r.gewonnen = false; r.ueberreizt = true;
        r.wert = Math.ceil(o.reizwert / nw) * nw;
      }
      return r;
    }
    const basis = SPIELARTEN[o.art].basis;
    const aa = o.augenAllein;
    r.schneider = aa >= 90 || aa <= 30;
    r.schwarz = o.sticheAllein === 10 || o.sticheAllein === 0;
    r.gewonnen = aa >= 61 && !o.aufgegeben;
    if (o.einfach) { r.schneider = false; r.schwarz = false; }
    if (o.schneiderAngesagt && aa < 90) r.gewonnen = false;
    if (o.schwarzAngesagt && o.sticheAllein < 10) r.gewonnen = false;
    let faktor = o.spitzen.anzahl + 1;
    if (o.hand) faktor += 1;
    if (r.schneider || o.schneiderAngesagt) faktor += 1;
    if (o.schneiderAngesagt) faktor += 1;
    if (r.schwarz || o.schwarzAngesagt) faktor += 1;
    if (o.schwarzAngesagt) faktor += 1;
    if (o.ouvert) faktor += 1;
    r.faktor = faktor;
    r.wert = basis * faktor;
    if (r.wert < o.reizwert) {
      r.gewonnen = false; r.ueberreizt = true;
      r.wert = Math.ceil(o.reizwert / basis) * basis;
    }
    return r;
  }

  function seegerPunkte(plaetze, allein, wertSpiel, gewonnen) {
    const p = new Array(plaetze).fill(0);
    if (gewonnen) {
      p[allein] = wertSpiel + 50;
    } else {
      p[allein] = -(2 * wertSpiel + 50);
      const bonus = plaetze === 3 ? 40 : 30;
      for (let i = 0; i < plaetze; i++) if (i !== allein) p[i] = bonus;
    }
    return p;
  }

  function abrechnen(welt) {
    const t = welt.tisch, g = welt.geheim, s = t.spiel;
    const allein = t.alleinspieler;
    const r = bewerte({
      art: s.art, hand: s.hand, schneiderAngesagt: s.schneiderAngesagt,
      schwarzAngesagt: s.schwarzAngesagt, ouvert: s.ouvert, reizwert: t.reizwert,
      augenAllein: g.augenAllein, sticheAllein: t.stichZahl[allein],
      alleinStichBekommen: t.stichZahl[allein] > 0, spitzen: g.spitzen,
      aufgegeben: !!t.aufgegeben, einfach: !!(t.aufgegeben && t.aufgabeEinfach)
    });
    const punkte = seegerPunkte(t.plaetze, allein, r.wert, r.gewonnen);
    let text = spielText(s);
    if (s.art !== 'null') {
      text += ' (' + (g.spitzen.mit ? 'mit ' : 'ohne ') + g.spitzen.anzahl + ')';
      if (!s.schwarzAngesagt && r.schwarz) text += ' Schwarz';
      else if (!s.schneiderAngesagt && r.schneider) text += ' Schneider';
    }
    if (r.ueberreizt) text += ' – überreizt';
    if (t.aufgegeben) text += ' – aufgegeben';
    else if (t.ergebnisZusatz) text += ' – ' + t.ergebnisZusatz;
    t.aufgegeben = false; t.aufgabeEinfach = false; t.ergebnisZusatz = null;
    t.ergebnis = {
      eingepasst: false,
      alleinspieler: allein,
      text,
      wert: r.wert,
      gewonnen: r.gewonnen,
      ueberreizt: r.ueberreizt,
      augenAllein: s.art === 'null' ? null : g.augenAllein,
      augenGegner: s.art === 'null' ? null : 120 - g.augenAllein,
      sticheAllein: t.stichZahl[allein],
      spitzen: g.spitzen,
      skat: g.skat.slice(),
      gedrueckt: g.gedrueckt.slice(),
      punkte
    };
    t.liste.push({
      nr: t.spielNr, geber: t.geber, alleinspieler: allein, eingepasst: false,
      text, wert: r.wert, gewonnen: r.gewonnen, reizwert: t.reizwert, punkte
    });
    t.log = name(t, allein) + (r.gewonnen ? ' gewinnt ' : ' verliert ') + text + ' – Wert ' + r.wert;
    spielEnde(welt);
  }

  function naechstesSpiel(welt) {
    const t = welt.tisch;
    if (t.phase !== 'spielende') fehler('Das aktuelle Spiel ist noch nicht beendet.');
    t.geber = (t.geber + 1) % t.plaetze;
    geben(welt);
  }

  // Seeger-Summen je Platz aus der Liste
  function summen(tisch) {
    const n = tisch.plaetze;
    const s = new Array(n).fill(null).map(() => ({ spielpunkte: 0, gewonnen: 0, verloren: 0, gesamt: 0 }));
    let verlorenGesamt = 0;
    (tisch.liste || []).forEach(e => {
      if (e.eingepasst || e.alleinspieler == null) return;
      const p = e.alleinspieler;
      if (e.gewonnen) { s[p].spielpunkte += e.wert; s[p].gewonnen++; }
      else { s[p].spielpunkte -= 2 * e.wert; s[p].verloren++; verlorenGesamt++; }
    });
    const bonus = n === 3 ? 40 : 30;
    s.forEach(x => {
      x.gesamt = x.spielpunkte + (x.gewonnen - x.verloren) * 50 + (verlorenGesamt - x.verloren) * bonus;
    });
    return s;
  }

  // ── Zentrale Aktion (vom Server und im Testmodus aufgerufen) ─────
  function aktion(welt, platz, a) {
    const t = welt.tisch;
    if (!a || !a.typ) fehler('Keine Aktion angegeben.');
    if (platz == null || platz < 0) fehler('Du sitzt nicht an diesem Tisch.');
    switch (a.typ) {
      case 'starten': starten(welt); break;
      case 'sagen': case 'ja': case 'passe':
        if (t.phase !== 'reizen') fehler('Es wird gerade nicht gereizt.');
        reizAktion(welt, platz, a); break;
      case 'aufnehmen': skatAufnehmen(welt, platz); break;
      case 'ansagen': ansagen(welt, platz, a); break;
      case 'karte': karteSpielen(welt, platz, String(a.karte || '')); break;
      case 'zeigen': kartenZeigen(welt, platz); break;
      case 'zustimmen': anspruchBeantworten(welt, platz, a.ja === true); break;
      case 'aufgeben': aufgeben(welt, platz); break;
      case 'weiter': naechstesSpiel(welt); break;
      default: fehler('Unbekannte Aktion: ' + a.typ);
    }
    t.version = (t.version || 0) + 1;
    t.aktualisiertMs = Date.now();
    return welt;
  }

  const SkatLogik = {
    FARBEN, FARB_NAME, FARB_SYMBOL, WERTE, WERT_NAME, AUGEN, SPIELARTEN, REIZWERTE,
    SkatFehler, alleKarten, mischen, istTrumpf, bedienFarbe, stichGewinner, gueltigeKarten,
    spitzen, nullWert, sortiereHand, karteText, spielText, augen, aktiveSitze,
    neuerTisch, beitreten, verlassen, starten, aktion, bewerte, seegerPunkte, summen
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SkatLogik;
  else root.SkatLogik = SkatLogik;
})(typeof window !== 'undefined' ? window : globalThis);
