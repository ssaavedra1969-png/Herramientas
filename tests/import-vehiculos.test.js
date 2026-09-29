'use strict';
/*
 * Regresión del import masivo de vehículos (executeCsvImport, vehicles.js:1160).
 *
 * El import tiene SU PROPIA numeración, separada del alta manual. Eso significa
 * que no hereda las protecciones de getNextVehicleNumber(), y por eso se
 * corrigieron dos huecos que production nunca había童装触控ado:
 *
 * 1. Duplicados DENTRO del propio lote. El chequeo de conflictos solo consultaba
 *    Firestore con un `where('interno','in',chunk)`. Un Excel con dos filas que
 *    ya traen "V055" escrito no colisiona con nadie en la base (todavía no
 *    existe) y las dos se guardaban con el mismo interno.
 *
 * 2. El fallo al actualizar el counter se tragaba con `catch (_) {}`. Los
 *    vehículos YA se habían importado, pero el counter quedaba atrás, así que
 *    la próxima alta manual derivaba del máximo real y REUSABA un número.
 *
 * Es código cliente (public/js), así que no se puede probar por HTTP: se
 * evalúa con `new Function` inyectando un db falso y un showToast espía, tal
 * como en vehiculos-numeracion.test.js.
 */
const fs = require('fs');
const path = require('path');
const { makeFake } = require('./fake-firestore');
const { makeReporter } = require('./helpers');

const R = makeReporter('import de vehiculos');
const SRC = path.join(__dirname, '..', 'public', 'js', 'vehicles.js');
const src = fs.readFileSync(SRC, 'utf8');

const m = src.match(/async function executeCsvImport\(\)\s*\{[\s\S]*?\n\}/);
if (!m) {
  console.error('No se encontro executeCsvImport() en ' + SRC);
  process.exit(1);
}

// Carga la función aislada. La función real usa helpers del mismo archivo
// (parseTrompoRaw, toTimestamp) que quedan fuera del snippet extraído, así que
// se le inyectan versiones mínimas: los tests de numeración no dependen de
// trompos ni de fechas, solo de que no revienten con undefined.
const body = m[0].replace(/^async function executeCsvImport/, 'async function __fn');
const factory = new Function(
  'db', 'csvValidatedData', 'getNextVehicleNumber', 'showToast', 'batchImport', 'closeCsvImport', 'document',
  'parseTrompoRaw', 'toTimestamp', 'firebase',
  body + '\nreturn __fn;');
const parseTrompoRaw = () => ({});
const toTimestamp = () => null;
const firebase = { firestore: { FieldValue: { serverTimestamp: () => 'NOW' } } };

async function runImport({ filas, existentes = [], counterActual = null, fallaCounter = false }) {
  const { db } = makeFake();
  existentes.forEach((interno, i) => db._map('vehicles').set('ex' + i, { interno, patente: 'EX' + i }));
  if (counterActual !== null) db._map('counters').set('vehicles', { current: counterActual });

  let seq = 55;
  const toasts = [];
  const showToast = (msg, type) => toasts.push({ msg, type });

  const importados = [];
  const batchImport = async (items) => {
    items.forEach((it, i) => db._map('vehicles').set('new' + i, it));
    importados.push(...items);
  };
  // El counter se escribe al final del import con
  // collection('counters').doc('vehicles').set(...). Si falla, los vehículos ya
  // quedaron guardados pero el numerador quedó atrás (simula un 403/permiso).
  const docStub = () => ({
    doc: () => ({
      set: async (d) => {
        if (fallaCounter) throw new Error('PERMISSION_DENIED');
        db._map('counters').set('vehicles', { ...(db._map('counters').get('vehicles') || {}), ...d });
      }
    })
  });
  const dbStub = Object.create(db);
  dbStub.collection = (c) => (c === 'counters' ? docStub() : db.collection(c));

  const documentStub = {
    getElementById: () => ({ classList: { add() {} }, innerHTML: '', value: '' })
  };

  let data = filas;
  const fn = factory(dbStub, data, async () => ({ number: seq, formatted: 'V' + String(seq).padStart(3, '0') }),
    showToast, batchImport, () => {}, documentStub, parseTrompoRaw, toTimestamp, firebase);
  await fn();
  return { toasts, importados, db };
}

const fila = (over) => Object.assign({ patente: '', marca: 'Iveco', modelo: 'Stralis', tipo: 'Camion' }, over);

