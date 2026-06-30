let vehicleId = null;
let vehicleData = null;
let combustibleUnsub = null;
let repuestosUnsub = null;
let currentTab = 'resumen';
let qrCodeInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  vehicleId = pathParts[pathParts.length - 1];

  if (!vehicleId || vehicleId === 'vehicle-detail') {
    document.getElementById('vehicle-subtitle').textContent = 'ID de vehículo no válido';
    return;
  }

  loadVehicle();
  initCombustibleForm();
  initRepuestoForm();
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
  renderVTV();
  renderService();
  renderMultas();
  renderDocumentos();
  renderFoto();
  document.getElementById('vg-observaciones').textContent = vehicleData.observaciones || 'Sin observaciones';

  generateQR();
  setText('qr-empresa', vehicleData.empresa || 'Grupo Falpat SRL');
  setText('qr-vehiculo-id', `Int. ${vehicleData.interno || ''} — ${vehicleData.patente || ''}`);

  startCombustibleListener();
  startRepuestosListener();
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
  renderTrompo();
  setText('vg-kmhs', `${vehicleData.kilometraje?.toLocaleString() || 0} km`);
  setText('vg-centro', vehicleData.centroTrabajo || '-');
  setText('vg-conductor', vehicleData.conductorHabitual || '-');
  setText('vg-empresa', vehicleData.empresa || '-');
  setText('vg-estadoGeneral', vehicleData.estadoGeneral || '-');
  setText('vg-horometro', vehicleData.horometro ? `${vehicleData.horometro} hs` : '-');
  setText('vg-fechaUltimaRevision', formatDate(vehicleData.fechaUltimaRevision));
  setText('vg-fechaAlta', formatDate(vehicleData.fechaAlta) || formatDate(vehicleData.createdAt) || '-');
}

function renderTrompo() {
  const card = document.getElementById('vg-trompo-card');
  if (!card) return;
  const t = vehicleData.trompo || {};
  const cargaTrompo = vehicleData.cargaTrompo || '';
  const hasTrompo = cargaTrompo.toLowerCase().startsWith('sí') || cargaTrompo.toLowerCase().startsWith('si') || t.tipo || t.numeroSerie || t.marca || t.capacidad || t.modelo;
  if (!hasTrompo) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  setText('vg-trompo-tipo', t.tipo || '-');
  setText('vg-trompo-numeroSerie', t.numeroSerie || '-');
  setText('vg-trompo-marca', t.marca || '-');
  setText('vg-trompo-capacidad', t.capacidad || '-');
  setText('vg-trompo-modelo', t.modelo || '-');
  setText('vg-trompo-otro', t.otro || '-');
  setText('vg-trompo-empresa', vehicleData.empresa || 'Grupo Falpat SRL');
}

function renderSeguro() {
  const s = vehicleData.seguro || {};
  setText('vg-seguroCompania', s.compañía || '-');
  setText('vg-seguroPoliza', s.poliza || '-');
  setText('vg-seguroTipo', s.tipo || '-');
  setText('vg-seguroVencimiento', formatDate(s.fechaVencimiento));
  setText('vg-seguroCosto', s.costo ? formatCurrency(s.costo) : '-');
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
}

function renderMultas() {
  const container = document.getElementById('vg-multas');
  const multas = vehicleData.multas || [];
  if (!multas.length) {
    container.innerHTML = '<span class="italic text-[#5C6378]">Sin multas registradas</span>';
    return;
  }
  container.innerHTML = multas.map(m => `
    <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div>
        <span class="text-[#F1F3F8]">${m.concepto || 'Multa'}</span>
        <span class="text-xs text-[#5C6378] ml-2">${m.fecha || ''}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-red-400 font-medium">${formatCurrency(m.importe)}</span>
        ${m.pagado ? '<span class="text-xs text-green-400">Pagado</span>' : '<span class="text-xs text-yellow-400">Pendiente</span>'}
      </div>
    </div>
  `).join('');
}

