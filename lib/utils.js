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

module.exports = {
  toDate,
  parseFecha,
  toTimestamp
};
