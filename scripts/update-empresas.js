const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateEmpresas() {
  const wb = XLSX.readFile(path.join(__dirname, '..', 'ENTRADA', 'update.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`\nEmpresas a actualizar: ${rows.length}\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  const snapshot = await db.collection('vehicles').get();
  const vehiclesMap = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    vehiclesMap[data.interno] = { id: doc.id, ...data };
  });

  for (const row of rows) {
    const interno = (row['N° Interno'] || '').trim();
    const empresa = (row['EMPRESA'] || '').trim();

    if (!interno || !empresa) {
      console.log(`SKIP: interno vacío o empresa vacía`);
      continue;
    }

    const vehicle = vehiclesMap[interno];
    if (!vehicle) {
      console.log(`NOT FOUND: ${interno}`);
      notFound++;
      continue;
    }

    try {
      await db.collection('vehicles').doc(vehicle.id).update({ empresa });
      console.log(`OK: ${interno} (${vehicle.patente}) → "${empresa}"`);
      updated++;
    } catch (e) {
      console.log(`ERROR: ${interno} → ${e.message}`);
      errors++;
    }
  }

  console.log(`\n═══════════════════════════`);
  console.log(`Actualizados: ${updated}`);
  console.log(`No encontrados: ${notFound}`);
  console.log(`Errores: ${errors}`);
  console.log(`═══════════════════════════\n`);

  process.exit(0);
}

updateEmpresas();
