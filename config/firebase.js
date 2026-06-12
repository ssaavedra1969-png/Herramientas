const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  const localFile = path.join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json');
  if (fs.existsSync(localFile)) {
    return JSON.parse(fs.readFileSync(localFile, 'utf8'));
  }

  return null;
}

function initializeFirebase() {
  const serviceAccount = getServiceAccount();

  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }

  return admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

initializeFirebase();

const db = admin.firestore();
const auth = admin.auth();

function getBucket() {
  try {
    return admin.storage().bucket();
  } catch (e) {
    return null;
  }
}

const clientConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

module.exports = { admin, db, getBucket, auth, clientConfig };
