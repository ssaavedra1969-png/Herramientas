require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const COLLECTIONS = ['vehicles', 'maintenance', 'users'];

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

async function exportCollection(db, collectionName) {
  console.log(`Exportando colección: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs.map(d => {
    const data = d.data();
    const converted = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object') {
        if (value.toDate && typeof value.toDate === 'function') {
          converted[key] = { __type: 'timestamp', value: value.toDate().toISOString() };
        } else if (value.constructor?.name === 'Timestamp') {
          converted[key] = { __type: 'timestamp', value: new admin.firestore.Timestamp(value.seconds, value.nanoseconds).toDate().toISOString() };
        } else {
          converted[key] = value;
        }
      } else {
        converted[key] = value;
      }
    }
    return { id: d.id, ...converted };
  });
  return docs;
}

function saveBackup(data) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
  fs.mkdirSync(backupPath, { recursive: true });

  const manifest = { timestamp: new Date().toISOString(), collections: {} };

  for (const [name, docs] of Object.entries(data)) {
    const filePath = path.join(backupPath, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    manifest.collections[name] = { count: docs.length, file: `${name}.json` };
    console.log(`  ${name}: ${docs.length} documentos -> ${filePath}`);
  }

  const manifestPath = path.join(backupPath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nManifiesto guardado en: ${manifestPath}`);

  const latestLink = path.join(BACKUP_DIR, 'latest');
  if (fs.existsSync(latestLink)) {
    const stat = fs.lstatSync(latestLink);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(latestLink, { recursive: true, force: true });
    }
  }
  fs.mkdirSync(latestLink, { recursive: true });
  for (const file of fs.readdirSync(backupPath)) {
    fs.copyFileSync(path.join(backupPath, file), path.join(latestLink, file));
  }

  return backupPath;
}

async function main() {
  console.log('=== Iniciando exportación de Firebase ===\n');

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    console.error('ERROR: No se encontró la cuenta de servicio de Firebase.');
    console.error('Configurá FIREBASE_SERVICE_ACCOUNT o FIREBASE_SERVICE_ACCOUNT_PATH en .env');
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

  const allData = {};
  for (const collectionName of COLLECTIONS) {
    try {
      allData[collectionName] = await exportCollection(db, collectionName);
    } catch (e) {
      console.error(`Error exportando ${collectionName}:`, e.message);
      allData[collectionName] = [];
    }
  }

  const backupPath = saveBackup(allData);

  let total = 0;
  for (const [name, docs] of Object.entries(allData)) {
    total += docs.length;
  }

  console.log(`\n=== Exportación completada ===`);
  console.log(`Total documentos: ${total}`);
  console.log(`Backup guardado en: ${backupPath}`);
  console.log(`Último backup disponible en: ${path.join(BACKUP_DIR, 'latest')}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
