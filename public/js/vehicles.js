let allVehicles = [];
let editingVehicleId = null;
let csvValidatedData = [];
let patenteSet = new Set();

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-vehiculo')?.addEventListener('submit', saveVehicle);
  setupModalClose('modal-vehiculo');
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
  db.collection('vehicles').orderBy('interno').onSnapshot((snapshot) => {
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
    vtv: v.vtv || {
      fechaRealizacion: null,
      fechaVencimiento: v.vencimientoVTV || null,
      costo: null,
      centroMedicion: '',
      resultado: 'Pendiente'
    },
    seguro: v.seguro || { compañía: '', poliza: '', tipo: '', fechaVencimiento: null, costo: null },
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
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">No hay vehículos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = vehicles.map(v => {
    const mv = fmap(v);
    return `
      <tr class="border-b border-white/5 hover:bg-[#FF6B35]/10 cursor-pointer" onclick="viewVehicle('${v.id}')">
        <td class="py-3 pr-3">${mv.interno || '—'}</td>
        <td class="py-3 pr-3 font-medium">${mv.patente || '—'}</td>
        <td class="py-3 pr-3">${mv.marca || ''} ${mv.modelo || ''}</td>
        <td class="py-3 pr-3">${mv.tipo || '—'}</td>
        <td class="py-3 pr-3 text-xs">${mv.centroTrabajo || '—'}</td>
        <td class="py-3 no-print">${createActionButtons(null, `deleteVehicle('${v.id}')`, `viewVehicle('${v.id}')`)}</td>
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
    setDateField('v-vtvFechaRealizacion', v.vtv?.fechaRealizacion || null);
    setDateField('v-vencimientoVTV', v.vtv?.fechaVencimiento || v.vencimientoVTV || null);
    document.getElementById('v-vtvCosto').value = v.vtv?.costo || '';
    document.getElementById('v-vtvCentro').value = v.vtv?.centroMedicion || '';
    document.getElementById('v-vtvResultado').value = v.vtv?.resultado || 'Pendiente';
    document.getElementById('v-seguroCompania').value = v.seguro?.compañía || '';
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
    vtv: {
      fechaRealizacion: getDateValue('v-vtvFechaRealizacion'),
      fechaVencimiento: getDateValue('v-vencimientoVTV'),
      costo: parseFloat(document.getElementById('v-vtvCosto').value) || null,
      centroMedicion: document.getElementById('v-vtvCentro').value.trim() || '',
      resultado: document.getElementById('v-vtvResultado').value || 'Pendiente'
    },
    seguro: {
      compañía: document.getElementById('v-seguroCompania').value.trim() || '',
      poliza: document.getElementById('v-seguroPoliza').value.trim() || '',
      tipo: document.getElementById('v-seguroTipo').value || '',
      fechaVencimiento: getDateValue('v-seguroVencimiento'),
      costo: parseFloat(document.getElementById('v-seguroCosto').value) || null
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
  row.className = 'multa-row flex flex-wrap items-end gap-2 p-2 bg-red-900/20 rounded-lg';
  row.innerHTML = `
    <div class="flex-1 min-w-[120px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Fecha</label>
      <input type="date" class="multa-fecha w-full px-2 py-1.5 input-neon rounded text-sm bg-[#0B0E17]/50 border border-[#FF6B35]/20 text-[#F1F3F8]" value="${multa?.fecha || ''}">
    </div>
    <div class="w-28">
      <label class="block text-xs text-[#8E94A8] mb-1">Importe ($)</label>
      <input type="number" class="multa-importe w-full px-2 py-1.5 input-neon rounded text-sm bg-[#0B0E17]/50 border border-[#FF6B35]/20 text-[#F1F3F8]" value="${multa?.importe || ''}" step="0.01">
    </div>
    <div class="flex-[2] min-w-[150px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Concepto</label>
      <input type="text" class="multa-concepto w-full px-2 py-1.5 input-neon rounded text-sm bg-[#0B0E17]/50 border border-[#FF6B35]/20 text-[#F1F3F8]" value="${multa?.concepto || ''}" placeholder="Exceso de velocidad">
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
      <select class="doc-tipo w-full px-2 py-1.5 border border-[#FF6B35]/20 rounded text-sm bg-[#0B0E17]/50 text-[#F1F3F8]">
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
      <input type="date" class="doc-fecha w-full px-2 py-1.5 border border-[#FF6B35]/20 rounded text-sm bg-[#0B0E17]/50 text-[#F1F3F8]" value="${doc?.fechaVencimiento || ''}">
    </div>
    <div class="flex-[2] min-w-[180px]">
      <label class="block text-xs text-[#8E94A8] mb-1">Archivo URL</label>
      <input type="url" class="doc-url w-full px-2 py-1.5 border border-[#FF6B35]/20 rounded text-sm bg-[#0B0E17]/50 text-[#F1F3F8]" value="${doc?.archivoURL || ''}" placeholder="https://storage.googleapis.com/...">
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
  const headers = ['patente','interno','tipo','marca','modelo','año','chasis','kilometraje','horometro','estadoGeneral','fechaUltimaRevision','vtvFechaRealizacion','vtvVencimiento','vtvCosto','vtvCentro','vtvResultado','seguroCompania','seguroPoliza','seguroTipo','seguroVencimiento','seguroCosto','proximoServiceKm','proximoServiceFecha','conductorHabitual','centroTrabajo','observaciones'];
  const sample = ['ABC123','001','Camión volcador','Mercedes Benz','Atego 1718','2022','9BM1234567890ABC','158000','4500','Bueno','2026-04-10','2026-03-15','2026-08-31','25000','Planta Central','Aprobado','Rivadavia Seguros','POL-2024-12345','Todo Riesgo','2026-09-30','120000','160000','2026-07-15','Juan Pérez','Cantera Los Ángeles','Último cambio de cubiertas a los 140.000 km'];
  const BOM = '\uFEFF';
  const csv = BOM + headers.join(',') + '\n' + sample.join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'plantilla_vehiculos.csv';
  link.click();
  URL.revokeObjectURL(link.href);
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
    const tipo = (row.tipo || '').toString().trim();

    if (!patente) rowErrors.push('patente requerida');
    if (!interno) rowErrors.push('interno requerido');
    if (!marca) rowErrors.push('marca requerida');
    if (!tipo) rowErrors.push('tipo requerido');

    if (patente && (patenteSet.has(patente) || seen.has(patente))) rowErrors.push('patente duplicada');
    if (patente) seen.add(patente);

    if (rowErrors.length) {
      errors.push({ fila: idx, patente: patente || '(sin patente)', errores: rowErrors.join(', ') });
    } else {
      valid.push({
        patente, interno, tipo, marca,
        modelo: (row.modelo || '').toString().trim(),
        año: parseInt(row.año) || null,
        chasis: (row.chasis || '').toString().trim(),
        kilometraje: parseFloat(row.kilometraje) || 0,
        horometro: parseFloat(row.horometro) || 0,
        estadoGeneral: (row.estadoGeneral || 'Bueno').toString().trim(),
        fechaUltimaRevision: row.fechaUltimaRevision || '',
        vencimientoVTV: row.vencimientoVTV || '',
        seguroCompania: (row.seguroCompania || '').toString().trim(),
        seguroPoliza: (row.seguroPoliza || '').toString().trim(),
        seguroVencimiento: row.seguroVencimiento || '',
        proximoServiceKm: parseFloat(row.proximoServiceKm) || null,
        proximoServiceFecha: row.proximoServiceFecha || '',
        conductorHabitual: (row.conductorHabitual || '').toString().trim(),
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
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (!rows.length) {
            showToast('El Excel está vacío o no tiene datos válidos', 'error');
            return;
          }
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

async function executeCsvImport() {
  if (!csvValidatedData.length) return;
  const items = csvValidatedData.map(row => {
    const seguro = {};
    if (row.seguroCompania || row.seguroPoliza || row.seguroVencimiento || row.seguroTipo || row.seguroCosto) {
      seguro.compañía = row.seguroCompania || '';
      seguro.poliza = row.seguroPoliza || '';
      seguro.tipo = row.seguroTipo || '';
      seguro.costo = parseFloat(row.seguroCosto) || null;
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
      vtv: {
        fechaRealizacion: row.vtvFechaRealizacion ? firebase.firestore.Timestamp.fromDate(new Date(row.vtvFechaRealizacion + 'T00:00:00')) : null,
        fechaVencimiento: row.vtvVencimiento ? firebase.firestore.Timestamp.fromDate(new Date(row.vtvVencimiento + 'T00:00:00')) : (row.vencimientoVTV ? firebase.firestore.Timestamp.fromDate(new Date(row.vencimientoVTV + 'T00:00:00')) : null),
        costo: parseFloat(row.vtvCosto) || null,
        centroMedicion: row.vtvCentro || '',
        resultado: row.vtvResultado || 'Pendiente'
      },
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
