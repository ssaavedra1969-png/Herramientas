const path = require('path');
const R = path.join(__dirname, '..');
require(path.join(R, 'node_modules', 'dotenv')).config({ path: path.join(R, '.env') });
const { db } = require(path.join(R, 'config', 'firebase'));
const { completarVencimientosDesdeVehiculos } = require(path.join(R, 'lib', 'empleados'));

const APLICAR = process.argv.includes('--apply');
const USUARIO = (process.argv.find(a => a.startsWith('--usuario=')) || '').split('=').slice(1).join('=') || 'script';

(async () => {
  const r = await completarVencimientosDesdeVehiculos(db, { aplicar: APLICAR, usuario: USUARIO });

  console.log('=== Perfiles en employees: ' + r.perfiles + ' ===');
  console.log('a completar: ' + r.planes.length + ' | ya al dia: ' + r.yaAlDia.length + ' | sin fecha en vehicles: ' + r.sinFecha.length + ' | sin vehiculo: ' + r.sinVehiculo.length + ' | conflictos: ' + r.conflictos.length + ' | fechas invalidas: ' + r.invalidos.length);

  if (r.planes.length) {
    console.log('\n--- ' + (APLICAR ? 'completados' : 'a completar') + ' ---');
    r.planes.forEach(p => console.log('  ' + String(p.nombre || '').padEnd(28) + (p.patentes.join(',') || '-').padEnd(18) + p.detalles.join(' | ')));
  }
  if (r.conflictos.length) {
    console.log('\n--- CONFLICTOS (no se tocó nada) ---');
    r.conflictos.forEach(c => console.log('  ' + String(c.nombre || '').padEnd(28) + c.tipo + ': ' + c.fechas.join(' / ')));
  }
  if (r.invalidos.length) {
    console.log('\n--- FECHAS INVALIDAS (no se copian) ---');
    r.invalidos.forEach(p => console.log('  ' + String(p.nombre || '').padEnd(28) + p.detalles.join(' | ')));
  }
  if (r.sinVehiculo.length) {
    console.log('\n--- SIN VEHICULO VINCULADO ---');
    r.sinVehiculo.forEach(p => console.log('  ' + String(p.nombre || '').padEnd(28) + 'DNI ' + (p.dni || '-')));
  }
  if (r.sinFecha.length) {
    console.log('\n--- SIN FECHA CARGADA EN VEHICULOS (' + r.sinFecha.length + ') ---');
    r.sinFecha.forEach(p => console.log('  ' + String(p.nombre || '')));
  }

  if (!APLICAR) {
    console.log('\n>>> DRY-RUN. Agregar --apply para escribir SOLO en employees.');
    process.exit(0);
  }
  console.log('\n>>> ESCRITOS EN employees: ' + r.escritos + '/' + r.planes.length + ' (vehicles no se tocó)');
  process.exit(0);
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
