const TIPOS_ELEM = ['vehiculo', 'herramienta', 'equipo', 'ropa', 'material'];
let centrosData = [];
let currentCentroId = null;
let filterEstado = '';
let filterSearch = '';
let catalogoData = {};

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  loadCentros();
  loadCatalogo();
  document.getElementById('search-centro')?.addEventListener('input', (e) => {
    filterSearch = e.target.value.trim().toLowerCase();
    renderCentros();
  });
});

function switchTab(tab) {
  document.getElementById('section-centros').classList.toggle('hidden', tab !== 'centros');
  document.getElementById('section-catalogo').classList.toggle('hidden', tab !== 'catalogo');
  document.getElementById('tab-centros').className = tab === 'centros'
    ? 'px-4 py-2 text-xs font-bold rounded-lg bg-[#2563EB] text-white transition-colors'
    : 'px-4 py-2 text-xs font-bold rounded-lg bg-[#0a0e17]/50 text-[#8b9bb4] hover:text-[#ffffff] border border-[#2563EB]/20 transition-colors';
  document.getElementById('tab-catalogo').className = tab === 'catalogo'
    ? 'px-4 py-2 text-xs font-bold rounded-lg bg-[#00E5FF] text-[#0a0e17] transition-colors'
    : 'px-4 py-2 text-xs font-bold rounded-lg bg-[#0a0e17]/50 text-[#8b9bb4] hover:text-[#ffffff] border border-[#2563EB]/20 transition-colors';
  if (tab === 'catalogo') loadCatalogo();
}

async function loadCatalogo() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/centros/catalogo', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    catalogoData = await res.json();
    const tipo = document.getElementById('catalogo-tipo').value;
    filterCatalogo(tipo);
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
      <td class="px-4 py-3 text-[#8b9bb4] text-sm">${esc(e.marca || '—')} ${e.modelo ? '<span class="text-[#2563EB]"> ' + esc(e.modelo) + '</span>' : ''}</td>
      <td class="px-4 py-3 text-center">${e.stock ?? 0}</td>
      <td class="px-3 py-3 no-print">
        <button onclick="deleteCatalogoItem('${e.id}')" class="text-[#EF4444] hover:text-red-300 text-xs" title="Eliminar">✕</button>
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
          ${c.estado === 'activa' ? `<button onclick="openAsignarModal('${c.id}')" class="text-[#2563EB] hover:text-[#60A5FA] text-xs mr-2" title="Asignar elemento">+</button>` : ''}
          ${c.estado === 'activa' ? `<button onclick="openCerrarModal('${c.id}', '${esc(c.nombre)}')" class="text-[#F97316] hover:text-[#ea580c] text-xs" title="Cerrar obra">✕</button>` : ''}
        </td>
      </tr>`;
  }).join('');
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
        <div class="text-xs text-[#8b9bb4] uppercase tracking-wider mb-2">Elementos Asignados</div>
        <div class="space-y-1">
          ${elems.map(e => `
            <div class="flex items-center justify-between py-1.5 border-b border-white/5">
              <div>
                <span class="text-[#ffffff] text-sm font-medium">${esc(e.interno)}</span>
                <span class="text-xs text-[#8b9bb4] ml-2">${e.elementoTipo}</span>
                <span class="text-xs text-[#4a5568] ml-2">${formatDate(e.fechaAsignacion)}</span>
                ${e.origenCentro ? `<span class="text-xs text-[#2563EB] ml-2">desde ${esc(e.origenCentro)}</span>` : ''}
              </div>
              <div class="flex items-center gap-2">
                ${!e.fechaDevolucion || e.fechaDevolucion === '' ? `<button onclick="returnElement('${centroId}', '${e.id}')" class="text-xs text-[#00E5FF] hover:underline">Devolver</button>` : `<span class="text-xs text-[#00E5FF]">Devuelto ${formatDate(e.fechaDevolucion)}</span>`}
              </div>
            </div>
          `).join('')}
        </div>`;
    }

    const actions = document.getElementById('dc-actions');
    let html = `<button onclick="openAsignarModal('${centroId}')" class="px-3 py-1.5 text-xs rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors">+ Asignar Elemento</button>`;
    if (centro.estado === 'activa') {
      html += `<button onclick="openCerrarModal('${centroId}', '${esc(centro.nombre)}')" class="px-3 py-1.5 text-xs rounded-lg border border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/10 transition-colors">Cerrar Obra</button>`;
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
  const interno = document.getElementById('ae-new-interno').value.trim();
  const marca = document.getElementById('ae-new-marca').value.trim();
  const modelo = document.getElementById('ae-new-modelo').value.trim();
  const stock = parseInt(document.getElementById('ae-new-stock').value) || 1;
  const desc = document.getElementById('ae-new-desc').value.trim();
  if (!tipo || !nombre || !interno) return showToast('Completá tipo, nombre e ID', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/elementos/disponibles`, {
      method: 'POST', headers,
      body: JSON.stringify({ tipo, interno, nombre, descripcion: desc, marca, modelo, stock })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    closeAddElementoModal();
    showToast('Elemento agregado al catálogo');
    onTipoChange();
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
  if (!confirm('¿Eliminar este elemento del catálogo?')) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/centros/elementos/disponibles/${id}`, { method: 'DELETE', headers });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    showToast('Elemento eliminado');
    loadCatalogo();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

/* ── Helpers ── */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
