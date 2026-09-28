let allVehicles = [];
let docsPresentes = null;

/* Escribe texto si el elemento existe. Auxiliar global: acá hay muchos ids
   opcionales y un `getElementById(...).textContent` sin guardar hace que todo
   el render posterior muera en silencio (pasó con card-vtv-proximas). */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function openDashModal(title, subtitle, iconBg, iconSvg, bodyHtml) {
  setText('dash-modal-title', title);
  setText('dash-modal-subtitle', subtitle);
  const icon = document.getElementById('dash-modal-icon');
  if (icon) {
    icon.style.background = iconBg;
    icon.innerHTML = iconSvg;
  }
  const body = document.getElementById('dash-modal-body');
  if (body) body.innerHTML = bodyHtml;
  const modal = document.getElementById('dash-modal');
  if (modal) modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeDashModal() {
  const modal = document.getElementById('dash-modal');
  if (modal) modal.classList.add('hidden');
  // El scroll se destraba igual: si el modal no existe, antes se quedaba
  // bloqueada la página entera.
  document.body.style.overflow = '';
}

function vehicleRow(v, extraRight) {
  return `
  <div class="rounded-xl p-3 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid #2563EB;background:rgba(212,175,55,0.05);" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(212,175,55,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
        <div>
          <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
          <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
        </div>
      </div>
      <div class="text-right">${extraRight || ''}</div>
    </div>
  </div>`;
}

function showVehiculosModal() {
  const active = allVehicles.filter(v => v.estadoGeneral !== 'Baja').sort((a, b) => (a.interno || '').localeCompare(b.interno || '', undefined, { numeric: true }));
  const bajas = allVehicles.filter(v => v.estadoGeneral === 'Baja').length;
  const subtitle = `${active.length} activos${bajas > 0 ? ' · ' + bajas + ' dados de baja' : ''}`;
  const body = active.length === 0
    ? '<p class="text-[#4a5568] text-center py-6">No hay vehículos activos</p>'
    : active.map(v => {
        const d = daysUntil(v.vtv?.fechaVencimiento);
        let extra = '';
        if (d !== null && d <= 30) {
          const c = d <= 0 ? '#EF4444' : d <= 7 ? '#F97316' : '#F59E0B';
          extra = `<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:${c}22;color:${c};">VTV ${d <= 0 ? 'Venc.' : d + 'd'}</span>`;
        }
        return vehicleRow(v, extra);
      }).join('');
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>';
  openDashModal('Vehículos Activos', subtitle, 'linear-gradient(135deg,#2563EB,#4F46E5)', iconSvg, body);
}

function showVtvAlertModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.vtv?.fechaVencimiento);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.vtv?.fechaVencimiento) || 999) - (daysUntil(b.vtv?.fechaVencimiento) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('VTV por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todas las VTV están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.vtv?.fechaVencimiento);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F59E0B';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(245,158,11,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F59E0B';
    const statusLabel = isCritical ? 'VENCIDA' : isWarning ? 'URGENTE' : 'PRÓXIMA';
    const statusBg = isCritical ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.15)' : 'rgba(245,158,11,0.15)';
    const dateStr = v.vtv?.fechaVencimiento?.toDate ? v.vtv.fechaVencimiento.toDate().toLocaleDateString('es-AR') : '—';
    const vtvResult = v.vtv?.resultado || '';
    const vtvCentro = v.vtv?.centroMedicion || '';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(212,175,55,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencida' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${vtvResult ? `<span class="text-[#4a5568]">·</span><span>${vtvResult}</span>` : ''}
        ${vtvCentro ? `<span class="text-[#4a5568]">·</span><span>${vtvCentro}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('VTV', resumenAlerts(alerts, a => { const d = daysUntil(a.vtv?.fechaVencimiento); return d !== null && d <= 0; }), 'linear-gradient(135deg,#F59E0B,#F97316)', iconSvg, body);
}

function showSeguroModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.seguro?.fechaVencimiento);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.seguro?.fechaVencimiento) || 999) - (daysUntil(b.seguro?.fechaVencimiento) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Seguro por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todos los seguros están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.seguro?.fechaVencimiento);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#2563EB';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(139,92,246,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#2563EB';
    const statusLabel = isCritical ? 'VENCIDO' : isWarning ? 'URGENTE' : 'PRÓXIMO';
    const statusBg = isCritical ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.15)' : 'rgba(139,92,246,0.15)';
    const dateStr = v.seguro?.fechaVencimiento?.toDate ? v.seguro.fechaVencimiento.toDate().toLocaleDateString('es-AR') : '—';
    const compania = v.seguro?.compania || v.seguro?.compañía || '';
    const poliza = v.seguro?.poliza || '';
    const costo = v.seguro?.costo ? '$' + Number(v.seguro.costo).toLocaleString('es-AR') : '';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(139,92,246,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${compania ? `<span class="text-[#4a5568]">·</span><span>${compania}</span>` : ''}
        ${poliza ? `<span class="text-[#4a5568]">·</span><span>Póliza: ${poliza}</span>` : ''}
        ${costo ? `<span class="text-[#4a5568]">·</span><span>${costo}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('Seguro', resumenAlerts(alerts, a => { const d = daysUntil(a.seguro?.fechaVencimiento); return d !== null && d <= 0; }), 'linear-gradient(135deg,#2563EB,#7C3AED)', iconSvg, body);
}

function showCedulaModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.documentacion?.cedula?.fechaVencimiento);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.documentacion?.cedula?.fechaVencimiento) || 999) - (daysUntil(b.documentacion?.cedula?.fechaVencimiento) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Cédula por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', iconSvg, '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todas las cédulas están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.documentacion?.cedula?.fechaVencimiento);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#0EA5E9';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(14,165,233,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#0EA5E9';
    const statusLabel = isCritical ? 'VENCIDA' : isWarning ? 'URGENTE' : 'PRÓXIMA';
    const statusBg = isCritical ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.15)' : 'rgba(14,165,233,0.15)';
    const dateStr = v.documentacion?.cedula?.fechaVencimiento?.toDate ? v.documentacion.cedula.fechaVencimiento.toDate().toLocaleDateString('es-AR') : '—';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(14,165,233,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencida' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        <span class="text-[#4a5568]">·</span><span>Cédula</span>
      </div>
    </div>`;
  }).join('');
  openDashModal('Cédula', resumenAlerts(alerts, a => { const d = daysUntil(a.documentacion?.cedula?.fechaVencimiento); return d !== null && d <= 0; }), 'linear-gradient(135deg,#00E5FF,#2563EB)', iconSvg, body);
}

function showMatafuegoModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.matafuego?.fechaVto);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.matafuego?.fechaVto) || 999) - (daysUntil(b.matafuego?.fechaVto) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-7.214 4.803a2 2 0 01-1.02-2.628c.2-.505.505-.81.72-.746.313.094.556.374.616.713.34.62.838.869 1.428.9.469-.047 1.016-.154 1.564-.55-.006.56.029 1.083.06 1.51a2 2 0 01-2.368 2.006zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Matafuego por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', iconSvg, '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todos los matafuegos están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.matafuego?.fechaVto);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#2563EB';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(212,175,55,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#2563EB';
    const statusLabel = isCritical ? 'VENCIDO' : isWarning ? 'URGENTE' : 'PRÓXIMO';
    const dateStr = v.matafuego?.fechaVto?.toDate ? v.matafuego.fechaVto.toDate().toLocaleDateString('es-AR') : '—';
    const ctrlStr = v.matafuego?.fechaControl?.toDate ? v.matafuego.fechaControl.toDate().toLocaleDateString('es-AR') : '';
    const estado = v.matafuego?.estado || 'Sin Matafuego';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(212,175,55,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[10px] font-bold" style="color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>${estado}</span>
        ${ctrlStr ? `<span class="text-[#4a5568]">·</span><span>Ctrl: ${ctrlStr}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('Matafuego', resumenAlerts(alerts, a => { const d = daysUntil(a.matafuego?.fechaVto); return d !== null && d <= 0; }), 'linear-gradient(135deg,#EF4444,#2563EB)', iconSvg, body);
}

function showRegistroModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.vencimientoRegistro);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.vencimientoRegistro) || 999) - (daysUntil(b.vencimientoRegistro) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Registro por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todos los registros están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.vencimientoRegistro);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#EC4899';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(236,72,153,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#EC4899';
    const statusLabel = isCritical ? 'VENCIDO' : isWarning ? 'URGENTE' : 'PRÓXIMO';
    const statusBg = isCritical ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.15)' : 'rgba(236,72,153,0.15)';
    const dateStr = v.vencimientoRegistro?.toDate ? v.vencimientoRegistro.toDate().toLocaleDateString('es-AR') : '—';
    const registro = v.registro || '';
    const chofer = v.chofer || v.conductorHabitual || '';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(236,72,153,0.15);color:#EC4899;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${registro ? `<span class="text-[#4a5568]">·</span><span>Reg: ${registro}</span>` : ''}
        ${chofer ? `<span class="text-[#4a5568]">·</span><span>${chofer}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('Registro', resumenAlerts(alerts, a => { const d = daysUntil(a.vencimientoRegistro); return d !== null && d <= 0; }), 'linear-gradient(135deg,#EC4899,#DB2777)', iconSvg, body);
}

function showDniModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.vencimientoDNI);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.vencimientoDNI) || 999) - (daysUntil(b.vencimientoDNI) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"/></svg>';
  if (alerts.length === 0) {
    openDashModal('DNI por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todos los DNI están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.vencimientoDNI);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F97316';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F97316';
    const statusLabel = isCritical ? 'VENCIDO' : isWarning ? 'URGENTE' : 'PRÓXIMO';
    const statusBg = isCritical ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.15)';
    const dateStr = v.vencimientoDNI?.toDate ? v.vencimientoDNI.toDate().toLocaleDateString('es-AR') : '—';
    const dni = v.dni || '';
    const chofer = v.chofer || v.conductorHabitual || '';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(249,115,22,0.15);color:#F97316;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${dni ? `<span class="text-[#4a5568]">·</span><span>DNI: ${dni}</span>` : ''}
        ${chofer ? `<span class="text-[#4a5568]">·</span><span>${chofer}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('DNI', resumenAlerts(alerts, a => { const d = daysUntil(a.vencimientoDNI); return d !== null && d <= 0; }), 'linear-gradient(135deg,#F97316,#EA580C)', iconSvg, body);
}

/* El modal sí lista vencidos y por vencer juntos (cada fila ya se etiqueta
   VENCIDA / PRÓXIMA), así que el subtítulo tiene que separarlos: si no pasa
   lo mismo que en las tarjetas, donde el número grande excluye los vencidos y
   al clickear veías más vehículos de los que marcaba. */
