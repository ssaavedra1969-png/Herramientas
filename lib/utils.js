const { admin } = require('../config/firebase');

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (typeof val.seconds === 'number') return val.toDate();
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[toDate] Fecha inválida:', val);
    }
    return null;
  }
  return d;
}

function parseFecha(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toTimestamp(date) {
  if (!date) return null;
  if (date instanceof admin.firestore.Timestamp) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return admin.firestore.Timestamp.fromDate(d);
}

/* Un vehículo "deshabilitado" conserva toda su información pero deja de contar en
   TODOS los informes: Reportes (Flota, Documentación, Vencimientos), dashboard,
   Excel de control de documentación, control de matafuego, Carpeta de
   Documentación y reportes de gastos. En la pantalla /vehicles sigue viéndose
   (grisado) para poder consultarlo y reactivarlo a mano.

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
