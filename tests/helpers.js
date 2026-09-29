'use strict';
/*
 * Inyecta el Firestore falso y monta las rutas reales en un Express de prueba.
 *
 * IMPORTANTE: este harness NO monta `middleware/dev-readonly.js` a propósito.
 * La idea es ejercitar las escrituras; como el `db` es falso, no hay riesgo.
 * (Si se montara el read-only, todos los POST/PUT/DELETE darían 403.)
 */
const path = require('path');
const { makeFake } = require('./fake-firestore');

const ROOT = path.join(__dirname, '..');
const fake = makeFake();

// Reemplaza config/firebase.js en require.cache ANTES de que lo requiera
// cualquier ruta, así middleware/auth.js y routes/* toman el fake.
const fbPath = require.resolve(path.join(ROOT, 'config/firebase.js'));
require.cache[fbPath] = {
  id: fbPath,
  filename: fbPath,
  loaded: true,
  exports: { db: fake.db, admin: fake.admin, auth: fake.auth, clientConfig: fake.clientConfig },
  children: [],
  paths: []
};

// Los usuarios tienen que existir antes de los tests: en producción el primer
// usuario que se autentica se vuelve Admin (ensureFirstAdmin, auth.js:12), y
// eso rompería los tests de roles.
fake.seed('users', 'u-admin', { role: 'Admin', displayName: 'Admin', email: 'admin@local.dev' });
fake.seed('users', 'u-user', { role: 'Usuario', displayName: 'User', email: 'user@local.dev' });

const express = require(path.join(ROOT, 'node_modules/express'));
const app = express();
app.use(express.json());
app.use('/api/centros', require(path.join(ROOT, 'routes/centros.js')));
app.use('/api/vehicles', require(path.join(ROOT, 'routes/vehicles.js')));
app.use('/api/admin', require(path.join(ROOT, 'routes/admin.js')));

const server = app.listen(0);
const URL = (p) => `http://127.0.0.1:${server.address().port}${p}`;

const HEADERS = {
  admin: { Authorization: 'Bearer testAdmin', 'Content-Type': 'application/json' },
  user: { Authorization: 'Bearer testUser', 'Content-Type': 'application/json' },
  invalid: { Authorization: 'Bearer no-existe', 'Content-Type': 'application/json' },
  none: { 'Content-Type': 'application/json' }
};

async function req(method, p, { body, as = 'admin' } = {}) {
  const r = await fetch(URL(p), {
    method,
    headers: HEADERS[as],
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await r.json(); } catch (e) { /* respuesta sin cuerpo */ }
  return { status: r.status, json };
}

function makeReporter(title) {
  const state = { pass: 0, fail: 0, failures: [] };
  const check = (name, cond, detail) => {
    if (cond) { state.pass++; console.log('  OK   ' + name); }
    else {
      state.fail++;
      state.failures.push(name + (detail ? ' -> ' + detail : ''));
      console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
    }
  };
  const section = (t) => console.log('\n########## ' + t + ' ##########');
  const done = () => {
    console.log('\n================================');
    console.log('  ' + title + '  ->  OK: ' + state.pass + '   FAIL: ' + state.fail);
    if (state.failures.length) {
      console.log('\n  FALLAS:');
      state.failures.forEach((f) => console.log('   - ' + f));
    }
    console.log('================================\n');
    server.close();
    process.exit(state.fail ? 1 : 0);
  };
  return { check, section, done };
}

module.exports = { fake, req, server, makeReporter, ROOT };
