const DOC_TIPOS = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];
const DOC_LABELS = { titulo: 'Título', cedula: 'Cédula', seguro: 'Seguro', registro: 'Registro', vtv: 'VTV', dni: 'DNI' };

// Carga el logo como base64 una vez y lo reutiliza
let _logoB64 = null;
async function getLogoBase64() {
  if (_logoB64) return _logoB64;
  try {
    const resp = await fetch('/images/fp3d.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    _logoB64 = await new Promise(r => {
      const reader = new FileReader();
      reader.onloadend = () => r(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
  return _logoB64;
}

/* ================= ESTILO COMÚN DE LOS 3 PDF =================
   Los tres informes se imprimen en la pizarra: letra grande, filas con línea y
   header negro con letras blancas. Antes el de Flota y el de Documentación
  maelaban 5.5pt sin bordes, que de lejos no se leía nada. */
const PDF_TABLA = {
  theme: 'grid',
  styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.5, lineColor: [31, 41, 55] },
  headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5, halign: 'left' },
  bodyStyles: { textColor: [0, 0, 0] },
  alternateRowStyles: { fillColor: [241, 245, 249] },
  margin: { left: 12, right: 12, bottom: 16 }
};

// Arma logo + título + subtítulo (que puede partirse en varias líneas) + fecha,
// y devuelve el Y donde arranca la tabla.
function encabezadoInforme(doc, logo, titulo, subtitulo, extra) {
  const w = doc.internal.pageSize.getWidth(), m = 12;
  const tx = logo ? m + 18 : m;
  if (logo) doc.addImage(logo, 'PNG', m, 8, 14, 14);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(titulo, tx, 16);
  let y = 22;
  if (subtitulo) {
    doc.setFontSize(9);
    doc.splitTextToSize(subtitulo, w - m - tx).forEach(l => { doc.text(l, tx, y); y += 4.4; });
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(55, 65, 81);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}${extra ? '   |   ' + extra : ''}`, tx, y);
  y += 3;
  doc.setDrawColor(17, 24, 39); doc.setLineWidth(0.8);
  doc.line(m, y, w - m, y);
  return y + 6;
}

// Pie en todas las páginas (no solo en la última): se pasa como didDrawPage.
function pieEnCadaPagina(doc) {
  return function () {
    const p = doc.internal.pageSize;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(55, 65, 81);
    doc.text('Grupo Falpat SRL — Sistema de Control Vehicular — Página ' + doc.internal.getNumberOfPages(),
      p.getWidth() / 2, p.getHeight() - 7, { align: 'center' });
  };
}

/* Ancho por columna para la Flota, que el usuario arma a whim (checkbox de
   columnas): las de texto largo se llevan más mm y el resto se reparte parejo,
   para que no quede una columna de 2mm al lado de una de 60. */
const PDF_ANCHO_COL = { chofer: 26, empresa: 30, centroTrabajo: 28, marca: 20, modelo: 20, estadoGeneral: 24, chasis: 26, numeroMotor: 24, subtipo: 20, patente: 20, interno: 13, nroBet: 15, tipo: 15, trompo: 12, anio: 10, kilometraje: 16, horometro: 16 };
function anchosColumnasPDF(campos, labels, total) {
  const suma = campos.reduce((s, k) => s + (PDF_ANCHO_COL[k] || 14), 0);
  const f = total / suma;
  const out = {};
  campos.forEach((k, i) => { out[labels[i]] = (PDF_ANCHO_COL[k] || 14) * f; });
  return out;
}

const FIELDS = [
  { key: 'patente', label: 'Patente', type: 'text' },
  { key: 'interno', label: 'Interno', type: 'text' },
  { key: 'tipo', label: 'Tipo', type: 'select' },
  { key: 'subtipo', label: 'Subtipo', type: 'select' },
  { key: 'nroBet', label: 'Nº BET', type: 'text' },
  { key: 'trompo', label: 'Trompo', type: 'bool' },
  { key: 'marca', label: 'Marca', type: 'text' },
  { key: 'modelo', label: 'Modelo', type: 'text' },
  { key: 'anio', label: 'Año', type: 'number' },
  { key: 'chofer', label: 'Chofer', type: 'text' },
  { key: 'dni', label: 'DNI chofer', type: 'text' },
  { key: 'registro', label: 'Registro chofer', type: 'text' },
  { key: 'empresa', label: 'Empresa', type: 'select' },
  { key: 'centroTrabajo', label: 'Centro de trabajo', type: 'text' },
  { key: 'kilometraje', label: 'Kilometraje', type: 'number' },
  { key: 'horometro', label: 'Horómetro', type: 'number' },
  { key: 'capacidadCarga', label: 'Capacidad carga', type: 'number' },
  { key: 'cargaM3Trompo', label: 'Carga M3 trompo', type: 'number' },
  { key: 'marcaTrompo', label: 'Marca trompo', type: 'text' },
  { key: 'serieTrompo', label: 'Serie trompo', type: 'text' },
  { key: 'modeloTrompo', label: 'Modelo trompo', type: 'text' },
  { key: 'chasis', label: 'Chasis', type: 'text' },
  { key: 'numeroMotor', label: 'Nº motor', type: 'text' },
  { key: 'estadoGeneral', label: 'Estado general', type: 'text' },
  { key: 'vtvFecha', label: 'VTV vence', type: 'date' },
  { key: 'vtvDias', label: 'VTV días rest', type: 'number' },
  { key: 'seguroFecha', label: 'Seguro vence', type: 'date' },
  { key: 'seguroDias', label: 'Seguro días rest', type: 'number' },
  { key: 'registroFecha', label: 'Registro vence', type: 'date' },
  { key: 'registroDias', label: 'Registro días rest', type: 'number' },
  { key: 'dniFecha', label: 'DNI vence', type: 'date' },
  { key: 'dniDias', label: 'DNI días rest', type: 'number' }
];
DOC_TIPOS.forEach(t => FIELDS.push({ key: 'doc:' + t, label: 'Doc · ' + DOC_LABELS[t], type: 'doc' }));
FIELDS.push({ key: 'faltantes', label: 'Docs faltantes', type: 'number' });

const DEFAULT_COLS = ['patente', 'interno', 'tipo', 'subtipo', 'nroBet', 'trompo', 'marca', 'modelo', 'anio', 'chofer', 'empresa', 'centroTrabajo'];
const OPERS = {
  text: ['contiene', 'no_contiene', 'es', 'no_es', 'vacio', 'no_vacio'],
  select: ['es', 'no_es'],
  bool: ['es'],
  doc: ['es'],
  number: ['>', '>=', '<', '<=', '=', '!=', 'vacio', 'no_vacio'],
  date: ['antes', 'despues', 'igual', 'vacio', 'no_vacio']
};
const OPER_LABELS = { contiene: 'contiene', no_contiene: 'no contiene', es: 'es', no_es: 'no es', vacio: 'vacío', no_vacio: 'no vacío', '>': 'mayor que', '>=': 'mayor o igual', '<': 'menor que', '<=': 'menor o igual', '=': 'igual a', '!=': 'distinto de', antes: 'antes de', despues: 'después de', igual: 'igual a' };

let fleet = [];
let activeFilters = [];
let searchTerm = '';
let visibleCols = new Set(DEFAULT_COLS);
let sortKey = 'interno';
let sortDir = 'asc';
let docFilters = { term: '', falta: '', estado: 'todos', empresa: '', centro: '' };
let docSortKey = 'faltantes';
let docSortDir = 'desc';
// docs y empresas son ARRAYS: se pueden elegir varios a la vez desde los
// checklists desplegables. Array vacio = "Todos".
let vencFilters = { term: '', ventana: 30, docs: [], estado: 'todos', empresas: [], centro: '', tipo: '', agrupar: true };
let vencSortKey = 'fecha';
let vencSortDir = 'asc';

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  cargarFlota();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => document.getElementById('mobile-menu')?.classList.remove('hidden'));
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => document.getElementById('mobile-menu')?.classList.add('hidden'));
}

async function cargarFlota() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/report/flota', { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    fleet = data.vehicles || [];
    llenarSelectCampoFlota();
    llenarSelectsDoc();
    llenarSelectsVenc();
    llenarPanelColumnas();
    cambiarCampoFiltro();
    renderTodo();
    actualizarChipsSecciones();
  } catch (e) {
    console.error('Error cargando reportes:', e);
    showToast('Error al cargar reportes: ' + e.message, 'error');
  }
}

/* Las 3 secciones de Reportes arrancan contraídas: se ve la página entera de un
   vistazo y se abre la que interesa. El chip del encabezado resume cuántos hay. */
function toggleSeccion(id) {
  const card = document.getElementById(id);
  if (!card) return;
  const colapses = card.classList.toggle('collapsed');
  const btn = card.querySelector('.rpt-toggle');
  if (btn) btn.setAttribute('aria-expanded', colapses ? 'false' : 'true');
  const chip = document.getElementById('chip-' + id.replace('sec-', ''));
  if (chip) chip.classList.toggle('rpt-chip-alerta', colapses && chip.dataset.alerta === '1');
}

function actualizarChipsSecciones() {
  const flotas = fleet.length;
  const vencs = vencFiltrada().length;
  const vencidos = vencFiltrada().filter(r => r.dias < 0).length;
  const docsIncompletos = fleet.filter(v => (v.faltantes || 0) > 0).length;

  const poner = (id, txt, alerta) => {
    const el = document.getElementById('chip-' + id);
    if (!el) return;
    el.textContent = txt;
    el.dataset.alerta = alerta ? '1' : '0';
    el.classList.toggle('rpt-chip-alerta', !!alerta);
  };
  poner('flota', flotas + (flotas === 1 ? ' vehículo' : ' vehículos'), false);
  poner('documentacion', docsIncompletos
    ? docsIncompletos + ' con faltantes'
    : 'todos completos', docsIncompletos > 0);
  poner('vencimientos', vencidos
    ? vencs + ' en ventana · ' + vencidos + ' vencidos'
    : vencs + ' en ventana', vencidos > 0);
}

function campoObjeto(key) { return FIELDS.find(f => f.key === key); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}
function isEmpty(v) { return v == null || String(v).trim() === ''; }
function valoresUnicos(key) {
  const set = new Set();
  fleet.forEach(v => { const val = obtenerValor(v, key); if (!isEmpty(val)) set.add(String(val)); });
  return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

/* ================= FILTROS FLOTA ================= */
function llenarSelectCampoFlota() {
  const sel = document.getElementById('fv-campo');
  sel.innerHTML = FIELDS.map(f => `<option value="${f.key}">${esc(f.label)}</option>`).join('');
}

function cambiarCampoFiltro() {
  const f = campoObjeto(document.getElementById('fv-campo').value);
  const operSel = document.getElementById('fv-oper');
  operSel.innerHTML = OPERS[f.type].map(o => `<option value="${o}">${esc(OPER_LABELS[o])}</option>`).join('');
  renderValorInput(f);
}

function renderValorInput(f) {
  const wrap = document.getElementById('fv-valor-wrap');
  document.getElementById('fv-valor')?.remove();
  let ctrl;
  if (f.type === 'date') {
    ctrl = document.createElement('input');
    ctrl.type = 'date';
    ctrl.className = 'rpt-input rpt-input-sm';
    ctrl.style.minWidth = '150px';
  } else if (f.type === 'select') {
    ctrl = document.createElement('select');
    ctrl.className = 'rpt-input rpt-input-sm';
    ctrl.style.minWidth = '150px';
    valoresUnicos(f.key).forEach(val => {
      const o = document.createElement('option');
      o.value = val; o.textContent = val;
      ctrl.appendChild(o);
    });
  } else if (f.type === 'bool') {
    ctrl = document.createElement('select');
    ctrl.className = 'rpt-input rpt-input-sm';
    ctrl.style.minWidth = '150px';
    [['true', 'Sí'], ['false', 'No']].forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      ctrl.appendChild(o);
    });
  } else if (f.type === 'doc') {
    ctrl = document.createElement('select');
    ctrl.className = 'rpt-input rpt-input-sm';
    ctrl.style.minWidth = '150px';
    [['Presente', 'Presente'], ['Falta', 'Falta']].forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      ctrl.appendChild(o);
    });
  } else {
    ctrl = document.createElement('input');
    ctrl.type = f.type === 'number' ? 'number' : 'text';
    ctrl.placeholder = 'Valor…';
    ctrl.style.minWidth = '150px';
  }
  ctrl.id = 'fv-valor';
  ctrl.className = ctrl.className || 'rpt-input rpt-input-sm';
  wrap.appendChild(ctrl);
}

function agregarFiltro() {
  const clave = document.getElementById('fv-campo').value;
  const oper = document.getElementById('fv-oper').value;
  const valorEl = document.getElementById('fv-valor');
  const f = campoObjeto(clave);
  if (['vacio', 'no_vacio'].includes(oper)) {
    activeFilters.push({ campo: clave, oper, valor: '' });
  } else {
    const valor = valorEl ? valorEl.value.trim() : '';
    if (!valor) { showToast('Completá el valor del filtro', 'error'); return; }
    activeFilters.push({ campo: clave, oper, valor });
  }
  renderChipsFlota();
  renderFlota();
}

function removeFiltro(i) {
  activeFilters.splice(i, 1);
  renderChipsFlota();
  renderFlota();
}

function limpiarFiltrosFlota() {
  activeFilters = [];
  searchTerm = '';
  document.getElementById('fv-buscar').value = '';
  document.getElementById('fv-campo').value = 'patente';
  renderChipsFlota();
  cambiarCampoFiltro();
  renderFlota();
}

function renderChipsFlota() {
  const cont = document.getElementById('fv-chips');
  if (!activeFilters.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = activeFilters.map((f, i) => {
    const fb = campoObjeto(f.campo);
    return `<span class="filtro-chip">${esc(fb ? fb.label : f.campo)} ${esc(OPER_LABELS[f.oper] || f.oper)}${f.valor ? ' «' + esc(f.valor) + '»' : ''} <span class="x" onclick="removeFiltro(${i})">×</span></span>`;
  }).join('');
}

function setFleetSearch(v) {
  searchTerm = v.trim().toLowerCase();
  renderFlota();
}

/* ================= PANEL COLUMNAS ================= */
function llenarPanelColumnas() {
  const grid = document.getElementById('fv-columnas-grid');
  grid.innerHTML = FIELDS.map(f => {
    const chk = visibleCols.has(f.key) ? 'checked' : '';
    return `<label class="flex items-center gap-2 text-[0.75rem] text-[#9ca3af] cursor-pointer hover:text-[#f3f4f6]"><input type="checkbox" class="form-checkbox text-[#2563EB]" data-key="${f.key}" ${chk}> ${esc(f.label)}</label>`;
  }).join('');
  grid.onchange = (e) => {
    const key = e.target.dataset.key;
    if (e.target.checked) visibleCols.add(key);
    else visibleCols.delete(key);
    if (!visibleCols.size) visibleCols.add('patente');
    renderFlota();
  };
}

function guardarColumnas() {
  const panel = document.getElementById('fv-columnas');
  panel.classList.toggle('hidden');
}

function setColumnas(mode) {
  if (mode === 'todas') visibleCols = new Set(FIELDS.map(f => f.key));
  else visibleCols = new Set(DEFAULT_COLS);
  llenarPanelColumnas();
  renderFlota();
}

/* ================= LÓGICA DE FILTRADO ================= */
function obtenerValor(v, key) {
  if (key.startsWith('doc:')) return v.docs && v.docs[key.slice(4)] ? 'Presente' : 'Falta';
  return v[key];
}

function buscarGlobal(v) {
  if (!searchTerm) return true;
  const hay = [v.patente, v.interno, v.marca, v.modelo, v.tipo, v.subtipo, v.nroBet, v.chofer, v.dni, v.empresa, v.centroTrabajo].join(' ').toLowerCase();
  return hay.includes(searchTerm);
}

function cumpleFiltro(v, f) {
  const val = obtenerValor(v, f.campo);
  switch (f.oper) {
    case 'vacio': return isEmpty(val);
    case 'no_vacio': return !isEmpty(val);
    case 'contiene': return String(val || '').toLowerCase().includes(String(f.valor || '').toLowerCase());
    case 'no_contiene': return !String(val || '').toLowerCase().includes(String(f.valor || '').toLowerCase());
    case 'es':
      return f.campo === 'trompo' ? (val === true) === (f.valor === 'true') : String(val || '').toLowerCase() === String(f.valor || '').toLowerCase();
    case 'no_es': return String(val || '').toLowerCase() !== String(f.valor || '').toLowerCase();
    case '>': case '>=': case '<': case '<=': case '=': case '!=': {
      const a = toNum(val), b = toNum(f.valor);
      if (a === null || b === null) return false;
      if (f.oper === '>') return a > b;
      if (f.oper === '>=') return a >= b;
      if (f.oper === '<') return a < b;
      if (f.oper === '<=') return a <= b;
      if (f.oper === '=') return a === b;
      return a !== b;
    }
    case 'antes': return !isEmpty(val) && val < f.valor;
    case 'despues': return !isEmpty(val) && val > f.valor;
    case 'igual': return !isEmpty(val) && val === f.valor;
  }
  return false;
}

function flotaFiltrada() {
  const rows = fleet.filter(buscarGlobal).filter(v => activeFilters.every(f => cumpleFiltro(v, f)));
  const fb = campoObjeto(sortKey);
  rows.sort((a, b) => {
    const va = orderVal(a, sortKey, fb), vb = orderVal(b, sortKey, fb);
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return rows;
}

function orderVal(v, key, fb) {
  if (key.startsWith('doc:')) return v.docs && v.docs[key.slice(4)] ? 1 : 0;
  if (key === 'trompo') return v.trompo ? 1 : 0;
  if (fb && fb.type === 'number') {
    const val = v[key];
    const n = toNum(val);
    return n === null ? (key.endsWith('Dias') ? 999999 : -999999) : n;
  }
  const val = v[key];
  return typeof val === 'string' ? val.toLowerCase() : (val == null ? '' : val);
}

function sortBy(key) {
  if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortKey = key; sortDir = 'asc'; }
  renderFlota();
}

/* ================= RENDER FLOTA ================= */
function renderTodo() {
  renderFlota();
  renderDoc();
  renderVenc();
  actualizarChipsSecciones();
}

function renderFlota() {
  const visible = FIELDS.filter(f => visibleCols.has(f.key));
  document.getElementById('fv-thead').innerHTML = '<tr>' + visible.map(f => {
    const arrow = sortKey === f.key ? (sortDir === 'asc' ? '▲' : '▼') : '';
    return `<th onclick="sortBy('${f.key}')" title="Ordenar">${esc(f.label)} <span class="sort-arrow">${arrow}</span></th>`;
  }).join('') + '</tr>';

  const rows = flotaFiltrada();
  const tbody = document.getElementById('fv-tbody');
  const vacio = document.getElementById('fv-vacio');
  if (!rows.length) {
    tbody.innerHTML = '';
    vacio.classList.remove('hidden');
  } else {
    vacio.classList.add('hidden');
    tbody.innerHTML = rows.map(v => `<tr>${visible.map(f => `<td>${celdaFlota(v, f)}</td>`).join('')}</tr>`).join('');
  }

  document.getElementById('fv-resultados').innerHTML = `<span class="text-2xl">${rows.length}</span><span class="text-sm font-medium text-[#6b7280] ml-1">de ${fleet.length}</span>`;
  document.getElementById('fv-trompo').textContent = rows.filter(v => v.trompo).length;
  document.getElementById('fv-mixers').textContent = rows.filter(v => String(v.tipo || '').toLowerCase().includes('mixer')).length;
  document.getElementById('fv-bet').textContent = rows.filter(v => !isEmpty(v.nroBet)).length;
}

function celdaFlota(v, f) {
  if (f.key.startsWith('doc:')) {
    const tipo = f.key.slice(4);
    return docCell(tipo, !!(v.docs && v.docs[tipo]));
  }
  if (f.key === 'trompo') {
    return v.trompo
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB]/15 text-[#2563EB]">Sí</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-[#4a5568]">No</span>';
  }
  if (f.type === 'date') return fechaCol(v[f.key]);
  if (f.type === 'number') {
    if (isEmpty(v[f.key])) return '—';
    const dias = f.key.endsWith('Dias');
    const val = toNum(v[f.key]);
    if (dias) {
      const cls = val < 0 ? 'text-red-400 font-bold' : val <= 30 ? 'text-amber-400 font-bold' : 'text-[#8b9bb4]';
      return `<span class="${cls}">${val} d</span>`;
    }
    return `<span class="text-right">${Number(val).toLocaleString('es-AR')}</span>`;
  }
  const val = v[f.key];
  return esc(isEmpty(val) ? '—' : val);
}

function fechaCol(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  const vto = Date.UTC(+y, +m - 1, +d);
  const hoy = new Date();
  const h = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const dias = Math.round((vto - h) / 86400000);
  const cls = dias < 0 ? 'text-red-400 font-bold' : dias <= 30 ? 'text-amber-400 font-bold' : 'text-[#8b9bb4]';
  return `<span class="${cls}">${d}/${m}/${y}</span>`;
}

/* ================= DOCUMENTACIÓN ================= */
function llenarSelectsDoc() {
  const docSel = document.getElementById('fd-doc');
  docSel.innerHTML = '<option value="">Todos</option>' + DOC_TIPOS.map(t => `<option value="${t}">${esc(DOC_LABELS[t])}</option>`).join('');

  const emp = document.getElementById('fd-empresa');
  emp.innerHTML = '<option value="">Todas</option>' + valoresUnicos('empresa').map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

  const cen = document.getElementById('fd-centro');
  cen.innerHTML = '<option value="">Todos</option>' + valoresUnicos('centroTrabajo').map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

function setDocSearch(v) { docFilters.term = v.trim().toLowerCase(); renderDoc(); }
function setDocFalta(v) { docFilters.falta = v; renderDoc(); }
function setDocEstado(v) { docFilters.estado = v; renderDoc(); }
function setDocEmpresa(v) { docFilters.empresa = v; renderDoc(); }
function setDocCentro(v) { docFilters.centro = v; renderDoc(); }

function limpiarFiltrosDoc() {
  docFilters = { term: '', falta: '', estado: 'todos', empresa: '', centro: '' };
  document.getElementById('fd-buscar').value = '';
  document.getElementById('fd-doc').value = '';
  document.getElementById('fd-estado').value = 'todos';
  document.getElementById('fd-empresa').value = '';
  document.getElementById('fd-centro').value = '';
  renderDoc();
}

function docFiltrada() {
  const rows = fleet.filter(v => {
    if (docFilters.term) {
      const hay = [v.patente, v.interno, v.marca, v.modelo, v.tipo, v.subtipo, v.empresa, v.centroTrabajo].join(' ').toLowerCase();
      if (!hay.includes(docFilters.term)) return false;
    }
    if (docFilters.falta && v.docs && v.docs[docFilters.falta]) return false;
    if (docFilters.empresa && v.empresa !== docFilters.empresa) return false;
    if (docFilters.centro && v.centroTrabajo !== docFilters.centro) return false;
    if (docFilters.estado === 'completos' && v.faltantes > 0) return false;
    if (docFilters.estado === 'faltantes' && v.faltantes === 0) return false;
    return true;
  });
  const fb = campoObjeto(docSortKey);
  rows.sort((a, b) => {
    const va = orderVal(a, docSortKey, fb), vb = orderVal(b, docSortKey, fb);
    if (va < vb) return docSortDir === 'asc' ? -1 : 1;
    if (va > vb) return docSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return rows;
}

function sortDocBy(key) {
  if (docSortKey === key) docSortDir = docSortDir === 'asc' ? 'desc' : 'asc';
  else { docSortKey = key; docSortDir = key.endsWith(':') || key === 'faltantes' ? 'desc' : 'asc'; }
  renderDoc();
}

function renderDoc() {
  const baseCols = [{ key: 'patente', label: 'Patente' }, { key: 'marca', label: 'Marca / Modelo' }, { key: 'tipo', label: 'Tipo' }, { key: 'centroTrabajo', label: 'Centro' }, { key: 'empresa', label: 'Empresa' }];
  const allCols = [...baseCols, ...DOC_TIPOS.map(t => ({ key: 'doc:' + t, label: DOC_LABELS[t] })), { key: 'faltantes', label: 'Faltan' }];
  const arrow = (key) => (docSortKey === key ? (docSortDir === 'asc' ? '▲' : '▼') : '');
  document.getElementById('doc-thead').innerHTML = '<tr>' + allCols.map(c => `<th onclick="sortDocBy('${c.key}')">${esc(c.label)} <span class="sort-arrow">${arrow(c.key)}</span></th>`).join('') + '</tr>';

  const rows = docFiltrada();
  const tbody = document.getElementById('doc-table');
  const vacio = document.getElementById('doc-vacio');
  if (!rows.length) {
    tbody.innerHTML = '';
    vacio.classList.remove('hidden');
  } else {
    vacio.classList.add('hidden');
    tbody.innerHTML = rows.map(v => {
      const cells = DOC_TIPOS.map(t => `<td class="text-center">${docCell(t, !!(v.docs && v.docs[t]))}</td>`).join('');
      const badge = v.faltantes === 0
        ? '<span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00E5FF]/20 text-[#00E5FF]">OK</span>'
        : `<span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${v.faltantes >= 3 ? 'bg-red-400/20 text-red-400' : v.faltantes >= 2 ? 'bg-yellow-400/20 text-yellow-400' : 'bg-orange-400/20 text-orange-400'}">${v.faltantes}</span>`;
      return `<tr>
        <td class="text-[#ffffff] font-medium">${esc(v.patente)}</td>
        <td>${esc([v.marca, v.modelo].filter(Boolean).join(' ') || '—')}</td>
        <td>${esc(v.tipo || '—')}</td>
        <td>${esc(v.centroTrabajo || '—')}</td>
        <td>${esc(v.empresa || '—')}</td>
        ${cells}
        <td class="text-center">${badge}</td>
      </tr>`;
    }).join('');
  }

  const total = rows.length;
  const completos = rows.filter(v => v.faltantes === 0).length;
  const conFaltantes = total - completos;
  const totalFaltantes = rows.reduce((s, v) => s + v.faltantes, 0);
  document.getElementById('doc-total').textContent = total;
  document.getElementById('doc-completos').textContent = completos;
  document.getElementById('doc-faltantes-count').textContent = conFaltantes;
  document.getElementById('doc-total-faltantes').textContent = totalFaltantes;
}

