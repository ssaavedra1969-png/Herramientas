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

function serializeDoc(doc) {
  const data = doc.data();
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        out[key] = { __type: 'timestamp', value: value.toDate().toISOString() };
      } else if (Array.isArray(value)) {
        out[key] = value.map(item => {
          if (item && typeof item === 'object') {
            const converted = {};
            for (const [k, v] of Object.entries(item)) {
              if (v && typeof v === 'object' && typeof v.toDate === 'function') {
                converted[k] = { __type: 'timestamp', value: v.toDate().toISOString() };
              } else {
                converted[k] = v;
              }
            }
            return converted;
          }
          return item;
        });
      } else {
        out[key] = value;
      }
    } else {
      out[key] = value;
    }
  }
  return { id: doc.id, ...out };
}

async function snapshotCollection(db, collectionName) {
  console.log(`  ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs.map(serializeDoc);
  console.log(`    ${docs.length} documentos`);
  return docs;
}

async function snapshotSubcollections(db, docRef, subcollectionNames) {
  const result = {};
  for (const subName of subcollectionNames) {
    const subSnap = await docRef.collection(subName).get();
    if (!subSnap.empty) {
      result[subName] = subSnap.docs.map(serializeDoc);
      console.log(`    ${subName}: ${result[subName].length} registros`);
    }
  }
  return result;
}

async function main() {
  console.log('=== SNAPSHOT DEV ===\n');
  console.log('Guardando snapshot de la base de datos...\n');

  initFirebase();
  const db = admin.firestore();

  if (fs.existsSync(SNAPSHOT_DIR)) {
    fs.rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const snapshot = { timestamp: new Date().toISOString(), collections: {} };

  const collections = ['vehicles', 'users', 'counters'];

  for (const name of collections) {
    const docs = await snapshotCollection(db, name);
    snapshot.collections[name] = docs;

    if (name === 'vehicles') {
      console.log('    subcolecciones:');
      for (const doc of docs) {
        const docRef = db.collection(name).doc(doc.id);
        const subs = await snapshotSubcollections(db, docRef, ['combustible', 'repuestos']);
        if (Object.keys(subs).length > 0) {
          doc._subcollections = subs;
        }
      }
    }
  }

  const filePath = path.join(SNAPSHOT_DIR, 'snapshot.json');
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

  let total = 0;
  for (const [name, docs] of Object.entries(snapshot.collections)) {
    total += docs.length;
    for (const doc of docs) {
      if (doc._subcollections) {
        for (const sub of Object.values(doc._subcollections)) {
          total += sub.length;
        }
      }
    }
  }

  console.log(`\nSnapshot guardado: ${filePath}`);
  console.log(`Total documentos: ${total}`);
  console.log('\nAhora podés iniciar desarrollo con: npm run dev');
  console.log('Cuando termines, restaurá con: npm run dev:restore');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
