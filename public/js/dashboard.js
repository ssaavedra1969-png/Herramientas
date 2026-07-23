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
});

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

    let vtvCount = 0, seguroCount = 0;
    all.forEach(v => {
      if (v.estadoGeneral === 'Baja') return;
      const vtvDays = daysUntil(v.vtv?.fechaVencimiento);
      if (vtvDays !== null && vtvDays <= 30) vtvCount++;
      const segDays = daysUntil(v.seguro?.fechaVencimiento);
      if (segDays !== null && segDays <= 30) seguroCount++;
    });

    const elVtv = document.getElementById('card-vtv-proximas');
    const prevVtv = parseInt(elVtv.textContent) || 0;
    animateValue(elVtv, prevVtv, vtvCount, 800);

    const elSeg = document.getElementById('card-seguro-proximos');
    const prevSeg = parseInt(elSeg.textContent) || 0;
    animateValue(elSeg, prevSeg, seguroCount, 800);

    renderEmpresas(all);
    renderAlertasVTV(all);
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

function renderAlertasVTV(vehicles) {
  const container = document.getElementById('alertas-vtv');
  if (!container) return;

  const alertas = [];
  vehicles.forEach(v => {
    if (v.estadoGeneral === 'Baja') return;
    const vtvDays = daysUntil(v.vtv?.fechaVencimiento);
    if (vtvDays !== null && getAlertLevel(vtvDays) !== 'none') {
      alertas.push({ days: vtvDays, tipo: 'VTV', label: `${v.patente || '—'} · ${v.interno || ''}`, date: v.vtv?.fechaVencimiento });
    }
    const segDays = daysUntil(v.seguro?.fechaVencimiento);
    if (segDays !== null && getAlertLevel(segDays) !== 'none') {
      alertas.push({ days: segDays, tipo: 'Seguro', label: `${v.patente || '—'} · ${v.interno || ''}`, date: v.seguro?.fechaVencimiento });
    }
    const dniDays = daysUntil(v.vencimientoDNI);
    if (dniDays !== null && getAlertLevel(dniDays) !== 'none') {
      alertas.push({ days: dniDays, tipo: 'DNI', label: `${v.patente || '—'} · ${v.interno || ''}`, date: v.vencimientoDNI });
    }
    const regDays = daysUntil(v.vencimientoRegistro);
    if (regDays !== null && getAlertLevel(regDays) !== 'none') {
      alertas.push({ days: regDays, tipo: 'Registro', label: `${v.patente || '—'} · ${v.interno || ''}`, date: v.vencimientoRegistro });
    }
  });

  if (alertas.length === 0) {
    container.innerHTML = '<p class="text-green-500 text-sm">Todas las VTV y Seguros están al día</p>';
    return;
  }

  alertas.sort((a, b) => (a.days || 999) - (b.days || 999));

  container.innerHTML = alertas.slice(0, 15).map(a => {
    const level = getAlertLevel(a.days);
    const levelClass = level === 'critical' ? 'border-l-4 border-red-500 bg-red-900/20' : level === 'warning' ? 'border-l-4 border-yellow-500 bg-yellow-900/20' : 'border-l-4 border-blue-500 bg-blue-900/20';
    const icon = level === 'critical' ? '\uD83D\uDD34' : level === 'warning' ? '\uD83D\uDFE1' : '\uD83D\uDD35';
    const label = level === 'critical' ? 'Vencida' : level === 'warning' ? 'Próxima a vencer' : 'Por vencer';
    return `
      <div class="${levelClass} p-2.5 rounded-lg text-sm flex items-start justify-between">
        <div>
          <p class="font-medium text-[#F1F3F8] text-xs">${a.tipo} · ${a.label}</p>
          <p class="text-[#8E94A8] text-xs mt-0.5">${label} · ${formatDate(a.date)}</p>
        </div>
        <span class="text-base flex-shrink-0 ml-2">${icon}</span>
      </div>`;
  }).join('');

  if (alertas.length > 15) {
    container.innerHTML += `<p class="text-[#5C6378] text-xs text-center pt-2">+${alertas.length - 15} más</p>`;
  }
}
