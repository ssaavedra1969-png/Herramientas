const { auth: adminAuth, db } = require('../config/firebase');

async function ensureFirstAdmin(uid) {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return null;
  const data = userDoc.data();
  if (data.role && data.role !== 'Usuario') return data;
  const adminSnap = await db.collection('users').where('role', '==', 'Admin').limit(1).get();
  if (adminSnap.empty) {
    await userRef.update({ role: 'Admin' });
    data.role = 'Admin';
  }
  return data;
}

async function createUserIfMissing(uid, displayName, email) {
  const userRef = db.collection('users').doc(uid);
  const allSnap = await db.collection('users').limit(1).get();
  const isFirst = allSnap.empty;
  const newUser = { role: isFirst ? 'Admin' : 'Usuario', displayName, email: email || null };
  await userRef.set(newUser);
  return newUser;
}

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;

    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (userDoc.exists) {
      req.userData = await ensureFirstAdmin(decoded.uid);
    } else {
      req.userData = await createUserIfMissing(decoded.uid, decoded.email?.split('@')[0], decoded.email);
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

async function requireAdmin(req, res, next) {
  if (req.userData?.role !== 'Admin') {
    return res.status(403).json({ error: 'Acción solo para administradores' });
  }
  next();
}

async function loadUser(req, res, next) {
  const token = req.cookies?.__session;
  if (token) {
    try {
      const decoded = await adminAuth.verifySessionCookie(token, false);
      res.locals.currentUser = decoded;

      const userDoc = await db.collection('users').doc(decoded.uid).get();
      if (userDoc.exists) {
        res.locals.currentUserData = await ensureFirstAdmin(decoded.uid);
      } else {
        res.locals.currentUserData = await createUserIfMissing(decoded.uid, decoded.email?.split('@')[0], decoded.email);
      }

      res.locals.clientConfig = require('../config/firebase').clientConfig;
    } catch (e) {
      res.locals.currentUser = null;
      res.locals.currentUserData = null;
      res.clearCookie('__session');
    }
  } else {
    res.locals.currentUser = null;
    res.locals.currentUserData = null;
  }

  res.locals.clientConfig = require('../config/firebase').clientConfig;
  next();
}

function requireAuth(req, res, next) {
  if (!res.locals.currentUser) {
    return res.redirect('/login');
  }
  next();
}

function requireAdminPage(req, res, next) {
  if (res.locals.currentUserData?.role !== 'Admin') {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { verifyToken, requireAdmin, loadUser, requireAuth, requireAdminPage };