function renderDocumentos() {
  const container = document.getElementById('vg-documentos');
  const docs = vehicleData.documentos || [];
  if (!docs.length) {
    container.innerHTML = '<span class="italic text-[#5C6378]">Sin documentos adjuntos</span>';
    return;
  }
  container.innerHTML = docs.map(d => `
    <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div>
        <span class="text-[#F1F3F8]">${d.tipo || 'Documento'}</span>
        ${d.fechaVencimiento ? `<span class="text-xs text-[#5C6378] ml-2">Vence: ${d.fechaVencimiento}</span>` : ''}
      </div>
      ${d.archivoURL ? `<a href="${d.archivoURL}" target="_blank" class="text-[#00D4FF] text-xs hover:underline">Ver</a>` : ''}
    </div>
  `).join('');
}

function renderFoto() {
  const container = document.getElementById('vg-foto-container');
  const img = document.getElementById('vg-foto');
  if (vehicleData.fotoURL) {
    container.classList.remove('hidden');
    img.src = vehicleData.fotoURL;
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
    el.classList.remove('bg-[#6C3CE1]/10', 'text-[#6C3CE1]');
    el.classList.add('text-[#8E94A8]');
  });
  document.getElementById(`tab-content-${tab}`)?.classList.remove('hidden');
  document.getElementById(`tab-${tab}`)?.classList.add('bg-[#6C3CE1]/10', 'text-[#6C3CE1]');

  if (tab === 'qr') {
    setTimeout(generateQR, 100);
  }
}

