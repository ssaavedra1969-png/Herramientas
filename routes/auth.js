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

// Exchange a Google ID token (from implicit OAuth flow) for a Firebase session cookie
router.post('/google/exchange', async (req, res) => {
  try {
    const { idToken, state } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID Token requerido' });

    const apiKey = require('../config/firebase').clientConfig.apiKey;

    const signInResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `id_token=${idToken}&providerId=google.com`,
          requestUri: `${req.protocol}://${req.get('host')}/auth/google/callback`,
          returnSecureToken: true
        })
      }
    );

    const signInData = await signInResp.json();

    if (!signInResp.ok || signInData.error) {
      console.error('signInWithIdp error:', signInData.error?.message || JSON.stringify(signInData));
      return res.status(401).json({ error: 'Error al verificar credenciales de Google' });
    }

    const firebaseIdToken = signInData.idToken;
    if (!firebaseIdToken) return res.status(401).json({ error: 'No se recibió token de Firebase' });

    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(firebaseIdToken, { expiresIn });

    res.cookie('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Google exchange error:', error.code || error.message, error);
    res.status(500).json({ error: 'Error interno al procesar inicio de sesión con Google' });
  }
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
