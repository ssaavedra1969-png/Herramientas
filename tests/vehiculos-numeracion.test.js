'use strict';
/*
 * Regresión de la numeración de vehículos (getNextVehicleNumber).
 *
 * Esta función NO vive en routes/: es CÓDIGO CLIENTE, en
 * public/js/auth-client.js:258. Por eso ninguna suite anterior la cubría, y por
 * eso el off-by-one de la línea 270 sobrevivió: guardaba { current: max }
 * pero devolvía max+1.
 *
 * Cómo funciona el bug (por qué importa):
 *   1ª llamada, sin doc counters/vehicles -> deriva max de los internos reales
 *     -> guarda { current: max }  <-- guarda el ULTIMO usado, no el siguiente
 *     -> devuelve max+1 (V055)
 *   2ª llamada -> el doc YA existe -> rama incremento -> max+1 otra vez (V055)
 *
 *   O sea, dos altas seguidas devolvían el MISMO V-XXX. Y como el interno es la
 *   identidad del vehículo (se muestra en la ficha, va en el QR y en la carpeta
 *   de documentación), un duplicado hace que dos camiones distintos sean
 *   indistinguibles.
 *
 * La función se EXTRAE del archivo por texto y se evalúa con `new Function`
 * inyectando el db falso, así que el test corre el código real tal cual está
 * escrito, no una copia.
 *
 *   node tests/vehiculos-numeracion.test.js
 */
const fs = require('fs');
const path = require('path');
const { makeFake } = require('./fake-firestore');
const { makeReporter } = require('./helpers');

const R = makeReporter('numeracion de vehiculos');
const SRC = path.join(__dirname, '..', 'public', 'js', 'auth-client.js');

const src = fs.readFileSync(SRC, 'utf8');
const m = src.match(/async function getNextVehicleNumber\(\)\s*\{[\s\S]*?\n\}/);
if (!m) {
  console.error('No se encontro getNextVehicleNumber() en ' + SRC);
  process.exit(1);
}

// db entra como parámetro, así la función evaluada cierra sobre el fake.
const getNextVehicleNumber = new Function('db', m[0] + '\nreturn getNextVehicleNumber;');

const nuevos = (n, prefijo) =>
  Array.from({ length: n }, (_, i) => ({ interno: prefijo + String(i + 1).padStart(3, '0') }));

(async () => {
  R.section('extraccion del codigo cliente');
  R.check('se encontro getNextVehicleNumber en public/js/auth-client.js', !!m);
  R.check('la función extraída es ejecutable', typeof getNextVehicleNumber === 'function');

  R.section('regresion del off-by-one (el bug que se arreglo)');
  {
    const { db } = makeFake();
    const next = getNextVehicleNumber(db);

    // Sin counter y sin vehiculos -> arranca en V001
    const a = await next();
    R.check('sin datos previos devuelve V001', a.formatted === 'V001', 'devolvio ' + a.formatted);

    // El caso REAL: 54 vehiculos y sin doc de counter (estado de produccion hoy)
    const { db: db2 } = makeFake();
    nuevos(54, 'V').forEach((v, i) => db2._map('vehicles').set('v' + i, v));
    const next2 = getNextVehicleNumber(db2);

    const primera = await next2();
    R.check('con 54 vehiculos devuelve V055', primera.formatted === 'V055', 'devolvio ' + primera.formatted);

    // ESTE es el assert que rompia: el counter debe quedar en 55, NO en 54.
    const doc = await db2.collection('counters').doc('vehicles').get();
    R.check('el counter queda en 55 (= current, no max)', doc.exists && doc.data().current === 55,
      'current = ' + (doc.exists ? doc.data().current : 'no existe'));

    // Y la segunda alta seguida NO puede repetir el numero.
    const segunda = await next2();
    R.check('la 2da alta NO repite el numero (V056)', segunda.formatted === 'V056',
      'devolvio ' + segunda.formatted + ' (V055 seria el bug)');
    const tercera = await next2();
    R.check('la 3ra alta sigue incrementando (V057)', tercera.formatted === 'V057', 'devolvio ' + tercera.formatted);
  }

  R.section('el numero se deriva bien de los internos');
  {
    const { db } = makeFake();
    ['V003', 'V017', 'V002', 'V050', 'V004'].forEach((v, i) => db._map('vehicles').set('v' + i, { interno: v }));
    const r = await getNextVehicleNumber(db)();
    R.check('ignora el desorden y usa el maximo (V051)', r.formatted === 'V051', 'devolvio ' + r.formatted);
  }
  {
    const { db } = makeFake();
    // Internos que NO matchean /^V0*(\d+)$/ no deben-NCRASHEAR ni contar.
    ['V-01', 'X001', '', 'AB123CD', 'PROVISORIO', 'V0', 'V1'].forEach((v, i) =>
      db._map('vehicles').set('v' + i, { interno: v }));
    const r = await getNextVehicleNumber(db)();
    R.check('internos con formatos raros no rompen el calculo', /^V\d{3}$/.test(r.formatted),
      'devolvio ' + r.formatted);
  }
  {
    const { db } = makeFake();
    const r = await getNextVehicleNumber(db)();
    R.check('sin ningun interno matcheable arranca en V001', r.formatted === 'V001', 'devolvio ' + r.formatted);
  }

  R.section('con el counter ya existente');
  {
    const { db } = makeFake();
    db._map('counters').set('vehicles', { current: 7 });
    const next = getNextVehicleNumber(db);
    const a = await next();
    R.check('arranca en V008 desde current=7', a.formatted === 'V008', 'devolvio ' + a.formatted);
    const b = await next();
    R.check('luego V009', b.formatted === 'V009', 'devolvio ' + b.formatted);
    const doc = await db.collection('counters').doc('vehicles').get();
    R.check('el counter quedo en 9', doc.data().current === 9, 'current = ' + doc.data().current);
  }
  {
    // current ausente o corrupto: no debe devolver NaN ni romper la app.
    const { db } = makeFake();
    db._map('counters').set('vehicles', {});
    const r = await getNextVehicleNumber(db)();
    R.check('counter sin campo current no rompe (V001)', r.formatted === 'V001', 'devolvio ' + r.formatted);
  }

  R.section('secuencia larga: ningun duplicado');
  {
    const { db } = makeFake();
    nuevos(10, 'V').forEach((v, i) => db._map('vehicles').set('v' + i, v));
    const next = getNextVehicleNumber(db);
    const vistos = [];
    for (let i = 0; i < 5; i++) vistos.push((await next()).formatted);
    const dupes = vistos.filter((v, i) => vistos.indexOf(v) !== i);
    R.check('5 altas seguidas dan 5 numeros distintos', dupes.length === 0, 'repite: ' + dupes.join(', '));
    R.check('la secuencia es V011..V015', vistos.join(',') === 'V011,V012,V013,V014,V015', vistos.join(','));
  }

  R.done();
})().catch((e) => { console.error('ERROR:', e.stack); process.exit(1); });
