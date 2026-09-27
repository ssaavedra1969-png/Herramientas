const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const TTL_CENTROS = 60 * 1000;
const cacheTTL = new Map();

function getCache(key, ttl) {
  const hit = cacheTTL.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.value;
  if (hit) cacheTTL.delete(key);
  return null;
}
function setCache(key, value) {
  cacheTTL.set(key, { t: Date.now(), value });
}

/* ── CATÁLOGO DE ELEMENTOS ── */
const TIPOS_ELEMENTOS = ['vehiculo', 'herramienta', 'equipo', 'ropa', 'material'];

function cleanTimestamps(obj) {
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && v.constructor && v.constructor.name === 'Timestamp') {
      cleaned[k] = v.toDate().toISOString();
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      cleaned[k] = cleanTimestamps(v);
    } else if (Array.isArray(v)) {
      cleaned[k] = v.map(item => typeof item === 'object' ? cleanTimestamps(item) : item);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

async function getVehicleList() {
  const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
  return snap.docs.map(d => {
    const v = d.data();
    return {
      id: d.id,
      interno: v.patente || v.interno || '',
      nombre: `${v.patente || v.interno || ''} — ${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim()
    };
  });
}

async function getCatalogElements(tipo) {
  const col = db.collection('elementos_catalogo').where('tipo', '==', tipo);
  const snap = await col.get();
  const items = snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, nombre: data.nombre, interno: data.interno || data.elementoId || '', marca: data.marca || '', modelo: data.modelo || '', descripcion: data.descripcion || '', stock: data.stock || 0 };
  });
  items.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return items;
}

async function getAvailableElements(tipo) {
  if (tipo === 'vehiculo') return await getVehicleList();
  return await getCatalogElements(tipo);
}

router.get('/elementos/disponibles/:tipo', verifyToken, async (req, res) => {
  try {
    const tipo = req.params.tipo;
    if (!TIPOS_ELEMENTOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    const elements = await getAvailableElements(tipo);
    res.json(elements.map(e => cleanTimestamps(e)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const TIPOS_PREFIJO = { vehiculo: 'V', herramienta: 'H', equipo: 'E', ropa: 'R', material: 'M' };

async function getNextCatalogNumber(tipo) {
  const prefijo = TIPOS_PREFIJO[tipo];
  const counterRef = db.collection('counters').doc(tipo);
  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    if (!doc.exists) {
      const snap = await db.collection('elementos_catalogo').where('tipo', '==', tipo).get();
      let max = 0;
      snap.docs.forEach(d => {
        const m = (d.data().interno || '').match(new RegExp(`^${prefijo}0*(\\d+)$`));
        if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
      });
      transaction.set(counterRef, { current: max });
      return { number: max + 1, formatted: `${prefijo}${String(max + 1).padStart(3, '0')}` };
    }
    const next = (doc.data().current || 0) + 1;
    transaction.update(counterRef, { current: next });
    return { number: next, formatted: `${prefijo}${String(next).padStart(3, '0')}` };
  });
  return result;
}

router.post('/elementos/disponibles', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tipo, nombre, descripcion, marca, modelo, stock } = req.body;
    if (!tipo || !nombre) return res.status(400).json({ error: 'tipo y nombre son obligatorios' });
    if (!TIPOS_ELEMENTOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    const { formatted } = await getNextCatalogNumber(tipo);
    await db.collection('elementos_catalogo').add({
      tipo,
      interno: formatted,
      nombre,
      descripcion: descripcion || '',
      marca: marca || '',
      modelo: modelo || '',
      stock: stock || 1,
      createdAt: new Date()
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/elementos/disponibles/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('elementos_catalogo').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/catalogo', verifyToken, async (req, res) => {
  try {
    const tipos = TIPOS_ELEMENTOS;
    const catalogo = {};
    for (const tipo of tipos) {
      const snap = await db.collection('elementos_catalogo').where('tipo', '==', tipo).get();
      catalogo[tipo] = snap.docs.map(d => cleanTimestamps({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    res.json(catalogo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ── FIN CATÁLOGO ── */

router.get('/', verifyToken, async (req, res) => {
  try {
    const cacheado = getCache('centros-list', TTL_CENTROS);
    if (cacheado) return res.json(cacheado);
    const snapshot = await db.collection('centros').orderBy('nombre', 'asc').get();
    const centros = snapshot.docs.map(d => cleanTimestamps({ id: d.id, ...d.data() }));
    setCache('centros-list', centros);
    res.json(centros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, ubicacion, observaciones } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const docRef = await db.collection('centros').add({
      nombre: nombre.trim(),
      ubicacion: ubicacion?.trim() || '',
      observaciones: observaciones?.trim() || '',
      estado: 'activa',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    cacheTTL.delete('centros-list');
    res.status(201).json({ id: docRef.id, nombre });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const cacheKey = `centro-${req.params.id}`;
    const cacheado = getCache(cacheKey, TTL_CENTROS);
    if (cacheado) return res.json(cacheado);
    const doc = await db.collection('centros').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Centro no encontrado' });
    const centro = cleanTimestamps({ id: doc.id, ...doc.data() });

    const elementosSnap = await db.collection(`centros/${req.params.id}/elementos`)
      .orderBy('fechaAsignacion', 'desc').get();
    const elementos = elementosSnap.docs.map(d => cleanTimestamps({ id: d.id, ...d.data() }));
    centro.elementos = elementos;
    centro.totalElementos = elementos.length;
    centro.asignados = elementos.filter(e => !e.fechaDevolucion || e.fechaDevolucion === '').length;
    centro.devueltos = elementos.filter(e => e.fechaDevolucion && e.fechaDevolucion !== '').length;

    setCache(cacheKey, centro);
    res.json(centro);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { estado, observaciones, ubicacion } = req.body;
    const update = { updatedAt: new Date() };
    if (estado) update.estado = estado;
    if (observaciones !== undefined) update.observaciones = observaciones;
    if (ubicacion !== undefined) update.ubicacion = ubicacion;
    await db.collection('centros').doc(req.params.id).update(update);
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/elementos', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { interno, elementoTipo, origenCentro, observaciones } = req.body;
    if (!interno || !elementoTipo) {
      return res.status(400).json({ error: 'interno y elementoTipo son obligatorios' });
    }
    const docRef = await db.collection(`centros/${req.params.id}/elementos`).add({
      interno,
      elementoTipo,
      origenCentro: origenCentro || null,
      fechaAsignacion: new Date(),
      fechaDevolucion: '',
      observaciones: observaciones?.trim() || '',
      createdAt: new Date()
    });
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.status(201).json({ id: docRef.id, interno, elementoTipo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/elementos/:elemId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const elemRef = db.collection(`centros/${req.params.id}/elementos`).doc(req.params.elemId);
    const doc = await elemRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Elemento no encontrado en este centro' });
    await elemRef.update({
      fechaDevolucion: new Date(),
      updatedAt: new Date()
    });
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
