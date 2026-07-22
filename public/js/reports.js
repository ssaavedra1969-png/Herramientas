let allData = [];
let allVehiclesBasic = [];
let vehicleMeta = {};
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initDefaultDates();
  loadVehicleFilter();
  loadData();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => document.getElementById('mobile-menu')?.classList.remove('hidden'));
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => document.getElementById('mobile-menu')?.classList.add('hidden'));
}

function initDefaultDates() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  document.getElementById('filtro-desde').value = d.toISOString().split('T')[0];
  document.getElementById('filtro-hasta').value = new Date().toISOString().split('T')[0];
}

async function loadVehicleFilter() {
  try {
    const snap = await db.collection('vehicles').get();
    const sel = document.getElementById('filtro-vehiculo');
    snap.docs.forEach(d => {
      const v = d.data();
      const opt = document.createElement('option');
      opt.value = v.patente || '';
      opt.textContent = `${v.marca || ''} — ${v.patente || ''}${v.interno ? ' (' + v.interno + ')' : ''}`;
      opt.className = 'bg-[#0A0A1A]';
      sel.appendChild(opt);
      vehicleMeta[d.id] = { patente: v.patente || '', interno: v.interno || '', marca: v.marca || '', modelo: v.modelo || '', tipo: v.tipo || '' };
    });
  } catch (e) { console.error('Error loading vehicles:', e); }
}

async function loadData() {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;
    const vehiculo = document.getElementById('filtro-vehiculo').value;
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (vehiculo && vehiculo !== 'todos') params.set('vehiculo', vehiculo);
    const [reportRes, vbRes] = await Promise.all([
      fetch(`/api/admin/report?${params.toString()}`, { headers }),
      fetch('/api/admin/vehicles-basic', { headers })
    ]);
    if (!reportRes.ok) throw new Error(await reportRes.text());
    const data = await reportRes.json();
    allData = data.items.map(d => ({ ...d, fecha: new Date(d.fecha) }));
    if (vbRes.ok) {
      const vbData = await vbRes.json();
      allVehiclesBasic = vbData.vehicles || [];
    }
    renderAll();
  } catch (e) {
    console.error('Error loading report:', e);
    showToast('Error al cargar reportes: ' + e.message, 'error');
  }
}

function applyFilters() { loadData(); }

