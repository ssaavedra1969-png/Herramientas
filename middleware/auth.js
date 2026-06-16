const { auth: adminAuth, db } = require('../config/firebase');

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
      const data = userDoc.data();
      if (!data.role || data.role === 'Usuario') {
        const adminSnap = await db.collection('users').where('role', '==', 'Admin').limit(1).get();
        if (adminSnap.empty) {
          await db.collection('users').doc(decoded.uid).update({ role: 'Admin' });
          data.role = 'Admin';
        }
      }
      req.userData = data;
    } else {
      const allSnap = await db.collection('users').limit(1).get();
      const isFirst = allSnap.empty;
      const newUser = { role: isFirst ? 'Admin' : 'Usuario', displayName: decoded.email?.split('@')[0] };
      if (isFirst) await db.collection('users').doc(decoded.uid).set(newUser);
      req.userData = newUser;
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
        const data = userDoc.data();
        if (!data.role || data.role === 'Usuario') {
          const adminSnap = await db.collection('users').where('role', '==', 'Admin').limit(1).get();
          if (adminSnap.empty) {
            await db.collection('users').doc(decoded.uid).update({ role: 'Admin' });
            data.role = 'Admin';
          }
        }
        res.locals.currentUserData = data;
      } else {
        const allSnap = await db.collection('users').limit(1).get();
        const isFirst = allSnap.empty;
        const newUser = { role: isFirst ? 'Admin' : 'Usuario', displayName: decoded.email?.split('@')[0] };
        if (isFirst) await db.collection('users').doc(decoded.uid).set(newUser);
        res.locals.currentUserData = newUser;
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
