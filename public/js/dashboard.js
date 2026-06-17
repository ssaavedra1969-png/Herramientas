let chartMantenimientos = null;
let chartCombustible = null;
let chartDonut = null;
let chartGastoVehiculos = null;

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListeners();
});

function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + name)?.classList.remove('hidden');
  document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
    btn.classList.remove('tab-btn-active', 'text-[#FF6B35]', 'border-b-2', 'border-[#FF6B35]');
    btn.classList.add('text-[#8E94A8]');
  });
  const activeBtn = document.getElementById('tab-btn-' + name);
  if (activeBtn) {
    activeBtn.classList.add('tab-btn-active', 'text-[#FF6B35]', 'border-b-2', 'border-[#FF6B35]');
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
  const alertas = [];

  function removeAlertsByPrefix(prefix) {
    for (let i = alertas.length - 1; i >= 0; i--) {
      if (alertas[i].id.endsWith(prefix)) alertas.splice(i, 1);
    }
  }

  db.collection('vehicles').orderBy('interno').onSnapshot((snapshot) => {
    const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const active = all.filter(d => d.estadoGeneral !== 'Baja').length;
    document.getElementById('card-vehiculos').textContent = active;
    renderDashboardVehicles(all);

    removeAlertsByPrefix('_vtv');
    removeAlertsByPrefix('_seguro');
    removeAlertsByPrefix('_service');
    all.forEach(v => {
      if (v.estadoGeneral === 'Baja') return;
      const daysVTV = daysUntil(v.vtv?.fechaVencimiento);
      const daysSeguro = daysUntil(v.seguro?.fechaVencimiento);
      const daysServiceF = daysUntil(v.proximoServiceFecha);

      if (getAlertLevel(daysVTV) !== 'none')
        alertas.push({ id: v.id + '_vtv', level: getAlertLevel(daysVTV), days: daysVTV, label: 'VTV', desc: v.patente, type: 'VTV', date: v.vtv?.fechaVencimiento });
      if (getAlertLevel(daysSeguro) !== 'none')
        alertas.push({ id: v.id + '_seguro', level: getAlertLevel(daysSeguro), days: daysSeguro, label: 'Seguro', desc: v.patente, type: 'Seguro', date: v.seguro?.fechaVencimiento });
      if (getAlertLevel(daysServiceF) !== 'none')
        alertas.push({ id: v.id + '_service', level: getAlertLevel(daysServiceF), days: daysServiceF, label: 'Service', desc: v.patente, type: 'Service', date: v.proximoServiceFecha });
    });
    updateAlertasUI();
  }, (error) => {
    console.error('Error en snapshot de vehículos:', error);
  });

  db.collection('tools').onSnapshot((snapshot) => {
    const malEstado = snapshot.docs.filter(d => ['Roto', 'En reparación'].includes(d.data().estado)).length;
    document.getElementById('card-herramientas').textContent = malEstado;
    document.getElementById('card-total-herramientas').textContent = snapshot.docs.length;

    let proxControl = 0;

    removeAlertsByPrefix('_control');
    snapshot.docs.forEach(d => {
      const t = d.data();
      if (t.estado === 'Descartado') return;
      const daysControl = daysUntil(t.proximoControl);
      if (daysControl <= 30 && daysControl >= 0) proxControl++;
      if (getAlertLevel(daysControl) !== 'none')
        alertas.push({ id: d.id + '_control', level: getAlertLevel(daysControl), days: daysControl, label: 'Control Hta.', desc: t.codigoInterno + ' - ' + t.nombre, type: 'Control Herramienta', date: t.proximoControl });
    });
    document.getElementById('card-prox-control').textContent = proxControl;
    renderToolsStatus(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    updateAlertasUI();
  }, (error) => {
    console.error('Error en snapshot de herramientas:', error);
  });

  db.collection('maintenance').onSnapshot((snapshot) => {
    const mantenimientosPorMes = {};

    removeAlertsByPrefix('_mto');
    snapshot.docs.forEach(d => {
      const m = d.data();
      const days = daysUntil(m.proximaFechaVencimiento);
      const level = getAlertLevel(days);

      if (level !== 'none' && m.estado !== 'Realizado') {
        alertas.push({
          id: d.id + '_mto', level, days,
          label: level === 'critical' ? 'Vencido' : level === 'warning' ? 'Próximo' : 'Por vencer',
          desc: m.descripcion || 'Mantenimiento', type: m.tipo,
          date: m.proximaFechaVencimiento,
          patente: m.vehiculoPatente, codigo: m.herramientaCodigo
        });
      }

      if (m.fechaRealizacion) {
        const date = m.fechaRealizacion.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        mantenimientosPorMes[monthKey] = (mantenimientosPorMes[monthKey] || 0) + 1;
      }
    });

    updateAlertasUI();
    renderMantenimientosChart(mantenimientosPorMes);
  }, (error) => {
    console.error('Error en snapshot de mantenimientos:', error);
  });

  function updateAlertasUI() {
    const critical = alertas.filter(a => a.level === 'critical').length;
    const warning = alertas.filter(a => a.level === 'warning').length;
    const total = critical + warning;

    document.getElementById('card-vencidos').textContent = critical;
    document.getElementById('card-proximos').textContent = warning;

    const sorted = [...alertas].sort((a, b) => (a.days || 999) - (b.days || 999));
    renderAlertas(sorted.slice(0, 8));

    const badge = document.getElementById('alert-badge');
    if (badge) {
      if (total > 0) { badge.textContent = total > 9 ? '9+' : total; badge.classList.remove('hidden'); }
      else { badge.classList.add('hidden'); }
    }
  }

  async function fetchFinancialData() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/dashboard/financial', { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      renderCombustibleChart(data.combustibleChart);
      renderDonutChart(data.donut.combustible, data.donut.mantenimiento, data.donut.repuestos, data.donut.vtv, data.donut.seguro);
      renderGastoVehiculosChart(Object.fromEntries(data.gastoVehiculos.map(g => [g.vehiculo, g.monto])));
      renderUltimosMovimientos(data.ultimosMovimientos.map(m => ({
        ...m,
        fecha: m.fecha ? (m.fecha._seconds ? new Date(m.fecha._seconds * 1000) : new Date(m.fecha)) : null
      })));
    } catch (e) {
      console.error('Error loading financial data:', e);
      document.querySelectorAll('[id^="chart-"], #ultimos-movimientos').forEach(el => {
        if (el) el.innerHTML = '<p class="text-red-500 text-sm">Error al cargar datos financieros</p>';
      });
    }
  }

  fetchFinancialData();
}

