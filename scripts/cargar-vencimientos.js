/**
 * Carga masiva de vencimientos de documentación desde PATENTE/Vtos/.
 *
 * Lee el Excel CONTROL_VENCIMIENTOS_*.xlsx más reciente de la carpeta
 * PATENTE/Vtos/ y actualiza Firestore con el mismo patrón del modal de
 * documentación de la web (campo principal + campo genérico documentacion.*):
 *
 *   VTV      -> vtv.fechaVencimiento            + documentacion.vtv.fechaVencimiento
 *   Seguro   -> seguro.fechaVencimiento         + documentacion.seguro.fechaVencimiento
 *   Registro -> vencimientoRegistro             + documentacion.registro.fechaVencimiento
 *   DNI      -> vencimientoDNI                  + documentacion.dni.fechaVencimiento
 *   Cedula   -> documentacion.cedula.fechaVencimiento (solo genérico)
 *   Titulo   -> documentacion.titulo.fechaVencimiento (solo genérico)
 *
 * Las celdas "SIN CARGA" se ignoran (no se escriben). Las celdas "NO VENCE"
 * marcan documentacion.<tipo>.noVence = true (no tienen vencimiento).
 *
 * Uso:
 *   node scripts/cargar-vencimientos.js              # carga todo
 *   node scripts/cargar-vencimientos.js --dry-run    # solo muestra qué haría
 *   node scripts/cargar-vencimientos.js --tipo=cedula  # solo un tipo de documento
 *   node scripts/cargar-vencimientos.js --archivo PATENTE/Vtos/otro.xlsx
 *   node scripts/cargar-vencimientos.js --patente AB922TD
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db, admin } = require('../config/firebase');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const soloPatente = (args.find(a => a.startsWith('--patente=')) || '').split('=')[1] || null;
const soloTipo = (args.find(a => a.startsWith('--tipo=')) || '').split('=')[1] || null;
const archivoArg = (args.find(a => a.startsWith('--archivo=')) || '').split('=')[1] || null;

// normaliza a dd/mm/yyyy (acepta también 2026-10-07 y Date/serial de Excel)
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

function tsDate({ y, m, d }) {
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return admin.firestore.Timestamp.fromDate(dt);
}

function excelReciente() {
  const dir = path.join(__dirname, '..', 'PATENTE', 'Vtos');
  if (!fs.existsSync(dir)) return null;
  const archivos = fs.readdirSync(dir).filter(f => /^CONTROL_VENCIMIENTOS_.*\.xlsx$/i.test(f));
  if (!archivos.length) return null;
  archivos.sort();
  return path.join(dir, archivos[archivos.length - 1]);
}

const archivo = archivoArg ? path.join(__dirname, '..', archivoArg) : excelReciente();
if (!archivo || !fs.existsSync(archivo)) {
  console.error('No se encontró Excel en PATENTE/Vtos/. Usalo con --archivo=...');
  process.exit(1);
}

const wb = XLSX.readFile(archivo);
const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
console.log(`Lectura: ${path.basename(archivo)} | ${filas.length} filas | ${DRY ? 'DRY-RUN (no escribe)' : 'ESCRIBE en Firestore'}\n`);

// agrupar por patente
const porPatente = {};
for (const r of filas) {
  const pat = String(r.Patente || '').trim().toUpperCase();
  const tipo = String(r['Tipo documento'] || '').trim();
  if (!pat || !tipo) continue;
  if (soloPatente && pat !== soloPatente.toUpperCase()) continue;
  if (soloTipo && tipo.toLowerCase() !== soloTipo.toLowerCase()) continue;
  const raw = String(r.Vencimiento || '').trim();
  const esNoVence = raw.toUpperCase() === 'NO VENCE';
  const fecha = normFecha(raw);
  if (fecha) (porPatente[pat] = porPatente[pat] || []).push({ tipo, fecha });
  else if (esNoVence) (porPatente[pat] = porPatente[pat] || []).push({ tipo, noVence: true });
  // SIN CARGA / vacío / no parseable -> se ignora
}

async function main() {
  let act = 0, skip = 0, err = 0, sinCambio = 0;
  for (const [pat, items] of Object.entries(porPatente)) {
    try {
      const snap = await db.collection('vehicles').where('patente', '==', pat).get();
      if (snap.empty) { console.log(`SKIP ${pat} (no existe en Firestore)`); skip++; continue; }
      const doc = snap.docs[0];
      const data = doc.data();
      const update = {
        vtv: { ...(data.vtv || {}) },
        seguro: { ...(data.seguro || {}) },
        documentacion: { ...(data.documentacion || {}) }
      };
      let cambiado = false;
      const toques = [];
      for (const item of items) {
        const key = item.tipo.toLowerCase();
        if (item.noVence) {
          update.documentacion[key] = { ...((update.documentacion[key] || {})), noVence: true };
          toques.push(`${item.tipo}=NO VENCE`);
          cambiado = true;
          continue;
        }
        const { fecha } = item;
        const ts = tsDate(fecha);
        if (item.tipo === 'VTV' || key === 'vtv') update.vtv.fechaVencimiento = ts;
        else if (item.tipo === 'Seguro' || key === 'seguro') update.seguro.fechaVencimiento = ts;
        else if (item.tipo === 'Registro' || key === 'registro') update.vencimientoRegistro = ts;
        else if (item.tipo === 'DNI' || key === 'dni') update.vencimientoDNI = ts;
        update.documentacion[key] = { ...((update.documentacion[key] || {})), fechaVencimiento: ts, noVence: false };
        toques.push(`${item.tipo}=${String(fecha.d).padStart(2, '0')}/${String(fecha.m).padStart(2, '0')}/${fecha.y}`);
        cambiado = true;
      }
      if (!cambiado) { sinCambio++; continue; }
      if (DRY) { console.log(`[DRY] ${pat} -> ${toques.join(', ')}`); continue; }
      await doc.ref.update(update);
      act++;
      console.log(`OK ${pat} -> ${toques.join(', ')}`);
    } catch (e) {
      console.log(`ERR ${pat}: ${e.message.slice(0, 120)}`);
      err++;
    }
  }
  console.log(DRY
    ? `\n[DRY-RUN] Se escribirían ${Object.keys(porPatente).length} vehículos.`
    : `\nActualizados: ${act} | Sin cambios: ${sinCambio} | No existen: ${skip} | Errores: ${err}`);
  process.exit(0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });