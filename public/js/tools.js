let allTools = [];
let editingToolId = null;
let csvValidatedData = [];
let codigoSet = new Set();
let selectedIds = new Set();

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-herramienta')?.addEventListener('submit', saveTool);
  setupModalClose('modal-herramienta');
  setupModalClose('modal-csv-import');
  setupModalClose('modal-progress');
  document.getElementById('search-herramienta')?.addEventListener('input', applyFilters);
  document.getElementById('filter-estado-herramienta')?.addEventListener('change', applyFilters);
  document.getElementById('csv-file-input')?.addEventListener('change', validateCsvImport);
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
    codigoSet = new Set(allTools.map(t => (t.codigoInterno || '').toUpperCase()));
    renderTools(allTools);
  }, (error) => {
    console.error('Error loading tools:', error);
    const colCount = isAdmin() ? 9 : 8;
    document.getElementById('tools-table-body').innerHTML =
      `<tr><td colspan="${colCount}" class="text-center py-8 text-red-500">Error al cargar herramientas</td></tr>`;
  });
}

function fmap(t) {
  return {
    id: t.id,
    nombre: t.nombre || '',
    codigoInterno: t.codigoInterno || t.codigo || '',
    tipoHerramienta: t.tipoHerramienta || t.tipo || '',
    categoria: t.categoria || '',
    marca: t.marca || '',
    modelo: t.modelo || '',
    numeroSerie: t.numeroSerie || '',
    valorCompra: t.valorCompra || 0,
    fechaCompra: t.fechaCompra || null,
    proveedor: t.proveedor || '',
    garantiaVence: t.garantiaVence || null,
    estadoGeneral: t.estadoGeneral || t.estado || 'Bueno',
    ubicacionActual: t.ubicacionActual || t.ubicacion || '',
    responsableActual: t.responsableActual || '',
    fechaUltimoControl: t.fechaUltimoControl || null,
    proximoControl: t.proximoControl || null,
    tiempoUsoAcumulado: t.tiempoUsoAcumulado || 0,
    observaciones: t.observaciones || '',
    fotoURL: t.fotoURL || '',
    documentoURL: t.documentoURL || '',
    fechaAlta: t.fechaAlta || null
  };
}