function resumenAlerts(alerts, isOverdue) {
  const venc = alerts.filter(isOverdue).length;
  const prox = alerts.length - venc;
  const partes = [];
  if (venc) partes.push(`${venc} vencido${venc === 1 ? '' : 's'}`);
  if (prox) partes.push(`${prox} por vencer`);
  return partes.join(' · ') || 'Todo al día';
}

function serviceDue(v) {
  if (v.estadoGeneral === 'Baja') return false;
  const d = daysUntil(v.proximoServiceFecha);
  if (d !== null) return d <= 30;
  const km = v.kilometraje;
  if (v.proximoServiceKm != null && km != null) {
    return (v.proximoServiceKm - km) <= 500;
  }
  return false;
}

function showServiceModal() {
  const alerts = allVehicles.filter(v => serviceDue(v)).map(v => {
    const days = daysUntil(v.proximoServiceFecha);
    const useKm = days === null;
    const remainKm = useKm && v.proximoServiceKm != null && v.kilometraje != null
      ? v.proximoServiceKm - v.kilometraje
      : null;
    return { v, remainKm, days, useKm };
  }).sort((a, b) => {
    if (a.useKm !== b.useKm) return a.useKm ? 1 : -1;
    if (a.useKm) return (a.remainKm ?? 999) - (b.remainKm ?? 999);
    return (a.days ?? 999) - (b.days ?? 999);
  });
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Service por vencer', 'Todo al día', 'linear-gradient(135deg,#00E5FF,#0891B2)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-[#00E5FF] font-medium">Todos los services están al día</p></div>');
    return;
  }
  const body = alerts.map(({ v, remainKm, days, useKm }) => {
    const isCritical = (useKm && remainKm <= 0) || (!useKm && days <= 0);
    const isWarning = !isCritical && ((useKm && remainKm <= 100) || (!useKm && days <= 7));
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F59E0B';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(245,158,11,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#F59E0B';
    const statusLabel = isCritical ? 'VENCIDO' : isWarning ? 'URGENTE' : 'PRÓXIMO';
    const statusBg = isCritical ? 'rgba(239,68,68,0.15)' : isWarning ? 'rgba(249,115,22,0.15)' : 'rgba(245,158,11,0.15)';
    const detail = useKm
      ? `${remainKm <= 0 ? 'Vencido por' : 'Faltan'} ${Math.abs(remainKm).toLocaleString()} km`
      : `${days <= 0 ? 'Vencido' : days + ' días'}`;
    const proxStr = v.proximoServiceFecha?.toDate
      ? v.proximoServiceFecha.toDate().toLocaleDateString('es-AR')
      : (v.proximoServiceKm != null ? v.proximoServiceKm.toLocaleString() + ' km' : '—');
    const tipo = v.proximoServiceTipo || '';
    return `
    <div class="rounded-xl p-3.5 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid ${borderColor};background:${bgColor};" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(212,175,55,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#ffffff] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${detail}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[10px] text-[#8b9bb4] ml-[42px]">
        <span>Próx.: ${proxStr}</span>
        ${tipo ? `<span class="text-[#4a5568]">·</span><span>${tipo}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('Service', resumenAlerts(alerts, a => (a.useKm ? a.remainKm <= 0 : a.days <= 0)), 'linear-gradient(135deg,#EF4444,#DC2626)', iconSvg, body);
}

function animateValue(el, start, end, duration, prefix, suffix) {
  prefix = prefix || '';
  suffix = suffix || '';
  const startTime = performance.now();
  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = prefix + current.toLocaleString('es-AR') + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListeners();
  initDashSearch();
  initLatestServices();
});

function initDashSearch() {
  const input = document.getElementById('dash-search');
  const results = document.getElementById('dash-search-results');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.classList.add('hidden'); return; }
    const matches = allVehicles.filter(v =>
      (v.patente || '').toLowerCase().includes(q) ||
      (v.interno || '').toLowerCase().includes(q) ||
      (v.marca || '').toLowerCase().includes(q) ||
      (v.modelo || '').toLowerCase().includes(q) ||
      (v.empresa || '').toLowerCase().includes(q) ||
      (v.centroTrabajo || '').toLowerCase().includes(q)
    ).slice(0, 8);
    if (matches.length === 0) {
      results.innerHTML = '<div class="px-4 py-3 text-[#4a5568] text-sm">Sin resultados</div>';
    } else {
      results.innerHTML = matches.map(v => {
        const extra = v.empresa ? `<span class="text-[10px] text-[#4a5568]">${v.empresa}</span>` : '';
        return `<div class="px-4 py-2.5 cursor-pointer hover:bg-white/[0.04] transition flex items-center gap-3" onclick="window.location.href='/vehicle/${v.id}'">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style="background:rgba(212,175,55,0.15);color:#2563EB;">${(v.interno || '?').substring(0,4)}</div>
          <div class="flex-1 min-w-0">
            <p class="text-[#ffffff] text-sm font-semibold truncate">${v.patente || '—'}</p>
            <p class="text-[#4a5568] text-[10px] truncate">${v.marca || ''} ${v.modelo || ''}</p>
          </div>
          ${extra}
        </div>`;
      }).join('');
    }
    results.classList.remove('hidden');
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.classList.add('hidden'); input.blur(); }
    if (e.key === 'Enter') {
      const first = results.querySelector('[onclick]');
      if (first) first.click();
    }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.classList.add('hidden');
  });
}

let svcLoadTimer = null;

function scheduleLatestServices() {
  if (svcLoadTimer) clearTimeout(svcLoadTimer);
  svcLoadTimer = setTimeout(() => { loadLatestServices(); }, 800);
}

