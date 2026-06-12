let allVehicles = [];
let editingVehicleId = null;

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-vehiculo')?.addEventListener('submit', saveVehicle);
  setupModalClose('modal-vehiculo');
  document.getElementById('search-vehiculo')?.addEventListener('input', applyFilters);
  document.getElementById('filter-estado')?.addEventListener('change', applyFilters);
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

function initRealtimeListener() {
  db.collection('vehicles').orderBy('numeroInterno').onSnapshot((snapshot) => {
    allVehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderVehicles(allVehicles);
  }, (error) => {
    console.error('Error loading vehicles:', error);
    document.getElementById('vehiculos-table-body').innerHTML =
      '<tr><td colspan="8" class="text-center py-8 text-red-500">Error al cargar vehículos</td></tr>';
  });
}

function renderVehicles(vehicles) {
  const tbody = document.getElementById('vehiculos-table-body');
  if (!tbody) return;

  if (vehicles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-400">No hay vehículos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = vehicles.map(v => {
    const serviceInfo = v.proximoServiceKm
      ? `${v.proximoServiceKm?.toLocaleString() || ''} km`
      : v.proximoServiceFecha ? formatDate(v.proximoServiceFecha) : '—';
    const estadoClass = (v.estado || '').toLowerCase().replace(/\s+/g, '');
    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 pr-3">${v.numeroInterno || '—'}</td>
        <td class="py-3 pr-3 font-medium">${v.patente || '—'}</td>
        <td class="py-3 pr-3">${v.marca || ''} ${v.modelo || ''}</td>
        <td class="py-3 pr-3">${v.tipo || '—'}</td>
        <td class="py-3 pr-3">${v.kilometraje?.toLocaleString() || '—'}</td>
        <td class="py-3 pr-3"><span class="status-badge ${estadoClass}">${v.estado || '—'}</span></td>
        <td class="py-3 pr-3 text-xs">${serviceInfo}</td>
        <td class="py-3 no-print">${isAdmin() ? createActionButtons(`editVehicle('${v.id}')`, `deleteVehicle('${v.id}')`) : '—'}</td>
      </tr>`;
  }).join('');
}

function applyFilters() {
  const search = (document.getElementById('search-vehiculo').value || '').toLowerCase();
  const estado = document.getElementById('filter-estado').value;

  let filtered = allVehicles;
  if (search) {
    filtered = filtered.filter(v =>
      (v.patente || '').toLowerCase().includes(search) ||
      (v.marca || '').toLowerCase().includes(search) ||
      (v.modelo || '').toLowerCase().includes(search) ||
      (v.numeroInterno || '').toLowerCase().includes(search)
    );
  }
  if (estado) filtered = filtered.filter(v => v.estado === estado);

  renderVehicles(filtered);
}

function openVehicleModal(vehicleId = null) {
  if (!isAdmin()) return;
  editingVehicleId = vehicleId;
  document.getElementById('form-vehiculo').reset();
  document.getElementById('vehiculo-id').value = '';
  document.getElementById('modal-vehiculo-title').textContent = 'Nuevo Vehículo';

  if (vehicleId) {
    const v = allVehicles.find(x => x.id === vehicleId);
    if (!v) return;
    document.getElementById('modal-vehiculo-title').textContent = 'Editar Vehículo';
    document.getElementById('vehiculo-id').value = vehicleId;
    document.getElementById('v-patente').value = v.patente || '';
    document.getElementById('v-interno').value = v.numeroInterno || '';
    document.getElementById('v-marca').value = v.marca || '';
    document.getElementById('v-modelo').value = v.modelo || '';
    document.getElementById('v-anio').value = v.anio || '';
    document.getElementById('v-tipo').value = v.tipo || '';
    document.getElementById('v-km').value = v.kilometraje || '';
    document.getElementById('v-estado').value = v.estado || 'Activo';
    document.getElementById('v-prox-km').value = v.proximoServiceKm || '';
    if (v.proximoServiceFecha) {
      const d = v.proximoServiceFecha.toDate ? v.proximoServiceFecha.toDate() : new Date(v.proximoServiceFecha);
      document.getElementById('v-prox-fecha').value = d.toISOString().split('T')[0];
    }
    document.getElementById('v-foto').value = v.fotoURL || '';
  }

  showModal('modal-vehiculo');
}

function closeVehicleModal() {
  hideModal('modal-vehiculo');
  editingVehicleId = null;
}

async function saveVehicle(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const id = document.getElementById('vehiculo-id').value;
  const data = {
    patente: document.getElementById('v-patente').value.trim().toUpperCase(),
    numeroInterno: document.getElementById('v-interno').value.trim(),
    marca: document.getElementById('v-marca').value.trim(),
    modelo: document.getElementById('v-modelo').value.trim(),
    anio: parseInt(document.getElementById('v-anio').value) || null,
    tipo: document.getElementById('v-tipo').value,
    kilometraje: parseInt(document.getElementById('v-km').value) || 0,
    estado: document.getElementById('v-estado').value,
    proximoServiceKm: parseInt(document.getElementById('v-prox-km').value) || null,
    proximoServiceFecha: document.getElementById('v-prox-fecha').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('v-prox-fecha').value))
      : null,
    fotoURL: document.getElementById('v-foto').value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    showLoading(true);
    if (id) {
      await db.collection('vehicles').doc(id).update(data);
      showToast('Vehículo actualizado exitosamente');
    } else {
      data.fechaAlta = firebase.firestore.FieldValue.serverTimestamp();
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      // Check for duplicate patente
      const dup = await db.collection('vehicles').where('patente', '==', data.patente).get();
      if (!dup.empty) {
        showToast('Ya existe un vehículo con esa patente', 'error');
        return;
      }
      await db.collection('vehicles').add(data);
      showToast('Vehículo creado exitosamente');
    }
    closeVehicleModal();
  } catch (error) {
    showToast('Error al guardar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function editVehicle(id) { openVehicleModal(id); }

async function deleteVehicle(id) {
  if (!isAdmin()) return;
  if (!confirm('¿Estás seguro de eliminar este vehículo?')) return;
  try {
    showLoading(true);
    await db.collection('vehicles').doc(id).delete();
    showToast('Vehículo eliminado');
  } catch (error) {
    showToast('Error al eliminar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}
