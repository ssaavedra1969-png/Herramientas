let allData = [];
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
    const res = await fetch(`/api/admin/report?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    allData = data.items.map(d => ({ ...d, fecha: new Date(d.fecha) }));
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
  renderVehiculos(comb, rep);
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
  const totalL = data.reduce((s, d) => s + (d.monto > 0 ? 0 : 0) + Number(d.detalle?.match(/[\d.]+/)?.[0] || 0), 0);
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
  data.forEach(d => { const txt = d.detalle || ''; const match = txt.match(/Vencimiento[:\s]*(\d{2}\/\d{2}\/\d{4})/i); if (match) { const v = new Date(match[1].split('/').reverse().join('-')); const diff = Math.ceil((v - now) / 86400000); if (diff <= 0) vencidas++; else if (diff <= 30) proximas++; } });
  data.forEach(d => { if (d.fecha) { const diff = Math.ceil((d.fecha - now) / 86400000); if (diff <= 0) vencidas++; else if (diff <= 30) proximas++; } });
  const vtvAll = allData.filter(d => d.categoria === 'VTV');
  document.getElementById('vtv-total').textContent = fc(total);
  document.getElementById('vtv-count').textContent = data.length + ' registros';
  document.getElementById('vtv-table').innerHTML = data.map(d => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs max-w-[120px] truncate">${(d.detalle||'').split('·')[1]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${(d.detalle||'').split('·')[2]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td></tr>`).join('');
  document.getElementById('vtv-foot').classList.toggle('hidden', data.length === 0);
  document.getElementById('vtv-grand-total').textContent = fc(total);
}

