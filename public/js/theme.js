/* ==========================================================================
   FALPAT — Selector de tema
   4 temas: pro · claro · industrial · auto (sistema)
   Persiste la eleccion en localStorage y la aplica sin flash.
   ========================================================================== */
(function () {
  const KEY = 'falpat_theme';
  const THEMES = [
    { id: 'pro',        name: 'Pro',        desc: 'Noche indigo, acento electrico' },
    { id: 'claro',      name: 'Claro',      desc: 'Papel calido, bajo brillo' },
    { id: 'industrial', name: 'Industrial', desc: 'Grafito + ambar, sensorial flota' },
    { id: 'auto',       name: 'Auto',       desc: 'Sigue al sistema (claro/oscuro)' }
  ];
  const DEFAULT_THEME = 'pro';

  /* El color de la barra del navegador tiene que coincidir con --bg-app del
     tema activo. Se lee del CSS en vez de hardcodearlo: los valores fijos
     quedaron desfasados dos veces al rediseñar los temas. */
  function themeColor() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-app').trim() || null;
  }

  function saved() {
    try { return localStorage.getItem(KEY) || DEFAULT_THEME; } catch (e) { return DEFAULT_THEME; }
  }

  function apply(id) {
    const t = THEMES.some(x => x.id === id) ? id : DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor() || '#0a0b16';
    return t;
  }

  window.__falpatTheme = { apply: apply, themes: THEMES, get: function () { return document.documentElement.getAttribute('data-theme'); } };

  function build() {
    if (document.getElementById('theme-fab')) return;
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;

    var menu = document.createElement('div');
    menu.id = 'theme-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = THEMES.map(function (t) {
      return '<button type="button" class="theme-item' + (t.id === current ? ' active' : '') +
        '" data-theme-id="' + t.id + '" role="menuitem">' +
        '<span class="sw sw-' + t.id + '"></span>' +
        '<span><span class="nm">' + t.name + '</span><br><span class="ds">' + t.desc + '</span></span>' +
        '<span class="ck">' + (t.id === current ? '✓' : '') + '</span></button>';
    }).join('');

    var fab = document.createElement('button');
    fab.id = 'theme-fab';
    fab.type = 'button';
    fab.title = 'Cambiar tema';
    fab.setAttribute('aria-label', 'Cambiar tema de la aplicacion');
    fab.setAttribute('aria-haspopup', 'menu');
    fab.innerHTML = '<span class="fab-swatch sw-' + current + '"></span><span id="theme-fab-name">' +
      (THEMES.find(function (t) { return t.id === current; }) || THEMES[0]).name + '</span>';

    document.body.appendChild(fab);
    document.body.appendChild(menu);

    function refresh(t) {
      menu.querySelectorAll('.theme-item').forEach(function (b) {
        var on = b.dataset.themeId === t;
        b.classList.toggle('active', on);
        b.querySelector('.ck').textContent = on ? '✓' : '';
      });
      fab.querySelector('.fab-swatch').className = 'fab-swatch sw-' + t;
      var lbl = document.getElementById('theme-fab-name');
      var found = THEMES.find(function (x) { return x.id === t; });
      if (lbl && found) lbl.textContent = found.name;
    }

    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('.theme-item');
      if (!btn) return;
      e.stopPropagation();
      var t = apply(btn.dataset.themeId);
      refresh(t);
      menu.classList.remove('open');
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && !fab.contains(e.target)) menu.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') menu.classList.remove('open');
    });

    window.__falpatRefreshTheme = refresh;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
