let allMaintenance = [];
let editingMaintenanceId = null;
let vehiclesCache = [];
let toolsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  loadSelectData();
  initRealtimeListener();
  document.getElementById('form-mantenimiento')?.addEventListener('submit', saveMaintenance);
  setupModalClose('modal-mantenimiento');
  document.getElementById('search-mant')?.addEventListener('input', applyFilters);
  document.getElementById('filter-tipo-mant')?.addEventListener('change', applyFilters);
  document.getElementById('filter-estado-mant')?.addEventListener('change', applyFilters);
});

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

function loadSelectData() {
  db.collection('vehicles').where('estado', '!=', 'Dado de baja').onSnapshot((snapshot) => {
    vehiclesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    populateVehicleSelect();
  });

  db.collection('tools').onSnapshot((snapshot) => {
    toolsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    populateToolSelect();
  });
}

function populateVehicleSelect() {
  const select = document.getElementById('m-vehiculo');
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar vehículo...</option>' +
    vehiclesCache.map(v => `<option value="${v.id}">${v.patente} - ${v.marca} ${v.modelo} (Int: ${v.numeroInterno})</option>`).join('');
}

function populateToolSelect() {
  const select = document.getElementById('m-herramienta');
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar herramienta...</option>' +
    toolsCache.map(t => `<option value="${t.id}">${t.codigoInterno} - ${t.nombre}</option>`).join('');
}

function toggleAsociado() {
  const tipo = document.getElementById('m-asociado-tipo').value;
  document.getElementById('m-vehiculo-group').classList.toggle('hidden', tipo !== 'vehiculo');
  document.getElementById('m-herramienta-group').classList.toggle('hidden', tipo !== 'herramienta');
}

function initRealtimeListener() {
  db.collection('maintenance').orderBy('fechaRealizacion', 'desc').onSnapshot((snapshot) => {
    allMaintenance = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMaintenance(allMaintenance);
  }, (error) => {
    console.error('Error loading maintenance:', error);
    document.getElementById('maintenance-table-body').innerHTML =
      '<tr><td colspan="9" class="text-center py-8 text-red-500">Error al cargar mantenimientos</td></tr>';
  });
}

function renderMaintenance(items) {
  const tbody = document.getElementById('maintenance-table-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">No hay mantenimientos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(m => {
    const days = daysUntil(m.proximaFechaVencimiento);
    const level = getAlertLevel(days);
    const alertIcon = level === 'critical' ? ' 🔴' : level === 'warning' ? ' 🟡' : '';
    const rowClass = level === 'critical' ? 'bg-red-50' : '';
    const asociado = m.vehiculoPatente || m.herramientaCodigo || '—';
    const tipoStyle = m.tipo === 'Legal'
      ? 'style="background-color:#DBEAFE;color:#1E40AF"'
      : 'style="background-color:#D1FAE5;color:#065F46"';
    const estadoClass = (m.estado || '').toLowerCase();

    const viewBtn = m.comprobanteURL
      ? `<a href="${m.comprobanteURL}" target="_blank" class="text-green-600 hover:text-green-800 mr-2" title="Ver comprobante">
          <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </a>`
      : '';

    return `
      <tr class="border-b border-white/5 hover:bg-[#FF6B35]/10 ${rowClass}">
        <td class="py-3 pr-3"><span class="status-badge" ${tipoStyle}>${m.tipo}</span></td>
        <td class="py-3 pr-3 font-medium">${asociado}</td>
        <td class="py-3 pr-3 max-w-[200px] truncate" title="${m.descripcion || ''}">${m.descripcion || '—'}</td>
        <td class="py-3 pr-3 text-xs">${formatDate(m.fechaRealizacion)}</td>
        <td class="py-3 pr-3 text-xs">${formatDate(m.proximaFechaVencimiento)}${alertIcon}</td>
        <td class="py-3 pr-3">${m.responsable || '—'}</td>
        <td class="py-3 pr-3">${formatCurrency(m.costo)}</td>
        <td class="py-3 pr-3"><span class="status-badge ${estadoClass}">${m.estado || '—'}</span></td>
        <td class="py-3 no-print">
          ${viewBtn}
          ${isAdmin() ? createActionButtons(`editMaintenance('${m.id}')`, `deleteMaintenance('${m.id}')`) : ''}
        </td>
      </tr>`;
  }).join('');
}

function applyFilters() {
  const search = (document.getElementById('search-mant').value || '').toLowerCase();
  const tipo = document.getElementById('filter-tipo-mant').value;
  const estado = document.getElementById('filter-estado-mant').value;

  let filtered = allMaintenance;
  if (search) {
    filtered = filtered.filter(m =>
      (m.descripcion || '').toLowerCase().includes(search) ||
      (m.vehiculoPatente || '').toLowerCase().includes(search) ||
      (m.herramientaCodigo || '').toLowerCase().includes(search) ||
      (m.responsable || '').toLowerCase().includes(search)
    );
  }
  if (tipo) filtered = filtered.filter(m => m.tipo === tipo);
  if (estado) filtered = filtered.filter(m => m.estado === estado);

  renderMaintenance(filtered);
}

