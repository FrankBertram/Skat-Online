// Test der Cloud Function mit nachgebildetem Firestore (ohne Deploy):  node --test tests
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// ── Mini-Firestore im Speicher ─────────────────────────────────────
const daten = new Map();
const kopie = o => JSON.parse(JSON.stringify(o));
function docRef(pfad) {
  return {
    pfad, id: pfad.split('/').pop(),
    get: async () => snap(docRef(pfad)),
    collection: name => ({ doc: id => docRef(pfad + '/' + name + '/' + id) })
  };
}
const snap = ref => ({ exists: daten.has(ref.pfad), data: () => kopie(daten.get(ref.pfad)) });
const fakeDb = {
  settings() {},
  collection: name => ({ doc: id => docRef(name + '/' + id) }),
  async runTransaction(fn) {
    const schreiben = [];
    const tx = {
      get: async ref => snap(ref),
      set: (ref, d) => schreiben.push(() => daten.set(ref.pfad, kopie(d))),
      delete: ref => schreiben.push(() => daten.delete(ref.pfad))
    };
    const r = await fn(tx);
    schreiben.forEach(w => w());
    return r;
  }
};
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'firebase-admin/app') return { initializeApp() {} };
  if (req === 'firebase-admin/firestore') return { getFirestore: () => fakeDb };
  return orig.call(this, req, ...rest);
};
require('../tools/kopiere-logik.js');
const { skatAktion } = require('../functions/index.js');
const rufe = (uid, data) => skatAktion.run({ auth: { uid, token: { name: 'Spieler ' + uid, firebase: { sign_in_provider: 'google.com' } } }, data });

test('Function: nur freigeschaltete Mitglieder', async () => {
  await assert.rejects(rufe('fremd', { typ: 'tischAnlegen', name: 'X' }), /nicht freigeschaltet/);
  daten.set('spielleiter/garching1', { verein: 'garching' });
  await assert.rejects(rufe('garching1', { typ: 'tischAnlegen', name: 'X' }), /nicht freigeschaltet/);
  daten.set('spielleiter/sl1', {});           // Sintherner Spielleiter (ohne Feld verein)
  const r = await rufe('sl1', { typ: 'tischAnlegen', name: 'X' });
  assert.ok(r.tischId);
});

test('Function: Tisch anlegen, beitreten, Geheimnisse bleiben getrennt', async () => {
  ['u0', 'u1', 'u2', 'u3', 'u4'].forEach(u => daten.set('skatonline_mitglieder/' + u, { name: u }));
  const { tischId } = await rufe('u0', { typ: 'tischAnlegen', name: 'Test', plaetze: 4, maxSpiele: 4 });
  assert.match(tischId, /^[A-Z2-9]{6}$/);
  for (const u of ['u1', 'u2', 'u3']) await rufe(u, { typ: 'beitreten', tischId });
  await assert.rejects(rufe('u4', { typ: 'beitreten', tischId }), /voll/);
  await assert.rejects(rufe('u4', { typ: 'starten', tischId }), /nicht an diesem Tisch/);
  await rufe('u2', { typ: 'starten', tischId });

  const tisch = () => daten.get('skatonline_tische/' + tischId);
  const hand = u => daten.get('skatonline_tische/' + tischId + '/haende/' + u).karten;
  const t = tisch();
  assert.strictEqual(t.status, 'laeuft');
  // öffentliches Dokument enthält keine Karten
  const oeffentlich = JSON.stringify(t);
  assert.ok(!/"[cshd][789ZBDKA]"/.test(oeffentlich), 'Karten im öffentlichen Dokument!');
  // Geber hat keine Karten, die anderen je 10, Skat im geheimen Dokument
  const uids = t.spieler.map(s => s.uid);
  assert.strictEqual(hand(uids[t.geber]).length, 0);
  t.aktive.forEach(p => assert.strictEqual(hand(uids[p]).length, 10));
  assert.strictEqual(daten.get('skatonline_tische/' + tischId + '/geheim/stand').skat.length, 2);

  // Anonym angemeldete Geräte dürfen nicht spielen
  await assert.rejects(skatAktion.run({ auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } }, data: { typ: 'tischAnlegen' } }), /Google/);

  // 4 Spiele komplett durchspielen (alle passen bis auf Vorhand → 18 Grand)
  const S = require('../public/skatlogik.js');
  for (let spiel = 0; spiel < 4; spiel++) {
    let x = tisch();
    const u = p => uids[p];
    await rufe(u(x.aktive[1]), { typ: 'passe', tischId });
    await rufe(u(x.aktive[2]), { typ: 'passe', tischId });
    await rufe(u(x.aktive[0]), { typ: 'ja', tischId });
    await rufe(u(x.aktive[0]), { typ: 'aufnehmen', tischId });
    assert.strictEqual(hand(u(x.aktive[0])).length, 12);
    await rufe(u(x.aktive[0]), { typ: 'ansagen', tischId, art: 'grand', druecken: hand(u(x.aktive[0])).slice(0, 2) });
    // Falscher Spieler / ungültige Karte werden abgelehnt
    const nichtDran = x.aktive[1];
    await assert.rejects(rufe(u(nichtDran), { typ: 'karte', tischId, karte: hand(u(nichtDran))[0] }), /nicht am Zug/);
    while (tisch().phase === 'spielen') {
      x = tisch();
      const p = x.amZug;
      const k = S.gueltigeKarten(hand(u(p)), x.stich, 'grand')[0];
      await rufe(u(p), { typ: 'karte', tischId, karte: k });
    }
    for (let q = 0; q < 4; q++) if (tisch().phase === 'spielende') await rufe(u(q), { typ: 'bereit', tischId });
  }
  assert.strictEqual(tisch().phase, 'beendet');
  assert.strictEqual(tisch().liste.length, 4);
  await assert.rejects(rufe('u0', { typ: 'bereit', tischId }), /beendet/);
  await assert.rejects(rufe('u0', { typ: 'weiter', tischId }), /beendet/);

  // Lebenszeichen schreibt nur „gesehen“
  const neu = await rufe('u0', { typ: 'tischAnlegen', name: 'Ping', plaetze: 3 });
  await rufe('u0', { typ: 'ping', tischId: neu.tischId });
  const g = daten.get('skatonline_tische/' + neu.tischId).gesehen;
  assert.ok(g && g[0] > 0);
  // Mitglieder freischalten dürfen nur Spielleiter
  await assert.rejects(rufe('u1', { typ: 'mitgliedHinzufuegen', wer: 'x@example.org' }), /Nur Spielleiter/);
});
