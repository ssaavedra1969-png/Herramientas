require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
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
  'http://localhost:3000',
  'http://127.0.0.1:3000'
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

const DOC_TIPOS_QR = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];
const DOC_EXT_QR = ['pdf', 'jpg', 'jpeg', 'png'];
function scanDocsCarpeta(patente) {
  const carpeta = path.join(process.cwd(), 'PATENTE', patente);
  const presentes = {};
  if (!fs.existsSync(carpeta)) return presentes;
  fs.readdirSync(carpeta).forEach(nombre => {
    const parsed = path.parse(nombre);
    const base = parsed.name.toLowerCase();
    const ext = parsed.ext.replace('.', '').toLowerCase();
    if (!DOC_TIPOS_QR.includes(base) || !DOC_EXT_QR.includes(ext)) return;
    const actual = presentes[base];
    if (!actual || DOC_EXT_QR.indexOf(ext) < DOC_EXT_QR.indexOf(path.parse(actual.nombre).ext.replace('.', '').toLowerCase())) {
      presentes[base] = { url: `/documentos/${encodeURIComponent(patente)}/${nombre}`, nombre, origen: 'carpeta' };
    }
  });
  return presentes;
}

app.get('/vehicle/:id/qr', async (req, res) => {
  try {
    const { db } = require('./config/firebase');
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Vehículo no encontrado');
    const v = doc.data();
    const patente = (v.patente || '').toUpperCase();
    const docsCarpeta = scanDocsCarpeta(patente);
    const fecha = (d) => d ? (d.toDate ? d.toDate() : new Date(d)) : null;
    const diasRest = (d) => d ? Math.ceil((d - Date.now()) / 86400000) : null;
    const vtvD = fecha(v.vtv && v.vtv.fechaVencimiento);
    const segD = fecha(v.seguro && v.seguro.fechaVencimiento);
    const matD = fecha(v.matafuego && v.matafuego.fechaVto);
    const svcD = fecha(v.proximoServiceFecha);
    const vencimientos = [
      { label: 'VTV', date: vtvD, dias: diasRest(vtvD), sub: '' },
      { label: 'Seguro', date: segD, dias: diasRest(segD), sub: '' },
      { label: 'Service', date: svcD, dias: diasRest(svcD), sub: v.proximoServiceKm ? Number(v.proximoServiceKm).toLocaleString('es-AR') + ' km' : '' },
      { label: 'Matafuego', date: matD, dias: diasRest(matD), sub: '' }
    ].filter(x => x.date || x.sub);
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
      docsCarpeta,
      vencimientos,
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

const DOC_ORDEN = ['titulo', 'cedula', 'seguro', 'vtv', 'registro', 'dni'];

app.get('/vehicles/carpeta-docs/pdf', requireAuth, requireAdminPage, async (req, res) => {
  try {
    const { PDFDocument, StandardFonts } = require('pdf-lib');
    const { db } = require('./config/firebase');
    const snap = await db.collection('vehicles').get();
    const vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.estadoGeneral !== 'Baja')
      .sort((a, b) => String(a.interno || '').localeCompare(String(b.interno || ''), 'es', { numeric: true }))
      .map(v => ({ ...v, docsCarpeta: scanDocsCarpeta(v.patente || '') }))
      .filter(v => Object.keys(v.docsCarpeta).length > 0);

    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await out.embedFont(StandardFonts.Helvetica);

    for (const v of vehicles) {
      const docsOrdenados = DOC_ORDEN
        .map(t => ({ tipo: t, doc: v.docsCarpeta[t] }))
        .filter(x => x.doc && x.doc.nombre.toLowerCase().endsWith('.pdf'));

      if (!docsOrdenados.length) continue;

      /* Hoja separadora con los datos del vehículo */
      let sep = out.addPage([595.28, 841.89]); // A4 portrait
      sep.setFont(font);
      sep.setFontSize(24);
      sep.drawText(`${v.interno || ''} — ${(v.patente || '').toUpperCase()}`, { x: 60, y: 730 });
      sep.setFont(fontNormal);
      sep.setFontSize(13);
      let y = 690;
      const lineas = [
        [v.marca, v.modelo].filter(Boolean).join(' '),
        v.año ? 'Año: ' + v.año : null,
        v.empresa ? 'Empresa: ' + v.empresa : null,
        docsOrdenados.length + ' documento(s) a continuación'
      ].filter(Boolean);
      for (const l of lineas) {
        sep.drawText(l, { x: 60, y });
        y -= 22;
      }

      /* Unir los PDFs del vehículo en orden fijo */
      for (const { doc } of docsOrdenados) {
        const rutaDoc = path.join(process.cwd(), 'PATENTE', (v.patente || '').toUpperCase(), doc.nombre);
        if (!fs.existsSync(rutaDoc)) continue;
        const bytes = fs.readFileSync(rutaDoc);
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(p => out.addPage(p));
      }
    }

    const finalBytes = await out.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carpeta-documentacion-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(Buffer.from(finalBytes));
  } catch (e) {
    console.error('carpeta-docs/pdf:', e.message);
    res.status(500).send('Error generando el PDF');
  }
});

const { execFile } = require('child_process');

app.get('/vehicles/carpeta-docs/print-pdf', requireAuth, requireAdminPage, async (req, res) => {
  const tmpHtml = path.join(require('os').tmpdir(), 'carpeta-docs-' + Date.now() + '.html');
  const tmpPdf = tmpHtml.replace('.html', '.pdf');
  try {
    const { db } = require('./config/firebase');
    const snap = await db.collection('vehicles').get();
    const vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.estadoGeneral !== 'Baja')
      .sort((a, b) => String(a.interno || '').localeCompare(String(b.interno || ''), 'es', { numeric: true }))
      .map(v => ({ ...v, docsCarpeta: scanDocsCarpeta(v.patente || '') }));
    let logoDataUri = null;
    try {
      const logoPath = path.join(__dirname, 'public', 'images', 'fp3d.png');
      if (fs.existsSync(logoPath)) {
        logoDataUri = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
      }
    } catch (e) { /* logo opcional */ }

    const html = require('ejs').render(fs.readFileSync(path.join(__dirname, 'views', 'carpeta-docs.ejs'), 'utf8'), {
      vehicles,
      logoDataUri,
      modoPdf: true
    }, { filename: path.join(__dirname, 'views', 'carpeta-docs.ejs') });

    fs.writeFileSync(tmpHtml, html);

    const chromePaths = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ].filter(p => p && fs.existsSync(p));

    if (!chromePaths.length) {
      return res.status(500).send('No se encontró Chrome/Edge para generar el PDF. Usá "Imprimir desde el navegador".');
    }

    const out = await new Promise((resolve, reject) => {
      execFile(chromePaths[0], [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        '--print-to-pdf=' + tmpPdf,
        'file:///' + tmpHtml.replace(/\\/g, '/')
      ], { timeout: 120000, windowsHide: true }, (err) => {
        if (err) return reject(err);
        if (!fs.existsSync(tmpPdf)) return reject(new Error('Chrome no generó el PDF'));
        resolve(fs.readFileSync(tmpPdf));
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="indice-y-caratulas-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(out);
  } catch (e) {
    console.error('carpeta-docs/print-pdf:', e.message);
    res.status(500).send('Error generando el PDF de índice y carátulas: ' + e.message);
  } finally {
    try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch (e) {}
    try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch (e) {}
  }
});

app.get('/vehicles/carpeta-docs', requireAuth, requireAdminPage, async (req, res) => {
  try {
    const { db } = require('./config/firebase');
    const snap = await db.collection('vehicles').get();
    const vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.estadoGeneral !== 'Baja')
      .sort((a, b) => String(a.interno || '').localeCompare(String(b.interno || ''), 'es', { numeric: true }))
      .map(v => ({ ...v, docsCarpeta: scanDocsCarpeta(v.patente || '') }));
    let logoDataUri = null;
    try {
      const logoPath = path.join(__dirname, 'public', 'images', 'fp3d.png');
      if (fs.existsSync(logoPath)) {
        logoDataUri = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
      }
    } catch (e) { /* logo opcional */ }
    res.render('carpeta-docs', { vehicles, logoDataUri });
  } catch (e) {
    console.error('carpeta-docs:', e.message);
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