async function loadLatestServices() {
  const container = document.getElementById('latest-services-list');
  if (!container) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/latest-services', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderLatestServices(data);
  } catch (e) {
    container.innerHTML = '<p class="text-[#4a5568] text-sm text-center py-6">No se pudieron cargar los services</p>';
    console.warn('Error cargando últimos services:', e);
  }
}

function initLatestServices() {
  if (!document.getElementById('latest-services-list')) return;
  loadLatestServices();
}

function renderLatestServices(items) {
  const container = document.getElementById('latest-services-list');
  if (!container) return;

  const countEl = document.getElementById('latest-services-count');
  if (countEl) {
    if (items && items.length) {
      countEl.textContent = items.length + ' vehículo' + (items.length > 1 ? 's' : '');
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
  }

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10">
        <div class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3" style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);">
          <svg class="w-6 h-6 text-[#2563EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
        <p class="text-[#4a5568] text-sm font-medium">Sin services registrados todavía</p>
        <p class="text-[#4a5568] text-xs mt-1">Los services se muestran acá a medida que se cargan</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map((veh, i) => {
    const servicios = veh.servicios || [];
    const total = servicios.length;
    const lastSvc = servicios[0];
    const ago = timeAgo(lastSvc?.fechaISO);
    const fechaStr = lastSvc?.fechaISO ? new Date(lastSvc.fechaISO).toLocaleDateString('es-AR') : '—';
    const last = i === items.length - 1;
    return `
    <div class="timeline__item svc-item" style="animation-delay:${i * 70}ms">
      ${last ? '' : '<div class="timeline__line"></div>'}
      <div class="timeline__dot"></div>
      <div class="timeline__head" onclick="toggleSvc(this)">
        <span class="timeline__ico">${(veh.interno || '?').substring(0,4)}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="patente">${veh.patente || '—'}</span>
            <span class="badge badge-ac">${total} service${total !== 1 ? 's' : ''}</span>
          </div>
          <p class="t-subtle text-xs mt-1 truncate">${veh.empresa || 'Sin empresa'}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-bold t-ac">${ago}</p>
          <p class="t-subtle text-xs mt-0.5">${fechaStr}</p>
        </div>
        <span class="timeline__chev"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg></span>
      </div>
      <div class="svc-body hidden">
        ${vehicleServicesHtml(veh)}
      </div>
    </div>`;
  }).join('');
}

function vehicleServicesHtml(veh) {
  const fmtKm = v => v != null ? Number(v).toLocaleString('es-AR') + ' km' : '—';
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('es-AR') : '—';
  const servicios = veh.servicios || [];

  const rows = servicios.map(s => `
    <div class="svc-row">
      <div class="flex-1 min-w-0">
        <p class="t-strong text-sm font-semibold truncate" title="${s.tipo || ''}">${s.tipo || '—'}</p>
        ${s.proveedor ? `<p class="t-subtle text-xs">${s.proveedor}</p>` : ''}
      </div>
      <div class="text-right shrink-0">
        <p class="t-strong text-sm">${fmtDate(s.fechaISO)}</p>
        <p class="t-subtle text-xs">${s.km != null ? fmtKm(s.km) : ''}</p>
      </div>
    </div>`).join('');

  return `
    <div class="mt-3">
      <p class="t-subtle text-xs font-bold uppercase tracking-wider mb-1">Services realizados (${servicios.length})</p>
      <div>${rows}</div>
      <div class="flex justify-end mt-3 pt-3 hairline">
        <button onclick="event.stopPropagation();window.location.href='/vehicle/${veh.vehiculoId}'" class="btn btn-primary btn-sm">
          Ver vehículo completo
        </button>
      </div>
    </div>`;
}

function toggleSvc(header) {
  const item = header.closest('.svc-item');
  const body = item.querySelector('.svc-body');
  const wasOpen = item.classList.contains('open');

  document.querySelectorAll('#latest-services-list .svc-item.open').forEach(el => {
    if (el === item) return;
    el.classList.remove('open');
    el.querySelector('.svc-body')?.classList.add('hidden');
  });

  if (wasOpen) {
    item.classList.remove('open');
    body.classList.add('hidden');
  } else {
    item.classList.add('open');
    body.classList.remove('hidden');
  }
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return 'hace ' + mins + ' min';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return 'hace ' + hrs + ' h';
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return 'hace ' + days + ' d';
  const months = Math.floor(days / 30);
  if (months < 12) return 'hace ' + months + ' mes' + (months > 1 ? 'es' : '');
  const years = Math.floor(months / 12);
  return 'hace ' + years + ' año' + (years > 1 ? 's' : '');
}

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

/* Qué documentación EXISTE, no qué vencimientos están cargados.
   La fuente es la carpeta PATENTE/{patente}/ (una por camión) leída del repo,
   más lo que se subió a Firestore. Los vencimientos son otra cosa: los carga
   el usuario a mano en la ficha y pueden estar incompletos sin que eso sea un
   error, así que no van mezclados en este conteo. */
const DOC_EN_CARPETA = ['vtv', 'seguro', 'cedula', 'registro', 'dni'];

async function loadDocsPresentes() {
  if (docsPresentes) return docsPresentes;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/vehicles/documentos/reporte', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const tipos = data.tipos && data.tipos.length ? data.tipos : DOC_EN_CARPETA;
    docsPresentes = new Map(tipos.map(t => [t, new Set()]));
    (data.rows || []).forEach(r => {
      const patente = String(r.patente || '').toUpperCase();
      tipos.forEach(t => { if (r.docs && r.docs[t]) docsPresentes.get(t).add(patente); });
    });
  } catch (e) {
    console.warn('Error cargando documentación presente:', e);
  }
  return docsPresentes;
}

