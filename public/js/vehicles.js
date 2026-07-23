let allVehicles = [];
let editingVehicleId = null;
let csvValidatedData = [];
let patenteSet = new Set();
let selectedIds = new Set();
let viewMode = localStorage.getItem('vehicles-view-mode') || 'table';
let sortField = 'interno';
let sortDir = 'asc';

function parseTrompoRaw(val) {
  const s = String(val || '').trim().toLowerCase().replace(/['"]/g, '');
  return s === 'si' || s === 'sí';
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-vehiculo')?.addEventListener('submit', saveVehicle);
  setupModalClose('modal-vehiculo');
  setupModalClose('modal-csv-import');
  setupModalClose('modal-progress');
  document.getElementById('search-vehiculo')?.addEventListener('input', applyFilters);
  document.getElementById('filter-marca')?.addEventListener('change', applyFilters);
  document.getElementById('filter-tipo')?.addEventListener('change', applyFilters);
  document.getElementById('filter-subtipo')?.addEventListener('change', applyFilters);
  document.getElementById('filter-centro')?.addEventListener('change', applyFilters);
  document.getElementById('filter-empresa')?.addEventListener('change', applyFilters);
  document.getElementById('filter-estado')?.addEventListener('change', applyFilters);
  document.querySelectorAll('[data-trompo-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-trompo-filter]').forEach(b => {
        b.classList.remove('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
        b.classList.add('text-[#8E94A8]', 'hover:text-[#F1F3F8]', 'hover:bg-[#6C3CE1]/10');
      });
      btn.classList.add('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
      btn.classList.remove('text-[#8E94A8]', 'hover:text-[#F1F3F8]', 'hover:bg-[#6C3CE1]/10');
      applyFilters();
    });
  });
  document.getElementById('v-trompo')?.addEventListener('change', (e) => {
    document.getElementById('v-trompo-fields').classList.toggle('hidden', !e.target.checked);
  });
  setViewMode(viewMode, false);
});