function docCell(tipo, presente) {
  if (presente) {
    return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#00E5FF]/15 text-[#00E5FF]" title="${esc(DOC_LABELS[tipo] || tipo)} presente">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
    </span>`;
  }
  return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-400/15 text-red-400 font-bold text-[10px]" title="${esc(DOC_LABELS[tipo] || tipo)} falta">Falta</span>`;
}

/* ================= EXPORT FLOTA ================= */
function columnasVisibles() { return FIELDS.filter(f => visibleCols.has(f.key)); }

function valorExport(v, f) {
  if (f.key.startsWith('doc:')) return v.docs && v.docs[f.key.slice(4)] ? 'Sí' : 'Falta';
  if (f.key === 'trompo') return v.trompo ? 'Sí' : 'No';
  const val = v[f.key];
  if (f.type === 'date' && val) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  if (val == null || val === '') return '';
  return String(val);
}

function exportFleetExcel() {
  const visible = columnasVisibles();
  const rows = flotaFiltrada().map(v => {
    const obj = {};
    visible.forEach(f => { obj[f.label] = valorExport(v, f); });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = visible.map(f => ({ wch: Math.max(9, (f.label.length || 8) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Flota');
  XLSX.writeFile(wb, `reporte-flota-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exportado correctamente');
}

async function exportFleetPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');
  const logo = await getLogoBase64();
  const w = 297, m = 12;
  const filas = flotaFiltrada();
  const y0 = encabezadoInforme(doc, logo, 'Grupo Falpat SRL', 'Reporte de Flota — vehículos filtrados',
    filas.length + (filas.length === 1 ? ' vehículo' : ' vehículos'));
  const visible = columnasVisibles();
  const body = filas.map(v => visible.map(f => valorExport(v, f)));
  doc.autoTable(Object.assign({}, PDF_TABLA, {
    startY: y0,
    head: [visible.map(f => f.label)],
    body,
    tableWidth: w - 2 * m,
    columnStyles: anchosColumnasPDF(visible.map(f => f.key), visible.map(f => f.label), w - 2 * m),
    didDrawPage: pieEnCadaPagina(doc)
  }));
  doc.save(`reporte-flota-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}

/* ================= EXPORT DOCUMENTACIÓN ================= */
function filasDocExport() {
  return docFiltrada().map(v => {
    const out = { Patente: v.patente || '', 'Marca/Modelo': [v.marca, v.modelo].filter(Boolean).join(' ') || '', Tipo: v.tipo || '', Centro: v.centroTrabajo || '', Empresa: v.empresa || '' };
    DOC_TIPOS.forEach(t => { out[DOC_LABELS[t]] = v.docs && v.docs[t] ? 'Sí' : 'Falta'; });
    out['Faltan'] = v.faltantes;
    return out;
  });
}

function exportDocExcel() {
  const rows = filasDocExport();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Documentación');
  XLSX.writeFile(wb, `documentacion-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exportado correctamente');
}

async function exportDocPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');
  const logo = await getLogoBase64();
  const w = 297, m = 12;
  const rows = docFiltrada();
  const y0 = encabezadoInforme(doc, logo, 'Grupo Falpat SRL', 'Documentación — estado por vehículo',
    rows.length + (rows.length === 1 ? ' vehículo' : ' vehículos'));
  const labels = [...DOC_TIPOS.map(t => DOC_LABELS[t]), 'Faltan'];
const head = ['Patente', 'Marca/Modelo', 'Tipo', 'Centro', 'Empresa', ...labels];
const body = rows.map(r => [r.patente || '', [r.marca, r.modelo].filter(Boolean).join(' ') || '', r.tipo || '', r.centroTrabajo || '', r.empresa || '', ...DOC_TIPOS.map(t => r.docs && r.docs[t] ? 'Sí' : 'Falta'), String(r.faltantes)]);
  // las 6 columnas de documento son cortitas ("Sí"/"Falta"): el ancho se lo
  // dejan a Patente, Marca/Modelo, Tipo, Centro y Empresa, que son los que
  // tienen texto largo (los anchos suman 258 de los 273 disponibles)
  const anchos = { Patente: 26, 'Marca/Modelo': 44, Tipo: 24, Centro: 30, Empresa: 40, Faltan: 16 };
  labels.forEach(l => { anchos[l] = 13; });
  doc.autoTable(Object.assign({}, PDF_TABLA, {
    startY: y0,
    head: [head], body,
    tableWidth: w - 2 * m,
    columnStyles: anchos,
    didDrawPage: pieEnCadaPagina(doc)
  }));
  doc.save(`documentacion-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}
/* ================= VENCIMIENTOS =================
   Los 8 tipos que vencen. El backend (/api/admin/report/flota) ya resuelve los
   tres esquemas de Firestore (legacy anidado, campo top-level y
   documentacion.<tipo>) y devuelve <tipo>Fecha en YYYY-MM-DD mas <tipo>Dias.
   service es derivado de proximServiceFecha y no tiene esquema legacy. */
/* Solo los documentos que TIENEN fecha de vencimiento. El título va aparte: no
   vence nunca (el PDF dice que "da cuenta de la situación registral a la fecha de su
   último asiento"), así que su control es "¿está o no está?", y eso vive en la
   sección Documentación, no acá. */
const VENC_TIPOS = [
  { k: 'vtv',       label: 'VTV' },
  { k: 'seguro',    label: 'Seguro' },
  { k: 'service',   label: 'Service' },
  { k: 'matafuego', label: 'Matafuego' },
  { k: 'dni',       label: 'DNI' },
  { k: 'registro',  label: 'Registro' },
  { k: 'cedula',    label: 'Cedula' }
];


const normTxt = s => String(s == null ? '' : s).trim().toLowerCase();

// La flota tiene valores que solo difieren en mayusculas/espacios (ej. "mixer" y "Mixer",
// 22 y 1 vehiculo). Sin agruparlos el dropdown los separa y el filtro deja fuera a uno.
function valoresUnicosVenc(campo) {
  const m = new Map();
  fleet.forEach(v => {
    const orig = v[campo];
    if (!orig) return;
    const k = normTxt(orig);
    if (!m.has(k)) m.set(k, orig);
  });
  return [...m.values()].sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

function llenarSelectsVenc() {
  const cen = document.getElementById('vc-centro');
  cen.innerHTML = '<option value="">Todos</option>' + valoresUnicosVenc('centroTrabajo').map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const tip = document.getElementById('vc-tipo');
  tip.innerHTML = '<option value="">Todos</option>' + valoresUnicosVenc('tipo').map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

  // Los 2 filtros multiples (documento y empresa) son checklists desplegables.
  llenarMultiVenc('doc', 'Todos', VENC_TIPOS.map(t => ({ v: t.k, label: t.label })), vencFilters.docs);
  llenarMultiVenc('emp', 'Todas', valoresUnicosVenc('empresa').map(v => ({ v, label: v })), vencFilters.empresas);
}

function llenarMultiVenc(id, todos, opciones, sel) {
  const panel = document.getElementById('vc-' + id + '-panel');
  if (!panel) return;
  panel.innerHTML =
    itemMultiHtml(todos, todos, sel.length === 0, true) +
    '<div class="vc-multi-sep"></div>' +
    opciones.map(o => itemMultiHtml(o.v, o.label, sel.includes(o.v))).join('');
  // onchange (y no addEventListener) porque esta función se vuelve a llamar al
  // limpiar filtros: asignar reemplaza el handler en vez de acumularlo
  panel.onchange = ev => {
    const inp = ev.target.closest('input[data-opt]');
    if (!inp) return;
    if (inp.dataset.todos === '1') {
      vencFilters[id === 'doc' ? 'docs' : 'empresas'] = inp.checked ? [] : opciones.map(o => o.v);
    } else {
      setMultiVenc(id, inp.dataset.opt, inp.checked);
    }
    alCambiarFiltroVenc();
  };
}

// Un renglón del checklist. El valor viaja en data-opt (nunca interpolado en un
// onclick) para que una empresa con comilla o & no rompa el HTML.
function itemMultiHtml(valor, label, marcado, esTodos) {
  return '<label class="vc-multi-item"><input type="checkbox" data-opt="' + esc(valor) + '"' +
    (esTodos ? ' data-todos="1"' : '') + (marcado ? ' checked' : '') +
    '><span>' + esc(label) + '</span></label>';
}

function setMultiVenc(id, valor, marcado) {
  const arr = id === 'doc' ? vencFilters.docs : vencFilters.empresas;
  if (marcado) { if (!arr.includes(valor)) arr.push(valor); }
  else for (let i = arr.length - 1; i >= 0; i--) if (arr[i] === valor) arr.splice(i, 1);
}

// El boton muestra "Todos", lo unico elegido, o "N documentos" / "N empresas".
function actualizarLabelsMulti() {
  const dl = document.getElementById('vc-doc-label');
  if (dl) dl.textContent = vencFilters.docs.length === 0 ? 'Todos'
    : vencFilters.docs.length === 1 ? (VENC_TIPOS.find(t => t.k === vencFilters.docs[0]) || {}).label
    : vencFilters.docs.length + ' documentos';
  const el = document.getElementById('vc-empresa-label');
  if (el) el.textContent = vencFilters.empresas.length === 0 ? 'Todas'
    : vencFilters.empresas.length === 1 ? vencFilters.empresas[0]
    : vencFilters.empresas.length + ' empresas';
}

function alCambiarFiltroVenc() { actualizarLabelsMulti(); renderVenc(); }

function toggleMultiVenc(id) {
  const panel = document.getElementById('vc-' + id + '-panel');
  if (!panel) return;
  const abrir = panel.classList.contains('hidden');
  document.querySelectorAll('.vc-multi-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.vc-multi-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (abrir) {
    panel.classList.remove('hidden');
    const btn = panel.closest('.vc-multi')?.querySelector('.vc-multi-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

function setVencAgrupar(v) { vencFilters.agrupar = !!v; renderVenc(); }

// Click fuera cierra los checklists. El panel es hijo de .vc-multi, asi que un
// click adentro no lo cierra.
document.addEventListener('click', ev => {
  if (ev.target.closest('.vc-multi')) return;
  document.querySelectorAll('.vc-multi-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.vc-multi-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
});

function setVencSearch(v) { vencFilters.term = v.trim().toLowerCase(); renderVenc(); }
function setVencVentana(v) { vencFilters.ventana = parseInt(v, 10) || 30; renderVenc(); }
function setVencEstado(v) { vencFilters.estado = v; renderVenc(); }
function setVencCentro(v) { vencFilters.centro = v; renderVenc(); }
function setVencTipo(v) { vencFilters.tipo = v; renderVenc(); }

function limpiarFiltrosVenc() {
  vencFilters = { term: '', ventana: 30, docs: [], estado: 'todos', empresas: [], centro: '', tipo: '', agrupar: true };
  ['vc-buscar', 'vc-estado', 'vc-centro', 'vc-tipo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.id === 'vc-estado' ? 'todos' : '';
  });
  document.getElementById('vc-ventana').value = '30';
  const ag = document.getElementById('vc-agrupar');
  if (ag) ag.checked = true;
  llenarSelectsVenc();
  renderVenc();
}

// Devuelve los vencimientos de un vehículo como [{k, label, fecha, dias, noVence}]
function vencimientosDe(v) {
  return VENC_TIPOS.map(t => ({
    k: t.k,
    label: t.label,
    fecha: v[t.k + 'Fecha'] || '',
    dias: (typeof v[t.k + 'Dias'] === 'number') ? v[t.k + 'Dias'] : null,
    noVence: t.k === 'cedula' && v.cedulaNoVence === true
  }));
}

function vencFiltrada() {
  const win = vencFilters.ventana;
  const out = [];
  // Con 2 o mas documentos elegidos sale una fila por vehiculo Y documento (una
  // fila repetida si el camion tiene que renovar varias cosas). Con uno, o con
  // "Todos", cada vehiculo aparece una sola vez con lo mas urgente: es la lista
  // de trabajo.
  const porDoc = vencFilters.docs.length > 1;
  const selEmp = vencFilters.empresas.map(normTxt);

  fleet.forEach(v => {
    if (vencFilters.term) {
      const hay = [v.patente, v.interno, v.marca, v.modelo, v.chofer, v.empresa, v.centroTrabajo].join(' ').toLowerCase();
      if (!hay.includes(vencFilters.term)) return;
    }
    if (selEmp.length && !selEmp.includes(normTxt(v.empresa))) return;
    if (vencFilters.centro && normTxt(v.centroTrabajo) !== normTxt(vencFilters.centro)) return;
    if (vencFilters.tipo && normTxt(v.tipo) !== normTxt(vencFilters.tipo)) return;

    const todos = vencimientosDe(v);
    const scope = vencFilters.docs.length ? todos.filter(d => vencFilters.docs.includes(d.k)) : todos;
    const conFecha = scope.filter(d => d.dias !== null);
    if (!conFecha.length) return;
    const enWin = conFecha.filter(d => d.dias <= win);
    if (!enWin.length) return;

    if (porDoc) {
      // una fila por documento: cada uno con su estado y su color
      enWin.forEach(d => {
        if (!pasaEstadoVenc(d.dias)) return;
        out.push({ v, doc: d, dias: d.dias, totalDocs: 1 });
      });
      return;
    }

    // una fila por vehiculo: la fecha que se muestra es la mas urgente del scope
    let doc = enWin[0];
    enWin.forEach(d => { if (d.dias < doc.dias) doc = d; });
    if (!pasaEstadoVenc(doc.dias)) return;
    out.push({ v, doc, dias: doc.dias, totalDocs: enWin.length });
  });
  return out;
}

// Los 3 filtros de estado se aplican sobre la MISMA fecha que se muestra.
function pasaEstadoVenc(dias) {
  if (vencFilters.estado === 'vencidos' && dias >= 0) return false;
  if (vencFilters.estado === 'proximos' && dias < 0) return false;
  if (vencFilters.estado === '15' && (dias < 0 || dias > 15)) return false;
  return true;
}

function valorVenc(r, key, fb) {
  return key === 'fecha' ? r.dias : orderVal(r.v, key, fb);
}

/* Un solo informe: las empresas ordenadas por su vencimiento más próximo (la
   más urgente arriba) y, DENTRO de cada empresa, los camiones ordenados por
   patente, que es como se lee una lista de vehículos. Si se clickea una
   columna, esa columna manda adentro del grupo. Sin agrupar, manda la columna
   activa como siempre. */
function datosVenc() {
  const out = vencFiltrada();
  const dir = vencSortDir === 'asc' ? 1 : -1;
  // adentro del grupo el orden por defecto es por patente; recién clickeando
  // "Vencimiento" se vuelve a ordenar por fecha
  const keyFila = (vencFilters.agrupar && vencSortKey === 'fecha') ? 'patente' : vencSortKey;
  const fb = campoObjeto(keyFila);
  const cmpFila = (a, b) => {
    const va = valorVenc(a, keyFila, fb), vb = valorVenc(b, keyFila, fb);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  };
  out.sort(cmpFila);
  if (!vencFilters.agrupar) return { grupos: null, filas: out };

  const mapa = new Map();
  out.forEach(r => {
    const k = normTxt(r.v.empresa);
    if (!mapa.has(k)) mapa.set(k, { key: k, nombre: r.v.empresa || 'Sin empresa', filas: [] });
    mapa.get(k).filas.push(r);
  });
  const grupos = [...mapa.values()];
  grupos.forEach(g => {
    g.filas.sort(cmpFila);
    g.minDias = Math.min.apply(null, g.filas.map(r => r.dias));
    g.vehiculos = new Set(g.filas.map(r => r.v.patente)).size;
    g.vencidos = g.filas.filter(r => r.dias < 0).length;
  });
  // el orden de las empresas lo decide la columna activa (por defecto la fecha:
  // la más urgente arriba)
  const fbG = campoObjeto(vencSortKey);
  grupos.sort((a, b) => {
    if (vencSortKey === 'fecha') return (a.minDias - b.minDias) * dir;
    const va = valorVenc(a.filas[0], vencSortKey, fbG), vb = valorVenc(b.filas[0], vencSortKey, fbG);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  });
  // "filas" sale YA en el orden final (empresa por empresa) y no en el sort
  // global: el Excel no tiene filas de encabezado de empresa, así que si no
  // viniera aplanado en este orden el archivo no coincidía con la pantalla.
  // Los stats no dependen del orden y el PDF usa "grupos" cuando agrupa.
  return { grupos, filas: grupos.reduce((acc, g) => acc.concat(g.filas), []) };
}

function sortVencBy(key) {
  if (vencSortKey === key) vencSortDir = vencSortDir === 'asc' ? 'desc' : 'asc';
  else { vencSortKey = key; vencSortDir = 'asc'; }
  renderVenc();
}

// Fecha de vencimiento + dias + de que documento es, en una sola celda
function celdaVenc(r) {
  const d = r.doc;
  const cls = d.dias < 0 ? 'text-red-400' : d.dias <= 15 ? 'text-yellow-400' : d.dias <= 30 ? 'text-amber-400' : 'text-[#8b9bb4]';
  const fecha = d.fecha ? d.fecha.split('-').reverse().join('/') : '—';
  const dd = d.dias < 0 ? Math.abs(d.dias) + ' d vencido' : d.dias + ' d';
  return `<span class="${cls} font-medium">${esc(fecha)}</span>` +
    `<span class="text-[11px] ${cls}"> · ${esc(dd)}</span>` +
    `<span class="block text-[10px] text-[#8b9bb4]">${esc(d.label)}</span>`;
}

const VENC_ESTADOS = {
  todos: 'Vencidos y por vencer',
  vencidos: 'Ya vencidos',
  proximos: 'Por vencer',
  '15': 'Vencen en 15 días'
};

/* El título tiene que decir QUÉ se está mostrando. Un PDF impreso en la pizarra
   con "Vencimientos" a secas no dice si es el reporte completo o el filtrado por
   Seguro, así que el título se arma con los filtros que están puestos. */
function resumenFiltroVenc() {
  const p = [];
  const n = vencFilters.docs.length;
  p.push(n === 0 ? 'Todos los documentos'
    : n === 1 ? (VENC_TIPOS.find(t => t.k === vencFilters.docs[0]) || {}).label
    : vencFilters.docs.map(k => (VENC_TIPOS.find(t => t.k === k) || {}).label).join(' + '));
  p.push(VENC_ESTADOS[vencFilters.estado] || VENC_ESTADOS.todos);
  p.push(vencFilters.ventana >= 99999 ? 'sin límite de fecha' : 'hasta ' + vencFilters.ventana + ' días');
  if (vencFilters.empresas.length === 1) p.push('empresa: ' + vencFilters.empresas[0]);
  else if (vencFilters.empresas.length > 1) p.push(vencFilters.empresas.length + ' empresas');
  if (vencFilters.agrupar) p.push('agrupado por empresa');
  if (vencFilters.centro) p.push('centro: ' + vencFilters.centro);
  if (vencFilters.tipo) p.push('tipo: ' + vencFilters.tipo);
  if (vencFilters.term) p.push('búsqueda: "' + vencFilters.term + '"');
  return p.join(' · ');
}

// Encabezado de grupo: empresa, cuántos vehículos y documentos mete, y cuántos
// ya están vencidos (lo primero que se mira en la pizarra).
function filaGrupoVenc(g) {
  const meta = [g.vehiculos + (g.vehiculos === 1 ? ' vehículo' : ' vehículos'),
                g.filas.length + (g.filas.length === 1 ? ' documento' : ' documentos')];
  if (g.vencidos) meta.push(g.vencidos + (g.vencidos === 1 ? ' vencido' : ' vencidos'));
  return '<tr class="vc-grp"><td colspan="5"><span class="vc-grp-nombre">' + esc(g.nombre) +
    '</span><span class="vc-grp-count"> — ' + esc(meta.join(' · ')) + '</span></td></tr>';
}

function filaVenc(r) {
  return '<tr>' +
    '<td class="text-[#ffffff] font-medium">' + esc(r.v.patente) + '</td>' +
    '<td class="text-center">' + esc(r.v.interno || '—') + '</td>' +
    '<td>' + esc(r.v.tipo || '—') + '</td>' +
    '<td class="col-empresa" title="' + esc(r.v.empresa || '') + '">' + esc(r.v.empresa || '—') + '</td>' +
    '<td>' + celdaVenc(r) + '</td>' +
    '</tr>';
}

function renderVenc() {
  const multiDoc = vencFilters.docs.length > 1;
  const cols = [
    { key: 'patente', label: 'Patente' },
    { key: 'interno', label: 'Interno' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'fecha', label: 'Vencimiento', titulo: multiDoc ? 'Con 2 o más documentos sale una fila por documento' : 'Fecha del documento elegido en el filtro, o la más próxima si está en "Todos". Con el agrupado prendido ordena las empresas' }
  ];

  // con el agrupado prendido el default ordena por patente adentro del grupo:
  // la flecha va en Patente, no en Vencimiento (que ordena las empresas)
  const colActiva = (vencFilters.agrupar && vencSortKey === 'fecha') ? 'patente' : vencSortKey;
  const arrow = k => (colActiva === k ? (vencSortDir === 'asc' ? '▲' : '▼') : '');
  document.getElementById('vc-thead').innerHTML = '<tr>' + cols.map(c =>
    `<th onclick="sortVencBy('${c.key}')"${c.titulo ? ` title="${esc(c.titulo)}"` : ''}>${esc(c.label)} <span class="sort-arrow">${arrow(c.key)}</span></th>`
  ).join('') + '</tr>';

  const { grupos, filas } = datosVenc();
  const tbody = document.getElementById('vc-table');
  const vacio = document.getElementById('vc-vacio');
  if (!filas.length) {
    tbody.innerHTML = '';
    vacio.classList.remove('hidden');
  } else {
    vacio.classList.add('hidden');
    tbody.innerHTML = grupos
      ? grupos.map(g => filaGrupoVenc(g) + g.filas.map(filaVenc).join('')).join('')
      : filas.map(filaVenc).join('');
  }

  const vencidos = filas.filter(r => r.dias < 0).length;
  const p15 = filas.filter(r => r.dias >= 0 && r.dias <= 15).length;
  const docs = filas.reduce((s, r) => s + r.totalDocs, 0);
  // con 2+ documentos un vehículo sale varias veces: el stat cuenta los
  // vehículos distintos, no las filas
  document.getElementById('vc-total').textContent = grupos
    ? grupos.reduce((s, g) => s + g.vehiculos, 0)
    : new Set(filas.map(r => r.v.patente)).size;
  document.getElementById('vc-vencidos').textContent = vencidos;
  document.getElementById('vc-15').textContent = p15;
  document.getElementById('vc-docs').textContent = docs;
  const sub = document.getElementById('vc-subtitulo');
  if (sub) sub.textContent = resumenFiltroVenc();
}


/* ---- export vencimientos ---- */
function filasVencExport() {
  // mismo orden que en pantalla: empresas de la más urgente a la menos, y
  // adentro los camiones por patente (datosVenc() ya devuelve las filas en ese
  // orden). El Excel no lleva fila de encabezado de empresa.
  return datosVenc().filas.map(r => ({
    Patente: r.v.patente || '',
    Interno: r.v.interno || '',
    Tipo: r.v.tipo || '',
    Empresa: r.v.empresa || '',
    'Fecha vencimiento': r.doc.fecha ? r.doc.fecha.split('-').reverse().join('/') : '',
    Documento: r.doc.label,
    Dias: r.dias
  }));
}

function vencColsExport() {
  return ['Patente', 'Interno', 'Tipo', 'Empresa', 'Fecha vencimiento', 'Documento', 'Dias'];
}

function exportVencExcel() {

  const rows = filasVencExport();
  const ws = XLSX.utils.json_to_sheet(rows);
  const anchos = { Empresa: 24, 'Fecha vencimiento': 16 };
  const wsCols = vencColsExport().map(c => ({ wch: anchos[c] || Math.max(9, c.length + 2) }));
  ws['!cols'] = wsCols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vencimientos');
  XLSX.writeFile(wb, `vencimientos-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exportado correctamente');
}

async function exportVencPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const logo = await getLogoBase64();
  const w = 210, m = 12;
  const { grupos, filas } = datosVenc();
  const nVeh = grupos ? grupos.reduce((s, g) => s + g.vehiculos, 0) : new Set(filas.map(r => r.v.patente)).size;
  // El subtítulo lleva los filtros puestos: en la pizarra tiene que verse qué reporte es.
  const y0 = encabezadoInforme(doc, logo, 'Grupo Falpat SRL', 'Vencimientos — ' + resumenFiltroVenc(),
    nVeh + (nVeh === 1 ? ' vehículo' : ' vehículos'));

  // Con 2+ documentos el mismo camión sale varias filas: sin la columna Documento
  // el PDF no dice qué hay que renovar.
  const multiDoc = vencFilters.docs.length > 1;
  const colsPDF = multiDoc
    ? ['Patente', 'Interno', 'Tipo', 'Empresa', 'Documento', 'Fecha venc.', 'Dias']
    : ['Patente', 'Interno', 'Tipo', 'Empresa', 'Fecha venc.', 'Dias'];
  const celda = r => {
    const c = [r.v.patente || '', r.v.interno || '', r.v.tipo || '', r.v.empresa || ''];
    if (multiDoc) c.push(r.doc.label);
    c.push(r.doc.fecha ? r.doc.fecha.split('-').reverse().join('/') : '',
           r.dias < 0 ? Math.abs(r.dias) + ' Dias Vencidos' : r.dias + ' Dias a Vencer');
    return c;
  };
  // el encabezado de empresa va como fila combinada: en la pizarra es lo que
  // ordena el trabajo
  const encabezado = g => [{
    content: `${g.nombre.toUpperCase()} — ${g.vehiculos} ${g.vehiculos === 1 ? 'vehiculo' : 'vehiculos'}, ${g.filas.length} ${g.filas.length === 1 ? 'documento' : 'documentos'}` +
      (g.vencidos ? `, ${g.vencidos} vencidos` : ''),
    colSpan: colsPDF.length, fillColor: [226, 232, 240], textColor: [0, 0, 0],
    fontStyle: 'bold', fontSize: 11.5
  }];
  const body = [];
  if (grupos) grupos.forEach(g => {
    body.push(encabezado(g));
    g.filas.forEach(r => body.push(celda(r)));
  });
  else filas.forEach(r => body.push(celda(r)));
  const anchoTotal = w - 2 * m;
  const estilos = multiDoc
    ? { 'Patente': 24, 'Interno': 17, 'Tipo': 24, 'Empresa': 38, 'Documento': 24, 'Fecha venc.': 25, 'Dias': 34 }
    : { 'Patente': 25, 'Interno': 19, 'Tipo': 28, 'Empresa': 46, 'Fecha venc.': 28, 'Dias': 40 };
  doc.autoTable(Object.assign({}, PDF_TABLA, {
    startY: y0,
    head: [colsPDF],
    body,
    tableWidth: anchoTotal,
    styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.5, lineColor: [31, 41, 55] },
    columnStyles: {
      'Patente': { cellWidth: estilos.Patente, fontStyle: 'bold' },
      'Interno': { cellWidth: estilos.Interno, halign: 'center' },
      'Tipo': { cellWidth: estilos.Tipo },
      'Empresa': { cellWidth: estilos.Empresa },
      'Documento': { cellWidth: estilos.Documento, fontStyle: 'bold' },
      'Fecha venc.': { cellWidth: estilos['Fecha venc.'] },
      'Dias': { cellWidth: estilos.Dias, fontSize: 10, fontStyle: 'bold' }
    },
    margin: { left: m, right: m, bottom: 16 },
    didDrawPage: pieEnCadaPagina(doc)
  }));
  doc.save(`vencimientos-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}

function printVenc() {
  // la sección puede estar contraída: al imprimir tiene que salir igual
  const card = document.getElementById('sec-vencimientos');
  const veniaColapsada = card && card.classList.contains('collapsed');
  if (veniaColapsada) card.classList.remove('collapsed');

  document.body.classList.add('printing-venc');
  const limpio = () => {
    document.body.classList.remove('printing-venc');
    if (veniaColapsada && card) card.classList.add('collapsed');
    window.removeEventListener('afterprint', limpio);
  };
  window.addEventListener('afterprint', limpio);
  window.print();
  setTimeout(limpio, 1000);
}

