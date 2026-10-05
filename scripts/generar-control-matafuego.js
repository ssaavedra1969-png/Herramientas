/**
 * Genera los Excel de control de MATAFUEGO en PATENTE/Reportes/:
 *
 *   CONTROL_MATAFUEGO_MIXERS_<fecha>.xlsx           -> mezcladoras (tipo "mixer") SIN matafuego
 *   CONTROL_MATAFUEGO_RESTO_<fecha>.xlsx            -> el resto de los vehiculos SIN matafuego
 *   CONTROL_MATAFUEGO_MIXERS_CON_MATAFUEGO_<fecha>.xlsx -> las mezcladoras que SI tienen
 *
 * Los dos primeros son un control de faltantes (ordenados por cuantos papeles
 * faltan). El tercero es la lista de las que ya lo tienen, para lo que haya que
 * hacer con ellas (renovar el certificado, etc.): va por patente.
 *
 * Cada fila es un vehiculo con patente, interno, chofer, tipo, centro, estado y
 * vencimiento del matafuego, que documentacion le falta (de la carpeta
 * PATENTE/{patente}/) y empresa. Las 3 salidas usan las mismas columnas.
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
const incluirBaja = args.includes('--incluir-baja');

/**
 * El campo `matafuego` es un objeto { estado, fechaControl, fechaVto }.
 * Hay dos situaciones distintas y ninguna de las dos tiene matafuego:
 *   - el campo no existe en el doc (nunca se cargo)
 *   - el campo existe pero el estado dice que no tiene
 * El usuario pidio que las dos se informen igual como "Sin Matafuego", asi que
 * la columna ya no las distingue. Para no perder ese dato, `sinDato` queda en
 * la fila (no es columna) y el script lo cuenta en la consola.
 */
function estadoMatafuego(v) {
  const m = v.matafuego;
  if (!m) return { estado: 'Sin Matafuego', sinMatafuego: true, sinDato: true, vto: null, control: null };
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

// Para agrupar por tipo: misma clave que usa la app (normTxt) para no partir
// "mixer" y "Mixer" en dos grupos del mismo tipo.
const normTipo = t => String(t == null ? '' : t).trim().toLowerCase();

// Orden de filas. Va a nivel de modulo porque lo usan tanto main() como
// escribir() (que es la que arma los grupos del informe completo).
// {numeric:true} para que AH2 vaya antes que AH10.
const cmp = (a, b) => String(a.patente || '').localeCompare(
  String(b.patente || ''), undefined, { numeric: true });

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

async function main() {
  if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });

  let git = null;
  try { git = await gh.listarPatenteGlobal(); } catch (e) { git = null; }

  const snap = await db.collection('vehicles').get();
  let autos = sinDeshabilitados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  if (soloPatente) {
    const p = soloPatente.toUpperCase();
    autos = autos.filter(v => String(v.patente || '').toUpperCase() === p);
  }
  if (!incluirBaja) autos = autos.filter(v => v.estadoGeneral !== 'Baja');

  const conMatafuego = [], filas = [], filasCon = [];
  // Una sola forma de fila para las dos listas: los mixers que TIENEN matafuego
  // se exportan con exactamente las mismas columnas que los que no.
  const filaDe = (v, patente, mf) => {
    const faltan = faltantesDe(v, patente, git);
    return {
      patente,
      interno: v.interno || '',
      chofer: v.chofer || '',
      tipo: v.tipo || '',
      centro: v.centroTrabajo || '',
      estadoMatafuego: mf.estado,
      // sin matafuego cargado no hay vencimiento: queda para completar a mano
      venceMatafuego: mf.vto ? fmtFecha(mf.vto) : 'SIN CARGAR',
      empresa: v.empresa || '',
      faltan: faltan.length,
      faltantes: faltan.length ? faltan.join(', ') : 'Documentacion completa',
      // no son columnas: ordenan y cuentan
      conMatafuego: !mf.sinMatafuego,
      sinDato: !!mf.sinDato
    };
  };
  autos.forEach(v => {
    const patente = String(v.patente || '').toUpperCase();
    const mf = estadoMatafuego(v);
    if (!mf.sinMatafuego) {
      conMatafuego.push(v);
      filasCon.push(filaDe(v, patente, mf));
      return;
    }
    filas.push(filaDe(v, patente, mf));
  });

  filas.sort((a, b) => b.faltan - a.faltan || cmp(a, b));
  const filasMixer = filas.filter(f => esMixer(f));
  const filasResto = filas.filter(f => !esMixer(f));

  /* El informe completo: TODA la flota, con y sin matafuego, agrupada por tipo.
     El agrupado lo hace `escribir()` (es el que mete las filas de encabezado) y
     adentro de cada tipo va POR PATENTE: se lee como una lista de vehiculos.
     El tipo se agrupa sin distincion de mayusculas porque la base tiene
     "mixer" (22) y "Mixer" (1) y sin normalizar salen dos grupos del mismo
     tipo. El cmp es con {numeric:true} para que AH2 vaya antes que AH10. */
  const todas = [...filasCon, ...filas];

  const hoy = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const sello = `${hoy.getFullYear()}-${p2(hoy.getMonth() + 1)}-${p2(hoy.getDate())}`;

  /* Solo las columnas que se usan para salir a buscar los papeles: patente para
     ubicar la carpeta, chofer para llamar a quien corresponde, tipo/centro para
     agrupar, el estado y el vencimiento del matafuego, y qué documentación falta.
     NO van Subtipo, "Control matafuego", el contador "Faltantes" (redundante con
     la lista de nombres) ni "Nota". */
  const columnas = [
    { header: 'Patente', key: 'patente', width: 11 },
    { header: 'Interno', key: 'interno', width: 10 },
    { header: 'Chofer', key: 'chofer', width: 22 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: 'Centro', key: 'centro', width: 14 },
    { header: 'Estado matafuego', key: 'estadoMatafuego', width: 17 },
    { header: 'Vence matafuego', key: 'venceMatafuego', width: 17 },
    { header: 'Documentacion faltante', key: 'faltantes', width: 38 },
    { header: 'Empresa', key: 'empresa', width: 28 }
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

  const f3 = await escribir({
    archivo: path.join(SALIDA, `CONTROL_MATAFUEGO_TODOS_${sello}.xlsx`),
    hoja: 'Toda la flota',
    columnas,
    filas: todas,
    titulo: `Toda la flota con y sin matafuego — ${todas.length} vehiculos (${filasCon.length} con matafuego) — generado ${fmtFecha(hoy)}`,
    // mismo pintado que los otros dos: gris si faltan 4+ papeles, naranja si
    // faltan 2 o 3
    colorFila: r => (r.faltan >= 4 ? 'FFF1F1F1' : r.faltan >= 2 ? 'FFFFF4E5' : null),
    agrupadoPor: 'tipo'
  });

  const sinDato = todas.filter(f => f.sinDato).length;
  const sinCarpeta = filas.filter(f => !fs.existsSync(path.join(PATENTE_DIR, f.patente))).map(f => f.patente);
  console.log(`\n${autos.length} vehiculos en servicio${soloPatente ? ' (patente ' + soloPatente + ')' : ''}${incluirBaja ? ' + bajas' : ''}`);
  console.log(`  Con matafuego cargado : ${conMatafuego.length}  (mixers: ${filasCon.filter(esMixer).length})`);
  if (conMatafuego.length) {
    console.log(`    ${conMatafuego.map(v => String(v.patente || '').toUpperCase() + (esMixer(v) ? ' (mixer)' : '')).join(', ')}`);
  }
  console.log(`  Sin matafuego        : ${filas.length}  (sin dato: ${sinDato} · marcados "Sin Matafuego": ${filas.length - sinDato})`);
  console.log(`    - Mixers           : ${filasMixer.length}`);
  console.log(`    - Resto            : ${filasResto.length}`);
  if (git === null) console.log('\n  !! Sin GITHUB_TOKEN: no se comparo con el repo, puede marcar como faltante un PDF que ya esta en git');
  if (sinCarpeta.length) console.log(`  Sin carpeta en PATENTE/: ${sinCarpeta.join(', ')}`);

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

  // Resumen de consola (no del archivo: el agrupado del .xlsx lo hace escribir)
  const porTipoFlota = new Map();
  todas.forEach(f => {
    const k = normTipo(f.tipo);
    if (!porTipoFlota.has(k)) porTipoFlota.set(k, []);
    porTipoFlota.get(k).push(f);
  });
  const gruposTipo = [...porTipoFlota.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`\n  ${f1}  ->  ${filasMixer.length} filas`);
  console.log(`  ${f2}  ->  ${filasResto.length} filas`);
  console.log(`  ${f3}  ->  ${todas.length} filas en ${gruposTipo.length} tipos`);
  console.log('\n  Por tipo (con / sin matafuego):');
  gruposTipo.forEach(([, g]) => {
    const con = g.filter(f => f.conMatafuego).length;
    console.log(`    ${String(g[0].tipo || 'Sin tipo').padEnd(16)} ${String(g.length).padStart(3)} vehiculos  (${con} con / ${g.length - con} sin)`);
  });
  console.log(`\nOutput: ${SALIDA}\n`);
}

