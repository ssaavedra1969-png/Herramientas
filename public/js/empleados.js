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
    tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-500">No hay empleados para mostrar</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(e => {
    const ref = escEmp(refEmpleado(e));
    const vencDni = fechaEmpleado(e.vencimientoDNI);
    const vencReg = fechaEmpleado(e.vencimientoRegistro);
    const dato = valor => {
      const s = String(valor == null ? '' : valor).trim();
      return s && s !== '-'
        ? `<span class="font-mono text-sm text-slate-300 tabular-nums">${escEmp(s)}</span>`
        : '<span class="text-xs italic text-slate-500">Sin dato</span>';
    };
    const iniciales = String(e.nombre || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '?';
    const patentes = (e.patentes || []).map(p => p.vehiculoId
      ? `<a href="/vehicle/${escEmp(p.vehiculoId)}" class="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-cyan-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200" title="${escEmp(p.interno || '')}">${escEmp(p.patente || '—')}</a>`
      : `<span class="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-cyan-300">${escEmp(p.patente || '—')}</span>`).join(' ') || '<span class="text-xs italic text-slate-500">Sin dato</span>';
    const documentos = ['dni', 'registro'].map(tipo => {
      const doc = e.documentos && e.documentos[tipo];
      const presente = !!(doc && doc.presente);
      const etiqueta = tipo === 'dni' ? 'DNI' : 'Registro';
      const cls = presente
        ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400'
        : 'inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400';
      const icono = presente
        ? '<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>'
        : '<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
      return presente
        ? `<button type="button" onclick="verDocumento('${ref}','${tipo}')" class="${cls} transition hover:bg-emerald-500/20" title="Ver ${etiqueta}">${icono}${etiqueta}</button>`
        : `<span class="${cls}" title="Sin ${etiqueta} cargado">${icono}${etiqueta}</span>`;
    }).join('');
    const badges = [];
    if (e.sinAsignar) badges.push('<span class="rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">Sin asignar</span>');
    if (e.virtual) badges.push('<span class="rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">Virtual</span>');
    if ((e.conflictos || []).length) badges.push(`<span class="rounded-full border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400" title="${escEmp(e.conflictos.join(' · '))}">Conflictos (${e.conflictos.length})</span>`);
    const estadoCls = e.sinAsignar
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400';
    const puntoCls = e.sinAsignar ? 'bg-amber-400' : 'bg-emerald-400';
    const accionCls = 'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white';
    const acciones = [];
    if (isAdmin()) {
      if (e.id) {
        acciones.push(`<button type="button" onclick="editarEmpleado('${escEmp(e.id)}')" class="${accionCls}" title="Editar"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>Editar</button>`);
        acciones.push(`<button type="button" onclick="abrirTraslado('${escEmp(e.id)}')" class="${accionCls}" title="Trasladar"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-6-6 6 6-6 6"/></svg>Trasladar</button>`);
      } else {
        acciones.push(`<button type="button" onclick="sincronizarEmpleados()" class="${accionCls}" title="Crear perfil desde los vehículos"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></svg>Sincronizar</button>`);
      }
    }
    acciones.push(e.id
      ? `<button type="button" onclick="verHistorial('${escEmp(e.id)}')" class="${accionCls}" title="Historial"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"/></svg>Historial</button>`
      : '<button type="button" disabled class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 opacity-50 cursor-not-allowed" title="Sincronizá el perfil para ver el historial"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"/></svg>Historial</button>');
    return `
      <tr class="border-b border-slate-800/70 transition-colors hover:bg-slate-800/40">
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-3">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/15 text-[11px] font-semibold text-indigo-400">${iniciales}</span>
            <span class="font-medium text-slate-100">${escEmp(e.nombre || '—')}</span>
          </div>
        </td>
        <td class="px-4 py-3.5">${dato(e.dni)}</td>
        <td class="px-4 py-3.5">${dato(e.registro)}</td>
        <td class="px-4 py-3.5">${dato(vencDni)}</td>
        <td class="px-4 py-3.5">${dato(vencReg)}</td>
        <td class="px-4 py-3.5"><div class="flex flex-wrap items-center gap-1.5">${patentes}</div></td>
        <td class="px-4 py-3.5"><div class="flex items-center gap-2">${documentos}</div></td>
        <td class="px-4 py-3.5">
          <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoCls}"><span class="h-1.5 w-1.5 rounded-full ${puntoCls}"></span>${estadoTexto(e)}</span>
          <div class="mt-1 flex flex-wrap gap-1">${badges.join('')}</div>
        </td>
        <td class="no-print px-4 py-3.5"><div class="flex items-center gap-1.5">${acciones.join('')}</div></td>
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
