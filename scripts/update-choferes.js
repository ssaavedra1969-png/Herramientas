require('dotenv').config();
const XLSX = require('xlsx');
const path = require('path');
const { db } = require('../config/firebase');

async function main() {
  const wb = XLSX.readFile(path.join(__dirname, '..', 'ENTRADA', 'chofer.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(ws);
  console.log('Excel: ' + excelData.length + ' registros');

  const snap = await db.collection('vehicles').get();
  const vehicles = [];
  snap.forEach(doc => vehicles.push({ id: doc.id, ...doc.data() }));

  let matched = 0;
  let notFound = 0;
  const updates = [];

  for (const row of excelData) {
    const interno = (row.interno || '').trim();
    const patente = (row.Patente || '').trim().toUpperCase();
    const nombre = (row['Nombre Chofer'] || '').trim();

    const v = vehicles.find(v => {
      const vInterno = (v.interno || '').trim();
      const vPatente = (v.patente || '').trim().toUpperCase();
      return vInterno === interno || vPatente === patente;
    });

    if (v) {
      updates.push({ id: v.id, interno: v.interno, patente: v.patente, chofer: nombre });
      matched++;
    } else {
      console.log('NO ENCONTRADO: ' + interno + ' | ' + patente + ' | ' + nombre);
      notFound++;
    }
  }

  console.log('\nMatched: ' + matched + ' | Not found: ' + notFound);
  console.log('\nVista previa de actualizaciones:');
  updates.forEach(u => {
    console.log('  ' + u.interno + ' | ' + u.patente + ' -> chofer: "' + u.chofer + '"');
  });

  const batch = db.batch();
  for (const u of updates) {
    const ref = db.collection('vehicles').doc(u.id);
    batch.update(ref, { chofer: u.chofer });
  }
  await batch.commit();
  console.log('\n¡' + updates.length + ' vehiculos actualizados en Firestore!');
}

main().catch(e => { console.error(e); process.exit(1); });
