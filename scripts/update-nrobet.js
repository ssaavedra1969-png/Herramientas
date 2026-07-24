require('dotenv').config();
const admin = require('firebase-admin');
const XLSX = require('xlsx');

const excelPath = process.argv[2];
if (!excelPath) {
  console.log('Uso: node scripts/update-nrobet.js <archivo.xlsx>');
  process.exit(1);
}

const credsPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!credsPath) { console.error('Falta FIREBASE_SERVICE_ACCOUNT_PATH en .env'); process.exit(1); }

const creds = JSON.parse(require('fs').readFileSync(credsPath));
admin.initializeApp({ credential: admin.credential.cert(creds) });
const db = admin.firestore();

async function main() {
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`Leídas ${rows.length} filas. Columnas: ${Object.keys(rows[0] || {}).join(', ')}`);

  const updates = [];
  for (const row of rows) {
    const rawInterno = String(Object.values(row)[0] || '').trim();
    const nroBet = String(Object.values(row)[1] || '').trim();
    if (!rawInterno || !nroBet) continue;
    const num = parseInt(rawInterno.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) continue;
    const interno = 'V' + String(num).padStart(3, '0');
    updates.push({ interno, nroBet, rawInterno });
  }

  if (!updates.length) {
    console.log('No se encontraron filas válidas');
    process.exit(1);
  }
  console.log(`Actualizando ${updates.length} vehículos...`);

  let ok = 0, notFound = 0;
  for (const { interno, nroBet, rawInterno } of updates) {
    const snap = await db.collection('vehicles').where('interno', '==', interno).get();
    if (snap.empty) {
      console.log(`  ⚠ ${rawInterno} (como ${interno}) no encontrado en Firestore`);
      notFound++;
      continue;
    }
    for (const doc of snap.docs) {
      await doc.ref.update({ nroBet });
      console.log(`  ✓ ${rawInterno} → nroBet: ${nroBet}`);
      ok++;
    }
  }
  console.log(`\nListo: ${ok} actualizados, ${notFound} no encontrados`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
