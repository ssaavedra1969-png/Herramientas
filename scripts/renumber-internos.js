require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const p = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(p)) {
      try { const r = JSON.parse(fs.readFileSync(p, 'utf8')); if (r && r.private_key) return r; } catch {}
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const c = process.env.FIREBASE_SERVICE_ACCOUNT.replace(/^['"]/, '').replace(/['"]$/, '');
    try { const r = JSON.parse(c); if (r && r.private_key) return r; } catch {}
  }
  const localFile = path.join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json');
  if (fs.existsSync(localFile)) {
    try { const r = JSON.parse(fs.readFileSync(localFile, 'utf8')); if (r && r.private_key) return r; } catch {}
  }
  return null;
}

async function main() {
  const sa = getServiceAccount();
  if (!sa) { console.error('ERROR: No se encontro service account.'); process.exit(1); }

  let app;
  try { app = admin.initializeApp({ credential: admin.credential.cert(sa) }); }
  catch (e) { if (e.message?.includes('already exists')) app = admin.app(); else throw e; }

  const db = admin.firestore();
  console.log('=== RENUMERACION DE INTERNOS ===\n');

  const snap = await db.collection('vehicles').orderBy('interno').get();
  const vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Vehiculos encontrados: ${vehicles.length}\n`);

  console.log('--- ANTES ---');
  vehicles.forEach(v => console.log(`  ${v.interno} | ${v.patente}`));

  let num = 1;
  const batch = db.batch();
  let changes = 0;

  for (const v of vehicles) {
    const newInterno = `V${String(num).padStart(3, '0')}`;
    if (v.interno !== newInterno) {
      batch.update(db.collection('vehicles').doc(v.id), {
        interno: newInterno,
        updatedAt: new Date()
      });
      changes++;
    }
    num++;
  }

  if (changes > 0) {
    await batch.commit();
    console.log(`\n--- DESPUES --- (${changes} cambios)`);
    const snap2 = await db.collection('vehicles').orderBy('interno').get();
    snap2.forEach(d => console.log(`  ${d.data().interno} | ${d.data().patente}`));

    await db.collection('counters').doc('vehicles').set({ current: vehicles.length });
    console.log(`\nCounter actualizado a: ${vehicles.length}`);
  } else {
    console.log('\nNo se necesitaron cambios.');
  }

  console.log('\n=== RENUMERACION COMPLETADA ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