async function escribir({ archivo, hoja, columnas, filas, titulo, colorFila, agrupadoPor }) {
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

  const agregarFila = f => {
    const row = ws.addRow(columnas.map(c => f[c.key]));
    const bg = colorFila ? colorFila(f) : null;
    if (bg) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
  };

  /* agrupadoPor: una fila de encabezado combine cada grupo, con cuantos
     vehículos tiene y cuantos con matafuego (lo primero que se mira). */
  const encabezadoGrupo = (nombre, g) => {
    const con = g.filter(f => f.conMatafuego).length;
    const row = ws.addRow([`${String(nombre).toUpperCase()} — ${g.length} ${g.length === 1 ? 'vehiculo' : 'vehiculos'}${con ? ` · ${con} con matafuego` : ''}`]);
    ws.mergeCells(row.number, 1, row.number, columnas.length);
    const c = row.getCell(1);
    c.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
    c.alignment = { vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    row.height = 18;
  };

  if (agrupadoPor) {
    const mapa = new Map();
    filas.forEach(f => {
      const k = normTipo(f[agrupadoPor]);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(f);
    });
    [...mapa.keys()].sort().forEach(k => {
      // adentro del grupo, por patente (no por cuantos papeles faltan: este
      // informe es el control de matafuegos, no el de documentacion)
      const g = mapa.get(k).sort(cmp);
      encabezadoGrupo(g[0][agrupadoPor] || 'Sin tipo', g);
      g.forEach(agregarFila);
    });
  } else {
    filas.forEach(agregarFila);
  }
  if (!filas.length) {
    const row = ws.addRow(['(sin registros)']);
    row.font = { italic: true, color: { argb: 'FF64748B' } };
  }

  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columnas.length } };
  await wb.xlsx.writeFile(archivo);
  return path.basename(archivo);
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