function initRealtimeListeners() {
  db.collection('vehicles').orderBy('interno').onSnapshot(async (snapshot) => {
    await loadDocsPresentes();
    const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    allVehicles = all;
    const active = all.filter(d => d.estadoGeneral !== 'Baja').length;

    const elFlota = document.getElementById('kpi-flota-val');
    if (elFlota) {
      const prevFlota = parseInt(elFlota.textContent) || 0;
      animateValue(elFlota, prevFlota, active, 800);
    }
    setSev('vehiculos', active);

    /* Dos cuentas separadas, no una sola con `days <= 30`: esa condición
       metía en el mismo número lo que vence en los próximos 30 días con lo
       que YA está vencido (VTV contaba 8 y solo 2 vencían de verdad). El
       número grande de cada tarjeta es "vence en ≤30 días" — igual que el KPI
       hero— y los vencidos van aparte, en su propia línea. */
    let counts  = { total: 0 };   // vencen en 1..30 días
    let expired = {};             // ya vencidos (días <= 0)
    let docs   = {};              // documentación que existe (carpeta PATENTE)
    all.forEach(v => {
      if (v.estadoGeneral === 'Baja') return;
      counts.total++;
      DOC_TYPES.forEach(t => {
        const days = daysUntil(t.get(v));
        if (days === null) return;
        if (days <= 0) expired[t.k] = (expired[t.k] || 0) + 1;
        else if (days <= 30) counts[t.k] = (counts[t.k] || 0) + 1;
      });
      // Documentos con archivo: lo que hay en PATENTE/{patente}/ o subido.
      const patente = String(v.patente || '').toUpperCase();
      DOC_EN_CARPETA.forEach(t => {
        if (docsPresentes && docsPresentes.get(t) && docsPresentes.get(t).has(patente))
          docs[t] = (docs[t] || 0) + 1;
      });
      // Matafuego y Service no son archivos de la carpeta: se miden por la
      // fecha cargada, que es el único dato que hay de ellos.
      if (v.matafuego?.fechaVto)      docs.matafuego = (docs.matafuego || 0) + 1;
      if (v.proximoServiceFecha)      docs.service   = (docs.service   || 0) + 1;
    });
    // Service no entra en DOC_TYPES: se mide por fecha o, si no hay, por km
    // restantes (mismo corte de 30 días / 500 km, con la misma separación).
    let svcProx = 0, svcVenc = 0;
    all.forEach(v => {
      if (v.estadoGeneral === 'Baja') return;
      const d = daysUntil(v.proximoServiceFecha);
      if (d !== null) {
        if (d <= 0) svcVenc++; else if (d <= 30) svcProx++;
        return;
      }
      if (v.proximoServiceKm != null && v.kilometraje != null) {
        const restan = v.proximoServiceKm - v.kilometraje;
        if (restan <= 0) svcVenc++; else if (restan <= 500) svcProx++;
      }
    });
    if (svcProx) counts.service  = (counts.service  || 0) + svcProx;
    if (svcVenc) expired.service = (expired.service || 0) + svcVenc;

    /* Todas las tarjetas se escriben con setCard, que guarda el elemento
       internamente. Antes cada una repetía `getElementById(...).textContent`
       sin guardar, así que un solo id mal escrito (o faltante) tiraba
       TypeError y mataba TODO lo que venía después: KPIs hero, empresas,
       salud de flota y services quedaban en 0 sin avisar. */
    setCardCounts(counts, expired, docs, active);

    const expiries = collectExpiries(all);
    renderHeroKpis(all, expiries);
    renderAttention(all, expiries);

    renderEmpresas(all);
    renderFleetHealth(all);
    scheduleLatestServices();
  }, (error) => {
    console.error('Error en snapshot de vehículos:', error);
  });
}

/* ==========================================================================
   MOTOR DE VENCIMIENTOS — una sola pasada alimenta los KPIs hero y la lista
   de excepciones. Cada ítem es { v, k, label, days, km, date }.
   ========================================================================== */
const DOC_TYPES = [
  { k: 'vtv',       label: 'VTV',       get: v => v.vtv?.fechaVencimiento },
  { k: 'seguro',    label: 'Seguro',    get: v => v.seguro?.fechaVencimiento },
  { k: 'cedula',    label: 'Cédula',    get: v => v.documentacion?.cedula?.fechaVencimiento },
  { k: 'matafuego', label: 'Matafuego', get: v => v.matafuego?.fechaVto },
  { k: 'registro',  label: 'Registro',  get: v => v.vencimientoRegistro },
  { k: 'dni',       label: 'DNI',       get: v => v.vencimientoDNI }
];

// Orden de urgencia: menos días primero; los services por kilometraje se
// ordenan por km restantes (ya vencidos o casi, primero).
function urgencyOf(it) {
  if (it.days !== null) return it.days;
  if (it.km <= 0) return -1;
  if (it.km <= 100) return 1;
  return 3;
}

