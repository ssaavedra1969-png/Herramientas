let empleadosData = [];
let filtro = { search: '', estado: '' };
let historialData = [];
let urlDocumentoActual = null;
let documentoActual = null;

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  document.getElementById('emp-search')?.addEventListener('input', (e) => {
    filtro.search = e.target.value.trim().toLowerCase();
    renderEmpleados();
  });
  document.getElementById('emp-filter')?.addEventListener('change', (e) => {
    filtro.estado = e.target.value;
    renderEmpleados();
  });
  document.getElementById('btn-nuevo-empleado')?.addEventListener('click', abrirNuevoEmpleado);
  document.getElementById('btn-sincronizar')?.addEventListener('click', sincronizarEmpleados);
  document.getElementById('btn-exportar')?.addEventListener('click', exportarEmpleados);
  document.getElementById('btn-imprimir')?.addEventListener('click', imprimirEmpleados);
  document.getElementById('btn-descargar-documento')?.addEventListener('click', descargarDocumentoActual);
  document.getElementById('form-empleado')?.addEventListener('submit', guardarEmpleado);
  document.getElementById('emp-traslado-confirmar')?.addEventListener('click', confirmarTraslado);
  cargarEmpleados();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function escEmp(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fechaEmpleado(valor) {
  const s = String(valor == null ? '' : valor).trim();
  if (!s || /\[object Object\]|\b(?:invalid date|nan|null|undefined)\b/i.test(s)) return '';
  return s;
}

function resolverEmpleado(ref) {
  if (ref === null || ref === undefined || ref === '') return null;
  return empleadosData.find(e => String(e.id) === String(ref)) || empleadosData[Number(ref)] || null;
}

function refEmpleado(e) {
  return e.id || String(empleadosData.indexOf(e));
}

function estadoTexto(e) {
  const base = e.sinAsignar ? 'Sin asignar' : 'Asignado';
  return e.activo === false ? base + ' · Inactivo' : base;
}

async function cargarEmpleados() {
  const tbody = document.getElementById('empleados-tbody');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/empleados', { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'HTTP ' + res.status);
    }
    const data = await res.json();
    empleadosData = Array.isArray(data.empleados) ? data.empleados : (Array.isArray(data) ? data : []);
    renderEmpleados();
  } catch (e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-red-400">Error al cargar empleados: ' + escEmp(e.message) + '</td></tr>';
    showToast('Error al cargar empleados: ' + e.message, 'error');
  }
}

function filtrarEmpleados() {
  let lista = empleadosData.slice();
  if (filtro.search) {
    const s = filtro.search;
    lista = lista.filter(e =>
      [e.nombre, e.dni, e.registro, e.patenteActual].join(' ').toLowerCase().includes(s) ||
      (e.patentes || []).some(p => String(p.patente || '').toLowerCase().includes(s))
    );
  }
  if (filtro.estado === 'asignados') lista = lista.filter(e => !e.sinAsignar);
  if (filtro.estado === 'sinAsignar') lista = lista.filter(e => e.sinAsignar);
  if (filtro.estado === 'conflictos') lista = lista.filter(e => (e.conflictos || []).length > 0);
  return lista;
}

