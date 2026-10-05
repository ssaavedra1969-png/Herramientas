/**
 * Genera los dos Excel de control de PATENTE/Reportes/:
 *
 *   CONTROL_FALTANTES_<fecha>.xlsx  -> qué documentación NO está en la carpeta
 *                                      PATENTE/{patente}/, ordenado por patente
 *   CONTROL_VENCIDOS_<fecha>.xlsx   -> qué vencimiento YA pasó, ordenado por
 *                                      antigüedad (primero lo más vencido)
 *
 * Mismo formato de columnas que el CONTROL_VENCIMIENTOS que ya usás
 * (Patente | Tipo documento | Vencimiento | Nota) para que sirva de entrada
 * a la carga masiva o para completar a mano.
 *
 * OJO: el archivo de vencidos NO se llama CONTROL_VENCIMIENTOS_* a propósito,
 * porque scripts/cargar-vencimientos.js toma el CONTROL_VENCIMIENTOS_*.xlsx más
 * reciente de PATENTE/Vtos/ y lo escribe en Firestore. Si este saliera con el
 * mismo nombre, la carga masiva se comería esta lista.
 *
 *   node scripts/generar-control-documentacion.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { db } = require('../config/firebase');
const gh = require('../lib/github-docs');
const { sinDeshabilitados } = require('../lib/utils');

const RAIZ = path.join(__dirname, '..');
const PATENTE_DIR = path.join(RAIZ, 'PATENTE');
const SALIDA = path.join(PATENTE_DIR, 'Reportes');

// Orden fijo de los 6 documentos obligatorios (mismo que en la app)
const TIPOS = ['titulo', 'cedula', 'seguro', 'vtv', 'registro', 'dni'];
const ETIQUETA = {
  titulo: 'Titulo', cedula: 'Cedula', seguro: 'Seguro',
  vtv: 'VTV', registro: 'Registro', dni: 'DNI'
};
const EXT_OK = /\.(pdf|jpg|jpeg|png)$/i;

const args = process.argv.slice(2);
const soloPatente = (args.find(a => a.startsWith('--patente=')) || '').split('=')[1] || null;

/* Fecha -> "días" con la misma cuenta que la app (auth-client.js daysUntil:
   diferencia en ms contra ahora, redondeada hacia arriba). La app corre en la
   zona del navegador, así que el Excel puede diferir en 1 día de lo que muestra
   el dashboard: se toma la fecha local del servidor, que es la de la PC. */
function diasHasta(date) {
  if (!date) return null;
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / 86400000);
}
function fmtFecha(date) {
  if (!date) return '';
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Los mismos getters que el dashboard (DOC_TYPES de public/js/dashboard.js)
const VENCIMIENTO = {
  vtv: v => v.vtv?.fechaVencimiento,
  seguro: v => v.seguro?.fechaVencimiento,
  cedula: v => v.documentacion?.cedula?.fechaVencimiento,
  registro: v => v.vencimientoRegistro,
  dni: v => v.vencimientoDNI
};

function archivosLocales(patente) {
  const dir = path.join(PATENTE_DIR, patente);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => EXT_OK.test(n) && !n.startsWith('_'));
}

