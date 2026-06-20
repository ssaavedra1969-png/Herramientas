let allData = [];
let vehicleOptions = {};

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initFilters();
  loadData();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function initFilters() {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 3);
  document.getElementById('filtro-desde').value = desde.toISOString().split('T')[0];
  document.getElementById('filtro-hasta').value = new Date().toISOString().split('T')[0];
}

async function loadData() {
  showLoading(true);
  allData = [];

  try {
    const vehiclesSnap = await db.collection('vehicles').get();
    vehicleOptions = [];
    vehiclesSnap.docs.forEach(d => {
      const v = d.data();
      vehicleOptions.push({
        patente: v.patente || '',
        interno: v.interno || '',
        marca: v.marca || '',
        tipo: v.tipo || '',
        modelo: v.modelo || ''
      });
    });
    vehicleOptions.sort((a, b) => {
      const mc = (a.marca || '').localeCompare(b.marca || '');
      if (mc !== 0) return mc;
      const tc = (a.tipo || '').localeCompare(b.tipo || '');
      if (tc !== 0) return tc;
      return (a.patente || '').localeCompare(b.patente || '');
    });
    populateVehicleFilter();

    await fetchServerData();
  } catch (e) {
    console.error('Error loading reports:', e);
    document.getElementById('report-table-body').innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-500">Error al cargar datos</td></tr>';
  } finally {
    showLoading(false);
  }
}

async function fetchServerData() {
  try {
    const headers = await getAuthHeaders();
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const vehiculo = document.getElementById('filtro-vehiculo').value;

    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (categoria && categoria !== 'todas') params.set('categoria', categoria);
    if (vehiculo && vehiculo !== 'todos') params.set('vehiculo', vehiculo);

    const res = await fetch(`/api/admin/report?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    allData = data.items.map(d => ({ ...d, fecha: new Date(d.fecha) }));

    renderResumen(allData);
    renderTabla(allData);
    renderChartPorCategoria(allData);
  } catch (e) {
    console.error('Error fetching report:', e);
    document.getElementById('report-table-body').innerHTML =
      '<tr><td colspan="5" class="text-center py-8 text-red-500">Error del servidor: ' + e.message + '</td></tr>';
  }
}

function populateVehicleFilter() {
  const sel = document.getElementById('filtro-vehiculo');
  vehicleOptions.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.patente;
    const label = [v.marca, v.tipo, `${v.patente}${v.interno ? ' (' + v.interno + ')' : ''}`].filter(Boolean).join(' — ');
    opt.textContent = label;
    opt.className = 'bg-[#0A0A1A]';
    sel.appendChild(opt);
  });
}

function aplicarFiltros() {
  fetchServerData();
}

function renderResumen(data) {
  const totalComb = data.filter(d => d.categoria === 'Combustible').reduce((s, d) => s + d.monto, 0);
  const totalRep = data.filter(d => d.categoria === 'Repuestos').reduce((s, d) => s + d.monto, 0);
  const totalMto = data.filter(d => d.categoria === 'Mantenimiento').reduce((s, d) => s + d.monto, 0);
  const totalVTV = data.filter(d => d.categoria === 'VTV').reduce((s, d) => s + d.monto, 0);
  const totalSeguro = data.filter(d => d.categoria === 'Seguro').reduce((s, d) => s + d.monto, 0);

  document.getElementById('rep-total-combustible').textContent = formatCurrency(totalComb);
  document.getElementById('rep-total-repuestos').textContent = formatCurrency(totalRep);
  document.getElementById('rep-total-mantenimiento').textContent = formatCurrency(totalMto);
  document.getElementById('rep-total-vtv').textContent = formatCurrency(totalVTV);
  document.getElementById('rep-total-seguro').textContent = formatCurrency(totalSeguro);

  document.getElementById('rep-total-combustible').parentElement.classList.toggle('opacity-40', totalComb === 0);
  document.getElementById('rep-total-repuestos').parentElement.classList.toggle('opacity-40', totalRep === 0);
  document.getElementById('rep-total-mantenimiento').parentElement.classList.toggle('opacity-40', totalMto === 0);
  document.getElementById('rep-total-vtv').parentElement.classList.toggle('opacity-40', totalVTV === 0);
  document.getElementById('rep-total-seguro').parentElement.classList.toggle('opacity-40', totalSeguro === 0);
}

function renderTabla(data) {
  const tbody = document.getElementById('report-table-body');
  const tfoot = document.getElementById('report-table-foot');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-[#5C6378]">Sin resultados para los filtros seleccionados</td></tr>';
    tfoot.classList.add('hidden');
    return;
  }

  const colorMap = { Combustible: 'text-[#6C3CE1]', Repuestos: 'text-green-400', Mantenimiento: 'text-blue-400', VTV: 'text-purple-400', Seguro: 'text-yellow-400' };

  tbody.innerHTML = data.map(d => `
    <tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]">
      <td class="py-2.5 pr-3 text-[#F1F3F8]">${d.fecha.toLocaleDateString('es-AR')}</td>
      <td class="py-2.5 pr-3"><span class="${colorMap[d.categoria] || ''}">${d.categoria}</span></td>
      <td class="py-2.5 pr-3 text-[#8E94A8]">${d.vehiculo || '—'}</td>
      <td class="py-2.5 pr-3 text-[#8E94A8] max-w-[200px] truncate">${d.detalle || '—'}</td>
      <td class="py-2.5 text-right text-[#F1F3F8] font-medium">${formatCurrency(d.monto)}</td>
    </tr>`).join('');

  const total = data.reduce((s, d) => s + d.monto, 0);
  document.getElementById('report-total').textContent = formatCurrency(total);
  tfoot.classList.remove('hidden');
}

let chartCategoria = null;

function renderChartPorCategoria(data) {
  const ctx = document.getElementById('chart-por-categoria');
  if (!ctx) return;
  if (chartCategoria) chartCategoria.destroy();

  const totals = {};
  data.forEach(d => { totals[d.categoria] = (totals[d.categoria] || 0) + d.monto; });

  const labels = Object.keys(totals).length ? Object.keys(totals) : ['Sin datos'];
  const values = Object.keys(totals).length ? Object.values(totals) : [0];

  chartCategoria = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: ['#6C3CE1', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8E94A8', padding: 12 } },
        tooltip: { callbacks: { label: ctx2 => { const total = ctx2.dataset.data.reduce((a, b) => a + b, 0); const pct = ((ctx2.raw / total) * 100).toFixed(1); return ` ${ctx2.label}: $${ctx2.raw.toLocaleString('es-AR')} (${pct}%)`; } } }
      },
      cutout: '60%'
    }
  });
}

async function exportReporteXLSX() {
  try {
    showLoading(true);
    const headers = await getAuthHeaders();
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const vehiculo = document.getElementById('filtro-vehiculo').value;

    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (categoria && categoria !== 'todas') params.set('categoria', categoria);
    if (vehiculo && vehiculo !== 'todos') params.set('vehiculo', vehiculo);

    const res = await fetch(`/api/admin/report/export?${params.toString()}`, { headers });
    if (!res.ok) throw new Error('Error al generar el archivo');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-gastos-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Reporte exportado como Excel 📊');
  } catch (e) {
    showToast('Error al exportar: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}
