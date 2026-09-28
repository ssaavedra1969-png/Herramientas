/* ==========================================================================
   FALPAT — Reloj global (fecha + hora)
   Un solo lugar para la lógica, así todas las páginas muestran la misma hora
   sin depender de que el dashboard esté cargado.

   Montaje:
   - Si existe #topbar-clock (Dashboard y Vehículos) se rellena ese bloque,
     que vive al extremo derecho del topbar.
   - Si no existe (las 12 páginas sin topbar) se crea un elemento fijo en la
     esquina superior derecha, que se oculta por CSS en pantallas chicas para
     no tapar contenido.
   ========================================================================== */
(function () {
  var FLOAT_ID = 'falpat-clock';

  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var DIAS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
                    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function markup() {
    return '<span class="clock__date" data-clock-date>&mdash;</span>' +
           '<span class="clock__time">' +
             '<span data-clock-hh>00</span><span class="clock__sep">:</span>' +
             '<span data-clock-mm>00</span><span class="clock__sep">:</span>' +
             '<span class="clock__time-ss" data-clock-ss>00</span>' +
           '</span>';
  }

  function tick(host) {
    var now = new Date();
    var hh = host.querySelector('[data-clock-hh]');
    var mm = host.querySelector('[data-clock-mm]');
    var ss = host.querySelector('[data-clock-ss]');
    var date = host.querySelector('[data-clock-date]');
    if (hh) hh.textContent = pad(now.getHours());
    if (mm) mm.textContent = pad(now.getMinutes());
    if (ss) ss.textContent = pad(now.getSeconds());
    if (date) {
      // Fecha corta porque el bloque es angosto; la completa va en el title
      date.textContent = DIAS[now.getDay()] + ' ' + now.getDate() + ' ' +
                         MESES[now.getMonth()] + ' ' + now.getFullYear();
      date.title = DIAS_FULL[now.getDay()] + ' ' + now.getDate() + ' de ' +
                   MESES_FULL[now.getMonth()] + ' ' + now.getFullYear();
    }
  }

  function mount() {
    var host = document.getElementById('topbar-clock');

    if (!host) {
      if (document.getElementById(FLOAT_ID)) return;   // ya montado
      host = document.createElement('div');
      host.id = FLOAT_ID;
      host.className = 'clock-float';
      host.setAttribute('role', 'group');
      host.setAttribute('aria-label', 'Fecha y hora actual');
      host.innerHTML = markup();
      document.body.appendChild(host);
    }

    if (host.dataset.clockInit === '1') return;         // idempotente
    host.dataset.clockInit = '1';

    tick(host);
    setInterval(function () { tick(host); }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
