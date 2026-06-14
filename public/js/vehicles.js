let allVehicles = [];
let editingVehicleId = null;
let importMenuOpen = false;
let jsonValidatedData = [];
let csvValidatedData = [];
let patenteSet = new Set();

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-vehiculo')?.addEventListener('submit', saveVehicle);
  setupModalClose('modal-vehiculo');
  setupModalClose('modal-json-import');
  setupModalClose('modal-csv-import');
  setupModalClose('modal-progress');
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
  const unsub = db.collection('vehicles').orderBy('interno').onSnapshot((snapshot) => {
    allVehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    patenteSet = new Set(allVehicles.map(v => (v.patente || '').toUpperCase()));
    renderVehicles(allVehicles);
  }, (error) => {
    console.error('Error loading vehicles:', error);
    document.getElementById('vehiculos-table-body').innerHTML =
      '<tr><td colspan="9" class="text-center py-8 text-red-500">Error al cargar vehículos</td></tr>';
  });
}

function fmap(v) {
  return {
    id: v.id,
    patente: v.patente || '',
    interno: v.interno || v.numeroInterno || '',
    tipo: v.tipo || '',
    marca: v.marca || '',
    modelo: v.modelo || '',
    año: v.año || v.anio || '',
    chasis: v.chasis || '',
    kilometraje: v.kilometraje || 0,
    horometro: v.horometro || 0,
    estadoGeneral: v.estadoGeneral || v.estado || 'Bueno',
    fechaUltimaRevision: v.fechaUltimaRevision || null,
    vencimientoVTV: v.vencimientoVTV || null,
    seguro: v.seguro || { compañía: '', poliza: '', fechaVencimiento: null },
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
  const tbody = document.getElementById('vehiculos-table-body');
  if (!tbody) return;

  if (vehicles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-gray-400">No hay vehículos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = vehicles.map(v => {
    const mv = fmap(v);
    const serviceInfo = mv.proximoServiceKm
      ? `${mv.proximoServiceKm?.toLocaleString() || ''} km`
      : mv.proximoServiceFecha ? formatDate(mv.proximoServiceFecha) : '—';
    const estadoClass = (mv.estadoGeneral || '').toLowerCase().replace(/\s+/g, '');
    const kmHs = mv.horometro ? `${mv.kilometraje?.toLocaleString() || '—'} km / ${mv.horometro} hs` : `${mv.kilometraje?.toLocaleString() || '—'} km`;
    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 pr-3">${mv.interno || '—'}</td>
        <td class="py-3 pr-3 font-medium">${mv.patente || '—'}</td>
        <td class="py-3 pr-3">${mv.marca || ''} ${mv.modelo || ''}</td>
        <td class="py-3 pr-3">${mv.tipo || '—'}</td>
        <td class="py-3 pr-3 text-xs">${kmHs}</td>
        <td class="py-3 pr-3"><span class="status-badge ${estadoClass}">${mv.estadoGeneral || '—'}</span></td>
        <td class="py-3 pr-3 text-xs">${mv.centroTrabajo || '—'}</td>
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
      (v.interno || v.numeroInterno || '').toLowerCase().includes(search)
    );
  }
  if (estado) filtered = filtered.filter(v => (v.estadoGeneral || v.estado) === estado);

  renderVehicles(filtered);
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
    document.getElementById('v-marca').value = v.marca;
    document.getElementById('v-modelo').value = v.modelo;
    document.getElementById('v-anio').value = v.año;
    document.getElementById('v-chasis').value = v.chasis;
    document.getElementById('v-tipo').value = v.tipo;
    document.getElementById('v-kilometraje').value = v.kilometraje;
    document.getElementById('v-horometro').value = v.horometro;
    document.getElementById('v-estadoGeneral').value = v.estadoGeneral;
    setDateField('v-fechaUltimaRevision', v.fechaUltimaRevision);
    setDateField('v-vencimientoVTV', v.vencimientoVTV);
    document.getElementById('v-seguroCompania').value = v.seguro?.compañía || '';
    document.getElementById('v-seguroPoliza').value = v.seguro?.poliza || '';
    setDateField('v-seguroVencimiento', v.seguro?.fechaVencimiento || null);
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
  const data = {
    patente: document.getElementById('v-patente').value.trim().toUpperCase(),
    interno: document.getElementById('v-interno').value.trim(),
    marca: document.getElementById('v-marca').value.trim(),
    modelo: document.getElementById('v-modelo').value.trim(),
    año: parseInt(document.getElementById('v-anio').value) || null,
    chasis: document.getElementById('v-chasis').value.trim() || '',
    tipo: document.getElementById('v-tipo').value,
    kilometraje: parseInt(document.getElementById('v-kilometraje').value) || 0,
    horometro: parseInt(document.getElementById('v-horometro').value) || 0,
    estadoGeneral: document.getElementById('v-estadoGeneral').value,
    fechaUltimaRevision: getDateValue('v-fechaUltimaRevision'),
    vencimientoVTV: getDateValue('v-vencimientoVTV'),
    seguro: {
      compañía: document.getElementById('v-seguroCompania').value.trim() || '',
      poliza: document.getElementById('v-seguroPoliza').value.trim() || '',
      fechaVencimiento: getDateValue('v-seguroVencimiento')
    },
    proximoServiceKm: parseInt(document.getElementById('v-proximoServiceKm').value) || null,
    proximoServiceFecha: getDateValue('v-proximoServiceFecha'),
    centroTrabajo: document.getElementById('v-centroTrabajo').value,
    conductorHabitual: document.getElementById('v-conductorHabitual').value.trim() || '',
    observaciones: document.getElementById('v-observaciones').value.trim() || '',
    fotoURL: document.getElementById('v-foto').value.trim() || '',
    multas: collectMultas(),
    documentos: collectDocumentos(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!data.patente || !data.interno || !data.marca || !data.tipo) {
    showToast('Completá los campos obligatorios: Patente, Interno, Marca y Tipo', 'error');
    return;
  }

  try {
    showLoading(true);
    if (id) {
      await db.collection('vehicles').doc(id).update(data);
      showToast('Vehículo actualizado exitosamente');
    } else {
      const dup = await db.collection('vehicles').where('patente', '==', data.patente).get();
      if (!dup.empty) {
        showToast('Ya existe un vehículo con esa patente', 'error');
        return;
      }
      data.fechaAlta = firebase.firestore.FieldValue.serverTimestamp();
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
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

function addMultaRow(multa) {
  const container = document.getElementById('multas-container');
  const emptyMsg = container.querySelector('.italic');
  if (emptyMsg) emptyMsg.remove();

  const row = document.createElement('div');
  row.className = 'multa-row flex flex-wrap items-end gap-2 p-2 bg-red-50 rounded-lg';
  row.innerHTML = `
    <div class="flex-1 min-w-[120px]">
      <label class="block text-xs text-gray-500 mb-1">Fecha</label>
      <input type="date" class="multa-fecha w-full px-2 py-1.5 border border-gray-300 rounded text-sm" value="${multa?.fecha || ''}">
    </div>
    <div class="w-28">
      <label class="block text-xs text-gray-500 mb-1">Importe ($)</label>
      <input type="number" class="multa-importe w-full px-2 py-1.5 border border-gray-300 rounded text-sm" value="${multa?.importe || ''}" step="0.01">
    </div>
    <div class="flex-[2] min-w-[150px]">
      <label class="block text-xs text-gray-500 mb-1">Concepto</label>
      <input type="text" class="multa-concepto w-full px-2 py-1.5 border border-gray-300 rounded text-sm" value="${multa?.concepto || ''}" placeholder="Exceso de velocidad">
    </div>
    <div class="flex items-center gap-1 pb-1.5">
      <input type="checkbox" class="multa-pagado" ${multa?.pagado ? 'checked' : ''}>
      <label class="text-xs text-gray-500">Pagado</label>
    </div>
    <button type="button" onclick="this.closest('.multa-row').remove()" class="pb-1.5 text-red-500 hover:text-red-700">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>`;

  container.appendChild(row);
}

function addDocumentoRow(doc) {
  const container = document.getElementById('documentos-container');
  const emptyMsg = container.querySelector('.italic');
  if (emptyMsg) emptyMsg.remove();

  const row = document.createElement('div');
  row.className = 'documento-row flex flex-wrap items-end gap-2 p-2 bg-teal-50 rounded-lg';
  row.innerHTML = `
    <div class="flex-1 min-w-[120px]">
      <label class="block text-xs text-gray-500 mb-1">Tipo</label>
      <select class="doc-tipo w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
        <option value="">Seleccionar...</option>
        <option value="VTV" ${doc?.tipo === 'VTV' ? 'selected' : ''}>VTV</option>
        <option value="Cédula" ${doc?.tipo === 'Cédula' ? 'selected' : ''}>Cédula</option>
        <option value="Seguro" ${doc?.tipo === 'Seguro' ? 'selected' : ''}>Seguro</option>
        <option value="Habilitación" ${doc?.tipo === 'Habilitación' ? 'selected' : ''}>Habilitación</option>
        <option value="Otro" ${doc?.tipo === 'Otro' ? 'selected' : ''}>Otro</option>
      </select>
    </div>
    <div class="w-36">
      <label class="block text-xs text-gray-500 mb-1">Vencimiento</label>
      <input type="date" class="doc-fecha w-full px-2 py-1.5 border border-gray-300 rounded text-sm" value="${doc?.fechaVencimiento || ''}">
    </div>
    <div class="flex-[2] min-w-[180px]">
      <label class="block text-xs text-gray-500 mb-1">Archivo URL</label>
      <input type="url" class="doc-url w-full px-2 py-1.5 border border-gray-300 rounded text-sm" value="${doc?.archivoURL || ''}" placeholder="https://storage.googleapis.com/...">
    </div>
    <button type="button" onclick="this.closest('.documento-row').remove()" class="pb-1.5 text-red-500 hover:text-red-700">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>`;

  container.appendChild(row);
}

function toggleImportMenu() {
  importMenuOpen = !importMenuOpen;
  document.getElementById('import-menu').classList.toggle('hidden', !importMenuOpen);
}

document.addEventListener('click', (e) => {
  if (importMenuOpen && !e.target.closest('#import-dropdown')) {
    importMenuOpen = false;
    document.getElementById('import-menu')?.classList.add('hidden');
  }
});

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

/* ───────── JSON Import ───────── */

function openJsonImport() {
  importMenuOpen = false;
  document.getElementById('import-menu')?.classList.add('hidden');
  jsonValidatedData = [];
  document.getElementById('json-import-textarea').value = '';
  document.getElementById('json-import-preview').innerHTML = '';
  document.getElementById('btn-execute-json').classList.add('hidden');
  showModal('modal-json-import');
}

function closeJsonImport() {
  hideModal('modal-json-import');
}

function validateJsonImport() {
  const text = document.getElementById('json-import-textarea').value.trim();
  if (!text) { showToast('Pegá el JSON primero', 'error'); return; }

  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { showToast('JSON inválido: ' + e.message, 'error'); return; }
  if (!Array.isArray(parsed)) { showToast('Debe ser un array de vehículos', 'error'); return; }
  if (!parsed.length) { showToast('El array está vacío', 'error'); return; }

  const errors = [];
  const valid = [];
  const seen = new Set();

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const idx = i + 1;
    const rowErrors = [];

    if (!item.patente || !item.patente.trim()) rowErrors.push('patente requerida');
    if (!item.interno || !item.interno.trim()) rowErrors.push('interno requerido');
    if (!item.marca || !item.marca.trim()) rowErrors.push('marca requerida');
    if (!item.tipo || !item.tipo.trim()) rowErrors.push('tipo requerido');

    const pat = (item.patente || '').trim().toUpperCase();
    if (pat && (patenteSet.has(pat) || seen.has(pat))) {
      rowErrors.push('patente duplicada');
    }
    if (pat) seen.add(pat);

    if (rowErrors.length) {
      errors.push({ fila: idx, patente: item.patente || '(sin patente)', errores: rowErrors.join(', ') });
    } else {
      valid.push(item);
    }
  }

  const preview = document.getElementById('json-import-preview');
  if (errors.length) {
    preview.innerHTML = `<div class="p-3 bg-red-50 rounded-lg text-sm text-red-700 mb-3">
      <strong>${errors.length} error(es):</strong>
      <ul class="mt-1 list-disc pl-4">${errors.map(e => `<li>Fila ${e.fila} (${e.patente}): ${e.errores}</li>`).join('')}</ul>
    </div>`;
  }

  if (valid.length) {
    jsonValidatedData = valid;
    preview.innerHTML += `<div class="p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-3">
      <strong>${valid.length} vehículo(s) válido(s) listos para importar</strong>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead><tr class="text-left text-gray-500 border-b">${['Patente','Interno','Marca','Modelo','Tipo'].map(h => `<th class="pb-2 pr-2">${h}</th>`).join('')}</tr></thead>
        <tbody>${valid.slice(0,20).map(v => `<tr class="border-b border-gray-100">
          <td class="py-1.5 pr-2">${v.patente}</td>
          <td class="py-1.5 pr-2">${v.interno}</td>
          <td class="py-1.5 pr-2">${v.marca}</td>
          <td class="py-1.5 pr-2">${v.modelo || ''}</td>
          <td class="py-1.5 pr-2">${v.tipo}</td>
        </tr>`).join('')}${valid.length > 20 ? `<tr><td colspan="5" class="py-2 text-gray-400">... y ${valid.length - 20} más</td></tr>` : ''}</tbody>
      </table>
    </div>`;
    document.getElementById('btn-execute-json').classList.remove('hidden');
  } else {
    document.getElementById('btn-execute-json').classList.add('hidden');
  }
}

async function executeJsonImport() {
  if (!jsonValidatedData.length) return;
  const items = jsonValidatedData.map(mapJsonItem);
  await batchImport(items, 'json');
  jsonValidatedData = [];
  document.getElementById('btn-execute-json').classList.add('hidden');
  document.getElementById('json-import-preview').innerHTML = '';
  closeJsonImport();
}

/* ───────── CSV Import ───────── */

function openCsvImport() {
  importMenuOpen = false;
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
  const headers = ['patente','interno','tipo','marca','modelo','año','chasis','kilometraje','horometro','estadoGeneral','fechaUltimaRevision','vencimientoVTV','seguroCompania','seguroPoliza','seguroVencimiento','proximoServiceKm','proximoServiceFecha','conductorHabitual','centroTrabajo','observaciones'];
  const sample = ['ABC123','001','Camión volcador','Mercedes Benz','Atego 1718','2022','9BM1234567890ABC','158000','4500','Bueno','2026-04-10','2026-08-31','Rivadavia Seguros','POL-2024-12345','2026-09-30','160000','2026-07-15','Juan Pérez','Cantera Los Ángeles','Último cambio de cubiertas a los 140.000 km'];
  const BOM = '\uFEFF';
  const csv = BOM + headers.join(',') + '\n' + sample.join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'plantilla_vehiculos.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function validateCsvImport() {
  const fileInput = document.getElementById('csv-file-input');
  if (!fileInput.files.length) { showToast('Seleccioná un archivo CSV', 'error'); return; }

  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    complete: function(results) {
      if (results.errors.length) {
        showToast('Error al leer CSV: ' + results.errors[0].message, 'error');
        return;
      }
      if (!results.data.length) { showToast('El CSV está vacío', 'error'); return; }

      const errors = [];
      const valid = [];
      const seen = new Set();

      for (let i = 0; i < results.data.length; i++) {
        const row = results.data[i];
        const idx = i + 2;
        const rowErrors = [];

        const patente = (row.patente || '').trim().toUpperCase();
        const interno = (row.interno || '').trim();
        const marca = (row.marca || '').trim();
        const tipo = (row.tipo || '').trim();

        if (!patente) rowErrors.push('patente requerida');
        if (!interno) rowErrors.push('interno requerido');
        if (!marca) rowErrors.push('marca requerida');
        if (!tipo) rowErrors.push('tipo requerido');

        if (pat && (patenteSet.has(pat) || seen.has(pat))) rowErrors.push('patente duplicada');
        if (pat) seen.add(pat);

        if (rowErrors.length) {
          errors.push({ fila: idx, patente: pat || '(sin patente)', errores: rowErrors.join(', ') });
        } else {
          const item = {
            patente,
            interno,
            tipo,
            marca,
            modelo: (row.modelo || '').trim(),
            año: parseInt(row.año) || null,
            chasis: (row.chasis || '').trim(),
            kilometraje: parseFloat(row.kilometraje) || 0,
            horometro: parseFloat(row.horometro) || 0,
            estadoGeneral: row.estadoGeneral || 'Bueno',
            fechaUltimaRevision: row.fechaUltimaRevision || '',
            vencimientoVTV: row.vencimientoVTV || '',
            seguroCompania: (row.seguroCompania || '').trim(),
            seguroPoliza: (row.seguroPoliza || '').trim(),
            seguroVencimiento: row.seguroVencimiento || '',
            proximoServiceKm: parseFloat(row.proximoServiceKm) || null,
            proximoServiceFecha: row.proximoServiceFecha || '',
            conductorHabitual: (row.conductorHabitual || '').trim(),
            centroTrabajo: (row.centroTrabajo || '').trim(),
            observaciones: (row.observaciones || '').trim()
          };
          valid.push(item);
        }
      }

      const preview = document.getElementById('csv-import-preview');
      if (errors.length) {
        preview.innerHTML = `<div class="p-3 bg-red-50 rounded-lg text-sm text-red-700 mb-3">
          <strong>${errors.length} error(es):</strong>
          <ul class="mt-1 list-disc pl-4">${errors.map(e => `<li>Fila ${e.fila} (${e.patente}): ${e.errores}</li>`).join('')}</ul>
        </div>`;
      }

      if (valid.length) {
        csvValidatedData = valid;
        preview.innerHTML += `<div class="p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-3">
          <strong>${valid.length} vehículo(s) válido(s) listos para importar</strong>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead><tr class="text-left text-gray-500 border-b">${['Patente','Interno','Marca','Modelo','Tipo'].map(h => `<th class="pb-2 pr-2">${h}</th>`).join('')}</tr></thead>
            <tbody>${valid.slice(0,20).map(v => `<tr class="border-b border-gray-100">
              <td class="py-1.5 pr-2">${v.patente}</td>
              <td class="py-1.5 pr-2">${v.interno}</td>
              <td class="py-1.5 pr-2">${v.marca}</td>
              <td class="py-1.5 pr-2">${v.modelo || ''}</td>
              <td class="py-1.5 pr-2">${v.tipo}</td>
            </tr>`).join('')}${valid.length > 20 ? `<tr><td colspan="5" class="py-2 text-gray-400">... y ${valid.length - 20} más</td></tr>` : ''}</tbody>
          </table>
        </div>`;
        document.getElementById('btn-execute-csv').classList.remove('hidden');
      } else {
        document.getElementById('btn-execute-csv').classList.add('hidden');
      }
    }
  });
}

async function executeCsvImport() {
  if (!csvValidatedData.length) return;
  const items = csvValidatedData.map(row => {
    const seguro = {};
    if (row.seguroCompania || row.seguroPoliza || row.seguroVencimiento) {
      seguro.compañía = row.seguroCompania || '';
      seguro.poliza = row.seguroPoliza || '';
      seguro.fechaVencimiento = row.seguroVencimiento ? firebase.firestore.Timestamp.fromDate(new Date(row.seguroVencimiento + 'T00:00:00')) : null;
    }
    return {
      patente: row.patente,
      interno: row.interno,
      tipo: row.tipo,
      marca: row.marca,
      modelo: row.modelo,
      año: row.año,
      chasis: row.chasis,
      kilometraje: row.kilometraje,
      horometro: row.horometro,
      estadoGeneral: row.estadoGeneral,
      fechaUltimaRevision: row.fechaUltimaRevision ? firebase.firestore.Timestamp.fromDate(new Date(row.fechaUltimaRevision + 'T00:00:00')) : null,
      vencimientoVTV: row.vencimientoVTV ? firebase.firestore.Timestamp.fromDate(new Date(row.vencimientoVTV + 'T00:00:00')) : null,
      seguro: Object.keys(seguro).length ? seguro : {},
      proximoServiceKm: row.proximoServiceKm,
      proximoServiceFecha: row.proximoServiceFecha ? firebase.firestore.Timestamp.fromDate(new Date(row.proximoServiceFecha + 'T00:00:00')) : null,
      conductorHabitual: row.conductorHabitual,
      centroTrabajo: row.centroTrabajo,
      observaciones: row.observaciones,
      fotoURL: '',
      multas: [],
      documentos: [],
      fechaAlta: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  });
  await batchImport(items, 'csv');
  csvValidatedData = [];
  document.getElementById('btn-execute-csv').classList.add('hidden');
  document.getElementById('csv-import-preview').innerHTML = '';
  closeCsvImport();
}

/* ───────── Batch Import Engine ───────── */

function mapJsonItem(item) {
  const seguro = {};
  if (item.seguro) {
    seguro.compañía = item.seguro.compañía || item.seguro.compañia || '';
    seguro.poliza = item.seguro.poliza || '';
    seguro.fechaVencimiento = item.seguro.fechaVencimiento
      ? firebase.firestore.Timestamp.fromDate(new Date(item.seguro.fechaVencimiento + 'T00:00:00'))
      : null;
  }

  const multas = (item.multas || []).map(m => ({
    fecha: m.fecha || '',
    importe: m.importe || 0,
    concepto: m.concepto || '',
    pagado: !!m.pagado
  }));

  const documentos = (item.documentos || []).map(d => ({
    tipo: d.tipo || '',
    fechaVencimiento: d.fechaVencimiento || '',
    archivoURL: d.archivoURL || ''
  }));

  return {
    patente: (item.patente || '').trim().toUpperCase(),
    interno: (item.interno || '').trim(),
    tipo: item.tipo || '',
    marca: (item.marca || '').trim(),
    modelo: (item.modelo || '').trim(),
    año: item.año || null,
    chasis: (item.chasis || '').trim(),
    kilometraje: item.kilometraje || 0,
    horometro: item.horometro || 0,
    estadoGeneral: item.estadoGeneral || 'Bueno',
    fechaUltimaRevision: item.fechaUltimaRevision
      ? firebase.firestore.Timestamp.fromDate(new Date(item.fechaUltimaRevision + 'T00:00:00'))
      : null,
    vencimientoVTV: item.vencimientoVTV
      ? firebase.firestore.Timestamp.fromDate(new Date(item.vencimientoVTV + 'T00:00:00'))
      : null,
    seguro,
    proximoServiceKm: item.proximoServiceKm || null,
    proximoServiceFecha: item.proximoServiceFecha
      ? firebase.firestore.Timestamp.fromDate(new Date(item.proximoServiceFecha + 'T00:00:00'))
      : null,
    centroTrabajo: item.centroTrabajo || '',
    conductorHabitual: (item.conductorHabitual || '').trim(),
    observaciones: (item.observaciones || '').trim(),
    fotoURL: item.fotoURL || '',
    multas,
    documentos,
    fechaAlta: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

async function batchImport(items, source) {
  const total = items.length;
  showProgress(0, total, `Importando desde ${source.toUpperCase()}...`);
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
      showProgress(completed, total, `Importando desde ${source.toUpperCase()}...`);
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