(async () => {
  R.section('extraccion del codigo cliente');
  R.check('se encontro executeCsvImport en public/js/vehicles.js', !!m);
  R.check('la funcion extraida es ejecutable', typeof factory === 'function');

  R.section('duplicados dentro del propio lote (el bug)');
  {
    // Dos filas con el mismo V055 escrito, y V055 NO existe en la base.
    const r = await runImport({
      filas: [fila({ patente: 'AA111BB', interno: 'V055' }), fila({ patente: 'CC222DD', interno: 'V055' })]
    });
    R.check('NO importa nada si el interno se repite en el archivo', r.importados.length === 0,
      'importo ' + r.importados.length + ' vehiculos');
    R.check('avisa con un toast de error', r.toasts.some((t) => t.type === 'error'), 'toasts: ' + JSON.stringify(r.toasts));
    R.check('el mensaje menciona las dos filas',
      r.toasts.some((t) => /Filas 2, 3/.test(t.msg) && /V055/.test(t.msg)),
      r.toasts.map((t) => t.msg).join(' | '));
  }
  {
    // Tres filas: la primera y la tercera con el mismo interno.
    const r = await runImport({
      filas: [
        fila({ patente: 'AA111BB', interno: 'V060' }),
        fila({ patente: 'BB222CC', interno: 'V061' }),
        fila({ patente: 'CC333DD', interno: 'V060' })
      ]
    });
    R.check('detecta el repetido aunque esten separadas en el archivo', r.importados.length === 0,
      'importo ' + r.importados.length);
    R.check('menciona solo las filas en conflicto (2 y 4)',
      r.toasts.some((t) => /Filas 2, 4/.test(t.msg)),
      r.toasts.map((t) => t.msg).join(' | '));
  }

  R.section('el import limpio sigue funcionando');
  {
    const r = await runImport({
      filas: [fila({ patente: 'AA111BB' }), fila({ patente: 'CC222DD' }), fila({ patente: 'EE333FF' })]
    });
    R.check('sin internos escribe: importa los 3', r.importados.length === 3, 'importo ' + r.importados.length);
    R.check('numera correlativamente V055, V056, V057',
      r.importados.map((i) => i.interno).join(',') === 'V055,V056,V057',
      r.importados.map((i) => i.interno).join(','));
    R.check('sin errores ni avisos', r.toasts.length === 0, JSON.stringify(r.toasts));
  }
  {
    // Internos manuales distintos + uno autogenerado: conviven bien.
    const r = await runImport({
      filas: [fila({ patente: 'AA111BB', interno: 'V080' }), fila({ patente: 'CC222DD' })]
    });
    R.check('respeta el interno escrito y numera el resto',
      r.importados.map((i) => i.interno).join(',') === 'V080,V055',
      r.importados.map((i) => i.interno).join(','));
  }

  R.section('conflicto contra la base (comportamiento original)');
  {
    const r = await runImport({
      filas: [fila({ patente: 'AA111BB', interno: 'V055' })],
      existentes: ['V055']
    });
    R.check('bloquea si el interno ya existe en Firestore', r.importados.length === 0, 'importo ' + r.importados.length);
    R.check('distingue el mensaje de "ya existe" del de "repetido"',
      r.toasts.some((t) => /Ya existe en la base/.test(t.msg)),
      r.toasts.map((t) => t.msg).join(' | '));
  }

  R.section('fallo al actualizar el counter (el bug)');
  {
    const r = await runImport({
      filas: [fila({ patente: 'AA111BB' }), fila({ patente: 'CC222DD' })],
      fallaCounter: true
    });
    R.check('los vehiculos se importan igual (no se pierde trabajo)', r.importados.length === 2,
      'importo ' + r.importados.length);
    R.check('AVISA que el counter no se actualizó', r.toasts.some((t) => t.type === 'error'),
      'toasts: ' + JSON.stringify(r.toasts));
    R.check('el aviso explica el riesgo de repetir un numero',
      r.toasts.some((t) => /repetir un n/.test(t.msg)),
      r.toasts.map((t) => t.msg).join(' | '));
  }

  R.section('el counter queda en el maximo usado');
  {
    // V090 viene escrito y el autogenerado es V055: el counter debe quedar en 90
    // (el máximo REAL), no en 55 ni en el último del lote.
    const r = await runImport({
      filas: [fila({ patente: 'AA111BB', interno: 'V090' }), fila({ patente: 'CC222DD' })]
    });
    const c = r.db._map('counters').get('vehicles');
    R.check('el counter queda en 90 (el maximo REAL, no el ultimo del lote)', c && c.current === 90,
      'current = ' + (c ? c.current : 'no existe'));
  }

  R.done();
})().catch((e) => { console.error('ERROR:', e.stack); process.exit(1); });
