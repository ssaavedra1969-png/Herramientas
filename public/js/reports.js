const DOC_TIPOS = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];
const DOC_LABELS = { titulo: 'Título', cedula: 'Cédula', seguro: 'Seguro', registro: 'Registro', vtv: 'VTV', dni: 'DNI' };

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
    llenarPanelColumnas();
    cambiarCampoFiltro();
    renderTodo();
  } catch (e) {
    console.error('Error cargando reportes:', e);
    showToast('Error al cargar reportes: ' + e.message, 'error');
  }
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
      const hay = [v.patente, v.interno, v.marca, v.modelo, v.empresa, v.centroTrabajo].join(' ').toLowerCase();
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
  const baseCols = [{ key: 'patente', label: 'Patente' }, { key: 'marca', label: 'Marca / Modelo' }, { key: 'centroTrabajo', label: 'Centro' }, { key: 'empresa', label: 'Empresa' }];
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

function exportFleetPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');
  const visible = columnasVisibles();
  doc.setFontSize(18); doc.setTextColor(212, 175, 55);
  doc.text('Grupo Falpat SRL', 14, 15);
  doc.setFontSize(12); doc.setTextColor(142, 148, 168);
  doc.text('Reporte de Flota — vehículos filtrados', 14, 23);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 29);
  const body = flotaFiltrada().map(v => visible.map(f => valorExport(v, f)));
  doc.autoTable({
    startY: 34,
    head: [visible.map(f => f.label)],
    body,
    theme: 'grid',
    headStyles: { fillColor: [212, 175, 55], fontSize: 6 },
    bodyStyles: { fontSize: 5.5 }
  });
  doc.setFontSize(7); doc.setTextColor(92, 99, 120);
  doc.text('Grupo Falpat SRL — Sistema de Control Vehicular', 148, 200, { align: 'center' });
  doc.save(`reporte-flota-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}

/* ================= EXPORT DOCUMENTACIÓN ================= */
function filasDocExport() {
  return docFiltrada().map(v => {
    const out = { Patente: v.patente || '', 'Marca/Modelo': [v.marca, v.modelo].filter(Boolean).join(' ') || '', Centro: v.centroTrabajo || '', Empresa: v.empresa || '' };
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

function exportDocPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setFontSize(18); doc.setTextColor(212, 175, 55);
  doc.text('Grupo Falpat SRL', 14, 15);
  doc.setFontSize(12); doc.setTextColor(142, 148, 168);
  doc.text('Documentación — estado por vehículo', 14, 23);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 29);
  const rows = filasDocExport();
  const head = [['Patente', 'Marca/Modelo', 'Centro', 'Empresa', ...DOC_TIPOS.map(t => DOC_LABELS[t]), 'Faltan']];
  const body = rows.map(r => [r.Patente, r['Marca/Modelo'], r.Centro, r.Empresa, ...DOC_TIPOS.map(t => r[DOC_LABELS[t]]), String(r.Faltan)]);
  doc.autoTable({
    startY: 34,
    head, body,
    theme: 'grid',
    headStyles: { fillColor: [212, 175, 55], fontSize: 7 },
    bodyStyles: { fontSize: 6 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 40 }, 2: { cellWidth: 28 }, 3: { cellWidth: 30 } }
  });
  doc.setFontSize(7); doc.setTextColor(92, 99, 120);
  doc.text('Grupo Falpat SRL — Sistema de Control Vehicular', 148, 200, { align: 'center' });
  doc.save(`documentacion-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}