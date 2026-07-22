const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('Error parsing JSON:', e.message.slice(0, 100));
    return null;
  }
}

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(filePath)) {
      const result = parseJSON(fs.readFileSync(filePath, 'utf8'));
      if (result) return result;
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const cleaned = process.env.FIREBASE_SERVICE_ACCOUNT
      .replace(/^['"]/, '').replace(/['"]$/, '');
    const result = parseJSON(cleaned);
    if (result && result.private_key) return result;
  }

  return null;
}

function initializeFirebase() {
  const serviceAccount = getServiceAccount();

  if (serviceAccount) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    } catch (e) {
      console.error('Error initializing Firebase with service account:', e.message);
    }
  }

  return admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

initializeFirebase();

const db = admin.firestore();
const auth = admin.auth();

const clientConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

module.exports = { admin, db, auth, clientConfig };
