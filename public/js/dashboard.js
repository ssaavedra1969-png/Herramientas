let chartCombustible = null;
let chartGastoVehiculos = null;

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
    const active = all.filter(d => d.estadoGeneral !== 'Baja').length;
    document.getElementById('card-vehiculos').textContent = active;
    renderEmpresas(all);
    renderAlertasVTV(all);
  }, (error) => {
    console.error('Error en snapshot de vehículos:', error);
  });

  db.collection('tools').onSnapshot((snapshot) => {
    const malEstado = snapshot.docs.filter(d => ['Roto', 'En reparación'].includes(d.data().estado)).length;
    document.getElementById('card-herramientas').textContent = malEstado;
    document.getElementById('card-total-herramientas').textContent = snapshot.docs.length;

    let proxControl = 0;
    snapshot.docs.forEach(d => {
      const t = d.data();
      if (t.estado === 'Descartado') return;
      const daysControl = daysUntil(t.proximoControl);
      if (daysControl <= 30 && daysControl >= 0) proxControl++;
    });
    document.getElementById('card-prox-control').textContent = proxControl;
    renderToolsStatus(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error('Error en snapshot de herramientas:', error);
  });

  async function fetchFinancialData() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/dashboard/financial', { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      renderCombustibleChart(data.combustibleChart);
      renderGastoVehiculosChart(Object.fromEntries(data.gastoVehiculos.map(g => [g.vehiculo, g.monto])));
    } catch (e) {
      console.error('Error loading financial data:', e);
      document.querySelectorAll('[id^="chart-"]').forEach(el => {
        if (el) el.innerHTML = '<p class="text-red-500 text-sm">Error al cargar datos financieros</p>';
      });
    }
  }

  fetchFinancialData();
}

function renderEmpresas(vehicles) {
  const container = document.getElementById('empresas-list');
  if (!container) return;

  const empresas = [...new Set(vehicles.map(v => v.empresa).filter(Boolean))].sort();
  document.getElementById('card-empresas').textContent = empresas.length || '0';

  if (empresas.length === 0) {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">Sin empresas registradas</p>';
    return;
  }

  container.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
    ${empresas.map(e => `
      <div class="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#10B981]/5 border border-[#10B981]/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-shadow duration-300">
        <span class="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.6)] shrink-0"></span>
        <span class="text-sm text-[#F1F3F8] truncate">${e}</span>
      </div>
    `).join('')}
  </div>`;
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
        { label: 'Litros', data: labels.length ? litros : [0], backgroundColor: '#6C3CE1', borderRadius: 6, yAxisID: 'y' },
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

function renderAlertasVTV(vehicles) {
  const container = document.getElementById('alertas-vtv');
  if (!container) return;

  const alertas = [];
  vehicles.forEach(v => {
    if (v.estadoGeneral === 'Baja') return;
    const days = daysUntil(v.vtv?.fechaVencimiento);
    if (getAlertLevel(days) === 'none') return;
    alertas.push({ days, label: `${v.patente || '—'} · ${v.interno || ''}`, date: v.vtv?.fechaVencimiento });
  });

  if (alertas.length === 0) {
    container.innerHTML = '<p class="text-green-500 text-sm">Todas las VTV están al día</p>';
    return;
  }

  alertas.sort((a, b) => (a.days || 999) - (b.days || 999));

  container.innerHTML = alertas.slice(0, 10).map(a => {
    const level = getAlertLevel(a.days);
    const levelClass = level === 'critical' ? 'border-l-4 border-red-500 bg-red-900/20' : level === 'warning' ? 'border-l-4 border-yellow-500 bg-yellow-900/20' : 'border-l-4 border-blue-500 bg-blue-900/20';
    const icon = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
    const label = level === 'critical' ? 'Vencida' : level === 'warning' ? 'Próxima a vencer' : 'Por vencer';
    return `
      <div class="${levelClass} p-2.5 rounded-lg text-sm flex items-start justify-between">
        <div>
          <p class="font-medium text-[#F1F3F8] text-xs">VTV · ${a.label}</p>
          <p class="text-[#8E94A8] text-xs mt-0.5">${label} · ${formatDate(a.date)}</p>
        </div>
        <span class="text-base flex-shrink-0 ml-2">${icon}</span>
      </div>`;
  }).join('');

  if (alertas.length > 10) {
    container.innerHTML += `<p class="text-[#5C6378] text-xs text-center pt-2">+${alertas.length - 10} más</p>`;
  }
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

function renderToolsStatus(tools) {
  const container = document.getElementById('tools-status-list');
  if (!container) return;
  if (tools.length === 0) {
    container.innerHTML = '<p class="text-[#5C6378] text-sm">No hay herramientas registradas</p>';
    return;
  }

  const estadoColor = { 'Bueno': 'text-green-400', 'Regular': 'text-yellow-400', 'Roto': 'text-red-400', 'En reparación': 'text-orange-400', 'Descartado': 'text-gray-500' };
  const MAX = 8;
  const showCount = tools.length <= MAX ? tools.length : MAX;

  container.innerHTML = tools.slice(0, showCount).map(t => {
    const color = estadoColor[t.estado] || 'text-[#8E94A8]';
    const controlDays = daysUntil(t.proximoControl);
    const controlLabel = controlDays <= 0 ? '<span class="text-red-400">Vencido</span>' : controlDays <= 7 ? `<span class="text-yellow-400">${controlDays}d</span>` : `<span class="text-[#5C6378]">${controlDays}d</span>`;
    return `<div class="flex items-center justify-between py-2 border-b border-[#10B981]/5 last:border-0">
      <div class="min-w-0 flex-1">
        <p class="text-sm text-[#F1F3F8] truncate">${t.nombre || t.codigoInterno || '—'}</p>
        <p class="text-xs text-[#8E94A8]">${t.codigoInterno || ''} · ${t.categoria || ''}</p>
      </div>
      <div class="flex items-center gap-3 ml-3">
        <span class="text-xs font-medium ${color}">${t.estado || '—'}</span>
        <span class="text-xs">${controlLabel}</span>
      </div>
    </div>`;
  }).join('');

  if (tools.length > MAX) {
    container.innerHTML += `<p class="text-[#5C6378] text-xs text-center pt-2">+${tools.length - MAX} más en <a href="/tools" class="text-[#10B981] hover:underline">Herramientas</a></p>`;
  }
}