function switchTab(tab) {
  document.querySelectorAll('.report-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  renderAll();
}

function renderAll() {
  const comb = allData.filter(d => d.categoria === 'Combustible');
  const rep = allData.filter(d => d.categoria === 'Repuestos');
  const vtv = allData.filter(d => d.categoria === 'VTV');
  const seg = allData.filter(d => d.categoria === 'Seguro');
  renderResumen(comb, rep, vtv, seg);
  renderCombustible(comb);
  renderRepuestos(rep);
  renderVTV(vtv);
  renderSeguro(seg);
  renderVehiculos();
}

function fc(n) { return '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fd(d) { return d ? d.toLocaleDateString('es-AR') : '—'; }
const catColor = { Combustible: '#6C3CE1', Repuestos: '#10B981', VTV: '#8B5CF6', Seguro: '#F59E0B' };

function renderResumen(comb, rep, vtv, seg) {
  const tc = comb.reduce((s, d) => s + d.monto, 0);
  const tr = rep.reduce((s, d) => s + d.monto, 0);
  const tv = vtv.reduce((s, d) => s + d.monto, 0);
  const ts = seg.reduce((s, d) => s + d.monto, 0);
  document.getElementById('res-total-comb').textContent = fc(tc);
  document.getElementById('res-total-rep').textContent = fc(tr);
  document.getElementById('res-total-vtv').textContent = fc(tv);
  document.getElementById('res-total-seg').textContent = fc(ts);
  ['res-total-comb','res-total-rep','res-total-vtv','res-total-seg'].forEach(id => {
    const el = document.getElementById(id);
    el.parentElement.classList.toggle('opacity-40', parseFloat(el.textContent.replace(/[^0-9.,]/g, '').replace('.','').replace(',','.')) === 0);
  });
  const total = tc + tr + tv + ts;
  document.getElementById('res-count').textContent = allData.length + ' registros';
  document.getElementById('res-grand-total').textContent = fc(total);
  const sorted = [...allData].sort((a, b) => b.fecha - a.fecha);
  document.getElementById('res-table').innerHTML = sorted.slice(0, 100).map(d => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 pr-3 text-xs" style="color:${catColor[d.categoria]||'#8E94A8'}">${d.categoria}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs max-w-[150px] truncate">${d.detalle||'—'}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td></tr>`).join('');
  document.getElementById('res-foot').classList.toggle('hidden', allData.length === 0);
  renderDonutChart(tc, tr, tv, ts);
  renderTopVehicles(comb, rep);
}

function renderDonutChart(c, r, v, s) {
  if (charts.donut) charts.donut.destroy();
  const ctx = document.getElementById('chart-donut');
  if (!ctx) return;
  const labels = []; const values = []; const colors = [];
  if (c > 0) { labels.push('Combustible'); values.push(c); colors.push('#6C3CE1'); }
  if (r > 0) { labels.push('Repuestos'); values.push(r); colors.push('#10B981'); }
  if (v > 0) { labels.push('VTV'); values.push(v); colors.push('#8B5CF6'); }
  if (s > 0) { labels.push('Seguro'); values.push(s); colors.push('#F59E0B'); }
  if (!labels.length) { labels.push('Sin datos'); values.push(1); colors.push('#2A2D3A'); }
  charts.donut = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8E94A8', padding: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: c2 => { const tot = c2.dataset.data.reduce((a, b) => a + b, 0); return ` ${c2.label}: ${fc(c2.raw)} (${((c2.raw / tot) * 100).toFixed(1)}%)`; } } } }, cutout: '60%' } });
}

function renderTopVehicles(comb, rep) {
  if (charts.topVehicles) charts.topVehicles.destroy();
  const ctx = document.getElementById('chart-top-vehicles');
  if (!ctx) return;
  const byVeh = {};
  [...comb, ...rep].forEach(d => { if (d.vehiculo) byVeh[d.vehiculo] = (byVeh[d.vehiculo] || 0) + d.monto; });
  const sorted = Object.entries(byVeh).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) { sorted.push(['Sin datos', 0]); }
  charts.topVehicles = new Chart(ctx, { type: 'bar', data: { labels: sorted.map(s => s[0]), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: '#6C3CE1', borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c2 => ' ' + fc(c2.raw) } } }, scales: { x: { ticks: { color: '#5C6378', font: { size: 10 } }, grid: { color: 'rgba(108,60,225,0.05)' } }, y: { ticks: { color: '#8E94A8', font: { size: 10 } }, grid: { display: false } } } } });
}

function renderCombustible(data) {
  const totalI = data.reduce((s, d) => s + d.monto, 0);
  let sumL = 0;
  data.forEach(d => { const m = d.detalle?.match(/([\d.]+)\s*L/); if (m) sumL += parseFloat(m[1]) || 0; });
  document.getElementById('comb-litros').textContent = sumL.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' L';
  document.getElementById('comb-importe').textContent = fc(totalI);
  document.getElementById('comb-promedio').textContent = sumL > 0 ? fc(totalI / sumL) : '$ 0';
  document.getElementById('comb-count').textContent = data.length + ' registros';
  const sorted = [...data].sort((a, b) => a.fecha - b.fecha);
  document.getElementById('comb-table').innerHTML = sorted.map(d => {
    const litros = d.detalle?.match(/([\d.]+)\s*L/)?.[1] || '—';
    const tipo = d.detalle?.replace(/[\d.]+\s*L\s*/, '').trim() || '—';
    const precioL = parseFloat(litros) > 0 ? fc(d.monto / parseFloat(litros)) : '—';
    return `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${tipo}</td><td class="py-2 pr-3 text-right text-[#F1F3F8] text-xs">${litros} L</td><td class="py-2 pr-3 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td><td class="py-2 text-right text-[#8E94A8] text-xs">${precioL}</td></tr>`;
  }).join('');
  document.getElementById('comb-foot').classList.toggle('hidden', data.length === 0);
  document.getElementById('comb-total-litros').textContent = sumL.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' L';
  document.getElementById('comb-total-importe').textContent = fc(totalI);
  document.getElementById('comb-total-promedio').textContent = sumL > 0 ? fc(totalI / sumL) : '—';
  renderCombMensual(data);
  renderCombTipo(data);
}

function renderCombMensual(data) {
  if (charts.combMensual) charts.combMensual.destroy();
  const ctx = document.getElementById('chart-comb-mensual');
  if (!ctx) return;
  const monthly = {};
  data.forEach(d => { const k = `${d.fecha.getFullYear()}-${String(d.fecha.getMonth()+1).padStart(2,'0')}`; if (!monthly[k]) monthly[k] = { litros: 0, importe: 0 }; const l = d.detalle?.match(/([\d.]+)\s*L/); if (l) monthly[k].litros += parseFloat(l[1]) || 0; monthly[k].importe += d.monto; });
  const keys = Object.keys(monthly).sort();
  if (!keys.length) { keys.push('Sin datos'); monthly['Sin datos'] = { litros: 0, importe: 0 }; }
  charts.combMensual = new Chart(ctx, { type: 'bar', data: { labels: keys, datasets: [{ label: 'Importe', data: keys.map(k => monthly[k].importe), backgroundColor: '#6C3CE1', borderRadius: 4, yAxisID: 'y' }, { label: 'Litros', data: keys.map(k => monthly[k].litros), backgroundColor: '#00D4FF', borderRadius: 4, yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8E94A8', font: { size: 10 } } } }, scales: { x: { ticks: { color: '#5C6378', font: { size: 9 } }, grid: { display: false } }, y: { position: 'left', ticks: { color: '#6C3CE1', font: { size: 9 } }, grid: { color: 'rgba(108,60,225,0.05)' } }, y1: { position: 'right', ticks: { color: '#00D4FF', font: { size: 9 } }, grid: { display: false } } } } });
}

function renderCombTipo(data) {
  if (charts.combTipo) charts.combTipo.destroy();
  const ctx = document.getElementById('chart-comb-tipo');
  if (!ctx) return;
  const tipos = {};
  data.forEach(d => { const tipo = d.detalle?.replace(/[\d.]+\s*L\s*/, '').trim() || 'Otro'; tipos[tipo] = (tipos[tipo] || 0) + d.monto; });
  const labels = Object.keys(tipos); const values = Object.values(tipos);
  const colors = ['#6C3CE1', '#00D4FF', '#10B981', '#F59E0B', '#EF4444'];
  if (!labels.length) { labels.push('Sin datos'); values.push(0); }
  charts.combTipo = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8E94A8', font: { size: 10 }, padding: 8 } } }, cutout: '55%' } });
}

function renderRepuestos(data) {
  const total = data.reduce((s, d) => s + d.monto, 0);
  const unique = new Set(data.map(d => d.detalle).filter(Boolean)).size;
  document.getElementById('rep-total').textContent = fc(total);
  document.getElementById('rep-unique').textContent = unique;
  document.getElementById('rep-avg').textContent = unique > 0 ? fc(total / unique) : '$ 0';
  document.getElementById('rep-count').textContent = data.length + ' registros';
  const sorted = [...data].sort((a, b) => b.fecha - a.fecha);
  document.getElementById('rep-table').innerHTML = sorted.map(d => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs max-w-[150px] truncate">${d.detalle||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.proveedor||'—'}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td></tr>`).join('');
  document.getElementById('rep-foot').classList.toggle('hidden', data.length === 0);
  document.getElementById('rep-grand-total').textContent = fc(total);
  renderRepTop(data);
}

function renderRepTop(data) {
  if (charts.repTop) charts.repTop.destroy();
  const ctx = document.getElementById('chart-rep-top');
  if (!ctx) return;
  const byItem = {};
  data.forEach(d => { const k = d.detalle || 'Otro'; byItem[k] = (byItem[k] || 0) + d.monto; });
  const sorted = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) { sorted.push(['Sin datos', 0]); }
  charts.repTop = new Chart(ctx, { type: 'bar', data: { labels: sorted.map(s => s[0].substring(0, 25)), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: '#10B981', borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c2 => ' ' + fc(c2.raw) } } }, scales: { x: { ticks: { color: '#5C6378', font: { size: 10 } }, grid: { color: 'rgba(16,185,129,0.05)' } }, y: { ticks: { color: '#8E94A8', font: { size: 10 } }, grid: { display: false } } } } });
}

function renderVTV(data) {
  const total = data.reduce((s, d) => s + d.monto, 0);
  const now = new Date();
  let vencidas = 0, proximas = 0;
  data.forEach(d => { if (d.fecha) { const diff = Math.ceil((d.fecha - now) / 86400000); if (diff <= 0) vencidas++; else if (diff <= 30) proximas++; } });
  document.getElementById('vtv-total').textContent = fc(total);
  document.getElementById('vtv-vencidas').textContent = vencidas;
  document.getElementById('vtv-proximas').textContent = proximas;
  document.getElementById('vtv-count').textContent = data.length + ' registros';
  document.getElementById('vtv-table').innerHTML = data.map(d => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs max-w-[120px] truncate">${(d.detalle||'').split('·')[1]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${(d.detalle||'').split('·')[2]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td></tr>`).join('');
  document.getElementById('vtv-foot').classList.toggle('hidden', data.length === 0);
  document.getElementById('vtv-grand-total').textContent = fc(total);
}

function renderSeguro(data) {
  const total = data.reduce((s, d) => s + d.monto, 0);
  const now = new Date();
  let vencidos = 0, proximos = 0;
  data.forEach(d => { if (d.fecha) { const diff = Math.ceil((d.fecha - now) / 86400000); if (diff <= 0) vencidos++; else if (diff <= 30) proximos++; } });
  document.getElementById('seg-total').textContent = fc(total);
  document.getElementById('seg-vencidos').textContent = vencidos;
  document.getElementById('seg-proximos').textContent = proximos;
  document.getElementById('seg-count').textContent = data.length + ' registros';
  document.getElementById('seg-table').innerHTML = data.map(d => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs max-w-[120px] truncate">${(d.detalle||'').split('·')[1]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${(d.detalle||'').split('·')[2]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td></tr>`).join('');
  document.getElementById('seg-foot').classList.toggle('hidden', data.length === 0);
  document.getElementById('seg-grand-total').textContent = fc(total);
}

function renderVehiculos() {
  const vs = allVehiclesBasic;
  const now = new Date();
  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-AR') : '—';
  const fmtDateColor = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    const diff = Math.ceil((d - now) / 86400000);
    const txt = d.toLocaleDateString('es-AR');
    if (diff <= 0) return `<span class="text-red-400 font-medium">${txt} ⚠</span>`;
    if (diff <= 30) return `<span class="text-yellow-400 font-medium">${txt}</span>`;
    return `<span class="text-[#F1F3F8]">${txt}</span>`;
  };

  const total = vs.length;
  const trompo = vs.filter(v => v.trompo).length;
  const vtvVenc = vs.filter(v => v.vtvDiasRestantes !== null && v.vtvDiasRestantes <= 0).length;
  const vtvProx = vs.filter(v => v.vtvDiasRestantes !== null && v.vtvDiasRestantes > 0 && v.vtvDiasRestantes <= 30).length;
  const segVenc = vs.filter(v => v.seguroDiasRestantes !== null && v.seguroDiasRestantes <= 0).length;
  const segProx = vs.filter(v => v.seguroDiasRestantes !== null && v.seguroDiasRestantes > 0 && v.seguroDiasRestantes <= 30).length;

  document.getElementById('vb-total').textContent = total;
  document.getElementById('vb-trompo').textContent = trompo;
  document.getElementById('vb-vtv-venc').textContent = vtvVenc;
  document.getElementById('vb-vtv-prox').textContent = vtvProx;
  document.getElementById('vb-seg-venc').textContent = segVenc;
  document.getElementById('vb-seg-prox').textContent = segProx;
  document.getElementById('vb-count').textContent = total + ' vehículos';

  document.getElementById('vb-table').innerHTML = vs.map(v => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]">
    <td class="py-2 pr-2 text-[#F1F3F8] font-medium">${v.patente||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.interno||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.marca||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.modelo||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.anio||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.tipo||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.empresa||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.conductor||'—'}</td>
    <td class="py-2 pr-2 text-[#8E94A8]">${v.kilometraje ? Number(v.kilometraje).toLocaleString('es-AR') : '—'}</td>
    <td class="py-2 pr-2">${fmtDateColor(v.vtvVencimiento)}</td>
    <td class="py-2 pr-2">${fmtDateColor(v.seguroVencimiento)}</td>
    <td class="py-2 pr-2">${v.trompo ? '<span class="text-[#6C3CE1] font-medium">Si</span>' : '<span class="text-[#5C6378]">No</span>'}</td>
    <td class="py-2 text-[#8E94A8]">${v.proximoServiceFecha ? fmtDate(v.proximoServiceFecha) + (v.proximoServiceKm ? ' (' + Number(v.proximoServiceKm).toLocaleString('es-AR') + ' km)' : '') : v.proximoServiceKm ? Number(v.proximoServiceKm).toLocaleString('es-AR') + ' km' : '—'}</td>
  </tr>`).join('');

  renderVBTipo(vs);
  renderVBEmpresa(vs);
}

function renderVBTipo(vs) {
  if (charts.vbTipo) charts.vbTipo.destroy();
  const ctx = document.getElementById('chart-vb-tipo');
  if (!ctx) return;
  const tipos = {};
  vs.forEach(v => { const t = v.tipo || 'Sin tipo'; tipos[t] = (tipos[t] || 0) + 1; });
  const labels = Object.keys(tipos);
  const values = Object.values(tipos);
  const colors = ['#6C3CE1', '#00D4FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  charts.vbTipo = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8E94A8', padding: 8, font: { size: 10 } } } }, cutout: '55%' } });
}

function renderVBEmpresa(vs) {
  if (charts.vbEmpresa) charts.vbEmpresa.destroy();
  const ctx = document.getElementById('chart-vb-empresa');
  if (!ctx) return;
  const empresas = {};
  vs.forEach(v => { const e = v.empresa || 'Sin asignar'; empresas[e] = (empresas[e] || 0) + 1; });
  const sorted = Object.entries(empresas).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) { sorted.push(['Sin datos', 0]); }
  charts.vbEmpresa = new Chart(ctx, { type: 'bar', data: { labels: sorted.map(s => s[0]), datasets: [{ data: sorted.map(s => s[1]), backgroundColor: '#00D4FF', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8E94A8', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#5C6378', font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(0,212,255,0.05)' }, beginAtZero: true } } } });
}

function getSectionData(section) {
  if (section === 'resumen') return allData;
  return allData.filter(d => d.categoria.toLowerCase() === section || (section === 'combustible' && d.categoria === 'Combustible') || (section === 'repuestos' && d.categoria === 'Repuestos') || (section === 'vtv' && d.categoria === 'VTV') || (section === 'seguro' && d.categoria === 'Seguro'));
}

function getSectionTitle(section) {
  const titles = { resumen: 'Resumen General', combustible: 'Combustible', repuestos: 'Repuestos', vtv: 'VTV', seguro: 'Seguro', vehiculos: 'Ficha de Vehículos' };
  return titles[section] || 'Reporte';
}

function exportSectionExcel(section) {
  if (section === 'vehiculos') {
    const vs = allVehiclesBasic;
    const rows = vs.map(v => ({
      'Patente': v.patente, 'Interno': v.interno, 'Marca': v.marca, 'Modelo': v.modelo,
      'Año': v.anio, 'Tipo': v.tipo, 'Subtipo': v.subtipo, 'Empresa': v.empresa,
      'Conductor': v.conductor, 'Kilometraje': v.kilometraje, 'Horómetro': v.horometro,
      'Capacidad Carga': v.capacidadCarga, 'Estado': v.estadoGeneral,
      'VTV Resultado': v.vtvResultado, 'VTV Centro': v.vtvCentro,
      'VTV Vencimiento': v.vtvVencimiento ? new Date(v.vtvVencimiento).toLocaleDateString('es-AR') : '',
      'VTV Costo': v.vtvCosto || '',
      'Seguro Compañía': v.seguroCompania, 'Seguro Póliza': v.seguroPoliza,
      'Seguro Vencimiento': v.seguroVencimiento ? new Date(v.seguroVencimiento).toLocaleDateString('es-AR') : '',
      'Seguro Costo': v.seguroCosto || '',
      'Próx. Service Km': v.proximoServiceKm, 'Próx. Service Fecha': v.proximoServiceFecha ? new Date(v.proximoServiceFecha).toLocaleDateString('es-AR') : '',
      'Trompo': v.trompo ? 'Si' : 'No',
      'Marca Trompo': v.marcaTrompo, 'Serie Trompo': v.serieTrompo,
      'Modelo Trompo': v.modeloTrompo, 'Carga M3 Trompo': v.cargaM3Trompo,
      'Observaciones': v.observaciones
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ficha Vehículos');
    XLSX.writeFile(wb, `ficha-vehiculos-${new Date().toISOString().split('T')[0]}.xlsx`);
  } else {
    const data = getSectionData(section);
    const rows = data.map(d => ({ Fecha: d.fecha.toLocaleDateString('es-AR'), Categoria: d.categoria, Vehiculo: d.vehiculo||'', Detalle: d.detalle||'', Monto: d.monto, Proveedor: d.proveedor||'' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, getSectionTitle(section));
    XLSX.writeFile(wb, `reporte-${section}-${new Date().toISOString().split('T')[0]}.xlsx`);
  }
  showToast('Excel exportado correctamente');
}

function exportSectionPDF(section) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');
  const title = getSectionTitle(section);
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;
  doc.setFontSize(18);
  doc.setTextColor(108, 60, 225);
  doc.text('Grupo Falpat SRL', 14, 15);
  doc.setFontSize(12);
  doc.setTextColor(142, 148, 168);
  doc.text(`${title} — ${desde || 'Inicio'} al ${hasta || 'Hoy'}`, 14, 23);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 29);

  if (section === 'vehiculos') {
    const vs = allVehiclesBasic;
    const now = new Date();
    const rows = vs.map(v => {
      const vtv = v.vtvVencimiento ? new Date(v.vtvVencimiento).toLocaleDateString('es-AR') : '—';
      const seg = v.seguroVencimiento ? new Date(v.seguroVencimiento).toLocaleDateString('es-AR') : '—';
      const vtvMark = v.vtvDiasRestantes !== null && v.vtvDiasRestantes <= 0 ? '*' : '';
      const segMark = v.seguroDiasRestantes !== null && v.seguroDiasRestantes <= 0 ? '*' : '';
      return [v.patente||'—', v.interno||'—', v.marca||'—', v.modelo||'—', v.anio||'—', v.tipo||'—', v.empresa||'—', v.conductor||'—', v.kilometraje||'—', vtv+vtvMark, seg+segMark, v.trompo?'Si':'No'];
    });
    doc.autoTable({
      startY: 34,
      head: [['Patente', 'Interno', 'Marca', 'Modelo', 'Año', 'Tipo', 'Empresa', 'Conductor', 'Km', 'VTV Venc.', 'Seguro Venc.', 'Trompo']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [108, 60, 225], fontSize: 7 },
      bodyStyles: { fontSize: 6 },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 14 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 10 }, 5: { cellWidth: 22 }, 6: { cellWidth: 25 }, 7: { cellWidth: 25 }, 8: { cellWidth: 14 }, 9: { cellWidth: 18 }, 10: { cellWidth: 18 }, 11: { cellWidth: 12 } }
    });
    const finalY = doc.lastAutoTable.finalY || 34;
    if (finalY < 180) {
      doc.setFontSize(8);
      doc.setTextColor(255, 100, 100);
      doc.text('* = Vencido', 14, finalY + 6);
    }
  } else {
    const data = getSectionData(section);
    const rows = data.map(d => [d.fecha.toLocaleDateString('es-AR'), d.categoria, d.vehiculo||'', (d.detalle||'').substring(0, 40), fc(d.monto)]);
    doc.autoTable({ startY: 34, head: [['Fecha', 'Categoría', 'Vehículo', 'Detalle', 'Monto']], body: rows, theme: 'grid', headStyles: { fillColor: [108, 60, 225], fontSize: 8 }, bodyStyles: { fontSize: 7 }, columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } } });
    const total = data.reduce((s, d) => s + d.monto, 0);
    const finalY = doc.lastAutoTable.finalY || 34;
    doc.setFontSize(10);
    doc.setTextColor(108, 60, 225);
    doc.text(`Total: ${fc(total)}`, 280, finalY + 8, { align: 'right' });
  }
  doc.setFontSize(7);
  doc.setTextColor(92, 99, 120);
  doc.text('Grupo Falpat SRL — Sistema de Control Vehicular', 148, 200, { align: 'center' });
  doc.save(`reporte-${section}-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}
