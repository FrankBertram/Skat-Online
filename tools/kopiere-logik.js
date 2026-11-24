// Kopiert die gemeinsame Spiellogik (Master: public/skatlogik.js) in den
// Functions-Ordner. Läuft automatisch vor "firebase deploy" (predeploy).
const fs = require('fs');
const path = require('path');
const quelle = path.join(__dirname, '..', 'public', 'skatlogik.js');
const ziel = path.join(__dirname, '..', 'functions', 'skatlogik.js');
fs.copyFileSync(quelle, ziel);
console.log('skatlogik.js → functions/ kopiert');