function openMaintenanceModal(maintenanceId = null) {
  editingMaintenanceId = maintenanceId;
  document.getElementById('form-mantenimiento').reset();
  document.getElementById('mant-id').value = '';
  document.getElementById('modal-mant-title').textContent = 'Nuevo Mantenimiento';
  document.getElementById('m-fecha').value = new Date().toISOString().split('T')[0];

  if (maintenanceId) {
    const m = allMaintenance.find(x => x.id === maintenanceId);
    if (!m) return;
    document.getElementById('modal-mant-title').textContent = 'Editar Mantenimiento';
    document.getElementById('mant-id').value = maintenanceId;
    document.getElementById('m-tipo').value = m.tipo || 'Mecánico';

    if (m.vehiculoId) {
      document.getElementById('m-asociado-tipo').value = 'vehiculo';
      toggleAsociado();
      setTimeout(() => { document.getElementById('m-vehiculo').value = m.vehiculoId; }, 100);
    } else {
      document.getElementById('m-asociado-tipo').value = 'herramienta';
      toggleAsociado();
      setTimeout(() => { document.getElementById('m-herramienta').value = m.herramientaId; }, 100);
    }

    if (m.fechaRealizacion) {
      const d = m.fechaRealizacion.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion);
      document.getElementById('m-fecha').value = d.toISOString().split('T')[0];
    }
    if (m.proximaFechaVencimiento) {
      const d = m.proximaFechaVencimiento.toDate ? m.proximaFechaVencimiento.toDate() : new Date(m.proximaFechaVencimiento);
      document.getElementById('m-vencimiento').value = d.toISOString().split('T')[0];
    }
    document.getElementById('m-km').value = m.kilometrajeHoras || '';
    document.getElementById('m-costo').value = m.costo || '';
    document.getElementById('m-descripcion').value = m.descripcion || '';
    document.getElementById('m-responsable').value = m.responsable || '';
    document.getElementById('m-estado').value = m.estado || 'Pendiente';
    document.getElementById('m-comprobante').value = m.comprobanteURL || '';
  }

  showModal('modal-mantenimiento');
}

function closeMaintenanceModal() {
  hideModal('modal-mantenimiento');
  editingMaintenanceId = null;
}

async function saveMaintenance(e) {
  e.preventDefault();

  const id = document.getElementById('mant-id').value;
  const asociadoTipo = document.getElementById('m-asociado-tipo').value;
  const vehiculoId = asociadoTipo === 'vehiculo' ? document.getElementById('m-vehiculo').value : null;
  const herramientaId = asociadoTipo === 'herramienta' ? document.getElementById('m-herramienta').value : null;

  if (asociadoTipo === 'vehiculo' && !vehiculoId) { showToast('Seleccione un vehículo', 'error'); return; }
  if (asociadoTipo === 'herramienta' && !herramientaId) { showToast('Seleccione una herramienta', 'error'); return; }

  const vehiculo = vehiclesCache.find(v => v.id === vehiculoId);
  const herramienta = toolsCache.find(t => t.id === herramientaId);

  const data = {
    tipo: document.getElementById('m-tipo').value,
    vehiculoId: vehiculoId || null,
    herramientaId: herramientaId || null,
    vehiculoPatente: vehiculo?.patente || null,
    vehiculoInterno: vehiculo?.numeroInterno || null,
    herramientaCodigo: herramienta?.codigoInterno || null,
    herramientaNombre: herramienta?.nombre || null,
    fechaRealizacion: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('m-fecha').value)),
    proximaFechaVencimiento: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('m-vencimiento').value)),
    kilometrajeHoras: parseInt(document.getElementById('m-km').value) || null,
    descripcion: document.getElementById('m-descripcion').value.trim(),
    costo: parseFloat(document.getElementById('m-costo').value) || null,
    responsable: document.getElementById('m-responsable').value.trim(),
    estado: document.getElementById('m-estado').value,
    comprobanteURL: document.getElementById('m-comprobante').value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    showLoading(true);
    if (id) {
      await db.collection('maintenance').doc(id).update(data);
      showToast('Mantenimiento actualizado exitosamente');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('maintenance').add(data);
      showToast('Mantenimiento creado exitosamente');
    }
    closeMaintenanceModal();
  } catch (error) {
    showToast('Error al guardar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function editMaintenance(id) { openMaintenanceModal(id); }

async function deleteMaintenance(id) {
  if (!confirm('¿Estás seguro de eliminar este mantenimiento?')) return;
  try {
    showLoading(true);
    await db.collection('maintenance').doc(id).delete();
    showToast('Mantenimiento eliminado');
  } catch (error) {
    showToast('Error al eliminar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}