function renderAlertas(alertas) {
  const container = document.getElementById('alertas-lista');
  if (!container) return;

  if (alertas.length === 0) {
    container.innerHTML = '<p class="text-green-500 text-sm">No hay alertas activas</p>';
    return;
  }

  container.innerHTML = alertas.map(a => {
    const levelClass = a.level === 'critical' ? 'border-l-4 border-red-500 bg-red-900/20' : a.level === 'warning' ? 'border-l-4 border-yellow-500 bg-yellow-900/20' : 'border-l-4 border-blue-500 bg-blue-900/20';
    return `
      <div class="${levelClass} p-2.5 rounded-lg text-sm">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-medium text-[#F1F3F8] text-xs">${a.type || a.label}</p>
            <p class="text-[#8E94A8] text-xs mt-0.5">${a.desc || '—'}</p>
            ${a.date ? `<p class="text-[#5C6378] text-xs mt-0.5">${formatDate(a.date)}</p>` : ''}
          </div>
          <span class="text-base mt-0.5">${a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🔵'}</span>
        </div>
      </div>`;
  }).join('');
}

function renderMantenimientosChart(monthlyData) {
  const ctx = document.getElementById('chart-mantenimientos');
  if (!ctx) return;

  const sortedKeys = Object.keys(monthlyData).sort();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const labels = sortedKeys.map(k => { const [y, m] = k.split('-'); return `${months[parseInt(m) - 1]} ${y}`; });
  const values = sortedKeys.map(k => monthlyData[k]);

  if (chartMantenimientos) chartMantenimientos.destroy();

  chartMantenimientos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sin datos'],
      datasets: [{ label: 'Mantenimientos', data: labels.length ? values : [0], backgroundColor: '#3B82F6', borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, color: '#8E94A8' } }, x: { grid: { display: false }, ticks: { color: '#8E94A8' } } }
    }
  });
}