async function main() {
  if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });

  // Qué ve la app en producción: la carpeta PATENTE/ está en .vercelignore, así
  // que en Vercel no existe en disco. Lo que cuenta es lo versionado en git.
  let git = null;
  try { git = await gh.listarPatenteGlobal(); } catch (e) { git = null; }
  const enGit = p => (git ? (git.get(p) || []) : null);
  const tieneEnGit = (p, tipo) => (enGit(p) || []).some(n => gh.esDeTipo(n, tipo));

  const snap = await db.collection('vehicles').get();
  let autos = sinDeshabilitados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  if (soloPatente) {
    const p = soloPatente.toUpperCase();
    autos = autos.filter(v => String(v.patente || '').toUpperCase() === p);
  }
  autos = autos
    .filter(v => v.estadoGeneral !== 'Baja')
    .sort((a, b) => String(a.patente || '').localeCompare(String(b.patente || ''), undefined, { numeric: true }));

  const hoy = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const sello = `${hoy.getFullYear()}-${p2(hoy.getMonth() + 1)}-${p2(hoy.getDate())}`;

  /* ---------- Excel 1: documentación faltante ---------- */
  const faltantes = [];
  const sinCarpeta = [];
  const carpetaVacia = [];
  autos.forEach(v => {
    const patente = String(v.patente || '').toUpperCase();
    const existeCarpeta = fs.existsSync(path.join(PATENTE_DIR, patente));
    const archivos = archivosLocales(patente);
    if (!existeCarpeta) sinCarpeta.push(patente);
    else if (!archivos.length) carpetaVacia.push(patente);
    TIPOS.forEach(tipo => {
      const enPc = archivos.some(n => {
        const base = path.parse(n).name.toLowerCase();
        return base === tipo || (base.startsWith(tipo) && /^\d*$/.test(base.slice(tipo.length)));
      });
      if (enPc) return;
      const subida = !!v.docsAdjuntos?.[tipo];
      const fecha = VENCIMIENTO[tipo] ? VENCIMIENTO[tipo](v) : null;
      const notas = [];
      if (subida) notas.push('Subido desde la web (no esta en la carpeta)');
      if (!existeCarpeta) notas.push(`No existe la carpeta PATENTE/${patente}/`);
      else if (!archivos.length) notas.push(`La carpeta PATENTE/${patente}/ esta vacia`);
      if (enGit === null) notas.push('Sin GITHUB_TOKEN: no se pudo comparar con el repo');
      else if (tieneEnGit(patente, tipo)) notas.push('Esta en git: falta solo en esta PC');
      else notas.push(`Falta PATENTE/${patente}/${tipo}.pdf`);
      if (fecha) notas.push(`Vencimiento cargado: ${fmtFecha(fecha)}`);
      else if (tipo !== 'titulo') notas.push('Vencimiento SIN CARGAR');
      faltantes.push({
        patente,
        interno: v.interno || '',
        chofer: v.chofer || '',
        tipo: ETIQUETA[tipo],
        vencimiento: fecha ? fmtFecha(fecha) : 'SIN CARGA',
        nota: notas.join(' · ')
      });
    });
  });

  /* ---------- Excel 2: vencimientos ya pasados ---------- */
  const vencidos = [];
  autos.forEach(v => {
    const patente = String(v.patente || '').toUpperCase();
    Object.keys(VENCIMIENTO).forEach(tipo => {
      const raw = VENCIMIENTO[tipo](v);
      if (!raw) return;
      const dias = diasHasta(raw);
      if (dias === null || dias > 0) return;
      const notas = [];
      if (tipo === 'cedula') {
        notas.push('La cedula (CUIL) no tiene vencimiento: la fecha es referencial, no la marques como vencida');
        if (v.documentacion?.cedula?.noVence) notas.push('El vehiculo ya esta marcado noVence');
      }
      vencidos.push({
        patente,
        interno: v.interno || '',
        chofer: v.chofer || '',
        tipo: ETIQUETA[tipo],
        vencimiento: fmtFecha(raw),
        dias: -dias,
        empresa: v.empresa || '',
        nota: notas.join(' · ')
      });
    });
  });
  vencidos.sort((a, b) => b.dias - a.dias || a.patente.localeCompare(b.patente));

  const resumen = [];
  TIPOS.forEach(t => {
    const n = autos.length - faltantes.filter(f => f.tipo === ETIQUETA[t]).length;
    resumen.push({ tipo: ETIQUETA[t], conArchivo: n, faltan: autos.length - n });
  });

  const f1 = await escribir({
    archivo: path.join(SALIDA, `CONTROL_FALTANTES_${sello}.xlsx`),
    hoja: 'Faltantes',
    columnas: [
      { header: 'Patente', key: 'patente', width: 12 },
      { header: 'Interno', key: 'interno', width: 10 },
      { header: 'Chofer', key: 'chofer', width: 22 },
      { header: 'Tipo documento', key: 'tipo', width: 16 },
      { header: 'Vencimiento', key: 'vencimiento', width: 15 },
      { header: 'Nota', key: 'nota', width: 72 }
    ],
    filas: faltantes,
    titulo: `Documentacion faltante en PATENTE/ — ${autos.length} vehiculos en servicio — generado ${fmtFecha(hoy)}`,
    colorFila: () => null
  });
  const f2 = await escribir({
    archivo: path.join(SALIDA, `CONTROL_VENCIDOS_${sello}.xlsx`),
    hoja: 'Vencidos',
    columnas: [
      { header: 'Patente', key: 'patente', width: 12 },
      { header: 'Interno', key: 'interno', width: 10 },
      { header: 'Chofer', key: 'chofer', width: 22 },
      { header: 'Tipo documento', key: 'tipo', width: 16 },
      { header: 'Vencimiento', key: 'vencimiento', width: 15 },
      { header: 'Dias vencida', key: 'dias', width: 13 },
      { header: 'Empresa', key: 'empresa', width: 26 },
      { header: 'Nota', key: 'nota', width: 60 }
    ],
    filas: vencidos,
    titulo: `Vencimientos ya pasados — generado ${fmtFecha(hoy)}`,
    // mientras mas viejo, mas rojo
    colorFila: r => (r.dias > 365 ? 'FFF1F1F1' : r.dias > 90 ? 'FFFFF4E5' : null)
  });

  console.log(`\n${autos.length} vehiculos en servicio (${soloPatente ? 'filtrado por ' + soloPatente : 'sin filtro'})`);
  console.log('\nDocumentacion en PATENTE/:');
  resumen.forEach(r => console.log(`  ${r.tipo.padEnd(9)} ${String(r.conArchivo).padStart(2)} con archivo   ${String(r.faltan).padStart(2)} faltan`));
  if (sinCarpeta.length) console.log(`\n  Sin carpeta en PATENTE/: ${sinCarpeta.join(', ')}`);
  if (carpetaVacia.length) console.log(`  Con carpeta vacia: ${carpetaVacia.join(', ')}`);
  console.log(`\n  ${f1}  ->  ${faltantes.length} documentos faltantes`);
  console.log(`  ${f2}  ->  ${vencidos.length} vencimientos`);
  const porTipo = {};
  vencidos.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1; });
  if (Object.keys(porTipo).length) console.log('\nVencidos por tipo:', JSON.stringify(porTipo));
  console.log(`\nOutput: ${SALIDA}\n`);
}

async function escribir({ archivo, hoja, columnas, filas, titulo, colorFila }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Grupo Falpat SRL';
  const ws = wb.addWorksheet(hoja, { views: [{ state: 'frozen', ySplit: 2 }] });

  ws.mergeCells(1, 1, 1, columnas.length);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 12, color: { argb: 'FF1F2937' } };
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 22;

  ws.getRow(2).values = columnas.map(c => c.header);
  ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(2).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle' };
  });
  columnas.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  filas.forEach(f => {
    const row = ws.addRow(columnas.map(c => f[c.key]));
    const bg = colorFila ? colorFila(f) : null;
    if (bg) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
  });
  if (!filas.length) {
    const row = ws.addRow(['(sin registros)']);
    row.font = { italic: true, color: { argb: 'FF64748B' } };
  }

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columnas.length } };
  await wb.xlsx.writeFile(archivo);
  return path.basename(archivo);
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
