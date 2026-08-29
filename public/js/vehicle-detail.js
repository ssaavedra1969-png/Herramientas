let vehicleId = null;
let vehicleData = null;
let vehicleDocumentacion = {};
let vehicleDocumentosLocales = {};
let servicesUnsub = null;
let repuestosUnsub = null;
let currentTab = 'resumen';
let qrCodeInstance = null;
let editingServiceId = null;
let proximoKmTouched = false;

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  vehicleId = pathParts[pathParts.length - 1];

  if (!vehicleId || vehicleId === 'vehicle-detail') {
    document.getElementById('vehicle-subtitle').textContent = 'ID de vehículo no válido';
    return;
  }

  loadVehicle();
  initServiceForm();
  initRepuestoForm();
  document.getElementById('v-trompo')?.addEventListener('change', (e) => {
    document.getElementById('v-trompo-fields').classList.toggle('hidden', !e.target.checked);
  });
  ['v-patente','v-marca','v-modelo','v-anio','v-tipo','v-kilometraje','v-centroTrabajo','v-chofer','v-dni','v-registro','v-empresa'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateCompleteness);
  });

  if (window.innerWidth < 768) {
    const resumenChevron = document.querySelector('#accordion-header-resumen .accordion-chevron');
    if (resumenChevron) resumenChevron.style.transform = 'rotate(180deg)';
    document.getElementById('accordion-header-resumen')?.classList.add('accordion-active');
  }
});

async function loadVehicle() {
  const doc = await db.collection('vehicles').doc(vehicleId).get();
  if (!doc.exists) {
    document.getElementById('vehicle-subtitle').textContent = 'Vehículo no encontrado';
    return;
  }

  vehicleData = { id: doc.id, ...doc.data() };
  document.getElementById('vehicle-title').textContent = `${vehicleData.patente || 'Vehículo'} - Int. ${vehicleData.interno || ''}`;
  document.getElementById('vehicle-subtitle').textContent = `${vehicleData.marca || ''} ${vehicleData.modelo || ''} (${vehicleData.tipo || ''})`;

  renderGeneralInfo();
  renderSeguro();
  renderMatafuego();
  renderVTV();
  renderService();
  renderMultas();
  vehicleDocumentacion = vehicleData.documentacion || {};
  loadDocumentosLocales();
  renderDocumentos();
  renderFoto();
  document.getElementById('vg-observaciones').textContent = vehicleData.observaciones || 'Sin observaciones';

  generateQR();
  setText('qr-empresa', vehicleData.empresa || 'Grupo Falpat SRL');
  setText('qr-vehiculo-id', `Int. ${vehicleData.interno || ''} — ${vehicleData.patente || ''}`);

  try {
    startServicesListener();
  } catch (e) {
    console.error('Error al iniciar listener de services:', e);
  }
  try {
    startRepuestosListener();
  } catch (e) {
    console.error('Error al iniciar listener de repuestos:', e);
  }
}

function renderGeneralInfo() {
  setText('vg-patente', vehicleData.patente || '-');
  setText('vg-interno', vehicleData.interno || '-');
  setText('vg-marca', vehicleData.marca || '-');
  setText('vg-modelo', vehicleData.modelo || '-');
  setText('vg-tipo', vehicleData.tipo || '-');
  setText('vg-subtipo', vehicleData.subtipo || '-');
  setText('vg-anio', vehicleData.año || '-');
  setText('vg-chasis', vehicleData.chasis || '-');
  setText('vg-numeroMotor', vehicleData.numeroMotor || '-');
  setText('vg-capacidadCarga', vehicleData.capacidadCarga ? `${vehicleData.capacidadCarga.toLocaleString()} kg` : '-');
  setText('vg-nroBet', vehicleData.nroBet || '-');
  renderTrompo();
  setText('vg-kmhs', `${vehicleData.kilometraje?.toLocaleString() || 0} km`);
  setText('vg-centro', vehicleData.centroTrabajo || '-');
  setText('vg-chofer', vehicleData.chofer || '-');
  setText('vg-dni', vehicleData.dni || '-');
  setText('vg-vencimientoDNI', formatDate(vehicleData.vencimientoDNI));
  setText('vg-registro', vehicleData.registro || '-');
  setText('vg-vencimientoRegistro', formatDate(vehicleData.vencimientoRegistro));
  setText('vg-empresa', vehicleData.empresa || '-');
  setText('vg-estadoGeneral', vehicleData.estadoGeneral || '-');
  setText('vg-horometro', vehicleData.horometro ? `${vehicleData.horometro} hs` : '-');
  setText('vg-fechaUltimaRevision', formatDate(vehicleData.fechaUltimaRevision));
  setText('vg-fechaAlta', formatDate(vehicleData.fechaAlta) || formatDate(vehicleData.createdAt) || '-');
}

function renderTrompo() {
  const card = document.getElementById('vg-trompo-card');
  if (!card) return;
  if (!vehicleData.trompo) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  setText('vg-trompo-marca', vehicleData.marcaTrompo || '-');
  setText('vg-trompo-numeroSerie', vehicleData.serieTrompo || '-');
  setText('vg-trompo-modelo', vehicleData.modeloTrompo || '-');
  setText('vg-trompo-cargaM3', vehicleData.cargaM3Trompo || '-');
  setText('vg-trompo-empresa', vehicleData.empresa || 'Grupo Falpat SRL');
}

function renderSeguro() {
  const s = vehicleData.seguro || {};
  setText('vg-seguroCompania', s.compania || s.compañía || '-');
  setText('vg-seguroPoliza', s.poliza || '-');
  setText('vg-seguroTipo', s.tipo || '-');
  setText('vg-seguroVencimiento', formatDate(s.fechaVencimiento));
  setText('vg-seguroCosto', s.costo ? formatCurrency(s.costo) : '-');
}

function renderMatafuego() {
  const m = vehicleData.matafuego || {};
  setText('vg-matafuegoEstado', m.estado || '-');
  setText('vg-matafuegoFechaControl', formatDate(m.fechaControl));
  setText('vg-matafuegoFechaVto', formatDate(m.fechaVto));
}

function renderVTV() {
  const v = vehicleData.vtv || {};
  setText('vg-vtvFechaRealizacion', formatDate(v.fechaRealizacion));
  setText('vg-vtvVencimiento', formatDate(v.fechaVencimiento));
  setText('vg-vtvCosto', v.costo ? formatCurrency(v.costo) : '-');
  setText('vg-vtvCentro', v.centroMedicion || '-');
  setText('vg-vtvResultado', v.resultado || 'Pendiente');
}

function renderService() {
  setText('vg-proximoServiceKm', vehicleData.proximoServiceKm ? `${vehicleData.proximoServiceKm.toLocaleString()} km` : '-');
  setText('vg-proximoServiceFecha', formatDate(vehicleData.proximoServiceFecha));
  const listEl = document.getElementById('service-next-list');
  if (!listEl) return;
  const summary = vehicleData.serviceSummary || {};
  const entries = Object.entries(summary)
    .map(([tipo, s]) => ({ tipo, ...s }))
    .filter(s => s && (s.proximoKm != null || s.proximoFecha))
    .sort((a, b) => {
      const ak = a.proximoKm != null ? a.proximoKm : Infinity;
      const bk = b.proximoKm != null ? b.proximoKm : Infinity;
      return ak - bk;
    })
    .slice(0, 6);
  if (!entries.length) {
    listEl.innerHTML = '<div class="text-[#4a5568] italic">Sin services registrados</div>';
    return;
  }
  listEl.innerHTML = entries.map(e => `
    <div class="flex items-center justify-between gap-2">
      <span class="text-[#ffffff]">${e.tipo}</span>
      <span class="text-[#8b9bb4] whitespace-nowrap">${e.proximoKm != null ? e.proximoKm.toLocaleString() + ' km' : formatDate(e.proximoFecha)}</span>
    </div>
  `).join('');
}

function renderMultas() {
  const container = document.getElementById('vg-multas');
  const multas = vehicleData.multas || [];
  if (!multas.length) {
    container.innerHTML = '<span class="italic text-[#4a5568]">Sin multas registradas</span>';
    return;
  }
  container.innerHTML = multas.map(m => `
    <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div>
        <span class="text-[#ffffff]">${m.concepto || 'Multa'}</span>
        <span class="text-xs text-[#4a5568] ml-2">${m.fecha || ''}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-red-400 font-medium">${formatCurrency(m.importe)}</span>
        ${m.pagado ? '<span class="text-xs text-green-400">Pagado</span>' : '<span class="text-xs text-yellow-400">Pendiente</span>'}
      </div>
    </div>
  `).join('');
}

