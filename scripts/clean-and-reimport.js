require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function parseJSON(str) {
  try { return JSON.parse(str); }
  catch (e) { return null; }
}

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(filePath)) {
      const r = parseJSON(fs.readFileSync(filePath, 'utf8'));
      if (r) return r;
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const cleaned = process.env.FIREBASE_SERVICE_ACCOUNT.replace(/^['"]/, '').replace(/['"]$/, '');
    const r = parseJSON(cleaned);
    if (r && r.private_key) return r;
  }
  const localFile = path.join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json');
  if (fs.existsSync(localFile)) {
    const r = parseJSON(fs.readFileSync(localFile, 'utf8'));
    if (r) return r;
  }
  return null;
}

function parseTrompoRaw(val) {
  const s = String(val || '').trim().toLowerCase().replace(/['"]/g, '');
  return s === 'si' || s === 'sí';
}

function parseField(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'sin datos') return null;
  return s;
}

async function deleteCollection(db, name) {
  const snap = await db.collection(name).get();
  let count = 0;
  for (const doc of snap.docs) {
    await doc.ref.delete();
    count++;
  }
  return count;
}

async function deleteSubcollections(db) {
  const vehiclesSnap = await db.collection('vehicles').get();
  let count = 0;
  for (const vDoc of vehiclesSnap.docs) {
    for (const sub of ['combustible', 'repuestos']) {
      const subSnap = await vDoc.ref.collection(sub).get();
      for (const d of subSnap.docs) {
        await d.ref.delete();
        count++;
      }
    }
  }
  return count;
}

async function main() {
  console.log('=== LIMPIEZA Y REIMPORTACION FIREBASE ===');
  console.log('Grupo Falpat SRL\n');

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    console.error('ERROR: No se encontro la cuenta de servicio de Firebase.');
    process.exit(1);
  }

  let app;
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } catch (e) {
    if (e.message?.includes('already exists')) {
      app = admin.app();
    } else {
      throw e;
    }
  }

  const db = admin.firestore();

  const excelPath = path.join(__dirname, '..', 'ENTRADA', 'vehiculos_completo_Optimizado.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error(`ERROR: No se encontro el archivo: ${excelPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`Archivo Excel: ${rows.length} vehiculos encontrados\n`);

  console.log('--- FASE 1: Limpiando subcolecciones (combustible, repuestos) ---');
  const subCount = await deleteSubcollections(db);
  console.log(`  ${subCount} documentos eliminados de subcolecciones\n`);

  console.log('--- FASE 2: Limpiando colecciones ---');
  const vCount = await deleteCollection(db, 'vehicles');
  console.log(`  vehicles: ${vCount} eliminados`);
  const mCount = await deleteCollection(db, 'maintenance');
  console.log(`  maintenance: ${mCount} eliminados`);
  const uCount = await deleteCollection(db, 'users');
  console.log(`  users: ${uCount} eliminados`);
  const cCount = await deleteCollection(db, 'counters');
  console.log(`  counters: ${cCount} eliminados\n`);

  console.log('--- FASE 3: Importando vehiculos con esquema nuevo ---');
  let imported = 0;
  let maxNum = 0;
  const batch = db.batch();
  const BATCH_LIMIT = 500;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const patente = String(row.patente || '').trim().toUpperCase();
    if (!patente) continue;

    const internoOld = String(row.interno || '').trim().toUpperCase();
    const numMatch = internoOld.match(/^V-?0*(\d+)$/);
    let interno = internoOld;
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n > maxNum) maxNum = n;
      interno = `V${String(n).padStart(3, '0')}`;
    }

    const trompoEnabled = parseTrompoRaw(row['trompo (raw)']);

    const data = {
      patente,
      interno,
      marca: String(row.marca || '').trim(),
      modelo: String(row.modelo || '').trim(),
      anio: parseInt(row.año) || null,
      tipo: String(row.tipo || '').trim(),
      subtipo: String(row.subtipo || '').trim() || '',
      chasis: String(row.chasis || '').trim() || '',
      numeroMotor: String(row.numeroMotor || '').trim() || '',
      capacidadCarga: parseFloat(row.capacidadCarga) || null,
      kilometraje: parseInt(row.kilometraje) || 0,
      horometro: parseInt(row.horometro) || 0,
      estadoGeneral: String(row.estadoGeneral || 'Bueno').trim(),
      fechaUltimaRevision: null,
      trompo: trompoEnabled,
      marcaTrompo: trompoEnabled ? parseField(row.marcaTrompo) : null,
      serieTrompo: trompoEnabled ? parseField(row.serieTrompo) : null,
      modeloTrompo: trompoEnabled ? parseField(row.modeloTrompo) : null,
      cargaM3Trompo: trompoEnabled ? parseField(row.cargaM3Trompo) : null,
      vtv: {
        fechaRealizacion: row.vtv_fechaRealizacion ? new Date(row.vtv_fechaRealizacion) : null,
        fechaVencimiento: row.vtv_fechaVencimiento ? new Date(row.vtv_fechaVencimiento) : null,
        costo: parseFloat(row.vtv_costo) || null,
        centroMedicion: String(row.vtv_centroMedicion || '').trim() || '',
        resultado: String(row.vtv_resultado || 'Pendiente').trim()
      },
      seguro: {
        compania: String(row.seguro_compania || '').trim() || '',
        poliza: String(row.seguro_poliza || '').trim() || '',
        tipo: String(row.seguro_tipo || '').trim() || '',
        fechaVencimiento: row.seguro_vencimiento ? new Date(row.seguro_vencimiento) : null,
        costo: parseFloat(row.seguro_costo) || null
      },
      proximoServiceKm: parseInt(row.proximoServiceKm) || null,
      proximoServiceFecha: row.proximoServiceFecha ? new Date(row.proximoServiceFecha) : null,
      centroTrabajo: String(row.centroTrabajo || '').trim() || '',
      chofer: String(row.chofer || '').trim() || '',
      dni: String(row.dni || '').trim() || '',
      vencimientoDNI: row.vencimientoDNI ? new Date(row.vencimientoDNI) : null,
      registro: String(row.registro || '').trim() || '',
      vencimientoRegistro: row.vencimientoRegistro ? new Date(row.vencimientoRegistro) : null,
      empresa: String(row.empresa || '').trim() || '',
      observaciones: String(row.observaciones || '').trim() || '',
      fotoURL: '',
      multas: [],
      documentos: [],
      fechaAlta: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = db.collection('vehicles').doc();
    batch.set(docRef, data);
    imported++;

    if (imported % BATCH_LIMIT === 0) {
      await batch.commit();
      console.log(`  ${imported} vehiculos importados...`);
    }
  }

  if (imported % BATCH_LIMIT !== 0) {
    await batch.commit();
  }

  console.log(`  Total importados: ${imported} vehiculos`);
  console.log(`  Mayor interno encontrado: V${String(maxNum).padStart(3, '0')}\n`);

  console.log('--- FASE 4: Configurando contador ---');
  await db.collection('counters').doc('vehicles').set({ current: maxNum });
  console.log(`  Counter vehicles: current = ${maxNum}\n`);

  console.log('=== LIMPIEZA Y REIMPORTACION COMPLETADA ===');
  console.log(`Vehiculos: ${imported}`);
  console.log(`Proximo interno: V${String(maxNum + 1).padStart(3, '0')}`);
}

main().catch(err => {
  console.error('\nERROR FATAL:', err.message);
  process.exit(1);
});
