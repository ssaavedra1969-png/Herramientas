const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
require(path.join(R, 'node_modules', 'dotenv')).config({ path: path.join(R, '.env') });
const { admin, db } = require(path.join(R, 'config', 'firebase'));
const XLSX = require(path.join(R, 'node_modules', 'xlsx'));

const PATENTE_PERMITIDA = 'AG269DZ';
const INTERNO_ESPERADO = 'V026';
const CHOFER_ESPERADO = 'Juan Cruz Dovale';
const DNI_ESPERADO = '40888197';
const EXCEL = path.join(R, 'PATENTE', 'Vtos', 'REVISAR_VENCIMIENTOS_CHOFERES_2026-11-24.xlsx');
const BACKUP_DIR = path.join(R, 'PATENTE', 'Vtos', 'BACKUP');
const BACKUP_FILE = path.join(BACKUP_DIR, 'AG269DZ_vehiculo_2026-11-25.json');
const PATENTE_ARG = (process.argv.find(a => a.startsWith('--patente=')) || '').split('=').slice(1).join('=') || PATENTE_PERMITIDA;
const APLICAR = process.argv.includes('--apply');
const HACER_BACKUP = process.argv.includes('--backup');

function normFecha(val) {
  if (!val) return null;
  if (typeof val === 'object' && val instanceof Date) {
    return { y: val.getFullYear(), m: val.getMonth() + 1, d: val.getDate() };
  }
  const s = String(val).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  return null;
}

function tsDate(partes) {
  return admin.firestore.Timestamp.fromDate(new Date(partes.y, partes.m - 1, partes.d, 12, 0, 0));
}

function fmt(val) {
  if (val == null) return '';
  if (typeof val.toDate !== 'function') return String(val);
  const d = val.toDate();
  const p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

(async () => {
  if (PATENTE_ARG !== PATENTE_PERMITIDA) {
    throw new Error('Este piloto solo acepta --patente=' + PATENTE_PERMITIDA);
  }

  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Revision choferes'], { defval: '', raw: true });
  const filas = rows.filter(r => String(r['Patente(s)'] || '').trim().toUpperCase() === PATENTE_PERMITIDA);
  if (filas.length !== 1) throw new Error('Excel: se esperaba 1 fila para ' + PATENTE_PERMITIDA + ', hay ' + filas.length);

  const r = filas[0];
  const int = String(r.Int || '').trim();
  const chofer = String(r.Chofer || '').trim();
  const dni = String(r['N° DNI'] || '').trim();
  const registro = String(r['N° Registro'] || '').trim();
  const vtoDNI = normFecha(r['Vto DNI']);
  const vtoRegistro = normFecha(r['Vto Registro']);

  if (int !== INTERNO_ESPERADO) throw new Error('Excel: interno ' + int + ' != ' + INTERNO_ESPERADO);
  if (chofer !== CHOFER_ESPERADO) throw new Error('Excel: chofer ' + chofer + ' != ' + CHOFER_ESPERADO);
  if (dni !== DNI_ESPERADO || registro !== DNI_ESPERADO) throw new Error('Excel: DNI/Registro ' + dni + '/' + registro + ' != ' + DNI_ESPERADO);
  if (!vtoDNI || !vtoRegistro) throw new Error('Excel: faltan fechas de DNI o Registro');

  const dniTs = tsDate(vtoDNI);
  const regTs = tsDate(vtoRegistro);
  const snap = await db.collection('vehicles').where('patente', '==', PATENTE_PERMITIDA).get();
  if (snap.size !== 1) throw new Error('Firestore: se esperaba 1 vehículo con patente ' + PATENTE_PERMITIDA + ', hay ' + snap.size);

  const doc = snap.docs[0];
  const v = doc.data() || {};
  if (String(v.interno || '') !== INTERNO_ESPERADO) throw new Error('Firestore: interno ' + v.interno + ' != ' + INTERNO_ESPERADO);
  if (String(v.chofer || '') !== CHOFER_ESPERADO) throw new Error('Firestore: chofer ' + v.chofer + ' != ' + CHOFER_ESPERADO);
  if (String(v.dni || '') !== DNI_ESPERADO || String(v.registro || '') !== DNI_ESPERADO) throw new Error('Firestore: DNI/Registro no coinciden');

  const patch = { vencimientoDNI: dniTs, vencimientoRegistro: regTs };

  console.log('PATENTE=' + PATENTE_PERMITIDA + ' | DOC=' + doc.id + ' | INTERNO=' + int + ' | CHOFER=' + chofer);
  console.log('ANTES: vencimientoDNI=' + fmt(v.vencimientoDNI) + ' | vencimientoRegistro=' + fmt(v.vencimientoRegistro));
  console.log('DESPUES: vencimientoDNI=' + fmt(dniTs) + ' | vencimientoRegistro=' + fmt(regTs));
  console.log('PATCH_SOLO_2_CAMPOS=' + JSON.stringify({ vencimientoDNI: fmt(dniTs), vencimientoRegistro: fmt(regTs) }, null, 2));

  if (HACER_BACKUP) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({ id: doc.id, patente: PATENTE_PERMITIDA, fecha: new Date().toISOString(), data: v }, null, 2));
    console.log('BACKUP=' + BACKUP_FILE);
    return;
  }

  if (APLICAR) {
    if (!fs.existsSync(BACKUP_FILE)) throw new Error('Falta el backup: ' + BACKUP_FILE);
    await doc.ref.update(patch);
    console.log('APLICADO=1 (solo vencimientoDNI y vencimientoRegistro)');
    return;
  }

  console.log('DRY-RUN: no se escribió nada. Agregar --apply después del backup.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