function renderCombustibleChart(chartData) {
  const ctx = document.getElementById('chart-combustible');
  if (!ctx) return;

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const labels = chartData.map(d => { const [y, m] = d.mes.split('-'); return `${months[parseInt(m) - 1]} ${y}`; });
  const litros = chartData.map(d => d.litros);
  const importes = chartData.map(d => d.importe);

  if (chartCombustible) chartCombustible.destroy();

  chartCombustible = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sin datos'],
      datasets: [
        { label: 'Litros', data: labels.length ? litros : [0], backgroundColor: '#FF6B35', borderRadius: 6, yAxisID: 'y' },
        { label: 'Importe ($)', data: labels.length ? importes : [0], backgroundColor: '#10B981', borderRadius: 6, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8E94A8' } } },
      scales: {
        y: { beginAtZero: true, position: 'left', ticks: { color: '#8E94A8' } },
        y1: { beginAtZero: true, position: 'right', ticks: { color: '#8E94A8', callback: v => '$' + v } },
        x: { grid: { display: false }, ticks: { color: '#8E94A8' } }
      }
    }
  });
}

function renderDonutChart(combustible, mantenimiento, repuestos, vtv, seguro) {
  const ctx = document.getElementById('chart-gastos-donut');
  if (!ctx) return;
  if (chartDonut) chartDonut.destroy();

  const labels = [];
  const data = [];
  const colors = [];
  if (combustible > 0) { labels.push('Combustible'); data.push(combustible); colors.push('#FF6B35'); }
  if (mantenimiento > 0) { labels.push('Mantenimiento'); data.push(mantenimiento); colors.push('#3B82F6'); }
  if (repuestos > 0) { labels.push('Repuestos'); data.push(repuestos); colors.push('#10B981'); }
  if (vtv > 0) { labels.push('VTV'); data.push(vtv); colors.push('#8B5CF6'); }
  if (seguro > 0) { labels.push('Seguro'); data.push(seguro); colors.push('#F59E0B'); }
  if (data.length === 0) { labels.push('Sin datos'); data.push(1); colors.push('#2D3142'); }

  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8E94A8', padding: 12 } },
        tooltip: { callbacks: { label: ctx2 => { const total = ctx2.dataset.data.reduce((a, b) => a + b, 0); const pct = ((ctx2.raw / total) * 100).toFixed(1); return ` ${ctx2.label}: $${ctx2.raw.toLocaleString('es-AR')} (${pct}%)`; } } }
      },
      cutout: '65%'
    }
  });
}

function renderGastoVehiculosChart(gastoPorVehiculo) {
  const ctx = document.getElementById('chart-gasto-vehiculos');
  if (!ctx) return;
  if (chartGastoVehiculos) chartGastoVehiculos.destroy();

  const sorted = Object.entries(gastoPorVehiculo).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(s => s[0]);
  const data = sorted.map(s => s[1]);
  if (labels.length === 0) { labels.push('Sin datos'); data.push(0); }

  const colors = labels.map((_, i) => `hsl(${(i * 137.5) % 360}, 70%, 50%)`);

  chartGastoVehiculos = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Gasto Combustible ($)', data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { color: '#8E94A8', callback: v => '$' + v } }, y: { grid: { display: false }, ticks: { color: '#8E94A8' } } }
    }
  });
}

function renderUltimosMovimientos(movimientos) {
  const container = document.getElementById('ultimos-movimientos');
  if (!container) return;
  if (movimientos.length === 0) {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">Sin movimientos</p>';
    return;
  }

  const MAX = 8;
  const shown = movimientos.slice(0, MAX);
  container.innerHTML = shown.map(m => {
    const color = m.tipo === 'Combustible' ? 'text-[#FF6B35]' : m.tipo === 'Mantenimiento' ? 'text-blue-400' : m.tipo === 'Repuestos' ? 'text-green-400' : m.tipo === 'VTV' ? 'text-purple-400' : m.tipo === 'Seguro' ? 'text-yellow-400' : 'text-[#8E94A8]';
    return `<div class="flex items-center justify-between py-2 border-b border-[#FF6B35]/5 last:border-0">
      <div class="min-w-0 flex-1">
        <p class="text-sm text-[#F1F3F8] truncate">${m.desc || '—'}</p>
        <p class="text-xs text-[#8E94A8]"><span class="${color}">${m.tipo}</span> · ${m.patente || '—'} · ${formatDate(m.fecha)}</p>
      </div>
      <p class="text-sm font-medium text-[#F1F3F8] ml-3">${formatCurrency(m.importe)}</p>
    </div>`;
  }).join('');
  if (movimientos.length > MAX) {
    container.innerHTML += `<p class="text-[#5C6378] text-xs text-center pt-2">+${movimientos.length - MAX} más</p>`;
  }
}

