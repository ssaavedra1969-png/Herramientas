'use strict';

const { db } = require('../config/firebase');

function cleanTimestamps(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && v.constructor && v.constructor.name === 'Timestamp') {
      out[k] = v.toDate().toISOString();
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = cleanTimestamps(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map(x => (x && typeof x === 'object' ? cleanTimestamps(x) : x));
    } else {
      out[k] = v;
    }
  }
  return out;
}

function cmpNatural(a, b) {
  return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

async function cargarObraCompleta(centroId) {
  const doc = await db.collection('centros').doc(centroId).get();
  if (!doc.exists) return null;

  const centro = cleanTimestamps({ id: doc.id, ...doc.data() });

  const [elementosSnap, vehiculosSnap, catalogoSnap] = await Promise.all([
    db.collection(`centros/${centroId}/elementos`).orderBy('fechaAsignacion', 'desc').get(),
    db.collection('vehicles').get(),
    db.collection('elementos_catalogo').get()
  ]);

  const vehMap = {};
  vehiculosSnap.docs.forEach(d => {
    const v = d.data();
    const nombre = [v.marca, v.modelo, v.anio].filter(Boolean).join(' ').trim();
    const info = {
      nombre: nombre || 'Vehículo',
      marca: v.marca || '',
      modelo: v.modelo || '',
      tipoVehiculo: v.tipo || '',
      chofer: v.chofer || v.conductorHabitual || '',
      patente: v.patente || '',
      descripcion: ''
    };
    if (v.patente) vehMap[String(v.patente).toUpperCase()] = info;
    if (v.interno) vehMap[String(v.interno).toUpperCase()] = info;
  });

  const catMap = {};
  catalogoSnap.docs.forEach(d => {
    const c = d.data();
    if (!c.interno) return;
    catMap[String(c.interno).toUpperCase()] = {
      nombre: c.nombre || '',
      marca: c.marca || '',
      modelo: c.modelo || '',
      sector: c.sector || '',
      stock: Number.isFinite(Number(c.stock)) ? Number(c.stock) : 1,
      descripcion: c.descripcion || '',
      tipoVehiculo: '',
      chofer: ''
    };
  });

  const elementos = elementosSnap.docs.map(d => {
    const e = cleanTimestamps({ id: d.id, ...d.data() });
    const key = String(e.interno || '').toUpperCase();
    const info = e.elementoTipo === 'vehiculo' ? vehMap[key] : catMap[key];
    const stock = info && Number.isFinite(Number(info.stock)) ? Number(info.stock) : 1;
    return {
      ...e,
      nombre: info?.nombre || e.nombre || '',
      marca: info?.marca || e.marca || '',
      modelo: info?.modelo || e.modelo || '',
      descripcion: info?.descripcion || e.descripcion || '',
      stock: stock > 0 ? stock : 1,
      sector: e.sector || info?.sector || '',
      tipoVehiculo: info?.tipoVehiculo || e.tipoVehiculo || '',
      chofer: info?.chofer || e.chofer || ''
    };
  });

  elementos.sort((a, b) => cmpNatural(a.interno, b.interno));

  return { centro, elementos };
}

const SECTOR_ORDER = [
  'planta dosificadora',
  'silo movil',
  'silo móvil',
  'contenedor 1',
  'contenedor 2'
];

const SECTOR_COLORS = {
  'planta dosificadora': '#B45309',
  'silo movil': '#0E7490',
  'silo móvil': '#0E7490',
  'contenedor 1': '#047857',
  'contenedor 2': '#6D28D9'
};

function normSector(s) {
  return String(s || '').toLowerCase().trim();
}

function colorSector(s) {
  return SECTOR_COLORS[normSector(s)] || '#334155';
}

function agruparPorSector(elementos) {
  const map = new Map();
  elementos.forEach(e => {
    const sector = String(e.sector || '').trim() || 'Sin sector asignado';
    if (!map.has(sector)) map.set(sector, []);
    map.get(sector).push(e);
  });

  const grupos = Array.from(map.entries()).map(([nombre, items]) => {
    items.sort((a, b) => cmpNatural(a.interno, b.interno));
    const unidades = items.reduce((acc, e) => acc + (Number(e.stock) || 1), 0);
    const tipos = {};
    items.forEach(e => {
      const t = e.elementoTipo || 'otro';
      tipos[t] = (tipos[t] || 0) + 1;
    });
    return {
      nombre,
      slug: normSector(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-sector',
      color: colorSector(nombre),
      items,
      count: items.length,
      unidades,
      tipos
    };
  });

  grupos.sort((a, b) => {
    const ia = SECTOR_ORDER.indexOf(normSector(a.nombre));
    const ib = SECTOR_ORDER.indexOf(normSector(b.nombre));
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return cmpNatural(a.nombre, b.nombre);
  });

  return grupos;
}

module.exports = { cargarObraCompleta, agruparPorSector, cmpNatural };