function renderSeguro(data) {
  const total = data.reduce((s, d) => s + d.monto, 0);
  document.getElementById('seg-total').textContent = fc(total);
  document.getElementById('seg-count').textContent = data.length + ' registros';
  document.getElementById('seg-table').innerHTML = data.map(d => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#8E94A8] text-xs">${d.vehiculo||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs max-w-[120px] truncate">${(d.detalle||'').split('·')[1]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${(d.detalle||'').split('·')[2]?.trim()||'—'}</td><td class="py-2 pr-3 text-[#F1F3F8] text-xs">${fd(d.fecha)}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-medium">${fc(d.monto)}</td></tr>`).join('');
  document.getElementById('seg-foot').classList.toggle('hidden', data.length === 0);
  document.getElementById('seg-grand-total').textContent = fc(total);
}

function renderVehiculos(comb, rep) {
  const vehMap = {};
  vehicleMeta && Object.values(vehicleMeta).forEach(v => { if (v.patente) vehMap[v.patente] = { ...v, comb: 0, rep: 0 }; });
  comb.forEach(d => { if (d.vehiculo && vehMap[d.vehiculo]) vehMap[d.vehiculo].comb += d.monto; else if (d.vehiculo) vehMap[d.vehiculo] = { patente: d.vehiculo, marca: '', tipo: '', comb: d.monto, rep: 0 }; });
  rep.forEach(d => { if (d.vehiculo && vehMap[d.vehiculo]) vehMap[d.vehiculo].rep += d.monto; else if (d.vehiculo) vehMap[d.vehiculo] = { patente: d.vehiculo, marca: '', tipo: '', comb: 0, rep: d.monto }; });
  const arr = Object.values(vehMap).sort((a, b) => (b.comb + b.rep) - (a.comb + a.rep));
  const totalComb = arr.reduce((s, v) => s + v.comb, 0);
  const totalRep = arr.reduce((s, v) => s + v.rep, 0);
  document.getElementById('veh-total').textContent = arr.length;
  document.getElementById('veh-trompo').textContent = Object.values(vehicleMeta || {}).filter(v => v.tipo === 'Trompo').length;
  document.getElementById('veh-promedio').textContent = arr.length > 0 ? fc((totalComb + totalRep) / arr.length) : '$ 0';
  document.getElementById('veh-comb-total').textContent = fc(totalComb);
  document.getElementById('veh-count').textContent = arr.length + ' vehículos';
  document.getElementById('veh-table').innerHTML = arr.map(v => `<tr class="border-b border-[#6C3CE1]/5 hover:bg-white/[0.02]"><td class="py-2 pr-3 text-[#F1F3F8] text-xs font-medium">${v.patente}${v.interno ? ' (' + v.interno + ')' : ''}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${v.marca||'—'}</td><td class="py-2 pr-3 text-[#8E94A8] text-xs">${v.tipo||'—'}</td><td class="py-2 pr-3 text-right text-[#F1F3F8] text-xs">${fc(v.comb)}</td><td class="py-2 pr-3 text-right text-[#F1F3F8] text-xs">${fc(v.rep)}</td><td class="py-2 text-right text-[#F1F3F8] text-xs font-bold">${fc(v.comb + v.rep)}</td></tr>`).join('');
  document.getElementById('veh-foot').classList.toggle('hidden', arr.length === 0);
  document.getElementById('veh-total-comb').textContent = fc(totalComb);
  document.getElementById('veh-total-rep').textContent = fc(totalRep);
  document.getElementById('veh-grand-total').textContent = fc(totalComb + totalRep);
}

function getSectionData(section) {
  if (section === 'resumen') return allData;
  return allData.filter(d => d.categoria.toLowerCase() === section || (section === 'combustible' && d.categoria === 'Combustible') || (section === 'repuestos' && d.categoria === 'Repuestos') || (section === 'vtv' && d.categoria === 'VTV') || (section === 'seguro' && d.categoria === 'Seguro'));
}

function getSectionTitle(section) {
  const titles = { resumen: 'Resumen General', combustible: 'Combustible', repuestos: 'Repuestos', vtv: 'VTV', seguro: 'Seguro', vehiculos: 'Vehículos' };
  return titles[section] || 'Reporte';
}

function exportSectionExcel(section) {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;
  if (section === 'vehiculos') {
    const vehMap = {};
    vehicleMeta && Object.values(vehicleMeta).forEach(v => { if (v.patente) vehMap[v.patente] = { ...v, comb: 0, rep: 0 }; });
    allData.filter(d => d.categoria === 'Combustible').forEach(d => { if (vehMap[d.vehiculo]) vehMap[d.vehiculo].comb += d.monto; });
    allData.filter(d => d.categoria === 'Repuestos').forEach(d => { if (vehMap[d.vehiculo]) vehMap[d.vehiculo].rep += d.monto; });
    const rows = Object.values(vehMap).map(v => ({ Patente: v.patente, Interno: v.interno||'', Marca: v.marca||'', Modelo: v.modelo||'', Tipo: v.tipo||'', Combustible: v.comb, Repuestos: v.rep, Total: v.comb + v.rep }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehículos');
    XLSX.writeFile(wb, `reporte-vehiculos-${new Date().toISOString().split('T')[0]}.xlsx`);
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
    const vehMap = {};
    vehicleMeta && Object.values(vehicleMeta).forEach(v => { if (v.patente) vehMap[v.patente] = { ...v, comb: 0, rep: 0 }; });
    allData.filter(d => d.categoria === 'Combustible').forEach(d => { if (vehMap[d.vehiculo]) vehMap[d.vehiculo].comb += d.monto; });
    allData.filter(d => d.categoria === 'Repuestos').forEach(d => { if (vehMap[d.vehiculo]) vehMap[d.vehiculo].rep += d.monto; });
    const rows = Object.values(vehMap).map(v => [v.patente, v.interno||'', v.marca||'', v.tipo||'', fc(v.comb), fc(v.rep), fc(v.comb + v.rep)]);
    doc.autoTable({ startY: 34, head: [['Patente', 'Interno', 'Marca', 'Tipo', 'Combustible', 'Repuestos', 'Total']], body: rows, theme: 'grid', headStyles: { fillColor: [108, 60, 225], fontSize: 8 }, bodyStyles: { fontSize: 7 }, columnStyles: { 0: { cellWidth: 30 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } } });
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
  doc.text('Grupo Falpat SRL — Sistema de Control de Mantenimiento', 148, 200, { align: 'center' });
  doc.save(`reporte-${section}-${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado correctamente');
}