function setViewMode(mode, save = true) {
  viewMode = mode;
  if (save) localStorage.setItem('vehicles-view-mode', mode);
  const tableView = document.getElementById('view-table');
  const cardView = document.getElementById('view-card');
  const tableBtn = document.getElementById('view-table-btn');
  const cardBtn = document.getElementById('view-card-btn');
  if (mode === 'card') {
    tableView?.classList.add('hidden');
    cardView?.classList.remove('hidden');
    tableBtn?.classList.remove('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
    tableBtn?.classList.add('text-[#8E94A8]');
    cardBtn?.classList.add('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
    cardBtn?.classList.remove('text-[#8E94A8]');
  } else {
    tableView?.classList.remove('hidden');
    cardView?.classList.add('hidden');
    tableBtn?.classList.add('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
    tableBtn?.classList.remove('text-[#8E94A8]');
    cardBtn?.classList.remove('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
    cardBtn?.classList.add('text-[#8E94A8]');
  }
  applyFilters();
}

function toggleFilters() {
  const panel = document.getElementById('filter-panel');
  panel?.classList.toggle('hidden');
}

function updateActiveFiltersCount() {
  const marca = document.getElementById('filter-marca')?.value || '';
  const tipo = document.getElementById('filter-tipo')?.value || '';
  const subtipo = document.getElementById('filter-subtipo')?.value || '';
  const centro = document.getElementById('filter-centro')?.value || '';
  const empresa = document.getElementById('filter-empresa')?.value || '';
  const estado = document.getElementById('filter-estado')?.value || '';
  const activeTrompoBtn = document.querySelector('[data-trompo-filter].bg-\\[\\#6C3CE1\\]\\/30');
  const trompo = activeTrompoBtn ? activeTrompoBtn.dataset.trompoFilter : 'all';
  const count = [marca, tipo, subtipo, centro, empresa, trompo !== 'all' ? trompo : ''].filter(Boolean).length;
  const badge = document.getElementById('active-filters-count');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function setupModalClose(modalId) {
  document.getElementById(modalId)?.addEventListener('click', (e) => {
    if (e.target === document.getElementById(modalId)) hideModal(modalId);
  });
}

function initRealtimeListener() {
  const tbody = document.getElementById('vehiculos-table-body');
  const grid = document.getElementById('vehiculos-card-grid');
  if (tbody) tbody.innerHTML = Array(5).fill('<tr><td colspan="9"><div class="skeleton skeleton-row"></div></td></tr>').join('');
  if (grid) grid.innerHTML = Array(6).fill('<div><div class="skeleton skeleton-card"></div></div>').join('');

  db.collection('vehicles').orderBy('interno').onSnapshot((snapshot) => {
    allVehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    patenteSet = new Set(allVehicles.map(v => (v.patente || '').toUpperCase()));
    populateFilterDropdowns();
    document.getElementById('filter-count').textContent = allVehicles.length;
    document.getElementById('total-vehicles').textContent = allVehicles.length;
    renderVehicles(allVehicles);
  }, (error) => {
    console.error('Error loading vehicles:', error);
    const colCount = isAdmin() ? 8 : 7;
    document.getElementById('vehiculos-table-body').innerHTML =
      `<tr><td colspan="${colCount}" class="text-center py-8 text-red-500">Error al cargar vehículos</td></tr>`;
  });
}

function fmap(v) {
  return {
    id: v.id,
    patente: v.patente || '',
    interno: v.interno || v.numeroInterno || '',
    tipo: v.tipo || '',
    subtipo: v.subtipo || '',
    marca: v.marca || '',
    modelo: v.modelo || '',
    año: v.año || v.anio || '',
    chasis: v.chasis || '',
    numeroMotor: v.numeroMotor || '',
    capacidadCarga: v.capacidadCarga || null,
    trompo: v.trompo === true,
    marcaTrompo: v.marcaTrompo || null,
    serieTrompo: v.serieTrompo || null,
    modeloTrompo: v.modeloTrompo || null,
    cargaM3Trompo: v.cargaM3Trompo || null,
    kilometraje: v.kilometraje || 0,
    horometro: v.horometro || 0,
    estadoGeneral: v.estadoGeneral || v.estado || 'Bueno',
    fechaUltimaRevision: v.fechaUltimaRevision || null,
    vtv: v.vtv || {
      fechaRealizacion: null,
      fechaVencimiento: v.vencimientoVTV || null,
      costo: null,
      centroMedicion: '',
      resultado: 'Pendiente'
    },
    seguro: v.seguro || { compania: '', poliza: '', tipo: '', fechaVencimiento: null, costo: null },
    proximoServiceKm: v.proximoServiceKm || null,
    proximoServiceFecha: v.proximoServiceFecha || null,
    centroTrabajo: v.centroTrabajo || '',
    conductorHabitual: v.conductorHabitual || '',
    observaciones: v.observaciones || '',
    fotoURL: v.fotoURL || '',
    multas: v.multas || [],
    documentos: v.documentos || [],
    fechaAlta: v.fechaAlta || null
  };
}

function renderVehicles(vehicles) {
  renderVehicleTable(vehicles);
  renderVehicleCards(vehicles);
}

function renderVehicleTable(vehicles) {
  const tbody = document.getElementById('vehiculos-table-body');
  if (!tbody) return;

  const admin = isAdmin();
  const colCount = admin ? 9 : 8;

  if (vehicles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center py-8 text-gray-400">No hay vehículos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = vehicles.map(v => {
    const mv = fmap(v);
    const checked = selectedIds.has(v.id) ? 'checked' : '';
    const checkboxCell = admin ? `<td class="py-3 pr-3" onclick="event.stopPropagation()">
      <input type="checkbox" class="row-checkbox accent-[#6C3CE1]" value="${v.id}" ${checked} onchange="toggleRow('${v.id}', this.checked)">
    </td>` : '';
    const trompoBadge = mv.trompo
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#6C3CE1]/20 text-[#A78BFA]">Si<span class="w-1.5 h-1.5 rounded-full bg-[#A78BFA]"></span></span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#2E3247] text-[#5C6378]">No<span class="w-1.5 h-1.5 rounded-full bg-[#5C6378]"></span></span>`;
    return `
      <tr class="border-b border-white/5 hover:bg-[#6C3CE1]/10 cursor-pointer fade-row" onclick="rowClick('${v.id}', event)">
        ${checkboxCell}
        <td class="py-3 pr-3">${mv.interno || '—'}</td>
        <td class="py-3 pr-3 font-medium">${mv.patente || '—'}</td>
        <td class="py-3 pr-3">${mv.marca || ''} ${mv.modelo || ''}</td>
        <td class="py-3 pr-3">${mv.tipo || '—'}</td>
        <td class="py-3 pr-3">${mv.subtipo || '—'}</td>
        <td class="py-3 pr-3">${trompoBadge}</td>
        <td class="py-3 pr-3 text-xs">${mv.centroTrabajo || '—'}</td>
        <td class="py-3 no-print" onclick="event.stopPropagation()">${createActionButtons(null, `deleteVehicle('${v.id}')`, `viewVehicle('${v.id}')`)}</td>
      </tr>`;
  }).join('');
}

function renderVehicleCards(vehicles) {
  const grid = document.getElementById('vehiculos-card-grid');
  if (!grid) return;

  const admin = isAdmin();

  if (vehicles.length === 0) {
    grid.innerHTML = '<div class="col-span-full text-center py-12 text-[#5C6378]">No hay vehículos registrados</div>';
    return;
  }

  grid.innerHTML = vehicles.map(v => {
    const mv = fmap(v);
    const checked = selectedIds.has(v.id);

    let vtvBadge = '';
    if (mv.vtv?.fechaVencimiento) {
      const venc = mv.vtv.fechaVencimiento?.toDate ? mv.vtv.fechaVencimiento.toDate() : new Date(mv.vtv.fechaVencimiento);
      const hoy = new Date();
      const dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
      if (dias < 0) vtvBadge = `<span class="card-badge vtv-expired">VTV vencida</span>`;
      else if (dias <= 30) vtvBadge = `<span class="card-badge vtv-warn">VTV ${dias}d</span>`;
      else vtvBadge = `<span class="card-badge vtv-ok">VTV OK</span>`;
    }

    const trompoBadge = mv.trompo
      ? '<span class="card-badge trompo-yes">Trompo</span>'
      : '';

    const checkHtml = admin ? `<label class="card-check"><input type="checkbox" class="row-checkbox accent-[#6C3CE1]" value="${v.id}" ${checked ? 'checked' : ''} onchange="toggleRow('${v.id}', this.checked)"></label>` : '';

    const fotoHtml = mv.fotoURL
      ? `<img src="${mv.fotoURL}" alt="${mv.patente}" class="w-full h-28 object-cover" onerror="this.style.display='none'">`
      : `<div class="w-full h-28 bg-gradient-to-br from-[#6C3CE1]/10 to-[#00D4FF]/10 flex items-center justify-center">
          <svg class="w-10 h-10 text-[#6C3CE1]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2-1h2m10 1l2-1V8a1 1 0 00-1-1h-4"/></svg>
         </div>`;

    return `
      <div class="vehicle-card fade-row" onclick="rowClick('${v.id}', event)">
        ${checkHtml}
        ${fotoHtml}
        <div class="vehicle-card-header">
          <div>
            <div class="card-patente">${mv.patente || '—'}</div>
            <div class="card-marca-modelo">${mv.marca || ''} ${mv.modelo || ''}</div>
          </div>
          <div class="card-interno">${mv.interno || '—'}</div>
        </div>
        <div class="vehicle-card-body">
          <div class="flex items-center gap-2 flex-wrap mb-2">
            ${vtvBadge}
            ${trompoBadge}
            ${mv.tipo ? `<span class="card-detail"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>${mv.tipo}</span>` : ''}
          </div>
          <div class="flex flex-col gap-1">
            ${mv.centroTrabajo ? `<div class="card-detail"><svg class="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>${mv.centroTrabajo}</div>` : ''}
            ${mv.empresa ? `<div class="card-detail"><svg class="w-3 h-3 text-[#00D4FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>${mv.empresa}</div>` : ''}
            ${mv.kilometraje ? `<div class="card-detail"><svg class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>${Number(mv.kilometraje).toLocaleString('es-AR')} km</div>` : ''}
          </div>
        </div>
        <div class="vehicle-card-footer">
          <span class="text-xs text-[#5C6378]">${mv.año || ''}</span>
          <div class="card-actions" onclick="event.stopPropagation()">
            <button onclick="viewVehicle('${v.id}')" title="Ver detalle">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            ${admin ? `<button onclick="deleteVehicle('${v.id}')" title="Eliminar">
              <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function rowClick(id, event) {
  if (event.target.type === 'checkbox') return;
  viewVehicle(id);
}

function toggleRow(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkBar();
  const all = document.querySelectorAll('.row-checkbox');
  const allChecked = all.length > 0 && [...all].every(cb => cb.checked);
  document.getElementById('select-all').checked = allChecked;
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = checked;
    if (checked) selectedIds.add(cb.value);
    else selectedIds.delete(cb.value);
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  if (!bar || !count) return;
  count.textContent = selectedIds.size;
  bar.classList.toggle('hidden', selectedIds.size === 0);
}

function deleteSelectedVehicles() {
  if (!selectedIds.size) return;
  const ids = [...selectedIds];
  deleteMultipleWithBackup('vehicles', ids, 'Vehículo').then(() => {
    selectedIds.clear();
    document.getElementById('select-all').checked = false;
    updateBulkBar();
  });
}

function hasTrompo(v) {
  return v.trompo === true;
}

function applyFilters() {
  const search = (document.getElementById('search-vehiculo').value || '').toLowerCase();
  const marca = document.getElementById('filter-marca').value;
  const tipo = document.getElementById('filter-tipo').value;
  const subtipo = document.getElementById('filter-subtipo').value;
  const centro = document.getElementById('filter-centro').value;
  const empresa = document.getElementById('filter-empresa').value;
  const estado = document.getElementById('filter-estado')?.value || '';
  const activeTrompoBtn = document.querySelector('[data-trompo-filter].bg-\\[\\#6C3CE1\\]\\/30');
  const trompoFilter = activeTrompoBtn ? activeTrompoBtn.dataset.trompoFilter : 'all';

  let filtered = allVehicles;
  if (search) {
    filtered = filtered.filter(v =>
      (v.patente || '').toLowerCase().includes(search) ||
      (v.marca || '').toLowerCase().includes(search) ||
      (v.modelo || '').toLowerCase().includes(search) ||
      (v.interno || v.numeroInterno || '').toLowerCase().includes(search) ||
      (v.tipo || '').toLowerCase().includes(search) ||
      (v.subtipo || '').toLowerCase().includes(search) ||
      (v.centroTrabajo || '').toLowerCase().includes(search) ||
      (v.empresa || '').toLowerCase().includes(search)
    );
  }
  if (marca) filtered = filtered.filter(v => (v.marca || '') === marca);
  if (tipo) filtered = filtered.filter(v => (v.tipo || '') === tipo);
  if (subtipo) filtered = filtered.filter(v => (v.subtipo || '') === subtipo);
  if (centro) filtered = filtered.filter(v => (v.centroTrabajo || '') === centro);
  if (empresa) filtered = filtered.filter(v => (v.empresa || '') === empresa);
  if (estado) filtered = filtered.filter(v => (v.estadoGeneral || v.estado || 'Activo') === estado);
  if (trompoFilter === 'yes') filtered = filtered.filter(v => hasTrompo(v));
  if (trompoFilter === 'no') filtered = filtered.filter(v => !hasTrompo(v));

  document.getElementById('filter-count').textContent = filtered.length;
  document.getElementById('total-vehicles').textContent = filtered.length;
  updateActiveFiltersCount();

  filtered.sort((a, b) => {
    let va = a[sortField] ?? '';
    let vb = b[sortField] ?? '';
    if (sortField === 'marca') { va = `${a.marca || ''} ${a.modelo || ''}`.trim(); vb = `${b.marca || ''} ${b.modelo || ''}`.trim(); }
    if (sortField === 'kilometraje') { va = Number(va) || 0; vb = Number(vb) || 0; }
    if (sortField === 'año') { va = Number(va) || 0; vb = Number(vb) || 0; }
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  renderVehicles(filtered);
}

function sortBy(field) {
  if (sortField === field) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDir = 'asc';
  }
  document.querySelectorAll('.sort-arrow').forEach(el => {
    el.textContent = '';
    el.classList.remove('text-[#6C3CE1]');
  });
  const activeArrow = document.querySelector(`.sort-arrow[data-field="${field}"]`);
  if (activeArrow) {
    activeArrow.textContent = sortDir === 'asc' ? '▲' : '▼';
    activeArrow.classList.add('text-[#6C3CE1]');
  }
  applyFilters();
}

function resetFilters() {
  document.getElementById('search-vehiculo').value = '';
  document.getElementById('filter-marca').value = '';
  document.getElementById('filter-tipo').value = '';
  document.getElementById('filter-subtipo').value = '';
  document.getElementById('filter-centro').value = '';
  document.getElementById('filter-empresa').value = '';
  if (document.getElementById('filter-estado')) document.getElementById('filter-estado').value = '';
  document.querySelectorAll('[data-trompo-filter]').forEach((btn, i) => {
    btn.classList.remove('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
    btn.classList.add('text-[#8E94A8]', 'hover:text-[#F1F3F8]', 'hover:bg-[#6C3CE1]/10');
    if (i === 0) {
      btn.classList.add('bg-[#6C3CE1]/30', 'text-[#F1F3F8]');
      btn.classList.remove('text-[#8E94A8]', 'hover:text-[#F1F3F8]', 'hover:bg-[#6C3CE1]/10');
    }
  });
  applyFilters();
}

function populateFilterDropdowns() {
  const uniqueValues = (field) => [...new Set(allVehicles.map(v => v[field]).filter(Boolean))].sort();

  populateSelect('filter-marca', 'Todas', uniqueValues('marca'));
  populateSelect('filter-tipo', 'Todos', uniqueValues('tipo'));
  populateSelect('filter-subtipo', 'Todos', uniqueValues('subtipo'));
  populateSelect('filter-centro', 'Todos', uniqueValues('centroTrabajo'));
  populateSelect('filter-empresa', 'Todas', uniqueValues('empresa'));
}

function populateSelect(id, defaultLabel, values) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="" class="bg-[#0A0A1A]">${defaultLabel}</option>` +
    values.map(v => `<option value="${v}" class="bg-[#0A0A1A]">${v}</option>`).join('');
  if (prev && values.includes(prev)) sel.value = prev;
}

function openVehicleModal(vehicleId = null) {
  if (!isAdmin()) return;
  editingVehicleId = vehicleId;
  document.getElementById('form-vehiculo').reset();
  document.getElementById('vehiculo-id').value = '';
  document.getElementById('modal-vehiculo-title').textContent = 'Nuevo Vehículo';
  document.getElementById('multas-container').innerHTML = '<div class="text-sm text-gray-400 italic">Sin multas registradas</div>';
  document.getElementById('documentos-container').innerHTML = '<div class="text-sm text-gray-400 italic">Sin documentos adjuntos</div>';

  if (vehicleId) {
    const raw = allVehicles.find(x => x.id === vehicleId);
    if (!raw) return;
    const v = fmap(raw);
    document.getElementById('modal-vehiculo-title').textContent = 'Editar Vehículo';
    document.getElementById('vehiculo-id').value = vehicleId;
    document.getElementById('v-patente').value = v.patente;
    document.getElementById('v-interno').value = v.interno;
    document.getElementById('v-interno').readOnly = true;
    setSelectValue('v-marca', v.marca);
    document.getElementById('v-modelo').value = v.modelo;
    document.getElementById('v-anio').value = v.año;
    document.getElementById('v-chasis').value = v.chasis;
    document.getElementById('v-numeroMotor').value = v.numeroMotor;
    document.getElementById('v-capacidadCarga').value = v.capacidadCarga || '';
    document.getElementById('v-trompo').checked = v.trompo;
    document.getElementById('v-trompo-fields').classList.toggle('hidden', !v.trompo);
    document.getElementById('v-marcaTrompo').value = v.marcaTrompo || '';
    document.getElementById('v-serieTrompo').value = v.serieTrompo || '';
    document.getElementById('v-modeloTrompo').value = v.modeloTrompo || '';
    document.getElementById('v-cargaM3Trompo').value = v.cargaM3Trompo || '';
    document.getElementById('v-tipo').value = v.tipo;
    document.getElementById('v-subtipo').value = v.subtipo;
    document.getElementById('v-kilometraje').value = v.kilometraje;
    setDateField('v-vtvFechaRealizacion', v.vtv?.fechaRealizacion || null);
    setDateField('v-vencimientoVTV', v.vtv?.fechaVencimiento || v.vencimientoVTV || null);
    document.getElementById('v-vtvCosto').value = v.vtv?.costo || '';
    document.getElementById('v-vtvCentro').value = v.vtv?.centroMedicion || '';
    document.getElementById('v-vtvResultado').value = v.vtv?.resultado || 'Pendiente';
    document.getElementById('v-seguroCompania').value = v.seguro?.compania || v.seguro?.compañía || '';
    document.getElementById('v-seguroPoliza').value = v.seguro?.poliza || '';
    document.getElementById('v-seguroTipo').value = v.seguro?.tipo || '';
    setDateField('v-seguroVencimiento', v.seguro?.fechaVencimiento || null);
    document.getElementById('v-seguroCosto').value = v.seguro?.costo || '';
    document.getElementById('v-proximoServiceKm').value = v.proximoServiceKm || '';
    setDateField('v-proximoServiceFecha', v.proximoServiceFecha);
    document.getElementById('v-centroTrabajo').value = v.centroTrabajo;
    document.getElementById('v-conductorHabitual').value = v.conductorHabitual;
    document.getElementById('v-observaciones').value = v.observaciones;
    document.getElementById('v-foto').value = v.fotoURL;

    if (v.multas.length) {
      document.getElementById('multas-container').innerHTML = '';
      v.multas.forEach(m => addMultaRow(m));
    }
    if (v.documentos.length) {
      document.getElementById('documentos-container').innerHTML = '';
      v.documentos.forEach(d => addDocumentoRow(d));
    }
  }

  showModal('modal-vehiculo');
}

function setDateField(id, val) {
  const el = document.getElementById(id);
  if (!val) { el.value = ''; return; }
  const d = val.toDate ? val.toDate() : new Date(val);
  el.value = d.toISOString().split('T')[0];
}

function closeVehicleModal() {
  hideModal('modal-vehiculo');
  editingVehicleId = null;
}

function getDateValue(id) {
  const val = document.getElementById(id).value;
  return val ? firebase.firestore.Timestamp.fromDate(new Date(val + 'T00:00:00')) : null;
}

function collectMultas() {
  const rows = document.querySelectorAll('#multas-container .multa-row');
  return Array.from(rows).map(row => ({
    fecha: row.querySelector('.multa-fecha')?.value || '',
    importe: parseFloat(row.querySelector('.multa-importe')?.value) || 0,
    concepto: row.querySelector('.multa-concepto')?.value || '',
    pagado: row.querySelector('.multa-pagado')?.checked || false
  }));
}

function collectDocumentos() {
  const rows = document.querySelectorAll('#documentos-container .documento-row');
  return Array.from(rows).map(row => ({
    tipo: row.querySelector('.doc-tipo')?.value || '',
    fechaVencimiento: row.querySelector('.doc-fecha')?.value || '',
    archivoURL: row.querySelector('.doc-url')?.value || ''
  }));
}

async function saveVehicle(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const id = document.getElementById('vehiculo-id').value;
  const isNew = !id;

  const data = {
    patente: document.getElementById('v-patente').value.trim().toUpperCase(),
    marca: document.getElementById('v-marca').value,
    modelo: document.getElementById('v-modelo').value.trim(),
    año: parseInt(document.getElementById('v-anio').value) || null,
    chasis: document.getElementById('v-chasis').value.trim() || '',
    numeroMotor: document.getElementById('v-numeroMotor').value.trim() || '',
    capacidadCarga: parseFloat(document.getElementById('v-capacidadCarga').value) || null,
    trompo: document.getElementById('v-trompo').checked,
    marcaTrompo: document.getElementById('v-trompo').checked ? (document.getElementById('v-marcaTrompo').value.trim() || null) : null,
    serieTrompo: document.getElementById('v-trompo').checked ? (document.getElementById('v-serieTrompo').value.trim() || null) : null,
    modeloTrompo: document.getElementById('v-trompo').checked ? (document.getElementById('v-modeloTrompo').value.trim() || null) : null,
    cargaM3Trompo: document.getElementById('v-trompo').checked ? (document.getElementById('v-cargaM3Trompo').value.trim() || null) : null,
    tipo: document.getElementById('v-tipo').value,
    subtipo: document.getElementById('v-subtipo').value,
    kilometraje: parseInt(document.getElementById('v-kilometraje').value) || 0,
    vtv: {
      fechaRealizacion: getDateValue('v-vtvFechaRealizacion'),
      fechaVencimiento: getDateValue('v-vencimientoVTV'),
      costo: parseFloat(document.getElementById('v-vtvCosto').value) || null,
      centroMedicion: document.getElementById('v-vtvCentro').value.trim() || '',
      resultado: document.getElementById('v-vtvResultado').value || 'Pendiente'
    },
    seguro: {
      compania: document.getElementById('v-seguroCompania').value.trim() || '',
      poliza: document.getElementById('v-seguroPoliza').value.trim() || '',
      tipo: document.getElementById('v-seguroTipo').value || '',
      fechaVencimiento: getDateValue('v-seguroVencimiento'),
      costo: parseFloat(document.getElementById('v-seguroCosto').value) || null
    },
    proximoServiceKm: parseInt(document.getElementById('v-proximoServiceKm').value) || null,
    proximoServiceFecha: getDateValue('v-proximoServiceFecha'),
    centroTrabajo: document.getElementById('v-centroTrabajo').value,
    conductorHabitual: document.getElementById('v-conductorHabitual').value.trim() || '',
    empresa: document.getElementById('v-empresa').value.trim() || '',
    observaciones: document.getElementById('v-observaciones').value.trim() || '',
    fotoURL: document.getElementById('v-foto').value.trim() || '',
    multas: collectMultas(),
    documentos: collectDocumentos(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!data.patente) {
    showToast('La patente es obligatoria', 'error');
    return;
  }

  try {
    showLoading(true);
    if (isNew) {
      const dup = await db.collection('vehicles').where('patente', '==', data.patente).get();
      if (!dup.empty) {
        showToast('Ya existe un vehículo con esa patente', 'error');
        return;
      }
      const seq = await getNextVehicleNumber();
      data.interno = seq.formatted;
      data.fechaAlta = firebase.firestore.FieldValue.serverTimestamp();
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('vehicles').add(data);
      showToast(`Vehículo creado exitosamente — N° Interno: ${seq.formatted}`);
    } else {
      data.interno = document.getElementById('v-interno').value.trim();
      await db.collection('vehicles').doc(id).update(data);
      showToast('Vehículo actualizado exitosamente');
    }
    closeVehicleModal();
  } catch (error) {
    showToast('Error al guardar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function addMultaRow(multa) {
  const container = document.getElementById('multas-container');
  const emptyMsg = container.querySelector('.italic');
  if (emptyMsg) emptyMsg.remove();

  const row = document.createElement('div');
  row.className = 'multa-row flex flex-wrap items-end gap-2 p-2 bg-red-900/20 rounded-lg';
  row.innerHTML = `
    <div class="flex-1 min-w-[120px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Fecha</label>
      <input type="date" class="multa-fecha w-full px-2 py-1.5 input-neon rounded text-sm bg-[#0A0A1A]/50 border border-[#6C3CE1]/20 text-[#F1F3F8]" value="${multa?.fecha || ''}">
    </div>
    <div class="w-28">
      <label class="block text-xs text-[#8E94A8] mb-1">Importe ($)</label>
      <input type="number" class="multa-importe w-full px-2 py-1.5 input-neon rounded text-sm bg-[#0A0A1A]/50 border border-[#6C3CE1]/20 text-[#F1F3F8]" value="${multa?.importe || ''}" step="0.01">
    </div>
    <div class="flex-[2] min-w-[150px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Concepto</label>
      <input type="text" class="multa-concepto w-full px-2 py-1.5 input-neon rounded text-sm bg-[#0A0A1A]/50 border border-[#6C3CE1]/20 text-[#F1F3F8]" value="${multa?.concepto || ''}" placeholder="Exceso de velocidad">
    </div>
    <div class="flex items-center gap-1 pb-1.5">
      <input type="checkbox" class="multa-pagado" ${multa?.pagado ? 'checked' : ''}>
      <label class="text-xs text-[#8E94A8]">Pagado</label>
    </div>
    <button type="button" onclick="this.closest('.multa-row').remove()" class="pb-1.5 text-red-400 hover:text-red-300">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>`;

  container.appendChild(row);
}

function addDocumentoRow(doc) {
  const container = document.getElementById('documentos-container');
  const emptyMsg = container.querySelector('.italic');
  if (emptyMsg) emptyMsg.remove();

  const row = document.createElement('div');
  row.className = 'documento-row flex flex-wrap items-end gap-2 p-2 bg-teal-900/20 rounded-lg';
  row.innerHTML = `
    <div class="flex-1 min-w-[120px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Tipo</label>
      <select class="doc-tipo w-full px-2 py-1.5 border border-[#6C3CE1]/20 rounded text-sm bg-[#0A0A1A]/50 text-[#F1F3F8]">
        <option value="">Seleccionar...</option>
        <option value="VTV" ${doc?.tipo === 'VTV' ? 'selected' : ''}>VTV</option>
        <option value="Cédula" ${doc?.tipo === 'Cédula' ? 'selected' : ''}>Cédula</option>
        <option value="Seguro" ${doc?.tipo === 'Seguro' ? 'selected' : ''}>Seguro</option>
        <option value="Habilitación" ${doc?.tipo === 'Habilitación' ? 'selected' : ''}>Habilitación</option>
        <option value="Otro" ${doc?.tipo === 'Otro' ? 'selected' : ''}>Otro</option>
      </select>
    </div>
    <div class="w-36">
      <label class="block text-xs text-[#8E94A8] mb-1">Vencimiento</label>
      <input type="date" class="doc-fecha w-full px-2 py-1.5 border border-[#6C3CE1]/20 rounded text-sm bg-[#0A0A1A]/50 text-[#F1F3F8]" value="${doc?.fechaVencimiento || ''}">
    </div>
    <div class="flex-[2] min-w-[180px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Archivo URL</label>
      <input type="url" class="doc-url w-full px-2 py-1.5 border border-[#6C3CE1]/20 rounded text-sm bg-[#0A0A1A]/50 text-[#F1F3F8]" value="${doc?.archivoURL || ''}" placeholder="https://storage.googleapis.com/...">
    </div>
    <button type="button" onclick="this.closest('.documento-row').remove()" class="pb-1.5 text-red-400 hover:text-red-300">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>`;

  container.appendChild(row);
}

async function deleteVehicle(id) {
  await deleteWithBackup('vehicles', id, 'Vehículo');
}

function viewVehicle(id) {
  window.location.href = `/vehicle/${id}`;
}

/* ───────── CSV Import ───────── */

function openCsvImport() {
  document.getElementById('import-menu')?.classList.add('hidden');
  csvValidatedData = [];
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-import-preview').innerHTML = '';
  document.getElementById('btn-execute-csv').classList.add('hidden');
  showModal('modal-csv-import');
}

function closeCsvImport() {
  hideModal('modal-csv-import');
}

function downloadCsvTemplate() {
  const headers = ['patente','interno','marca','modelo','año','chasis','numeroMotor','tipo','subtipo','capacidadCarga','trompo','marcaTrompo','serieTrompo','modeloTrompo','cargaM3Trompo','kilometraje','vtvFechaRealizacion','vtvVencimiento','vtvCosto','vtvCentro','vtvResultado','seguroCompania','seguroPoliza','seguroTipo','seguroVencimiento','seguroCosto','proximoServiceKm','proximoServiceFecha','conductorHabitual','empresa','centroTrabajo','observaciones'];
  const sample = ['ABC123','V001','Mercedes Benz','Atego 1718','2022','9BM1234567890ABC','Motor XYZ-12345','mixer','Indumix','25000','Si','Marina','ST-12345','Modelo X','8 M3','158000','2026-03-15','2026-08-31','25000','Campana','Aprobado','Rivadavia Seguros','POL-2024-12345','Todo Riesgo','2026-09-30','120000','160000','2026-07-15','Juan Pérez','FRAFIL SRL','Lujan','Último cambio de cubiertas a los 140.000 km'];
  const BOM = '\uFEFF';
  const csv = BOM + headers.join(',') + '\n' + sample.join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'plantilla_vehiculos.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function downloadExcelTemplate() {
  try {
    const resp = await fetch('/api/vehicles/template/excel');
    if (!resp.ok) throw new Error('Error al descargar plantilla');
    const blob = await resp.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_vehiculos.xlsx';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    showToast('Error al descargar plantilla Excel: ' + e.message, 'error');
  }
}
function parseVehicleRows(rows) {
  const errors = [];
  const valid = [];
  const seen = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idx = i + 2;
    const rowErrors = [];

    const patente = (row.patente || '').toString().trim().toUpperCase();
    const interno = (row.interno || '').toString().trim();
    const marca = (row.marca || '').toString().trim();
    const modelo = (row.modelo || '').toString().trim();
    const año = parseInt(row.año);
    const chasis = (row.chasis || '').toString().trim();
    const numeroMotor = (row.numeroMotor || '').toString().trim();
    const tipo = (row.tipo || '').toString().trim();
    const subtipo = (row.subtipo || '').toString().trim();
    const empresa = (row.empresa || '').toString().trim();

    // Skip completely empty rows
    if (!patente && !interno && !marca && !modelo && !chasis && !numeroMotor && !tipo && !subtipo) continue;

    if (!patente) rowErrors.push('patente requerida');
    if (!marca) rowErrors.push('marca requerida');
    if (!modelo) rowErrors.push('modelo requerido');
    if (!año) rowErrors.push('año requerido');
    if (!chasis) rowErrors.push('chasis requerido');
    if (!tipo) rowErrors.push('tipo requerido');

    if (patente && (patenteSet.has(patente) || seen.has(patente))) rowErrors.push('patente duplicada');
    if (patente) seen.add(patente);

    if (rowErrors.length) {
      errors.push({ fila: idx, patente: patente || '(sin patente)', errores: rowErrors.join(', ') });
    } else {
      valid.push({
        patente, interno, marca, modelo, año, chasis, numeroMotor, tipo, subtipo,
        capacidadCarga: parseFloat(row.capacidadCarga) || null,
        trompoRaw: (row.trompoRaw || '').toString().trim(),
        marcaTrompo: (row.marcaTrompo || '').toString().trim(),
        serieTrompo: (row.serieTrompo || '').toString().trim(),
        modeloTrompo: (row.modeloTrompo || '').toString().trim(),
        cargaM3Trompo: (row.cargaM3Trompo || '').toString().trim(),
        kilometraje: parseFloat(row.kilometraje) || 0,
        vtvFechaRealizacion: row.vtvFechaRealizacion || '',
        vtvVencimiento: row.vtvVencimiento || '',
        vtvCosto: parseFloat(row.vtvCosto) || null,
        vtvCentro: (row.vtvCentro || '').toString().trim(),
        vtvResultado: (row.vtvResultado || 'Pendiente').toString().trim(),
        seguroCompania: (row.seguroCompania || '').toString().trim(),
        seguroPoliza: (row.seguroPoliza || '').toString().trim(),
        seguroTipo: (row.seguroTipo || '').toString().trim(),
        seguroVencimiento: row.seguroVencimiento || '',
        seguroCosto: parseFloat(row.seguroCosto) || null,
        proximoServiceKm: parseFloat(row.proximoServiceKm) || null,
        proximoServiceFecha: row.proximoServiceFecha || '',
        conductorHabitual: (row.conductorHabitual || '').toString().trim(),
        empresa: (row.empresa || '').toString().trim(),
        centroTrabajo: (row.centroTrabajo || '').toString().trim(),
        observaciones: (row.observaciones || '').toString().trim()
      });
    }
  }
  return { errors, valid };
}

function showVehicleImportResult(result) {
  const { errors, valid } = result;
  const preview = document.getElementById('csv-import-preview');
  let html = '';

  if (errors.length) {
    html += `<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400 mb-3">
      <strong>${errors.length} error(es):</strong>
      <ul class="mt-1 list-disc pl-4">${errors.map(e => `<li>Fila ${e.fila} (${e.patente}): ${e.errores}</li>`).join('')}</ul>
    </div>`;
  }

  if (valid.length) {
    csvValidatedData = valid;
    html += `<div class="p-3 bg-green-900/30 rounded-lg text-sm text-green-400 mb-3">
      <strong>${valid.length} vehículo(s) válido(s) listos para importar</strong>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead><tr class="text-left text-[#8E94A8] border-b border-white/10">${['Patente','Interno','Marca','Modelo','Tipo'].map(h => `<th class="pb-2 pr-2">${h}</th>`).join('')}</tr></thead>
        <tbody>${valid.slice(0,20).map(v => `<tr class="border-b border-white/5">
          <td class="py-1.5 pr-2">${v.patente}</td>
          <td class="py-1.5 pr-2">${v.interno}</td>
          <td class="py-1.5 pr-2">${v.marca}</td>
          <td class="py-1.5 pr-2">${v.modelo || ''}</td>
          <td class="py-1.5 pr-2">${v.tipo}</td>
        </tr>`).join('')}${valid.length > 20 ? `<tr><td colspan="5" class="py-2 text-[#5C6378]">... y ${valid.length - 20} más</td></tr>` : ''}</tbody>
      </table>
    </div>`;
    document.getElementById('btn-execute-csv').classList.remove('hidden');
  } else {
    document.getElementById('btn-execute-csv').classList.add('hidden');
  }

  if (!html) html = '<div class="p-3 bg-yellow-900/30 rounded-lg text-sm text-yellow-400">No se encontraron datos válidos en el archivo</div>';
  preview.innerHTML = html;
}

function validateCsvImport() {
  try {
    const fileInput = document.getElementById('csv-file-input');
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      showToast('Seleccioná un archivo CSV o Excel primero', 'error');
      return;
    }

    const file = fileInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();

    if (typeof Papa === 'undefined' && ext === 'csv') {
      showToast('Error: PapaParse no está cargado. Recargá la página.', 'error');
      return;
    }
    if (typeof XLSX === 'undefined' && ['xlsx', 'xls'].includes(ext)) {
      showToast('Error: La librería XLSX no está cargada. Recargá la página.', 'error');
      return;
    }

    document.getElementById('csv-import-preview').innerHTML = '<div class="text-sm text-[#8E94A8]">Analizando archivo...</div>';
    document.getElementById('btn-execute-csv').classList.add('hidden');
    csvValidatedData = [];

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          try {
            if (!results.data || !results.data.length) {
              showToast('El CSV está vacío o no tiene datos válidos', 'error');
              return;
            }
            const result = parseVehicleRows(results.data);
            showVehicleImportResult(result);
          } catch (callbackErr) {
            showToast('Error al procesar CSV: ' + callbackErr.message, 'error');
          }
        },
        error: (err) => {
          showToast('Error al leer el archivo CSV: ' + err.message, 'error');
        }
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (!rows.length) {
            showToast('El Excel está vacío o no tiene datos válidos', 'error');
            return;
          }
          // Normalize Excel column names to lowercase internal field names
          const headerMap = {
            'id':'interno','patente':'patente','marca':'marca','modelo':'modelo',
            'año':'año','aÃ±o':'año','chasis':'chasis','nro motor':'numeroMotor',
            'tipo':'tipo','subtipo':'subtipo','capacidad':'capacidadCarga',
            'trompo':'trompoRaw','marca trompo':'marcaTrompo','nro serie trompo':'serieTrompo',
            'modelo trompo':'modeloTrompo','carga m3 trompo':'cargaM3Trompo',
            'kilometraje':'kilometraje',
            'vtv realizacion':'vtvFechaRealizacion','vtv vencimiento':'vtvVencimiento',
            'vtv costo':'vtvCosto','vtv centro':'vtvCentro','vtv resultado':'vtvResultado',
            'seguro compania':'seguroCompania','seguro poliza':'seguroPoliza',
            'seguro tipo':'seguroTipo','seguro vencimiento':'seguroVencimiento',
            'seguro costo':'seguroCosto','prox service km':'proximoServiceKm',
            'prox service fecha':'proximoServiceFecha',
            'conductor':'conductorHabitual','empresa':'empresa',
            'centro trabajo':'centroTrabajo','observaciones':'observaciones'
          };
          rows = rows.map(r => {
            const o = {};
            Object.keys(r).forEach(k => {
              const mk = headerMap[k.toLowerCase().trim()] || k.toLowerCase().trim();
              o[mk] = r[k];
            });
            return o;
          });
          const result = parseVehicleRows(rows);
          showVehicleImportResult(result);
        } catch (err) {
          showToast('Error al leer Excel: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      document.getElementById('csv-import-preview').innerHTML = '<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400">Formato no soportado. Usá archivos .csv, .xlsx o .xls</div>';
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function toTimestamp(val) {
  if (!val && val !== 0) return null;
  let d;
  if (typeof val === 'number') {
    // Excel serial date: days since 1900-01-01
    d = new Date((val - 25569) * 86400 * 1000);
  } else if (val instanceof Date) {
    d = val;
  } else {
    const s = String(val).trim();
    if (!s) return null;
    d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
  }
  if (isNaN(d.getTime())) return null;
  return firebase.firestore.Timestamp.fromDate(d);
}

async function executeCsvImport() {
  if (!csvValidatedData.length) return;
  let seq = await getNextVehicleNumber();
  let seqNum = seq.number;
  let maxNum = seqNum - 1;

  // Build items and check for interno conflicts
  const items = [];
  const internosUsar = [];
  for (const row of csvValidatedData) {
    let interno;
    if (row.interno && /^V\d{3}$/i.test(String(row.interno).trim())) {
      interno = String(row.interno).trim().toUpperCase();
    } else {
      interno = `V${String(seqNum).padStart(3, '0')}`;
      seqNum++;
    }
    internosUsar.push(interno);
  }
  // Query existing vehicles that match any of our internos (batched for Firestore limit)
  const existentes = new Set();
  for (let i = 0; i < internosUsar.length; i += 30) {
    const chunk = internosUsar.slice(i, i + 30);
    const snap = await db.collection('vehicles').where('interno', 'in', chunk).get();
    snap.forEach(d => existentes.add(d.data().interno));
  }
  const conflictos = csvValidatedData
    .map((r, idx) => ({ interno: internosUsar[idx], idx }))
    .filter(({ interno }) => existentes.has(interno));
  if (conflictos.length) {
    const lines = conflictos.map(c => `Fila ${c.idx + 2}: ${c.interno}`);
    showToast(`Conflicto de números de interno:\n${lines.join('\n')}`, 'error');
    return;
  }

  for (let i = 0; i < csvValidatedData.length; i++) {
    const row = csvValidatedData[i];
    const interno = internosUsar[i];
    const m = interno.match(/^V0*(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    const seguro = {};
    if (row.seguroCompania || row.seguroPoliza || row.seguroVencimiento || row.seguroTipo || row.seguroCosto) {
      seguro.compania = row.seguroCompania || '';
      seguro.poliza = row.seguroPoliza || '';
      seguro.tipo = row.seguroTipo || '';
      seguro.costo = parseFloat(row.seguroCosto) || null;
      seguro.fechaVencimiento = toTimestamp(row.seguroVencimiento);
    }
    items.push({
      patente: row.patente,
      interno,
      marca: row.marca,
      modelo: row.modelo,
      año: row.año,
      chasis: row.chasis,
      numeroMotor: row.numeroMotor || '',
      tipo: row.tipo,
      subtipo: row.subtipo || '',
      capacidadCarga: row.capacidadCarga || null,
      trompo: parseTrompoRaw(row.trompoRaw),
      marcaTrompo: row.marcaTrompo || null,
      serieTrompo: row.serieTrompo || null,
      modeloTrompo: row.modeloTrompo || null,
      cargaM3Trompo: row.cargaM3Trompo || null,
      kilometraje: row.kilometraje || 0,
      vtv: {
        fechaRealizacion: toTimestamp(row.vtvFechaRealizacion),
        fechaVencimiento: toTimestamp(row.vtvVencimiento),
        costo: row.vtvCosto || null,
        centroMedicion: row.vtvCentro || '',
        resultado: row.vtvResultado || 'Pendiente'
      },
      seguro: Object.keys(seguro).length ? seguro : {},
      proximoServiceKm: row.proximoServiceKm || null,
      proximoServiceFecha: toTimestamp(row.proximoServiceFecha),
      conductorHabitual: row.conductorHabitual || '',
      empresa: row.empresa || '',
      centroTrabajo: row.centroTrabajo || '',
      observaciones: row.observaciones || '',
      fotoURL: '',
      multas: [],
      documentos: [],
      fechaAlta: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  await batchImport(items, 'csv');
  // Update counter to max number used
  try {
    await db.collection('counters').doc('vehicles').set({ current: maxNum }, { merge: true });
  } catch (_) {}
  csvValidatedData = [];
  document.getElementById('btn-execute-csv').classList.add('hidden');
  document.getElementById('csv-import-preview').innerHTML = '';
  closeCsvImport();
}

/* ───────── Batch Import Engine ───────── */

async function batchImport(items, source) {
  const total = items.length;
  showProgress(0, total, `Importando ${total} vehículos...`);
  document.getElementById('modal-progress').classList.remove('hidden');

  const BATCH_LIMIT = 500;
  let completed = 0;

  try {
    for (let i = 0; i < total; i += BATCH_LIMIT) {
      const chunk = items.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const item of chunk) {
        const docRef = db.collection('vehicles').doc();
        batch.set(docRef, item);
      }

      await batch.commit();
      completed += chunk.length;
      showProgress(completed, total, `Importando ${total} vehículos...`);
    }

    document.getElementById('progress-text').textContent = `¡Importación completada! ${total} vehículo(s) agregado(s).`;
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('progress-detail').textContent = '';
    document.getElementById('btn-progress-close').classList.remove('hidden');
    showToast(`${total} vehículo(s) importado(s) exitosamente`);
  } catch (error) {
    document.getElementById('progress-text').textContent = 'Error durante la importación';
    document.getElementById('progress-detail').textContent = error.message;
    document.getElementById('btn-progress-close').classList.remove('hidden');
    showToast('Error en importación por lotes: ' + error.message, 'error');
  }
}

/* ───────── Progress ───────── */

function showProgress(current, total, label) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = label || 'Procesando...';
  document.getElementById('progress-detail').textContent = `${current} / ${total}`;
}

function closeProgressModal() {
  hideModal('modal-progress');
  document.getElementById('btn-progress-close').classList.add('hidden');
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-detail').textContent = '';
}

/* ───────── Import Menu toggle ───────── */

document.addEventListener('click', (e) => {
  const menu = document.getElementById('import-menu');
  if (menu && !menu.classList.contains('hidden') && !e.target.closest('#import-dropdown')) {
    menu.classList.add('hidden');
  }
});

function toggleImportMenu() {
  const menu = document.getElementById('import-menu');
  if (menu) menu.classList.toggle('hidden');
}

function exportVehiclesExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Librería XLSX no cargada', 'error');
    return;
  }
  const headers = ['Interno', 'Patente', 'Marca', 'Modelo', 'Año', 'Tipo', 'Subtipo', 'Trompo', 'Estado', 'Empresa', 'Centro', 'Kilometraje', 'Chasis', 'N° Motor', 'Conductor'];
  const rows = allVehicles.map(v => [
    v.interno || '', v.patente || '', v.marca || '', v.modelo || '', v.anio || v.año || '',
    v.tipo || '', v.subtipo || '', v.trompo ? 'Si' : 'No',
    v.estadoGeneral || v.estado || 'Activo', v.empresa || '', v.centroTrabajo || '',
    v.kilometraje || 0, v.chasis || '', v.numeroMotor || '', v.conductorHabitual || ''
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h, i) => ({ wch: [8, 10, 16, 16, 6, 18, 14, 7, 8, 18, 14, 12, 20, 16, 16][i] || 12 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vehículos');
  const now = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `vehiculos-${now}.xlsx`);
  showToast('Excel exportado correctamente', 'success');
}
