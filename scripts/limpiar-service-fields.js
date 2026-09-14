/**
 * Recalcula los campos de "próximo service" de TODOS los vehículos desde la
 * subcolección services (fuente única de verdad). Los campos sueltos que se
 * hayan cargado a mano (proximoServiceKm / proximoServiceFecha) quedan
 * re-derivados o eliminados si no hay services.
 *
 * Uso:
 *   node scripts/limpiar-service-fields.js                # todos los vehículos
 *   node scripts/limpiar-service-fields.js --dry-run      # solo muestra qué haría
 *   node scripts/limpiar-service-fields.js --patente=AF206GB
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db, admin } = require('../config/firebase');

const DRY = process.argv.includes('--dry-run');
const PAT = process.argv.find(a => a.startsWith('--patente='))?.split('=')[1] || null;

function tsToMs(v) {
  if (!v) return 0;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const d = v.toDate ? v.toDate() : new Date(v);
  return d && !isNaN(d.getTime()) ? d.getTime() : 0;
}

async function recompute(vehicleId) {
  const snap = await db.collection('vehicles').doc(vehicleId).collection('services').get();
  const summary = {};
  let minKm = null;
  let minFecha = null;
  let nextTipo = null;
  snap.forEach(doc => {
    const s = doc.data();
    const tipo = s.tipo || 'Otro';
    if (!summary[tipo]) summary[tipo] = null;
    const cur = summary[tipo];
    const curDate = cur && cur.fecha ? tsToMs(cur.fecha) : 0;
    const newDate = s.fecha ? tsToMs(s.fecha) : 0;
    if (!cur || newDate >= curDate) {
      summary[tipo] = { fecha: s.fecha || null, km: s.km || null, proximoKm: s.proximoKm || null, proximoFecha: s.proximoFecha || null };
    }
    if (s.proximoKm != null && (minKm === null || s.proximoKm < minKm)) {
      minKm = s.proximoKm;
      minFecha = s.proximoFecha || null;
      nextTipo = tipo;
    }
  });

  const update = {
    serviceSummary: summary,
    proximoServiceTipo: nextTipo
  };
  if (minKm == null) update.proximoServiceKm = admin.firestore.FieldValue.delete();
  else update.proximoServiceKm = minKm;
  if (!minFecha) update.proximoServiceFecha = admin.firestore.FieldValue.delete();
  else update.proximoServiceFecha = minFecha;

  return { minKm, minFecha, update };
}

async function main() {
  console.log(`${DRY ? '[DRY-RUN] ' : ''}Recalculando próximo service desde la solapa Services...\n`);

  const snap = await db.collection('vehicles').get();
  if (snap.empty) { console.log('No hay vehículos.'); return; }

  let procesados = 0;
  let corregidos = 0;
  let limpiados = 0;

  for (const doc of snap.docs) {
    const v = doc.data();
    if (PAT && String(v.patente || '').toUpperCase() !== PAT.toUpperCase()) continue;
    procesados++;

    const { minKm, minFecha, update } = await recompute(doc.id);
    const teniaManual = v.proximoServiceKm != null || v.proximoServiceFecha != null;
    const tieneDerivado = minKm != null || minFecha != null;

    let accion = 'sin cambios';
    if (teniaManual && !tieneDerivado) { accion = 'LIMPIADO'; limpiados++; }
    else if (soloCambio(v, update)) { accion = 'ACTUALIZADO'; corregidos++; }

    console.log(`  ${v.patente || doc.id} (Int ${v.interno || ''}) → ${accion}`);

    if (!DRY && accion !== 'sin cambios') {
      await db.collection('vehicles').doc(doc.id).update(update);
    }
  }

  console.log(`\nVehículos: ${procesados} | ${DRY ? 'se limpiarían' : 'limpiados'}: ${limpiados} | ${DRY ? 'se actualizarían' : 'actualizados'}: ${corregidos}`);
  if (DRY) console.log('Ejecutar sin --dry-run para aplicar.');
}

function soloCambio(v, update) {
  const prev = v.proximoServiceKm ?? null;
  const next = update.proximoServiceKm && typeof update.proximoServiceKm === 'number' ? update.proximoServiceKm : null;
  if (prev !== next) return true;
  const prevF = v.proximoServiceFecha ? tsToMs(v.proximoServiceFecha) : null;
  const nextF = update.proximoServiceFecha && !update.proximoServiceFecha._methodName ? tsToMs(update.proximoServiceFecha) : null;
  return prevF !== nextF;
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });