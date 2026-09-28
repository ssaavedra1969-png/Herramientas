const TIPOS_ELEM = ['vehiculo', 'herramienta', 'equipo', 'ropa', 'material'];
let centrosData = [];
let currentCentroId = null;
let filterEstado = '';
let filterSearch = '';
let catalogoData = {};
let elementosData = [];
let elementosFilter = { search: '', centro: '', tipo: '', estado: '' };
let sortState = { centros: { col: null, asc: true }, catalogo: { col: null, asc: true }, elementos: { col: null, asc: true } };

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  loadCentros();
  loadCatalogo();
  document.getElementById('search-centro')?.addEventListener('input', (e) => {
    filterSearch = e.target.value.trim().toLowerCase();
    renderCentros();
  });
  document.getElementById('elementos-search')?.addEventListener('input', (e) => {
    elementosFilter.search = e.target.value.trim().toLowerCase();
    renderElementos();
  });
  document.getElementById('elementos-filter-centro')?.addEventListener('change', (e) => {
    elementosFilter.centro = e.target.value;
    renderElementos();
  });
  document.getElementById('elementos-filter-tipo')?.addEventListener('change', (e) => {
    elementosFilter.tipo = e.target.value;
    renderElementos();
  });
  document.getElementById('elementos-filter-estado')?.addEventListener('change', (e) => {
    elementosFilter.estado = e.target.value;
    renderElementos();
  });
});

function switchTab(tab) {
  document.getElementById('section-centros').classList.toggle('hidden', tab !== 'centros');
  document.getElementById('section-catalogo').classList.toggle('hidden', tab !== 'catalogo');
  document.getElementById('section-elementos').classList.toggle('hidden', tab !== 'elementos');
  document.getElementById('tab-centros').className = tab === 'centros'
    ? 'px-4 py-2 text-xs font-bold rounded-lg bg-[#2563EB] text-white transition-colors'
    : 'px-4 py-2 text-xs font-bold rounded-lg bg-[#0a0e17]/50 text-[#8b9bb4] hover:text-[#ffffff] border border-[#2563EB]/20 transition-colors';
  document.getElementById('tab-catalogo').className = tab === 'catalogo'
    ? 'px-4 py-2 text-xs font-bold rounded-lg bg-[#00E5FF] text-[#0a0e17] transition-colors'
    : 'px-4 py-2 text-xs font-bold rounded-lg bg-[#0a0e17]/50 text-[#8b9bb4] hover:text-[#ffffff] border border-[#2563EB]/20 transition-colors';
  document.getElementById('tab-elementos').className = tab === 'elementos'
    ? 'px-4 py-2 text-xs font-bold rounded-lg bg-[#10B981] text-white transition-colors'
    : 'px-4 py-2 text-xs font-bold rounded-lg bg-[#0a0e17]/50 text-[#8b9bb4] hover:text-[#ffffff] border border-[#2563EB]/20 transition-colors';
  if (tab === 'catalogo') loadCatalogo();
  if (tab === 'elementos') loadElementos();
}

async function loadCatalogo() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/centros/catalogo', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    catalogoData = await res.json();
    const sel = document.getElementById('catalogo-tipo');
    if (!sel.value) sel.value = 'equipo';
    filterCatalogo(sel.value);
  } catch (e) {
    console.error('Error cargando catálogo:', e);
  }
}

function filterCatalogo(tipo) {
  const sel = document.getElementById('catalogo-tipo');
  if (sel) sel.value = tipo;
  const data = catalogoData[tipo] || [];
  const tbody = document.getElementById('catalogo-table-body');
  const empty = document.getElementById('catalogo-empty');
  if (!data.length) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  tbody.innerHTML = data.map(e => `
    <tr class="border-b border-white/5 hover:bg-[#00E5FF]/10">
      <td class="px-4 py-3 font-mono text-[#00E5FF] text-xs">${esc(e.interno)}</td>
      <td class="px-4 py-3 text-[#ffffff]">${esc(e.nombre)}</td>
      <td class="px-4 py-3 text-[#8b9bb4] text-sm">${esc(e.marca || '—')}</td>
      <td class="px-4 py-3 text-[#8b9bb4] text-sm">${esc(e.modelo || '—')}</td>
      <td class="px-4 py-3 text-center">${e.stock ?? 0}</td>
      <td class="px-3 py-3 no-print" onclick="event.stopPropagation()">
        ${isAdmin() && tipo !== 'vehiculo' ? `<button onclick="openEditElementoModal('${e.id}')" title="Editar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>` : ''}
        ${isAdmin() && tipo !== 'vehiculo' ? `<button onclick="deleteCatalogoItem('${e.id}')" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ''}
      </td>
    </tr>
  `).join('');
}

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

async function loadCentros() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/centros', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    centrosData = await res.json();
    renderCentros();
  } catch (e) {
    console.error('Error cargando centros:', e);
    const tbody = document.getElementById('centros-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-400">Error al cargar centros</td></tr>';
  }
}