function renderTools(tools) {
  const tbody = document.getElementById('tools-table-body');
  if (!tbody) return;

  const admin = isAdmin();
  const colCount = admin ? 9 : 8;

  if (tools.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center py-8 text-gray-400">No hay herramientas registradas</td></tr>`;
    return;
  }

  tbody.innerHTML = tools.map(t => {
    const mt = fmap(t);
    const tipoCategoria = mt.tipoHerramienta + (mt.categoria ? ` (${mt.categoria})` : '');
    const controlAlert = mt.proximoControl ? (() => {
      const days = daysUntil(mt.proximoControl);
      if (days <= 1) return ' 🔴';
      if (days <= 7) return ' 🟡';
      if (days <= 15) return ' 🔵';
      return '';
    })() : '';
    const estadoClass = (mt.estadoGeneral || '').toLowerCase().replace(/\s+/g, '');
    const checked = selectedIds.has(t.id) ? 'checked' : '';
    const checkboxCell = admin ? `<td class="py-3 pr-3" onclick="event.stopPropagation()">
      <input type="checkbox" class="row-checkbox accent-[#FF6B35]" value="${t.id}" ${checked} onchange="toggleRow('${t.id}', this.checked)">
    </td>` : '';
    return `
      <tr class="border-b border-white/5 hover:bg-[#FF6B35]/10 cursor-pointer" onclick="rowClick('${t.id}', event)">
        ${checkboxCell}
        <td class="py-3 pr-3 font-medium">${mt.codigoInterno || '—'}</td>
        <td class="py-3 pr-3">${mt.nombre || '—'}</td>
        <td class="py-3 pr-3 text-xs">${tipoCategoria}</td>
        <td class="py-3 pr-3"><span class="status-badge ${estadoClass}">${mt.estadoGeneral || '—'}</span></td>
        <td class="py-3 pr-3">${mt.ubicacionActual || '—'}</td>
        <td class="py-3 pr-3 text-xs">${formatDate(mt.fechaUltimoControl)}</td>
        <td class="py-3 pr-3 text-xs">${formatDate(mt.proximoControl)}${controlAlert}</td>
        <td class="py-3 no-print" onclick="event.stopPropagation()">${createActionButtons(`editTool('${t.id}')`, `deleteTool('${t.id}')`)}</td>
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
      (t.codigoInterno || '').toLowerCase().includes(search) ||
      (t.marca || '').toLowerCase().includes(search)
    );
  }
  if (estado) filtered = filtered.filter(t => (t.estadoGeneral || t.estado) === estado);

  renderTools(filtered);
}

function toggleImportMenu() {
  document.getElementById('import-menu')?.classList.toggle('hidden');
}

function openCsvImport() {
  document.getElementById('import-menu')?.classList.add('hidden');
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-import-preview').innerHTML = '';
  document.getElementById('btn-execute-csv').classList.add('hidden');
  csvValidatedData = [];
  showModal('modal-csv-import');
}

function closeCsvImport() {
  hideModal('modal-csv-import');
}

function downloadCsvTemplate() {
  const headers = ['codigoInterno','nombre','tipoHerramienta','categoria','marca','modelo','numeroSerie','valorCompra','fechaCompra','proveedor','garantiaVence','estadoGeneral','ubicacionActual','responsableActual','fechaUltimoControl','proximoControl','tiempoUsoAcumulado','observaciones'];
  const example = ['TAL-001','Taladro percutor','Taladro','Eléctrica','Bosch','GBH 2-26','123456789','45000','2024-01-15','Distribuidora XYZ','2025-01-15','Bueno','Depósito central','Juan Pérez','2024-06-01','2024-12-01','120','Sin observaciones'];
  const csv = [headers.join(','), example.join(',')].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'plantilla_herramientas.csv';
  link.click();
}

function parseFileData(rows, preview, file) {
  const valid = [];
  const errors = [];
  const existingCodigos = new Set(allTools.map(t => (t.codigoInterno || '').toUpperCase()));

  rows.forEach((row, i) => {
    const rowErrors = [];
    const codigoInterno = (row.codigoInterno || '').toString().trim().toUpperCase();
    const nombre = (row.nombre || '').toString().trim();
    const tipoHerramienta = (row.tipoHerramienta || '').toString().trim();
    const categoria = (row.categoria || '').toString().trim();

    if (!codigoInterno) rowErrors.push('codigoInterno requerido');
    if (!nombre) rowErrors.push('nombre requerido');
    if (!tipoHerramienta) rowErrors.push('tipoHerramienta requerido');

    if (codigoInterno && existingCodigos.has(codigoInterno)) rowErrors.push(`El código ${codigoInterno} ya existe`);
    if (codigoInterno && !existingCodigos.has(codigoInterno)) existingCodigos.add(codigoInterno);

    const valorCompra = parseFloat(row.valorCompra) || 0;
    const tiempoUso = parseInt(row.tiempoUsoAcumulado) || 0;

    if (rowErrors.length) {
      errors.push({ fila: i + 2, codigoInterno, errores: rowErrors });
    } else {
      valid.push({
        codigoInterno,
        nombre,
        tipoHerramienta,
        categoria,
        marca: (row.marca || '').toString().trim(),
        modelo: (row.modelo || '').toString().trim(),
        numeroSerie: (row.numeroSerie || '').toString().trim(),
        valorCompra,
        fechaCompra: row.fechaCompra || '',
        proveedor: (row.proveedor || '').toString().trim(),
        garantiaVence: row.garantiaVence || '',
        estadoGeneral: (row.estadoGeneral || 'Bueno').toString().trim(),
        ubicacionActual: (row.ubicacionActual || '').toString().trim(),
        responsableActual: (row.responsableActual || '').toString().trim(),
        fechaUltimoControl: row.fechaUltimoControl || '',
        proximoControl: row.proximoControl || '',
        tiempoUsoAcumulado: tiempoUso,
        observaciones: (row.observaciones || '').toString().trim()
      });
    }
  });

  let html = '';
  if (errors.length) {
    html += `<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400 mb-3"><strong>${errors.length} fila(s) con errores</strong></div>`;
    html += `<div class="max-h-40 overflow-y-auto mb-3 space-y-1">${errors.slice(0,20).map(e =>
      `<div class="text-xs text-red-400">Fila ${e.fila}: ${e.codigoInterno || '(sin código)'} — ${e.errores.join(', ')}</div>`
    ).join('')}</div>`;
  }

  if (valid.length) {
    csvValidatedData = valid;
    html += `<div class="p-3 bg-green-900/30 rounded-lg text-sm text-green-400 mb-3">
      <strong>${valid.length} herramienta(s) válida(s) listas para importar</strong>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead><tr class="text-left text-[#8E94A8] border-b border-white/10">${['Código','Nombre','Tipo','Estado','Ubicación'].map(h => `<th class="pb-2 pr-2">${h}</th>`).join('')}</tr></thead>
        <tbody>${valid.slice(0,20).map(t => `<tr class="border-b border-white/5">
          <td class="py-1.5 pr-2">${t.codigoInterno}</td>
          <td class="py-1.5 pr-2">${t.nombre}</td>
          <td class="py-1.5 pr-2">${t.tipoHerramienta}</td>
          <td class="py-1.5 pr-2">${t.estadoGeneral}</td>
          <td class="py-1.5 pr-2">${t.ubicacionActual || '—'}</td>
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
  const fileInput = document.getElementById('csv-file-input');
  const preview = document.getElementById('csv-import-preview');
  const file = fileInput?.files?.[0];
  if (!file) { preview.innerHTML = '<div class="p-3 bg-yellow-900/30 rounded-lg text-sm text-yellow-400">Seleccioná un archivo CSV o Excel</div>'; return; }

  preview.innerHTML = '<div class="text-sm text-[#8E94A8]">Analizando archivo...</div>';
  document.getElementById('btn-execute-csv').classList.add('hidden');
  csvValidatedData = [];

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          if (results.errors?.length) {
            preview.innerHTML = `<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400">Error al leer CSV: ${results.errors[0].message}</div>`;
            return;
          }
          parseFileData(results.data, preview, file);
        } catch (callbackErr) {
          preview.innerHTML = `<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400">Error al procesar: ${callbackErr.message}</div>`;
        }
      }
    });
  } else if (['xlsx', 'xls'].includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        parseFileData(rows, preview, file);
      } catch (err) {
        preview.innerHTML = `<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400">Error al leer Excel: ${err.message}</div>`;
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    preview.innerHTML = '<div class="p-3 bg-red-900/30 rounded-lg text-sm text-red-400">Formato no soportado. Usá archivos .csv, .xlsx o .xls</div>';
  }
}

