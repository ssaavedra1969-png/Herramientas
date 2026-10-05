/* Genera el PDF de control de seguros de TODA la flota, ordenado por fecha de
   vencimiento y agrupado por compañía de seguro.

   A diferencia de los reportes de la web, este PDF no filtra nada: entran
   todos los vehículos habilitados, tengan o no seguro, fecha o documentación.
   Los que no tienen seguro cargado van igual, al final de su compañía, para que
   el listado sirva de control de lo que falta cargar y no solo de lo vencido.

   Los vehículos deshabilitados (campo `deshabilitado`) NO entran: no cuentan
   para ningún informe. Ver lib/utils.js.

   Salida por defecto:
     \\Admin1\...\Grupo Falpat\SEGURO\Seguros en APP\CONTROL_SEGUROS_<fecha>.pdf

   Uso:
     node scripts/generar-pdf-seguros.js
     node scripts/generar-pdf-seguros.js --salida=C:\temp\prueba.pdf
     node scripts/generar-pdf-seguros.js --patente=LOO879
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebase');
const { toDate, esDeshabilitado } = require('../lib/utils');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

const DESTINO_DEF = '\\\\Admin1\\compartida\\Archivos1\\Grupo Falpat\\SEGURO\\Seguros en APP';
const args = process.argv.slice(2);
const arg = n => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || '';
const soloPatente = arg('patente').toUpperCase() || null;

/* ---- Lectura de fechas: los mismos 3 esquemas que usa la app ----------------
   En Firestore conviven tres lugares para la misma fecha (legacy anidado, campo
   plano y documentacion.<tipo>). Si solo se mira uno, el PDF va a marcar
   "sin seguro" en vehículos que sí lo tienen cargado. Es la misma función que
   fechaDocVenc() en routes/admin.js. */
const CAMPOS_TOP = { seguro: 'vencimientoSeguro' };