function renderEmpleados() {
  const totalEl = document.getElementById('emp-total');
  const asignadosEl = document.getElementById('emp-asignados');
  const sinAsignarEl = document.getElementById('emp-sin-asignar');
  const conflictosEl = document.getElementById('emp-conflictos');
  if (totalEl) totalEl.textContent = empleadosData.length;
  if (asignadosEl) asignadosEl.textContent = empleadosData.filter(e => !e.sinAsignar).length;
  if (sinAsignarEl) sinAsignarEl.textContent = empleadosData.filter(e => e.sinAsignar).length;
  if (conflictosEl) conflictosEl.textContent = empleadosData.filter(e => (e.conflictos || []).length > 0).length;

  const tbody = document.getElementById('empleados-tbody');
  if (!tbody) return;
  const lista = filtrarEmpleados();
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-[#4a5568]">No hay empleados para mostrar</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(e => {
    const ref = escEmp(refEmpleado(e));
    const vencDni = fechaEmpleado(e.vencimientoDNI);
    const vencReg = fechaEmpleado(e.vencimientoRegistro);
    const patentes = (e.patentes || []).map(p => p.vehiculoId
      ? `<a href="/vehicle/${escEmp(p.vehiculoId)}" class="text-[#60A5FA] hover:underline" title="${escEmp(p.interno || '')}">${escEmp(p.patente || '—')}</a>`
      : `<span class="text-[#cbd5e1]">${escEmp(p.patente || '—')}</span>`).join(' · ') || '<span class="text-[#4a5568]">—</span>';
    const documentos = ['dni', 'registro'].map(tipo => {
      const doc = e.documentos && e.documentos[tipo];
      if (!doc || !doc.presente) return `<span class="text-[#4a5568]">${tipo.toUpperCase()} —</span>`;
      return `<button type="button" onclick="verDocumento('${ref}','${tipo}')" class="text-[#00E5FF] hover:underline" title="Ver ${tipo.toUpperCase()}">${tipo.toUpperCase()}</button>`;
    }).join(' · ');
    const badges = [];
    if (e.sinAsignar) badges.push('<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30">Sin asignar</span>');
    if (e.virtual) badges.push('<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30">Virtual</span>');
    if ((e.conflictos || []).length) badges.push(`<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30" title="${escEmp(e.conflictos.join(' · '))}">Conflictos (${e.conflictos.length})</span>`);
    const estadoCls = e.sinAsignar
      ? 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30'
      : 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30';
    const acciones = [];
    if (isAdmin()) {
      if (e.id) {
        acciones.push(`<button type="button" onclick="editarEmpleado('${escEmp(e.id)}')" class="text-[#8b9bb4] hover:text-[#ffffff] text-xs mr-2" title="Editar">Editar</button>`);
        acciones.push(`<button type="button" onclick="abrirTraslado('${escEmp(e.id)}')" class="text-[#60A5FA] hover:text-[#93C5FD] text-xs mr-2" title="Trasladar">Trasladar</button>`);
      } else {
        acciones.push(`<button type="button" onclick="sincronizarEmpleados()" class="text-[#FBBF24] hover:text-[#FDE68A] text-xs mr-2" title="Crear perfil desde los vehículos">Sincronizar</button>`);
      }
    }
    acciones.push(e.id
      ? `<button type="button" onclick="verHistorial('${escEmp(e.id)}')" class="text-[#00E5FF] hover:text-[#67E8F9] text-xs" title="Historial">Historial</button>`
      : '<button type="button" disabled class="text-[#4a5568] text-xs opacity-50 cursor-not-allowed" title="Sincronizá el perfil para ver el historial">Historial</button>');
    return `
      <tr class="border-b border-white/5 hover:bg-[#2563EB]/10">
        <td class="px-4 py-3 font-medium text-[#ffffff]">${escEmp(e.nombre || '—')}</td>
        <td class="px-4 py-3 text-[#8b9bb4] font-mono text-xs">${escEmp(e.dni || '—')}</td>
        <td class="px-4 py-3 text-[#8b9bb4] font-mono text-xs">${escEmp(e.registro || '—')}</td>
        <td class="px-4 py-3 text-[#8b9bb4] font-mono text-xs">${escEmp(vencDni)}</td>
        <td class="px-4 py-3 text-[#8b9bb4] font-mono text-xs">${escEmp(vencReg)}</td>
        <td class="px-4 py-3 text-xs">${patentes}</td>
        <td class="px-4 py-3 text-[11px]">${documentos}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoCls}">${estadoTexto(e)}</span>
          <div class="flex flex-wrap gap-1 mt-1">${badges.join('')}</div>
        </td>
        <td class="px-3 py-3 no-print whitespace-nowrap">${acciones.join('')}</td>
      </tr>`;
  }).join('');
}

function abrirNuevoEmpleado() {
  if (!isAdmin()) return showToast('No tenés permisos para esta acción', 'error');
  document.getElementById('form-empleado').reset();
  document.getElementById('emp-id').value = '';
  document.getElementById('emp-activo').checked = true;
  showModal('modal-empleado');
}

