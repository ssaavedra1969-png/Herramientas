let allVehicles = [];

function openDashModal(title, subtitle, iconBg, iconSvg, bodyHtml) {
  document.getElementById('dash-modal-title').textContent = title;
  document.getElementById('dash-modal-subtitle').textContent = subtitle;
  const icon = document.getElementById('dash-modal-icon');
  icon.style.background = iconBg;
  icon.innerHTML = iconSvg;
  document.getElementById('dash-modal-body').innerHTML = bodyHtml;
  document.getElementById('dash-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeDashModal() {
  document.getElementById('dash-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function vehicleRow(v, extraRight) {
  return `
  <div class="rounded-xl p-3 transition hover:bg-white/[0.03] cursor-pointer" style="border-left:3px solid #6C3CE1;background:rgba(108,60,222,0.05);" onclick="closeDashModal();window.location.href='/vehicle/${v.id}'">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(108,60,222,0.15);color:#A78BFA;">${(v.interno || '?').substring(0,4)}</div>
        <div>
          <p class="text-[#F1F3F8] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
          <p class="text-[#5C6378] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
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
    ? '<p class="text-[#5C6378] text-center py-6">No hay vehículos activos</p>'
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
  openDashModal('Vehículos Activos', subtitle, 'linear-gradient(135deg,#6C3CE1,#4F46E5)', iconSvg, body);
}

function showVtvAlertModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.vtv?.fechaVencimiento);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.vtv?.fechaVencimiento) || 999) - (daysUntil(b.vtv?.fechaVencimiento) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('VTV por vencer', 'Todo al día', 'linear-gradient(135deg,#10B981,#059669)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-green-400 font-medium">Todas las VTV están al día</p></div>');
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
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(108,60,222,0.15);color:#A78BFA;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#F1F3F8] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#5C6378] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencida' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-[#8E94A8] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${vtvResult ? `<span class="text-[#5C6378]">·</span><span>${vtvResult}</span>` : ''}
        ${vtvCentro ? `<span class="text-[#5C6378]">·</span><span>${vtvCentro}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('VTV por vencer', `${alerts.length} vehículo${alerts.length > 1 ? 's' : ''} con vencimiento ≤30 días`, 'linear-gradient(135deg,#F59E0B,#F97316)', iconSvg, body);
}

function showSeguroModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.seguro?.fechaVencimiento);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.seguro?.fechaVencimiento) || 999) - (daysUntil(b.seguro?.fechaVencimiento) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Seguro por vencer', 'Todo al día', 'linear-gradient(135deg,#10B981,#059669)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-green-400 font-medium">Todos los seguros están al día</p></div>');
    return;
  }
  const body = alerts.map(v => {
    const d = daysUntil(v.seguro?.fechaVencimiento);
    const isCritical = d <= 0;
    const isWarning = d > 0 && d <= 7;
    const borderColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#8B5CF6';
    const bgColor = isCritical ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(249,115,22,0.08)' : 'rgba(139,92,246,0.08)';
    const textColor = isCritical ? '#EF4444' : isWarning ? '#F97316' : '#8B5CF6';
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
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style="background:rgba(139,92,246,0.15);color:#A78BFA;">${(v.interno || '?').substring(0,4)}</div>
          <div>
            <p class="text-[#F1F3F8] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#5C6378] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-[#8E94A8] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${compania ? `<span class="text-[#5C6378]">·</span><span>${compania}</span>` : ''}
        ${poliza ? `<span class="text-[#5C6378]">·</span><span>Póliza: ${poliza}</span>` : ''}
        ${costo ? `<span class="text-[#5C6378]">·</span><span>${costo}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('Seguro por vencer', `${alerts.length} vehículo${alerts.length > 1 ? 's' : ''} con vencimiento ≤30 días`, 'linear-gradient(135deg,#8B5CF6,#7C3AED)', iconSvg, body);
}

function showRegistroModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.vencimientoRegistro);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.vencimientoRegistro) || 999) - (daysUntil(b.vencimientoRegistro) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"/></svg>';
  if (alerts.length === 0) {
    openDashModal('Registro por vencer', 'Todo al día', 'linear-gradient(135deg,#10B981,#059669)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-green-400 font-medium">Todos los registros están al día</p></div>');
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
            <p class="text-[#F1F3F8] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#5C6378] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-[#8E94A8] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${registro ? `<span class="text-[#5C6378]">·</span><span>Reg: ${registro}</span>` : ''}
        ${chofer ? `<span class="text-[#5C6378]">·</span><span>${chofer}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('Registro por vencer', `${alerts.length} vehículo${alerts.length > 1 ? 's' : ''} con vencimiento ≤30 días`, 'linear-gradient(135deg,#EC4899,#DB2777)', iconSvg, body);
}

function showDniModal() {
  const alerts = allVehicles.filter(v => {
    if (v.estadoGeneral === 'Baja') return false;
    const d = daysUntil(v.vencimientoDNI);
    return d !== null && d <= 30;
  }).sort((a, b) => (daysUntil(a.vencimientoDNI) || 999) - (daysUntil(b.vencimientoDNI) || 999));
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"/></svg>';
  if (alerts.length === 0) {
    openDashModal('DNI por vencer', 'Todo al día', 'linear-gradient(135deg,#10B981,#059669)', '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', '<div class="text-center py-6"><p class="text-green-400 font-medium">Todos los DNI están al día</p></div>');
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
            <p class="text-[#F1F3F8] font-semibold text-sm tracking-wide">${v.patente || '—'}</p>
            <p class="text-[#5C6378] text-[10px]">${v.marca || ''} ${v.modelo || ''} ${v.empresa ? '· ' + v.empresa : ''}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider" style="background:${statusBg};color:${textColor};">${statusLabel}</span>
          <p class="text-xs font-bold mt-1" style="color:${textColor};">${isCritical ? 'Vencido' : d + ' días'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-[#8E94A8] ml-[42px]">
        <span>Vence: ${dateStr}</span>
        ${dni ? `<span class="text-[#5C6378]">·</span><span>DNI: ${dni}</span>` : ''}
        ${chofer ? `<span class="text-[#5C6378]">·</span><span>${chofer}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  openDashModal('DNI por vencer', `${alerts.length} vehículo${alerts.length > 1 ? 's' : ''} con vencimiento ≤30 días`, 'linear-gradient(135deg,#F97316,#EA580C)', iconSvg, body);
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
  initDashClock();
});

function initDashClock() {
  const clockEl = document.getElementById('dash-clock');
  const dateEl = document.getElementById('dash-date');
  if (!clockEl || !dateEl) return;

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const now = new Date();
    clockEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    dateEl.textContent = days[now.getDay()] + ' ' + now.getDate() + ' de ' + months[now.getMonth()] + ' ' + now.getFullYear();
  }

  tick();
  setInterval(tick, 1000);
}

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
      results.innerHTML = '<div class="px-4 py-3 text-[#5C6378] text-sm">Sin resultados</div>';
    } else {
      results.innerHTML = matches.map(v => {
        const extra = v.empresa ? `<span class="text-[10px] text-[#5C6378]">${v.empresa}</span>` : '';
        return `<div class="px-4 py-2.5 cursor-pointer hover:bg-white/[0.04] transition flex items-center gap-3" onclick="window.location.href='/vehicle/${v.id}'">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style="background:rgba(108,60,222,0.15);color:#A78BFA;">${(v.interno || '?').substring(0,4)}</div>
          <div class="flex-1 min-w-0">
            <p class="text-[#F1F3F8] text-sm font-semibold truncate">${v.patente || '—'}</p>
            <p class="text-[#5C6378] text-[10px] truncate">${v.marca || ''} ${v.modelo || ''}</p>
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

function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + name)?.classList.remove('hidden');
  document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
    btn.classList.remove('tab-btn-active', 'text-[#6C3CE1]', 'border-b-2', 'border-[#6C3CE1]');
    btn.classList.add('text-[#8E94A8]');
  });
  const activeBtn = document.getElementById('tab-btn-' + name);
  if (activeBtn) {
    activeBtn.classList.add('tab-btn-active', 'text-[#6C3CE1]', 'border-b-2', 'border-[#6C3CE1]');
    activeBtn.classList.remove('text-[#8E94A8]');
  }
}

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function initRealtimeListeners() {
  db.collection('vehicles').orderBy('interno').onSnapshot((snapshot) => {
    const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    allVehicles = all;
    const active = all.filter(d => d.estadoGeneral !== 'Baja').length;

    const elVehiculos = document.getElementById('card-vehiculos');
    const prevVehiculos = parseInt(elVehiculos.textContent) || 0;
    animateValue(elVehiculos, prevVehiculos, active, 800);

    let vtvCount = 0, seguroCount = 0, registroCount = 0, dniCount = 0;
    all.forEach(v => {
      if (v.estadoGeneral === 'Baja') return;
      const vtvDays = daysUntil(v.vtv?.fechaVencimiento);
      if (vtvDays !== null && vtvDays <= 30) vtvCount++;
      const segDays = daysUntil(v.seguro?.fechaVencimiento);
      if (segDays !== null && segDays <= 30) seguroCount++;
      const regDays = daysUntil(v.vencimientoRegistro);
      if (regDays !== null && regDays <= 30) registroCount++;
      const dniDays = daysUntil(v.vencimientoDNI);
      if (dniDays !== null && dniDays <= 30) dniCount++;
    });

    const elVtv = document.getElementById('card-vtv-proximas');
    const prevVtv = parseInt(elVtv.textContent) || 0;
    animateValue(elVtv, prevVtv, vtvCount, 800);

    const elSeg = document.getElementById('card-seguro-proximos');
    const prevSeg = parseInt(elSeg.textContent) || 0;
    animateValue(elSeg, prevSeg, seguroCount, 800);

    const elReg = document.getElementById('card-registro-proximos');
    const prevReg = parseInt(elReg.textContent) || 0;
    animateValue(elReg, prevReg, registroCount, 800);

    const elDni = document.getElementById('card-dni-proximos');
    const prevDni = parseInt(elDni.textContent) || 0;
    animateValue(elDni, prevDni, dniCount, 800);

    renderEmpresas(all);
    renderFleetHealth(all);
  }, (error) => {
    console.error('Error en snapshot de vehículos:', error);
  });
}

function renderEmpresas(vehicles) {
  const container = document.getElementById('empresas-list');
  if (!container) return;

  const empresas = [...new Set(vehicles.map(v => v.empresa).filter(Boolean))].sort();

  if (empresas.length === 0) {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">Sin empresas registradas</p>';
    return;
  }

  container.innerHTML = empresas.map(e => {
    const count = vehicles.filter(v => v.empresa === e && v.estadoGeneral !== 'Baja').length;
    return `
      <div class="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition hover:bg-white/[0.04]" style="border:1px solid rgba(16,185,129,0.12);background:rgba(16,185,129,0.04);" onclick="showEmpresaModal('${e.replace(/'/g, "\\'")}')">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#10B981,#059669);">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"/></svg>
          </div>
          <span class="text-sm text-[#F1F3F8] font-medium">${e}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-[#10B981] font-bold">${count} vehículo${count !== 1 ? 's' : ''}</span>
          <svg class="w-3.5 h-3.5 text-[#5C6378]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>`;
  }).join('');
}

function showEmpresaModal(empresa) {
  const vehicles = allVehicles.filter(v => v.empresa === empresa && v.estadoGeneral !== 'Baja').sort((a, b) => (a.interno || '').localeCompare(b.interno || '', undefined, { numeric: true }));
  const bajas = allVehicles.filter(v => v.empresa === empresa && v.estadoGeneral === 'Baja').length;
  const iconSvg = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"/></svg>';

  if (vehicles.length === 0) {
    openDashModal(empresa, 'Sin vehículos activos', 'linear-gradient(135deg,#10B981,#059669)', iconSvg, '<p class="text-[#5C6378] text-center py-6">No hay vehículos activos para esta empresa</p>');
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
  openDashModal(empresa, subtitle, 'linear-gradient(135deg,#10B981,#059669)', iconSvg, body);
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
    const color = pct >= 80 ? 'linear-gradient(90deg,#10B981,#059669)' : pct >= 50 ? 'linear-gradient(90deg,#F59E0B,#F97316)' : 'linear-gradient(90deg,#EF4444,#DC2626)';
    fill.style.width = pct + '%';
    fill.style.background = color;
  }

  const elOk = document.getElementById('fh-ok');
  const elWarn = document.getElementById('fh-warn');
  const elCrit = document.getElementById('fh-crit');
  const elTotal = document.getElementById('fh-total');
  if (elOk) elOk.textContent = ok;
  if (elWarn) elWarn.textContent = warn;
  if (elCrit) elCrit.textContent = crit;
  if (elTotal) elTotal.textContent = total;
}
