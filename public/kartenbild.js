/* ═══════════════════════════════════════════════════════════════════
   Skat-Online – eigene Kartengrafik (SVG, im Browser erzeugt)
   Französisches Bild, Turnierfarben (4 Farben):
     Kreuz schwarz, Pik grün, Herz rot, Karo gelb/orange.
   Für das klassische 2-Farben-Bild VIER_FARBEN auf false setzen.
   KartenBild.url('cB') → data:-URL für <img>, KartenBild.rueckenUrl()
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const VIER_FARBEN = true;
  const FARBE = VIER_FARBEN
    ? { c: '#1b1b1b', s: '#1f7a35', h: '#d32f2f', d: '#eb9b00' }
    : { c: '#1b1b1b', s: '#1b1b1b', h: '#d32f2f', d: '#d32f2f' };

  // Kleidung der Bildkarten je Farbe: [Hauptfarbe, Akzent]
  const KLEIDUNG = {
    c: ['#2b4c9b', '#d9a520'],
    s: ['#2e7d32', '#c0392b'],
    h: ['#c62828', '#2b4c9b'],
    d: ['#e39a00', '#2e7d32']
  };
  const GOLD = '#e0b23a', HAUT = '#f5d6b8', LINIE = '#3a2a1a', PAPIER = '#fbf3dc';
  const B = 200, H = 305, MY = H / 2;          // viewBox und Mittellinie

  // Farbsymbole im 100 × 100-Feld (ohne fill – kommt von der Gruppe)
  const FORM = {
    h: '<path d="M50 92C22 68 2 50 2 29C2 13 14 3 28 3C39 3 47 10 50 19C53 10 61 3 72 3C86 3 98 13 98 29C98 50 78 68 50 92Z"/>',
    d: '<path d="M50 2L88 50L50 98L12 50Z"/>',
    s: '<path d="M50 3C38 22 4 38 4 62C4 77 16 86 28 86C37 86 44 81 47 75C46 86 41 93 32 98L68 98C59 93 54 86 53 75C56 81 63 86 72 86C84 86 96 77 96 62C96 38 62 22 50 3Z"/>',
    c: '<circle cx="50" cy="27" r="22"/><circle cx="25" cy="58" r="22"/><circle cx="75" cy="58" r="22"/>' +
       '<rect x="40" y="38" width="20" height="28"/><path d="M45 50L55 50L55 70C55 84 61 92 70 98L30 98C39 92 45 84 45 70Z"/>'
  };

  // Farbsymbol mit Mittelpunkt (x, y), Größe g, optional auf dem Kopf
  function symbol(f, x, y, g, kopf, farbe) {
    const dreh = kopf ? `rotate(180 ${x} ${y}) ` : '';
    return `<g fill="${farbe || FARBE[f]}" transform="${dreh}translate(${x - g / 2} ${y - g / 2}) scale(${g / 100})">${FORM[f]}</g>`;
  }

  const WERT_TEXT = { '7': '7', '8': '8', '9': '9', Z: '10', B: 'B', D: 'D', K: 'K', A: 'A' };

  // Eckzeichen oben links (und gedreht unten rechts)
  function ecke(f, w) {
    const t = WERT_TEXT[w];
    const g = `<text x="20" y="33" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="bold"
      font-size="${t.length > 1 ? 24 : 28}" letter-spacing="${t.length > 1 ? -2 : 0}" fill="${FARBE[f]}">${t}</text>` +
      symbol(f, 20, 50, 20);
    return g + `<g transform="rotate(180 ${B / 2} ${MY})">${g}</g>`;
  }

  // Augenkarten 7 – 10
  function augen(f, w) {
    const L = 66, R = 134, M = 100;
    const drei = [70, MY, H - 70];
    const vier = [70, 125, H - 125, H - 70];
    let p = [];
    if (w === '7' || w === '8') drei.forEach(y => { p.push([L, y], [R, y]); });
    if (w === '9' || w === 'Z') vier.forEach(y => { p.push([L, y], [R, y]); });
    if (w === '7') p.push([M, 111]);
    if (w === '8') p.push([M, 111], [M, H - 111]);
    if (w === '9') p.push([M, MY]);
    if (w === 'Z') p.push([M, 97.5], [M, H - 97.5]);
    return p.map(([x, y]) => symbol(f, x, y, 34, y > MY + 1)).join('');
  }

  function ass(f) {
    return `<circle cx="${B / 2}" cy="${MY}" r="62" fill="none" stroke="${FARBE[f]}" stroke-width="1.5" opacity=".35"/>` +
      `<circle cx="${B / 2}" cy="${MY}" r="56" fill="none" stroke="${FARBE[f]}" stroke-width=".8" opacity=".35"/>` +
      symbol(f, B / 2, MY, 84);
  }

  // Obere Hälfte einer Bildkarte (wird um die Mitte gespiegelt)
  function figur(w, f) {
    const [haupt, akzent] = KLEIDUNG[f];
    let s = '';
    // Gegenstand hinter der Figur
    if (w === 'K') {
      s += `<line x1="60" y1="152" x2="64" y2="80" stroke="${GOLD}" stroke-width="4"/>` +
        `<circle cx="64" cy="75" r="7" fill="${GOLD}" stroke="${LINIE}" stroke-width="1"/>` +
        `<path d="M64 68v-7M61 64.5h6" stroke="${LINIE}" stroke-width="1.5"/>`;
    }
    if (w === 'D') {
      s += `<line x1="141" y1="150" x2="137" y2="98" stroke="#3f7d2a" stroke-width="2.5"/>` +
        `<path d="M138 118q-11-6-14 3q9 3 14-3Z" fill="#3f7d2a"/>`;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        s += `<circle cx="${(137 + 6 * Math.cos(a)).toFixed(1)}" cy="${(90 + 6 * Math.sin(a)).toFixed(1)}" r="4.5" fill="${akzent === '#2b4c9b' ? '#e57373' : '#f06292'}" stroke="${LINIE}" stroke-width=".6"/>`;
      }
      s += `<circle cx="137" cy="90" r="3.5" fill="${GOLD}"/>`;
    }
    if (w === 'B') {
      s += `<line x1="143" y1="152" x2="143" y2="52" stroke="#7a5230" stroke-width="3"/>` +
        `<path d="M143 62l17-7q5 11-2 21l-15-5Z" fill="#c3ccd4" stroke="${LINIE}" stroke-width="1"/>` +
        `<path d="M143 44l3.5 11h-7Z" fill="#c3ccd4" stroke="${LINIE}" stroke-width="1"/>`;
    }
    // Lange Haare der Dame (hinter dem Körper)
    if (w === 'D') {
      s += `<path d="M85 84C80 108 76 122 70 134L90 124L90 92ZM115 84C120 108 124 122 130 134L110 124L110 92Z" fill="#b5651d" stroke="${LINIE}" stroke-width="1"/>`;
    }
    // Körper mit Besatz
    s += `<path d="M48 ${MY}C50 128 68 116 100 114C132 116 150 128 152 ${MY}Z" fill="${haupt}" stroke="${LINIE}" stroke-width="1.5"/>`;
    s += `<path d="M89 115L100 ${MY}L111 115Z" fill="${akzent}" stroke="${LINIE}" stroke-width="1"/>`;
    s += `<path d="M57 135Q70 122 85 118M143 135Q130 122 115 118" stroke="${GOLD}" stroke-width="4" fill="none"/>`;
    [124, 134, 144].forEach(y => { s += `<circle cx="100" cy="${y}" r="1.8" fill="${GOLD}"/>`; });
    // Hals und Kragen
    s += `<rect x="94" y="102" width="12" height="14" fill="${HAUT}"/>`;
    s += `<ellipse cx="100" cy="116" rx="${w === 'B' ? 21 : 17}" ry="5" fill="#fff" stroke="${LINIE}" stroke-width="1"/>`;
    // Kopf und Gesicht
    s += `<ellipse cx="100" cy="90" rx="15" ry="18" fill="${HAUT}" stroke="${LINIE}" stroke-width="1.2"/>`;
    s += `<circle cx="94" cy="88" r="1.7" fill="${LINIE}"/><circle cx="106" cy="88" r="1.7" fill="${LINIE}"/>`;
    s += `<path d="M91 84q3-2 6 0M103 84q3-2 6 0" stroke="${LINIE}" stroke-width=".9" fill="none"/>`;
    s += `<path d="M100 90l-2 6h3.5" stroke="${LINIE}" stroke-width="1" fill="none"/>`;
    if (w === 'D') s += `<circle cx="91" cy="96" r="2.6" fill="#f2a0a0" opacity=".7"/><circle cx="109" cy="96" r="2.6" fill="#f2a0a0" opacity=".7"/>`;
    s += `<path d="M95 101q5 3 10 0" stroke="#a33" stroke-width="1.4" fill="none"/>`;
    if (w === 'K') {
      s += `<path d="M85 93C85 112 94 119 100 121C106 119 115 112 115 93C111 100 105 100 100 99C95 100 89 100 85 93Z" fill="#e8e8e8" stroke="${LINIE}" stroke-width="1"/>`;
      s += `<path d="M92 99q8-5 16 0" stroke="#c4c4c4" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M85 84C82 94 83 102 86 106L88 86ZM115 84C118 94 117 102 114 106L112 86Z" fill="#d8d8d8"/>`;
    }
    if (w === 'B') {
      s += `<path d="M85 86C83 71 92 66 100 66C108 66 117 71 115 86C112 78 106 75 100 75C94 75 88 78 85 86Z" fill="#6d4321"/>`;
      s += `<path d="M85 84C83 92 84 98 86 101L88 86ZM115 84C117 92 116 98 114 101L112 86Z" fill="#6d4321"/>`;
    }
    if (w === 'D') {
      s += `<path d="M85 89C83 72 92 68 100 68C108 68 117 72 115 89C111 79 105 76 100 76C95 76 89 79 85 89Z" fill="#b5651d"/>`;
    }
    // Kopfbedeckung
    if (w === 'K') {
      s += `<path d="M83 75L83 55L91 64L100 50L109 64L117 55L117 75Z" fill="${GOLD}" stroke="${LINIE}" stroke-width="1.2"/>` +
        `<rect x="83" y="71" width="34" height="5" fill="${akzent}" stroke="${LINIE}" stroke-width=".8"/>` +
        `<circle cx="100" cy="64" r="2.6" fill="#c62828"/><circle cx="91" cy="68" r="1.8" fill="#2b4c9b"/><circle cx="109" cy="68" r="1.8" fill="#2b4c9b"/>`;
    }
    if (w === 'D') {
      s += `<path d="M86 73L90 62L95 68L100 57L105 68L110 62L114 73Q100 67 86 73Z" fill="${GOLD}" stroke="${LINIE}" stroke-width="1"/>` +
        `<circle cx="100" cy="62" r="2.2" fill="${akzent}"/>`;
    }
    if (w === 'B') {
      s += `<path d="M79 77C79 63 93 56 104 58C117 60 125 68 121 77Q100 71 79 77Z" fill="${akzent}" stroke="${LINIE}" stroke-width="1.2"/>` +
        `<path d="M111 61C123 46 137 45 142 49C132 52 123 56 116 65Z" fill="#f7f7f7" stroke="${LINIE}" stroke-width="1"/>`;
    }
    return s;
  }

  function bild(f, w) {
    const [haupt] = KLEIDUNG[f];
    const fig = figur(w, f);
    return `<defs><clipPath id="rahmen"><rect x="34" y="46" width="132" height="213" rx="6"/></clipPath></defs>` +
      `<rect x="34" y="46" width="132" height="213" rx="6" fill="${PAPIER}"/>` +
      `<g clip-path="url(#rahmen)"><g>${fig}</g><g transform="rotate(180 ${B / 2} ${MY})">${fig}</g></g>` +
      `<line x1="34" y1="${MY}" x2="166" y2="${MY}" stroke="${LINIE}" stroke-width="1"/>` +
      `<rect x="34" y="46" width="132" height="213" rx="6" fill="none" stroke="${haupt}" stroke-width="2.5"/>` +
      symbol(f, 49, 61, 18) + symbol(f, 151, H - 61, 18, true);
  }

  function rahmen(inhalt) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}">` +
      `<rect x="1" y="1" width="${B - 2}" height="${H - 2}" rx="13" fill="#fff" stroke="#9a9a9a" stroke-width="2"/>` +
      inhalt + `</svg>`;
  }

  function svg(k) {
    const f = k[0], w = k[1];
    let inhalt;
    if (w === 'A') inhalt = ass(f);
    else if (w === 'B' || w === 'D' || w === 'K') inhalt = bild(f, w);
    else inhalt = augen(f, w);
    return rahmen(inhalt + ecke(f, w));
  }

  function rueckenSvg() {
    let muster = '';
    ['c', 's', 'h', 'd'].forEach((f, i) => {
      const x = [82, 118, 82, 118][i], y = [134, 134, 171, 171][i];
      muster += symbol(f, x, y, 26, false, '#fff');
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}">` +
      `<defs><pattern id="raute" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<rect width="16" height="16" fill="#8b1e2d"/><rect width="8" height="8" fill="#a8293b"/></pattern></defs>` +
      `<rect x="1" y="1" width="${B - 2}" height="${H - 2}" rx="13" fill="#fff" stroke="#9a9a9a" stroke-width="2"/>` +
      `<rect x="12" y="12" width="${B - 24}" height="${H - 24}" rx="8" fill="url(#raute)"/>` +
      `<rect x="18" y="18" width="${B - 36}" height="${H - 36}" rx="6" fill="none" stroke="#f3d27a" stroke-width="2"/>` +
      `<ellipse cx="100" cy="${MY}" rx="50" ry="62" fill="#8b1e2d" stroke="#f3d27a" stroke-width="3"/>` +
      muster + `</svg>`;
  }

  const cache = {};
  const alsUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  function url(k) { return cache[k] || (cache[k] = alsUrl(svg(k))); }
  function rueckenUrl() { return cache._r || (cache._r = alsUrl(rueckenSvg())); }

  root.KartenBild = { svg, url, rueckenSvg, rueckenUrl, FARBE };
})(window);
