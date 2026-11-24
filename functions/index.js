/* ═══════════════════════════════════════════════════════════════════
   Skat-Online – Cloud Function „skatAktion“ (Region europe-west3)
   Einziger Schreibzugriff auf die Tische. Mischt, verteilt und prüft
   jeden Zug, damit niemand fremde Karten oder den Skat sehen kann.

   Firestore:
     skatonline_tische/{tischId}                öffentlich (angemeldete Nutzer)
     skatonline_tische/{tischId}/haende/{uid}   nur der Spieler selbst
     skatonline_tische/{tischId}/geheim/stand   nur Server (Skat, Augen)
   ═══════════════════════════════════════════════════════════════════ */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const S = require('./skatlogik.js');

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const TISCHE = 'skatonline_tische';
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function neuerCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_ZEICHEN[crypto.randomInt(CODE_ZEICHEN.length)];
  return c;
}

// ── Privater Zugang: Admin, Sintherner Spielleiter, freigeschaltete Mitglieder ──
const ADMIN_UID = 'ERwEUD2Dsddsij05p32oCb6EGs53';   // wie istAdmin() in firestore.rules
const zugangCache = new Map();                      // uid → Ablaufzeit (nur positive Ergebnisse)

async function hatZugang(uid) {
  if (uid === ADMIN_UID) return true;
  const bis = zugangCache.get(uid);
  if (bis && bis > Date.now()) return true;
  const [mitglied, spielleiter] = await Promise.all([
    db.collection('skatonline_mitglieder').doc(uid).get(),
    db.collection('spielleiter').doc(uid).get()
  ]);
  const ok = mitglied.exists ||
    (spielleiter.exists && (spielleiter.data().verein || 'sinthern') === 'sinthern');
  if (ok) zugangCache.set(uid, Date.now() + 5 * 60 * 1000);
  return ok;
}

function spielerName(d, token) {
  return String(d.spielerName || token.name || (token.email || '').split('@')[0] || 'Spieler').trim().slice(0, 20);
}

exports.skatAktion = onCall({ region: 'europe-west3', maxInstances: 10, concurrency: 40 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Bitte mit Google anmelden.');
  const token = req.auth.token || {};
  if (token.firebase && token.firebase.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Bitte mit Google anmelden.');
  }
  const uid = req.auth.uid;
  const d = req.data || {};
  if (!(await hatZugang(uid))) {
    throw new HttpsError('permission-denied', 'Dein Konto ist für Skat-Online noch nicht freigeschaltet.');
  }
  try {
    if (d.typ === 'tischAnlegen') return await tischAnlegen(uid, d, token);
    if (!d.tischId) throw new HttpsError('invalid-argument', 'Tisch fehlt.');
    return await db.runTransaction(tx => tischAktion(tx, uid, d, token));
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e && e.skatFehler) throw new HttpsError('failed-precondition', e.message);
    console.error('skatAktion', d.typ, e);
    throw new HttpsError('internal', 'Interner Fehler – bitte erneut versuchen.');
  }
});

async function tischAnlegen(uid, d, token) {
  const welt = S.neuerTisch({ name: d.name, plaetze: d.plaetze, maxSpiele: d.maxSpiele, uid });
  S.beitreten(welt, uid, spielerName(d, token), 0);
  for (let versuch = 0; versuch < 5; versuch++) {
    const id = neuerCode();
    const ref = db.collection(TISCHE).doc(id);
    const neu = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      welt.tisch.code = id;
      tx.set(ref, welt.tisch);
      tx.set(ref.collection('geheim').doc('stand'), welt.geheim);
      tx.set(ref.collection('haende').doc(uid), { karten: [], platz: 0, tischId: id });
      return true;
    });
    if (neu) return { tischId: id };
  }
  throw new HttpsError('internal', 'Kein freier Tisch-Code gefunden.');
}

async function tischAktion(tx, uid, d, token) {
  const tischId = String(d.tischId).toUpperCase().trim();
  const ref = db.collection(TISCHE).doc(tischId);
  const geheimRef = ref.collection('geheim').doc('stand');
  const snap = await tx.get(ref);
  if (!snap.exists) throw new HttpsError('not-found', 'Tisch ' + tischId + ' gibt es nicht.');
  const tisch = snap.data();
  const geheimSnap = await tx.get(geheimRef);
  const sitze = tisch.spieler.map(s => (s ? s.uid : null));
  const handSnaps = await Promise.all(sitze.map(u => (u ? tx.get(ref.collection('haende').doc(u)) : null)));
  const welt = {
    tisch,
    geheim: geheimSnap.exists ? geheimSnap.data() : {},
    haende: handSnaps.map(h => (h && h.exists ? (h.data().karten || []) : []))
  };

  let platz = sitze.indexOf(uid);
  const vorher = sitze.slice();

  switch (d.typ) {
    case 'beitreten':
      platz = S.beitreten(welt, uid, spielerName(d, token), Number.isInteger(d.platz) ? d.platz : undefined);
      break;
    case 'verlassen':
      if (platz < 0) throw new HttpsError('failed-precondition', 'Du sitzt nicht an diesem Tisch.');
      S.verlassen(welt, platz);
      break;
    case 'beenden':
      if (tisch.erstelltVon !== uid) throw new HttpsError('permission-denied', 'Nur wer den Tisch angelegt hat, kann ihn beenden.');
      tisch.status = 'beendet';
      tisch.phase = 'beendet';
      tisch.amZug = null;
      tisch.log = 'Tisch wurde beendet';
      break;
    default:
      if (tisch.status === 'beendet') throw new HttpsError('failed-precondition', 'Dieser Tisch ist beendet.');
      S.aktion(welt, platz, d);
  }

  tisch.aktualisiertMs = Date.now();
  tx.set(ref, welt.tisch);
  tx.set(geheimRef, welt.geheim);
  const nachher = welt.tisch.spieler.map(s => (s ? s.uid : null));
  nachher.forEach((u, i) => {
    if (u) tx.set(ref.collection('haende').doc(u), { karten: welt.haende[i] || [], platz: i, tischId });
  });
  vorher.forEach(u => {
    if (u && !nachher.includes(u)) tx.delete(ref.collection('haende').doc(u));
  });
  return { ok: true, platz: nachher.indexOf(uid) };
}
