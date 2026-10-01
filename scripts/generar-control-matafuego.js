/**
 * Genera los Excel de control de MATAFUEGO en PATENTE/Reportes/:
 *
 *   CONTROL_MATAFUEGO_MIXERS_<fecha>.xlsx  -> mezcladoras (tipo "mixer")
 *   CONTROL_MATAFUEGO_RESTO_<fecha>.xlsx   -> el resto de los vehiculos
 *
 * Cada fila es un vehiculo SIN matafuego, con patente, interno, tipo y la
 * documentacion que le falta (de la carpeta PATENTE/{patente}/).
 *
 * Reutiliza la misma deteccion de documentos que
 * scripts/generar-control-documentacion.js: carpeta local + repo git +
 * docsAdjuntos de Firestore.
 *
 *   node scripts/generar-control-matafuego.js
 *   npm run generar:matafuego
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { db } = require('../config/firebase');
const gh = require('../lib/github-docs');

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
const incluirBaja = args.includes('--incluir-baja');

/**
 * El campo `matafuego` es un objeto { estado, fechaControl, fechaVto }.
 * Se reportan DOS situaciones distintas porque no son lo mismo:
 *   - 'Sin dato'    -> el campo no existe en el doc (nunca se cargo)
 *   - 'Sin Matafuego'-> el campo existe pero el estado dice que no tiene
 * En los dos casos el vehiculo NO tiene matafuego, asi que entra al reporte;
 * la columna distingue el estado para saber que corregir.
 */
function estadoMatafuego(v) {
  const m = v.matafuego;
  const sinDato = { estado: 'Sin dato', sinMatafuego: true, vto: null, control: null };
  if (!m) return sinDato;
  if (typeof m === 'object') {
    const est = String(m.estado || '').trim();
    return {
      estado: est || 'Sin Matafuego',
      // el objeto guarda el vencimiento y la fecha de control aunque no tenga
      // matafuego cargado: se informan igual, que es lo que hay que completar
      vto: m.fechaVto || null,
      control: m.fechaControl || null,
      sinMatafuego: !est || est.toLowerCase() === 'sin matafuego'
    };
  }
  if (m === true) return { estado: 'Cargado', sinMatafuego: false, vto: null, control: null };
  if (m === false || m === '') return { estado: 'Sin Matafuego', sinMatafuego: true, vto: null, control: null };
  return { estado: String(m), sinMatafuego: false, vto: null, control: null };
}

// Mezcladora: el tipo viene con distinta capitalizacion en la base
// ("mixer" x22 y "Mixer" x1), asi que se compara sin distincion.
const esMixer = v => String(v.tipo || '').trim().toLowerCase() === 'mixer';

function archivosLocales(patente) {
  const dir = path.join(PATENTE_DIR, patente);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => EXT_OK.test(n) && !n.startsWith('_'));
}

