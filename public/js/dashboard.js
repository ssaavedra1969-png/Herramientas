let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListeners();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function initRealtimeListeners() {
  let vehiculosActivos = 0;
  let herramientasMalEstado = 0;
  let vencidosHoy = 0;
  let proximos7 = 0;
  const alertas = [];

  db.collection('vehicles').onSnapshot((snapshot) => {
    vehiculosActivos = snapshot.docs.filter(d => d.data().estado === 'Activo').length;
    document.getElementById('card-vehiculos').textContent = vehiculosActivos;
  });

  db.collection('tools').onSnapshot((snapshot) => {
    herramientasMalEstado = snapshot.docs.filter(d => ['Roto', 'En reparación'].includes(d.data().estado)).length;
    document.getElementById('card-herramientas').textContent = herramientasMalEstado;
  });

  db.collection('maintenance').onSnapshot((snapshot) => {
    vencidosHoy = 0;
    proximos7 = 0;
    alertas.length = 0;
    const monthlyData = {};

    snapshot.docs.forEach(d => {
      const m = d.data();
      const days = daysUntil(m.proximaFechaVencimiento);
      const level = getAlertLevel(days);

      if (level === 'critical' && m.estado !== 'Realizado') {
        vencidosHoy++;
        alertas.push({ id: d.id, ...m, level, days, label: 'Vencido' });
      } else if (level === 'warning' && m.estado !== 'Realizado') {
        proximos7++;
        alertas.push({ id: d.id, ...m, level, days, label: 'Próximo a vencer' });
      } else if (level === 'info') {
        alertas.push({ id: d.id, ...m, level, days, label: 'Por vencer' });
      }

      if (m.fechaRealizacion) {
        const date = m.fechaRealizacion.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      }
    });

    alertas.sort((a, b) => (a.days || 999) - (b.days || 999));

    document.getElementById('card-vencidos').textContent = vencidosHoy;
    document.getElementById('card-proximos').textContent = proximos7;
    renderAlertas(alertas.slice(0, 10));
    renderChart(monthlyData);
  });
}

function renderAlertas(alertas) {
  const container = document.getElementById('alertas-lista');
  if (!container) return;

  if (alertas.length === 0) {
    container.innerHTML = '<p class="text-green-600 text-sm">No hay alertas activas</p>';
    return;
  }

  container.innerHTML = alertas.map(a => {
    const levelClass = a.level === 'critical' ? 'alert-critical' : a.level === 'warning' ? 'alert-warning' : 'alert-info';
    return `
      <div class="${levelClass} p-3 rounded-lg text-sm">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-medium text-gray-800">${a.label}</p>
            <p class="text-gray-600 text-xs mt-0.5">${a.descripcion || 'Sin descripción'}</p>
            <p class="text-gray-500 text-xs mt-0.5">${a.vehiculoPatente || a.herramientaCodigo || '—'} · ${formatDate(a.proximaFechaVencimiento)}</p>
          </div>
          <span class="text-lg">${a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟡' : '🔵'}</span>
        </div>
      </div>`;
  }).join('');
}

function renderChart(monthlyData) {
  const ctx = document.getElementById('chart-mantenimientos');
  if (!ctx) return;

  const sortedKeys = Object.keys(monthlyData).sort();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const labels = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    return `${months[parseInt(m) - 1]} ${y}`;
  });
  const values = sortedKeys.map(k => monthlyData[k]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sin datos'],
      datasets: [{
        label: 'Mantenimientos',
        data: labels.length ? values : [0],
        backgroundColor: '#3B82F6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
    }
  });
}
