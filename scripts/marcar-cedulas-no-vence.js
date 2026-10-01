/**
 * Marca como "no vence" las cedulas que no tienen fecha de vencimiento.
 *
 * Regla de negocio: la mayoria de las cedulas no vencen (casos raros con
 * fecha). Si el vehiculo YA tiene fechaVencimiento, no se toca. Solo se
 * cargan las que estan vacias.
 *
 *   node scripts/marcar-cedulas-no-vence.js            -> dry-run (solo informa)
 *   node scripts/marcar-cedulas-no-vence.js --apply    -> escribe en Firestore
 */
const path = require('path');
const fs = require('fs');
const R = path.join(__dirname, '..');
require(path.join(R, 'node_modules', 'dotenv')).config({ path: path.join(R, '.env') });
const { db } = require(path.join(R, 'config', 'firebase'));

const APLICAR = process.argv.includes('--apply');

const tieneCedulaEnDisco = (patente) => {
  const dir = path.join(R, 'PATENTE', String(patente || '').toUpperCase());
  try { return fs.readdirSync(dir).some(n => /^cedula\./i.test(n)); } catch { return false; }
};

(async () => {
  const snap = await db.collection('vehicles').get();
  const vs = snap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

  const aplicar = [];
  const saltear = [];

  vs.forEach(v => {
    if (!tieneCedulaEnDisco(v.patente)) return;              // sin archivo, no hay nada que marcar
    const c = v.documentacion && v.documentacion.cedula;
    if (c && c.fechaVencimiento) { saltear.push([v.patente, v.interno, 'ya tiene fecha: ' + new Date(c.fechaVencimiento.seconds * 1000).toLocaleDateString('es-AR')]); return; }
    if (c && c.noVence === true) { saltear.push([v.patente, v.interno, 'ya marcado noVence']); return; }
    aplicar.push(v);
  });

  console.log('=== vehiculos totales: ' + vs.length + ' ===');
  console.log('con cedula.pdf en PATENTE/ : ' + vs.filter(v => tieneCedulaEnDisco(v.patente)).length);
  console.log('a marcar  noVence          : ' + aplicar.length);
  console.log('salteados (con fecha o ya marcados): ' + saltear.length);

  if (saltear.length) {
    console.log('\n--- NO se tocan ---');
    saltear.forEach(s => console.log('  ' + s[0].padEnd(9) + (s[1] || '').padEnd(6) + s[2]));
  }

  console.log('\n--- a marcar como { noVence: true } ---');
  aplicar.forEach(v => console.log('  ' + v.patente.padEnd(9) + (v.interno || '').padEnd(6) + 'cedula actual: ' + JSON.stringify((v.documentacion && v.documentacion.cedula) || null)));

  if (!aplicar.length) { console.log('\nnada que hacer.'); process.exit(0); }
  if (!APLICAR) { console.log('\n>>> DRY-RUN. Agregar --apply para escribir.'); process.exit(0); }

  // update con ruta punteada: solo toca documentacion.cedula, no pisa seguro/vtv
  let ok = 0, fallos = [];
  for (let i = 0; i < aplicar.length; i += 20) {
    const lote = aplicar.slice(i, i + 20);
    const batch = db.batch();
    lote.forEach(v => batch.update(v.ref, { 'documentacion.cedula': { noVence: true } }));
    try { await batch.commit(); ok += lote.length; }
    catch (e) { fallos.push(lote.map(v => v.patente).join(',') + ' -> ' + e.message); }
  }
  console.log('\n>>> ESCRITOS: ' + ok + '/' + aplicar.length);
  if (fallos.length) { console.log('FALLOS:'); fallos.forEach(f => console.log('  ' + f)); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