function renderToolsStatus(tools) {
  const container = document.getElementById('tools-status-list');
  if (!container) return;
  if (tools.length === 0) {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">No hay herramientas registradas</p>';
    return;
  }

  const estadoColor = { 'Bueno': 'text-green-400', 'Regular': 'text-yellow-400', 'Roto': 'text-red-400', 'En reparación': 'text-orange-400', 'Descartado': 'text-gray-500' };
  const admin = isAdmin();
  const MAX = 8;
  const showCount = tools.length <= MAX ? tools.length : MAX;

  container.innerHTML = tools.slice(0, showCount).map(t => {
    const color = estadoColor[t.estado] || 'text-[#8E94A8]';
    const controlDays = daysUntil(t.proximoControl);
    const controlLabel = controlDays <= 0 ? '<span class="text-red-400">Vencido</span>' : controlDays <= 7 ? `<span class="text-yellow-400">${controlDays}d</span>` : `<span class="text-[#5C6378]">${controlDays}d</span>`;
    const deleteBtn = admin ? `<button onclick="event.stopPropagation();deleteDashboardTool('${t.id}')" class="text-red-500 hover:text-red-400 ml-2" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : '';
    return `<div class="flex items-center justify-between py-2 border-b border-[#10B981]/5 last:border-0">
      <div class="min-w-0 flex-1">
        <p class="text-sm text-[#F1F3F8] truncate">${t.nombre || t.codigoInterno || '—'}</p>
        <p class="text-xs text-[#8E94A8]">${t.codigoInterno || ''} · ${t.categoria || ''}</p>
      </div>
      <div class="flex items-center gap-3 ml-3">
        <span class="text-xs font-medium ${color}">${t.estado || '—'}</span>
        <span class="text-xs">${controlLabel}</span>
        ${deleteBtn}
      </div>
    </div>`;
  }).join('');

  if (tools.length > MAX) {
    container.innerHTML += `<p class="text-[#5C6378] text-xs text-center pt-2">+${tools.length - MAX} más en <a href="/tools" class="text-[#10B981] hover:underline">Herramientas</a></p>`;
  }
}

function renderDashboardVehicles(vehicles) {
  const container = document.getElementById('dashboard-vehicles-list');
  if (!container) return;
  if (vehicles.length === 0) {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">No hay vehículos registrados</p>';
    return;
  }

  const admin = isAdmin();
  const MAX = 8;
  const showCount = vehicles.length <= MAX ? vehicles.length : MAX;

  container.innerHTML = vehicles.slice(0, showCount).map(v => {
    const label = `${v.marca || ''} ${v.modelo || ''}`.trim() || '—';
    const deleteBtn = admin ? `<button onclick="event.stopPropagation();deleteDashboardVehicle('${v.id}')" class="text-red-500 hover:text-red-400 ml-2" title="Eliminar"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : '';
    return `<div class="flex items-center justify-between py-2 border-b border-[#FF6B35]/5 last:border-0">
      <div class="min-w-0 flex-1">
        <p class="text-sm text-[#F1F3F8] truncate">${v.patente || '—'} · ${v.interno || ''}</p>
        <p class="text-xs text-[#8E94A8]">${label} · ${v.tipo || '—'}</p>
      </div>
      <div class="flex items-center gap-2 ml-3">
        <span class="text-xs ${v.estadoGeneral === 'Baja' ? 'text-red-400' : 'text-green-400'}">${v.estadoGeneral || '—'}</span>
        ${deleteBtn}
      </div>
    </div>`;
  }).join('');

  if (vehicles.length > MAX) {
    container.innerHTML += `<p class="text-[#5C6378] text-xs text-center pt-2">+${vehicles.length - MAX} más en <a href="/vehicles" class="text-[#FF6B35] hover:underline">Vehículos</a></p>`;
  }
}

async function deleteDashboardVehicle(id) {
  await deleteWithBackup('vehicles', id, 'Vehículo');
}

async function deleteDashboardTool(id) {
  await deleteWithBackup('tools', id, 'Herramienta');
}