function collectExpiries(vehicles) {
  const out = [];
  vehicles.forEach(v => {
    if (v.estadoGeneral === 'Baja') return;
    DOC_TYPES.forEach(t => {
      const date = t.get(v);
      const days = daysUntil(date);
      if (days !== null) out.push({ v, k: t.k, label: t.label, days, km: null, date });
    });
    // Service: por fecha o, si no hay, por kilometraje restante.
    const sDays = daysUntil(v.proximoServiceFecha);
    if (sDays !== null) out.push({ v, k: 'service', label: 'Service', days: sDays, km: null, date: v.proximoServiceFecha });
    else if (v.proximoServiceKm != null && v.kilometraje != null) {
      out.push({ v, k: 'service', label: 'Service', days: null, km: v.proximoServiceKm - v.kilometraje, date: null });
    }
  });
  return out;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- TIER 1: 4 KPIs hero ---------- */
function renderHeroKpis(vehicles, items) {
  const active = vehicles.filter(v => v.estadoGeneral !== 'Baja');
  const bajas = vehicles.length - active.length;

  // setText es global (arriba del archivo): no redefinirlo acá.

  setText('kpi-flota-hint', bajas > 0 ? `${bajas} de baja` : `${active.length} en servicio`);

  // Vencidos (crítico)
  const vencidos = items.filter(it => (it.days !== null ? it.days <= 0 : it.km <= 0));
  const vencidosVeh = new Set(vencidos.map(it => it.v.id)).size;
  setText('kpi-vencidos-val', vencidos.length);
  setText('kpi-vencidos-hint', vencidos.length === 0
    ? 'Nada vencido'
    : `en ${vencidosVeh} veh${vencidosVeh === 1 ? 'ículo' : 'ículos'}`);

  // Vencen en 30 días + distribución real por ventana
  const proximas = items.filter(it => it.days !== null && it.days > 0 && it.days <= 30);
  const proxVeh = new Set(proximas.map(it => it.v.id)).size;
  setText('kpi-proximas-val', proximas.length);
  setText('kpi-proximas-hint', active.length > 0
    ? `${proxVeh} veh · ${Math.round((proxVeh / active.length) * 100)}% de la flota`
    : '—');
  renderSparkline(proximas.map(it => it.days));

  // Documentación completa: los 4 vencimientos críticos con fecha cargada
  const criticos = active.filter(v =>
    daysUntil(v.vtv?.fechaVencimiento) !== null &&
    daysUntil(v.seguro?.fechaVencimiento) !== null &&
    daysUntil(v.vencimientoRegistro) !== null &&
    daysUntil(v.vencimientoDNI) !== null);
  const pctDocs = active.length > 0 ? Math.round((criticos.length / active.length) * 100) : 0;
  setText('kpi-docs-val', pctDocs);
  setText('kpi-docs-hint', `${criticos.length} de ${active.length} con los 4 críticos`);
  const meter = document.getElementById('kpi-docs-meter');
  if (meter) meter.style.width = pctDocs + '%';
}

/* Sparkline = distribución REAL de vencimientos por ventana (no una tendencia inventada). */
function renderSparkline(daysList) {
  const svg = document.getElementById('kpi-proximas-spark');
  if (!svg) return;
  const buckets = [0, 0, 0, 0, 0]; // 0-5 · 6-10 · 11-20 · 21-30 · (resto, contexto)
  daysList.forEach(d => {
    if (d <= 5) buckets[0]++;
    else if (d <= 10) buckets[1]++;
    else if (d <= 20) buckets[2]++;
    else if (d <= 30) buckets[3]++;
    else buckets[4]++;
  });
  const max = Math.max(...buckets, 1);
  const W = 100, H = 34, pad = 3;
  const pts = buckets.map((n, i) => {
    const x = pad + (i * (W - pad * 2)) / (buckets.length - 1);
    const y = H - pad - (n / max) * (H - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  svg.innerHTML =
    `<path class="fill" d="${area}"></path><path d="${line}"></path>` +
    pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" fill="var(--kpi-tone, var(--warn))"></circle>`).join('');
  svg.setAttribute('title', 'Distribución de vencimientos: 0-5, 6-10, 11-20, 21-30 días');
}

/* ---------- TIER 2: excepciones priorizadas ---------- */
function renderAttention(vehicles, items) {
  const list = document.getElementById('att-list');
  if (!list) return;
  const countEl = document.getElementById('att-count');

  const acc = items
    .filter(it => (it.days !== null ? it.days <= 30 : it.km <= 500))
    .sort((a, b) => urgencyOf(a) - urgencyOf(b));

  if (countEl) countEl.textContent = acc.length;

  if (acc.length === 0) {
    list.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center py-12 px-4">
        <span class="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style="background: var(--ok-soft); color: var(--ok-text);">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </span>
        <p class="text-sm font-semibold t-strong">Todo al día</p>
        <p class="text-xs t-subtle mt-1">Ningún documento vencen en los próximos 30 días</p>
      </div>`;
    return;
  }

  const LIMIT = 40;
  const shown = acc.slice(0, LIMIT);
  const rows = shown.map(it => {
    const v = it.v;
    const overdue = it.days !== null ? it.days <= 0 : it.km <= 0;
    const tone = overdue ? 'dan' : 'warn';
    const tagClass = overdue ? 'exc__tag--dan' : 'exc__tag--warn';
    const when = it.days !== null
      ? (it.days <= 0 ? `Vencido hace ${Math.abs(it.days)} d` : `${it.days} d restantes`)
      : (it.km <= 0 ? `Vencido hace ${Math.abs(it.km).toLocaleString('es-AR')} km` : `${it.km.toLocaleString('es-AR')} km restantes`);
    const fecha = it.date ? formatDate(it.date) : '—';
    // Barra: cuánto consumió de la ventana de 30 días (100% = vencido)
    const pct = it.days !== null
      ? Math.max(3, Math.min(100, Math.round(((30 - it.days) / 30) * 100)))
      : Math.max(3, Math.min(100, Math.round(((500 - it.km) / 500) * 100)));
    return `
      <div class="exc__row" data-overdue="${overdue ? 1 : 0}" role="link" tabindex="0" onclick="window.location.href='/vehicle/${v.id}'" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='/vehicle/${v.id}'}">
        <span class="dot dot--${tone}"></span>
        <div class="exc__main">
          <p class="exc__title">${esc(v.patente || '—')} <span class="font-mono text-[10px] t-subtle font-normal">${esc(v.interno || '')}</span></p>
          <p class="exc__sub">${esc(it.label)} · ${esc(fecha)}${v.empresa ? ' · ' + esc(v.empresa) : ''}</p>
        </div>
        <div class="meter" style="--meter-tone: var(--${tone})">
          <div class="meter__track"><div class="meter__fill" style="width:${pct}%"></div></div>
        </div>
        <span class="exc__tag ${tagClass}">${esc(when)}</span>
      </div>`;
  }).join('');

  const more = acc.length > LIMIT
    ? `<div class="px-4 py-2.5 text-center text-xs t-subtle">y ${acc.length - LIMIT} vencimiento${acc.length - LIMIT === 1 ? '' : 's'} más</div>`
    : '';

  list.innerHTML = rows + more;
}

function renderEmpresas(vehicles) {
  const container = document.getElementById('empresas-list');
  if (!container) return;

  const totalBadge = document.getElementById('empresas-total');
  const foot = document.getElementById('empresas-foot');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Sólo los vehículos activos cuentan para el reparto de la flota
  const activos = vehicles.filter(v => v.estadoGeneral !== 'Baja');
  const conteo = new Map();
  activos.forEach(v => {
    const nombre = String(v.empresa || '').trim() || 'Sin empresa';
    conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
  });

  if (conteo.size === 0) {
    container.innerHTML = `
      <div class="empty-note">
        <span class="empty-note__ico"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg></span>
        <p class="empty-note__t">Sin empresas registradas</p>
        <p class="empty-note__s">Asigná una empresa a un vehículo para verlo acá</p>
      </div>`;
    if (totalBadge) { totalBadge.textContent = '0'; totalBadge.classList.add('hidden'); }
    if (foot) foot.innerHTML = '';
    return;
  }

  // Orden por cantidad: la barra es relativa a la empresa más grande
  const filas = [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  const max = filas[0][1];
  const totalActivos = activos.length;
  const LIMITE = 8;
  const visibles = filas.slice(0, LIMITE);
  const resto = filas.length - visibles.length;

  container.innerHTML = visibles.map(([nombre, n], i) => {
    const pct = Math.round((n / totalActivos) * 100);
    const frac = n / max;
    return `
      <button type="button" class="emp-row" onclick="showEmpresaModal('${esc(nombre).replace(/'/g, "\\'")}')" title="${esc(nombre)} — ${n} vehículo${n !== 1 ? 's' : ''} (${pct}% de la flota)">
        <span class="emp-row__bar"><i style="--w:${frac.toFixed(4)};animation-delay:${i * 45}ms"></i></span>
        <span class="emp-row__rank">${i + 1}</span>
        <span class="emp-row__name">${esc(nombre)}</span>
        <span class="emp-row__n">${n}</span>
        <span class="emp-row__pct">${pct}%</span>
      </button>`;
  }).join('') + (resto > 0
    ? `<p class="emp-row emp-row--more">+ ${resto} empresa${resto !== 1 ? 's' : ''} más</p>`
    : '');

  if (totalBadge) {
    totalBadge.textContent = filas.length + (filas.length !== 1 ? ' empresas' : ' empresa');
    totalBadge.classList.remove('hidden');
  }
  if (foot) {
    const bajaCount = vehicles.length - totalActivos;
    foot.innerHTML = `
      <span><b>${totalActivos}</b> vehículo${totalActivos !== 1 ? 's' : ''} activo${totalActivos !== 1 ? 's' : ''}</span>
      <span>${bajaCount > 0 ? `<b>${bajaCount}</b> de baja` : 'sin bajas'}</span>`;
  }
}

function showEmpresaModal(empresa) {
  const vehicles = allVehicles.filter(v => v.empresa === empresa && v.estadoGeneral !== 'Baja').sort((a, b) => (a.interno || '').localeCompare(b.interno || '', undefined, { numeric: true }));
  const bajas = allVehicles.filter(v => v.empresa === empresa && v.estadoGeneral === 'Baja').length;
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"/></svg>';

  if (vehicles.length === 0) {
    openDashModal(empresa, 'Sin vehículos activos', 'linear-gradient(135deg,#00E5FF,#0891B2)', iconSvg, '<p class="text-[#4a5568] text-center py-6">No hay vehículos activos para esta empresa</p>');
    return;
  }

  const body = vehicles.map(v => {
    const d = daysUntil(v.vtv?.fechaVencimiento);
    let extra = '';
    if (d !== null && d <= 30) {
      const c = d <= 0 ? '#EF4444' : d <= 7 ? '#F97316' : '#F59E0B';
      extra = `<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:${c}22;color:${c};">VTV ${d <= 0 ? 'Venc.' : d + 'd'}</span>`;
    }
    return vehicleRow(v, extra);
  }).join('');

  const subtitle = `${vehicles.length} activo${vehicles.length > 1 ? 's' : ''}${bajas > 0 ? ' · ' + bajas + ' dados de baja' : ''}`;
  openDashModal(empresa, subtitle, 'linear-gradient(135deg,#00E5FF,#0891B2)', iconSvg, body);
}

