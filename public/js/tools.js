let allTools = [];
let editingToolId = null;

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-herramienta')?.addEventListener('submit', saveTool);
  setupModalClose('modal-herramienta');
  document.getElementById('search-herramienta')?.addEventListener('input', applyFilters);
  document.getElementById('filter-estado-herramienta')?.addEventListener('change', applyFilters);
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
  db.collection('tools').orderBy('codigoInterno').onSnapshot((snapshot) => {
    allTools = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTools(allTools);
  }, (error) => {
    console.error('Error loading tools:', error);
    document.getElementById('tools-table-body').innerHTML =
      '<tr><td colspan="8" class="text-center py-8 text-red-500">Error al cargar herramientas</td></tr>';
  });
}

function renderTools(tools) {
  const tbody = document.getElementById('tools-table-body');
  if (!tbody) return;

  if (tools.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-400">No hay herramientas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = tools.map(t => {
    const controlAlert = t.proximoControl ? (() => {
      const days = daysUntil(t.proximoControl);
      if (days <= 1) return ' 🔴';
      if (days <= 7) return ' 🟡';
      if (days <= 15) return ' 🔵';
      return '';
    })() : '';
    const estadoClass = (t.estado || '').toLowerCase().replace(/\s+/g, '');
    return `
      <tr class="border-b border-white/5 hover:bg-[#FF6B35]/10">
        <td class="py-3 pr-3 font-medium">${t.codigoInterno || '—'}</td>
        <td class="py-3 pr-3">${t.nombre || '—'}</td>
        <td class="py-3 pr-3">${t.tipo || '—'}</td>
        <td class="py-3 pr-3"><span class="status-badge ${estadoClass}">${t.estado || '—'}</span></td>
        <td class="py-3 pr-3">${t.ubicacion || '—'}</td>
        <td class="py-3 pr-3 text-xs">${formatDate(t.fechaUltimoControl)}</td>
        <td class="py-3 pr-3 text-xs">${formatDate(t.proximoControl)}${controlAlert}</td>
        <td class="py-3 no-print">${isAdmin() ? createActionButtons(`editTool('${t.id}')`, `deleteTool('${t.id}')`) : '—'}</td>
      </tr>`;
  }).join('');
}

function applyFilters() {
  const search = (document.getElementById('search-herramienta').value || '').toLowerCase();
  const estado = document.getElementById('filter-estado-herramienta').value;

  let filtered = allTools;
  if (search) {
    filtered = filtered.filter(t =>
      (t.nombre || '').toLowerCase().includes(search) ||
      (t.codigoInterno || '').toLowerCase().includes(search)
    );
  }
  if (estado) filtered = filtered.filter(t => t.estado === estado);

  renderTools(filtered);
}

function openToolModal(toolId = null) {
  if (!isAdmin()) return;
  editingToolId = toolId;
  document.getElementById('form-herramienta').reset();
  document.getElementById('herramienta-id').value = '';
  document.getElementById('modal-herramienta-title').textContent = 'Nueva Herramienta';

  if (toolId) {
    const t = allTools.find(x => x.id === toolId);
    if (!t) return;
    document.getElementById('modal-herramienta-title').textContent = 'Editar Herramienta';
    document.getElementById('herramienta-id').value = toolId;
    document.getElementById('h-nombre').value = t.nombre || '';
    document.getElementById('h-codigo').value = t.codigoInterno || '';
    document.getElementById('h-tipo').value = t.tipo || '';
    document.getElementById('h-estado').value = t.estado || 'Bueno';
    document.getElementById('h-ubicacion').value = t.ubicacion || 'Taller';
    if (t.fechaUltimoControl) {
      const d = t.fechaUltimoControl.toDate ? t.fechaUltimoControl.toDate() : new Date(t.fechaUltimoControl);
      document.getElementById('h-ult-control').value = d.toISOString().split('T')[0];
    }
    if (t.proximoControl) {
      const d = t.proximoControl.toDate ? t.proximoControl.toDate() : new Date(t.proximoControl);
      document.getElementById('h-prox-control').value = d.toISOString().split('T')[0];
    }
  }

  showModal('modal-herramienta');
}

function closeToolModal() {
  hideModal('modal-herramienta');
  editingToolId = null;
}

async function saveTool(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const id = document.getElementById('herramienta-id').value;
  const data = {
    nombre: document.getElementById('h-nombre').value.trim(),
    codigoInterno: document.getElementById('h-codigo').value.trim().toUpperCase(),
    tipo: document.getElementById('h-tipo').value,
    estado: document.getElementById('h-estado').value,
    ubicacion: document.getElementById('h-ubicacion').value,
    fechaUltimoControl: document.getElementById('h-ult-control').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('h-ult-control').value))
      : null,
    proximoControl: document.getElementById('h-prox-control').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('h-prox-control').value))
      : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    showLoading(true);
    if (id) {
      await db.collection('tools').doc(id).update(data);
      showToast('Herramienta actualizada exitosamente');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('tools').add(data);
      showToast('Herramienta creada exitosamente');
    }
    closeToolModal();
  } catch (error) {
    showToast('Error al guardar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function editTool(id) { openToolModal(id); }

async function deleteTool(id) {
  if (!isAdmin()) return;
  if (!confirm('¿Estás seguro de eliminar esta herramienta?')) return;
  try {
    showLoading(true);
    await db.collection('tools').doc(id).delete();
    showToast('Herramienta eliminada');
  } catch (error) {
    showToast('Error al eliminar: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}
