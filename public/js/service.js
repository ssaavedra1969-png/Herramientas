let SVC = {
  vehicles: new Map(),
  services: new Map(),
  search: '',
  sortField: 'due',
  sortDir: 'asc',
  estadoPill: '',
  openIds: new Set(),
  unsubscribers: [],
  timer: null
};

const normStr = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function toMs(x) {
  if (x == null) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (typeof x.toDate === 'function') return x.toDate().getTime();
  if (x instanceof Date) return x.getTime();
  if (x.seconds != null) return x.seconds * 1000;
  if (x._seconds != null) return x._seconds * 1000;
  const n = Date.parse(x);
  return isNaN(n) ? null : n;
}

function daysUntil(x) {
  const ms = toMs(x);
  if (ms == null) return null;
  const d = Math.floor((ms - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function fmtFecha(x) {
  const ms = toMs(x);
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString('es-AR');
}

function fmtKm(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-AR') + ' km';
}

function serviceSummaryOf(vehicleId) {
  const list = [...(SVC.services.get(vehicleId) || new Map()).values()];
  const perTipo = {};
  const order = [];
  list.forEach(s => {
    const tipo = (s.tipo || 'Otro').trim() || 'Otro';
    if (!perTipo[tipo]) { perTipo[tipo] = null; order.push(tipo); }
    const cur = perTipo[tipo];
    const curMs = cur ? toMs(cur.fecha) : -Infinity;
    const newMs = toMs(s.fecha) ?? 0;
    if (!cur || newMs >= curMs) {
      perTipo[tipo] = { fecha: s.fecha || null, km: s.km || null, proximoKm: s.proximoKm ?? null, proximoFecha: s.proximoFecha || null };
    }
  });
  let minFecha = null, nextTipo = null;
  order.forEach(t => {
    const cur = perTipo[t];
    if (cur && cur.proximoFecha) {
      const ms = toMs(cur.proximoFecha);
      if (ms != null && (minFecha == null || ms < toMs(minFecha))) { minFecha = cur.proximoFecha; nextTipo = t; }
    }
  });
  return { perTipo, order, minFecha, nextTipo };
}

function computeEstado(v, sum) {
  const has = (SVC.services.get(v.id) || new Map()).size > 0;
  if (sum.minFecha == null) return { estado: has ? 'al_dia' : 'sin_service', days: null };
  const days = daysUntil(sum.minFecha);
  if (days <= 0) return { estado: 'vencido', days };
  if (days <= 30) return { estado: 'por_vencer', days };
  return { estado: 'proximo', days };
}

const ESTADO = {
  vencido:     { label: 'VENCIDO',     color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  pill: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30' },
  por_vencer:  { label: 'POR VENCER',  color: '#F97316', bg: 'rgba(249,115,22,0.12)', pill: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30' },
  proximo:     { label: 'PRÓXIMO',     color: '#FACC15', bg: 'rgba(250,204,21,0.10)', pill: 'bg-[#FACC15]/15 text-[#FACC15] border-[#FACC15]/30' },
  al_dia:      { label: 'AL DÍA',      color: '#00E5FF', bg: 'rgba(0,229,255,0.08)',  pill: 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/30' },
  sin_service: { label: 'SIN SERVICE', color: '#8b9bb4', bg: 'rgba(139,155,180,0.08)',pill: 'bg-[#8b9bb4]/15 text-[#8b9bb4] border-[#8b9bb4]/30' }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function buildMainRow(r) {
  const { v, sum, info } = r;
  const e = ESTADO[info.estado];
  const isOpen = SVC.openIds.has(v.id);
  const proxBig = sum.minFecha ? fmtFecha(sum.minFecha) : '—';
  const proxSub = sum.nextTipo ? esc(sum.nextTipo) : '—';
  const days = sum.minFecha ? daysUntil(sum.minFecha) : info.days;
  const vencBig = Number.isFinite(days) ? (days <= 0 ? 'Vencido' : `en ${days} días`) : '—';
  const rowBorder = info.estado === 'vencido' ? 'border-l-2 border-l-[#EF4444]' : info.estado === 'por_vencer' ? 'border-l-2 border-l-[#F97316]' : info.estado === 'proximo' ? 'border-l-2 border-l-[#FACC15]' : '';
  return `
  <tr class="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors ${rowBorder}" onclick="service.toggle('${v.id}')">
    <td class="px-1.5 py-2 text-center w-8"><svg class="w-3.5 h-3.5 mx-auto text-[#4a5568] transition-transform ${isOpen?'rotate-90':''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td>
    <td class="px-2 py-2"><span class="font-semibold text-[#ffffff] tracking-wide">${esc(v.patente)}</span><div class="text-[10px] text-[#4a5568]">Int. ${esc(v.interno || '—')}</div></td>
    <td class="px-2 py-2 text-[#8b9bb4] text-xs">${esc(v.marca || '')} ${esc(v.modelo || '')}<div class="text-[10px] text-[#4a5568]">${esc(v.empresa || '—')}${v.centroTrabajo ? ' · ' + esc(v.centroTrabajo) : ''}</div></td>
    <td class="px-2 py-2 text-xs">${fmtFecha(r.serviceMs)}<div class="text-[10px] text-[#4a5568]">${esc(r.lastServiceTipo || '')}</div></td>
    <td class="px-2 py-2 text-xs"><span class="font-medium text-[#ffffff]">${proxBig}</span><div class="text-[10px] text-[#4a5568]">${proxSub}</div></td>
    <td class="px-2 py-2 text-xs" style="color:${e.color}">${vencBig}</td>
    <td class="px-3 py-2 text-right"><span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${e.pill}">${e.label}</span></td>
  </tr>`;
}

function buildDetailRow(v, sum) {
  const svcList = [...(SVC.services.get(v.id) || new Map()).values()]
    .sort((a, b) => (toMs(b.fecha) ?? 0) - (toMs(a.fecha) ?? 0)).slice(0, 25);
  const types = sum.order.map(t => {
    const c = sum.perTipo[t]; if (!c) return '';
    const p = c.proximoKm != null && c.proximoFecha != null ? `${fmtKm(c.proximoKm)} · ${fmtFecha(c.proximoFecha)}`
      : c.proximoKm != null ? fmtKm(c.proximoKm) : c.proximoFecha ? fmtFecha(c.proximoFecha) : '—';
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-[#2563EB]/20 bg-[#2563EB]/10 text-[#8b9bb4]"><span class="text-[#2563EB]">${esc(t)}</span>→<span class="text-[#ffffff]">${p}</span></span>`;
  }).filter(Boolean).join('');
  const infoItems = [
    ['Km', v.kilometraje != null ? fmtKm(v.kilometraje) : '—'],
    ['Horómetro', v.horometro != null ? Number(v.horometro).toLocaleString('es-AR') : '—'],
    ['Tipo', v.tipo || '—'],
    ['BET', v.nroBet || '—'],
    ['Chofer', v.chofer || '—'],
    ['Estado', v.estadoGeneral || '—']
  ].map(([k, val]) => `<div class="text-[10px]"><span class="text-[#4a5568] uppercase tracking-wider">${k}:</span> <span class="text-[#ffffff] font-medium">${esc(val)}</span></div>`).join('<span class="mx-1 text-[#2563EB]/20">·</span>');
  const rows = svcList.map(s => `
    <tr class="border-t border-white/5">
      <td class="px-2.5 py-1.5 text-[#ffffff] text-[11px] whitespace-nowrap">${fmtFecha(s.fecha)}</td>
      <td class="px-2.5 py-1.5 text-[#8b9bb4] text-[11px]">${esc(s.tipo || 'Otro')}</td>
      <td class="px-2.5 py-1.5 text-[#8b9bb4] text-[11px] text-right whitespace-nowrap">${fmtKm(s.km)}</td>
      <td class="px-2.5 py-1.5 text-[#8b9bb4] text-[11px] text-right whitespace-nowrap">${fmtKm(s.proximoKm)}</td>
      <td class="px-2.5 py-1.5 text-[#8b9bb4] text-[11px] whitespace-nowrap">${fmtFecha(s.proximoFecha)}</td>
      <td class="px-2.5 py-1.5 text-[#8b9bb4] text-[11px] whitespace-nowrap">${esc(s.proveedor || '')}</td>
    </tr>`).join('');
  return `<tr class="detail hidden" id="detail-${v.id}"><td colspan="7" class="p-0">
    <div class="mx-3 mb-3 mt-1 border-l-2 border-[#2563EB]/30 bg-[#0a0e17]/50 rounded-r-lg">
      <div class="px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">${infoItems}</div>
      ${types ? `<div class="px-4 pb-2 flex flex-wrap gap-1.5">${types}</div>` : ''}
      <div class="px-4 pb-3 overflow-x-auto">
        <table class="w-full text-[11px] min-w-[600px]">
          <thead><tr class="text-[#4a5568] text-[10px] uppercase tracking-wider border-b border-white/5">
            <th class="px-2.5 py-1.5 text-left font-semibold">Fecha</th>
            <th class="px-2.5 py-1.5 text-left font-semibold">Servicio</th>
            <th class="px-2.5 py-1.5 text-right font-semibold">Km</th>
            <th class="px-2.5 py-1.5 text-right font-semibold">Próx. km</th>
            <th class="px-2.5 py-1.5 text-left font-semibold">Próx. fecha</th>
            <th class="px-2.5 py-1.5 text-left font-semibold">Proveedor</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="px-3 py-4 text-center text-[#4a5568]">Sin services</td></tr>'}</tbody>
        </table>
      </div>
      <div class="px-4 pb-3 flex justify-end"><a href="/vehicle/${v.id}" class="text-[11px] font-medium text-[#2563EB] hover:text-[#60A5FA] transition-colors">Ver vehículo →</a></div>
    </div>
  </td></tr>`;
}

function buildProximos(list) {
  const wrap = document.getElementById('svc-proximos');
  if (!list.length) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
  wrap.classList.remove('hidden');
  wrap.innerHTML = `
  <div class="rounded-xl border border-[#F97316]/25 bg-[#F97316]/[0.05] overflow-hidden">
    <div class="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-[#F97316]/15">
      <span class="w-2 h-2 rounded-full bg-[#F97316]"></span>
      <h2 class="text-xs font-bold tracking-wide text-[#F97316]">Próximos a realizar</h2>
      <span class="px-2 py-0.5 rounded-md bg-[#F97316]/15 text-[#F97316] text-[10px] font-bold">${list.length}</span>
      ${list.some(r => r.info.estado === 'vencido') ? '<span class="text-[10px] text-[#EF4444] font-semibold">Incluye vencidos</span>' : ''}
    </div>
    <div class="divide-y divide-white/5">
      ${list.map(r => {
        const v = r.v, e = ESTADO[r.info.estado], sum = r.sum;
        const days = r.info.days;
        const txt = Number.isFinite(days) ? (days <= 0 ? `vencido hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}` : `en ${days} día${days === 1 ? '' : 's'}`) : '—';
        const border = r.info.estado === 'vencido' ? 'border-l-[#EF4444]' : 'border-l-[#F97316]';
        return `
      <a href="/vehicle/${v.id}" class="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors border-l-2 ${border}">
        <span class="w-24 sm:w-32 font-bold text-sm text-[#ffffff] tracking-wide truncate">${esc(v.patente)}</span>
        <span class="text-xs text-[#8b9bb4] flex-1 truncate">${esc(v.marca || '')} ${esc(v.modelo || '')}${v.empresa ? ' · ' + esc(v.empresa) : ''}</span>
        <span class="hidden sm:block text-xs text-[#ffffff]">${esc(sum.nextTipo || '—')} · ${sum.minFecha ? fmtFecha(sum.minFecha) : '—'}</span>
        <span class="text-xs font-bold" style="color:${e.color}">${txt}</span>
        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${e.pill}">${e.label}</span>
      </a>`;
      }).join('')}
    </div>
  </div>`;
}

function buildWithoutRow(v) {
  return `<tr class="border-b border-white/5 hover:bg-white/[0.02]">
    <td class="px-3 py-2"><span class="font-semibold text-[#ffffff] tracking-wide">${esc(v.patente)}</span><div class="text-[10px] text-[#4a5568]">Int. ${esc(v.interno || '—')}</div></td>
    <td class="px-2 py-2 text-[#8b9bb4] text-xs">${esc(v.marca || '')} ${esc(v.modelo || '')}${v.tipo ? ' · ' + esc(v.tipo) : ''}</td>
    <td class="px-2 py-2 text-[#8b9bb4] text-xs">${esc(v.empresa || '—')}</td>
    <td class="px-3 py-2 text-right"><a href="/vehicle/${v.id}" class="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[#2563EB]/30 text-[#2563EB] hover:bg-[#2563EB]/10 transition-colors">Cargar service →</a></td>
  </tr>`;
}

function render() {
  const search = normStr(SVC.search);
  const allRows = [];
  const counts = { vencido: 0, por_vencer: 0, proximo: 0, al_dia: 0, sin_service: 0 };

  for (const [id, v] of SVC.vehicles) {
    if (v.estadoGeneral === 'Baja') continue;
    const sum = serviceSummaryOf(id);
    const info = computeEstado(v, sum);
    const svc = [...(SVC.services.get(id) || new Map()).values()];
    const last = svc.length ? svc.reduce((a, b) => (toMs(a.fecha) ?? 0) >= (toMs(b.fecha) ?? 0) ? a : b) : null;
    const lastMs = last ? toMs(last.fecha) : null;
    const lastTipo = last ? (last.tipo || 'Otro').trim() || 'Otro' : null;
    const dueMs = sum.minFecha ? toMs(sum.minFecha) : null;
    const r = { id, v, sum, info, patSort: (v.patente || '').toUpperCase(), serviceMs: lastMs, lastServiceTipo: lastTipo, dueMs };
    counts[info.estado]++;
    allRows.push(r);
  }

  const withoutTotal = counts.sin_service;
  const withRows = allRows.filter(r => r.info.estado !== 'sin_service');
  const withoutRows = allRows.filter(r => r.info.estado === 'sin_service');

  if (SVC.estadoPill) {
    const allowed = new Set([SVC.estadoPill]);
    for (let i = withRows.length - 1; i >= 0; i--) if (!allowed.has(withRows[i].info.estado)) withRows.splice(i, 1);
  }

  const matchHay = r => [r.v.patente, r.v.interno, r.v.marca, r.v.modelo, r.v.empresa, r.v.tipo, r.sum.nextTipo, r.v.centroTrabajo, r.v.chofer, ...([...(SVC.services.get(r.v.id) || new Map()).values()].map(s => `${s.tipo} ${s.proveedor}`))].join(' ');
  if (search) {
    for (let i = withRows.length - 1; i >= 0; i--) if (!normStr(matchHay(withRows[i])).includes(search)) withRows.splice(i, 1);
    for (let i = withoutRows.length - 1; i >= 0; i--) if (!normStr(matchHay(withoutRows[i])).includes(search)) withoutRows.splice(i, 1);
  }

  const proximos = withRows.filter(r => r.info.estado === 'vencido' || r.info.estado === 'por_vencer')
    .sort((a, b) => (a.dueMs ?? 1e18) - (b.dueMs ?? 1e18));
  buildProximos(proximos);

  sortRows(withRows);

  const openIds = new Set(SVC.openIds);
  SVC.openIds = openIds;

  const body = document.getElementById('service-body');
  const empty = document.getElementById('service-empty');
  body.innerHTML = withRows.map(r => buildMainRow(r) + buildDetailRow(r.v, r.sum)).join('');
  empty.classList.toggle('hidden', withRows.length > 0);

  document.getElementById('svc-with-count').textContent = withRows.length;
  document.getElementById('total-vehicles').textContent = withRows.length + withoutRows.length;

  document.getElementById('svc-without-count').textContent = withoutTotal;
  document.getElementById('svc-without').classList.toggle('hidden', withoutTotal === 0);
  const wb = document.getElementById('service-without-body');
  wb.innerHTML = withoutRows.length ? withoutRows.map(r => buildWithoutRow(r.v)).join('')
    : '<tr><td colspan="4" class="px-3 py-4 text-center text-[#4a5568] text-xs">Ninguno coincide con la búsqueda</td></tr>';

  const bad = document.getElementById('service-badge');
  if (bad) { const n = counts.vencido + counts.por_vencer; bad.textContent = n; n > 0 ? bad.classList.remove('hidden') : bad.classList.add('hidden'); }

  const totalCon = counts.vencido + counts.por_vencer + counts.proximo + counts.al_dia;
  const pillData = [
    { key: '', label: 'Todos', n: totalCon, color: '#8b9bb4' },
    { key: 'vencido', label: 'Vencidos', n: counts.vencido, color: ESTADO.vencido.color },
    { key: 'por_vencer', label: 'Por vencer', n: counts.por_vencer, color: ESTADO.por_vencer.color },
    { key: 'proximo', label: 'Próximos', n: counts.proximo, color: ESTADO.proximo.color },
    { key: 'al_dia', label: 'Al día', n: counts.al_dia, color: ESTADO.al_dia.color }
  ];
  document.getElementById('estado-pills').innerHTML = pillData.map(p => {
    const on = SVC.estadoPill === p.key;
    return `<button onclick="service.filterEstado('${p.key}')" class="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${on ? 'border-current bg-current/10' : 'border-[#4a5568]/30 text-[#8b9bb4] hover:border-[#2563EB]/30'}" style="${on ? 'color:' + p.color : ''}">${p.label} <span class="${on ? 'opacity-100' : 'opacity-60'}">${p.n}</span></button>`;
  }).join('');

  document.querySelectorAll('.sort-btn').forEach(btn => {
    const key = btn.dataset.sort;
    const arrow = btn.querySelector('.sort-arrow');
    if (key === SVC.sortField) {
      arrow.textContent = SVC.sortDir === 'asc' ? '▲' : '▼';
      btn.classList.add('text-[#ffffff]');
      btn.classList.remove('text-[#4a5568]');
    } else {
      arrow.textContent = '⇅';
      btn.classList.remove('text-[#ffffff]');
      btn.classList.add('text-[#4a5568]');
    }
  });
}

function sortRows(rows) {
  const key = SVC.sortField;
  const dir = SVC.sortDir;
  rows.sort((a, b) => {
    let res;
    if (key === 'patente') {
      res = (a.patSort || '').localeCompare(b.patSort || '', 'es', { numeric: true, sensitivity: 'base' });
    } else {
      const va = key === 'service' ? a.serviceMs : a.dueMs;
      const vb = key === 'service' ? b.serviceMs : b.dueMs;
      const aN = va == null, bN = vb == null;
      if (aN && bN) return 0;
      if (aN) return 1;
      if (bN) return -1;
      res = va < vb ? -1 : va > vb ? 1 : 0;
    }
    return dir === 'asc' ? res : -res;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  document.getElementById('service-search').addEventListener('input', e => { SVC.search = e.target.value; render(); });
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.sort;
      if (SVC.sortField === key) SVC.sortDir = SVC.sortDir === 'asc' ? 'desc' : 'asc';
      else { SVC.sortField = key; SVC.sortDir = key === 'service' ? 'desc' : 'asc'; }
      render();
    });
  });
  initRealtime();
});

function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const back = menu && menu.querySelector('#mobile-menu-backdrop');
  btn?.addEventListener('click', () => menu?.classList.remove('hidden'));
  back?.addEventListener('click', () => menu?.classList.add('hidden'));
}

function clearListeners() { SVC.unsubscribers.forEach(u => { try { u(); } catch (e) {} }); SVC.unsubscribers = []; }

function initRealtime() {
  clearListeners();
  if (SVC.timer) { clearInterval(SVC.timer); SVC.timer = null; }
  loadPanel();
  SVC.timer = setInterval(loadPanel, 60000);

  const qv = db.collection('vehicles').onSnapshot(snap => {
    SVC.vehicles = new Map();
    snap.docs.forEach(d => SVC.vehicles.set(d.id, d.data()));
    render();
  }, err => console.error('Error cargando vehículos:', err.message));
  SVC.unsubscribers.push(qv);
}

async function loadPanel() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/vehicles/services/panel', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const services = new Map();
    const vehicles = new Map();
    for (const id of Object.keys(data)) {
      const m = new Map();
      (data[id].services || []).forEach(s => m.set(s.id, s));
      services.set(id, m);
      vehicles.set(id, data[id].vehiculo);
    }
    SVC.services = services;
    SVC.vehicles = vehicles;
    render();
  } catch (e) {
    console.error('Error cargando panel services:', e.message);
    showToast?.('Error al cargar datos de services', 'error');
  }
}

const service = {
  toggle(id) {
    const detail = document.getElementById('detail-' + id);
    const chevron = document.querySelector(`tr[onclick*="${id}"] svg`);
    if (!detail) return;
    SVC.openIds.has(id) ? SVC.openIds.delete(id) : SVC.openIds.add(id);
    detail.classList.toggle('hidden');
    chevron?.classList.toggle('rotate-90');
  },
  filterEstado(key) { SVC.estadoPill = SVC.estadoPill === key ? '' : key; render(); },
  reload() { clearListeners(); if (SVC.timer) { clearInterval(SVC.timer); SVC.timer = null; } initRealtime(); }
};
window.service = service;