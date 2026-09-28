/* ==========================================================================
   Command palette (Cmd+K / Ctrl+K)
   Registro unico -> navegación + búsqueda de vehículos por patente/interno.
   Monta una sola vez y escucha el atajo durante toda la sesión.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__cmdkReady) return;
  window.__cmdkReady = true;

  const NAV = [
    { g: 'Operación', label: 'Dashboard', href: '/dashboard', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z' },
    { g: 'Operación', label: 'Vehículos', href: '/vehicles', icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25' },
    { g: 'Operación', label: 'Service', href: '/service', icon: 'M11.42 15.17l-5.658 5.658a2 2 0 01-2.83 0l-1.586-1.586a2 2 0 010-2.83l5.658-5.658m7.5-3.365a2.25 2.25 0 103.935 2.535 8.72 8.72 0 003.935-2.535m0 0l-3.935-2.535a8.72 8.72 0 00-3.935-2.535' },
    { g: 'Operación', label: 'Centros de Trabajo', href: '/centros', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
    { g: 'Análisis', label: 'Reportes', href: '/reports', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z' },
    { g: 'Utilidades', label: 'Escáner QR', href: '/vehicle/scan', icon: 'M3.75 7.5V6a2.25 2.25 0 012.25-2.25h1.5m9 0h1.5a2.25 2.25 0 012.25 2.25v1.5m0 9v1.5a2.25 2.25 0 01-2.25 2.25h-1.5m-9 0h-1.5A2.25 2.25 0 013 19.5V18m0-9.75h3v3H3v-3zm15 0h3v3h-3v-3zm-15 9h3v3H3v-3zm15 0h3v3h-3v-3z' },
  ];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Normaliza para buscar sin acentos: "vehiculo" debe encontrar "Vehículos"
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let overlay, input, list, vehicles = [], active = 0, results = [];

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'cmdk';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Buscador de comandos');
    overlay.innerHTML =
      '<div class="cmdk__panel">' +
        '<input class="cmdk__input" id="cmdk-input" type="text" autocomplete="off" spellcheck="false"' +
        ' placeholder="Buscar vehículo por patente o ir a…">' +
        '<div class="cmdk__list" id="cmdk-list" role="listbox"></div>' +
        '<div class="cmdk__foot">' +
          '<span><span class="kbd">↑</span><span class="kbd">↓</span> navegar</span>' +
          '<span><span class="kbd">↵</span> abrir</span>' +
          '<span><span class="kbd">esc</span> cerrar</span>' +
          '<span class="ml-auto" id="cmdk-hint">Escribí una patente (ej. AB922TD)</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('#cmdk-input');
    list = overlay.querySelector('#cmdk-list');
    input.addEventListener('input', () => render(input.value));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  }

  function open() {
    if (!overlay) build();
    overlay.classList.add('open');
    input.value = '';
    active = 0;
    render('');
    setTimeout(() => input.focus(), 30);
  }
  function close() { overlay?.classList.remove('open'); }

  function render(q) {
    const query = norm(q);
    results = [];
    active = 0;

    // 1) Vehículos: coincidencia fuerte (empieza por patente, o contiene)
    if (query.length >= 1) {
      const hits = vehicles
        .map((v) => ({ v, k: norm(`${v.patente || ''} ${v.interno || ''} ${v.marca || ''} ${v.modelo || ''}`) }))
        .filter((x) => x.k.includes(query))
        .slice(0, 6);
      hits.forEach((h) => results.push({
        g: 'Vehículos', label: h.v.patente || h.v.interno || '—',
        sub: [h.v.interno, `${h.v.marca || ''} ${h.v.modelo || ''}`.trim(), h.v.empresa].filter(Boolean).join(' · '),
        href: `/vehicle/${h.v.id}`, tag: 'Patente', _v: true,
      }));
    }

    // 2) Navegación
    NAV.forEach((n) => {
      if (!query || norm(n.label).includes(query)) {
        results.push({ g: n.g, label: n.label, href: n.href, icon: n.icon });
      }
    });

    if (!results.length) {
      list.innerHTML = '<div class="cmdk__empty">Sin resultados para “' + esc(q) + '”</div>';
      return;
    }

    let html = '';
    let group = null;
    results.forEach((r, i) => {
      if (r.g !== group) { group = r.g; html += '<div class="cmdk__group">' + esc(group) + '</div>'; }
      html += '<a class="cmdk__item" role="option" href="' + esc(r.href) + '" data-i="' + i + '"' +
        (i === active ? ' aria-selected="true"' : '') + '>';
      if (r._v) {
        html += '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25"/></svg>' +
          '<span class="font-mono font-semibold">' + esc(r.label) + '</span>' +
          '<span class="text-xs t-subtle truncate">' + esc(r.sub) + '</span>' +
          '<span class="tag">Abrir</span>';
      } else {
        html += '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="' + r.icon + '"/></svg>' +
          '<span>' + esc(r.label) + '</span>';
      }
      html += '</a>';
    });
    list.innerHTML = html;
  }

  function move(step) {
    const items = list.querySelectorAll('.cmdk__item');
    if (!items.length) return;
    if (active >= items.length) active = 0;
    items[active]?.removeAttribute('aria-selected');
    active = (active + step + items.length) % items.length;
    items[active].setAttribute('aria-selected', 'true');
    items[active].scrollIntoView({ block: 'nearest' });
  }

  // Atajo global: se registra una vez y vive toda la sesión
  document.addEventListener('keydown', (e) => {
    const isOpen = !!overlay?.classList.contains('open');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen ? close() : open();
      return;
    }
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const items = list.querySelectorAll('.cmdk__item');
      const href = items[Math.min(active, items.length - 1)]?.getAttribute('href');
      if (href) { close(); location.href = href; }
    }
  });

  // Trigger visible en la topbar
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cmdk-open]')) { e.preventDefault(); open(); }
  });

  // Precarga el padrón de vehículos para buscar al instante.
  // Usa la misma fuente que las páginas (SDK modular de Firestore) y es opcional.
  window.setCmdkVehicles = (list) => { vehicles = Array.isArray(list) ? list : []; };

  // Expuesto para que las páginas empujen su padrón si ya lo tienen cargado
  window.__cmdkPush = (list) => {
    if (Array.isArray(list) && list.length) vehicles = list;
  };
})();