function renderFleetHealth(vehicles) {
  const active = vehicles.filter(v => v.estadoGeneral !== 'Baja');
  let ok = 0, warn = 0, crit = 0;

  active.forEach(v => {
    const checks = [
      daysUntil(v.vtv?.fechaVencimiento),
      daysUntil(v.seguro?.fechaVencimiento),
      daysUntil(v.vencimientoDNI),
      daysUntil(v.vencimientoRegistro)
    ];
    let worst = 'ok';
    checks.forEach(d => {
      if (d === null) return;
      if (d <= 0) worst = 'crit';
      else if (d <= 30 && worst !== 'crit') worst = 'warn';
    });
    if (worst === 'crit') crit++;
    else if (worst === 'warn') warn++;
    else ok++;
  });

  const total = active.length;
  const pct = total > 0 ? Math.round(((ok) / total) * 100) : 0;

  const fill = document.getElementById('fleet-health-fill');
  if (fill) {
    const tone = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--dan)';
    fill.style.width = pct + '%';
    fill.style.background = tone;
  }

  const elOk = document.getElementById('fh-ok');
  const elOk2 = document.getElementById('fh-ok-2');
  const elWarn = document.getElementById('fh-warn');
  const elCrit = document.getElementById('fh-crit');
  const elTotal = document.getElementById('fh-total');
  if (elOk) elOk.textContent = ok;
  if (elOk2) elOk2.textContent = ok;
  if (elWarn) elWarn.textContent = warn;
  if (elCrit) elCrit.textContent = crit;
  if (elTotal) elTotal.textContent = total;
}

