let chartCombustible = null;
let chartGastoVehiculos = null;
let chartDonutGastos = null;

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
    const active = all.filter(d => d.estadoGeneral !== 'Baja').length;

    const elVehiculos = document.getElementById('card-vehiculos');
    const prevVehiculos = parseInt(elVehiculos.textContent) || 0;
    animateValue(elVehiculos, prevVehiculos, active, 800);

    const now = new Date();
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

    const elEmpresas = document.getElementById('card-empresas');
    const empresas = [...new Set(all.map(v => v.empresa).filter(Boolean))];
    const prevEmp = parseInt(elEmpresas.textContent) || 0;
    animateValue(elEmpresas, prevEmp, empresas.length, 800);

    renderEmpresas(all);
    renderAlertasVTV(all);
  }, (error) => {
    console.error('Error en snapshot de vehículos:', error);
  });

  async function fetchFinancialData() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/dashboard/financial', { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      renderCombustibleChart(data.combustibleChart);
      renderGastoVehiculosChart(Object.fromEntries(data.gastoVehiculos.map(g => [g.vehiculo, g.monto])));
      renderDonutGastos(data.donut);
      renderGastoMes(data.donut, data.combustibleChart);
    } catch (e) {
      console.error('Error loading financial data:', e);
      document.querySelectorAll('[id^="chart-"]').forEach(el => {
        if (el) el.innerHTML = '<p class="text-red-500 text-sm">Error al cargar datos financieros</p>';
      });
    }
  }

  fetchFinancialData();
}

function renderGastoMes(donut, combustibleChart) {
  if (!donut) return;
  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let gastoMes = 0;
  if (combustibleChart) {
    const mesData = combustibleChart.find(d => d.mes === mesActual);
    if (mesData) gastoMes += mesData.importe || 0;
  }
  gastoMes += donut.repuestos || 0;
  const el = document.getElementById('card-gasto-mes');
  if (el) el.textContent = '$' + Math.round(gastoMes).toLocaleString('es-AR');
}

function renderEmpresas(vehicles) {
  const container = document.getElementById('empresas-list');
  if (!container) return;

  const empresas = [...new Set(vehicles.map(v => v.empresa).filter(Boolean))].sort();

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
    const icon = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
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

function renderDonutGastos(donut) {
  const ctx = document.getElementById('chart-donut-gastos');
  if (!ctx || !donut) return;
  if (chartDonutGastos) chartDonutGastos.destroy();

  const entries = [
    ['Combustible', donut.combustible || 0],
    ['Repuestos', donut.repuestos || 0],
    ['VTV', donut.vtv || 0],
    ['Seguro', donut.seguro || 0]
  ].filter(e => e[1] > 0);

  if (entries.length === 0) entries.push(['Sin datos', 1]);

  chartDonutGastos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: ['#6C3CE1', '#10B981', '#F59E0B', '#8B5CF6'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8E94A8', padding: 8, font: { size: 10 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: $${ctx.raw.toLocaleString('es-AR')}` } }
      }
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
