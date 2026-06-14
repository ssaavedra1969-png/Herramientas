require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const { loadUser, requireAuth, requireAdminPage } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const vehiclesRoutes = require('./routes/vehicles');
const toolsRoutes = require('./routes/tools');
const maintenanceRoutes = require('./routes/maintenance');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes, intente más tarde' }
});

app.use('/api/', apiLimiter);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(loadUser);

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
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

app.get('/auth/google/init', (req, res) => {
  res.render('auth/google-init', {
    title: 'Google Sign-In',
    clientConfig: res.locals.clientConfig
  });
});

app.get('/auth/google/callback', (req, res) => {
  res.render('auth/google-callback', {
    title: 'Verificando',
    clientConfig: res.locals.clientConfig
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

app.get('/tools', requireAuth, (req, res) => {
  res.render('tools', {
    title: 'Herramientas',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});

app.get('/maintenance', requireAuth, (req, res) => {
  res.render('maintenance', {
    title: 'Mantenimiento',
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

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});


