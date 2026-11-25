const { admin } = require('../config/firebase');

function fechaDesdeValor(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6));
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const s = val.trim();
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toDate(val) {
  const d = fechaDesdeValor(val);
  if (!d && val && process.env.NODE_ENV !== 'production') {
    console.warn('[toDate] Fecha inválida:', val);
  }
  return d;
}

function parseFecha(val) {
  return fechaDesdeValor(val);
}

function toTimestamp(date) {
  if (!date) return null;
  if (date instanceof admin.firestore.Timestamp) return date;
  const d = fechaDesdeValor(date);
  if (!d) return null;
  return admin.firestore.Timestamp.fromDate(d);
}

/* Un vehículo "deshabilitado" conserva toda su información pero deja de contar en
   TODOS los informes: Reportes (Flota, Documentación, Vencimientos), dashboard,
   Excel de control de documentación, control de matafuego y reportes de gastos.
   En la pantalla /vehicles sigue viéndose (grisado) para poder consultarlo y
   reactivarlo a mano.

   ÚNICA EXCEPCIÓN: la Carpeta de Documentación (vista + PDF) SÍ los incluye, con
   una leyenda grande "DESHABILITADO" en la carátula y el tag DESHAB. en el índice,
   para que la carpeta física siga completa. server.js → cargarVehiculosCarpeta()
   los marca con `deshabilitadoFlag` en vez de filtrarlos.

   El campo es un booleano plano, `deshabilitado: true`. Se acepta el string
   "true" por si algún doc quedó escrito a mano desde la consola de Firebase. */
function esDeshabilitado(vehicle) {
  if (!vehicle) return false;
  const v = vehicle.deshabilitado !== undefined ? vehicle.deshabilitado : vehicle.data && vehicle.data().deshabilitado;
  return v === true || v === 'true';
}

// Filtro para usar sobre un snapshot de `vehicles` ya mapeado a objetos planos.
function sinDeshabilitados(vehicles) {
  return vehicles.filter(v => !esDeshabilitado(v));
}

module.exports = {
  toDate,
  parseFecha,
  toTimestamp,
  esDeshabilitado,
  sinDeshabilitados
};
