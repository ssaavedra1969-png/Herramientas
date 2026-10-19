/* Informe semanal de vencimientos: seguro, VTV, registro y service.

   Genera un PDF con los documentos YA VENCIDOS y los que vencen dentro de la
   ventana (default 30 días), una fila por (vehículo, documento), ordenado por
   urgencia. La usan dos consumidores:

     - GET /api/admin/report/vencimientos/semanal/pdf (routes/admin.js) →
       botón "Semanal" en Reportes → Vencimientos (descarga desde la web).
     - scripts/informe-vencimientos-semanal.js → tarea programada de los
       viernes (Task Scheduler), genera el PDF en disco y lo envía por mail
       si hay SMTP configurado.

   Mismos criterios que routes/admin.js: vehículos deshabilitados no entran,
   y las fechas se resuelven contra los 3 esquemas de Firestore (legacy,
   campo top-level, documentacion.<tipo>). */
const { db } = require('../config/firebase');
const { esDeshabilitado } = require('./utils');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

const DOCS = [
  { key: 'vtv', label: 'VTV' },
  { key: 'seguro', label: 'Seguro' },
  { key: 'registro', label: 'Registro' },
  { key: 'service', label: 'Service' }
];

function fechaYMD(val) {
  if (!val) return null;
  let d = val.toDate ? val.toDate() : val;
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function diasHastaYMD(ymd) {
  if (!ymd) return null;
  const vto = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  const hoy = new Date();
  const h = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((vto - h) / 86400000);
}

const CAMPOS_TOP = { vtv: 'vencimientoVTV', seguro: 'vencimientoSeguro', registro: 'vencimientoRegistro', dni: 'vencimientoDNI', titulo: 'vencimientoTitulo', cedula: 'vencimientoCedula' };

function fechaDocVenc(v, tipo) {
  const doc = (v.documentacion && v.documentacion[tipo]) || null;
  const legacy = (tipo === 'vtv' || tipo === 'seguro' || tipo === 'matafuego') ? (v[tipo] || null) : null;
  const top = CAMPOS_TOP[tipo] ? v[CAMPOS_TOP[tipo]] : null;
  const cand =
    (legacy && (legacy.fechaVencimiento || legacy.fechaVto)) ||
    top ||
    (doc && doc.fechaVencimiento) ||
    null;
  return fechaYMD(cand);
}

function resumenService(v) {
  const s = v.serviceSummary;
  if (!s || typeof s !== 'object') return { fecha: null, km: '' };
  let fecha = null, km = '';
  Object.keys(s).forEach(t => {
    const e = s[t] || {};
    const f = fechaYMD(e.proximoFecha);
    if (f && (fecha === null || f < fecha)) {
      fecha = f;
      km = (e.proximoKm === null || e.proximoKm === undefined || e.proximoKm === '') ? '' : e.proximoKm;
    }
  });
  return { fecha, km };
}

function fechaService(v) {
  return fechaYMD(v.proximoServiceFecha) || resumenService(v).fecha;
}

function kmService(v) {
  const directo = (v.proximoServiceKm === null || v.proximoServiceKm === undefined || v.proximoServiceKm === '') ? null : v.proximoServiceKm;
  return directo !== null ? directo : resumenService(v).km;
}

function fechaCorta(ymd) {
  if (!ymd) return 'SIN FECHA';
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
}

function textoEstado(dias) {
  if (dias === 0) return 'VENCE HOY';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

function p2(n) { return String(n).padStart(2, '0'); }
function sello() {
  const h = new Date();
  return `${h.getFullYear()}-${p2(h.getMonth() + 1)}-${p2(h.getDate())}`;
}

/* Devuelve una fila por (vehículo, documento) SOLO a vencer: de hoy (0 días)
   hasta la ventana (default 30). Los ya vencidos quedan FUERA (son otra
   gestión) y los sin fecha cargada también. Orden: por tipo de vehículo y,
   adentro de cada tipo, por vencimiento más próximo. */
async function armarFilas({ dias: ventana = 90 } = {}) {
  const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
  const filas = [];
  let flota = 0;

  snap.docs.forEach(d => {
    const v = d.data();
    if (esDeshabilitado(v)) return;
    flota++;

    DOCS.forEach(doc => {
      const ymd = doc.key === 'service' ? fechaService(v) : fechaDocVenc(v, doc.key);
      const dias = diasHastaYMD(ymd);
      if (dias === null || dias < 0 || dias > ventana) return;
      let label = doc.label;
      if (doc.key === 'service') {
        const km = kmService(v);
        if (km !== '' && km !== null && km !== undefined) label = `Service (${km} km)`;
      }
      filas.push({
        patente: String(v.patente || '').toUpperCase(),
        interno: v.interno || '',
        tipo: v.tipo || 'Sin tipo',
        chofer: v.chofer || v.conductorHabitual || '',
        docKey: doc.key,
        documento: label,
        ymd,
        dias
      });
    });
  });

  // Por tipo de documento (orden fijo de DOCS) y, adentro, por vencimiento.
  const ordenDoc = {};
  DOCS.forEach((d, i) => { ordenDoc[d.key] = i; });
  filas.sort((a, b) =>
    (ordenDoc[a.docKey] - ordenDoc[b.docKey]) ||
    (a.dias - b.dias) ||
    a.patente.localeCompare(b.patente, 'es')
  );

  const hoy = filas.filter(f => f.dias === 0).length;

  return {
    filas,
    ventana,
    stats: { flota, total: filas.length, hoy }
  };
}

/* PDF A4 HORIZONTAL, estilo "pizarra": una HOJA POR TIPO DE DOCUMENTO (al
   cambiar de documento salta la página), con los nombres de columna siempre
   visibles, márgenes mínimos (todo el ancho de la hoja) y letra grande.
   Dentro de cada hoja, por vencimiento más próximo. Al final, RESUMEN por
   documento. Solo a vencer: los vencidos no entran. */
function generarPDF(filas, { ventana = 90, stats = null } = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const M = 6;                      // margen mínimo: 297 - 12 = 285 mm útiles
  const ANCHO_UTIL = 297 - M * 2;

  const cabecera = (pagina) => {
    if (pagina === 1) {
      const logoPath = require('path').join(__dirname, '..', 'public', 'images', 'fp3d.png');
      if (require('fs').existsSync(logoPath)) {
        const b64 = require('fs').readFileSync(logoPath).toString('base64');
        doc.addImage(`data:image/png;base64,${b64}`, 'PNG', M, 5, 28, 14);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(17, 24, 39);
      doc.text('Vencimientos a vencer - proximos ' + ventana + ' dias', M + 32, 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11.5);
      doc.setTextColor(75, 85, 99);
      doc.text('Seguro, VTV, Registro y Service - generado ' + sello() +
        (stats && stats.total ? ` - ${stats.total} vencimientos${stats.hoy ? ` (${stats.hoy} HOY)` : ''}` : ''),
        M + 32, 20);
    }
    const pag = doc.internal.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Vencimientos proximos ${ventana} dias - Grupo Falpat SRL - pagina ${pag}`, M, 203);
  };

  const estiloTabla = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 13.5, cellPadding: 3, lineColor: [31, 41, 55], lineWidth: 0.4, overflow: 'linebreak' },
    headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontSize: 13, fontStyle: 'bold', halign: 'left', overflow: 'nowrap' },
    alternateRowStyles: { fillColor: [247, 247, 248] },
    // Anchos que suman 285 mm (todo el ancho útil de la hoja apaisada).
    columnStyles: {
      0: { cellWidth: 31, fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 42 },
      3: { cellWidth: 93 },
      4: { cellWidth: 44, halign: 'center' },
      5: { cellWidth: 51, halign: 'center' }
    }
  };

  const estilosGrupo = (h) => {
    h.cell.styles.fillColor = [31, 41, 55];
    h.cell.styles.textColor = [31, 41, 55];
    h.cell.styles.fontStyle = 'bold';
    h.cell.styles.fontSize = 14;
    h.cell.styles.cellPadding = 3.5;
    h.cell.styles.overflow = 'nowrap';
    h.cell.styles.halign = 'left';
  };

  const pintaTituloGrupo = (h) => {
    // En cada autoTable, la fila 0 del body SIEMPRE es la del documento.
    if (h.section === 'body' && h.row.index === 0 && h.column.index === 5) {
      const texto = String(h.row.raw[0] || '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(texto, h.table.settings.margin.left + 3.5, h.cell.y + (h.cell.height / 2) + 1.8);
    }
  };

  let startY = 28;

  /* Una hoja por tipo de documento: cada grupo arranca en página nueva
     (excepto el primero). Los nombres de columna se repiten en cada hoja
     porque cada grupo es una autoTable propia con su `head`. */
  const grupos = DOCS
    .map(d => ({ label: d.label, filas: filas.filter(f => f.docKey === d.key) }))
    .filter(g => g.filas.length);

  if (!grupos.length) {
    cabecera(1);
    doc.autoTable({
      ...estiloTabla,
      head: [['Patente', 'Interno', 'Tipo', 'Chofer', 'Vence', 'Quedan']],
      body: [[`SIN VENCIMIENTOS EN LOS PROXIMOS ${ventana} DIAS`, '', '', '', '', '']],
      startY: 40,
      margin: { left: M, right: M, bottom: 12 },
      didParseCell: (h) => { if (h.section === 'body' && h.row.index === 0) estilosGrupo(h); },
      didDrawCell: pintaTituloGrupo
    });
    return Buffer.from(doc.output('arraybuffer'));
  }

  grupos.forEach((g, gi) => {
    if (gi > 0) {
      doc.addPage();
      // Cada hoja de documento se identifica arriba de todo.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(17, 24, 39);
      doc.text(`Vencimientos - ${g.label}`, M, 14);
    }
    cabecera(gi === 0 ? 1 : 2);

    const body = [[
      `${g.label.toUpperCase()} - ${g.filas.length} vencimiento${g.filas.length === 1 ? '' : 's'}`,
      '', '', '', '', ''
    ]];
    g.filas.forEach(f => body.push([
      f.patente, f.interno, f.tipo, f.chofer || '—', fechaCorta(f.ymd), textoEstado(f.dias)
    ]));

    doc.autoTable({
      ...estiloTabla,
      head: [['Patente', 'Interno', 'Tipo', 'Chofer', 'Vence', 'Quedan']],
      body,
      startY: gi === 0 ? startY : 22,
      margin: { left: M, right: M, bottom: 12 },
      didParseCell: (h) => {
        if (h.section !== 'body') return;
        // Fila 0 del body = título del documento (negro, texto pintado aparte).
        if (h.row.index === 0) { estilosGrupo(h); return; }
        // "Quedan": rojo fuerte si vence hoy o en los próximos 7 días.
        const raw = h.row.raw;
        if (h.column.index === 5 && typeof raw[5] === 'string') {
          const urgente = raw[5] === 'VENCE HOY' || raw[5] === '1 dia' ||
            (/^(\d+) dias$/.test(raw[5]) && parseInt(raw[5], 10) <= 7);
          if (urgente) {
            h.cell.styles.textColor = [185, 28, 28];
            h.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawCell: pintaTituloGrupo
    });
  });

  /* Resumen por documento: SIEMPRE en su propia hoja, con el título arriba
     y la tabla con aire, para que no se apriete contra el detalle. */
  const resumenBody = DOCS.map(d => {
    const delDoc = filas.filter(f => f.docKey === d.key);
    if (!delDoc.length) return null;
    const hoyN = delDoc.filter(f => f.dias === 0).length;
    const masProximo = delDoc.reduce((m, f) => (m === null || f.dias < m.dias ? f : m), null);
    return [
      d.label,
      String(delDoc.length),
      hoyN ? String(hoyN) : '—',
      `${fechaCorta(masProximo.ymd)} (${textoEstado(masProximo.dias).toLowerCase()})`
    ];
  }).filter(Boolean);
  if (!resumenBody.length) resumenBody.push(['Sin vencimientos', '0', '—', '—']);

  doc.addPage();
  cabecera(doc.internal.getNumberOfPages());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(17, 24, 39);
  doc.text('Resumen por documento', M, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Total: ${filas.length} vencimientos en los proximos ${ventana} dias`, M, 25);

  doc.autoTable({
    body: resumenBody,
    startY: 34,
    margin: { left: M, right: M, bottom: 12 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 13.5, cellPadding: 3, lineColor: [31, 41, 55], lineWidth: 0.4 },
    headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontSize: 13, fontStyle: 'bold', halign: 'left', overflow: 'nowrap' },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 45, halign: 'center' },
      2: { cellWidth: 50, halign: 'center' },
      3: { cellWidth: ANCHO_UTIL - 155 }
    },
    head: [['Documento', 'Vencimientos', 'Vence hoy', 'Mas proximo']]
  });

  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { armarFilas, generarPDF, DOCS };