const DOC_OBLIGATORIOS = [
  { key: 'titulo',   label: 'Título del camión' },
  { key: 'cedula',   label: 'Cédula del camión' },
  { key: 'seguro',   label: 'Seguro del camión' },
  { key: 'registro', label: 'Registro del chofer' },
  { key: 'dni',      label: 'DNI del chofer' },
  { key: 'vtv',      label: 'VTV' }
];

async function loadDocumentosLocales() {
  try {
    const res = await fetch(`/api/vehicles/${vehicleId}/documentos`, { headers: await getAuthHeaders() });
    if (!res.ok) throw new Error('sin respuesta');
    const data = await res.json();
    vehicleDocumentosLocales = data.documentos || {};
    renderDocumentos();
  } catch (e) {
    console.error('No se pudieron leer los documentos locales', e);
    vehicleDocumentosLocales = {};
  }
}

async function deleteDocumentoLocal(key) {
  if (!isAdmin()) return;
  const def = DOC_OBLIGATORIOS.find(d => d.key === key);
  const label = def ? def.label : key;
  const res = await Swal.fire({
    icon: 'warning',
    title: `¿Eliminar ${label}?`,
    text: 'Se descargará una copia de respaldo del archivo antes de eliminarlo.',
    showCancelButton: true,
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626'
  });
  if (!res.isConfirmed) return;
  try {
    const local = vehicleDocumentosLocales[key];
    if (local?.url) {
      const headers = local.origen === 'carga' ? await getAuthHeaders() : {};
      const blob = await (await fetch(local.url, { headers })).blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = local.nombre || `${key}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      await new Promise(r => setTimeout(r, 800));
    }
    const del = await fetch(`/api/vehicles/${vehicleId}/documentos/${key}`, { method: 'DELETE', headers: await getAuthHeaders() });
    const data = await del.json().catch(() => ({}));
    if (!del.ok) throw new Error(data.error || 'No se pudo eliminar');
    showToast(`${label} eliminado (copia de respaldo descargada)`);
    await loadDocumentosLocales();
    updateDocBadge();
    if (!document.getElementById('modal-documentacion')?.classList.contains('hidden')) openDocumentacionModal();
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

async function abrirDocumento(key) {
  const local = vehicleDocumentosLocales[key];
  if (!local) return;
  try {
    const res = await fetch(local.url, { headers: await getAuthHeaders() });
    if (!res.ok) throw new Error('No se pudo obtener el archivo');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    window.open(objUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function uploadDocumento(key, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const def = DOC_OBLIGATORIOS.find(d => d.key === key);
  const label = def ? def.label : key;
  if (file.size > 700 * 1024) {
    showToast('Archivo grande (máx 700KB). Para archivos mayores usá la carpeta PATENTE/ + npm run subir:docs', 'error');
    input.value = '';
    return;
  }
  const okExt = /\.(pdf|jpg|jpeg|png)$/i.test(file.name || '');
  if (!okExt) {
    showToast('Solo se permiten PDF, JPG o PNG', 'error');
    input.value = '';
    return;
  }
  let base64;
  try {
    base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result).split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  } catch (e) {
    showToast('No se pudo leer el archivo', 'error');
    input.value = '';
    return;
  }
  try {
    const res = await fetch(`/api/vehicles/${vehicleId}/documentos/${key}/upload`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ nombre: file.name, mime: file.type || 'application/octet-stream', base64 })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo subir');
    showToast(`${label} subido (seguimiento en produccion al deployar)`);
    await loadDocumentosLocales();
    updateDocBadge();
    openDocumentacionModal();
  } catch (e) {
    showToast('Error al subir: ' + e.message, 'error');
  } finally {
    input.value = '';
  }
}

function toDateInputValue(val) {
  const d = toDate(val);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDate(val) {
  if (!val) return null;
  let d;
  if (val.toDate) d = val.toDate();
  else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const [y, m, day] = val.substring(0, 10).split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else d = new Date(val);
  return d && !isNaN(d.getTime()) ? d : null;
}

function getDocVencimiento(key) {
  const doc = (vehicleData?.documentacion || {})[key] || null;
  if (key === 'vtv') return vehicleData.vtv?.fechaVencimiento || doc?.fechaVencimiento || null;
  if (key === 'seguro') return vehicleData.seguro?.fechaVencimiento || doc?.fechaVencimiento || null;
  if (key === 'registro') return vehicleData.vencimientoRegistro || doc?.fechaVencimiento || null;
  if (key === 'dni') return vehicleData.vencimientoDNI || doc?.fechaVencimiento || null;
  return doc?.fechaVencimiento || null;
}

function renderDocumentos() {
  const container = document.getElementById('vg-documentos');
  if (!container) return;
  const docs = vehicleData.documentos || [];
  let html = '';

  updateDocBadge();

  DOC_OBLIGATORIOS.forEach(({ key, label }) => {
    const local = vehicleDocumentosLocales[key] || null;
    const vencimientoStr = toDateInputValue(getDocVencimiento(key));
    let dias = null;
    if (vencimientoStr) {
      const vto = new Date(vencimientoStr + 'T00:00:00');
      dias = Math.ceil((vto - new Date()) / 86400000);
    }
    const existe = !!local;
    let badgeCls = 'text-[#4a5568]', badgeTxt = 'Sin cargar';
    if (existe) {
      if (dias === null) { badgeCls = 'text-teal-300'; badgeTxt = 'Cargado'; }
      else if (dias < 0) { badgeCls = 'text-red-400'; badgeTxt = 'Vencido'; }
      else if (dias <= 30) { badgeCls = 'text-yellow-400'; badgeTxt = `Vence en ${dias}d`; }
      else { badgeCls = 'text-green-400'; badgeTxt = 'Al día'; }
    }
    html += `
      <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <div class="flex items-center gap-2 min-w-0">
          <svg class="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <div class="min-w-0">
            <span class="text-[#ffffff] font-medium text-sm">${label}</span>
            ${vencimientoStr ? `<span class="block text-[10px] text-[#4a5568]">Vence: ${vencimientoStr}</span>` : ''}
            ${existe ? `<span class="block text-[10px] text-teal-300">${local.nombre}${local.origen === 'carga' ? ' <span class="text-[#d4af37]">(subido)</span>' : ''}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-xs font-semibold ${badgeCls} mr-1">${badgeTxt}</span>
          ${existe ? (local.origen === 'carga'
            ? `<button onclick="abrirDocumento('${key}')" title="Ver documento" class="p-1.5 rounded hover:bg-white/5 text-teal-300 hover:text-teal-200 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>`
            : `<a href="${local.url}" target="_blank" rel="noopener" title="Ver documento" class="p-1.5 rounded hover:bg-white/5 text-teal-300 hover:text-teal-200 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></a>`) : ''}
          ${existe && isAdmin() ? `<button onclick="deleteDocumentoLocal('${key}')" title="Eliminar documento" class="p-1.5 rounded hover:bg-white/5 text-red-400 hover:text-red-300 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>` : ''}
        </div>
      </div>`;
  });

  if (docs.length) {
    html += docs.map(d => `
      <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
        <div>
          <span class="text-[#8b9bb4]">${d.tipo || 'Documento'}</span>
          ${d.fechaVencimiento ? `<span class="text-xs text-[#4a5568] ml-2">Vence: ${d.fechaVencimiento}</span>` : ''}
        </div>
        ${d.archivoURL ? `<a href="${d.archivoURL}" target="_blank" class="text-[#d4af37] text-xs hover:underline">Ver</a>` : ''}
      </div>
    `).join('');
  }

  container.innerHTML = html || '<span class="italic text-[#4a5568]">Sin documentos adjuntos</span>';
}

function updateDocBadge() {
  const badge = document.getElementById('doc-badge');
  const badgeOk = document.getElementById('doc-badge-ok');
  if (!badge || !badgeOk) return;
  const total = DOC_OBLIGATORIOS.length;
  const presentes = DOC_OBLIGATORIOS.filter(d => vehicleDocumentosLocales[d.key]);
  const faltantes = total - presentes.length;
  if (faltantes === 0) {
    badge.classList.add('hidden');
    badgeOk.classList.remove('hidden');
  } else {
    badgeOk.classList.add('hidden');
    badge.classList.remove('hidden');
    badge.textContent = `Faltan ${faltantes}`;
    badge.className = `px-1.5 py-0.5 rounded-full text-[10px] font-bold ${faltantes >= 3 ? 'bg-red-400/20 text-red-400' : faltantes >= 2 ? 'bg-yellow-400/20 text-yellow-400' : 'bg-orange-400/20 text-orange-400'}`;
  }
}

function openDocumentacionModal() {
  if (!vehicleData) return;
  const patente = (vehicleData.patente || '').toUpperCase();
  document.querySelectorAll('.doc-dir, .patente-mayus').forEach(el => el.textContent = patente);
  DOC_OBLIGATORIOS.forEach(({ key }) => {
    const local = vehicleDocumentosLocales[key] || null;
    const fecha = getDocVencimiento(key);
    const preview = document.getElementById(`doc-${key}-preview`);
    if (preview) preview.innerHTML = local
      ? `<span class="text-teal-300">✔ ${local.nombre}</span>`
      : `<span class="text-[#4a5568]">Sin archivo en la carpeta</span>`;
    const fechaInput = document.getElementById(`doc-${key}-fecha`);
    if (fechaInput) fechaInput.value = toDateInputValue(fecha);
    const link = document.getElementById(`doc-${key}-link`);
    if (link) {
      if (local) { link.href = local.url; link.classList.remove('hidden'); }
      else { link.classList.add('hidden'); }
    }
    const elimBtn = document.getElementById(`doc-${key}-eliminar`);
    if (elimBtn) elimBtn.classList.toggle('hidden', !local);
    if (isAdmin() && elimBtn) {
      let input = document.getElementById(`doc-${key}-file`);
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = `doc-${key}-file`;
        input.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
        input.className = 'hidden';
        input.addEventListener('change', (e) => uploadDocumento(key, e.target));
        const label = document.createElement('label');
        label.htmlFor = `doc-${key}-file`;
        label.title = 'Subir archivo (PDF, JPG o PNG, hasta 700KB)';
        label.className = 'shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors';
        label.textContent = 'Subir';
        const cont = document.createElement('span');
        cont.className = 'shrink-0 flex items-center';
        cont.appendChild(label);
        cont.appendChild(input);
        elimBtn.parentNode.appendChild(cont);
      }
      input.value = '';
    }
    renderDocEstado(key, local, { fechaVencimiento: fecha });
  });
  showModal('modal-documentacion');
}

function closeDocumentacionModal() {
  hideModal('modal-documentacion');
}

function renderDocEstado(key, local, d) {
  const el = document.getElementById(`doc-${key}-estado`);
  if (!el) return;
  let txt, cls;
  if (!local) { txt = 'Sin cargar'; cls = 'text-[#4a5568]'; }
  else if (!d || !d.fechaVencimiento) { txt = 'Cargado'; cls = 'text-teal-300'; }
  else {
    const vto = toDate(d.fechaVencimiento);
    const dias = vto ? Math.ceil((vto.getTime() - Date.now()) / 86400000) : null;
    if (dias === null) { txt = 'Cargado'; cls = 'text-teal-300'; }
    else if (dias < 0) { txt = 'Vencido'; cls = 'text-red-400'; }
    else if (dias <= 30) { txt = dias + 'd'; cls = 'text-yellow-400'; }
    else { txt = 'Al día'; cls = 'text-green-400'; }
  }
  el.textContent = txt;
  el.className = 'text-xs font-semibold ' + cls;
}

async function saveDocumentacion() {
  if (!isAdmin()) return;
  try {
    const docRef = db.collection('vehicles').doc(vehicleId);
    const doc = await docRef.get();
    const spec = doc.data() || {};
    const update = {
      vtv: { ...(spec.vtv || {}) },
      seguro: { ...(spec.seguro || {}) },
      documentacion: { ...(spec.documentacion || {}) }
    };
    if (spec.registro !== undefined) update.registro = spec.registro;
    if (spec.vencimientoRegistro !== undefined) update.vencimientoRegistro = spec.vencimientoRegistro;
    if (spec.vencimientoDNI !== undefined) update.vencimientoDNI = spec.vencimientoDNI;

    DOC_OBLIGATORIOS.forEach(({ key }) => {
      const fechaInput = document.getElementById(`doc-${key}-fecha`);
      const fecha = fechaInput && fechaInput.value ? fechaInput.value : null;
      if (!fecha) return;
      const ts = firebase.firestore.Timestamp.fromDate(new Date(fecha + 'T12:00:00'));
      update.documentacion[key] = { ...((update.documentacion[key] || {})), fechaVencimiento: ts };
      if (key === 'vtv') update.vtv.fechaVencimiento = ts;
      else if (key === 'seguro') update.seguro.fechaVencimiento = ts;
      else if (key === 'registro') update.vencimientoRegistro = ts;
      else if (key === 'dni') update.vencimientoDNI = ts;
    });

    await docRef.update(update);
    vehicleData = { ...vehicleData, vtv: update.vtv, seguro: update.seguro, documentacion: update.documentacion };
    if ('registro' in update) vehicleData.registro = update.registro;
    if ('vencimientoRegistro' in update) vehicleData.vencimientoRegistro = update.vencimientoRegistro;
    if ('vencimientoDNI' in update) vehicleData.vencimientoDNI = update.vencimientoDNI;
    vehicleDocumentacion = update.documentacion;
    renderVTV();
    renderSeguro();
    renderDocumentos();
    renderGeneralInfo();
    closeDocumentacionModal();
    showToast('Documentación guardada');
  } catch (e) {
    console.error('saveDocumentacion error:', e);
    showToast('Error al guardar: ' + e.message, 'error');
  }
}

function renderFoto() {
  const container = document.getElementById('vg-foto-container');
  const img = document.getElementById('vg-foto');
  const hero = document.getElementById('vehicle-hero');
  const heroImg = document.getElementById('vehicle-hero-img');
  if (vehicleData.fotoURL) {
    container.classList.remove('hidden');
    img.src = vehicleData.fotoURL;
    if (hero && heroImg) {
      hero.classList.remove('hidden');
      heroImg.style.backgroundImage = `url(${vehicleData.fotoURL})`;
    }
  } else {
    container.classList.add('hidden');
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('bg-[#d4af37]/10', 'text-[#d4af37]');
    el.classList.add('text-[#8b9bb4]');
  });
  document.getElementById(`tab-content-${tab}`)?.classList.remove('hidden');
  document.getElementById(`tab-${tab}`)?.classList.add('bg-[#d4af37]/10', 'text-[#d4af37]');

  if (tab === 'qr') {
    setTimeout(generateQR, 100);
  }
  if (tab === 'codigobarras') {
    setTimeout(generateBarcode, 100);
  }
}

function toggleAccordion(tab) {
  const content = document.getElementById(`tab-content-${tab}`);
  const header = document.getElementById(`accordion-header-${tab}`);
  if (!content || !header) return;

  const chevron = header.querySelector('.accordion-chevron');
  const isOpen = !content.classList.contains('hidden');

  if (isOpen) {
    content.classList.add('hidden');
    if (chevron) chevron.style.transform = '';
    header.classList.remove('accordion-active');
  } else {
    content.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    header.classList.add('accordion-active');

    if (tab === 'qr') setTimeout(generateQR, 100);
    if (tab === 'codigobarras') setTimeout(generateBarcode, 100);
  }
}

function generateQR() {
  const container = document.getElementById('qrcode');
  if (!container) return;

  container.innerHTML = '';

  const pathParts = window.location.pathname.split('/');
  const vehicleId = pathParts[pathParts.length - 1];
  const qrUrl = window.location.origin + '/vehicle/' + vehicleId + '/qr';

  const stickerLink = document.getElementById('qr-sticker-link');
  if (stickerLink) stickerLink.href = '/vehicle/' + vehicleId + '/qr-sticker';

  if (typeof QRCode !== 'undefined') {
    qrCodeInstance = new QRCode(container, {
      text: qrUrl,
      width: 280,
      height: 280,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    container.innerHTML = '<p class="text-[#4a5568] text-sm">Cargando librería QR...</p>';
    setTimeout(generateQR, 500);
  }
}

function printQR() {
  const canvasEl = document.querySelector('#qrcode canvas');
  const imgEl = document.querySelector('#qrcode img');
  if (!canvasEl && !imgEl) {
    showToast('Generá el QR primero', 'error');
    return;
  }

  let qrDataUrl;
  if (canvasEl) {
    qrDataUrl = canvasEl.toDataURL('image/png');
  } else {
    qrDataUrl = imgEl.src;
  }

  const v = vehicleData || {};
  const empresa = v.empresa || 'Grupo Falpat SRL';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>QR - ${v.patente || 'Vehiculo'}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 portrait;margin:10mm}
      body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#fff;color:#1a1a2e;display:flex;justify-content:center;padding:20px}
      .card{width:100%;max-width:400px;border:3px solid #1a1a2e;border-radius:16px;overflow:hidden;text-align:center}
      .header{background:#1a1a2e;color:#fff;padding:12px 16px}
      .header .patente{font-size:28px;font-weight:800;letter-spacing:2px}
      .header .interno{font-size:14px;opacity:.85;margin-top:2px}
      .body-card{padding:20px}
      .qr-section{margin:16px auto;display:inline-block;padding:12px;background:#fff;border:2px solid #e5e7eb;border-radius:12px}
      .qr-section img{display:block;width:220px;height:220px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;text-align:left;margin-top:16px;padding-top:16px;border-top:2px solid #e5e7eb}
      .info-item .label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600}
      .info-item .value{font-size:13px;font-weight:600;color:#1a1a2e;margin-top:1px}
      .footer-bar{background:#f9fafb;padding:10px 16px;border-top:2px solid #e5e7eb;font-size:11px;color:#6b7280}
      .footer-bar strong{color:#1a1a2e;font-size:13px}
      @media print{body{padding:0}.card{border-radius:0}}
    </style></head><body>
    <div class="card">
      <div class="header">
        <div class="patente">${v.patente || ''}</div>
        <div class="interno">Interno ${v.interno || ''}</div>
      </div>
      <div class="body-card">
        <div class="qr-section"><img src="${qrDataUrl}" /></div>
        <div class="info-grid">
          <div class="info-item"><div class="label">Marca / Modelo</div><div class="value">${v.marca || ''} ${v.modelo || ''}</div></div>
          <div class="info-item"><div class="label">Tipo</div><div class="value">${v.tipo || ''} ${v.subtipo || ''}</div></div>
          <div class="info-item"><div class="label">Chofer</div><div class="value">${v.chofer || '-'}</div></div>
          <div class="info-item"><div class="label">Centro Trabajo</div><div class="value">${v.centroTrabajo || '-'}</div></div>
          <div class="info-item"><div class="label">Ano</div><div class="value">${v.año || '-'}</div></div>
          <div class="info-item"><div class="label">Estado</div><div class="value">${v.estadoGeneral || '-'}</div></div>
        </div>
      </div>
      <div class="footer-bar"><strong>${empresa}</strong>Escaneá para ver detalle del vehiculo</div>
    </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

function downloadQR() {
  const canvasEl = document.querySelector('#qrcode canvas');
  const imgEl = document.querySelector('#qrcode img');
  if (!canvasEl && !imgEl) return;

  const v = vehicleData || {};
  const empresa = v.empresa || 'Grupo Falpat SRL';

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const W = 600;
  const headerH = 80;
  const qrSize = 280;
  const infoH = 140;
  const footerH = 50;
  const totalH = headerH + qrSize + 60 + infoH + footerH;
  c.width = W;
  c.height = totalH;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(v.patente || '', W / 2, 40);
  ctx.font = '14px Arial, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(`Interno ${v.interno || ''}`, W / 2, 62);
  ctx.globalAlpha = 1;

  const qrY = headerH + 30;
  if (canvasEl) {
    ctx.drawImage(canvasEl, (W - qrSize) / 2, qrY, qrSize, qrSize);
  } else {
    const img = new Image();
    img.src = imgEl.src;
    ctx.drawImage(img, (W - qrSize) / 2, qrY, qrSize, qrSize);
  }

  const infoY = qrY + qrSize + 30;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, infoY - 10, W, infoH + 20);
  ctx.fillStyle = '#1a1a2e';
  ctx.textAlign = 'left';
  const leftX = 60;
  const rightX = W / 2 + 30;
  const lineH = 28;
  const items = [
    [leftX, 'Marca / Modelo', `${v.marca || ''} ${v.modelo || ''}`],
    [rightX, 'Tipo', `${v.tipo || ''} ${v.subtipo || ''}`],
    [leftX + lineH, 'Chofer', v.chofer || '-'],
    [rightX + lineH, 'Centro', v.centroTrabajo || '-'],
    [leftX + lineH * 2, 'Ano', v.año || '-'],
    [rightX + lineH * 2, 'Estado', v.estadoGeneral || '-']
  ];
  items.forEach(([yOffset, label, value]) => {
    const x = yOffset === leftX || yOffset === leftX + lineH || yOffset === leftX + lineH * 2 ? leftX : rightX;
    ctx.font = '9px Arial, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(label.toUpperCase(), x, infoY + (yOffset - leftX));
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(value, x, infoY + (yOffset - leftX) + 14);
  });

  const footY = totalH - footerH;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, footY, W, footerH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(empresa, W / 2, footY + 20);
  ctx.font = '10px Arial, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('Escanea para ver detalle del vehiculo', W / 2, footY + 36);

  const link = document.createElement('a');
  link.download = `qr-${v.patente || 'vehiculo'}.png`;
  link.href = c.toDataURL('image/png');
  link.click();
  showToast('QR descargado');
}

function showQRCode() {
  switchTab('qr');
}

function openEditVehicle() {
  if (!vehicleData || !isAdmin()) return;

  document.getElementById('vehiculo-id').value = vehicleId;
  document.getElementById('v-patente').value = vehicleData.patente || '';
  document.getElementById('v-interno').value = vehicleData.interno || '';
  document.getElementById('v-interno').readOnly = true;
  document.getElementById('v-marca').value = vehicleData.marca || '';
  document.getElementById('v-modelo').value = vehicleData.modelo || '';
  document.getElementById('v-anio').value = vehicleData.año || '';
  document.getElementById('v-chasis').value = vehicleData.chasis || '';
  document.getElementById('v-numeroMotor').value = vehicleData.numeroMotor || '';
  document.getElementById('v-nroBet').value = vehicleData.nroBet || '';
  document.getElementById('v-capacidadCarga').value = vehicleData.capacidadCarga || '';
  document.getElementById('v-trompo').checked = vehicleData.trompo === true;
  document.getElementById('v-trompo-fields').classList.toggle('hidden', !vehicleData.trompo);
  document.getElementById('v-marcaTrompo').value = vehicleData.marcaTrompo || '';
  document.getElementById('v-serieTrompo').value = vehicleData.serieTrompo || '';
  document.getElementById('v-modeloTrompo').value = vehicleData.modeloTrompo || '';
  document.getElementById('v-cargaM3Trompo').value = vehicleData.cargaM3Trompo || '';
  const trompoSection = document.getElementById('v-trompo-section');
  if (trompoSection) trompoSection.classList.remove('hidden');
  document.getElementById('v-tipo').value = vehicleData.tipo || '';
  document.getElementById('v-subtipo').value = vehicleData.subtipo || '';
  document.getElementById('v-kilometraje').value = vehicleData.kilometraje || '';
  setDateField('v-vtvFechaRealizacion', vehicleData.vtv?.fechaRealizacion || null);
  setDateField('v-vencimientoVTV', vehicleData.vtv?.fechaVencimiento || null);
  document.getElementById('v-vtvCosto').value = vehicleData.vtv?.costo || '';
  document.getElementById('v-vtvCentro').value = vehicleData.vtv?.centroMedicion || '';
  document.getElementById('v-vtvResultado').value = vehicleData.vtv?.resultado || 'Pendiente';
  document.getElementById('v-seguroCompania').value = vehicleData.seguro?.compania || vehicleData.seguro?.compañía || '';
  document.getElementById('v-seguroPoliza').value = vehicleData.seguro?.poliza || '';
  document.getElementById('v-seguroTipo').value = vehicleData.seguro?.tipo || '';
  setDateField('v-seguroVencimiento', vehicleData.seguro?.fechaVencimiento || null);
  document.getElementById('v-seguroCosto').value = vehicleData.seguro?.costo || '';
  document.getElementById('v-matafuegoEstado').value = vehicleData.matafuego?.estado || 'Sin Matafuego';
  setDateField('v-matafuegoFechaControl', vehicleData.matafuego?.fechaControl || null);
  setDateField('v-matafuegoFechaVto', vehicleData.matafuego?.fechaVto || null);
  document.getElementById('v-proximoServiceKm').value = vehicleData.proximoServiceKm || '';
  setDateField('v-proximoServiceFecha', vehicleData.proximoServiceFecha);
  document.getElementById('v-centroTrabajo').value = vehicleData.centroTrabajo || '';
  document.getElementById('v-chofer').value = vehicleData.chofer || '';
  document.getElementById('v-dni').value = vehicleData.dni || '';
  setDateField('v-vencimientoDNI', vehicleData.vencimientoDNI || null);
  document.getElementById('v-registro').value = vehicleData.registro || '';
  setDateField('v-vencimientoRegistro', vehicleData.vencimientoRegistro || null);
  document.getElementById('v-empresa').value = vehicleData.empresa || '';
  document.getElementById('v-observaciones').value = vehicleData.observaciones || '';
  document.getElementById('v-foto').value = vehicleData.fotoURL || '';

  showModal('modal-vehiculo');
  updateCompleteness();
}

function updateCompleteness() {
  const fields = ['v-patente', 'v-marca', 'v-modelo', 'v-anio', 'v-tipo', 'v-kilometraje', 'v-centroTrabajo', 'v-chofer', 'v-dni', 'v-registro', 'v-empresa'];
  const filled = fields.filter(id => {
    const el = document.getElementById(id);
    return el && el.value && el.value.trim();
  }).length;
  const pct = Math.round((filled / fields.length) * 100);
  const fillEl = document.getElementById('completeness-fill');
  const textEl = document.getElementById('completeness-text');
  if (fillEl) {
    fillEl.style.width = pct + '%';
    fillEl.className = 'completeness-fill ' + (pct < 40 ? 'low' : pct < 75 ? 'mid' : 'high');
  }
  if (textEl) textEl.textContent = pct + '%';
}

function closeVehicleModal() {
  hideModal('modal-vehiculo');
}

function setDateField(id, val) {
  const el = document.getElementById(id);
  if (!val) { el.value = ''; return; }
  const d = val.toDate ? val.toDate() : new Date(val);
  el.value = d.toISOString().split('T')[0];
}

function getDateValue(id) {
  const val = document.getElementById(id).value;
  return val ? firebase.firestore.Timestamp.fromDate(new Date(val + 'T00:00:00')) : null;
}

document.getElementById('form-vehiculo')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAdmin()) return;

  const data = {
    patente: document.getElementById('v-patente').value.trim().toUpperCase(),
    interno: document.getElementById('v-interno').value.trim(),
    marca: document.getElementById('v-marca').value,
    modelo: document.getElementById('v-modelo').value.trim(),
    año: parseInt(document.getElementById('v-anio').value) || null,
    chasis: document.getElementById('v-chasis').value.trim() || '',
    numeroMotor: document.getElementById('v-numeroMotor').value.trim() || '',
    nroBet: document.getElementById('v-nroBet').value.trim() || '',
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
    matafuego: {
      estado: document.getElementById('v-matafuegoEstado').value || 'Sin Matafuego',
      fechaControl: getDateValue('v-matafuegoFechaControl'),
      fechaVto: getDateValue('v-matafuegoFechaVto')
    },
    proximoServiceKm: parseInt(document.getElementById('v-proximoServiceKm').value) || null,
    proximoServiceFecha: getDateValue('v-proximoServiceFecha'),
    centroTrabajo: document.getElementById('v-centroTrabajo').value,
    chofer: document.getElementById('v-chofer').value.trim() || '',
    dni: document.getElementById('v-dni').value.trim() || '',
    vencimientoDNI: getDateValue('v-vencimientoDNI'),
    registro: document.getElementById('v-registro').value.trim() || '',
    vencimientoRegistro: getDateValue('v-vencimientoRegistro'),
    empresa: document.getElementById('v-empresa').value.trim() || '',
    observaciones: document.getElementById('v-observaciones').value.trim() || '',
    fotoURL: document.getElementById('v-foto').value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    showLoading(true);
    await db.collection('vehicles').doc(vehicleId).update(data);
    showToast('Vehículo actualizado ✅');
    closeVehicleModal();
    loadVehicle();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
});

const SERVICE_DEFAULT_KM = {
  'Cambio de aceite': 10000,
  'Cambio filtro de aceite': 10000,
  'Cambio filtro de combustible': 20000,
  'Cambio filtro de aire': 30000,
  'Cambio filtro de habitáculo': 15000,
  'Alineación': 10000,
  'Balanceo': 10000,
  'Control de caja': 50000,
  'Control de diferencial': 50000,
  'Caja y diferencial': 50000,
  'Control de neumáticos': 10000,
  'Cambio pastillas de freno': 40000,
  'Cambio líquido de frenos': 40000,
  'Cambio correa de distribución': 90000,
  'Control de batería': 30000,
  'Control de refrigerante': 30000
};

const SERVICE_FLUIDO = {
  'Cambio filtro de aceite': 'Cambio de aceite',
  'Cambio pastillas de freno': 'Cambio líquido de frenos'
};

function addServicioSuggestion(name) {
  if (!name) return;
  const dl = document.getElementById('servicios-list');
  if (!dl || [...dl.options].some(o => o.value === name)) return;
  const opt = document.createElement('option');
  opt.value = name;
  dl.appendChild(opt);
}

function addRepuestoTipoSuggestion(name) {
  if (!name) return;
  const dl = document.getElementById('repuesto-tipo-list');
  if (!dl || [...dl.options].some(o => o.value === name)) return;
  const opt = document.createElement('option');
  opt.value = name;
  dl.appendChild(opt);
}

function initServiceForm() {
  const form = document.getElementById('form-service');
  if (!form) return;
  document.getElementById('s-fecha').value = new Date().toISOString().split('T')[0];

  const tipoEl = document.getElementById('s-tipo');
  const kmEl = document.getElementById('s-km');
  const intervaloEl = document.getElementById('s-intervalo');
  const proximoKmEl = document.getElementById('s-proximoKm');
  const fluidGroup = document.getElementById('s-fluid-group');
  const fluidCheck = document.getElementById('s-incluyeFluido');
  const fluidLabel = document.getElementById('s-fluid-label');

  const serviciosList = document.getElementById('servicios-list');
  if (serviciosList) {
    serviciosList.innerHTML = Object.keys(SERVICE_DEFAULT_KM).map(s => `<option value="${s}"></option>`).join('');
  }

  const updateProximoKm = () => {
    if (proximoKmTouched) return;
    const km = parseInt(kmEl.value) || 0;
    const intervalo = parseInt(intervaloEl.value) || 0;
    proximoKmEl.value = (km && intervalo) ? km + intervalo : '';
  };

  proximoKmEl.addEventListener('input', () => { proximoKmTouched = true; });

  const updateFluido = () => {
    const fluido = SERVICE_FLUIDO[tipoEl.value];
    if (fluido) {
      fluidLabel.textContent = `Incluir ${fluido.toLowerCase()}`;
      fluidCheck.checked = true;
      fluidGroup.classList.remove('hidden');
      fluidGroup.classList.add('flex');
    } else {
      fluidCheck.checked = false;
      fluidGroup.classList.add('hidden');
      fluidGroup.classList.remove('flex');
    }
  };

  tipoEl.addEventListener('input', () => {
    addServicioSuggestion(tipoEl.value);
    const def = SERVICE_DEFAULT_KM[tipoEl.value];
    if (def) {
      intervaloEl.value = def;
      updateProximoKm();
    }
    updateFluido();
  });
  kmEl.addEventListener('input', updateProximoKm);
  intervaloEl.addEventListener('input', updateProximoKm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin()) return;
    const km = parseInt(kmEl.value) || null;
    const intervalo = parseInt(intervaloEl.value) || null;
    const proximoKm = parseInt(proximoKmEl.value) || (km && intervalo ? km + intervalo : null);
    const fechaStr = document.getElementById('s-fecha').value;
    const proximoFechaStr = document.getElementById('s-proximoFecha').value;
    const data = {
      fecha: fechaStr ? firebase.firestore.Timestamp.fromDate(new Date(fechaStr + 'T00:00:00')) : null,
      tipo: tipoEl.value,
      km: km,
      intervaloKm: intervalo,
      proximoKm: proximoKm,
      proximoFecha: proximoFechaStr
        ? firebase.firestore.Timestamp.fromDate(new Date(proximoFechaStr + 'T00:00:00'))
        : null,
      proveedor: document.getElementById('s-proveedor').value.trim() || '',
      observaciones: document.getElementById('s-obs').value.trim() || ''
    };
    if (!fluidGroup.classList.contains('hidden') && fluidCheck.checked) {
      data.fluido = SERVICE_FLUIDO[tipoEl.value];
    }
    try {
      showLoading(true);
      const ref = db.collection('vehicles').doc(vehicleId).collection('services');
      if (editingServiceId) {
        await ref.doc(editingServiceId).update(data);
        showToast('Service actualizado');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await ref.add(data);
        showToast('Service registrado');
      }
      await updateVehicleServiceSummary();
      form.reset();
      document.getElementById('s-fecha').value = new Date().toISOString().split('T')[0];
      proximoKmTouched = false;
      editingServiceId = null;
      const submitBtn = document.getElementById('service-submit-btn');
      if (submitBtn) submitBtn.textContent = 'Agregar Service';
      const cancelBtn = document.getElementById('service-cancel-btn');
      if (cancelBtn) cancelBtn.classList.add('hidden');
      updateProximoKm();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

async function updateVehicleServiceSummary() {
  try {
    const snap = await db.collection('vehicles').doc(vehicleId).collection('services').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const summary = {};
    let minKm = null;
    let minFecha = null;
    items.forEach(s => {
      const tipo = s.tipo || 'Otro';
      const cur = summary[tipo];
      const curDate = cur && cur.fecha ? (cur.fecha.toDate ? cur.fecha.toDate().getTime() : new Date(cur.fecha).getTime()) : 0;
      const newDate = s.fecha ? (s.fecha.toDate ? s.fecha.toDate().getTime() : new Date(s.fecha).getTime()) : 0;
      if (!cur || newDate >= curDate) {
        summary[tipo] = { fecha: s.fecha || null, km: s.km || null, proximoKm: s.proximoKm || null, proximoFecha: s.proximoFecha || null };
      }
      if (s.proximoKm != null && (minKm === null || s.proximoKm < minKm)) {
        minKm = s.proximoKm;
        minFecha = s.proximoFecha || null;
      }
    });
    const update = {
      serviceSummary: summary,
      proximoServiceKm: minKm,
      proximoServiceFecha: minFecha,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('vehicles').doc(vehicleId).update(update);
    if (vehicleData) {
      vehicleData = { ...vehicleData, ...update };
      renderService();
    }
  } catch (err) {
    console.error('updateServiceSummary error:', err);
  }
}

function initRepuestoForm() {
  const form = document.getElementById('form-repuesto');
  if (!form) return;
  document.getElementById('r-fecha').value = new Date().toISOString().split('T')[0];
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin()) return;
    const fechaStr = document.getElementById('r-fecha').value;
    const data = {
      fecha: fechaStr ? firebase.firestore.Timestamp.fromDate(new Date(fechaStr + 'T00:00:00')) : null,
      pieza: document.getElementById('r-pieza').value.trim(),
      proveedor: document.getElementById('r-proveedor').value.trim() || '',
      tipo: document.getElementById('r-tipo').value,
      km: parseInt(document.getElementById('r-km').value) || null,
      observaciones: document.getElementById('r-obs').value.trim() || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      showLoading(true);
      await db.collection('vehicles').doc(vehicleId).collection('repuestos').add(data);
      showToast('Repuesto registrado');
      form.reset();
      document.getElementById('r-fecha').value = new Date().toISOString().split('T')[0];
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

function startServicesListener() {
  if (servicesUnsub) servicesUnsub();
  servicesUnsub = db.collection('vehicles').doc(vehicleId).collection('services')
    .orderBy('fecha', 'desc')
    .onSnapshot(snapshot => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      window.allServicesData = items;
      items.forEach(s => addServicioSuggestion(s.tipo));
      renderServices(items);
      renderHistorial();
    }, err => {
      console.error('services error:', err);
      const tb = document.getElementById('services-table-body');
      if (tb) tb.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-red-500">Error al cargar</td></tr>';
    });
}

function startRepuestosListener() {
  if (repuestosUnsub) repuestosUnsub();
  repuestosUnsub = db.collection('vehicles').doc(vehicleId).collection('repuestos')
    .orderBy('fecha', 'desc')
    .onSnapshot(snapshot => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      window.allRepuestosData = items;
      items.forEach(r => addRepuestoTipoSuggestion(r.tipo));
      renderRepuestos(items);
      renderHistorial();
    }, err => {
      console.error('repuestos error:', err);
      document.getElementById('repuestos-table-body').innerHTML =
        '<tr><td colspan="6" class="text-center py-8 text-red-500">Error al cargar</td></tr>';
    });
}

function renderServices(items) {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-[#4a5568]">Sin services registrados</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(s => `
    <tr class="border-b border-white/5 hover:bg-[#d4af37]/10">
      <td class="py-2 pr-2">${formatDate(s.fecha)}</td>
      <td class="py-2 pr-2 font-medium">${s.tipo || '-'}${s.fluido ? ` <span class="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B]">+ ${s.fluido}</span>` : ''}</td>
      <td class="py-2 pr-2">${s.km?.toLocaleString() || '-'}</td>
      <td class="py-2 pr-2">${s.proximoKm?.toLocaleString() || '-'}</td>
      <td class="py-2 pr-2">${s.proveedor || '-'}</td>
      <td class="py-2 no-print"><button onclick="viewService('${s.id}')" class="text-[#8b9bb4] hover:text-[#ffffff] mr-2" title="Ver detalle"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>${isAdmin() ? `<button onclick="editService('${s.id}')" class="text-[#8b9bb4] hover:text-[#ffffff] mr-2" title="Editar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>` : ''}${isAdmin() ? `<button onclick="deleteService('${s.id}')" class="text-red-400 hover:text-red-300" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ''}</td>
    </tr>
  `).join('');
}

function renderRepuestos(items) {
  const tbody = document.getElementById('repuestos-table-body');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-[#4a5568]">Sin repuestos registrados</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(r => `
    <tr class="border-b border-white/5 hover:bg-[#d4af37]/10">
      <td class="py-2 pr-2">${formatDate(r.fecha)}</td>
      <td class="py-2 pr-2">${r.tipo || '-'}</td>
      <td class="py-2 pr-2 font-medium">${r.pieza || '-'}</td>
      <td class="py-2 pr-2">${r.proveedor || '-'}</td>
      <td class="py-2 pr-2">${r.km?.toLocaleString() || '-'}</td>
      <td class="py-2 no-print"><button onclick="viewRepuesto('${r.id}')" class="text-[#8b9bb4] hover:text-[#ffffff] mr-2" title="Ver detalle"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>${isAdmin() ? `<button onclick="deleteRepuesto('${r.id}')" class="text-red-400 hover:text-red-300" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ''}</td>
    </tr>
  `).join('');
}

function exportServicesCSV() {
  const items = window.allServicesData || [];
  if (!items.length) { showToast('No hay datos para exportar', 'info'); return; }
  const headers = ['Fecha', 'Servicio', 'Incluye', 'Km', 'Intervalo', 'Próximo Km', 'Próxima Fecha', 'Proveedor', 'Observaciones'];
  const rows = items.map(s => [
    formatDate(s.fecha),
    s.tipo || '',
    s.fluido || '',
    s.km || '',
    s.intervaloKm || '',
    s.proximoKm || '',
    formatDate(s.proximoFecha),
    s.proveedor || '',
    s.observaciones || ''
  ]);
  downloadCSV(`services-${vehicleData?.patente || vehicleId}.csv`, headers, rows);
}

function exportRepuestosCSV() {
  const items = window.allRepuestosData || [];
  if (!items.length) { showToast('No hay datos para exportar', 'info'); return; }
  const headers = ['Fecha', 'Tipo', 'Pieza', 'Proveedor', 'Km', 'Observaciones'];
  const rows = items.map(r => [
    formatDate(r.fecha),
    r.tipo || '',
    r.pieza || '',
    r.proveedor || '',
    r.km || '',
    r.observaciones || ''
  ]);
  downloadCSV(`repuestos-${vehicleData?.patente || vehicleId}.csv`, headers, rows);
}

function downloadCSV(filename, headers, rows) {
  const BOM = '\uFEFF';
  const csv = BOM + headers.join(',') + '\n' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(`CSV exportado: ${filename}`);
}

async function deleteService(id) {
  if (!isAdmin() || !confirm('¿Eliminar este service?')) return;
  try {
    await db.collection('vehicles').doc(vehicleId).collection('services').doc(id).delete();
    await updateVehicleServiceSummary();
    showToast('Service eliminado');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function editService(id) {
  if (!isAdmin()) return;
  const s = (window.allServicesData || []).find(x => x.id === id);
  if (!s) return;
  const toDateInput = (v) => {
    if (!v) return '';
    const d = v.toDate ? v.toDate() : new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  editingServiceId = id;
  proximoKmTouched = true;
  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
  setVal('s-fecha', toDateInput(s.fecha));
  setVal('s-tipo', s.tipo || '');
  setVal('s-km', s.km != null ? s.km : '');
  setVal('s-intervalo', s.intervaloKm != null ? s.intervaloKm : '');
  setVal('s-proximoKm', s.proximoKm != null ? s.proximoKm : '');
  setVal('s-proximoFecha', toDateInput(s.proximoFecha));
  setVal('s-proveedor', s.proveedor || '');
  setVal('s-obs', s.observaciones || '');

  const tipoVal = s.tipo || '';
  const fluid = SERVICE_FLUIDO[tipoVal];
  const fluidLabel = document.getElementById('s-fluid-label');
  if (fluid && fluidLabel) fluidLabel.textContent = `Incluir ${fluid.toLowerCase()}`;
  const fluidCheck = document.getElementById('s-incluyeFluido');
  const fluidGroup = document.getElementById('s-fluid-group');
  if (fluidGroup && fluidCheck) {
    if (s.fluido) {
      fluidCheck.checked = true;
      fluidGroup.classList.remove('hidden');
      fluidGroup.classList.add('flex');
    } else {
      fluidCheck.checked = false;
      fluidGroup.classList.add('hidden');
      fluidGroup.classList.remove('flex');
    }
  }

  const submitBtn = document.getElementById('service-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Actualizar Service';
  const cancelBtn = document.getElementById('service-cancel-btn');
  if (cancelBtn) cancelBtn.classList.remove('hidden');
  const form = document.getElementById('form-service');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelServiceEdit() {
  editingServiceId = null;
  proximoKmTouched = false;
  const form = document.getElementById('form-service');
  if (form) form.reset();
  const fechaEl = document.getElementById('s-fecha');
  if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];
  const submitBtn = document.getElementById('service-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Agregar Service';
  const cancelBtn = document.getElementById('service-cancel-btn');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  const fluidGroup = document.getElementById('s-fluid-group');
  if (fluidGroup) { fluidGroup.classList.add('hidden'); fluidGroup.classList.remove('flex'); }
}

async function deleteRepuesto(id) {
  if (!isAdmin() || !confirm('¿Eliminar este repuesto?')) return;
  try {
    await db.collection('vehicles').doc(vehicleId).collection('repuestos').doc(id).delete();
    showToast('Repuesto eliminado');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ───────── Detalle (modal) ───────── */

function openDetailModal(title, rows) {
  const body = document.getElementById('modal-detalle-body');
  const t = document.getElementById('modal-detalle-title');
  if (t) t.textContent = title;
  if (body) {
    body.innerHTML = rows.filter(([, v]) => v != null && v !== '' && v !== '-').map(([k, v]) => `
      <div class="flex justify-between gap-4 py-2 border-b border-white/5">
        <span class="text-[#8b9bb4] text-sm shrink-0">${k}</span>
        <span class="text-[#ffffff] text-sm text-right break-words">${v}</span>
      </div>
    `).join('') || '<p class="text-[#4a5568] text-sm">Sin datos</p>';
  }
  showModal('modal-detalle');
}

function closeDetailModal() {
  hideModal('modal-detalle');
}

function viewService(id) {
  const s = (window.allServicesData || []).find(x => x.id === id);
  if (!s) return;
  openDetailModal('Detalle de Service', [
    ['Fecha', formatDate(s.fecha)],
    ['Servicio', s.tipo],
    ['Incluye', s.fluido],
    ['Km', s.km != null ? s.km.toLocaleString('es-AR') : ''],
    ['Intervalo (km)', s.intervaloKm != null ? s.intervaloKm.toLocaleString('es-AR') : ''],
    ['Próximo km', s.proximoKm != null ? s.proximoKm.toLocaleString('es-AR') : ''],
    ['Próxima fecha', formatDate(s.proximoFecha)],
    ['Proveedor', s.proveedor],
    ['Observaciones', s.observaciones]
  ]);
}

function viewRepuesto(id) {
  const r = (window.allRepuestosData || []).find(x => x.id === id);
  if (!r) return;
  openDetailModal('Detalle de Repuesto', [
    ['Fecha', formatDate(r.fecha)],
    ['Tipo', r.tipo],
    ['Pieza', r.pieza],
    ['Proveedor', r.proveedor],
    ['Km', r.km != null ? r.km.toLocaleString('es-AR') : ''],
    ['Observaciones', r.observaciones]
  ]);
}

/* ───────── Barcode ───────── */

function getBarcodeText() {
  const mode = document.getElementById('barcode-content')?.value || 'patente';
  switch (mode) {
    case 'interno': return vehicleData?.interno || '';
    case 'patente-interno': return `${vehicleData?.patente || ''} ${vehicleData?.interno || ''}`;
    default: return vehicleData?.patente || '';
  }
}

function generateBarcode() {
  if (!vehicleData || typeof JsBarcode === 'undefined') return;

  const format = document.getElementById('barcode-format')?.value || 'CODE128';
  const text = getBarcodeText();
  if (!text) return;

  const svgEl = document.getElementById('barcode-svg');
  if (!svgEl) return;

  try {
    JsBarcode(svgEl, text, {
      format: format,
      width: 2,
      height: 80,
      displayValue: true,
      fontSize: 16,
      margin: 10,
      background: '#ffffff',
      lineColor: '#1a1a2e'
    });
  } catch (e) {
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', '0 0 300 40');
    svgEl.innerHTML = `<text x="10" y="25" fill="red" font-size="14">Error: ${e.message}</text>`;
  }

  setText('barcode-empresa', vehicleData?.empresa || 'Grupo Falpat SRL');
  setText('barcode-vehiculo-id', `Int. ${vehicleData?.interno || ''} — ${vehicleData?.patente || ''}`);
}

function getBarcodeCanvas() {
  const svgEl = document.getElementById('barcode-svg');
  if (!svgEl || !svgEl.querySelector('rect')) return null;

  return new Promise((resolve) => {
    const svgClone = svgEl.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function printBarcode() {
  getBarcodeCanvas().then((canvas) => {
    if (!canvas) {
      showToast('Generá el código de barras primero', 'error');
      return;
    }

    const v = vehicleData || {};
    const empresa = v.empresa || 'Grupo Falpat SRL';
    const imgData = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Barcode - ${v.patente || 'Vehiculo'}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        @page{size:A4 portrait;margin:10mm}
        body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#fff;color:#1a1a2e;display:flex;justify-content:center;padding:20px}
        .card{width:100%;max-width:480px;border:3px solid #1a1a2e;border-radius:16px;overflow:hidden;text-align:center}
        .header{background:#1a1a2e;color:#fff;padding:12px 16px}
        .header .patente{font-size:28px;font-weight:800;letter-spacing:2px}
        .header .interno{font-size:14px;opacity:.85;margin-top:2px}
        .body-card{padding:20px}
        .barcode-section{margin:16px auto;text-align:center}
        .barcode-section img{max-width:100%;height:auto}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;text-align:left;margin-top:16px;padding-top:16px;border-top:2px solid #e5e7eb}
        .info-item .label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600}
        .info-item .value{font-size:13px;font-weight:600;color:#1a1a2e;margin-top:1px}
        .footer-bar{background:#f9fafb;padding:10px 16px;border-top:2px solid #e5e7eb;font-size:11px;color:#6b7280}
        .footer-bar strong{color:#1a1a2e;font-size:13px}
        @media print{body{padding:0}.card{border-radius:0}}
      </style></head><body>
      <div class="card">
        <div class="header">
          <div class="patente">${v.patente || ''}</div>
          <div class="interno">Interno ${v.interno || ''}</div>
        </div>
        <div class="body-card">
          <div class="barcode-section"><img src="${imgData}" /></div>
          <div class="info-grid">
            <div class="info-item"><div class="label">Marca / Modelo</div><div class="value">${v.marca || ''} ${v.modelo || ''}</div></div>
            <div class="info-item"><div class="label">Tipo</div><div class="value">${v.tipo || ''} ${v.subtipo || ''}</div></div>
            <div class="info-item"><div class="label">Chofer</div><div class="value">${v.chofer || '-'}</div></div>
            <div class="info-item"><div class="label">Centro Trabajo</div><div class="value">${v.centroTrabajo || '-'}</div></div>
            <div class="info-item"><div class="label">Ano</div><div class="value">${v.año || '-'}</div></div>
            <div class="info-item"><div class="label">Estado</div><div class="value">${v.estadoGeneral || '-'}</div></div>
          </div>
        </div>
        <div class="footer-bar"><strong>${empresa}</strong>Escanea para ver detalle del vehiculo</div>
      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  });
}

function downloadBarcodePNG() {
  getBarcodeCanvas().then((barcodeCanvas) => {
    if (!barcodeCanvas) {
      showToast('Generá el código de barras primero', 'error');
      return;
    }

    const v = vehicleData || {};
    const empresa = v.empresa || 'Grupo Falpat SRL';
    const W = 600;
    const headerH = 80;
    const barcodeH = 140;
    const infoH = 140;
    const footerH = 50;
    const totalH = headerH + barcodeH + 60 + infoH + footerH;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    c.width = W;
    c.height = totalH;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, headerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.patente || '', W / 2, 40);
    ctx.font = '14px Arial, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(`Interno ${v.interno || ''}`, W / 2, 62);
    ctx.globalAlpha = 1;

    const bcY = headerH + 20;
    const bcW = barcodeCanvas.width;
    const bcHeight = barcodeCanvas.height;
    const scale = Math.min((W - 40) / bcW, barcodeH / bcHeight);
    const drawW = bcW * scale;
    const drawH = bcHeight * scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((W - drawW) / 2 - 10, bcY - 5, drawW + 20, drawH + 10);
    ctx.drawImage(barcodeCanvas, (W - drawW) / 2, bcY, drawW, drawH);

    const infoY = bcY + barcodeH + 20;
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, infoY - 10, W, infoH + 20);
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'left';
    const leftX = 60;
    const rightX = W / 2 + 30;
    const lineH = 28;
    const items = [
      [leftX, 'Marca / Modelo', `${v.marca || ''} ${v.modelo || ''}`],
      [rightX, 'Tipo', `${v.tipo || ''} ${v.subtipo || ''}`],
      [leftX + lineH, 'Chofer', v.chofer || '-'],
      [rightX + lineH, 'Centro', v.centroTrabajo || '-'],
      [leftX + lineH * 2, 'Ano', v.año || '-'],
      [rightX + lineH * 2, 'Estado', v.estadoGeneral || '-']
    ];
    items.forEach(([yOffset, label, value]) => {
      const x = yOffset === leftX || yOffset === leftX + lineH || yOffset === leftX + lineH * 2 ? leftX : rightX;
      ctx.font = '9px Arial, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(label.toUpperCase(), x, infoY + (yOffset - leftX));
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.fillStyle = '#1a1a2e';
      ctx.fillText(value, x, infoY + (yOffset - leftX) + 14);
    });

    const footY = totalH - footerH;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, footY, W, footerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(empresa, W / 2, footY + 20);
    ctx.font = '10px Arial, sans-serif';
    ctx.globalAlpha = 0.7;
    ctx.fillText('Escanea para ver detalle del vehiculo', W / 2, footY + 36);

    const link = document.createElement('a');
    link.download = `barcode-${v.patente || 'vehiculo'}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
    showToast('Código de barras descargado');
  });
}

function downloadBarcodePDF() {
  getBarcodeCanvas().then((canvas) => {
    if (!canvas) {
      showToast('Generá el código de barras primero', 'error');
      return;
    }

    const v = vehicleData || {};
    const empresa = v.empresa || 'Grupo Falpat SRL';
    const imgData = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Barcode - ${v.patente || ''}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        @page{size:A4 portrait;margin:10mm}
        body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#fff;color:#1a1a2e;display:flex;justify-content:center;padding:20px}
        .card{width:100%;max-width:480px;border:3px solid #1a1a2e;border-radius:16px;overflow:hidden;text-align:center}
        .header{background:#1a1a2e;color:#fff;padding:12px 16px}
        .header .patente{font-size:28px;font-weight:800;letter-spacing:2px}
        .header .interno{font-size:14px;opacity:.85;margin-top:2px}
        .body-card{padding:20px}
        .barcode-section{margin:16px auto;text-align:center}
        .barcode-section img{max-width:100%;height:auto}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;text-align:left;margin-top:16px;padding-top:16px;border-top:2px solid #e5e7eb}
        .info-item .label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600}
        .info-item .value{font-size:13px;font-weight:600;color:#1a1a2e;margin-top:1px}
        .footer-bar{background:#f9fafb;padding:10px 16px;border-top:2px solid #e5e7eb;font-size:11px;color:#6b7280}
        .footer-bar strong{color:#1a1a2e;font-size:13px}
        @media print{body{padding:0}.card{border-radius:0}}
      </style></head><body>
      <div class="card">
        <div class="header">
          <div class="patente">${v.patente || ''}</div>
          <div class="interno">Interno ${v.interno || ''}</div>
        </div>
        <div class="body-card">
          <div class="barcode-section"><img src="${imgData}" /></div>
          <div class="info-grid">
            <div class="info-item"><div class="label">Marca / Modelo</div><div class="value">${v.marca || ''} ${v.modelo || ''}</div></div>
            <div class="info-item"><div class="label">Tipo</div><div class="value">${v.tipo || ''} ${v.subtipo || ''}</div></div>
            <div class="info-item"><div class="label">Chofer</div><div class="value">${v.chofer || '-'}</div></div>
            <div class="info-item"><div class="label">Centro Trabajo</div><div class="value">${v.centroTrabajo || '-'}</div></div>
            <div class="info-item"><div class="label">Ano</div><div class="value">${v.año || '-'}</div></div>
            <div class="info-item"><div class="label">Estado</div><div class="value">${v.estadoGeneral || '-'}</div></div>
          </div>
        </div>
        <div class="footer-bar"><strong>${empresa}</strong>Escanea para ver detalle del vehiculo</div>
      </div>
      <script>setTimeout(()=>{window.print();},500);<\/script>
    </body></html>`);
    win.document.close();
  });
}

function renderHistorial() {
  const tbody = document.getElementById('historial-table-body');
  if (!tbody) return;
  const view = document.getElementById('historial-view')?.value || 'tiempo';

  const toItem = (r, kind) => ({
    id: r.id,
    rec: r,
    kind,
    fecha: r.fecha ? (r.fecha.toDate ? r.fecha.toDate() : new Date(r.fecha)) : null
  });

  const services = (window.allServicesData || []).map(r => toItem(r, 'service'));
  const repuestos = (window.allRepuestosData || []).map(r => toItem(r, 'repuesto'));

  if (!services.length && !repuestos.length) {
    tbody.innerHTML = '<tr><td class="text-center py-8 text-[#4a5568]">Sin movimientos registrados</td></tr>';
    return;
  }

  const badge = (item) => `<span class="px-2 py-0.5 rounded-full text-xs font-medium mr-2" style="background:${item.kind === 'service' ? '#F59E0B20' : '#10B98120'};color:${item.kind === 'service' ? '#F59E0B' : '#10B981'}">${item.kind === 'service' ? 'Service' : 'Repuesto'}</span>`;

  const line = (item) => {
    const r = item.rec;
    const parts = [];
    parts.push(item.fecha ? item.fecha.toLocaleDateString('es-AR') : '-');
    if (item.kind === 'service') {
      parts.push(r.tipo || '');
      if (r.fluido) parts.push('+ ' + r.fluido);
      if (r.km != null) parts.push(r.km.toLocaleString('es-AR') + ' km');
      if (r.proximoKm != null) parts.push('→ ' + r.proximoKm.toLocaleString('es-AR') + ' km');
      if (r.proveedor) parts.push(r.proveedor);
      if (r.observaciones) parts.push('«' + r.observaciones + '»');
    } else {
      parts.push(r.tipo || '');
      if (r.pieza) parts.push(r.pieza);
      if (r.km != null) parts.push(r.km.toLocaleString('es-AR') + ' km');
      if (r.proveedor) parts.push(r.proveedor);
      if (r.observaciones) parts.push('«' + r.observaciones + '»');
    }
    return parts.filter(Boolean).join(' · ');
  };

  const rowHtml = (item, showBadge) => `
    <tr class="border-b border-white/5 hover:bg-[#d4af37]/10 cursor-pointer" onclick="${item.kind === 'service' ? 'viewService' : 'viewRepuesto'}('${item.id}')" title="Ver detalle">
      <td class="py-2 px-3 text-xs text-[#ffffff] break-words">${showBadge ? badge(item) : ''}${line(item)}</td>
    </tr>`;

  const sectionHeader = (title, color, count) => `
    <tr class="bg-[#d4af37]/15">
      <td class="py-2 px-3 text-xs font-bold text-[#ffffff]">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium mr-2" style="background:${color}20;color:${color}">${title}</span>
        ${count} registro(s)
      </td>
    </tr>`;

  const groupHeader = (label, count) => `
    <tr class="bg-[#0a0e17]/40">
      <td class="py-1.5 px-3 text-xs font-semibold text-[#8b9bb4]">${label} <span class="text-[#4a5568]">(${count})</span></td>
    </tr>`;

  const sortDesc = (arr) => arr.slice().sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  let body = '';

  if (view === 'tiempo') {
    body = sortDesc([...services, ...repuestos]).map(item => rowHtml(item, true)).join('');
  } else if (view === 'mes') {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const groups = {};
    [...services, ...repuestos].forEach(item => {
      const d = item.fecha;
      const k = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'sinfecha';
      (groups[k] = groups[k] || []).push(item);
    });
    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(k => {
      const items = sortDesc(groups[k]);
      let label = 'Sin fecha';
      if (k !== 'sinfecha') {
        const [y, m] = k.split('-');
        label = `${months[parseInt(m) - 1]} ${y}`;
      }
      body += groupHeader(label, items.length) + items.map(i => rowHtml(i, true)).join('');
    });
  } else if (view === 'proveedor') {
    const groups = {};
    [...services, ...repuestos].forEach(item => {
      const k = (item.rec.proveedor || '').trim() || 'Sin proveedor';
      (groups[k] = groups[k] || []).push(item);
    });
    Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es')).forEach(k => {
      const items = sortDesc(groups[k]);
      body += groupHeader(k, items.length) + items.map(i => rowHtml(i, true)).join('');
    });
  } else {
    const sections = [
      { title: 'Services', color: '#F59E0B', kind: 'service', items: services },
      { title: 'Repuestos', color: '#10B981', kind: 'repuesto', items: repuestos }
    ];
    sections.forEach(sec => {
      if (!sec.items.length) return;
      const groups = {};
      sec.items.forEach(item => {
        const k = (item.rec.tipo || '').trim() || 'Sin tipo';
        (groups[k] = groups[k] || []).push(item);
      });
      body += sectionHeader(sec.title, sec.color, sec.items.length);
      Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es')).forEach(tipo => {
        const items = sortDesc(groups[tipo]);
        body += groupHeader(tipo, items.length) + items.map(rowHtml).join('');
      });
    });
  }

  tbody.innerHTML = body;
}