/* "N de 54" = cuántos tienen ese documento. `falta` cambia según de dónde
   viene el dato: si es un archivo de PATENTE/ lo que falta es el archivo, si
   es una fecha lo que falta es la carga. */
function renderDocCount(elId, withDoc, total, falta) {
  const el = document.getElementById(elId);
  if (!el) return;
  const missing = total - withDoc;
  if (missing > 0) {
    el.innerHTML = `<span class="${withDoc > 0 ? 't-ok' : 't-danger'}">${withDoc} de ${total}</span> <span class="t-subtle text-xs font-semibold">(${missing} ${falta})</span>`;
  } else {
    el.innerHTML = `<span class="t-ok">${withDoc} de ${total}</span> <span class="t-ok text-xs font-semibold">✓ completo</span>`;
  }
}

/* Escribe las 7 tarjetas de alerta en una sola pasada.
   Los ids salen del array `alerts` de dashboard.ejs:
     card-{k}-proximos   (el número grande)   -> OJO: "proximos", no "proximas"
     card-{k}-vencidos   (los que ya vencieron, línea aparte)
     card-{k}-docs       (la línea de detalle)
   El número grande cuenta SOLO lo que vence en los próximos 30 días, para que
   sume lo mismo que el KPI hero. Los ya vencidos no se esconden: van en su
   línea y mandan en la severidad. Todo guardado: que falte un id no puede
   volver a cortar el render entero. */
const ALERT_KEYS = ['vtv', 'seguro', 'cedula', 'matafuego', 'registro', 'dni', 'service'];

function setCardCounts(counts, expired, docs, active) {
  ALERT_KEYS.forEach(k => {
    const n = counts[k] || 0;
    const venc = expired[k] || 0;
    const el = document.getElementById('card-' + k + '-proximos');
    if (el) animateValue(el, parseInt(el.textContent) || 0, n, 800);
    // La severidad mira el total: 0 por vencer con 6 vencidos es rojo, no verde.
    setSev(k, n + venc);
    setVencidos(k, venc);
    if (DOC_EN_CARPETA.includes(k)) {
      // Sin el reporte no se puede afirmar qué documentación hay: mejor línea
      // vacía que un "0 de 54" inventado.
      if (!docsPresentes) return;
      renderDocCount('card-' + k + '-docs', docs[k] || 0, active, 'sin archivo');
    } else {
      renderDocCount('card-' + k + '-docs', docs[k] || 0, active, 'sin carga');
    }
  });
}

/* Los vencidos van en su propia línea porque el número grande ya no los
   incluye. Sin esto, VTV marcaba 8 y en realidad solo 2 vencían pronto: los
   otros 6 estaban vencidos hacía semanas (y en algún caso años) que estaban vencidos. */
function setVencidos(k, n) {
  const el = document.getElementById('card-' + k + '-vencidos');
  if (!el) return;
  el.className = 'alert-card__sub' + (n > 0 ? ' t-danger' : '');
  el.textContent = n > 0 ? `${n} vencido${n === 1 ? '' : 's'} (${n === 1 ? 'ya pasó' : 'ya pasaron'})` : '';
}

/* Severidad visual de cada tarjeta de alerta segun la cantidad real.
   0 = todo en regla (verde tenue) · 1-3 informativo · 4-9 atencion · 10+ urgente */
function setSev(alert, n) {
  const card = document.querySelector(`.alert-card[data-alert="${alert}"]`);
  if (!card) return;
  card.dataset.sev = n === 0 ? 'none' : n <= 3 ? 'info' : n <= 9 ? 'warn' : 'danger';
}