function generateQR() {
  const container = document.getElementById('qrcode');
  if (!container) return;

  container.innerHTML = '';

  const qrUrl = window.location.href;
  if (typeof QRCode !== 'undefined') {
    qrCodeInstance = new QRCode(container, {
      text: qrUrl,
      width: 280,
      height: 280,
      colorDark: '#1a1a2e',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">Cargando librería QR...</p>';
    setTimeout(generateQR, 500);
  }
}

function printQR() {
  const canvas = document.querySelector('#qrcode canvas') || document.querySelector('#qrcode img');
  if (!canvas) return;
  const win = window.open('', '_blank');
  const empresa = vehicleData?.empresa || 'Grupo Falpat SRL';
  win.document.write(`<html><head><title>QR - ${vehicleData?.patente || 'Vehículo'}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{text-align:center;padding:40px;font-family:Arial,sans-serif;background:#fff}
    .qr-wrap{display:inline-block;padding:20px;border:2px solid #eee;border-radius:16px}
    h2{font-size:22px;margin-bottom:4px}
    .sub{color:#666;font-size:14px;margin-bottom:16px}
    .footer{margin-top:16px;padding-top:12px;border-top:1px solid #eee;font-size:13px;color:#444}
    .footer strong{display:block;font-size:15px;color:#111}
    .label{font-size:10px;text-transform:uppercase;color:#999;letter-spacing:1px}
  </style></head><body>
    <div class="qr-wrap">
      <h2>${vehicleData?.patente || ''}</h2>
      <div class="sub">Int. ${vehicleData?.interno || ''} — ${vehicleData?.marca || ''} ${vehicleData?.modelo || ''}</div>
      ${canvas.outerHTML}
      <div class="footer">
        <div class="label">Empresa</div>
        <strong>${empresa}</strong>
        <div style="margin-top:6px" class="label">Interno</div>
        <strong>${vehicleData?.interno || '-'}</strong>
      </div>
    </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 300);
}

function downloadQR() {
  const canvas = document.querySelector('#qrcode canvas');
  if (!canvas) return;
  const empresa = vehicleData?.empresa || 'Grupo Falpat SRL';
  const vehiculo = `${vehicleData?.patente || ''} Int. ${vehicleData?.interno || ''}`;
  const w = canvas.width;
  const h = canvas.height;
  const padding = 40;
  const footerH = 100;
  const totalH = h + padding * 2 + footerH;
  const totalW = w + padding * 2;
  const c = document.createElement('canvas');
  c.width = totalW;
  c.height = totalH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);
  ctx.drawImage(canvas, padding, padding, w, h);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(empresa, totalW / 2, h + padding + 35);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(vehiculo, totalW / 2, h + padding + 60);
  ctx.strokeStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.moveTo(padding, h + padding + 15);
  ctx.lineTo(totalW - padding, h + padding + 15);
  ctx.stroke();
  const link = document.createElement('a');
  link.download = `qr-${vehicleData?.patente || 'vehiculo'}.png`;
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
  document.getElementById('v-capacidadCarga').value = vehicleData.capacidadCarga || '';
  const ct = vehicleData.cargaTrompo || '';
  document.getElementById('v-cargaTrompo').value = (ct.toLowerCase().startsWith('sí') || ct.toLowerCase().startsWith('si')) ? 'Sí' : ct;
  const t = vehicleData.trompo || {};
  document.getElementById('v-trompo-tipo').value = t.tipo || '';
  document.getElementById('v-trompo-numeroSerie').value = t.numeroSerie || '';
  document.getElementById('v-trompo-marca').value = t.marca || '';
  document.getElementById('v-trompo-capacidad').value = t.capacidad || '';
  document.getElementById('v-trompo-modelo').value = t.modelo || '';
  document.getElementById('v-trompo-otro').value = t.otro || '';
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
  document.getElementById('v-seguroCompania').value = vehicleData.seguro?.compañía || '';
  document.getElementById('v-seguroPoliza').value = vehicleData.seguro?.poliza || '';
  document.getElementById('v-seguroTipo').value = vehicleData.seguro?.tipo || '';
  setDateField('v-seguroVencimiento', vehicleData.seguro?.fechaVencimiento || null);
  document.getElementById('v-seguroCosto').value = vehicleData.seguro?.costo || '';
  document.getElementById('v-proximoServiceKm').value = vehicleData.proximoServiceKm || '';
  setDateField('v-proximoServiceFecha', vehicleData.proximoServiceFecha);
  document.getElementById('v-centroTrabajo').value = vehicleData.centroTrabajo || '';
  document.getElementById('v-conductorHabitual').value = vehicleData.conductorHabitual || '';
  document.getElementById('v-empresa').value = vehicleData.empresa || '';
  document.getElementById('v-observaciones').value = vehicleData.observaciones || '';
  document.getElementById('v-foto').value = vehicleData.fotoURL || '';

  showModal('modal-vehiculo');
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

document.addEventListener('click', (e) => {
  const modal = document.getElementById('modal-vehiculo');
  if (modal && e.target === modal) hideModal('modal-vehiculo');
});

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
    capacidadCarga: parseFloat(document.getElementById('v-capacidadCarga').value) || null,
    cargaTrompo: document.getElementById('v-cargaTrompo').value.trim() || '',
    trompo: {
      tipo: document.getElementById('v-trompo-tipo').value.trim() || '',
      numeroSerie: document.getElementById('v-trompo-numeroSerie').value.trim() || '',
      marca: document.getElementById('v-trompo-marca').value.trim() || '',
      capacidad: document.getElementById('v-trompo-capacidad').value.trim() || '',
      modelo: document.getElementById('v-trompo-modelo').value.trim() || '',
      otro: document.getElementById('v-trompo-otro').value.trim() || ''
    },
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

function initCombustibleForm() {
  const form = document.getElementById('form-combustible');
  if (!form) return;
  document.getElementById('c-fecha').value = new Date().toISOString().split('T')[0];
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      fecha: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('c-fecha').value + 'T00:00:00')),
      litros: parseFloat(document.getElementById('c-litros').value),
      importe: parseFloat(document.getElementById('c-importe').value),
      tipo: document.getElementById('c-tipo').value,
      km: parseInt(document.getElementById('c-km').value) || null,
      proveedor: document.getElementById('c-proveedor').value.trim() || '',
      observaciones: document.getElementById('c-obs').value.trim() || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      showLoading(true);
      await db.collection('vehicles').doc(vehicleId).collection('combustible').add(data);
      showToast('Carga de combustible registrada');
      form.reset();
      document.getElementById('c-fecha').value = new Date().toISOString().split('T')[0];
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

function initRepuestoForm() {
  const form = document.getElementById('form-repuesto');
  if (!form) return;
  document.getElementById('r-fecha').value = new Date().toISOString().split('T')[0];
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      fecha: firebase.firestore.Timestamp.fromDate(new Date(document.getElementById('r-fecha').value + 'T00:00:00')),
      pieza: document.getElementById('r-pieza').value.trim(),
      costo: parseFloat(document.getElementById('r-costo').value),
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

function startCombustibleListener() {
  if (combustibleUnsub) combustibleUnsub();
  combustibleUnsub = db.collection('vehicles').doc(vehicleId).collection('combustible')
    .orderBy('fecha', 'desc')
    .onSnapshot(snapshot => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      window.allCombustibleData = items;
      renderCombustible(items);
    }, err => {
      console.error('combustible error:', err);
      document.getElementById('combustible-table-body').innerHTML =
        '<tr><td colspan="7" class="text-center py-8 text-red-500">Error al cargar</td></tr>';
    });
}

function startRepuestosListener() {
  if (repuestosUnsub) repuestosUnsub();
  repuestosUnsub = db.collection('vehicles').doc(vehicleId).collection('repuestos')
    .orderBy('fecha', 'desc')
    .onSnapshot(snapshot => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      window.allRepuestosData = items;
      renderRepuestos(items);
    }, err => {
      console.error('repuestos error:', err);
      document.getElementById('repuestos-table-body').innerHTML =
        '<tr><td colspan="7" class="text-center py-8 text-red-500">Error al cargar</td></tr>';
    });
}

function renderCombustible(items) {
  const tbody = document.getElementById('combustible-table-body');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-[#5C6378]">Sin cargas registradas</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(c => `
    <tr class="border-b border-white/5 hover:bg-[#6C3CE1]/10">
      <td class="py-2 pr-2">${formatDate(c.fecha)}</td>
      <td class="py-2 pr-2">${c.litros?.toFixed(1) || '-'}</td>
      <td class="py-2 pr-2">${formatCurrency(c.importe)}</td>
      <td class="py-2 pr-2">${c.tipo || '-'}</td>
      <td class="py-2 pr-2">${c.km?.toLocaleString() || '-'}</td>
      <td class="py-2 pr-2">${c.proveedor || '-'}</td>
      <td class="py-2 no-print">${isAdmin() ? `<button onclick="deleteCombustible('${c.id}')" class="text-red-400 hover:text-red-300" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ''}</td>
    </tr>
  `).join('');
}

function renderRepuestos(items) {
  const tbody = document.getElementById('repuestos-table-body');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-[#5C6378]">Sin repuestos registrados</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(r => `
    <tr class="border-b border-white/5 hover:bg-[#6C3CE1]/10">
      <td class="py-2 pr-2">${formatDate(r.fecha)}</td>
      <td class="py-2 pr-2 font-medium">${r.pieza || '-'}</td>
      <td class="py-2 pr-2">${formatCurrency(r.costo)}</td>
      <td class="py-2 pr-2">${r.proveedor || '-'}</td>
      <td class="py-2 pr-2">${r.tipo || '-'}</td>
      <td class="py-2 pr-2">${r.km?.toLocaleString() || '-'}</td>
      <td class="py-2 no-print">${isAdmin() ? `<button onclick="deleteRepuesto('${r.id}')" class="text-red-400 hover:text-red-300" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ''}</td>
    </tr>
  `).join('');
}

function exportCombustibleCSV() {
  const items = window.allCombustibleData || [];
  if (!items.length) { showToast('No hay datos para exportar', 'info'); return; }
  const headers = ['Fecha', 'Litros', 'Importe', 'Tipo', 'Km', 'Proveedor', 'Observaciones'];
  const rows = items.map(c => [
    formatDate(c.fecha),
    c.litros?.toFixed(2) || '',
    c.importe?.toFixed(2) || '',
    c.tipo || '',
    c.km || '',
    c.proveedor || '',
    c.observaciones || ''
  ]);
  downloadCSV(`combustible-${vehicleData?.patente || vehicleId}.csv`, headers, rows);
}

function exportRepuestosCSV() {
  const items = window.allRepuestosData || [];
  if (!items.length) { showToast('No hay datos para exportar', 'info'); return; }
  const headers = ['Fecha', 'Pieza', 'Costo', 'Proveedor', 'Tipo', 'Km', 'Observaciones'];
  const rows = items.map(r => [
    formatDate(r.fecha),
    r.pieza || '',
    r.costo?.toFixed(2) || '',
    r.proveedor || '',
    r.tipo || '',
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

async function deleteCombustible(id) {
  if (!isAdmin() || !confirm('¿Eliminar esta carga de combustible?')) return;
  try {
    await db.collection('vehicles').doc(vehicleId).collection('combustible').doc(id).delete();
    showToast('Carga eliminada');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
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
