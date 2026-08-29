require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const { loadUser, requireAuth, requireAdminPage } = require('./middleware/auth');
const { devReadOnly } = require('./middleware/dev-readonly');
const authRoutes = require('./routes/auth');
const vehiclesRoutes = require('./routes/vehicles');

const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  'https://falpat-control-de-vehiculos.vercel.app',
  process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes, intente más tarde' }
});

app.use('/api/', apiLimiter);

if (process.env.DEV_READ_ONLY === 'true') {
  console.log('[DEV] Read-only mode');
  app.use('/api/', devReadOnly);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('view cache', false);

// Disable static file cache in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/titulos', express.static(path.join(__dirname, 'titulo')));
app.use('/documentos', express.static(path.join(__dirname, 'PATENTE')));

app.use(loadUser);

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);

app.use('/api/admin', adminRoutes);

app.get('/login', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/dashboard');
  const error = req.query.error;
  res.render('login', {
    title: 'Iniciar Sesión',
    clientConfig: res.locals.clientConfig,
    currentUser: null,
    currentUserData: null,
    error: error || null
  });
});

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.get('/vehicles', requireAuth, (req, res) => {
  res.render('vehicles', {
    title: 'Vehículos',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.get('/vehicle/scan', requireAuth, (req, res) => {
  res.render('scanner', {
    title: 'Escanear Vehículo',
    page: 'scan',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.get('/vehicle/:id', requireAuth, (req, res) => {
  res.render('vehicle-detail', {
    title: 'Detalle del Vehículo',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.get('/vehicle/:id/qr', async (req, res) => {
  try {
    const { db } = require('./config/firebase');
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Vehículo no encontrado');
    const v = doc.data();
    const [servicesSnap, repuestosSnap] = await Promise.all([
      db.collection('vehicles').doc(req.params.id).collection('services').orderBy('fecha', 'desc').limit(5).get(),
      db.collection('vehicles').doc(req.params.id).collection('repuestos').orderBy('fecha', 'desc').limit(5).get()
    ]);
    const recentServices = servicesSnap.docs.map(d => d.data());
    const recentRepuestos = repuestosSnap.docs.map(d => d.data());
    let currentUserData = null;
    if (res.locals.currentUserData) {
      currentUserData = { role: res.locals.currentUserData.role, displayName: res.locals.currentUserData.displayName };
    }
    res.render('vehicle-qr-public', {
      vehicle: { id: doc.id, ...v },
      recentServices,
      recentRepuestos,
      clientConfig: res.locals.clientConfig,
      currentUserData
    });
  } catch (e) {
    res.status(500).send('Error del servidor');
  }
});

app.get('/vehicle/:id/qr-sticker', requireAuth, async (req, res) => {
  try {
    const { db } = require('./config/firebase');
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Vehículo no encontrado');
    const v = doc.data();
    const baseUrl = req.protocol + '://' + req.get('host');
    res.render('qr-sticker', {
      vehicle: { id: doc.id, ...v },
      qrUrl: baseUrl + '/vehicle/' + doc.id + '/qr',
      baseUrl
    });
  } catch (e) {
    res.status(500).send('Error del servidor');
  }
});

app.get('/vehicles/qr-stickers-bulk', requireAuth, requireAdminPage, async (req, res) => {
  try {
    const { db } = require('./config/firebase');
    const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
    const baseUrl = req.protocol + '://' + req.get('host');
    const vehicles = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      qrUrl: baseUrl + '/vehicle/' + d.id + '/qr'
    }));
    res.render('qr-stickers-bulk', { vehicles, baseUrl });
  } catch (e) {
    res.status(500).send('Error del servidor');
  }
});

app.get('/vehicles/fichas-taller-bulk', requireAuth, requireAdminPage, async (req, res) => {
  try {
    const { db } = require('./config/firebase');
    const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
    const vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.estadoGeneral !== 'Baja');
    res.render('fichas-taller-bulk', { vehicles });
  } catch (e) {
    console.error('fichas-taller-bulk:', e.message);
    res.status(500).send('Error del servidor');
  }
});

app.get('/reports', requireAuth, requireAdminPage, (req, res) => {
  res.render('reports', {
    title: 'Reportes',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.get('/admin', requireAuth, requireAdminPage, (req, res) => {
  res.render('admin', {
    title: 'Usuarios',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
}