function fmtFecha(date) {
  if (!date) return '';
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Devuelve la lista de documentos obligatorios que NO encuentra. */
function faltantesDe(v, patente, git) {
  const archivos = archivosLocales(patente);
  const enPc = t => archivos.some(n => {
    const base = path.parse(n).name.toLowerCase();
    return base === t || (base.startsWith(t) && /^\d*$/.test(base.slice(t.length)));
  });
  const enGit = t => (git ? ((git.get(patente) || []).some(n => gh.esDeTipo(n, t))) : null);

  const faltan = [];
  TIPOS.forEach(t => {
    if (enPc(t)) return;
    if (enGit(t) === true) return;             // esta en git, falta solo en esta PC
    if (enGit(t) === false && v.docsAdjuntos?.[t]) return; // subido desde la web
    faltan.push(ETIQUETA[t]);
  });
  return faltan;
}

function notaDe(patente, faltan, git) {
  const n = [];
  if (!fs.existsSync(path.join(PATENTE_DIR, patente))) n.push(`No existe la carpeta PATENTE/${patente}/`);
  if (git === null) n.push('Sin GITHUB_TOKEN: no se comparo con el repo');
  return n.join(' · ');
}

async function main() {
  if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });

  let git = null;
  try { git = await gh.listarPatenteGlobal(); } catch (e) { git = null; }

  const snap = await db.collection('vehicles').get();
  let autos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (soloPatente) {
    const p = soloPatente.toUpperCase();
    autos = autos.filter(v => String(v.patente || '').toUpperCase() === p);
  }
  if (!incluirBaja) autos = autos.filter(v => v.estadoGeneral !== 'Baja');

  const cmp = (a, b) => String(a.patente || '').localeCompare(
    String(b.patente || ''), undefined, { numeric: true });

  const conMatafuego = [], filas = [];
  autos.forEach(v => {
    const patente = String(v.patente || '').toUpperCase();
    const mf = estadoMatafuego(v);
    if (!mf.sinMatafuego) {
      conMatafuego.push(v);
      return;
    }
    const faltan = faltantesDe(v, patente, git);
    filas.push({
      patente,
      interno: v.interno || '',
      tipo: v.tipo || '',
      subtipo: v.subtipo || '',
      centro: v.centroTrabajo || '',
      empresa: v.empresa || '',
      estadoMatafuego: mf.estado,
      // sin matafuego cargado no hay vencimiento: queda para completar a mano
      venceMatafuego: mf.vto ? fmtFecha(mf.vto) : 'SIN CARGAR',
      controlMatafuego: mf.control ? fmtFecha(mf.control) : '',
      faltan: faltan.length,
      faltantes: faltan.length ? faltan.join(', ') : 'Documentacion completa',
      nota: notaDe(patente, faltan, git)
    });
  });

  filas.sort((a, b) => b.faltan - a.faltan || cmp(a, b));
  const filasMixer = filas.filter(f => esMixer(f));
  const filasResto = filas.filter(f => !esMixer(f));

  const hoy = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const sello = `${hoy.getFullYear()}-${p2(hoy.getMonth() + 1)}-${p2(hoy.getDate())}`;

  const columnas = [
    { header: 'Patente', key: 'patente', width: 12 },
    { header: 'Interno', key: 'interno', width: 10 },
    { header: 'Tipo', key: 'tipo', width: 17 },
    { header: 'Subtipo', key: 'subtipo', width: 14 },
    { header: 'Centro', key: 'centro', width: 12 },
    { header: 'Estado matafuego', key: 'estadoMatafuego', width: 17 },
    { header: 'Vence matafuego', key: 'venceMatafuego', width: 16 },
    { header: 'Control matafuego', key: 'controlMatafuego', width: 16 },
    { header: 'Faltantes', key: 'faltan', width: 10 },
    { header: 'Documentacion faltante', key: 'faltantes', width: 46 },
    { header: 'Empresa', key: 'empresa', width: 26 },
    { header: 'Nota', key: 'nota', width: 44 }
  ];

  const f1 = await escribir({
    archivo: path.join(SALIDA, `CONTROL_MATAFUEGO_MIXERS_${sello}.xlsx`),
    hoja: 'Mixers sin matafuego',
    columnas,
    filas: filasMixer,
    titulo: `Mezcladoras sin matafuego — ${filasMixer.length} de ${autos.filter(esMixer).length} — generado ${fmtFecha(hoy)}`,
    colorFila: r => (r.faltan >= 4 ? 'FFF1F1F1' : r.faltan >= 2 ? 'FFFFF4E5' : null)
  });
  const f2 = await escribir({
    archivo: path.join(SALIDA, `CONTROL_MATAFUEGO_RESTO_${sello}.xlsx`),
    hoja: 'Resto sin matafuego',
    columnas,
    filas: filasResto,
    titulo: `Resto de la flota sin matafuego — ${filasResto.length} de ${autos.filter(v => !esMixer(v)).length} — generado ${fmtFecha(hoy)}`,
    colorFila: r => (r.faltan >= 4 ? 'FFF1F1F1' : r.faltan >= 2 ? 'FFFFF4E5' : null)
  });

  const sinDato = filas.filter(f => f.estadoMatafuego === 'Sin dato').length;
  console.log(`\n${autos.length} vehiculos en servicio${soloPatente ? ' (patente ' + soloPatente + ')' : ''}${incluirBaja ? ' + bajas' : ''}`);
  console.log(`  Con matafuego cargado : ${conMatafuego.length}`);
  console.log(`  Sin matafuego        : ${filas.length}  (sin dato: ${sinDato} · marcados "Sin Matafuego": ${filas.length - sinDato})`);
  console.log(`    - Mixers           : ${filasMixer.length}`);
  console.log(`    - Resto            : ${filasResto.length}`);

  const porTipo = {};
  TIPOS.forEach(t => {
    const n = filas.filter(f => f.faltantes.includes(ETIQUETA[t])).length;
    if (n) porTipo[ETIQUETA[t]] = n;
  });
  if (Object.keys(porTipo).length) {
    console.log('\nDocumentacion que falta (contando solo los vehiculos de estos reportes):');
    Object.entries(porTipo).sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(`  ${k.padEnd(9)} ${String(v).padStart(3)} vehiculos`));
  }

  console.log(`\n  ${f1}  ->  ${filasMixer.length} filas`);
  console.log(`  ${f2}  ->  ${filasResto.length} filas`);
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