async function executeCsvImport() {
  if (!csvValidatedData.length) return;
  showModal('modal-progress');
  document.getElementById('btn-progress-close')?.classList.add('hidden');
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  const detail = document.getElementById('progress-detail');

  const BATCH_SIZE = 500;
  let imported = 0;
  const total = csvValidatedData.length;

  try {
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = csvValidatedData.slice(i, i + BATCH_SIZE);
      chunk.forEach(t => {
        const doc = db.collection('tools').doc();
        batch.set(doc, {
          ...t,
          fechaCompra: t.fechaCompra ? firebase.firestore.Timestamp.fromDate(new Date(t.fechaCompra + 'T12:00:00')) : null,
          garantiaVence: t.garantiaVence ? firebase.firestore.Timestamp.fromDate(new Date(t.garantiaVence + 'T12:00:00')) : null,
          fechaUltimoControl: t.fechaUltimoControl ? firebase.firestore.Timestamp.fromDate(new Date(t.fechaUltimoControl + 'T12:00:00')) : null,
          proximoControl: t.proximoControl ? firebase.firestore.Timestamp.fromDate(new Date(t.proximoControl + 'T12:00:00')) : null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      imported += chunk.length;
      const pct = Math.round((imported / total) * 100);
      bar.style.width = pct + '%';
      text.textContent = `Importando... ${pct}%`;
      detail.textContent = `${imported} de ${total} herramientas`;
    }
    bar.style.width = '100%';
    text.textContent = '¡Importación completada!';
    detail.textContent = `${total} herramientas importadas exitosamente`;
    showToast(`${total} herramienta(s) importadas exitosamente`);
  } catch (e) {
    text.textContent = 'Error durante la importación';
    detail.textContent = e.message;
    showToast('Error al importar: ' + e.message, 'error');
  }

  document.getElementById('btn-progress-close')?.classList.remove('hidden');
  csvValidatedData = [];
}

function openToolModal(toolId = null) {
  if (!isAdmin()) return;
  editingToolId = toolId;
  document.getElementById('form-herramienta').reset();
  document.getElementById('herramienta-id').value = '';
  document.getElementById('modal-herramienta-title').textContent = 'Nueva Herramienta';
  document.getElementById('h-documentoURL-container')?.classList.add('hidden');

  if (toolId) {
    const t = allTools.find(x => x.id === toolId);
    if (!t) return;
    const mt = fmap(t);
    document.getElementById('modal-herramienta-title').textContent = 'Editar Herramienta';
    document.getElementById('herramienta-id').value = toolId;
    document.getElementById('h-nombre').value = mt.nombre;
    document.getElementById('h-codigo').value = mt.codigoInterno;
    document.getElementById('h-tipoHerramienta').value = mt.tipoHerramienta;
    document.getElementById('h-categoria').value = mt.categoria;
    document.getElementById('h-marca').value = mt.marca;
    document.getElementById('h-modelo').value = mt.modelo;
    document.getElementById('h-numeroSerie').value = mt.numeroSerie;
    document.getElementById('h-valorCompra').value = mt.valorCompra || '';
    document.getElementById('h-proveedor').value = mt.proveedor;
    if (mt.fechaCompra) {
      const d = mt.fechaCompra.toDate ? mt.fechaCompra.toDate() : new Date(mt.fechaCompra);
      document.getElementById('h-fechaCompra').value = d.toISOString().split('T')[0];
    }
    if (mt.garantiaVence) {
      const d = mt.garantiaVence.toDate ? mt.garantiaVence.toDate() : new Date(mt.garantiaVence);
      document.getElementById('h-garantiaVence').value = d.toISOString().split('T')[0];
    }
    document.getElementById('h-estadoGeneral').value = mt.estadoGeneral;
    document.getElementById('h-ubicacionActual').value = mt.ubicacionActual;
    document.getElementById('h-responsableActual').value = mt.responsableActual;
    if (mt.fechaUltimoControl) {
      const d = mt.fechaUltimoControl.toDate ? mt.fechaUltimoControl.toDate() : new Date(mt.fechaUltimoControl);
      document.getElementById('h-fechaUltimoControl').value = d.toISOString().split('T')[0];
    }
    if (mt.proximoControl) {
      const d = mt.proximoControl.toDate ? mt.proximoControl.toDate() : new Date(mt.proximoControl);
      document.getElementById('h-proximoControl').value = d.toISOString().split('T')[0];
    }
    document.getElementById('h-tiempoUso').value = mt.tiempoUsoAcumulado || '';
    document.getElementById('h-observaciones').value = mt.observaciones;
    document.getElementById('h-fotoURL').value = mt.fotoURL;
    document.getElementById('h-documentoURL').value = mt.documentoURL;
  } else {
    document.getElementById('h-tipoHerramienta').value = '';
    document.getElementById('h-categoria').value = '';
    document.getElementById('h-estadoGeneral').value = 'Bueno';
    document.getElementById('h-ubicacionActual').value = '';
  }

  showModal('modal-herramienta');
}

function closeToolModal() {
  hideModal('modal-herramienta');
  editingToolId = null;
}

function getToolFormData() {
  return {
    nombre: document.getElementById('h-nombre').value.trim(),
    codigoInterno: document.getElementById('h-codigo').value.trim().toUpperCase(),
    tipoHerramienta: document.getElementById('h-tipoHerramienta').value,
    categoria: document.getElementById('h-categoria').value,
    marca: document.getElementById('h-marca').value.trim(),
    modelo: document.getElementById('h-modelo').value.trim(),
    numeroSerie: document.getElementById('h-numeroSerie').value.trim(),
    valorCompra: parseFloat(document.getElementById('h-valorCompra').value) || 0,
    fechaCompra: document.getElementById('h-fechaCompra').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('h-fechaCompra').value + 'T12:00:00'))
      : null,
    proveedor: document.getElementById('h-proveedor').value.trim(),
    garantiaVence: document.getElementById('h-garantiaVence').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('h-garantiaVence').value + 'T12:00:00'))
      : null,
    estadoGeneral: document.getElementById('h-estadoGeneral').value,
    ubicacionActual: document.getElementById('h-ubicacionActual').value,
    responsableActual: document.getElementById('h-responsableActual').value.trim(),
    fechaUltimoControl: document.getElementById('h-fechaUltimoControl').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('h-fechaUltimoControl').value + 'T12:00:00'))
      : null,
    proximoControl: document.getElementById('h-proximoControl').value
      ? firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('h-proximoControl').value + 'T12:00:00'))
      : null,
    tiempoUsoAcumulado: parseInt(document.getElementById('h-tiempoUso').value) || 0,
    observaciones: document.getElementById('h-observaciones').value.trim(),
    fotoURL: document.getElementById('h-fotoURL').value.trim(),
    documentoURL: document.getElementById('h-documentoURL').value.trim()
  };
}

