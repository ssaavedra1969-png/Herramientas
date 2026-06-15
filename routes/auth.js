const express = require('express');
const router = express.Router();
const { auth: adminAuth } = require('../config/firebase');

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const decoded = await adminAuth.verifyIdToken(token);

    res.json({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email?.split('@')[0]
    });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

router.post('/session', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID Token requerido' });

    console.log('Session creation requested, NODE_ENV:', process.env.NODE_ENV);
    console.log('FIREBASE_SERVICE_ACCOUNT set:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('FIREBASE_SERVICE_ACCOUNT_PATH set:', !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    res.cookie('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    console.log('Session cookie created successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Session creation error:', error.code || error.message, error);
    res.status(401).json({ error: 'Error al crear sesión: ' + (error.message || 'desconocido') });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('__session');
  res.json({ success: true });
});

router.get('/debug', (req, res) => {
  res.json({
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    hasServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    nodeEnv: process.env.NODE_ENV,
    hasFirebaseAdmin: !!require('../config/firebase').auth
  });
});

module.exports = router;