function fechaYMD(val) {
  if (!val) return null;
  let d = val.toDate ? val.toDate() : val;
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function fechaSeguro(v) {
  const doc = (v.documentacion && v.documentacion.seguro) || null;
  const legacy = v.seguro || null;
  const top = CAMPOS_TOP.seguro ? v[CAMPOS_TOP.seguro] : null;
  const cand =
    (legacy && (legacy.fechaVencimiento || legacy.fechaVto)) ||
    top ||
    (doc && doc.fechaVencimiento) ||
    null;
  return fechaYMD(cand);
}

// Días de calendario contra HOY (misma cuenta que diasHastaYMD en routes/admin.js).
function diasHastaYMD(ymd) {
  if (!ymd) return null;
  const vto = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  const hoy = new Date();
  const h = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((vto - h) / 86400000);
}

function normTxt(s) { return String(s || '').trim().toLowerCase(); }
function p2(n) { return String(n).padStart(2, '0'); }
function sello() {
  const h = new Date();
  return `${h.getFullYear()}-${p2(h.getMonth() + 1)}-${p2(h.getDate())}`;
}
function fechaCorta(ymd) {
  if (!ymd) return 'SIN FECHA';
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}
function textoEstado(dias) {
  if (dias === null) return 'SIN SEGURO';
  if (dias < 0) return `VENCIDO (${Math.abs(dias)} d)`;
  if (dias === 0) return 'VENCE HOY';
  return `${dias} d`;
}

// Un logo cacheado como data URI, igual que getLogoBase64() en los PDF de la web.
let _logoB64 = null;
function logoB64() {
  if (_logoB64) return _logoB64;
  const p = path.join(__dirname, '..', 'public', 'images', 'fp3d.png');
  if (!fs.existsSync(p)) return null;
  _logoB64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  return _logoB64;
}

(async () => {
  const snap = await db.collection('vehicles').get();
  let filas = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => !esDeshabilitado(v));
  const totalFlota = filas.length;
  if (soloPatente) filas = filas.filter(v => String(v.patente || '').toUpperCase() === soloPatente);

  filas = filas.map(v => {
    const ymd = fechaSeguro(v);
    const comp = (v.seguro && (v.seguro.compania || v.seguro['compañía'])) || '';
    return {
      patente: String(v.patente || '').toUpperCase(),
      interno: v.interno || '',
      tipo: v.tipo || '',
      chofer: v.chofer || v.conductorHabitual || '',
      poliza: (v.seguro && v.seguro.poliza) || '',
      compania: String(comp).trim(),
      ymd,
      dias: diasHastaYMD(ymd)
    };
  });

  /* Agrupar por compañía. La clave es normTxt() porque en la flota conviven
     "Sanity" y "sanity" como dos strings distintos; si se agrupara por el
     valor crudo saldrían dos bloques de la misma aseguradora. */
  const grupos = new Map();
  filas.forEach(f => {
    const k = normTxt(f.compania);
    if (!grupos.has(k)) grupos.set(k, { nombre: f.compania || 'SIN COMPAÑIA', filas: [] });
    grupos.get(k).filas.push(f);
  });

  // Las fechas ordenan; las que no tienen fecha van al final de su compañía.
  const orden = (a, b) => {
    if (a.dias === null && b.dias === null) return a.patente.localeCompare(b.patente);
    if (a.dias === null) return 1;
    if (b.dias === null) return -1;
    return a.dias - b.dias || a.patente.localeCompare(b.patente);
  };
  grupos.forEach(g => g.filas.sort(orden));

  // Las compañías ordenan por su fecha más próxima (la más urgente primero).
  // Las que no tienen ninguna fecha cargada van al final, por nombre.
  const listaGrupos = [...grupos.values()].sort((a, b) => {
    const am = a.filas.reduce((m, f) => (f.dias === null ? m : m === null ? f.dias : Math.min(m, f.dias)), null);
    const bm = b.filas.reduce((m, f) => (f.dias === null ? m : m === null ? f.dias : Math.min(m, f.dias)), null);
    if (am === null && bm === null) return a.nombre.localeCompare(b.nombre, 'es');
    if (am === null) return 1;
    if (bm === null) return -1;
    return am - bm || a.nombre.localeCompare(b.nombre, 'es');
  });

  const conFecha = filas.filter(f => f.dias !== null);
  const vencidos = conFecha.filter(f => f.dias < 0);
  const proximos = conFecha.filter(f => f.dias >= 0 && f.dias <= 30);

  /* ---- Armado del PDF: una sola tabla con una fila de encabezado por compañía
     (autoTable la fusiona con mergeCells). Así la paginación es automática y
     el encabezado de la compañía viaja con su grupo aunque se parta la página. */
  const body = [];
  listaGrupos.forEach(g => {
    body.push([`${g.nombre.toUpperCase()} - ${g.filas.length} vehículo${g.filas.length === 1 ? '' : 's'}`]);
    g.filas.forEach(f => body.push([
      f.patente, f.interno, f.tipo, f.chofer, f.poliza || '-', fechaCorta(f.ymd), textoEstado(f.dias)
    ]));
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const M = 14;
  const anchoUtil = 210 - M * 2;

  const logo = logoB64();
  if (logo) doc.addImage(logo, 'PNG', M, 10, 26, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text('Control de Seguros - Flota completa', M, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`Ordenado por vencimiento, agrupado por compañía. Generado ${sello()}.`, M, 38);
  doc.text(
    `${filas.length} vehículo${filas.length === 1 ? '' : 's'} - ${conFecha.length} con seguro con fecha - ` +
    `${vencidos.length} vencido${vencidos.length === 1 ? '' : 's'} - ${proximos.length} a vencer en 30 días - ` +
    `${filas.length - conFecha.length} sin seguro o sin fecha`,
    M, 43.5
  );

  const filasEncabezado = [];
  listaGrupos.forEach((g, gi) => {
    filasEncabezado.push({ cells: [g.nombre.toUpperCase()], esGrupo: true, gi });
    g.filas.forEach((f, fi) => {
      filasEncabezado.push({ cells: [f.patente, f.interno, f.tipo, f.chofer, f.poliza || '-', fechaCorta(f.ymd), textoEstado(f.dias)], esGrupo: false, gi, fi });
    });
  });

  /* mergeCells: las filas de compañía se fusionan en una sola celda ancha.
     Se calculan sobre los índices del body, que es el MISMO orden que
     filasEncabezado (cada fila de compañía aporta una fila al body). */
  const merges = [];
  filasEncabezado.forEach((f, i) => { if (f.esGrupo) merges.push([i, 0, i, 6]); });

  doc.autoTable({
    head: [['Patente', 'Interno', 'Tipo', 'Chofer', 'Póliza', 'Vence seguro', 'Estado']],
    body: filasEncabezado.map(f => f.cells),
    mergeCells: merges,
    startY: 49,
    margin: { left: M, right: M, bottom: 16 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.6, lineColor: [31, 41, 55], lineWidth: 0.15, overflow: 'linebreak' },
    headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontSize: 9.5, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [247, 247, 248] },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 17 },
      2: { cellWidth: 20 },
      3: { cellWidth: 44 },
      4: { cellWidth: 26 },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 31, halign: 'center' }
    },
    // La fila de compañía va negra con letras blancas, como los encabezados de
    // los otros PDF de la app: es lo que se lee de lejos en la pizarra.
    didParseCell: (h) => {
      const f = filasEncabezado[h.section === 'body' ? h.index : -1];
      if (!f || !f.esGrupo) return;
      h.cell.styles.fillColor = [31, 41, 55];
      h.cell.styles.textColor = [255, 255, 255];
      h.cell.styles.fontStyle = 'bold';
      h.cell.styles.fontSize = 10;
      h.cell.styles.cellPadding = 2.2;
    },
    willDrawPage: () => {
      const pag = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`Control de Seguros - Grupo Falpat SRL - pagina ${pag}`, M, 289);
    }
  });

  // mergeCells necesita los índices de las filas de compañía dentro del body.
  const salida = arg('salida') || path.join(DESTINO_DEF, `CONTROL_SEGUROS_${sello()}.pdf`);
  fs.writeFileSync(salida, Buffer.from(doc.output('arraybuffer')));

  console.log(`\nPDF: ${salida}`);
  console.log(`  vehículos       : ${filas.length}${soloPatente ? ` (filtrado por ${soloPatente}, de ${totalFlota})` : ''}`);
  console.log(`  compañías       : ${listaGrupos.length}`);
  console.log(`  con seguro fecha: ${conFecha.length}`);
  console.log(`  vencidos        : ${vencidos.length}`);
  console.log(`  a vencer <=30d  : ${proximos.length}`);
  console.log(`  sin seguro/fecha: ${filas.length - conFecha.length}`);
  listaGrupos.forEach(g => console.log(`    - ${g.nombre}: ${g.filas.length}`));
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.stackTrace && console.error(e.stack); process.exit(1); });