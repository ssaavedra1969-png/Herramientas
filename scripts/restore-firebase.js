require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

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
    if (r) return r;
  }
  const localFile = path.join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json');
  if (fs.existsSync(localFile)) {
    const r = parseJSON(fs.readFileSync(localFile, 'utf8'));
    if (r) return r;
  }
  return null;
}

function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && value.__type === 'timestamp') {
      converted[key] = admin.firestore.Timestamp.fromDate(new Date(value.value));
    } else if (value && typeof value === 'object') {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

async function restoreCollection(db, collectionName, docs) {
  console.log(`Restaurando colección: ${collectionName} (${docs.length} documentos)...`);
  const batch = db.batch();
  let count = 0;

  for (const doc of docs) {
    const { id, ...data } = doc;
    const cleanData = convertTimestamps(data);
    const ref = db.collection(collectionName).doc(id);
    batch.set(ref, cleanData, { merge: true });
    count++;

    if (count >= 500) {
      await batch.commit();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

async function main() {
  console.log('=== Iniciando restauración de Firebase ===\n');

  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('Uso: node scripts/restore-firebase.js <directorio_del_backup>');
    console.error('Ejemplo: node scripts/restore-firebase.js backups/backup-2026-06-16T08-00-00-000Z');
    console.error('O usar: node scripts/restore-firebase.js backups/latest');
    process.exit(1);
  }

  const fullPath = path.resolve(sourceDir);
  if (!fs.existsSync(fullPath)) {
    console.error(`ERROR: El directorio "${fullPath}" no existe.`);
    process.exit(1);
  }

  const manifestPath = path.join(fullPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`ERROR: No se encontró manifest.json en "${fullPath}".`);
    process.exit(1);
  }

  const manifest = parseJSON(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Backup del: ${manifest.timestamp}\n`);

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    console.error('ERROR: No se encontró la cuenta de servicio de Firebase.');
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

  const collectionOrder = ['users', 'vehicles', 'maintenance'];

  for (const name of collectionOrder) {
    if (manifest.collections[name]) {
      const filePath = path.join(fullPath, manifest.collections[name].file);
      if (fs.existsSync(filePath)) {
        const docs = parseJSON(fs.readFileSync(filePath, 'utf8'));
        await restoreCollection(db, name, docs);
      }
    }
  }

  console.log('\n=== Restauración completada ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