function renderCentros() {
  let filtered = centrosData;
  if (filterSearch) {
    filtered = filtered.filter(c =>
      (c.nombre || '').toLowerCase().includes(filterSearch) ||
      (c.ubicacion || '').toLowerCase().includes(filterSearch) ||
      (c.observaciones || '').toLowerCase().includes(filterSearch)
    );
  }
  if (filterEstado) {
    filtered = filtered.filter(c => c.estado === filterEstado);
  }

  const activos = filtered.filter(c => c.estado === 'activa').length;
  const totalEl = document.getElementById('total-centros');
  const activosEl = document.getElementById('activos-count');
  if (totalEl) totalEl.textContent = filtered.length;
  if (activosEl) activosEl.textContent = activos;

  const badge = document.getElementById('active-filters-count');
  const count = (filterSearch ? 1 : 0) + (filterEstado ? 1 : 0);
  if (badge) {
    if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
  }

  const tbody = document.getElementById('centros-table-body');
  const empty = document.getElementById('centros-empty');
  if (!filtered.length) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  tbody.innerHTML = filtered.map(c => {
    const estadoCls = c.estado === 'activa' ? 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/30' :
                       c.estado === 'pausada' ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30' :
                       'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30';
    const estadoLabel = c.estado === 'activa' ? 'Activa' : c.estado === 'pausada' ? 'Pausada' : 'Cerrada';
    return `
      <tr class="border-b border-white/5 hover:bg-[#2563EB]/10 cursor-pointer fade-row" onclick="openDetalleCentro('${c.id}')">
        <td class="px-4 py-3 font-medium text-[#ffffff]">${esc(c.nombre)}</td>
        <td class="px-4 py-3 text-[#8b9bb4] text-sm">${esc(c.ubicacion || '—')}</td>
        <td class="px-4 py-3"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoCls}">${estadoLabel}</span></td>
        <td class="px-4 py-3 text-center">${c.totalElementos ?? 0}</td>
        <td class="px-4 py-3 text-center">${c.asignados ?? 0}</td>
        <td class="px-4 py-3 text-xs text-[#4a5568]">${c.createdAt ? formatDate(c.createdAt) : '—'}</td>
        <td class="px-3 py-3 no-print" onclick="event.stopPropagation()">
          ${isAdmin() ? `<button onclick="openAsignarModal('${c.id}')" class="text-[#2563EB] hover:text-[#60A5FA] text-xs mr-2" title="Asignar elemento">+</button>` : ''}
          ${isAdmin() ? `<button onclick="openEditCentroModal('${c.id}')" class="text-[#8b9bb4] hover:text-[#ffffff] text-xs mr-2" title="Editar obra">
            <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>` : ''}
          ${isAdmin() && c.estado === 'activa' ? `<button onclick="openCerrarModal('${c.id}', '${esc(c.nombre)}')" class="text-[#F97316] hover:text-[#ea580c] text-xs mr-2" title="Cerrar obra">✕</button>` : ''}
          ${isAdmin() ? `<button onclick="openDeleteCentroModal('${c.id}')" class="text-[#EF4444] hover:text-[#fca5a5] text-xs" title="Eliminar obra">
            <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2.25 2.25 0 0116.138 21H7.862a2.25 2.25 0 01-2.245-2.077L4.75 7M9.5 7V4.75A.75.75 0 0110.25 4h3.5a.75.75 0 01.75.75V7M9.5 11v4m5-4v4"/></svg>
          </button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

function sortTable(table, col) {
  const state = sortState[table];
  if (state.col === col) {
    state.asc = !state.asc;
  } else {
    state.col = col;
    state.asc = true;
  }
  const dir = state.asc ? 1 : -1;
  if (table === 'centros') {
    centrosData.sort((a, b) => {
      let va = a[col], vb = b[col];
      if (col === 'createdAt') { va = va || ''; vb = vb || ''; }
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return ((va || 0) - (vb || 0)) * dir;
    });
    renderCentros();
  } else if (table === 'catalogo') {
    const tipo = document.getElementById('catalogo-tipo').value;
    const data = catalogoData[tipo] || [];
    data.sort((a, b) => {
      let va = a[col], vb = b[col];
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return ((va || 0) - (vb || 0)) * dir;
    });
    filterCatalogo(tipo);
  }
  document.querySelectorAll(`th[onclick^="sortTable('${table}'"] .sort-ind`).forEach(el => el.textContent = '');
  const th = document.querySelector(`th[onclick="sortTable('${table}','${col}')"] .sort-ind`);
  if (th) th.textContent = state.asc ? '▲' : '▼';
}

function filterByEstado(estado) {
  filterEstado = estado;
  renderCentros();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Modal Nuevo Centro ── */
function openNewCentroModal() {
  document.getElementById('form-nuevo-centro').reset();
  showModal('modal-nuevo-centro');
}
function closeNewCentroModal() { hideModal('modal-nuevo-centro'); }

async function createCentro(e) {
  e.preventDefault();
  const nombre = document.getElementById('nc-nombre').value.trim();
  if (!nombre) return showToast('El nombre es obligatorio', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/centros', {
      method: 'POST', headers,
      body: JSON.stringify({
        nombre,
        ubicacion: document.getElementById('nc-ubicacion').value.trim(),
        observaciones: document.getElementById('nc-observaciones').value.trim()
      })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeNewCentroModal();
    showToast('Obra creada exitosamente');
    await loadCentros();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

/* ── Modal Detalle Centro ── */
async function openDetalleCentro(centroId) {
  currentCentroId = centroId;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${centroId}`, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const centro = await res.json();

    document.getElementById('dc-nombre').textContent = centro.nombre;
    const details = document.getElementById('dc-details');
    details.innerHTML = `
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><span class="text-[#8b9bb4]">Ubicación:</span> <span class="text-[#ffffff]">${esc(centro.ubicacion || '—')}</span></div>
        <div><span class="text-[#8b9bb4]">Estado:</span> <span class="text-[#ffffff]">${centro.estado}</span></div>
        <div><span class="text-[#8b9bb4]">Creado:</span> <span class="text-[#ffffff]">${formatDate(centro.createdAt)}</span></div>
        <div><span class="text-[#8b9bb4]">Total Elementos:</span> <span class="text-[#ffffff]">${centro.totalElementos || 0}</span></div>
      </div>
      ${centro.observaciones ? `<div class="mt-2 text-sm"><span class="text-[#8b9bb4]">Observaciones:</span> <span class="text-[#ffffff]">${esc(centro.observaciones)}</span></div>` : ''}
    `;

    const elemDiv = document.getElementById('dc-elementos');
    const elems = centro.elementos || [];
    if (!elems.length) {
      elemDiv.innerHTML = '<p class="text-[#4a5568] text-sm">No hay elementos asignados</p>';
    } else {
      elemDiv.innerHTML = `
        <div class="text-xs text-[#8b9bb4] uppercase tracking-wider mb-2">Elementos Asignados (${elems.length})</div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs min-w-[500px]">
            <thead>
              <tr class="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#4a5568]">
                <th class="px-2 py-2 text-left font-semibold">Interno</th>
                <th class="px-2 py-2 text-left font-semibold">Tipo</th>
                <th class="px-2 py-2 text-left font-semibold">Asignación</th>
                <th class="px-2 py-2 text-left font-semibold">Estado</th>
                <th class="px-2 py-2 text-left font-semibold">Obs.</th>
                <th class="px-2 py-2 no-print"></th>
              </tr>
            </thead>
            <tbody>
              ${elems.map(e => {
                const asignado = !e.fechaDevolucion || e.fechaDevolucion === '';
                return `
                <tr class="border-b border-white/5">
                  <td class="px-2 py-2 text-[#ffffff] font-medium">${esc(e.interno)}</td>
                  <td class="px-2 py-2 text-[#8b9bb4]">${e.elementoTipo}</td>
                  <td class="px-2 py-2 text-[#8b9bb4]">${formatDate(e.fechaAsignacion)}</td>
                  <td class="px-2 py-2">${asignado ? '<span class="text-[#10B981]">Asignado</span>' : `<span class="text-[#4a5568]">Devuelto ${formatDate(e.fechaDevolucion)}</span>`}</td>
                  <td class="px-2 py-2 text-[#4a5568] max-w-[120px] truncate">${esc(e.observaciones || '')}</td>
                  <td class="px-2 py-2 no-print">${asignado ? `<button onclick="returnElement('${centroId}', '${e.id}')" class="text-[#00E5FF] hover:underline">Devolver</button>` : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }

    const actions = document.getElementById('dc-actions');
    let html = '';
    if (isAdmin()) {
      html += `<button onclick="closeDetalleCentro();openEditCentroModal('${centroId}')" class="px-3 py-1.5 text-xs rounded-lg border border-[#4a5568] text-[#8b9bb4] hover:text-[#ffffff] transition-colors">Editar</button>`;
      if (centro.estado === 'activa') {
        html += `<button onclick="openAsignarModal('${centroId}')" class="px-3 py-1.5 text-xs rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">+ Asignar Elemento</button>`;
        html += `<button onclick="openCerrarModal('${centroId}', '${esc(centro.nombre)}')" class="px-3 py-1.5 text-xs rounded-lg border border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/10 transition-colors">Cerrar Obra</button>`;
      }
      html += `<button onclick="closeDetalleCentro();openDeleteCentroModal('${centroId}')" class="px-3 py-1.5 text-xs rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">Eliminar</button>`;
    } else if (centro.estado === 'activa') {
      html += `<button onclick="openAsignarModal('${centroId}')" class="px-3 py-1.5 text-xs rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">+ Asignar Elemento</button>`;
    }
    html += `<button onclick="closeDetalleCentro()" class="px-3 py-1.5 text-xs rounded-lg border border-[#4a5568] text-[#8b9bb4] hover:text-[#ffffff] transition-colors">Cerrar</button>`;
    actions.innerHTML = html;

    showModal('modal-detalle-centro');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}
function closeDetalleCentro() { hideModal('modal-detalle-centro'); currentCentroId = null; }

/* ── Modal Asignar Elemento ── */
let ae_tipoActual = '';
let ae_elementosCache = [];

function openAsignarModal(centroId) {
  currentCentroId = centroId;
  document.getElementById('form-asignar').reset();
  ae_tipoActual = '';
  ae_elementosCache = [];
  const tipoSelect = document.getElementById('ae-elementoTipo');
  tipoSelect.value = '';
  const elemSelect = document.getElementById('ae-interno');
  elemSelect.innerHTML = '<option value="">Seleccionar tipo primero...</option>';
  elemSelect.classList.remove('hidden');
  document.getElementById('ae-custom-id').classList.add('hidden');
  showModal('modal-asignar');
}
function closeAsignarModal() { hideModal('modal-asignar'); }

async function onTipoChange() {
  const tipo = document.getElementById('ae-elementoTipo').value;
  const elemSelect = document.getElementById('ae-interno');
  const customId = document.getElementById('ae-custom-id');

  if (!tipo || !TIPOS_ELEM.includes(tipo)) {
    elemSelect.innerHTML = '<option value="">Seleccionar tipo primero...</option>';
    elemSelect.classList.remove('hidden');
    customId.classList.add('hidden');
    ae_tipoActual = tipo;
    return;
  }

  if (tipo === 'vehiculo') {
    elemSelect.classList.remove('hidden');
    customId.classList.add('hidden');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/centros/elementos/disponibles/${tipo}`, { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const vehiculos = await res.json();
      ae_elementosCache = vehiculos;
      elemSelect.innerHTML = '<option value="">Cargando vehículos...</option>';
      if (!vehiculos.length) {
        elemSelect.innerHTML = '<option value="">Sin vehículos registrados</option>';
      } else {
        elemSelect.innerHTML = vehiculos.map(v => `<option value="${esc(v.interno)}">${esc(v.nombre)}</option>`).join('');
      }
    } catch (e) {
      elemSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
  } else {
    elemSelect.classList.remove('hidden');
    customId.classList.add('hidden');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/centros/elementos/disponibles/${tipo}`, { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const elems = await res.json();
      ae_elementosCache = elems;
      if (!elems.length) {
        elemSelect.innerHTML = '<option value="">Sin elementos en catálogo</option>';
      } else {
        elemSelect.innerHTML = elems.map(e => `<option value="${esc(e.interno)}">${esc(e.nombre)} ${e.marca ? '- ' + esc(e.marca) : ''} ${e.modelo ? '- ' + esc(e.modelo) : ''}</option>`).join('');
      }
    } catch (e) {
      elemSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
  }
  ae_tipoActual = tipo;
}

async function assignElement(e) {
  e.preventDefault();
  if (!currentCentroId) return showToast('Error: centro no seleccionado', 'error');
  const tipo = document.getElementById('ae-elementoTipo').value;
  const elemSelect = document.getElementById('ae-interno');
  const customId = document.getElementById('ae-custom-id');
  const interno = (ae_tipoActual && elemSelect && !elemSelect.classList.contains('hidden'))
    ? elemSelect.value
    : (customId ? customId.value.trim() : '');
  if (!tipo || !interno) return showToast('Completá tipo e ID', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${currentCentroId}/elementos`, {
      method: 'POST', headers,
      body: JSON.stringify({
        interno,
        elementoTipo: tipo,
        origenCentro: document.getElementById('ae-origenCentro').value.trim() || null,
        observaciones: document.getElementById('ae-observaciones').value.trim()
      })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeAsignarModal();
    showToast('Elemento asignado');
    await loadCentros();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function openAddElementoModal() {
  document.getElementById('form-add-elemento').reset();
  showModal('modal-add-elemento');
}
function closeAddElementoModal() { hideModal('modal-add-elemento'); }

async function addElemento(e) {
  e.preventDefault();
  const tipo = document.getElementById('ae-new-tipo').value;
  const nombre = document.getElementById('ae-new-nombre').value.trim();
  const marca = document.getElementById('ae-new-marca').value.trim();
  const modelo = document.getElementById('ae-new-modelo').value.trim();
  const stock = parseInt(document.getElementById('ae-new-stock').value) || 1;
  const desc = document.getElementById('ae-new-desc').value.trim();
  if (!tipo || !nombre) return showToast('Completá tipo y nombre', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/elementos/disponibles`, {
      method: 'POST', headers,
      body: JSON.stringify({ tipo, nombre, descripcion: desc, marca, modelo, stock })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeAddElementoModal();
    showToast('Elemento agregado al catálogo');
    document.getElementById('catalogo-tipo').value = tipo;
    loadCatalogo();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

/* ── Devolver Elemento ── */
async function returnElement(centroId, elemId) {
  if (!confirm('¿Deseas marcar este elemento como devuelto?')) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${centroId}/elementos/${elemId}`, {
      method: 'DELETE', headers
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    showToast('Elemento devuelto');
    await loadCentros();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

/* ── Modal Editar Centro ── */
function openEditCentroModal(centroId) {
  if (!isAdmin()) return;
  const c = centrosData.find(x => x.id === centroId);
  if (!c) return showToast('No se encontró la obra', 'error');
  document.getElementById('ec-nombre').value = c.nombre || '';
  document.getElementById('ec-ubicacion').value = c.ubicacion || '';
  document.getElementById('ec-estado').value = c.estado || 'activa';
  document.getElementById('ec-observaciones').value = c.observaciones || '';
  document.getElementById('form-editar-centro').dataset.id = centroId;
  showModal('modal-editar-centro');
}
function closeEditCentroModal() { hideModal('modal-editar-centro'); }

async function saveCentroEdit(e) {
  e.preventDefault();
  const id = document.getElementById('form-editar-centro').dataset.id;
  if (!id) return;
  const nombre = document.getElementById('ec-nombre').value.trim();
  if (!nombre) return showToast('El nombre es obligatorio', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({
        nombre,
        ubicacion: document.getElementById('ec-ubicacion').value.trim(),
        estado: document.getElementById('ec-estado').value,
        observaciones: document.getElementById('ec-observaciones').value.trim()
      })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeEditCentroModal();
    showToast('Obra actualizada');
    await loadCentros();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

/* ── Modal Eliminar Centro ── */
/* Los conteos (asignados / totalElementos) solo vienen en el detalle, no en la
   lista, asi que se pide el centro antes de abrir el modal: si no, el boton
   quedaria habilitado para una obra con elementos sin devolver. */
async function openDeleteCentroModal(centroId) {
  if (!isAdmin()) return;
  const c = centrosData.find(x => x.id === centroId);
  if (!c) return showToast('No se encontró la obra', 'error');
  let asignados = 0, total = 0;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${centroId}`, { headers });
    if (!res.ok) throw new Error('No se pudo leer la obra');
    const d = await res.json();
    asignados = d.asignados || 0;
    total = d.totalElementos || 0;
  } catch (e) { return showToast('No se pudo verificar la obra: ' + e.message, 'error'); }

  document.getElementById('ed-nombre').textContent = c.nombre || 'la obra';
  document.getElementById('ed-detalle').innerHTML = asignados > 0
    ? `Tiene <strong class="text-[#EF4444]">${asignados} elemento(s) sin devolver</strong>: no se puede eliminar hasta que los devuelvas.`
    : (total > 0
      ? `Se borrará también el historial de ${total} elemento(s) devuelto(s).`
      : 'No tiene elementos asignados.');
  const btn = document.querySelector('#modal-eliminar-centro button[onclick="confirmDeleteCentro()"]');
  if (btn) btn.disabled = asignados > 0;
  document.getElementById('modal-eliminar-centro').dataset.centroId = centroId;
  showModal('modal-eliminar-centro');
}
function closeDeleteCentroModal() { hideModal('modal-eliminar-centro'); }

async function confirmDeleteCentro() {
  const centroId = document.getElementById('modal-eliminar-centro').dataset.centroId;
  if (!centroId) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${centroId}`, { method: 'DELETE', headers });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeDeleteCentroModal();
    showToast('Obra eliminada');
    await loadCentros();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

/* ── Modal Cerrar Centro ── */
function openCerrarModal(centroId, nombre) {
  document.getElementById('modal-cerrar').classList.remove('hidden');
  document.getElementById('modal-cerrar').dataset.centroId = centroId;
}
function closeCerrarModal() { document.getElementById('modal-cerrar').classList.add('hidden'); }
async function confirmCloseCentro() {
  const centroId = document.getElementById('modal-cerrar').dataset.centroId;
  if (!centroId) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/${centroId}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ estado: 'cerrada' })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeCerrarModal();
    showToast('Obra cerrada');
    await loadCentros();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteCatalogoItem(id) {
  if (!isAdmin()) return;
  if (!confirm('¿Eliminar este elemento del catálogo?')) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/elementos/disponibles/${id}`, { method: 'DELETE', headers });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    showToast('Elemento eliminado');
    loadCatalogo();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function openEditElementoModal(id) {
  if (!isAdmin()) return;
  const tipo = document.getElementById('catalogo-tipo').value;
  const item = (catalogoData[tipo] || []).find(e => e.id === id);
  if (!item) return;
  document.getElementById('ee-nombre').value = item.nombre || '';
  document.getElementById('ee-marca').value = item.marca || '';
  document.getElementById('ee-modelo').value = item.modelo || '';
  document.getElementById('ee-stock').value = item.stock ?? 1;
  document.getElementById('ee-desc').value = item.descripcion || '';
  document.getElementById('form-edit-elemento').dataset.id = id;
  showModal('modal-edit-elemento');
}
function closeEditElementoModal() { hideModal('modal-edit-elemento'); }

async function editElemento(e) {
  e.preventDefault();
  const id = document.getElementById('form-edit-elemento').dataset.id;
  if (!id) return;
  const nombre = document.getElementById('ee-nombre').value.trim();
  const marca = document.getElementById('ee-marca').value.trim();
  const modelo = document.getElementById('ee-modelo').value.trim();
  const stock = parseInt(document.getElementById('ee-stock').value) || 1;
  const desc = document.getElementById('ee-desc').value.trim();
  if (!nombre) return showToast('Completá el nombre', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/elementos/disponibles/${id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ nombre, descripcion: desc, marca, modelo, stock })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeEditElementoModal();
    showToast('Elemento actualizado');
    loadCatalogo();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function nombreCentro(id) {
  const c = centrosData.find(x => x.id === id);
  return c ? c.nombre : id;
}

/* ── Pestaña Elementos ── */
async function loadElementos() {
  const tbody = document.getElementById('elementos-table-body');
  try {
    if (!centrosData.length) await loadCentros();
    const headers = await getAuthHeaders();
    const res = await fetch('/api/centros/elementos', { headers });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'HTTP ' + res.status);
    }
    elementosData = await res.json();
    const centroSel = document.getElementById('elementos-filter-centro');
    const currentVal = centroSel.value;
    const centros = [...new Set(elementosData.map(e => e.centroId))];
    centros.sort();
    centros.forEach(c => {
      if (!centroSel.querySelector(`option[value="${c}"]`)) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = nombreCentro(c);
        centroSel.appendChild(opt);
      }
    });
    centroSel.value = currentVal;
    renderElementos();
  } catch (e) {
    console.error('Error cargando elementos:', e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-red-400">Error: ' + esc(e.message) + '</td></tr>';
  }
}

function renderElementos() {
  let filtered = [...elementosData];
  if (elementosFilter.search) {
    filtered = filtered.filter(e => (e.interno || '').toLowerCase().includes(elementosFilter.search));
  }
  if (elementosFilter.centro) {
    filtered = filtered.filter(e => e.centroId === elementosFilter.centro);
  }
  if (elementosFilter.tipo) {
    filtered = filtered.filter(e => e.elementoTipo === elementosFilter.tipo);
  }
  if (elementosFilter.estado) {
    if (elementosFilter.estado === 'asignado') {
      filtered = filtered.filter(e => !e.fechaDevolucion || e.fechaDevolucion === '');
    } else {
      filtered = filtered.filter(e => e.fechaDevolucion && e.fechaDevolucion !== '');
    }
  }
  const totalEl = document.getElementById('elementos-total');
  if (totalEl) totalEl.textContent = filtered.length;
  const tbody = document.getElementById('elementos-table-body');
  const empty = document.getElementById('elementos-empty');
  if (!filtered.length) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  tbody.innerHTML = filtered.map(e => {
    const asignado = !e.fechaDevolucion || e.fechaDevolucion === '';
    return `
      <tr class="border-b border-white/5 hover:bg-[#10B981]/5">
        <td class="px-4 py-3 text-[#ffffff] font-medium">${esc(nombreCentro(e.centroId))}</td>
        <td class="px-4 py-3 text-[#00E5FF] font-mono text-xs">${esc(e.interno)}</td>
        <td class="px-4 py-3 text-[#8b9bb4]">${esc(e.nombre || '')}</td>
        <td class="px-4 py-3 text-[#8b9bb4]">${esc(e.marca || '')}</td>
        <td class="px-4 py-3 text-[#8b9bb4]">${esc(e.modelo || '')}</td>
        <td class="px-4 py-3 text-[#8b9bb4]">${e.elementoTipo}</td>
        <td class="px-4 py-3 text-[#8b9bb4] text-xs">${formatDate(e.fechaAsignacion)}</td>
        <td class="px-4 py-3 text-[#8b9bb4] text-xs">${e.origenCentro ? esc(e.origenCentro) : '—'}</td>
        <td class="px-4 py-3">${asignado ? '<span class="text-[#10B981] text-xs font-bold">Asignado</span>' : `<span class="text-[#4a5568] text-xs">Devuelto ${formatDate(e.fechaDevolucion)}</span>`}</td>
        <td class="px-4 py-3 text-[#4a5568] text-xs max-w-[150px] truncate">${esc(e.observaciones || '')}</td>
        <td class="px-3 py-3 no-print">${asignado ? `<button onclick="returnElement('${e.centroId}', '${e.id}')" class="text-[#00E5FF] hover:underline text-xs">Devolver</button>` : ''}</td>
      </tr>`;
  }).join('');
}

function sortElementos(col) {
  const state = sortState.elementos;
  if (state.col === col) {
    state.asc = !state.asc;
  } else {
    state.col = col;
    state.asc = true;
  }
  const dir = state.asc ? 1 : -1;
  elementosData.sort((a, b) => {
    let va = a[col], vb = b[col];
    if (col === 'fechaAsignacion') { va = va || ''; vb = vb || ''; }
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return ((va || 0) - (vb || 0)) * dir;
  });
  renderElementos();
  document.querySelectorAll(`th[onclick^="sortElementos('"] .sort-ind`).forEach(el => el.textContent = '');
  const th = document.querySelector(`th[onclick="sortElementos('${col}')"] .sort-ind`);
  if (th) th.textContent = state.asc ? '▲' : '▼';
}

/* ── Helpers ── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