function editarEmpleado(ref) {
  if (!isAdmin()) return showToast('No tenés permisos para esta acción', 'error');
  const e = resolverEmpleado(ref);
  if (!e) return showToast('No se encontró el empleado', 'error');
  document.getElementById('form-empleado').reset();
  document.getElementById('emp-id').value = e.id || '';
  document.getElementById('emp-nombre').value = e.nombre || '';
  document.getElementById('emp-dni').value = e.dni || '';
  document.getElementById('emp-registro').value = e.registro || '';
  document.getElementById('emp-vencimiento-dni').value = e.vencimientoDNI || '';
  document.getElementById('emp-vencimiento-registro').value = e.vencimientoRegistro || '';
  document.getElementById('emp-activo').checked = e.activo !== false;
  showModal('modal-empleado');
}

async function guardarEmpleado(event) {
  event.preventDefault();
  const id = document.getElementById('emp-id').value.trim();
  const nombre = document.getElementById('emp-nombre').value.trim();
  if (!nombre) return showToast('El nombre es obligatorio', 'error');
  const body = {
    nombre,
    dni: document.getElementById('emp-dni').value.trim(),
    registro: document.getElementById('emp-registro').value.trim(),
    vencimientoDNI: document.getElementById('emp-vencimiento-dni').value.trim(),
    vencimientoRegistro: document.getElementById('emp-vencimiento-registro').value.trim(),
    activo: document.getElementById('emp-activo').checked
  };
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(id ? `/api/empleados/${encodeURIComponent(id)}` : '/api/empleados', {
      method: id ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    hideModal('modal-empleado');
    showToast(id ? 'Empleado actualizado' : 'Empleado creado');
    await cargarEmpleados();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function sincronizarEmpleados() {
  if (!isAdmin()) return showToast('No tenés permisos para esta acción', 'error');
  const pregunta = await Swal.fire({
    title: 'Sincronizar empleados',
    text: 'Se crean y actualizan los perfiles desde los choferes cargados en los vehículos.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sincronizar',
    cancelButtonText: 'Cancelar'
  });
  if (!pregunta.isConfirmed) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/empleados/sincronizar', { method: 'POST', headers, body: '{}' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    const conflictos = Array.isArray(data.conflictos) ? data.conflictos : [];
    if (conflictos.length) {
      await Swal.fire({
        title: 'Sincronización con conflictos',
        text: 'Posibles duplicados por DNI distinto: ' + conflictos.join(', '),
        icon: 'warning'
      });
    } else {
      showToast(`Creados: ${data.creados || 0} · Actualizados: ${data.actualizados || 0}`);
    }
    await cargarEmpleados();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function abrirTraslado(ref) {
  if (!isAdmin()) return showToast('No tenés permisos para esta acción', 'error');
  const e = resolverEmpleado(ref);
  if (!e) return showToast('No se encontró el empleado', 'error');
  if (!e.id) return showToast('Sincronizá este perfil antes de trasladarlo', 'error');
  const patentes = [...new Set(empleadosData.reduce((acc, x) => acc.concat((x.patentes || []).map(p => p.patente).filter(Boolean)), []))].sort();
  const sel = document.getElementById('emp-traslado-patente');
  sel.innerHTML = '<option value="">Seleccionar patente...</option>' + patentes.map(p => `<option value="${escEmp(p)}">${escEmp(p)}</option>`).join('');
  sel.value = '';
  document.getElementById('emp-traslado-id').value = e.id;
  document.getElementById('emp-traslado-origen').value = e.patenteActual || '';
  document.getElementById('emp-traslado-reemplazar').checked = false;
  showModal('modal-traslado');
}

async function confirmarTraslado() {
  const id = document.getElementById('emp-traslado-id').value.trim();
  const patenteDestino = document.getElementById('emp-traslado-patente').value.trim().toUpperCase();
  const patenteOrigen = document.getElementById('emp-traslado-origen').value.trim().toUpperCase();
  const reemplazar = document.getElementById('emp-traslado-reemplazar').checked;
  if (!id || !patenteDestino) return showToast('Seleccioná la patente destino', 'error');
  const confirmacion = await Swal.fire({
    title: 'Confirmar traslado',
    html: `Se moverá al empleado de <strong>${escEmp(patenteOrigen || '—')}</strong> a <strong>${escEmp(patenteDestino)}</strong>, junto con sus documentos DNI y Registro.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Trasladar',
    cancelButtonText: 'Cancelar'
  });
  if (!confirmacion.isConfirmed) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/empleados/mover', {
      method: 'POST',
      headers,
      body: JSON.stringify({ empleadoId: id, patenteDestino, patenteOrigen, reemplazar })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      const conflictos = Array.isArray(data.conflictos) && data.conflictos.length ? data.conflictos.join('\n') : (data.error || 'Conflicto en el traslado');
      showToast('Conflicto: ' + conflictos, 'error', 6000);
      await Swal.fire({ title: 'No se pudo trasladar', text: conflictos, icon: 'error' });
      await cargarEmpleados();
      return;
    }
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    hideModal('modal-traslado');
    showToast('Traslado realizado');
    await cargarEmpleados();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function verHistorial(id) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/empleados/${encodeURIComponent(id)}`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'HTTP ' + res.status);
    }
    const data = await res.json();
    const empleado = data.empleado || {};
    historialData = Array.isArray(empleado.historial) ? empleado.historial : [];
    const body = document.getElementById('emp-historial-body');
    if (!historialData.length) {
      body.innerHTML = '<p class="text-center py-6 text-[#4a5568]">Sin movimientos registrados</p>';
    } else {
      body.innerHTML = `<p class="mb-3 text-[#ffffff] font-semibold">${escEmp(empleado.nombre || '')}</p>
        <div class="overflow-x-auto"><table class="w-full text-xs min-w-[560px]">
          <thead><tr class="border-b border-white/10 text-[10px] uppercase tracking-widest text-[#4a5568]">
            <th class="px-2 py-2 text-left">Desde</th><th class="px-2 py-2 text-left">Hasta</th>
            <th class="px-2 py-2 text-left">Patente</th><th class="px-2 py-2 text-left">Interno</th>
            <th class="px-2 py-2 text-left">Motivo</th><th class="px-2 py-2 no-print"></th>
          </tr></thead><tbody>${historialData.map(h => `
            <tr class="border-b border-white/5">
              <td class="px-2 py-2">${escEmp(h.desde || '—')}</td>
              <td class="px-2 py-2">${h.hasta ? escEmp(h.hasta) : '<span class="text-[#34D399]">Actual</span>'}</td>
              <td class="px-2 py-2 font-mono text-[#60A5FA]">${escEmp(h.patente || '—')}</td>
              <td class="px-2 py-2">${escEmp(h.interno || '—')}</td>
              <td class="px-2 py-2">${escEmp(h.motivo || '—')}</td>
              <td class="px-2 py-2 no-print">${isAdmin() ? `<button type="button" onclick="editarHistorial('${escEmp(id)}','${escEmp(h.id)}')" class="text-[#8b9bb4] hover:text-[#ffffff]">Editar</button>` : ''}</td>
            </tr>`).join('')}</tbody></table></div>`;
    }
    showModal('modal-historial');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function editarHistorial(empleadoId, histId) {
  const h = historialData.find(x => String(x.id) === String(histId));
  if (!h) return showToast('No se encontró el registro', 'error');
  const resultado = await Swal.fire({
    title: 'Editar registro del historial',
    html: `<div class="text-left space-y-2">
      <input id="eh-desde" class="swal2-input" placeholder="Desde (aaaa-mm-dd)" value="${escEmp(h.desde || '')}">
      <input id="eh-hasta" class="swal2-input" placeholder="Hasta (aaaa-mm-dd, vacío = actual)" value="${escEmp(h.hasta || '')}">
      <input id="eh-patente" class="swal2-input" placeholder="Patente" value="${escEmp(h.patente || '')}">
      <input id="eh-interno" class="swal2-input" placeholder="Interno" value="${escEmp(h.interno || '')}">
      <input id="eh-motivo" class="swal2-input" placeholder="Motivo" value="${escEmp(h.motivo || '')}">
    </div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => ({
      desde: document.getElementById('eh-desde').value.trim(),
      hasta: document.getElementById('eh-hasta').value.trim(),
      patente: document.getElementById('eh-patente').value.trim(),
      interno: document.getElementById('eh-interno').value.trim(),
      motivo: document.getElementById('eh-motivo').value.trim()
    })
  });
  if (!resultado.isConfirmed) return;
  const valores = resultado.value;
  const body = {
    desde: valores.desde || null,
    hasta: valores.hasta || null,
    patente: valores.patente,
    interno: valores.interno,
    motivo: valores.motivo
  };
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/empleados/${encodeURIComponent(empleadoId)}/historial/${encodeURIComponent(histId)}`, {
      method: 'PATCH', headers, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    showToast('Historial actualizado');
    await verHistorial(empleadoId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function verDocumento(ref, tipo) {
  const e = resolverEmpleado(ref);
  if (!e || !e.id) return showToast('No se puede abrir el documento de un perfil sin sincronizar', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/empleados/${encodeURIComponent(e.id)}/documentos/${encodeURIComponent(tipo)}`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'HTTP ' + res.status);
    }
    const blob = await res.blob();
    if (urlDocumentoActual) URL.revokeObjectURL(urlDocumentoActual);
    urlDocumentoActual = URL.createObjectURL(blob);
    const frame = document.getElementById('emp-documento-iframe');
    if (frame) frame.src = urlDocumentoActual;
    const titulo = document.getElementById('emp-documento-titulo');
    if (titulo) titulo.textContent = `${e.nombre || ''} — ${tipo.toUpperCase()}`;
    documentoActual = { id: e.id, tipo, nombre: e.nombre || '' };
    showModal('modal-documento');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function descargarDocumentoActual() {
  if (!documentoActual) return showToast('No hay documento abierto', 'error');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/empleados/${encodeURIComponent(documentoActual.id)}/documentos/${encodeURIComponent(documentoActual.tipo)}?descargar=1`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'HTTP ' + res.status);
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const coincidencia = /filename="?([^";]+)"?/i.exec(disposition);
    const base = String(documentoActual.nombre || 'empleado')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'empleado';
    const nombre = coincidencia ? coincidencia[1] : `${base}_${documentoActual.tipo}.pdf`;
    const url = URL.createObjectURL(await res.blob());
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function cerrarDocumento() {
  const frame = document.getElementById('emp-documento-iframe');
  if (frame) frame.src = 'about:blank';
  if (urlDocumentoActual) URL.revokeObjectURL(urlDocumentoActual);
  urlDocumentoActual = null;
  documentoActual = null;
  hideModal('modal-documento');
}

function columnasExport() {
  return filtrarEmpleados().map(e => ({
    Nombre: e.nombre || '',
    DNI: e.dni || '',
    Registro: e.registro || '',
    Patentes: (e.patentes || []).map(p => p.patente).filter(Boolean).join(' '),
    Estado: estadoTexto(e),
    'Venc. DNI': fechaEmpleado(e.vencimientoDNI),
    'Venc. Registro': fechaEmpleado(e.vencimientoRegistro),
    Documentos: ['dni', 'registro'].filter(t => e.documentos && e.documentos[t] && e.documentos[t].presente).map(t => t.toUpperCase()).join(' / ') || '—'
  }));
}

function exportarEmpleados() {
  const filas = columnasExport();
  if (!filas.length) return showToast('No hay empleados para exportar', 'error');
  const cabeceras = ['Nombre', 'DNI', 'Registro', 'Patentes', 'Estado', 'Venc. DNI', 'Venc. Registro', 'Documentos'];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas, { header: cabeceras });
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
  XLSX.writeFile(wb, `EMPLEADOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function imprimirEmpleados() {
  const filas = columnasExport();
  if (!filas.length) return showToast('No hay empleados para imprimir', 'error');
  if (!window.jspdf || !window.jspdf.jsPDF) return showToast('No se pudo cargar jsPDF', 'error');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(12);
  doc.text('Empleados - Grupo Falpat SRL', 14, 14);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')} · ${filas.length} registros`, 14, 19);
  doc.autoTable({
    head: [['Nombre', 'DNI', 'Registro', 'Patentes', 'Estado', 'Venc. DNI', 'Venc. Registro', 'Documentos']],
    body: filas.map(f => [f.Nombre, f.DNI, f.Registro, f.Patentes, f.Estado, f['Venc. DNI'], f['Venc. Registro'], f.Documentos]),
    startY: 23,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8 }
  });
  doc.save(`EMPLEADOS_${new Date().toISOString().slice(0, 10)}.pdf`);
}