async function saveTool(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const id = document.getElementById('herramienta-id').value;
  const data = getToolFormData();

  if (!data.nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  if (!data.codigoInterno) { showToast('El código interno es obligatorio', 'error'); return; }
  if (!data.tipoHerramienta) { showToast('El tipo de herramienta es obligatorio', 'error'); return; }
  if (!data.estadoGeneral) { showToast('El estado es obligatorio', 'error'); return; }
  if (!data.ubicacionActual) { showToast('La ubicación es obligatoria', 'error'); return; }

  const isDuplicate = allTools.some(t =>
    t.id !== id && (t.codigoInterno || '').toUpperCase() === data.codigoInterno
  );
  if (isDuplicate) { showToast(`El código ${data.codigoInterno} ya existe`, 'error'); return; }

  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

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

function closeProgressModal() {
  hideModal('modal-progress');
  document.getElementById('btn-progress-close')?.classList.add('hidden');
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-detail').textContent = '';
}

function rowClick(id, event) {
  if (event.target.type === 'checkbox') return;
  openToolModal(id);
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

function deleteSelectedTools() {
  if (!selectedIds.size) return;
  const ids = [...selectedIds];
  deleteMultipleWithBackup('tools', ids, 'Herramienta').then(() => {
    selectedIds.clear();
    document.getElementById('select-all').checked = false;
    updateBulkBar();
  });
}

async function deleteTool(id) {
  await deleteWithBackup('tools', id, 'Herramienta');
}
