require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = path.join(__dirname, '..', 'backups', 'dev-snapshot');

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

function initFirebase() {
  const sa = getServiceAccount();
  if (!sa) {
    console.error('ERROR: No se encontró la service account de Firebase.');
    process.exit(1);
  }
  try {
    return admin.initializeApp({
      credential: admin.credential.cert(sa),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } catch (e) {
    if (e.message?.includes('already exists')) return admin.app();
    throw e;
  }
}

function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && value.__type === 'timestamp') {
      converted[key] = admin.firestore.Timestamp.fromDate(new Date(value.value));
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      converted[key] = convertTimestamps(value);
    } else if (Array.isArray(value)) {
      converted[key] = value.map(item => convertTimestamps(item));
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

async function deleteCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return 0;

  let deleted = 0;
  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const subcollections = ['combustible', 'repuestos'];
    for (const subName of subcollections) {
      const subSnap = await doc.ref.collection(subName).get();
      for (const subDoc of subSnap.docs) {
        batch.delete(subDoc.ref);
        count++;
        deleted++;
        if (count >= 500) {
          await batch.commit();
          count = 0;
        }
      }
    }

    batch.delete(doc.ref);
    count++;
    deleted++;
    if (count >= 500) {
      await batch.commit();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
  return deleted;
}

async function restoreCollection(db, collectionName, docs) {
  const batch = db.batch();
  let count = 0;
  let restored = 0;

  for (const doc of docs) {
    const { id, _subcollections, ...data } = doc;
    const cleanData = convertTimestamps(data);
    const ref = db.collection(collectionName).doc(id);
    batch.set(ref, cleanData);
    count++;
    restored++;

    if (_subcollections) {
      for (const [subName, subDocs] of Object.entries(_subcollections)) {
        for (const subDoc of subDocs) {
          const { id: subId, ...subData } = subDoc;
          const cleanSubData = convertTimestamps(subData);
          batch.set(ref.collection(subName).doc(subId), cleanSubData);
          count++;
          restored++;
          if (count >= 500) {
            await batch.commit();
            count = 0;
          }
        }
      }
    }

    if (count >= 500) {
      await batch.commit();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
  return restored;
}

async function main() {
  console.log('=== RESTORE DEV ===\n');

  if (!fs.existsSync(SNAPSHOT_DIR)) {
    console.error('ERROR: No se encontró el snapshot en:', SNAPSHOT_DIR);
    console.error('Ejecutá primero: npm run dev:snapshot');
    process.exit(1);
  }

  const snapshotPath = path.join(SNAPSHOT_DIR, 'snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.error('ERROR: No se encontró snapshot.json');
    process.exit(1);
  }

  const snapshot = parseJSON(fs.readFileSync(snapshotPath, 'utf8'));
  console.log(`Snapshot del: ${snapshot.timestamp}\n`);

  initFirebase();
  const db = admin.firestore();

  for (const [collectionName, docs] of Object.entries(snapshot.collections)) {
    console.log(`Restaurando ${collectionName}...`);

    console.log('  Eliminando datos actuales...');
    const deleted = await deleteCollection(db, collectionName);
    console.log(`  ${deleted} documentos eliminados`);

    console.log('  Restaurando desde snapshot...');
    const restored = await restoreCollection(db, collectionName, docs);
    console.log(`  ${restored} documentos restaurados`);
  }

  console.log('\n=== Restauración completada ===');
  console.log('La base de datos está restaurada al estado del snapshot.');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
