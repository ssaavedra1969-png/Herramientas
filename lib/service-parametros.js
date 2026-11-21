'use strict';

const { db } = require('../config/firebase');

const DOC_ID = 'serviceParametros';
const MAX_ITEMS = 100;

function defaults() {
  return [
    { nombre: 'Cambio de aceite', km: 10000, meses: null, fijo: true },
    { nombre: 'Cambio filtro de aceite', km: 10000, meses: null, fijo: true },
    { nombre: 'Cambio filtro de combustible', km: 20000, meses: null, fijo: true },
    { nombre: 'Cambio filtro de aire', km: 30000, meses: null, fijo: true },
    { nombre: 'Cambio filtro de habitáculo', km: 15000, meses: null, fijo: true },
    { nombre: 'Alineación', km: null, meses: null, fijo: false },
    { nombre: 'Balanceo', km: null, meses: null, fijo: false },
    { nombre: 'Control de caja', km: null, meses: null, fijo: false },
    { nombre: 'Control de diferencial', km: null, meses: null, fijo: false },
    { nombre: 'Caja y diferencial', km: null, meses: null, fijo: false },
    { nombre: 'Control de neumáticos', km: null, meses: null, fijo: false },
    { nombre: 'Cambio pastillas de freno', km: null, meses: null, fijo: false },
    { nombre: 'Cambio líquido de frenos', km: null, meses: null, fijo: false },
    { nombre: 'Cambio correa de distribución', km: null, meses: null, fijo: false },
    { nombre: 'Control de batería', km: null, meses: null, fijo: false },
    { nombre: 'Control de refrigerante', km: null, meses: null, fijo: false },
    { nombre: 'Engrase de Pluma y Chasis', km: null, meses: 3, fijo: true },
    { nombre: 'Engrase de Chasis', km: null, meses: 3, fijo: true },
    { nombre: 'Sopleteado de Filtro de Aire', km: null, meses: 3, fijo: true },
    { nombre: 'Calibrado de ruedas', km: null, meses: 2, fijo: true },
    { nombre: 'Calibrado de Luces', km: null, meses: 2, fijo: true }
  ];
}

function normalizarItems(lista) {
  if (!Array.isArray(lista)) return defaults();
  const out = [];
  const vistos = new Set();
  for (const raw of lista.slice(0, MAX_ITEMS)) {
    const nombre = String(raw && raw.nombre != null ? raw.nombre : '').trim().slice(0, 80);
    if (!nombre) continue;
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const kmCrudo = raw.km === '' || raw.km == null ? null : parseInt(raw.km, 10);
    const mesesCrudo = raw.meses === '' || raw.meses == null ? null : parseInt(raw.meses, 10);
    out.push({
      nombre,
      km: Number.isFinite(kmCrudo) && kmCrudo > 0 ? Math.min(kmCrudo, 1000000) : null,
      meses: Number.isFinite(mesesCrudo) && mesesCrudo > 0 ? Math.min(mesesCrudo, 120) : null,
      fijo: raw.fijo === true || raw.fijo === 1 || raw.fijo === '1' || raw.fijo === 'true'
    });
  }
  return out;
}

async function getParametros() {
  const doc = await db.collection('config').doc(DOC_ID).get();
  if (!doc.exists) return { items: defaults(), actualizadoEn: null, actualizadoPor: null };
  const data = doc.data() || {};
  return {
    items: normalizarItems(data.items),
    actualizadoEn: data.actualizadoEn || null,
    actualizadoPor: data.actualizadoPor || null
  };
}

async function guardarParametros(body, usuario) {
  if (!body || !Array.isArray(body.items)) {
    throw new Error('Debe enviar la lista de ítems');
  }
  const items = normalizarItems(body.items);
  const actualizadoEn = new Date();
  const actualizadoPor = String(usuario || '');
  await db.collection('config').doc(DOC_ID).set({ items, actualizadoEn, actualizadoPor });
  return { items, actualizadoEn, actualizadoPor };
}

module.exports = { defaults, normalizarItems, getParametros, guardarParametros };
